import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import PQueue from 'p-queue'
import { Piscina } from 'piscina'
import type Database from 'better-sqlite3'
import { mapWorkerError } from './error-mapper.js'
import {
  cancelModuleJobs,
  prepareModuleJobRetry,
  shouldSkipModuleJob,
  markJobCompleted,
  pruneStaleJobs,
  type ModuleBatchContext,
} from './module-job-controls.js'
import { getExportsDir } from './paths.js'
import { getStoredExportDir } from './settings.js'
import { uid, json, readBody } from './utils.js'
import { resolveWorkerFile } from './resolve-worker.js'

export interface ModuleApiJob {
  id: string
  batchId: string
  assetId: number
  inputPath: string
  outputPath: string
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'
  progress: number
  createdAt: number
  error?: string
  cancelRequested?: boolean
  [key: string]: unknown
}

export interface ModuleApiOptions<B extends Record<string, unknown>> {
  moduleName: string
  workerName: string
  apiPrefix: string
  defaultNamingPattern: string
  extraJobFields: (row: { id: number; path: string; filename: string }, body: B) => Record<string, unknown>
  formatOutputName: (row: { id: number; path: string; filename: string }, namingPattern: string, extra: Record<string, unknown>) => string
  createRunPayload: (job: ModuleApiJob, body: B) => Record<string, unknown>
  handleRunResult: (job: ModuleApiJob, result: unknown) => void
  errorMessage: string
  submitErrorMessage: string
}

export function createModuleJobApi<B extends Record<string, unknown>>(opts: ModuleApiOptions<B>) {
  const workerFile = resolveWorkerFile(opts.workerName)
  const pool = workerFile ? new Piscina({ filename: workerFile, minThreads: 1, maxThreads: 4 }) : null
  const queue = new PQueue({ concurrency: 2 })
  const jobs = new Map<string, ModuleApiJob>()
  const contexts = new Map<string, ModuleBatchContext & { submitBody: B }>()

  async function runJob(job: ModuleApiJob, body: B) {
    const ctx = contexts.get(job.batchId)
    if (shouldSkipModuleJob(job, ctx)) return
    if (!pool) {
      job.status = 'error'
      job.progress = 100
      job.error = `${opts.workerName} 工作线程不可用`
      return
    }

    job.status = 'running'
    job.progress = 10

    try {
      if (shouldSkipModuleJob(job, ctx)) return
      job.progress = 30
      const result = await pool.run(opts.createRunPayload(job, body))
      if (shouldSkipModuleJob(job, ctx)) return
      opts.handleRunResult(job, result)
      job.status = 'done'
      job.progress = 100
      markJobCompleted(job)
    } catch (e) {
      if (job.cancelRequested || ctx?.cancelled) {
        job.status = 'cancelled'
        job.progress = 100
        return
      }
      job.status = 'error'
      job.progress = 100
      job.error = mapWorkerError(e, opts.errorMessage).message
      markJobCompleted(job)
    }
  }

  function queueJob(job: ModuleApiJob, body: B) {
    void queue.add(async () => runJob(job, body))
  }

  async function handleApi(
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    url: URL,
    db: Database.Database,
  ): Promise<boolean> {
    const { pathname } = url
    const prefix = `/${opts.apiPrefix}`

    if (req.method === 'POST' && pathname === `${prefix}/submit`) {
      const body = (await readBody(req)) as B & { assetIds?: number[]; outputDir?: string; namingPattern?: string }

      if (!pool) {
        json(res, { error: `${opts.workerName} 工作线程不可用，请先执行 npm run build:worker` }, 500)
        return true
      }

      const assetIds = body.assetIds ?? []
      if (assetIds.length === 0) {
        json(res, { error: '缺少 assetIds 参数' }, 400)
        return true
      }

      try {
        const namingPattern = body.namingPattern?.trim() || opts.defaultNamingPattern
        const outputDir = body.outputDir?.trim() || getStoredExportDir(db) || getExportsDir()
        if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

        const getAsset = db.prepare(`SELECT id, path, filename FROM assets WHERE id = ?`)
        const batchId = uid(opts.moduleName)
        const created: ModuleApiJob[] = []
        contexts.set(batchId, { cancelled: false, submitBody: body })

        for (const id of assetIds) {
          const row = getAsset.get(id) as { id: number; path: string; filename: string } | undefined
          if (!row) continue

          const extra = opts.extraJobFields(row, body)
          const outName = opts.formatOutputName(row, namingPattern, extra)

          const job: ModuleApiJob = {
            id: uid('mjob'),
            batchId,
            assetId: row.id,
            inputPath: row.path,
            outputPath: path.join(outputDir, outName),
            status: 'queued',
            progress: 0,
            createdAt: Date.now(),
            ...extra,
          }

          jobs.set(job.id, job)
          created.push(job)
        }

        for (const job of created) {
          queueJob(job, body)
        }

        json(res, {
          batchId,
          total: created.length,
          jobIds: created.map((j) => j.id),
        })
      } catch (err) {
        json(res, { error: mapWorkerError(err, opts.submitErrorMessage).message }, 500)
      }
      return true
    }

    if (req.method === 'GET' && pathname === `${prefix}/jobs`) {
      const batchId = url.searchParams.get('batchId')?.trim()
      const idsParam = url.searchParams.get('ids')?.trim()

      const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : []
      const rows = [...jobs.values()].filter((j) => {
        if (batchId) return j.batchId === batchId
        if (ids.length) return ids.includes(j.id)
        return false
      })

      json(res, { jobs: rows })
      return true
    }

    if (req.method === 'POST' && pathname === `${prefix}/cancel`) {
      const body = (await readBody(req)) as { batchId?: string; jobId?: string }
      const batchId = body.batchId?.trim()
      if (!batchId) {
        json(res, { error: '缺少 batchId 参数' }, 400)
        return true
      }
      const list = cancelModuleJobs(jobs, contexts, batchId, body.jobId?.trim())
      json(res, { jobs: list })
      return true
    }

    if (req.method === 'POST' && pathname === `${prefix}/retry`) {
      const body = (await readBody(req)) as { batchId?: string; jobId?: string }
      const batchId = body.batchId?.trim()
      const jobId = body.jobId?.trim()
      if (!batchId || !jobId) {
        json(res, { error: '缺少 batchId 和 jobId 参数' }, 400)
        return true
      }
      const job = jobs.get(jobId)
      const ctx = contexts.get(batchId)
      if (!job || job.batchId !== batchId || !ctx) {
        json(res, { error: '未找到任务' }, 404)
        return true
      }
      if (!prepareModuleJobRetry(job)) {
        json(res, { error: '仅失败或已取消的任务可以重试' }, 400)
        return true
      }
      ctx.cancelled = false
      queueJob(job, ctx.submitBody)
      json(res, { job })
      return true
    }

    return false
  }

  function pruneJobs(): number {
    return pruneStaleJobs(jobs)
  }

  return { handleApi, pruneJobs }
}
