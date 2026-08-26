import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import PQueue from 'p-queue'
import { Piscina } from 'piscina'
import sharp from 'sharp'
import type Database from 'better-sqlite3'
import { CACHE_DIR } from './thumbnail.js'
import { getExportsDir } from './paths.js'
import { getStoredExportDir } from './settings.js'
import { processAndExport, type ProcessOptions } from './image-processor.js'
import {
  bestCandidateForTarget,
  type MatchCandidate,
  type MatchStrategy,
} from '../src/core/match-scoring.js'
import type { ExportFormat, FitMode } from '../src/types/index.js'
import { uid, json, readBody } from './utils.js'
import { resolveWorkerFile } from './resolve-worker.js'

type ExportMatcherStatus = 'pending' | 'processing' | 'done' | 'error' | 'cancelled'

type ExportMatcherJob = {
  id: string
  batchId: string
  targetWidth: number
  targetHeight: number
  targetRatio: number
  imageId: number
  imagePath: string
  imageFilename: string
  imageRatio: number
  similarity: number
  recommendedMode: FitMode
  matchScore?: import('../src/core/match-scoring.js').MatchScore
  debugCandidates?: import('../src/core/match-scoring.js').MatchDebugCandidate[]
  status: ExportMatcherStatus
  progress: number
  outputPath?: string
  previewName?: string
  error?: string
}

type BatchExportOptions = {
  outputDir: string
  format: ExportFormat
  quality: number
  targetSizeKb?: number
  namingPattern: string
  autoCompressOptimize: boolean
}

type JobBatch = {
  jobs: ExportMatcherJob[]
  options: BatchExportOptions
  cancelled: boolean
}

const matcherWorkerFile = resolveWorkerFile('export-matcher')

