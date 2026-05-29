import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
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
      return pipeline.jpeg({ quality: q, mozjpeg })
    case 'webp':
      return pipeline.webp({ quality: q, effort: 4 })
    case 'avif':
      return pipeline.avif({ quality: q, effort: 4 })
    case 'png':
    default:
      return pipeline.png({ compressionLevel: 9 })
  }
}

function tryPngquant(inputPath: string, outputPath: string): boolean {
  const res = spawnSync('pngquant', ['--strip', '--speed', '1', '--force', '--output', outputPath, inputPath], {
    stdio: 'ignore',
  })
  return res.status === 0 && existsSync(outputPath)
}

export default async function compressOne(input: CompressProcessorInput): Promise<CompressProcessorOutput> {
  const beforeBytes = statSync(input.inputPath).size
  const mozjpeg = Boolean(input.mozjpeg)
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
    const base = await encodeOnce(input.inputPath, outputFormat, currentQuality, mozjpeg).toBuffer()
    if (targetBytes && usePngquant) {
      const tmp = `${input.outputPath}.tmp.png`
      await sharp(base).png({ compressionLevel: 9 }).toFile(tmp)
      const ok = tryPngquant(tmp, input.outputPath)
      if (!ok) await sharp(base).png({ compressionLevel: 9 }).toFile(input.outputPath)
    } else {
      await sharp(base).png({ compressionLevel: 9 }).toFile(input.outputPath)
    }
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
