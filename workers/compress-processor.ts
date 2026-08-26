import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { clamp } from './utils.js'
import {
  avifEncodeOptions,
  jpegEncodeOptions,
  pngEncodeOptions,
  webpEncodeOptions,
  writePngOutput,
} from './encode-utils.js'

export type CompressFormat = 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif'

export interface CompressProcessorInput {
  inputPath: string
  outputPath: string
  previewPath: string
  outputFormat: 'auto' | 'original' | CompressFormat
  quality: number
  targetSizeKb?: number
  mozjpeg?: boolean
  usePngquant?: boolean
}

export interface CompressProcessorOutput {
  outputPath: string
  previewPath: string
  beforeBytes: number
  afterBytes: number
  finalQuality?: number
  format: string
}

function toJpgExt(ext: string): string {
  return ext === 'jpeg' ? 'jpg' : ext
}

function safeExt(ext: string): CompressFormat {
  const e = ext.toLowerCase()
  if (e === 'jpg' || e === 'jpeg' || e === 'png' || e === 'webp' || e === 'avif') return e as CompressFormat
  return 'webp'
}

async function detectOutputFormat(inputPath: string, desired: CompressProcessorInput['outputFormat']): Promise<CompressFormat> {
  if (desired === 'jpg') return 'jpg'
  if (desired === 'jpeg') return 'jpeg'
  if (desired === 'png') return 'png'
  if (desired === 'webp') return 'webp'
  if (desired === 'avif') return 'avif'

  if (desired === 'original') {
    const ext = path.extname(inputPath).slice(1)
    return safeExt(toJpgExt(ext))
  }

  const meta = await sharp(inputPath, { animated: true, pages: -1, limitInputPixels: false }).metadata()
  if (meta.hasAlpha) return 'webp'
  return 'avif'
}

function encodeOnce(
  inputPath: string,
  format: CompressFormat,
  quality: number,
  mozjpeg: boolean,
): sharp.Sharp {
  const pipeline = sharp(inputPath, { animated: true, pages: -1, limitInputPixels: false })
  const q = clamp(quality, 1, 100)
  switch (format) {
    case 'jpg':
    case 'jpeg':
      return pipeline.jpeg(jpegEncodeOptions(q, mozjpeg))
    case 'webp':
      return pipeline.webp(webpEncodeOptions(q))
    case 'avif':
      return pipeline.avif(avifEncodeOptions(q))
    case 'png':
    default:
      return pipeline.png(pngEncodeOptions())
  }
}

export default async function compressOne(input: CompressProcessorInput): Promise<CompressProcessorOutput> {
  const beforeBytes = statSync(input.inputPath).size
  const mozjpeg = input.mozjpeg !== false
  const usePngquant = Boolean(input.usePngquant)

  const outputFormat = await detectOutputFormat(input.inputPath, input.outputFormat)

  const outDir = path.dirname(input.outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const previewDir = path.dirname(input.previewPath)
  if (!existsSync(previewDir)) mkdirSync(previewDir, { recursive: true })

  const targetBytes = input.targetSizeKb ? Math.max(1, Math.floor(input.targetSizeKb * 1024)) : undefined

  let currentQuality = clamp(input.quality ?? 90, 1, 100)
  let buffer: Buffer

  if (outputFormat === 'png') {
    buffer = await encodeOnce(input.inputPath, outputFormat, currentQuality, mozjpeg).toBuffer()
    await writePngOutput(buffer, input.outputPath, usePngquant)
    buffer = await sharp(input.outputPath).toBuffer()
  } else {
    buffer = await encodeOnce(input.inputPath, outputFormat, currentQuality, mozjpeg).toBuffer()
    while (targetBytes && buffer.byteLength > targetBytes) {
      currentQuality -= 5
      if (currentQuality <= 5) break
      buffer = await encodeOnce(input.inputPath, outputFormat, currentQuality, mozjpeg).toBuffer()
    }
    await sharp(buffer).toFile(input.outputPath)
  }

  const afterBytes = statSync(input.outputPath).size

  await sharp(input.outputPath, { animated: true, pages: -1, limitInputPixels: false })
    .resize(720, 720, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toFile(input.previewPath)

  return {
    outputPath: input.outputPath,
    previewPath: input.previewPath,
    beforeBytes,
    afterBytes,
    finalQuality: outputFormat === 'png' ? undefined : clamp(currentQuality, 1, 100),
    format: outputFormat,
  }
}
