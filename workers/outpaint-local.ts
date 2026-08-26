import sharp from 'sharp'
import { blurExtend } from './blur-extend.js'

function openSource(inputPath: string) {
  return sharp(inputPath, { animated: false, pages: 1, limitInputPixels: false })
}

export async function localBlurOutpaint(inputPath: string, width: number, height: number): Promise<Buffer> {
  const input = openSource(inputPath)
  return blurExtend(input, width, height)
}

export async function localBlurOutpaintToFile(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
): Promise<void> {
  const buffer = await localBlurOutpaint(inputPath, width, height)
  await sharp(buffer).toFile(outputPath)
}
