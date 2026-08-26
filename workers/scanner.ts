import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type Database from 'better-sqlite3'
import { fileHash } from './database.js'
import { mapWorkerError } from './error-mapper.js'
import { ensureThumbnail } from './thumbnail.js'
import { normalizeFolderPath } from './fs-path.js'

const IMAGE_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif', '.ico',
])

export class ScanError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'ScanError'
    this.code = code
  }
}

function toScanError(err: unknown): ScanError {
  const mapped = mapWorkerError(err, '目录不可访问')
  if (mapped.code === 'ENOENT') return new ScanError('目录不存在', mapped.code)
  if (mapped.code === 'EACCES') return new ScanError('目录无权限', mapped.code)
  if (mapped.code === 'EPERM') return new ScanError('目录不可访问', mapped.code)
  return new ScanError(mapped.message || '扫描目录失败', mapped.code ?? 'UNKNOWN')
}

function walkDir(dir: string, acc: string[] = [], isRoot = false): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch (err) {
    if (isRoot) throw toScanError(err)
    return acc
  }
  for (const name of entries) {
    if (name.startsWith('.')) continue
    const full = path.join(dir, name)
    try {
      const st = statSync(full)
      if (st.isDirectory()) walkDir(full, acc, false)
      else if (IMAGE_EXT.has(path.extname(name).toLowerCase())) acc.push(full)
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : ''
      if (code === 'EPERM' || code === 'EACCES') {
        console.warn('[scanner] skip inaccessible path:', full, err)
      }
      /* skip inaccessible */
    }
  }
  return acc
}

async function sampleImageColor(filePath: string) {
  const sample = await sharp(filePath, { animated: false, pages: 1, limitInputPixels: false })
    .resize(32, 32)
    .raw()
    .toBuffer()
  const hash = fileHash(sample)
  const px = 32 * 32
  let sr = 0
  let sg = 0
  let sb = 0
  for (let i = 0; i < px * 3; i += 3) {
    sr += sample[i] ?? 0
    sg += sample[i + 1] ?? 0
    sb += sample[i + 2] ?? 0
  }
  const r = Math.round(sr / px)
  const g = Math.round(sg / px)
  const b = Math.round(sb / px)
  const dominantColor = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return { hash, dominantColor, brightness }
}

const ASSET_UPSERT_SQL = `
  INSERT INTO assets (path, filename, width, height, ratio, area, resolution_level, dominant_color, brightness, format, size, hash, folder_id)
  VALUES (@path, @filename, @width, @height, @ratio, @area, @resolution_level, @dominant_color, @brightness, @format, @size, @hash, @folder_id)
  ON CONFLICT(path) DO UPDATE SET
    filename = excluded.filename,
    width = excluded.width,
    height = excluded.height,
    ratio = excluded.ratio,
    area = excluded.area,
    resolution_level = excluded.resolution_level,
    dominant_color = excluded.dominant_color,
    brightness = excluded.brightness,
    format = excluded.format,
    size = excluded.size,
    hash = excluded.hash,
    folder_id = excluded.folder_id,
    deleted_at = NULL
`

interface ProcessFileResult {
  added: boolean
  updated: boolean
  restored: boolean
}

async function processOneFile(
  filePath: string,
  folderId: number,
  upsert: Database.Statement,
  db: Database.Database,
): Promise<ProcessFileResult> {
  const ext = path.extname(filePath).toLowerCase()
  const isGif = ext === '.gif'
  const meta = await sharp(filePath, {
    animated: isGif,
    pages: isGif ? 1 : undefined,
    limitInputPixels: false,
  }).metadata()
  const st = statSync(filePath)
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) return { added: false, updated: false, restored: false }
  const area = width * height
  const mp = area / 1_000_000
  const resolutionLevel = mp >= 8 ? 4 : mp >= 4 ? 3 : mp >= 2 ? 2 : mp >= 1 ? 1 : 0

  const { hash, dominantColor, brightness } = await sampleImageColor(filePath)
  const existing = db
    .prepare(`SELECT id, hash, deleted_at FROM assets WHERE path = ?`)
    .get(filePath) as { id: number; hash: string; deleted_at: string | null } | undefined

  upsert.run({
    path: filePath,
    filename: path.basename(filePath),
    width,
    height,
    ratio: width / height,
    area,
    resolution_level: resolutionLevel,
    format: (meta.format ?? ext.slice(1)).toLowerCase(),
    dominant_color: dominantColor,
    brightness,
    size: st.size,
    hash,
    folder_id: folderId,
  })

  void ensureThumbnail(filePath).catch((thumbErr) => {
    console.warn('[scanner] thumbnail failed:', filePath, thumbErr)
  })

  if (!existing) return { added: true, updated: false, restored: false }
  if (existing.deleted_at) return { added: false, updated: false, restored: true }
  if (existing.hash !== hash) return { added: false, updated: true, restored: false }
  return { added: false, updated: false, restored: false }
}

export async function scanFolder(
  db: Database.Database,
  folderPath: string,
  label?: string,
): Promise<{ added: number; updated: number; restored: number }> {
  try {
    const st = statSync(folderPath)
    if (!st.isDirectory()) {
      throw new ScanError('目录不存在', 'ENOENT')
    }
  } catch (err) {
    throw err instanceof ScanError ? err : toScanError(err)
  }

  const rootPath = normalizeFolderPath(folderPath)

  const upsertFolder = db.prepare(`
    INSERT INTO folders (path, label) VALUES (?, ?)
    ON CONFLICT(path) DO UPDATE SET label = excluded.label
  `)
  upsertFolder.run(rootPath, label ?? path.basename(rootPath))
  const folderRow = db
    .prepare(`SELECT id FROM folders WHERE path = ?`)
    .get(rootPath) as { id: number }

  const upsert = db.prepare(ASSET_UPSERT_SQL)

  let added = 0
  let updated = 0
  let restored = 0
  const files = walkDir(rootPath, [], true)

  for (const filePath of files) {
    try {
      const r = await processOneFile(filePath, folderRow.id, upsert, db)
      if (r.added) added++
      else if (r.restored) restored++
      else if (r.updated) updated++
    } catch (err) {
      console.warn('[scanner] skip file:', filePath, err)
    }
  }

  return { added, updated, restored }
}

export async function scanFiles(
  db: Database.Database,
  filePaths: string[],
): Promise<{ added: number; updated: number; restored: number }> {
  let added = 0
  let updated = 0
  let restored = 0

  const upsertFolder = db.prepare(`
    INSERT INTO folders (path, label) VALUES (?, ?)
    ON CONFLICT(path) DO UPDATE SET label = excluded.label
  `)
  const getFolderId = db.prepare(`SELECT id FROM folders WHERE path = ?`)

  const upsert = db.prepare(ASSET_UPSERT_SQL)

  for (const filePath of filePaths) {
    try {
      const ext = path.extname(filePath).toLowerCase()
      if (!IMAGE_EXT.has(ext)) continue

      try {
        statSync(filePath)
      } catch (err) {
        throw toScanError(err)
      }

      const folderPath = normalizeFolderPath(path.dirname(filePath))
      upsertFolder.run(folderPath, path.basename(folderPath))
      const folderRow = getFolderId.get(folderPath) as { id: number }

      const r = await processOneFile(filePath, folderRow.id, upsert, db)
      if (r.added) added++
      else if (r.restored) restored++
      else if (r.updated) updated++
    } catch (err) {
      if (err instanceof ScanError) throw err
      console.warn('[scanner] skip file:', filePath, err)
    }
  }

  return { added, updated, restored }
}
