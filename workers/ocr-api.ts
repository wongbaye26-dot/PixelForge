import { existsSync } from 'node:fs'
import { Piscina } from 'piscina'
import PQueue from 'p-queue'
import type Database from 'better-sqlite3'
import { mapWorkerError } from './error-mapper.js'
import { isTesseractCliAvailable, preferredOcrEngine } from './ocr-engine.js'
import { uid, json, readBody } from './utils.js'
import { resolveWorkerFile } from './resolve-worker.js'

type OcrJobStatus = 'queued' | 'running' | 'done' | 'error'

type OcrJob = {
  id: string
  batchId: string
  assetId: number
  status: OcrJobStatus
  progress: number
  text: string
  engine: string
  error?: string
}

const ocrWorkerFile = resolveWorkerFile('ocr')
const ocrPool = ocrWorkerFile ? new Piscina({ filename: ocrWorkerFile, minThreads: 1, maxThreads: 2 }) : null
const ocrQueue = new PQueue({ concurrency: 2 })
const ocrJobs = new Map<string, OcrJob>()

export async function handleOcrApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'GET' && pathname === '/api/ocr/status') {
    json(res, {
      workerReady: Boolean(ocrPool),
      cliAvailable: isTesseractCliAvailable(),
      engine: preferredOcrEngine(),
    })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/ocr/scan') {
    const body = (await readBody(req)) as { assetIds?: number[]; lang?: string }

    if (!ocrPool) {
      json(res, { error: 'OCR 工作线程未就绪，请执行 npm run build:worker 后重试' }, 500)
      return true
    }

    const assetIds = (body.assetIds ?? []).map((id) => Number(id)).filter((id) => id > 0)
    if (!assetIds.length) {
      json(res, { error: '缺少 assetIds 参数' }, 400)
      return true
    }

    const lang = body.lang?.trim() || 'chi_sim+eng'
    const batchId = uid('ocr')
    const getAsset = db.prepare(`SELECT id, path FROM assets WHERE id = ? AND deleted_at IS NULL`)
    const updateText = db.prepare(`UPDATE assets SET ocr_text = ? WHERE id = ?`)
    const created: OcrJob[] = []

    for (const id of assetIds) {
      const row = getAsset.get(id) as { id: number; path: string } | undefined
      if (!row || !existsSync(row.path)) continue

      const job: OcrJob = {
        id: uid('ocrjob'),
        batchId,
        assetId: row.id,
        status: 'queued',
        progress: 0,
        text: '',
        engine: '',
      }
      ocrJobs.set(job.id, job)
      created.push(job)
    }

    void ocrQueue.addAll(
      created.map((job) => async () => {
        const row = getAsset.get(job.assetId) as { id: number; path: string }
        job.status = 'running'
        job.progress = 20
        try {
          const result = (await ocrPool.run({ inputPath: row.path, lang })) as {
            text: string
            engine: string
            error?: string
          }
          job.text = result.text
          job.engine = result.engine
          job.progress = 90
          if (result.text) {
            updateText.run(result.text, job.assetId)
          }
          job.status = result.error && !result.text ? 'error' : 'done'
          job.error = result.error
          job.progress = 100
        } catch (e) {
          job.status = 'error'
          job.progress = 100
          job.error = mapWorkerError(e, 'OCR 失败').message
        }
      }),
    )

    json(res, { batchId, total: created.length, jobIds: created.map((j) => j.id) })
    return true
  }

  if (req.method === 'GET' && pathname === '/api/ocr/jobs') {
    const batchId = url.searchParams.get('batchId')?.trim()
    const idsParam = url.searchParams.get('ids')?.trim()
    const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : []

    const rows = [...ocrJobs.values()].filter((j) => {
      if (batchId) return j.batchId === batchId
      if (ids.length) return ids.includes(j.id)
      return false
    })

    json(res, { jobs: rows })
    return true
  }

  return false
}
