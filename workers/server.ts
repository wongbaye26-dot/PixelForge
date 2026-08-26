import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import PQueue from 'p-queue'
import { getDb } from './database.js'
import { mapWorkerError } from './error-mapper.js'
import { ScanError, scanFiles, scanFolder } from './scanner.js'
import { refreshFolderWatcher } from './watcher.js'
import {
  CACHE_DIR,
  ensureThumbnailInBackground,
  resolveExistingThumbnail,
  thumbnailHttpPath,
  assetPreviewHttpPath,
} from './thumbnail.js'
import { processAndExport } from './image-processor.js'
import { getExportsDir } from './paths.js'
import { getStoredExportDir, setStoredExportDir, getStoredSetting, setStoredSetting, getAiSidecarUrl } from './settings.js'
import { readAssetMetadata } from './asset-exif.js'
import type { ExportFormat, FitMode } from '../src/types/index.js'
import { handleBatchApi, pruneBatchJobs } from './batch-api.js'
import { handleCompressApi, pruneCompressJobs } from './compress-api.js'
import { handleConvertApi, pruneConvertJobs } from './convert-api.js'
import { handleEditApi } from './edit-api.js'
import { handleExportMatcherApi } from './export-matcher-api.js'
import { handleSystemApi } from './system-api.js'
import { handleTrashApi } from './trash-api.js'
import { handleFoldersApi } from './folders-api.js'
import { handleTemplatesApi } from './templates-api.js'
import { handleAiApi } from './ai-api.js'
import { handleOcrApi } from './ocr-api.js'
import { uid, json, readBody } from './utils.js'

const PORT = Number(process.env.PIXELFORGE_PORT ?? 3847)

const db = getDb()
const exportQueue = new PQueue({ concurrency: 2 })

type ExportJobStatus = 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled'

type ExportControlAction = 'pause' | 'resume' | 'cancel' | 'retry'

type ManagedExportJob = {
  id: string
  batchId: string
  assetId: number
  inputPath: string
  filename: string
  thumbnailUrl?: string
  targetWidth: number
  targetHeight: number
  format: ExportFormat
  fitMode: FitMode
  quality: number
  targetSizeKb?: number
  namingPattern: string
  outputDir: string
  mozjpeg?: boolean
  usePngquant?: boolean
  sidecarUrl?: string
  queueIndex: number
  status: ExportJobStatus
  progress: number
  outputPath?: string
  error?: string
  pauseRequested: boolean
  cancelRequested: boolean
}

const exportJobBatches = new Map<string, { jobs: ManagedExportJob[] }>()
const exportJobs = new Map<string, ManagedExportJob>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class ExportCancelledError extends Error {
  constructor() {
    super('任务已取消')
    this.name = 'ExportCancelledError'
  }
}

function serializeExportJob(job: ManagedExportJob) {
  return {
    id: job.id,
    batchId: job.batchId,
    assetId: job.assetId,
    filename: job.filename,
    thumbnailUrl: job.thumbnailUrl,
    targetWidth: job.targetWidth,
    targetHeight: job.targetHeight,
    format: job.format,
    progress: job.progress,
    status: job.status,
    outputPath: job.outputPath,
    error: job.error,
  }
}

async function waitForJobReady(job: ManagedExportJob, progress?: number): Promise<void> {
  if (job.cancelRequested) {
    job.status = 'cancelled'
    job.progress = 100
    job.error = '任务已取消'
    throw new ExportCancelledError()
  }

  if (typeof progress === 'number') {
    job.progress = Math.max(job.progress, progress)
  }

  while (job.pauseRequested && !job.cancelRequested) {
    job.status = 'paused'
    await sleep(180)
  }

  if (job.cancelRequested) {
    job.status = 'cancelled'
    job.progress = 100
    job.error = '任务已取消'
    throw new ExportCancelledError()
  }

  if (job.status !== 'processing') {
    job.status = 'processing'
  }
}

