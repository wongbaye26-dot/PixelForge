import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import PQueue from 'p-queue'
import { Piscina } from 'piscina'
import sharp from 'sharp'
import type Database from 'better-sqlite3'
import { CACHE_DIR } from './thumbnail.js'
import { getExportsDir } from './paths.js'
import { getStoredExportDir } from './settings.js'
import { processAndExport } from './image-processor.js'
import type { ExportFormat, FitMode } from '../src/types/index.js'

type ExportMatcherStatus = 'pending' | 'processing' | 'done' | 'error'

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
  matchScore?: MatchScore
  debugCandidates?: MatchDebugCandidate[]
  status: ExportMatcherStatus
  progress: number
  outputPath?: string
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

function binarySearchNearestByRatio(rows: Array<{ ratio: number }>, target: number): number {
  let lo = 0
  let hi = rows.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = rows[mid]!.ratio
    if (v === target) return mid
    if (v < target) lo = mid + 1
    else hi = mid - 1
  }
  if (lo <= 0) return 0
  if (lo >= rows.length) return rows.length - 1
  const a = rows[lo - 1]!.ratio
  const b = rows[lo]!.ratio
  return Math.abs(a - target) <= Math.abs(b - target) ? lo - 1 : lo
}

type MatchScore = {
  ratioScore: number
  sizeScore: number
  upscalePenalty: number
  oversizePenalty: number
  finalScore: number
}

type MatchDebugCandidate = {
  imageId: number
  width: number
  height: number
  ratio: number
  area: number
  score: MatchScore
}

type MatchStrategy = {
  avoidUpscale: boolean
  preferSlightDownscale: boolean
  avoidOversize: boolean
  highQualityFirst: boolean
}

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

function calculateMatchScore(
  image: { ratio: number; width: number; height: number; area: number },
  target: { ratio: number; width: number; height: number; area: number },
  strategy: MatchStrategy,
): MatchScore {
  const ratioDiff = Math.abs(image.ratio - target.ratio)
  const widthDiff = Math.abs(target.width - image.width)
  const heightDiff = Math.abs(target.height - image.height)
  const sizeDiff = (widthDiff + heightDiff) / 2

  let upscalePenalty = 0
  const needsUpscale = image.width < target.width || image.height < target.height
  if (strategy.avoidUpscale && needsUpscale) upscalePenalty += 1000

  const scaleRatio = image.area / target.area
  let oversizePenalty = 0
  if (strategy.avoidOversize && scaleRatio > 5) {
    oversizePenalty += scaleRatio * 10
  } else if (strategy.preferSlightDownscale && scaleRatio > 3) {
    oversizePenalty += (scaleRatio - 3) * 5
  }

  let ratioPenalty = 0
  if (ratioDiff > 0.15) {
    ratioPenalty += (ratioDiff - 0.15) * 1000
  }

  const ratioWeight = 0.65
  const sizeWeight = 0.35
  const finalScore =
    ratioDiff * ratioWeight +
    sizeDiff * sizeWeight +
    upscalePenalty +
    oversizePenalty +
    ratioPenalty

  return {
    ratioScore: ratioDiff,
    sizeScore: sizeDiff,
    upscalePenalty,
    oversizePenalty,
    finalScore,
  }
}

function bestCandidateForTarget(
  candidates: Array<{ id: number; path: string; filename: string; ratio: number; width: number; height: number; area: number }>,
  target: { width: number; height: number; ratio: number; area: number },
  used: Set<number>,
  strategy: MatchStrategy,
): { best: MatchDebugCandidate | null; debug: MatchDebugCandidate[] } {
  const scored: MatchDebugCandidate[] = []
  for (const c of candidates) {
    if (used.has(c.id)) continue
    const score = calculateMatchScore(
      { ratio: c.ratio, width: c.width, height: c.height, area: c.area },
      target,
      strategy,
    )
    scored.push({
      imageId: c.id,
      width: c.width,
      height: c.height,
      ratio: c.ratio,
      area: c.area,
      score,
    })
  }

  const hasNoUpscale = scored.some((s) => s.width >= target.width && s.height >= target.height)
  const filtered =
    strategy.highQualityFirst && hasNoUpscale
      ? scored.filter((s) => s.width >= target.width && s.height >= target.height)
      : scored

  filtered.sort((a, b) => a.score.finalScore - b.score.finalScore)
  return { best: filtered[0] ?? null, debug: filtered.slice(0, 8) }
}

const jobBatches = new Map<string, { jobs: ExportMatcherJob[] }>()
const exportQueue = new PQueue({ concurrency: 2 })

declare const __dirname: string | undefined
const RUNTIME_DIR = typeof __dirname === 'string' ? __dirname : process.cwd()

