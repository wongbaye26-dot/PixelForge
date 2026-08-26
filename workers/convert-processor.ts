import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { clamp } from './utils.js'
import { avifEncodeOptions, jpegEncodeOptions, pngEncodeOptions, webpEncodeOptions } from './encode-utils.js'

export type ConvertTargetFormat = 'png' | 'webp' | 'avif' | 'jpg' | 'jpeg'

export interface ConvertProcessorInput {
  inputPath: string
  outputPath: string
  targetFormat: ConvertTargetFormat
  quality: number
  keepExif: boolean
}

export interface ConvertProcessorOutput {
  outputPath: string
  bytes: number
  format: string
  width?: number
  height?: number
}

function runFfmpegGifToWebp(inputPath: string, outputPath: string, quality: number): void {
  const q = clamp(quality, 1, 100)
  const ff = spawnSync(
    'ffmpeg',
    ['-y', '-i', inputPath, '-vcodec', 'libwebp', '-q:v', String(q), '-loop', '0', outputPath],
    { stdio: 'ignore' },
  )
  if (ff.status !== 0 || !existsSync(outputPath)) {
    throw new Error('FFmpeg 转换失败')
  }
}

export default async function convertOne(input: ConvertProcessorInput): Promise<ConvertProcessorOutput> {
  const outDir = path.dirname(input.outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const ext = path.extname(input.inputPath).toLowerCase()
  const isGif = ext === '.gif'
  const target = input.targetFormat

  if (isGif && target === 'webp') {
    runFfmpegGifToWebp(input.inputPath, input.outputPath, input.quality)
    const st = statSync(input.outputPath)
    return { outputPath: input.outputPath, bytes: st.size, format: 'webp' }
  }

  const q = clamp(input.quality, 1, 100)
  let pipeline = sharp(input.inputPath, { animated: true, pages: -1, limitInputPixels: false })
  if (input.keepExif) pipeline = pipeline.withMetadata()

  switch (target) {
    case 'png':
      pipeline = pipeline.png(pngEncodeOptions())
      break
    case 'webp':
      pipeline = pipeline.webp(webpEncodeOptions(q))
      break
    case 'avif':
      pipeline = pipeline.avif(avifEncodeOptions(q))
      break
    case 'jpg':
    case 'jpeg':
    default:
      pipeline = pipeline.jpeg(jpegEncodeOptions(q, true))
      break
  }

  const { size, format, width, height } = await pipeline.toFile(input.outputPath)
  return { outputPath: input.outputPath, bytes: size, format: format ?? target, width, height }
}