function enqueueExportJob(job: ManagedExportJob) {
  void exportQueue.add(async () => {
    if (job.cancelRequested) {
      job.status = 'cancelled'
      job.progress = 100
      job.error = '任务已取消'
      return
    }

    job.status = job.pauseRequested ? 'paused' : 'processing'
    job.progress = 5
    job.error = undefined
    job.outputPath = undefined

    try {
      await waitForJobReady(job, 10)
      const outputPath = await processAndExport({
        inputPath: job.inputPath,
        outputDir: job.outputDir,
        width: job.targetWidth,
        height: job.targetHeight,
        format: job.format,
        fitMode: job.fitMode,
        quality: job.quality,
        targetSizeKb: job.targetSizeKb,
        namingPattern: job.namingPattern,
        index: job.queueIndex,
        mozjpeg: job.mozjpeg,
        usePngquant: job.usePngquant,
        sidecarUrl: job.sidecarUrl,
        checkpoint: async (progress: number) => {
          await waitForJobReady(job, progress)
        },
      })
      await waitForJobReady(job, 96)
      job.outputPath = outputPath
      job.status = 'completed'
      job.progress = 100
      job.error = undefined
    } catch (err) {
      if (err instanceof ExportCancelledError) {
        job.status = 'cancelled'
        job.progress = 100
        job.error = '任务已取消'
        return
      }
      job.status = 'failed'
      job.progress = 100
      job.error = mapWorkerError(err, '导出失败').message
    }
  })
}

const MIME_BY_EXT: Record<string, string> = {
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.ico': 'image/x-icon',
}

