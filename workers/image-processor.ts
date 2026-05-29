import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type { ExportFormat, FitMode } from '../src/types/index.js'
import { applyNamingPattern, resolveUniquePath, type NamingContext } from '../src/core/naming.js'
import { planCompression } from '../src/core/compress.js'
import { isGifFile } from './thumbnail.js'

export interface ProcessOptions {
  inputPath: string
  outputDir: string
  width: number
  height: number
  format: ExportFormat
  fitMode: FitMode
  quality: number
  targetSizeKb?: number
  namingPattern: string
  index: number
}

function openSource(inputPath: string, animated: boolean) {
  return sharp(inputPath, {
    animated,
    pages: animated ? -1 : 1,
    limitInputPixels: false,
  })
}

async function blurExtend(
  input: sharp.Sharp,
  width: number,
  height: number,
): Promise<Buffer> {
  const vignette = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="v" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
          <stop offset="70%" stop-color="rgba(0,0,0,0.08)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.38)"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>`,
  )

  const bg = await input
    .clone()
    .resize(width, height, { fit: 'cover' })
    .blur(52)
    .modulate({ brightness: 0.75, saturation: 0.88 })
    .composite([{ input: vignette }])
    .toBuffer()

  const fg = await input
    .clone()
    .resize({
      width,
      height,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()

  const fgMeta = await sharp(fg).metadata()
  const fw = fgMeta.width ?? width
  const fh = fgMeta.height ?? height
  const left = Math.round((width - fw) / 2)
  const top = Math.round((height - fh) / 2)

  const shadow = await sharp(fg)
    .ensureAlpha()
    .flatten({ background: { r: 0, g: 0, b: 0, alpha: 0.35 } })
    .blur(18)
    .toBuffer()

  return sharp(bg)
    .composite([
      { input: shadow, left: left + 0, top: top + 10 },
      { input: fg, left, top },
    ])
    .toBuffer()
}

async function gradientFill(
  input: sharp.Sharp,
  width: number,
  height: number,
): Promise<Buffer> {
  const raw = await input.clone().resize(24, 24).raw().toBuffer()
  const px = 24 * 24
  let sr = 0
  let sg = 0
  let sb = 0
  for (let i = 0; i < px * 3; i += 3) {
    sr += raw[i] ?? 0
    sg += raw[i + 1] ?? 0
    sb += raw[i + 2] ?? 0
  }
  const r = Math.round(sr / px)
  const g = Math.round(sg / px)
  const b = Math.round(sb / px)
  const bright = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  const k = bright > 0.55 ? -48 : 48
  const r2 = Math.max(0, Math.min(255, r + k))
  const g2 = Math.max(0, Math.min(255, g + k))
  const b2 = Math.max(0, Math.min(255, b + k))

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${r},${g},${b});stop-opacity:1"/>
          <stop offset="100%" style="stop-color:rgb(${r2},${g2},${b2});stop-opacity:1"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`

  const fg = await input
    .clone()
    .resize({ width, height, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  const fgMeta = await sharp(fg).metadata()
  const left = Math.round((width - (fgMeta.width ?? width)) / 2)
  const top = Math.round((height - (fgMeta.height ?? height)) / 2)

  return sharp(Buffer.from(svg))
    .composite([{ input: fg, left, top }])
    .toBuffer()
}

function encodePipeline(
  buffer: Buffer,
  format: ExportFormat,
  quality: number,
): sharp.Sharp {
  const img = sharp(buffer)
  switch (format) {
    case 'jpg':
      return img.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality, mozjpeg: true })
    case 'png':
      return img.png({ compressionLevel: 9 })
    case 'webp':
      return img.webp({ quality })
    case 'avif':
      return img.avif({ quality })
    case 'gif':
      return img.gif()
    case 'ico':
      return img.resize(256, 256).png()
    default:
      return img.webp({ quality })
  }
}

