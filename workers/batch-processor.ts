import path from 'node:path'
import sharp from 'sharp'
import { avifEncodeOptions, jpegEncodeOptions, pngEncodeOptions, webpEncodeOptions } from './encode-utils.js'

export type BatchFit = 'contain' | 'cover' | 'fill' | 'inside' | 'outside'

export type BatchFormat = 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'

export interface BatchProcessorInput {
  inputPath: string
  outputPath: string
  resize?: { width: number; height: number; fit?: BatchFit }
  format?: BatchFormat
  quality?: number
}

export interface BatchProcessorOutput {
  outputPath: string
  bytes: number
  format: string
  width?: number
  height?: number
}

export default async function processOne(input: BatchProcessorInput): Promise<BatchProcessorOutput> {
  const { inputPath, outputPath, resize, format, quality } = input

  let pipeline = sharp(inputPath, { animated: true, pages: -1, limitInputPixels: false })

  if (resize && resize.width > 0 && resize.height > 0) {
    pipeline = pipeline.resize(resize.width, resize.height, {
      fit: resize.fit ?? 'contain',
      withoutEnlargement: true,
    })
  }

  const outExt = (format ?? path.extname(outputPath).slice(1)).toLowerCase() as BatchFormat
  const q = Math.max(1, Math.min(100, quality ?? 90))

  switch (outExt) {
    case 'jpg':
    case 'jpeg':
      pipeline = pipeline.jpeg(jpegEncodeOptions(q, true))
      break
    case 'png':
      pipeline = pipeline.png(pngEncodeOptions())
      break
    case 'webp':
      pipeline = pipeline.webp(webpEncodeOptions(q))
      break
    case 'avif':
      pipeline = pipeline.avif(avifEncodeOptions(q))
      break
    case 'gif':
      pipeline = pipeline.gif({ effort: 7, loop: 0 })
      break
    default:
      pipeline = pipeline.webp({ quality: q, effort: 4 })
      break
  }

  const { size, format: outFormat, width, height } = await pipeline.toFile(outputPath)
  return {
    outputPath,
    bytes: size,
    format: outFormat ?? outExt,
    width,
    height,
  }
}