function mimeForPath(filePath: string): string {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function mapAssetRow(row: Record<string, unknown>, thumb?: { url: string } | null) {
  const format = String(row.format).toLowerCase()
  const id = Number(row.id)
  const isGif = format === 'gif'
  return {
    ...row,
    favorite: Boolean(row.favorite),
    area: row.area,
    resolutionLevel: row.resolution_level ?? row.resolutionLevel,
    dominantColor: row.dominant_color ?? row.dominantColor,
    brightness: row.brightness,
    createdAt: row.created_at ?? row.createdAt,
    ocrText: row.ocr_text ?? row.ocrText,
    thumbnailUrl: thumb?.url,
    // GIF 优先使用生成的动画缩略图，避免直接加载超大原图导致不播放
    previewUrl: isGif ? (thumb?.url ?? assetPreviewHttpPath(id)) : thumb?.url,
  }
}

const server = createServer(async (req, res) => {
  try {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  const { pathname } = url

  if (req.method === 'GET' && pathname.startsWith('/cache/thumbnails/')) {
    const name = path.basename(pathname)
    const file = path.join(CACHE_DIR, name)
    if (!existsSync(file)) {
      res.writeHead(404)
      res.end()
      return
    }
    const ext = path.extname(name).toLowerCase()
    const mime =
      ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'application/octet-stream'
    let stat: import('node:fs').Stats
    try {
      stat = statSync(file)
    } catch {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400',
    })
    createReadStream(file).on('error', () => { if (!res.headersSent) { res.writeHead(500); res.end() } }).pipe(res)
    return
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    json(res, { ok: true, service: 'pixel-forge-worker' })
    return
  }

  if (req.method === 'GET' && pathname === '/api/settings/export-dir') {
    json(res, { path: getStoredExportDir(db), defaultPath: getExportsDir() })
    return
  }

  if (req.method === 'POST' && pathname === '/api/settings/export-dir') {
    const body = (await readBody(req)) as { path?: string }
    if (!body.path?.trim()) {
      json(res, { error: '缺少路径参数' }, 400)
      return
    }
    setStoredExportDir(db, body.path.trim())
    json(res, { path: getStoredExportDir(db) })
    return
  }

  const settingMatch = pathname.match(/^\/api\/settings\/([^/]+)$/)
  if (settingMatch) {
    const key = settingMatch[1]
    if (req.method === 'GET') {
      const value = getStoredSetting(db, key)
      json(res, { key, value: value ?? null })
      return
    }
    if (req.method === 'POST') {
      const body = (await readBody(req)) as { value?: string }
      setStoredSetting(db, key, body.value ?? '')
      json(res, { key, value: body.value ?? '' })
      return
    }
  }

  const previewMatch = pathname.match(/^\/api\/assets\/(\d+)\/preview$/)
  if (req.method === 'GET' && previewMatch) {
    const assetId = Number(previewMatch[1])
    const row = db.prepare(`SELECT path, format FROM assets WHERE id = ?`).get(assetId) as
      | { path: string; format: string }
      | undefined
    if (!row || !existsSync(row.path)) {
      res.writeHead(404)
      res.end()
      return
    }
    let stat: import('node:fs').Stats
    try {
      stat = statSync(row.path)
    } catch {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(200, {
      'Content-Type': mimeForPath(row.path),
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=3600',
    })
    createReadStream(row.path).on('error', () => { if (!res.headersSent) { res.writeHead(500); res.end() } }).pipe(res)
    return
  }

  const metadataMatch = pathname.match(/^\/api\/assets\/(\d+)\/metadata$/)
  if (req.method === 'GET' && metadataMatch) {
    const assetId = Number(metadataMatch[1])
    const row = db.prepare(`SELECT path FROM assets WHERE id = ? AND deleted_at IS NULL`).get(assetId) as
      | { path: string }
      | undefined
    if (!row || !existsSync(row.path)) {
      json(res, { error: '未找到图片' }, 404)
      return
    }
    try {
      const metadata = await readAssetMetadata(row.path)
      json(res, metadata)
    } catch (err) {
      json(res, { error: mapWorkerError(err, '读取元数据失败').message }, 500)
    }
    return
  }

  if (req.method === 'GET' && pathname === '/api/assets') {
    const startedAt = Date.now()
    const q = url.searchParams.get('q')?.toLowerCase() ?? ''
    const favorite = url.searchParams.get('favorite')
    const recent = url.searchParams.get('recent')
    const folderId = url.searchParams.get('folderId')
    const format = url.searchParams.get('format')
    const ratio = url.searchParams.get('ratio')
    const width = url.searchParams.get('width')
    const height = url.searchParams.get('height')
    const duplicate = url.searchParams.get('duplicate')
    const trash = url.searchParams.get('trash')
    const limitParam = url.searchParams.get('limit')
    const limit = Math.max(1, Math.min(5000, Number(limitParam) || 500))

    let sql = `SELECT * FROM assets WHERE 1=1`
    const params: unknown[] = []

    if (q) {
      sql += ` AND (filename LIKE ? OR path LIKE ? OR ocr_text LIKE ?)`
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }
    if (favorite === '1') sql += ` AND favorite = 1`
    if (folderId) {
      sql += ` AND folder_id = ?`
      params.push(Number(folderId))
    }
    if (format) {
      sql += ` AND format = ?`
      params.push(format)
    }
    if (ratio) {
      sql += ` AND ABS(ratio - ?) < 0.01`
      params.push(Number(ratio))
    }
    if (width) {
      sql += ` AND width = ?`
      params.push(Number(width))
    }
    if (height) {
      sql += ` AND height = ?`
      params.push(Number(height))
    }
    if (duplicate === '1') {
      sql += ` AND hash IN (SELECT hash FROM assets GROUP BY hash HAVING COUNT(*) > 1)`
    }
    if (trash === '1') {
      sql += ` AND deleted_at IS NOT NULL`
    } else {
      sql += ` AND deleted_at IS NULL`
    }

    if (recent === '1') sql += ` ORDER BY datetime(created_at) DESC, id DESC`
    else sql += ` ORDER BY id DESC`
    sql += ` LIMIT ${limit}`
    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>
    let thumbnailCount = 0
    const assets = rows.map((row) => {
      const filePath = String(row.path)
      const thumb = resolveExistingThumbnail(filePath)
      if (thumb) {
        thumbnailCount += 1
      } else {
        ensureThumbnailInBackground(filePath)
      }
      const fallbackPreview = assetPreviewHttpPath(Number(row.id))
      const mapped = mapAssetRow(row, thumb ? { url: thumbnailHttpPath(thumb) } : null)
      if (!mapped.previewUrl) mapped.previewUrl = fallbackPreview
      return mapped
    })
    console.info('[assets] load', {
      loadTime: `${Date.now() - startedAt}ms`,
      assetCount: assets.length,
      thumbnailCount,
    })
    json(res, { assets })
    return
  }

  if (req.method === 'GET' && pathname === '/api/folders') {
    const folders = db.prepare(`SELECT * FROM folders ORDER BY id`).all()
    json(res, { folders })
    return
  }

  if (req.method === 'POST' && pathname === '/api/scan') {
    const body = (await readBody(req)) as { path?: string; label?: string }
    if (!body.path) {
      json(res, { error: '缺少路径参数' }, 400)
      return
    }
    try {
      const result = await scanFolder(db, body.path, body.label)
      refreshFolderWatcher(db)
      json(res, result)
    } catch (err) {
      if (err instanceof ScanError) {
        const status = err.code === 'EPERM' || err.code === 'EACCES' ? 403 : 400
        json(res, { success: false, error: err.message }, status)
        return
      }
      json(res, { success: false, error: mapWorkerError(err, '扫描目录失败').message }, 500)
    }
    return
  }

  if (req.method === 'POST' && pathname === '/api/scan-files') {
    const body = (await readBody(req)) as { paths?: string[] }
    const paths = body.paths ?? []
    if (!Array.isArray(paths) || paths.length === 0) {
        json(res, { error: '缺少路径列表' }, 400)
      return
    }
    try {
      const result = await scanFiles(db, paths)
      refreshFolderWatcher(db)
      json(res, result)
    } catch (err) {
      if (err instanceof ScanError) {
        const status = err.code === 'EPERM' || err.code === 'EACCES' ? 403 : 400
        json(res, { success: false, error: err.message }, status)
        return
      }
      json(res, { success: false, error: mapWorkerError(err, '扫描文件失败').message }, 500)
    }
    return
  }

  if (req.method === 'POST' && pathname === '/api/favorite') {
    const body = (await readBody(req)) as { id?: number; favorite?: boolean }
    if (body.id == null) {
        json(res, { error: '缺少 ID 参数' }, 400)
      return
    }
    db.prepare(`UPDATE assets SET favorite = ? WHERE id = ?`).run(body.favorite ? 1 : 0, body.id)
    json(res, { ok: true })
    return
  }

  if (req.method === 'POST' && pathname === '/api/export/submit') {
    const body = (await readBody(req)) as {
      assetIds?: number[]
      sizes?: Array<{ width: number; height: number }>
      formats?: ExportFormat[]
      fitMode?: FitMode
      quality?: number
      targetSizeKb?: number
      namingPattern?: string
      outputDir?: string
      mozjpeg?: boolean
      usePngquant?: boolean
    }

    try {
      const assetIds = body.assetIds ?? []
      const sizes = body.sizes ?? [{ width: 1920, height: 1080 }]
      const formats = body.formats ?? ['webp']
      const fitMode = body.fitMode ?? 'contain'
      const quality = body.quality ?? 90
      const namingPattern = body.namingPattern ?? '{name}_{size}.{format}'
      const outputDir = body.outputDir?.trim() || getStoredExportDir(db)
      const mozjpeg = body.mozjpeg !== false
      const usePngquant = Boolean(body.usePngquant)
      const sidecarUrl = getAiSidecarUrl(db)
      const batchId = uid('export')
      const jobs: ManagedExportJob[] = []

      const getAsset = db.prepare(`SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL`)
      let queueIndex = 0
      for (const id of assetIds) {
        const row = getAsset.get(id) as { id: number; path: string; filename: string } | undefined
        if (!row) continue
        const thumb = resolveExistingThumbnail(row.path)
        const thumbnailUrl = thumb ? thumbnailHttpPath(thumb) : undefined
        for (const size of sizes) {
          for (const format of formats) {
            queueIndex += 1
            jobs.push({
              id: uid('ejob'),
              batchId,
              assetId: row.id,
              inputPath: row.path,
              filename: row.filename,
              thumbnailUrl,
              targetWidth: size.width,
              targetHeight: size.height,
              format,
              fitMode,
              quality,
              targetSizeKb: body.targetSizeKb,
              namingPattern,
              outputDir,
              mozjpeg,
              usePngquant,
              sidecarUrl,
              queueIndex,
              status: 'pending',
              progress: 0,
              pauseRequested: false,
              cancelRequested: false,
            })
          }
        }
      }
      exportJobBatches.set(batchId, { jobs })
      jobs.forEach((job) => {
        exportJobs.set(job.id, job)
        enqueueExportJob(job)
      })
      json(res, {
        batchId,
        total: jobs.length,
        jobs: jobs.map(serializeExportJob),
      })
    } catch (err) {
      json(res, { error: mapWorkerError(err, '导出提交失败').message }, 500)
    }
    return
  }

  if (req.method === 'GET' && pathname === '/api/export/jobs') {
    const batchId = url.searchParams.get('batchId')?.trim()
    const idsParam = url.searchParams.get('ids')?.trim()
    const ids = idsParam ? idsParam.split(',').map((item) => item.trim()).filter(Boolean) : []
    const jobs = [...exportJobs.values()].filter((job) => {
      if (batchId) return job.batchId === batchId
      if (ids.length) return ids.includes(job.id)
      return false
    })
    json(res, { jobs: jobs.map(serializeExportJob) })
    return
  }

  const exportControlMatch = pathname.match(/^\/api\/export\/jobs\/([^/]+)\/(pause|resume|cancel|retry)$/)
  if (req.method === 'POST' && exportControlMatch) {
    const jobId = exportControlMatch[1]
    const action = exportControlMatch[2] as ExportControlAction
    const job = exportJobs.get(jobId)
    if (!job) {
      json(res, { error: '未找到任务' }, 404)
      return
    }

    if (action === 'pause') {
      if (job.status === 'pending' || job.status === 'processing') {
        job.pauseRequested = true
        if (job.status === 'pending') job.status = 'paused'
      }
      json(res, { job: serializeExportJob(job) })
      return
    }

    if (action === 'resume') {
      if (job.status === 'paused') {
        job.pauseRequested = false
        job.status = 'pending'
      }
      json(res, { job: serializeExportJob(job) })
      return
    }

    if (action === 'cancel') {
      if (job.status === 'pending' || job.status === 'processing' || job.status === 'paused') {
        job.cancelRequested = true
        job.pauseRequested = false
        if (job.status === 'pending' || job.status === 'paused') {
          job.status = 'cancelled'
          job.progress = 100
          job.error = '任务已取消'
        }
      }
      json(res, { job: serializeExportJob(job) })
      return
    }

    if (action === 'retry') {
      if (job.status !== 'failed' && job.status !== 'cancelled') {
        json(res, { error: '仅失败或已取消的任务可以重试' }, 400)
        return
      }
      job.cancelRequested = false
      job.pauseRequested = false
      job.outputPath = undefined
      job.error = undefined
      job.progress = 0
      job.status = 'pending'
      enqueueExportJob(job)
      json(res, { job: serializeExportJob(job) })
      return
    }
  }

  if (await handleSystemApi(req, res, url)) return
  if (await handleFoldersApi(req, res, url, db)) return
  if (await handleTrashApi(req, res, url, db)) return
  if (await handleTemplatesApi(req, res, url, db)) return
  if (await handleAiApi(req, res, url, db)) return
  if (await handleOcrApi(req, res, url, db)) return
  if (await handleBatchApi(req, res, url, db)) return
  if (await handleCompressApi(req, res, url, db)) return
  if (await handleConvertApi(req, res, url, db)) return
  if (await handleEditApi(req, res, url, db)) return
  if (await handleExportMatcherApi(req, res, url, db)) return

  res.writeHead(404)
  res.end()
  } catch (err) {
    console.error('[worker] Unhandled error:', err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: '服务器内部错误' }))
    }
  }
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[pixel-forge] Port ${PORT} is already in use. Please kill the process using it.`)
    process.exit(1)
  }
  console.error('[pixel-forge] Worker server error:', err)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[pixel-forge] worker API http://127.0.0.1:${PORT}`)
  console.log(`[pixel-forge] database path: ${db.name}`)
  refreshFolderWatcher(db)
  setInterval(() => {
    const pruned = pruneBatchJobs() + pruneCompressJobs() + pruneConvertJobs()
    if (pruned > 0) console.info(`[worker] pruned ${pruned} stale jobs`)
  }, 10 * 60 * 1000)
})