async function renderFrame(
  inputPath: string,
  width: number,
  height: number,
  fitMode: FitMode,
): Promise<Buffer> {
  const input = openSource(inputPath, false)

  switch (fitMode) {
    case 'cover':
      {
        const meta = await input.metadata()
        const sw = meta.width ?? 0
        const sh = meta.height ?? 0
        if (!sw || !sh) return input.resize(width, height, { fit: 'cover' }).toBuffer()

        const smallW = 64
        const smallH = 64
        const gray = await input
          .clone()
          .resize(smallW, smallH, { fit: 'cover' })
          .greyscale()
          .raw()
          .toBuffer()

        let sum = 0
        let sx = 0
        let sy = 0
        for (let y = 1; y < smallH - 1; y++) {
          for (let x = 1; x < smallW - 1; x++) {
            const i = y * smallW + x
            const gx = (gray[i + 1] ?? 0) - (gray[i - 1] ?? 0)
            const gy = (gray[i + smallW] ?? 0) - (gray[i - smallW] ?? 0)
            const m = Math.abs(gx) + Math.abs(gy)
            sum += m
            sx += x * m
            sy += y * m
          }
        }

        const fxN = sum ? sx / sum : smallW / 2
        const fyN = sum ? sy / sum : smallH / 2
        const fx = (fxN / smallW) * sw
        const fy = (fyN / smallH) * sh

        const targetRatio = width / height
        const srcRatio = sw / sh
        let cropW = sw
        let cropH = sh
        if (srcRatio > targetRatio) {
          cropW = Math.round(sh * targetRatio)
          cropH = sh
        } else if (srcRatio < targetRatio) {
          cropW = sw
          cropH = Math.round(sw / targetRatio)
        }

        const left = Math.max(0, Math.min(sw - cropW, Math.round(fx - cropW / 2)))
        const top = Math.max(0, Math.min(sh - cropH, Math.round(fy - cropH / 2)))

        return openSource(inputPath, false)
          .extract({ left, top, width: cropW, height: cropH })
          .resize(width, height, { fit: 'fill' })
          .toBuffer()
      }
    case 'blur_extend':
      return blurExtend(input, width, height)
    case 'gradient_fill':
      return gradientFill(input, width, height)
    case 'contain':
    default:
      return input
        .resize(width, height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .toBuffer()
  }
}

async function exportAnimated(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
  format: ExportFormat,
  fitMode: FitMode,
  quality: number,
): Promise<void> {
  const input = openSource(inputPath, true)

  if (fitMode === 'blur_extend' || fitMode === 'gradient_fill') {
    // 复杂适配对动图逐帧处理成本过高，降级为动画 contain
    const pipeline = input.resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    await encodeAnimated(pipeline, format, quality).toFile(outputPath)
    return
  }

  const fit = fitMode === 'cover' ? 'cover' : 'contain'
  const background =
    fit === 'contain' ? { r: 0, g: 0, b: 0, alpha: 0 as const } : undefined

  const pipeline = input.resize(width, height, { fit, background })
  await encodeAnimated(pipeline, format, quality).toFile(outputPath)
}

function encodeAnimated(
  pipeline: sharp.Sharp,
  format: ExportFormat,
  quality: number,
): sharp.Sharp {
  switch (format) {
    case 'webp':
      return pipeline.webp({ quality, effort: 4 })
    case 'avif':
      return pipeline.avif({ quality, effort: 4 })
    case 'gif':
    default:
      return pipeline.gif({ effort: 7, loop: 0 })
  }
}

export async function processAndExport(opts: ProcessOptions): Promise<string> {
  const {
    inputPath,
    outputDir,
    width,
    height,
    fitMode,
    quality,
    targetSizeKb,
    namingPattern,
    index,
  } = opts
  let { format } = opts

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  // Resolve 'original' format
  if (format === 'original') {
    const meta = await sharp(inputPath).metadata()
    const rawFormat = meta.format
    if (rawFormat === 'jpeg') format = 'jpg'
    else if (rawFormat === 'png') format = 'png'
    else if (rawFormat === 'webp') format = 'webp'
    else if (rawFormat === 'gif') format = 'gif'
    else if (rawFormat === 'avif') format = 'avif'
    else format = 'jpg' // Fallback
  }

  const baseName = path.parse(inputPath).name
  const ctx: NamingContext = {
    name: baseName,
    width,
    height,
    format,
    index,
  }
  const filename = applyNamingPattern(namingPattern, ctx)
  const outputPath = resolveUniquePath(path.join(outputDir, filename), existsSync)

  const isAnimatedSource = isGifFile(inputPath)
  const supportsAnimation = format === 'gif' || format === 'webp' || format === 'avif'
  const keepAnimation = isAnimatedSource && supportsAnimation

  if (keepAnimation) {
    await exportAnimated(inputPath, outputPath, width, height, format, fitMode, quality)
    return outputPath
  }

  const frame = await renderFrame(inputPath, width, height, fitMode)
  const plan = planCompression(targetSizeKb, quality)

  let lastBuffer: Buffer | null = null
  for (const q of plan.qualities) {
    lastBuffer = await encodePipeline(frame, format, q).toBuffer()
    if (!plan.targetBytes || lastBuffer.length <= plan.targetBytes) break
  }

  if (!lastBuffer) throw new Error('Export failed: empty buffer')
  await sharp(lastBuffer).toFile(outputPath)
  return outputPath
}
