import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function runFfmpegGifToWebp(inputPath: string, outputPath: string, quality: number): void {
  const q = clamp(quality, 1, 100)
  const ff = spawnSync(
    'ffmpeg',
    ['-y', '-i', inputPath, '-vcodec', 'libwebp', '-q:v', String(q), '-loop', '0', outputPath],
    { stdio: 'ignore' },
  )
  if (ff.status !== 0 || !existsSync(outputPath)) {
    throw new Error('ffmpeg convert failed')
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
      pipeline = pipeline.png({ compressionLevel: 9 })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality: q, effort: 4 })
      break
    case 'avif':
      pipeline = pipeline.avif({ quality: q, effort: 4 })
      break
    case 'jpg':
    case 'jpeg':
    default:
      pipeline = pipeline.jpeg({ quality: q, mozjpeg: true })
      break
  }

  const { size, format, width, height } = await pipeline.toFile(input.outputPath)
  return { outputPath: input.outputPath, bytes: size, format: format ?? target, width, height }
}
