import { existsSync } from 'node:fs'
import path from 'node:path'
import { Piscina } from 'piscina'
import PQueue from 'p-queue'
import type Database from 'better-sqlite3'
import { CACHE_DIR } from './thumbnail.js'
import { getStoredExportDir, getAiSidecarUrl } from './settings.js'
import { pingSidecar } from './ai-outpaint.js'
import { mkdirSync } from 'node:fs'
import { uid, json, readBody } from './utils.js'
import { resolveWorkerFile } from './resolve-worker.js'

const aiWorkerFile = resolveWorkerFile('ai')
const aiPool = aiWorkerFile ? new Piscina({ filename: aiWorkerFile, minThreads: 1, maxThreads: 2 }) : null
const aiQueue = new PQueue({ concurrency: 1 })

export async function handleAiApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'GET' && pathname === '/api/ai/status') {
    const sidecarUrl = getAiSidecarUrl(db)
    const ping = await pingSidecar(sidecarUrl)
    json(res, {
      workerReady: Boolean(aiPool),
      sidecar: ping,
      fallback: 'local_blur',
    })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/ai/preview') {
    const body = (await readBody(req)) as {
      assetId?: number
      width?: number
      height?: number
    }

    if (!aiPool) {
      json(res, { error: 'ai 工作线程不可用，请先执行 npm run build:worker' }, 500)
      return true
    }

    const assetId = Number(body.assetId)
    const width = Math.round(Number(body.width))
    const height = Math.round(Number(body.height))
    if (!assetId || !width || !height) {
      json(res, { error: '缺少 assetId、width、height 参数' }, 400)
      return true
    }

    const row = db.prepare(`SELECT path FROM assets WHERE id = ? AND deleted_at IS NULL`).get(assetId) as
      | { path: string }
      | undefined
    if (!row || !existsSync(row.path)) {
      json(res, { error: '未找到图片' }, 404)
      return true
    }

    const previewName = `ai_${assetId}_${uid('p')}.webp`
    const outPath = path.join(CACHE_DIR, previewName)

    try {
      const result = (await aiQueue.add(() =>
        aiPool.run({
          inputPath: row.path,
          outputPath: outPath,
          width,
          height,
          sidecarUrl: getAiSidecarUrl(db),
        }),
      )) as { bytes: number; engine: string }

      json(res, { previewName, bytes: result.bytes, engine: result.engine })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      json(res, { previewName, bytes: 0, error: msg }, 200)
    }
    return true
  }

  if (req.method === 'POST' && pathname === '/api/ai/export') {
    const body = (await readBody(req)) as {
      assetIds?: number[]
      width?: number
      height?: number
      outputDir?: string
    }

    if (!aiPool) {
      json(res, { error: 'ai 工作线程不可用，请先执行 npm run build:worker' }, 500)
      return true
    }

    const assetIds = (body.assetIds ?? []).map((id) => Number(id)).filter((id) => id > 0)
    const width = Math.round(Number(body.width))
    const height = Math.round(Number(body.height))
    if (!assetIds.length || !width || !height) {
      json(res, { error: '缺少 assetIds、width、height 参数' }, 400)
      return true
    }

    const outputDir = (body.outputDir || getStoredExportDir(db)).trim()
    mkdirSync(outputDir, { recursive: true })

    const results: Array<{
      assetId: number
      outputPath: string
      bytes: number
      engine: string
      success: boolean
      error?: string
    }> = []

    for (const assetId of assetIds) {
      const row = db.prepare(`SELECT path, filename FROM assets WHERE id = ? AND deleted_at IS NULL`).get(assetId) as
        | { path: string; filename: string }
        | undefined

      if (!row || !existsSync(row.path)) {
        results.push({ assetId, outputPath: '', bytes: 0, engine: 'none', success: false, error: '未找到图片' })
        continue
      }

      const base = path.parse(row.filename).name.replace(/[\\/:"*?<>|]+/g, '_')
      const outputPath = path.join(outputDir, `${base}_ai_${width}x${height}.webp`)

      try {
        const result = (await aiQueue.add(() =>
          aiPool.run({
            inputPath: row.path,
            outputPath,
            width,
            height,
            sidecarUrl: getAiSidecarUrl(db),
          }),
        )) as { bytes: number; engine: string; outputPath: string }

        results.push({
          assetId,
          outputPath: result.outputPath,
          bytes: result.bytes,
          engine: result.engine,
          success: true,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ assetId, outputPath, bytes: 0, engine: 'none', success: false, error: msg })
      }
    }

    json(res, { outputDir, results })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/settings/ai-sidecar') {
    const body = (await readBody(req)) as { url?: string }
    const urlValue = body.url?.trim() ?? ''
    if (urlValue) {
      db.prepare(
        `INSERT INTO settings (key, value) VALUES ('ai_sidecar_url', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(urlValue)
    } else {
      db.prepare(`DELETE FROM settings WHERE key = 'ai_sidecar_url'`).run()
    }
    json(res, { url: getAiSidecarUrl(db) ?? null })
    return true
  }

  if (req.method === 'GET' && pathname === '/api/settings/ai-sidecar') {
    json(res, { url: getAiSidecarUrl(db) ?? null })
    return true
  }

  return false
}
