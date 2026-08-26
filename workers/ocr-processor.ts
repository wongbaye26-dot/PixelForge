import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { preferredOcrEngine, runOcr, type OcrEngineName } from './ocr-engine.js'

export interface OcrProcessorInput {
  inputPath: string
  lang?: string
}

export interface OcrProcessorOutput {
  text: string
  engine: OcrEngineName | 'unavailable'
  error?: string
}

async function prepareImage(inputPath: string): Promise<string> {
  const tmp = path.join(tmpdir(), `pf-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.png`)
  await sharp(inputPath, { animated: false, pages: 1, limitInputPixels: false })
    .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(tmp)
  return tmp
}

export default async function ocrOne(input: OcrProcessorInput): Promise<OcrProcessorOutput> {
  if (!existsSync(input.inputPath)) {
    return { text: '', engine: 'unavailable', error: '未找到输入文件' }
  }

  const lang = (input.lang || 'chi_sim+eng').trim()
  let tmpPath: string | undefined

  try {
    tmpPath = await prepareImage(input.inputPath)
    const result = await runOcr(tmpPath, lang)
    if (result.error && !result.text) {
      return { text: '', engine: result.engine, error: result.error }
    }
    return { text: result.text, engine: result.engine }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { text: '', engine: preferredOcrEngine(), error: msg }
  } finally {
    if (tmpPath) {
      try {
        unlinkSync(tmpPath)
      } catch {
        /* ignore */
      }
    }
  }
}
