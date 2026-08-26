import { existsSync, statSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { clamp } from './utils.js'

export function jpegEncodeOptions(quality: number, mozjpeg = true) {
  return { quality: clamp(quality, 1, 100), mozjpeg: Boolean(mozjpeg) }
}

export function webpEncodeOptions(quality: number) {
  const q = clamp(quality, 1, 100)
  return { quality: q, effort: q >= 85 ? 5 : 4 }
}

/** Tuned AVIF params — higher effort for high quality, 4:2:0 chroma for size */
export function avifEncodeOptions(quality: number) {
  const q = clamp(quality, 1, 100)
  return {
    quality: q,
    effort: q >= 90 ? 7 : q >= 75 ? 6 : q >= 55 ? 5 : 4,
    chromaSubsampling: '4:2:0' as const,
  }
}

export function pngEncodeOptions() {
  return { compressionLevel: 9 as const }
}

export function tryPngquant(inputPath: string, outputPath: string): boolean {
  const res = spawnSync(
    'pngquant',
    ['--strip', '--speed', '1', '--force', '--output', outputPath, inputPath],
    { stdio: 'ignore' },
  )
  return res.status === 0 && existsSync(outputPath)
}

export async function writePngOutput(
  buffer: Buffer,
  outputPath: string,
  usePngquant: boolean,
): Promise<void> {
  const tmpPath = `${outputPath}.prequant.png`
  await sharp(buffer).png(pngEncodeOptions()).toFile(tmpPath)

  if (usePngquant && tryPngquant(tmpPath, outputPath)) {
    const quantSize = statSync(outputPath).size
    const sharpSize = statSync(tmpPath).size
    if (quantSize <= sharpSize) {
      try {
        unlinkSync(tmpPath)
      } catch {
        /* ignore */
      }
      return
    }
  }

  await sharp(buffer).png(pngEncodeOptions()).toFile(outputPath)
  try {
    unlinkSync(tmpPath)
  } catch {
    /* ignore */
  }
}
