import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import PQueue from 'p-queue'
import { Piscina } from 'piscina'
import type Database from 'better-sqlite3'
import { getExportsDir } from './paths.js'
import { getStoredExportDir } from './settings.js'

type ConvertJobStatus = 'queued' | 'running' | 'done' | 'error'

type ConvertJob = {
  id: string
  batchId: string
  assetId: number
  inputPath: string
  outputPath: string
  status: ConvertJobStatus
  progress: number
  createdAt: number
  bytes?: number
  format?: string
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

function resolveConvertWorkerFile(): string | null {
  const candidates = [
    path.join(RUNTIME_DIR, 'convert-processor.cjs'),
    path.join(RUNTIME_DIR, '..', 'electron-dist', 'convert-processor.cjs'),
    path.join(process.cwd(), 'electron-dist', 'convert-processor.cjs'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

const convertWorkerFile = resolveConvertWorkerFile()
const convertPool = convertWorkerFile ? new Piscina({ filename: convertWorkerFile, minThreads: 1, maxThreads: 4 }) : null
const convertQueue = new PQueue({ concurrency: 2 })
const convertJobs = new Map<string, ConvertJob>()

export async function handleConvertApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'POST' && pathname === '/api/convert/submit') {
    const body = (await readBody(req)) as {
      assetIds?: number[]
      targetFormat?: 'png' | 'webp' | 'avif' | 'jpg' | 'jpeg'
      quality?: number
      keepExif?: boolean
      outputDir?: string
      namingPattern?: string
    }

    if (!convertPool) {
      json(res, { error: 'convert worker not available, run build:worker first' }, 500)
      return true
    }

    const assetIds = body.assetIds ?? []
    if (assetIds.length === 0) {
      json(res, { error: 'assetIds required' }, 400)
      return true
    }

    const targetFormat = body.targetFormat ?? 'webp'
    const quality = body.quality ?? 90
    const keepExif = Boolean(body.keepExif)
    const namingPattern = body.namingPattern?.trim() || '{name}.{format}'
    const outputDir = body.outputDir?.trim() || getStoredExportDir(db) || getExportsDir()
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

    const getAsset = db.prepare(`SELECT id, path, filename FROM assets WHERE id = ?`)
    const batchId = uid('convert')
    const created: ConvertJob[] = []

    for (const id of assetIds) {
      const row = getAsset.get(id) as { id: number; path: string; filename: string } | undefined
      if (!row) continue
      const baseName = row.filename.replace(/\.[^.]+$/, '')
      const safeName = baseName.replace(/[\\/:"*?<>|]+/g, '_')
      const outName = namingPattern.replaceAll('{name}', safeName).replaceAll('{format}', targetFormat === 'jpeg' ? 'jpg' : targetFormat)
      const outputPath = path.join(outputDir, outName)

      const job: ConvertJob = {
        id: uid('vjob'),
        batchId,
        assetId: row.id,
        inputPath: row.path,
        outputPath,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
      }
      convertJobs.set(job.id, job)
      created.push(job)
    }

    void convertQueue.addAll(
      created.map((job) => async () => {
        job.status = 'running'
        job.progress = 15
        try {
          job.progress = 40
          const result = (await convertPool.run({
            inputPath: job.inputPath,
            outputPath: job.outputPath,
            targetFormat,
            quality,
            keepExif,
          })) as { bytes: number; format: string }
          job.bytes = result.bytes
          job.format = result.format
          job.status = 'done'
          job.progress = 100
        } catch (e) {
          job.status = 'error'
          job.progress = 100
          job.error = e instanceof Error ? e.message : String(e)
        }
      }),
    )

    json(res, { batchId, total: created.length, jobIds: created.map((j) => j.id) })
    return true
  }

  if (req.method === 'GET' && pathname === '/api/convert/jobs') {
    const batchId = url.searchParams.get('batchId')?.trim()
    const idsParam = url.searchParams.get('ids')?.trim()

    const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : []
    const rows = [...convertJobs.values()].filter((j) => {
      if (batchId) return j.batchId === batchId
      if (ids.length) return ids.includes(j.id)
      return false
    })

    json(res, { jobs: rows })
    return true
  }

  return false
}

