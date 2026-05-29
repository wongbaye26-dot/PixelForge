import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import PQueue from 'p-queue'
import { getDb } from './database.js'
import { scanFiles, scanFolder } from './scanner.js'
import {
  CACHE_DIR,
  ensureThumbnail,
  resolveExistingThumbnail,
  thumbnailHttpPath,
  assetPreviewHttpPath,
} from './thumbnail.js'
import { processAndExport } from './image-processor.js'
import { getExportsDir } from './paths.js'
import { getStoredExportDir, setStoredExportDir, getStoredSetting, setStoredSetting } from './settings.js'
import type { ExportFormat, FitMode } from '../src/types/index.js'
import { handleBatchApi } from './batch-api.js'
import { handleCompressApi } from './compress-api.js'
import { handleConvertApi } from './convert-api.js'
import { handleEditApi } from './edit-api.js'
import { handleExportMatcherApi } from './export-matcher-api.js'

const PORT = Number(process.env.PIXELFORGE_PORT ?? 3847)

const db = getDb()
const exportQueue = new PQueue({ concurrency: 2 })

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
    thumbnailUrl: thumb?.url,
    // GIF 优先使用生成的动画缩略图，避免直接加载超大原图导致不播放
    previewUrl: isGif ? (thumb?.url ?? assetPreviewHttpPath(id)) : thumb?.url,
  }
}

const server = createServer(async (req, res) => {
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
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' })
    res.end(readFileSync(file))
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
      json(res, { error: 'path required' }, 400)
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
    res.writeHead(200, {
      'Content-Type': mimeForPath(row.path),
      'Cache-Control': 'public, max-age=3600',
    })
    res.end(readFileSync(row.path))
    return
  }

  if (req.method === 'GET' && pathname === '/api/assets') {
    const q = url.searchParams.get('q')?.toLowerCase() ?? ''
    const favorite = url.searchParams.get('favorite')
    const folderId = url.searchParams.get('folderId')
    const format = url.searchParams.get('format')
    const ratio = url.searchParams.get('ratio')
    const duplicate = url.searchParams.get('duplicate')
    const limitParam = url.searchParams.get('limit')
    const limit = Math.max(1, Math.min(5000, Number(limitParam ?? 500)))

    let sql = `SELECT * FROM assets WHERE 1=1`
    const params: unknown[] = []

    if (q) {
      sql += ` AND (filename LIKE ? OR path LIKE ?)`
      params.push(`%${q}%`, `%${q}%`)
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
    if (duplicate === '1') {
      sql += ` AND hash IN (SELECT hash FROM assets GROUP BY hash HAVING COUNT(*) > 1)`
    }

    sql += ` ORDER BY id DESC LIMIT ${limit}`
    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>
    const assets = await Promise.all(
      rows.map(async (row) => {
        const filePath = String(row.path)
        let thumb = resolveExistingThumbnail(filePath)
        if (!thumb) {
          try {
            thumb = await ensureThumbnail(filePath)
          } catch (err) {
            console.warn('[assets] thumbnail failed:', filePath, err)
          }
        }
        const thumbUrl = thumb ? thumbnailHttpPath(thumb) : undefined
        return mapAssetRow(row, thumbUrl ? { url: thumbUrl } : null)
      }),
    )
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
      json(res, { error: 'path required' }, 400)
      return
    }
    const result = await scanFolder(db, body.path, body.label)
    json(res, result)
    return
  }

  if (req.method === 'POST' && pathname === '/api/scan-files') {
    const body = (await readBody(req)) as { paths?: string[] }
    const paths = body.paths ?? []
    if (!Array.isArray(paths) || paths.length === 0) {
      json(res, { error: 'paths required' }, 400)
      return
    }
    const result = await scanFiles(db, paths)
    json(res, result)
    return
  }

  if (req.method === 'POST' && pathname === '/api/favorite') {
    const body = (await readBody(req)) as { id?: number; favorite?: boolean }
    if (body.id == null) {
      json(res, { error: 'id required' }, 400)
      return
    }
    db.prepare(`UPDATE assets SET favorite = ? WHERE id = ?`).run(body.favorite ? 1 : 0, body.id)
    json(res, { ok: true })
    return
  }

  if (req.method === 'POST' && pathname === '/api/export') {
    const body = (await readBody(req)) as {
      assetIds?: number[]
      sizes?: Array<{ width: number; height: number }>
      formats?: ExportFormat[]
      fitMode?: FitMode
      quality?: number
      targetSizeKb?: number
      namingPattern?: string
      outputDir?: string
    }

    const assetIds = body.assetIds ?? []
    const sizes = body.sizes ?? [{ width: 1920, height: 1080 }]
    const formats = body.formats ?? ['webp']
    const fitMode = body.fitMode ?? 'contain'
    const quality = body.quality ?? 90
    const namingPattern = body.namingPattern ?? '{name}_{size}.{format}'
    const outputDir = body.outputDir?.trim() || getStoredExportDir(db)

    const jobs: Array<{
      assetId: number
      path: string
      width: number
      height: number
      format: ExportFormat
    }> = []

    const getAsset = db.prepare(`SELECT * FROM assets WHERE id = ?`)
    for (const id of assetIds) {
      const row = getAsset.get(id) as { id: number; path: string } | undefined
      if (!row) continue
      for (const size of sizes) {
        for (const format of formats) {
          jobs.push({
            assetId: row.id,
            path: row.path,
            width: size.width,
            height: size.height,
            format,
          })
        }
      }
    }

    const results: Array<{ job: (typeof jobs)[0]; outputPath?: string; error?: string }> = []

    await exportQueue.addAll(
      jobs.map((job, index) => async () => {
        try {
          const outputPath = await processAndExport({
            inputPath: job.path,
            outputDir,
            width: job.width,
            height: job.height,
            format: job.format,
            fitMode,
            quality,
            targetSizeKb: body.targetSizeKb,
            namingPattern,
            index: index + 1,
          })
          results.push({ job, outputPath })
        } catch (e) {
          results.push({ job, error: e instanceof Error ? e.message : String(e) })
        }
      }),
    )

    json(res, {
      total: jobs.length,
      completed: results.filter((r) => r.outputPath).length,
      failed: results.filter((r) => r.error).length,
      results,
    })
    return
  }

  if (await handleBatchApi(req, res, url, db)) return
  if (await handleCompressApi(req, res, url, db)) return
  if (await handleConvertApi(req, res, url, db)) return
  if (await handleEditApi(req, res, url, db)) return
  if (await handleExportMatcherApi(req, res, url, db)) return

  res.writeHead(404)
  res.end()
})

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[pixel-forge] Port ${PORT} is already in use. Please kill the process using it.`)
    process.exit(1)
  }
  console.error('[pixel-forge] Worker server error:', err)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[pixel-forge] worker API http://127.0.0.1:${PORT}`)
  console.log(`[pixel-forge] database path: ${db.name}`)
})
