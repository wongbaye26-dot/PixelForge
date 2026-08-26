import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import type { ExportFormat, FitMode } from '../src/types/index.js'
import { applyNamingPattern, resolveUniquePath, type NamingContext } from '../src/core/naming.js'
import { planCompression } from '../src/core/compress.js'
import { runOutpaint } from './ai-outpaint.js'
import { isGifFile } from './thumbnail.js'
import { blurExtend } from './blur-extend.js'
import {
  avifEncodeOptions,
  jpegEncodeOptions,
  pngEncodeOptions,
  webpEncodeOptions,
  writePngOutput,
} from './encode-utils.js'

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
  mozjpeg?: boolean
  usePngquant?: boolean
  sidecarUrl?: string
  checkpoint?: (progress: number) => Promise<void> | void
}

function openSource(inputPath: string, animated: boolean) {
  return sharp(inputPath, {
    animated,
    pages: animated ? -1 : 1,
    limitInputPixels: false,
  })
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
  opts?: { mozjpeg?: boolean; usePngquant?: boolean },
): sharp.Sharp {
  const img = sharp(buffer)
  const mozjpeg = opts?.mozjpeg !== false
  switch (format) {
    case 'jpg':
      return img.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg(jpegEncodeOptions(quality, mozjpeg))
    case 'png':
      return img.png(pngEncodeOptions())
    case 'webp':
      return img.webp(webpEncodeOptions(quality))
    case 'avif':
      return img.avif(avifEncodeOptions(quality))
    case 'gif':
      return img.gif()
    case 'ico':
      return img.resize(256, 256).png()
    default:
      return img.webp(webpEncodeOptions(quality))
  }
}

async function writeEncodedBuffer(
  buffer: Buffer,
  format: ExportFormat,
  quality: number,
  outputPath: string,
  opts?: { mozjpeg?: boolean; usePngquant?: boolean },
): Promise<void> {
  if (format === 'png' && opts?.usePngquant) {
    await writePngOutput(buffer, outputPath, true)
    return
  }
  await encodePipeline(buffer, format, quality, opts).toFile(outputPath)
}

async function renderFrame(
  inputPath: string,
  width: number,
  height: number,
  fitMode: FitMode,
  sidecarUrl?: string,
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
    case 'ai_outpaint': {
      const tmp = path.join(tmpdir(), `pf-export-ai-${Date.now()}.webp`)
      try {
        await runOutpaint({
          inputPath,
          outputPath: tmp,
          width,
          height,
          sidecarUrl,
        })
        return sharp(tmp).toBuffer()
      } finally {
        try {
          unlinkSync(tmp)
        } catch {
          /* ignore */
        }
      }
    }
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

  if (fitMode === 'blur_extend' || fitMode === 'gradient_fill' || fitMode === 'ai_outpaint') {
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
      return pipeline.webp(webpEncodeOptions(quality))
    case 'avif':
      return pipeline.avif(avifEncodeOptions(quality))
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
    checkpoint,
  } = opts
  let { format } = opts
  const encodeOpts = { mozjpeg: opts.mozjpeg, usePngquant: opts.usePngquant }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  await checkpoint?.(8)

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
  await checkpoint?.(18)

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
  await checkpoint?.(28)

  const isAnimatedSource = isGifFile(inputPath)
  const supportsAnimation = format === 'gif' || format === 'webp' || format === 'avif'
  const keepAnimation = isAnimatedSource && supportsAnimation

  if (keepAnimation) {
    await checkpoint?.(42)
    await exportAnimated(inputPath, outputPath, width, height, format, fitMode, quality)
    await checkpoint?.(100)
    return outputPath
  }

  const frame = await renderFrame(inputPath, width, height, fitMode, opts.sidecarUrl)
  await checkpoint?.(58)
  const plan = planCompression(targetSizeKb, quality)

  let lastBuffer: Buffer | null = null
  for (const q of plan.qualities) {
    lastBuffer = await encodePipeline(frame, format, q, encodeOpts).toBuffer()
    await checkpoint?.(76)
    if (!plan.targetBytes || lastBuffer.length <= plan.targetBytes) break
  }

  if (!lastBuffer) throw new Error('导出失败：空缓冲区')
  await checkpoint?.(92)
  await writeEncodedBuffer(lastBuffer, format, plan.qualities[plan.qualities.length - 1] ?? quality, outputPath, encodeOpts)
  await checkpoint?.(100)
  return outputPath
}
