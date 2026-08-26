import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { Piscina } from 'piscina'
import PQueue from 'p-queue'
import type Database from 'better-sqlite3'
import { CACHE_DIR } from './thumbnail.js'
import { getStoredExportDir } from './settings.js'
import { uid, json, readBody } from './utils.js'
import { resolveWorkerFile } from './resolve-worker.js'

const editWorkerFile = resolveWorkerFile('edit')
const editPool = editWorkerFile ? new Piscina({ filename: editWorkerFile, minThreads: 1, maxThreads: 4 }) : null
const editQueue = new PQueue({ concurrency: 2 })

type EditParamsBody = {
  maxSize?: number
  transparentBackground?: boolean
  backgroundColor?: string
  cornerRadius?: number
  circleCrop?: boolean
  strokeWidth?: number
  strokeColor?: string
  shadowEnabled?: boolean
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowColor?: string
}

function buildEditJobInput(inputPath: string, outputPath: string, p: EditParamsBody) {
  return {
    inputPath,
    outputPath,
    maxSize: p.maxSize ?? 960,
    transparentBackground: p.transparentBackground ?? true,
    backgroundColor: p.backgroundColor ?? '#ffffff',
    cornerRadius: p.cornerRadius ?? 0,
    circleCrop: p.circleCrop ?? false,
    strokeWidth: p.strokeWidth ?? 0,
    strokeColor: p.strokeColor ?? '#ffffff',
    shadowEnabled: p.shadowEnabled ?? false,
    shadowBlur: p.shadowBlur ?? 18,
    shadowOffsetX: p.shadowOffsetX ?? 0,
    shadowOffsetY: p.shadowOffsetY ?? 10,
    shadowColor: p.shadowColor ?? 'rgba(0,0,0,0.35)',
  }
}

function uniqueOutputPath(dir: string, baseName: string, ext: string): string {
  let candidate = path.join(dir, `${baseName}_edited${ext}`)
  let n = 1
  while (existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}_edited_${n}${ext}`)
    n += 1
  }
  return candidate
}

export async function handleEditApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'POST' && pathname === '/api/edit/preview') {
    const body = (await readBody(req)) as {
      assetId?: number
      params?: EditParamsBody
    }

    if (!editPool) {
      json(res, { error: 'edit 工作线程不可用，请先执行 npm run build:worker' }, 500)
      return true
    }

    const assetId = Number(body.assetId)
    if (!assetId) {
      json(res, { error: '缺少 assetId 参数' }, 400)
      return true
    }

    const row = db.prepare(`SELECT path FROM assets WHERE id = ?`).get(assetId) as { path: string } | undefined
    if (!row || !existsSync(row.path)) {
      json(res, { error: '未找到图片' }, 404)
      return true
    }

    const p = body.params ?? {}
    const previewName = `edit_${assetId}_${uid('p')}.webp`
    const outPath = path.join(CACHE_DIR, previewName)

    let result: { bytes: number; width?: number; height?: number; success?: boolean; error?: string }
    try {
      result = (await editQueue.add(() => {
        return editPool.run(buildEditJobInput(row.path, outPath, p))
      })) as unknown as { bytes: number; width?: number; height?: number; success?: boolean; error?: string }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      json(res, { previewName, bytes: 0, error: msg }, 200)
      return true
    }

    json(res, { previewName, bytes: result.bytes, width: result.width, height: result.height, error: result.error }, 200)
    return true
  }

  if (req.method === 'POST' && pathname === '/api/edit/export') {
    const body = (await readBody(req)) as {
      assetIds?: number[]
      assetId?: number
      params?: EditParamsBody
      outputDir?: string
    }

    if (!editPool) {
      json(res, { error: 'edit 工作线程不可用，请先执行 npm run build:worker' }, 500)
      return true
    }

    const assetIds = (body.assetIds?.length ? body.assetIds : body.assetId ? [body.assetId] : [])
      .map((id) => Number(id))
      .filter((id) => id > 0)

    if (!assetIds.length) {
      json(res, { error: '缺少 assetIds 参数' }, 400)
      return true
    }

    const outputDir = (body.outputDir || getStoredExportDir(db)).trim()
    mkdirSync(outputDir, { recursive: true })
    const p = body.params ?? {}

    const results: Array<{
      assetId: number
      outputPath: string
      bytes: number
      success: boolean
      error?: string
    }> = []

    for (const assetId of assetIds) {
      const row = db.prepare(`SELECT path, filename FROM assets WHERE id = ?`).get(assetId) as
        | { path: string; filename: string }
        | undefined

      if (!row || !existsSync(row.path)) {
        results.push({ assetId, outputPath: '', bytes: 0, success: false, error: '未找到图片' })
        continue
      }

      const baseName = path.parse(row.filename).name
      const outputPath = uniqueOutputPath(outputDir, baseName, '.webp')

      try {
        const result = (await editQueue.add(() => {
          return editPool.run(buildEditJobInput(row.path, outputPath, p))
        })) as { bytes: number; success?: boolean; error?: string }

        results.push({
          assetId,
          outputPath,
          bytes: result.bytes,
          success: result.success !== false,
          error: result.error,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ assetId, outputPath, bytes: 0, success: false, error: msg })
      }
    }

    json(res, { outputDir, results })
    return true
  }

  return false
}