async function isColorSimple(inputPath: string): Promise<boolean> {
  const buf = await sharp(inputPath, { animated: false, pages: 1, limitInputPixels: false })
    .resize(32, 32, { fit: 'cover' })
    .raw()
    .toBuffer()
  const px = 32 * 32
  let mean = 0
  for (let i = 0; i < px * 3; i += 3) {
    const r = buf[i] ?? 0
    const g = buf[i + 1] ?? 0
    const b = buf[i + 2] ?? 0
    mean += 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  mean /= px
  let varSum = 0
  for (let i = 0; i < px * 3; i += 3) {
    const r = buf[i] ?? 0
    const g = buf[i + 1] ?? 0
    const b = buf[i + 2] ?? 0
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const d = y - mean
    varSum += d * d
  }
  const std = Math.sqrt(varSum / px)
  return std < 18
}

async function recommendMode(
  targetRatio: number,
  imageRatio: number,
  inputPath: string,
  autoBackgroundOptimize: boolean,
): Promise<FitMode> {
  const diff = Math.abs(targetRatio - imageRatio)
  if (diff <= 0.08) return 'cover'
  if (diff <= 0.25) return 'contain'
  if (!autoBackgroundOptimize) return 'blur_extend'
  const simple = await isColorSimple(inputPath)
  return simple ? 'gradient_fill' : 'blur_extend'
}

const jobBatches = new Map<string, JobBatch>()
const exportQueue = new PQueue({ concurrency: 2 })

const matcherPool = matcherWorkerFile
  ? new Piscina<ProcessOptions, { outputPath: string }>({ filename: matcherWorkerFile, minThreads: 1, maxThreads: 4 })
  : null

async function runJobExport(job: ExportMatcherJob, options: BatchExportOptions, index: number) {
  const batch = jobBatches.get(job.batchId)
  if (!batch || batch.cancelled || job.status === 'cancelled') {
    job.status = 'cancelled'
    job.progress = 100
    return
  }

  job.status = 'processing'
  job.progress = 15
  job.error = undefined
  try {
    job.progress = 35
    const targetSizeKb = options.autoCompressOptimize ? options.targetSizeKb : undefined
    const outputPath = matcherPool
      ? (
          await matcherPool.run({
            inputPath: job.imagePath,
            outputDir: options.outputDir,
            width: job.targetWidth,
            height: job.targetHeight,
            format: options.format,
            fitMode: job.recommendedMode,
            quality: options.quality,
            targetSizeKb,
            namingPattern: options.namingPattern,
            index: index + 1,
          })
        ).outputPath
      : await processAndExport({
          inputPath: job.imagePath,
          outputDir: options.outputDir,
          width: job.targetWidth,
          height: job.targetHeight,
          format: options.format,
          fitMode: job.recommendedMode,
          quality: options.quality,
          targetSizeKb,
          namingPattern: options.namingPattern,
          index: index + 1,
        })
    job.outputPath = outputPath
    job.status = 'done'
    job.progress = 100
  } catch (e) {
    job.status = 'error'
    job.progress = 100
    job.error = e instanceof Error ? e.message : String(e)
  }
}

function queueJobExport(job: ExportMatcherJob, options: BatchExportOptions, index: number) {
  void exportQueue.add(async () => runJobExport(job, options, index))
}

function getBatchOr404(batchId: string, res: import('node:http').ServerResponse): JobBatch | null {
  const batch = jobBatches.get(batchId)
  if (!batch) {
    json(res, { error: '未找到批次' }, 404)
    return null
  }
  return batch
}

function getJobOr404(batch: JobBatch, jobId: string, res: import('node:http').ServerResponse): ExportMatcherJob | null {
  const job = batch.jobs.find((j) => j.id === jobId)
  if (!job) {
    json(res, { error: '未找到任务' }, 404)
    return null
  }
  return job
}

export async function handleExportMatcherApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'POST' && pathname === '/api/auto-match/submit') {
    const body = (await readBody(req)) as {
      sizes?: Array<{ width: number; height: number }>
      outputDir?: string
      format?: ExportFormat
      quality?: number
      targetSizeKb?: number
      namingPattern?: string
      autoRecommendMode?: boolean
      autoCompressOptimize?: boolean
      autoBackgroundOptimize?: boolean
      avoidUpscale?: boolean
      preferSlightDownscale?: boolean
      avoidOversize?: boolean
      highQualityFirst?: boolean
      debugMode?: boolean
      candidateAssetIds?: number[]
      scopeType?: 'all' | 'folder' | 'favorite' | 'recent'
      scopeId?: number
    }

    const sizes = (body.sizes ?? []).filter((s) => s && s.width > 0 && s.height > 0)
    if (!sizes.length) {
      json(res, { error: '缺少尺寸信息' }, 400)
      return true
    }

    const outputDir = body.outputDir?.trim() || getStoredExportDir(db) || getExportsDir()
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

    const format: ExportFormat = body.format ?? 'webp'
    const quality = body.quality ?? 90
    const namingPattern = body.namingPattern?.trim() || '{name}_{size}.{format}'
    const autoRecommendMode = body.autoRecommendMode !== false
    const autoCompressOptimize = body.autoCompressOptimize !== false
    const autoBackgroundOptimize = body.autoBackgroundOptimize !== false
    const strategy: MatchStrategy = {
      avoidUpscale: body.avoidUpscale !== false,
      preferSlightDownscale: body.preferSlightDownscale !== false,
      avoidOversize: body.avoidOversize !== false,
      highQualityFirst: body.highQualityFirst !== false,
    }
    const debugMode = body.debugMode === true

    const used = new Set<number>()
    const batchId = uid('match')
    const jobs: ExportMatcherJob[] = []
    const unmatchedSizes: Array<{ width: number; height: number }> = []

    const candidateAssetIds = (body.candidateAssetIds ?? []).filter((n) => Number.isFinite(n) && n > 0)
    const canRestrict = candidateAssetIds.length > 0 && candidateAssetIds.length <= 5000

    const scopeSqlExtra: { clause: string; params: unknown[] } = (() => {
      const scopeType = body.scopeType
      if (scopeType === 'folder' && body.scopeId != null) {
        return { clause: 'AND folder_id = ?', params: [body.scopeId] }
      }
      if (scopeType === 'favorite') {
        return { clause: 'AND favorite = 1', params: [] }
      }
      if (scopeType === 'recent') {
        return {
          clause: `AND id IN (
            SELECT id
            FROM assets
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT 500
          )`,
          params: [],
        }
      }
      return { clause: '', params: [] }
    })()

    const baseSql = `SELECT id, path, filename, ratio, width, height, COALESCE(area, width * height) AS area
       FROM assets
       WHERE ratio BETWEEN ? AND ? AND deleted_at IS NULL`

    const queryByRatio = scopeSqlExtra.clause
      ? db.prepare(`${baseSql} ${scopeSqlExtra.clause} ORDER BY ratio ASC LIMIT ?`)
      : db.prepare(`${baseSql} ORDER BY ratio ASC LIMIT ?`)

    let restrictedRows: MatchCandidate[] | null = null
    if (canRestrict) {
      const placeholders = candidateAssetIds.map(() => '?').join(',')
      restrictedRows = db
        .prepare(
          `SELECT id, path, filename, ratio, width, height, COALESCE(area, width * height) AS area
           FROM assets
           WHERE id IN (${placeholders}) AND deleted_at IS NULL
           ORDER BY ratio ASC`,
        )
        .all(...candidateAssetIds) as MatchCandidate[]
    }

    const restrictedById = restrictedRows ? new Map(restrictedRows.map((r) => [r.id, r])) : null

    for (const s of sizes) {
      const targetRatio = s.width / s.height
      const target = { width: s.width, height: s.height, ratio: targetRatio, area: s.width * s.height }

      let candidates: MatchCandidate[] = []
      if (restrictedRows) {
        candidates = restrictedRows
      } else {
        let window = 0.15
        let limit = 240
        for (let pass = 0; pass < 5; pass++) {
          const lo = Math.max(0.01, targetRatio - window)
          const hi = targetRatio + window
          const rows = queryByRatio.all(lo, hi, ...scopeSqlExtra.params, limit) as MatchCandidate[]
          candidates = rows
          if (candidates.length >= 48) break
          window *= 1.7
          limit = Math.min(800, Math.round(limit * 1.6))
        }
      }

      const { best, debug } = bestCandidateForTarget(candidates, target, used, strategy)
      if (!best) {
        unmatchedSizes.push({ width: s.width, height: s.height })
        continue
      }
      used.add(best.imageId)

      const asset = restrictedById
        ? restrictedById.get(best.imageId)!
        : candidates.find((c) => c.id === best.imageId)

      if (!asset) {
        unmatchedSizes.push({ width: s.width, height: s.height })
        continue
      }

      const recommendedMode = autoRecommendMode
        ? await recommendMode(targetRatio, asset.ratio, asset.path, autoBackgroundOptimize)
        : 'contain'

      jobs.push({
        id: uid('mjob'),
        batchId,
        targetWidth: s.width,
        targetHeight: s.height,
        targetRatio,
        imageId: asset.id,
        imagePath: asset.path,
        imageFilename: asset.filename,
        imageRatio: asset.ratio,
        similarity: best.score.finalScore,
        recommendedMode,
        matchScore: best.score,
        debugCandidates: debugMode ? debug : undefined,
        status: 'pending',
        progress: 0,
      })
    }

    const options: BatchExportOptions = {
      outputDir,
      format,
      quality,
      targetSizeKb: body.targetSizeKb,
      namingPattern,
      autoCompressOptimize,
    }

    jobBatches.set(batchId, { jobs, options, cancelled: false })

    jobs.forEach((job, index) => queueJobExport(job, options, index))

    json(res, { batchId, jobs, unmatchedSizes })
    return true
  }

  if (req.method === 'GET' && pathname === '/api/auto-match/jobs') {
    const batchId = url.searchParams.get('batchId')?.trim()
    if (!batchId) {
      json(res, { error: '缺少 batchId 参数' }, 400)
      return true
    }
    const batch = jobBatches.get(batchId)
    if (!batch) {
      json(res, { jobs: [] })
      return true
    }
    json(res, { jobs: batch.jobs })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/auto-match/cancel') {
    const body = (await readBody(req)) as { batchId?: string; jobId?: string }
    const batchId = body.batchId?.trim()
    if (!batchId) {
      json(res, { error: '缺少 batchId 参数' }, 400)
      return true
    }
    const batch = getBatchOr404(batchId, res)
    if (!batch) return true

    if (body.jobId) {
      const job = getJobOr404(batch, body.jobId, res)
      if (!job) return true
      if (job.status === 'pending') {
        job.status = 'cancelled'
        job.progress = 100
      }
    } else {
      batch.cancelled = true
      for (const job of batch.jobs) {
        if (job.status === 'pending') {
          job.status = 'cancelled'
          job.progress = 100
        }
      }
    }
    json(res, { jobs: batch.jobs })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/auto-match/retry') {
    const body = (await readBody(req)) as { batchId?: string; jobId?: string }
    const batchId = body.batchId?.trim()
    const jobId = body.jobId?.trim()
    if (!batchId || !jobId) {
      json(res, { error: '缺少 batchId 和 jobId 参数' }, 400)
      return true
    }
    const batch = getBatchOr404(batchId, res)
    if (!batch) return true
    const job = getJobOr404(batch, jobId, res)
    if (!job) return true
    if (job.status !== 'error' && job.status !== 'cancelled') {
      json(res, { error: '仅失败或已取消的任务可以重试' }, 400)
      return true
    }
    batch.cancelled = false
    job.status = 'pending'
    job.progress = 0
    job.error = undefined
    job.outputPath = undefined
    const index = batch.jobs.findIndex((j) => j.id === job.id)
    queueJobExport(job, batch.options, Math.max(0, index))
    json(res, { job })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/auto-match/swap') {
    const body = (await readBody(req)) as {
      batchId?: string
      jobId?: string
      assetId?: number
      autoRecommendMode?: boolean
      autoBackgroundOptimize?: boolean
    }
    const batchId = body.batchId?.trim()
    const jobId = body.jobId?.trim()
    const assetId = Number(body.assetId)
    if (!batchId || !jobId || !assetId) {
      json(res, { error: '缺少 batchId、jobId 和 assetId 参数' }, 400)
      return true
    }
    const batch = getBatchOr404(batchId, res)
    if (!batch) return true
    const job = getJobOr404(batch, jobId, res)
    if (!job) return true

    const row = db
      .prepare(
        `SELECT id, path, filename, ratio, width, height, COALESCE(area, width * height) AS area
         FROM assets WHERE id = ? AND deleted_at IS NULL`,
      )
      .get(assetId) as MatchCandidate | undefined
    if (!row || !existsSync(row.path)) {
      json(res, { error: '未找到图片' }, 404)
      return true
    }

    const autoRecommendMode = body.autoRecommendMode !== false
    const autoBackgroundOptimize = body.autoBackgroundOptimize !== false
    const recommendedMode = autoRecommendMode
      ? await recommendMode(job.targetRatio, row.ratio, row.path, autoBackgroundOptimize)
      : job.recommendedMode

    job.imageId = row.id
    job.imagePath = row.path
    job.imageFilename = row.filename
    job.imageRatio = row.ratio
    job.recommendedMode = recommendedMode
    job.status = 'pending'
    job.progress = 0
    job.error = undefined
    job.outputPath = undefined

    const index = batch.jobs.findIndex((j) => j.id === job.id)
    queueJobExport(job, batch.options, Math.max(0, index))
    json(res, { job })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/auto-match/preview') {
    const body = (await readBody(req)) as {
      assetId?: number
      targetWidth?: number
      targetHeight?: number
      mode?: FitMode
    }
    const assetId = Number(body.assetId)
    const targetWidth = Number(body.targetWidth)
    const targetHeight = Number(body.targetHeight)
    const mode = (body.mode ?? 'contain') as FitMode

    if (!assetId || !targetWidth || !targetHeight) {
      json(res, { error: '缺少 assetId/targetWidth/targetHeight 参数' }, 400)
      return true
    }

    const row = db.prepare(`SELECT path FROM assets WHERE id = ? AND deleted_at IS NULL`).get(assetId) as
      | { path: string }
      | undefined
    if (!row || !existsSync(row.path)) {
      json(res, { error: '未找到图片' }, 404)
      return true
    }

    const previewPath = matcherPool
      ? (
          await matcherPool.run({
            inputPath: row.path,
            outputDir: CACHE_DIR,
            width: targetWidth,
            height: targetHeight,
            format: 'webp',
            fitMode: mode,
            quality: 85,
            namingPattern: `auto_preview_{name}_{size}.{format}`,
            index: 1,
          })
        ).outputPath
      : await processAndExport({
          inputPath: row.path,
          outputDir: CACHE_DIR,
          width: targetWidth,
          height: targetHeight,
          format: 'webp',
          fitMode: mode,
          quality: 85,
          namingPattern: `auto_preview_{name}_{size}.{format}`,
          index: 1,
        })
    json(res, { previewName: path.basename(previewPath) })
    return true
  }

  return false
}
