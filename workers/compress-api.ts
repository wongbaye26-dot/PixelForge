import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import PQueue from 'p-queue'
import { Piscina } from 'piscina'
import type Database from 'better-sqlite3'
import { CACHE_DIR } from './thumbnail.js'
import { getExportsDir } from './paths.js'
import { getStoredExportDir } from './settings.js'

type CompressJobStatus = 'queued' | 'running' | 'done' | 'error'

type CompressJob = {
  id: string
  batchId: string
  assetId: number
  inputPath: string
  outputPath: string
  status: CompressJobStatus
  progress: number
  createdAt: number
  beforeBytes: number
  afterBytes: number
  finalQuality?: number
  format?: string
  previewName?: string
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

function resolveCompressWorkerFile(): string | null {
  const candidates = [
    path.join(RUNTIME_DIR, 'compress-processor.cjs'),
    path.join(RUNTIME_DIR, '..', 'electron-dist', 'compress-processor.cjs'),
    path.join(process.cwd(), 'electron-dist', 'compress-processor.cjs'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

const compressWorkerFile = resolveCompressWorkerFile()
const compressPool = compressWorkerFile ? new Piscina({ filename: compressWorkerFile, minThreads: 1, maxThreads: 4 }) : null
const compressQueue = new PQueue({ concurrency: 2 })
const compressJobs = new Map<string, CompressJob>()

export async function handleCompressApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'POST' && pathname === '/api/compress/submit') {
    const body = (await readBody(req)) as {
      assetIds?: number[]
      outputFormat?: 'auto' | 'original' | 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif'
      quality?: number
      targetSizeKb?: number
      mozjpeg?: boolean
      usePngquant?: boolean
      outputDir?: string
      namingPattern?: string
    }

    if (!compressPool) {
      json(res, { error: 'compress worker not available, run build:worker first' }, 500)
      return true
    }

    const assetIds = body.assetIds ?? []
    if (assetIds.length === 0) {
      json(res, { error: 'assetIds required' }, 400)
      return true
    }

    const quality = body.quality ?? 85
    const outputFormat = body.outputFormat ?? 'auto'
    const namingPattern = body.namingPattern?.trim() || '{name}_compressed.{format}'
    const outputDir = body.outputDir?.trim() || getStoredExportDir(db) || getExportsDir()
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

    const getAsset = db.prepare(`SELECT id, path, filename FROM assets WHERE id = ?`)
    const batchId = uid('compress')
    const created: CompressJob[] = []

    for (const id of assetIds) {
      const row = getAsset.get(id) as { id: number; path: string; filename: string } | undefined
      if (!row) continue

      const baseName = row.filename.replace(/\.[^.]+$/, '')
      const safeName = baseName.replace(/[\\/:"*?<>|]+/g, '_')
      const extFromFmt = outputFormat === 'original' ? path.extname(row.filename).slice(1) : outputFormat
      const outExt = (extFromFmt && extFromFmt !== 'auto' ? String(extFromFmt) : 'webp').toLowerCase()
      const outName = namingPattern
        .replaceAll('{name}', safeName)
        .replaceAll('{format}', outExt === 'jpeg' ? 'jpg' : outExt)
      const outputPath = path.join(outputDir, outName)

      const job: CompressJob = {
        id: uid('cjob'),
        batchId,
        assetId: row.id,
        inputPath: row.path,
        outputPath,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
        beforeBytes: 0,
        afterBytes: 0,
      }
      compressJobs.set(job.id, job)
      created.push(job)
    }

    void compressQueue.addAll(
      created.map((job) => async () => {
        job.status = 'running'
        job.progress = 10

        const previewName = `compress_${job.id}.webp`
        job.previewName = previewName

        try {
          job.progress = 35
          const result = (await compressPool.run({
            inputPath: job.inputPath,
            outputPath: job.outputPath,
            previewPath: path.join(CACHE_DIR, previewName),
            outputFormat,
            quality,
            targetSizeKb: body.targetSizeKb,
            mozjpeg: body.mozjpeg,
            usePngquant: body.usePngquant,
          })) as {
            beforeBytes: number
            afterBytes: number
            finalQuality?: number
            format: string
          }

          job.beforeBytes = result.beforeBytes
          job.afterBytes = result.afterBytes
          job.finalQuality = result.finalQuality
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

    json(res, {
      batchId,
      total: created.length,
      jobIds: created.map((j) => j.id),
    })
    return true
  }

  if (req.method === 'GET' && pathname === '/api/compress/jobs') {
    const batchId = url.searchParams.get('batchId')?.trim()
    const idsParam = url.searchParams.get('ids')?.trim()

    const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : []
    const rows = [...compressJobs.values()].filter((j) => {
      if (batchId) return j.batchId === batchId
      if (ids.length) return ids.includes(j.id)
      return false
    })

    json(res, { jobs: rows })
    return true
  }

  return false
}
