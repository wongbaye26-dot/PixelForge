import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const TESSERACT_CANDIDATES = [
  'tesseract',
  '/opt/homebrew/bin/tesseract',
  '/usr/local/bin/tesseract',
  '/opt/local/bin/tesseract',
]

let cachedCliPath: string | null | undefined

export function resolveTesseractCli(): string | null {
  if (cachedCliPath !== undefined) return cachedCliPath

  const pathEnv = process.env.PATH || ''
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue
    const candidate = path.join(dir, 'tesseract')
    if (existsSync(candidate)) {
      cachedCliPath = candidate
      return candidate
    }
  }

  for (const candidate of TESSERACT_CANDIDATES) {
    if (candidate === 'tesseract') continue
    if (existsSync(candidate)) {
      cachedCliPath = candidate
      return candidate
    }
  }

  const which = spawnSync('which', ['tesseract'], { encoding: 'utf8' })
  if (which.status === 0) {
    const resolved = which.stdout.trim()
    if (resolved && existsSync(resolved)) {
      cachedCliPath = resolved
      return resolved
    }
  }

  cachedCliPath = null
  return null
}

export function isTesseractCliAvailable(): boolean {
  const bin = resolveTesseractCli()
  if (!bin) return false
  const res = spawnSync(bin, ['--version'], { stdio: 'ignore' })
  return res.status === 0
}

export type OcrEngineName = 'tesseract-cli' | 'tesseract.js'

export interface OcrRunResult {
  text: string
  engine: OcrEngineName
  error?: string
}

export function preferredOcrEngine(): OcrEngineName {
  return isTesseractCliAvailable() ? 'tesseract-cli' : 'tesseract.js'
}

export async function runTesseractCli(imagePath: string, lang: string): Promise<OcrRunResult> {
  const bin = resolveTesseractCli()
  if (!bin) {
    return {
      text: '',
      engine: 'tesseract-cli',
      error: '未检测到 tesseract 命令',
    }
  }

  const res = spawnSync(bin, [imagePath, 'stdout', '-l', lang, '--psm', '3'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })

  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || 'Tesseract 识别失败').toString().trim()
    return { text: '', engine: 'tesseract-cli', error: err }
  }

  return { text: (res.stdout || '').trim(), engine: 'tesseract-cli' }
}

export async function runTesseractJs(imagePath: string, lang: string): Promise<OcrRunResult> {
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker(lang)
    try {
      const image = await readFile(imagePath)
      const result = await worker.recognize(image)
      return {
        text: (result.data.text || '').trim(),
        engine: 'tesseract.js',
      }
    } finally {
      await worker.terminate()
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      text: '',
      engine: 'tesseract.js',
      error: `内置 OCR 引擎失败：${msg}`,
    }
  }
}

export async function runOcr(imagePath: string, lang: string): Promise<OcrRunResult> {
  if (isTesseractCliAvailable()) {
    const cli = await runTesseractCli(imagePath, lang)
    if (!cli.error || cli.text) return cli
    const fallback = await runTesseractJs(imagePath, lang)
    if (fallback.text) return fallback
    return cli
  }
  return runTesseractJs(imagePath, lang)
}