function resolveMatcherWorkerFile(): string | null {
  const candidates = [
    path.join(RUNTIME_DIR, 'export-matcher-processor.cjs'),
    path.join(RUNTIME_DIR, '..', 'electron-dist', 'export-matcher-processor.cjs'),
    path.join(process.cwd(), 'electron-dist', 'export-matcher-processor.cjs'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

const matcherWorkerFile = resolveMatcherWorkerFile()
const matcherPool = matcherWorkerFile
  ? new Piscina({ filename: matcherWorkerFile, minThreads: 1, maxThreads: 4 })
  : null

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
    }

    const sizes = (body.sizes ?? []).filter((s) => s && s.width > 0 && s.height > 0)
    if (!sizes.length) {
      json(res, { error: 'sizes required' }, 400)
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

    const candidateAssetIds = (body.candidateAssetIds ?? []).filter((n) => Number.isFinite(n) && n > 0)
    const canRestrict = candidateAssetIds.length > 0 && candidateAssetIds.length <= 5000
    const byRatioWindow = db.prepare(
      `SELECT id, path, filename, ratio, width, height, COALESCE(area, width * height) AS area
       FROM assets
       WHERE ratio BETWEEN ? AND ?
       ORDER BY ratio ASC
       LIMIT ?`,
    )

    let restrictedRows:
      | Array<{ id: number; path: string; filename: string; ratio: number; width: number; height: number; area: number }>
      | null = null
    if (canRestrict) {
      const placeholders = candidateAssetIds.map(() => '?').join(',')
      restrictedRows = db
        .prepare(
          `SELECT id, path, filename, ratio, width, height, COALESCE(area, width * height) AS area
           FROM assets
           WHERE id IN (${placeholders})
           ORDER BY ratio ASC`,
        )
        .all(...candidateAssetIds) as Array<{
        id: number
        path: string
        filename: string
        ratio: number
        width: number
        height: number
        area: number
      }>
    }

    const restrictedById = restrictedRows ? new Map(restrictedRows.map((r) => [r.id, r])) : null

    for (const s of sizes) {
      const targetRatio = s.width / s.height
      const target = { width: s.width, height: s.height, ratio: targetRatio, area: s.width * s.height }

      let candidates: Array<{ id: number; path: string; filename: string; ratio: number; width: number; height: number; area: number }> = []
      if (restrictedRows) {
        candidates = restrictedRows
      } else {
        let window = 0.15
        let limit = 240
        for (let pass = 0; pass < 5; pass++) {
          const lo = Math.max(0.01, targetRatio - window)
          const hi = targetRatio + window
          const rows = byRatioWindow.all(lo, hi, limit) as Array<{
            id: number
            path: string
            filename: string
            ratio: number
            width: number
            height: number
            area: number
          }>
          candidates = rows
          if (candidates.length >= 48) break
          window *= 1.7
          limit = Math.min(800, Math.round(limit * 1.6))
        }
      }

      const { best, debug } = bestCandidateForTarget(candidates, target, used, strategy)
      if (!best) continue
      used.add(best.imageId)

      const asset = restrictedById
        ? restrictedById.get(best.imageId)!
        : candidates.find((c) => c.id === best.imageId)

      if (!asset) continue

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

    jobBatches.set(batchId, { jobs })

    void exportQueue.addAll(
      jobs.map((job, index) => async () => {
        job.status = 'processing'
        job.progress = 15
        try {
          job.progress = 35
          const targetSizeKb = autoCompressOptimize ? body.targetSizeKb : undefined
          const outputPath = matcherPool
            ? (
                await matcherPool.run({
                  inputPath: job.imagePath,
                  outputDir,
                  width: job.targetWidth,
                  height: job.targetHeight,
                  format,
                  fitMode: job.recommendedMode,
                  quality,
                  targetSizeKb,
                  namingPattern,
                  index: index + 1,
                } as any)
              ).outputPath
            : await processAndExport({
                inputPath: job.imagePath,
                outputDir,
                width: job.targetWidth,
                height: job.targetHeight,
                format,
                fitMode: job.recommendedMode,
                quality,
                targetSizeKb,
                namingPattern,
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
      }),
    )

    json(res, { batchId, jobs })
    return true
  }

  if (req.method === 'GET' && pathname === '/api/auto-match/jobs') {
    const batchId = url.searchParams.get('batchId')?.trim()
    if (!batchId) {
      json(res, { error: 'batchId required' }, 400)
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
      json(res, { error: 'assetId/targetWidth/targetHeight required' }, 400)
      return true
    }

    const row = db.prepare(`SELECT path FROM assets WHERE id = ?`).get(assetId) as { path: string } | undefined
    if (!row || !existsSync(row.path)) {
      json(res, { error: 'asset not found' }, 404)
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
          } as any)
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
