import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type Database from 'better-sqlite3'
import { fileHash } from './database.js'
import { ensureThumbnail } from './thumbnail.js'

const IMAGE_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif', '.ico',
])

function walkDir(dir: string, acc: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    if (name.startsWith('.')) continue
    const full = path.join(dir, name)
    try {
      const st = statSync(full)
      if (st.isDirectory()) walkDir(full, acc)
      else if (IMAGE_EXT.has(path.extname(name).toLowerCase())) acc.push(full)
    } catch {
      /* skip inaccessible */
    }
  }
  return acc
}

export async function scanFolder(
  db: Database.Database,
  folderPath: string,
  label?: string,
): Promise<{ added: number; updated: number }> {
  const insertFolder = db.prepare(
    `INSERT OR IGNORE INTO folders (path, label) VALUES (?, ?)`,
  )
  insertFolder.run(folderPath, label ?? path.basename(folderPath))
  const folderRow = db
    .prepare(`SELECT id FROM folders WHERE path = ?`)
    .get(folderPath) as { id: number }

  const upsert = db.prepare(`
    INSERT INTO assets (path, filename, width, height, ratio, area, resolution_level, dominant_color, brightness, format, size, hash, folder_id)
    VALUES (@path, @filename, @width, @height, @ratio, @area, @resolution_level, @dominant_color, @brightness, @format, @size, @hash, @folder_id)
    ON CONFLICT(path) DO UPDATE SET
      width = excluded.width,
      height = excluded.height,
      ratio = excluded.ratio,
      area = excluded.area,
      resolution_level = excluded.resolution_level,
      dominant_color = excluded.dominant_color,
      brightness = excluded.brightness,
      format = excluded.format,
      size = excluded.size,
      hash = excluded.hash
  `)

  let added = 0
  let updated = 0
  const files = walkDir(folderPath)

  for (const filePath of files) {
    try {
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
      if (!width || !height) continue
      const area = width * height
      const mp = area / 1_000_000
      const resolutionLevel = mp >= 8 ? 4 : mp >= 4 ? 3 : mp >= 2 ? 2 : mp >= 1 ? 1 : 0

      const sample = await sharp(filePath, {
        animated: false,
        pages: 1,
        limitInputPixels: false,
      })
        .resize(32, 32)
        .raw()
        .toBuffer()
      const hash = fileHash(sample)
      const px = 32 * 32
      const stride = 3
      let sr = 0
      let sg = 0
      let sb = 0
      for (let i = 0; i < px * stride; i += stride) {
        sr += sample[i] ?? 0
        sg += sample[i + 1] ?? 0
        sb += sample[i + 2] ?? 0
      }
      const r = Math.round(sr / px)
      const g = Math.round(sg / px)
      const b = Math.round(sb / px)
      const dominantColor = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
      const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      const existing = db
        .prepare(`SELECT id, hash FROM assets WHERE path = ?`)
        .get(filePath) as { id: number; hash: string } | undefined

      upsert.run({
        path: filePath,
        filename: path.basename(filePath),
        width,
        height,
        ratio: width / height,
        area,
        resolution_level: resolutionLevel,
        format: (meta.format ?? path.extname(filePath).slice(1)).toLowerCase(),
        dominant_color: dominantColor,
        brightness,
        size: st.size,
        hash,
        folder_id: folderRow.id,
      })

      if (!existing) added++
      else if (existing.hash !== hash) updated++

      await ensureThumbnail(filePath)
    } catch (err) {
      console.warn('[scanner] skip file:', filePath, err)
    }
  }

  return { added, updated }
}

export async function scanFiles(
  db: Database.Database,
  filePaths: string[],
): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0

  const insertFolder = db.prepare(`INSERT OR IGNORE INTO folders (path, label) VALUES (?, ?)`)
  const getFolderId = db.prepare(`SELECT id FROM folders WHERE path = ?`)

  const upsert = db.prepare(`
    INSERT INTO assets (path, filename, width, height, ratio, area, resolution_level, dominant_color, brightness, format, size, hash, folder_id)
    VALUES (@path, @filename, @width, @height, @ratio, @area, @resolution_level, @dominant_color, @brightness, @format, @size, @hash, @folder_id)
    ON CONFLICT(path) DO UPDATE SET
      width = excluded.width,
      height = excluded.height,
      ratio = excluded.ratio,
      area = excluded.area,
      resolution_level = excluded.resolution_level,
      dominant_color = excluded.dominant_color,
      brightness = excluded.brightness,
      format = excluded.format,
      size = excluded.size,
      hash = excluded.hash
  `)

  for (const filePath of filePaths) {
    try {
      const ext = path.extname(filePath).toLowerCase()
      if (!IMAGE_EXT.has(ext)) continue

      const folderPath = path.dirname(filePath)
      insertFolder.run(folderPath, path.basename(folderPath))
      const folderRow = getFolderId.get(folderPath) as { id: number }

      const isGif = ext === '.gif'
      const meta = await sharp(filePath, {
        animated: isGif,
        pages: isGif ? 1 : undefined,
        limitInputPixels: false,
      }).metadata()
      const st = statSync(filePath)
      const width = meta.width ?? 0
      const height = meta.height ?? 0
      if (!width || !height) continue
      const area = width * height
      const mp = area / 1_000_000
      const resolutionLevel = mp >= 8 ? 4 : mp >= 4 ? 3 : mp >= 2 ? 2 : mp >= 1 ? 1 : 0

      const sample = await sharp(filePath, {
        animated: false,
        pages: 1,
        limitInputPixels: false,
      })
        .resize(32, 32)
        .raw()
        .toBuffer()
      const hash = fileHash(sample)
      const px = 32 * 32
      const stride = 3
      let sr = 0
      let sg = 0
      let sb = 0
      for (let i = 0; i < px * stride; i += stride) {
        sr += sample[i] ?? 0
        sg += sample[i + 1] ?? 0
        sb += sample[i + 2] ?? 0
      }
      const r = Math.round(sr / px)
      const g = Math.round(sg / px)
      const b = Math.round(sb / px)
      const dominantColor = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
      const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

      const existing = db
        .prepare(`SELECT id, hash FROM assets WHERE path = ?`)
        .get(filePath) as { id: number; hash: string } | undefined

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
        folder_id: folderRow.id,
      })

      if (!existing) added++
      else if (existing.hash !== hash) updated++

      await ensureThumbnail(filePath)
    } catch (err) {
      console.warn('[scanner] skip file:', filePath, err)
    }
  }

  return { added, updated }
}
