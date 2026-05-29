import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

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
  outputPath: string
  bytes: number
  width?: number
  height?: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
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

  let base = sharp(input.inputPath, { animated: true, pages: -1, limitInputPixels: false })
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()

  const meta = await base.metadata()
  const w0 = meta.width ?? 0
  const h0 = meta.height ?? 0
  if (!w0 || !h0) throw new Error('invalid image metadata')

  const padding = shadowEnabled ? Math.ceil(shadowBlur * 2 + Math.max(Math.abs(shadowOffsetX), Math.abs(shadowOffsetY))) : 0
  const canvasW = w0 + padding * 2
  const canvasH = h0 + padding * 2

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
    content = content.composite([{ input: m, blend: 'dest-in' }])
    const canvasSide = side + padding * 2
    const layers: sharp.OverlayOptions[] = []
    if (shadowEnabled) {
      const shadowShape = await sharp(svgMaskForCircle(side)).ensureAlpha().flatten({ background: shadowColor }).blur(shadowBlur).toBuffer()
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
    return { outputPath: input.outputPath, bytes: st.size }
  }

  if (cornerRadius > 0) {
    const m = svgMaskForRounded(w0, h0, cornerRadius)
    content = content.composite([{ input: m, blend: 'dest-in' }])
  }

  const layers: sharp.OverlayOptions[] = []
  if (shadowEnabled) {
    const mask = svgMaskForRounded(w0, h0, cornerRadius)
    const shadowShape = await sharp(mask).ensureAlpha().flatten({ background: shadowColor }).blur(shadowBlur).toBuffer()
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
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: transparentBackground ? { r: 0, g: 0, b: 0, alpha: 0 } : bgColor,
    },
  }).composite(layers)

  if (!transparentBackground) composed = composed.flatten({ background: bgColor })
  const { size, width, height } = await composed.webp({ quality: 90, effort: 4 }).toFile(input.outputPath)
  return { outputPath: input.outputPath, bytes: size, width, height }
}

