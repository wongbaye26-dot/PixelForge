import { createHash } from 'node:crypto'
import { existsSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { getCacheDir } from './paths.js'

export const CACHE_DIR = getCacheDir()
const THUMB_SIZE = 512

export function thumbCacheKey(filePath: string): string {
  return createHash('sha256').update(filePath).digest('hex').slice(0, 24)
}

export function thumbFilePaths(filePath: string) {
  const key = thumbCacheKey(filePath)
  return {
    key,
    webp: path.join(CACHE_DIR, `${key}.webp`),
    gif: path.join(CACHE_DIR, `${key}.gif`),
  }
}

export function isGifFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.gif'
}

function openImage(filePath: string, animated?: boolean) {
  const gif = isGifFile(filePath)
  const shouldAnimate = animated ?? gif
  return sharp(filePath, {
    animated: shouldAnimate,
    pages: shouldAnimate ? -1 : 1,
    limitInputPixels: false,
  })
}

export interface ThumbnailResult {
  filePath: string
  cacheName: string
  mime: string
}

function purgeStaleGifThumb(paths: ReturnType<typeof thumbFilePaths>) {
  if (existsSync(paths.webp)) {
    try {
      unlinkSync(paths.webp)
    } catch {
      /* ignore */
    }
  }
}

/** PRD §7 — GIF 保留动画缩略图；静态图用 WebP */
export async function ensureThumbnail(filePath: string): Promise<ThumbnailResult> {
  const paths = thumbFilePaths(filePath)

  if (isGifFile(filePath)) {
    purgeStaleGifThumb(paths)
    if (existsSync(paths.gif)) {
      return { filePath: paths.gif, cacheName: `${paths.key}.gif`, mime: 'image/gif' }
    }
    try {
      await openImage(filePath, true)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
        .gif({ effort: 7, loop: 0 })
        .toFile(paths.gif)
      return { filePath: paths.gif, cacheName: `${paths.key}.gif`, mime: 'image/gif' }
    } catch (err) {
      console.warn('[thumbnail] GIF animated thumb failed:', filePath, err)
    }
  }

  if (existsSync(paths.webp)) {
    return { filePath: paths.webp, cacheName: `${paths.key}.webp`, mime: 'image/webp' }
  }

  await openImage(filePath, false)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(paths.webp)

  return { filePath: paths.webp, cacheName: `${paths.key}.webp`, mime: 'image/webp' }
}

export function resolveExistingThumbnail(filePath: string): ThumbnailResult | null {
  const paths = thumbFilePaths(filePath)
  if (isGifFile(filePath)) {
    if (existsSync(paths.gif)) {
      return { filePath: paths.gif, cacheName: `${paths.key}.gif`, mime: 'image/gif' }
    }
    return null
  }
  if (existsSync(paths.webp)) {
    return { filePath: paths.webp, cacheName: `${paths.key}.webp`, mime: 'image/webp' }
  }
  return null
}

export function thumbnailHttpPath(result: ThumbnailResult): string {
  return `/cache/thumbnails/${result.cacheName}`
}

export function assetPreviewHttpPath(assetId: number): string {
  return `/api/assets/${assetId}/preview`
}
