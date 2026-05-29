import { existsSync } from 'node:fs'
import path from 'node:path'
import { Piscina } from 'piscina'
import PQueue from 'p-queue'
import type Database from 'better-sqlite3'
import { CACHE_DIR } from './thumbnail.js'

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

function resolveEditWorkerFile(): string | null {
  const candidates = [
    path.join(RUNTIME_DIR, 'edit-processor.cjs'),
    path.join(RUNTIME_DIR, '..', 'electron-dist', 'edit-processor.cjs'),
    path.join(process.cwd(), 'electron-dist', 'edit-processor.cjs'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

const editWorkerFile = resolveEditWorkerFile()
const editPool = editWorkerFile ? new Piscina({ filename: editWorkerFile, minThreads: 1, maxThreads: 4 }) : null
const editQueue = new PQueue({ concurrency: 2 })

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
      params?: {
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
    }

    if (!editPool) {
      json(res, { error: 'edit worker not available, run build:worker first' }, 500)
      return true
    }

    const assetId = Number(body.assetId)
    if (!assetId) {
      json(res, { error: 'assetId required' }, 400)
      return true
    }

    const row = db.prepare(`SELECT path FROM assets WHERE id = ?`).get(assetId) as { path: string } | undefined
    if (!row || !existsSync(row.path)) {
      json(res, { error: 'asset not found' }, 404)
      return true
    }

    const p = body.params ?? {}
    const previewName = `edit_${assetId}_${uid('p')}.webp`
    const outPath = path.join(CACHE_DIR, previewName)

    const result = (await editQueue.add(() => {
      return editPool.run({
        inputPath: row.path,
        outputPath: outPath,
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
      })
    })) as unknown as { bytes: number; width?: number; height?: number }

    json(res, { previewName, bytes: result.bytes, width: result.width, height: result.height })
    return true
  }

  return false
}
