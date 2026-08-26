import { appendFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { CACHE_DIR } from './thumbnail.js'
import { createSafeCanvas } from '../src/modules/editor/utils/createSafeCanvas'
import { safeComposite } from '../src/modules/editor/utils/safeComposite'
import { clamp } from './utils.js'

export interface EditProcessorInput {
  inputPath: string
  outputPath: string
  maxSize: number
  transparentBackground: boolean
  backgroundColor?: string
  cornerRadius: number
  circleCrop: boolean
  strokeWidth: number
  strokeColor: string
  shadowEnabled: boolean
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
  shadowColor: string
}

export interface EditProcessorOutput {
  success?: boolean
  error?: string
  outputPath: string
  bytes: number
  width?: number
  height?: number
}

function rgbaCss(c: string): string {
  const s = c.trim()
  if (!s) return 'rgba(0,0,0,0.35)'
  return s
}

function svgMaskForRounded(w: number, h: number, r: number): Buffer {
  const radius = clamp(r, 0, Math.min(w, h) / 2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/>
</svg>`
  return Buffer.from(svg)
}

function svgMaskForCircle(size: number): Buffer {
  const r = size / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/>
</svg>`
  return Buffer.from(svg)
}

function svgStrokeForRounded(w: number, h: number, r: number, strokeWidth: number, strokeColor: string): Buffer {
  const sw = Math.max(1, Math.round(strokeWidth))
  const radius = clamp(r, 0, Math.min(w, h) / 2)
  const inset = sw / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect x="${inset}" y="${inset}" width="${w - sw}" height="${h - sw}" rx="${radius}" ry="${radius}"
    fill="none" stroke="${strokeColor}" stroke-width="${sw}" />
</svg>`
  return Buffer.from(svg)
}

function svgStrokeForCircle(size: number, strokeWidth: number, strokeColor: string): Buffer {
  const sw = Math.max(1, Math.round(strokeWidth))
  const r = size / 2 - sw / 2
  const c = size / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${strokeColor}" stroke-width="${sw}" />
</svg>`
  return Buffer.from(svg)
}

function effectiveDims(meta: sharp.Metadata): { width: number; height: number } {
  const width = meta.width ?? 0
  const height = (meta.pageHeight ?? meta.height) ?? 0
  return { width, height }
}

function logEditError(payload: Record<string, unknown>) {
  try {
    const p = path.join(CACHE_DIR, 'editor-error.log')
    appendFileSync(p, `${JSON.stringify({ ts: Date.now(), ...payload })}\n`)
  } catch {
    /* ignore */
  }
}

export default async function editOne(input: EditProcessorInput): Promise<EditProcessorOutput> {
  const outDir = path.dirname(input.outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const maxSize = clamp(input.maxSize || 900, 256, 2048)
  const cornerRadius = clamp(input.cornerRadius || 0, 0, 9999)
  const strokeWidth = clamp(input.strokeWidth || 0, 0, 200)
  const shadowBlur = clamp(input.shadowBlur || 0, 0, 200)
  const shadowOffsetX = clamp(input.shadowOffsetX || 0, -200, 200)
  const shadowOffsetY = clamp(input.shadowOffsetY || 0, -200, 200)

  const shadowEnabled = Boolean(input.shadowEnabled) && (shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0)
  const transparentBackground = Boolean(input.transparentBackground)
  const bgColor = rgbaCss(input.backgroundColor || '#ffffff')
  const strokeColor = rgbaCss(input.strokeColor || '#ffffff')
  const shadowColor = rgbaCss(input.shadowColor || 'rgba(0,0,0,0.35)')

  let baseMeta: sharp.Metadata | null = null
  try {
    const base = sharp(input.inputPath, { animated: true, pages: -1, limitInputPixels: false })
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()

    baseMeta = await base.metadata()
    const { width: w0, height: h0 } = effectiveDims(baseMeta)
    if (!w0 || !h0) throw new Error('图片元数据无效')

    const canvas = createSafeCanvas(w0, h0, { shadowEnabled, shadowBlur, shadowOffsetX, shadowOffsetY })
    const padding = canvas.padding

    let content = base

    if (input.circleCrop) {
      const side = Math.min(w0, h0)
      content = content.extract({
        left: Math.floor((w0 - side) / 2),
        top: Math.floor((h0 - side) / 2),
        width: side,
        height: side,
      })
      const m = svgMaskForCircle(side)
      content = await safeComposite(content, m, { blend: 'dest-in' })

      const canvasSide = side + padding * 2
      const layers: sharp.OverlayOptions[] = []
      if (shadowEnabled) {
        const shadowShape = await sharp(svgMaskForCircle(side), { limitInputPixels: false })
          .ensureAlpha()
          .flatten({ background: shadowColor })
          .blur(shadowBlur)
          .toBuffer()
        layers.push({ input: shadowShape, top: padding + shadowOffsetY, left: padding + shadowOffsetX })
      }
      const contentBuf = await content.toBuffer()
      layers.push({ input: contentBuf, top: padding, left: padding })
      if (strokeWidth > 0) {
        const strokeSvg = svgStrokeForCircle(side, strokeWidth, strokeColor)
        layers.push({ input: strokeSvg, top: padding, left: padding })
      }

      let composed = sharp({
        create: {
          width: canvasSide,
          height: canvasSide,
          channels: 4,
          background: transparentBackground ? { r: 0, g: 0, b: 0, alpha: 0 } : bgColor,
        },
      }).composite(layers)

      if (!transparentBackground) composed = composed.flatten({ background: bgColor })
      await composed.webp({ quality: 90, effort: 4 }).toFile(input.outputPath)

      const st = statSync(input.outputPath)
      return { success: true, outputPath: input.outputPath, bytes: st.size }
    }

    if (cornerRadius > 0) {
      const m = svgMaskForRounded(w0, h0, cornerRadius)
      content = await safeComposite(content, m, { blend: 'dest-in' })
    }

    const layers: sharp.OverlayOptions[] = []
    if (shadowEnabled) {
      const mask = svgMaskForRounded(w0, h0, cornerRadius)
      const shadowShape = await sharp(mask, { limitInputPixels: false })
        .ensureAlpha()
        .flatten({ background: shadowColor })
        .blur(shadowBlur)
        .toBuffer()
      layers.push({ input: shadowShape, top: padding + shadowOffsetY, left: padding + shadowOffsetX })
    }

    const contentBuf = await content.toBuffer()
    layers.push({ input: contentBuf, top: padding, left: padding })

    if (strokeWidth > 0) {
      const strokeSvg = svgStrokeForRounded(w0, h0, cornerRadius, strokeWidth, strokeColor)
      layers.push({ input: strokeSvg, top: padding, left: padding })
    }

    let composed = sharp({
      create: {
        width: canvas.width,
        height: canvas.height,
        channels: 4,
        background: transparentBackground ? { r: 0, g: 0, b: 0, alpha: 0 } : bgColor,
      },
    }).composite(layers)

    if (!transparentBackground) composed = composed.flatten({ background: bgColor })
    const { size, width, height } = await composed.webp({ quality: 90, effort: 4 }).toFile(input.outputPath)
    return { success: true, outputPath: input.outputPath, bytes: size, width, height }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logEditError({
      inputPath: input.inputPath,
      outputPath: input.outputPath,
      error: msg,
      baseMeta,
      params: {
        maxSize,
        transparentBackground,
        cornerRadius,
        circleCrop: input.circleCrop,
        strokeWidth,
        strokeColor,
        shadowEnabled,
        shadowBlur,
        shadowOffsetX,
        shadowOffsetY,
        shadowColor,
      },
    })

    try {
      const fallback = sharp(input.inputPath, { animated: false, limitInputPixels: false })
        .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
      await fallback.webp({ quality: 80, effort: 4 }).toFile(input.outputPath)
      const st = statSync(input.outputPath)
      return { success: false, error: msg, outputPath: input.outputPath, bytes: st.size }
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2)
      logEditError({ inputPath: input.inputPath, outputPath: input.outputPath, error: msg2, stage: 'fallback' })
      await sharp({
        create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .webp({ quality: 60, effort: 1 })
        .toFile(input.outputPath)
      const st = statSync(input.outputPath)
      return { success: false, error: msg, outputPath: input.outputPath, bytes: st.size }
    }
  }
}
