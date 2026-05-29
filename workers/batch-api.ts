import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import PQueue from 'p-queue'
import { Piscina } from 'piscina'
import type Database from 'better-sqlite3'
import { getExportsDir } from './paths.js'
import { getStoredExportDir } from './settings.js'

type BatchJobStatus = 'queued' | 'running' | 'done' | 'error'

type BatchJob = {
  id: string
  batchId: string
  assetId: number
  inputPath: string
  outputPath: string
  status: BatchJobStatus
  progress: number
  createdAt: number
  startedAt?: number
  finishedAt?: number
  error?: string
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function json(res: import('node:http').ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

async function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

declare const __dirname: string | undefined
const RUNTIME_DIR = typeof __dirname === 'string' ? __dirname : process.cwd()

function resolveBatchWorkerFile(): string | null {
  const candidates = [
    path.join(RUNTIME_DIR, 'batch-processor.cjs'),
    path.join(RUNTIME_DIR, '..', 'electron-dist', 'batch-processor.cjs'),
    path.join(process.cwd(), 'electron-dist', 'batch-processor.cjs'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

const batchWorkerFile = resolveBatchWorkerFile()
const batchPool = batchWorkerFile ? new Piscina({ filename: batchWorkerFile, minThreads: 1, maxThreads: 4 }) : null
const batchQueue = new PQueue({ concurrency: 2 })
const batchJobs = new Map<string, BatchJob>()

export async function handleBatchApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'POST' && pathname === '/api/batch/submit') {
    const body = (await readBody(req)) as {
      assetIds?: number[]
      resize?: { width: number; height: number; fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside' }
      format?: 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'
      quality?: number
      outputDir?: string
      namingPattern?: string
    }

    if (!batchPool) {
      json(res, { error: 'batch worker not available, run build:worker first' }, 500)
      return true
    }

    const assetIds = body.assetIds ?? []
    if (assetIds.length === 0) {
      json(res, { error: 'assetIds required' }, 400)
      return true
    }

    const namingPattern = body.namingPattern?.trim() || '{name}_{op}.{format}'
    const outputDir = body.outputDir?.trim() || getStoredExportDir(db) || getExportsDir()
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

    const getAsset = db.prepare(`SELECT id, path, filename FROM assets WHERE id = ?`)
    const batchId = uid('batch')
    const created: BatchJob[] = []

    for (const id of assetIds) {
      const row = getAsset.get(id) as { id: number; path: string; filename: string } | undefined
      if (!row) continue

      const srcName = row.filename.replace(/\.[^.]+$/, '')
      const fmt = (body.format ?? path.extname(row.filename).slice(1)).toLowerCase()
      const outExt = fmt || 'webp'
      const opLabel = body.resize?.width && body.resize?.height ? `${body.resize.width}x${body.resize.height}` : 'copy'
      const outName = namingPattern
        .replaceAll('{name}', srcName)
        .replaceAll('{op}', opLabel)
        .replaceAll('{format}', outExt)
      const outputPath = path.join(outputDir, outName)

      const job: BatchJob = {
        id: uid('job'),
        batchId,
        assetId: row.id,
        inputPath: row.path,
        outputPath,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
      }
      batchJobs.set(job.id, job)
      created.push(job)
    }

    void batchQueue.addAll(
      created.map((job) => async () => {
        job.status = 'running'
        job.progress = 10
        job.startedAt = Date.now()

        try {
          job.progress = 30
          await batchPool.run({
            inputPath: job.inputPath,
            outputPath: job.outputPath,
            resize: body.resize,
            format: body.format,
            quality: body.quality,
          })
          job.status = 'done'
          job.progress = 100
          job.finishedAt = Date.now()
        } catch (e) {
          job.status = 'error'
          job.progress = 100
          job.error = e instanceof Error ? e.message : String(e)
          job.finishedAt = Date.now()
        }
      }),
    )

    json(res, {
      batchId,
      total: created.length,
      jobIds: created.map((j) => j.id),
    })
    return true
  }

  if (req.method === 'GET' && pathname === '/api/batch/jobs') {
    const batchId = url.searchParams.get('batchId')?.trim()
    const idsParam = url.searchParams.get('ids')?.trim()

    const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : []
    const rows = [...batchJobs.values()].filter((j) => {
      if (batchId) return j.batchId === batchId
      if (ids.length) return ids.includes(j.id)
      return false
    })

    json(res, { jobs: rows })
    return true
  }

  return false
}
