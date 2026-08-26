import { existsSync } from 'node:fs'
import { localBlurOutpaintToFile } from './outpaint-local.js'

const DEFAULT_SIDECAR_URL = 'http://127.0.0.1:3848/outpaint'
const SIDECAR_TIMEOUT_MS = 90_000

export type OutpaintResult = {
  outputPath: string
  engine: 'sidecar' | 'local_blur'
  error?: string
}

export async function runOutpaint(opts: {
  inputPath: string
  outputPath: string
  width: number
  height: number
  sidecarUrl?: string
}): Promise<OutpaintResult> {
  const sidecarUrl = (opts.sidecarUrl || DEFAULT_SIDECAR_URL).trim()

  if (sidecarUrl) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS)
      const res = await fetch(sidecarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputPath: opts.inputPath,
          outputPath: opts.outputPath,
          width: opts.width,
          height: opts.height,
        }),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { outputPath?: string }
        const out = data.outputPath || opts.outputPath
        if (existsSync(out)) {
          return { outputPath: out, engine: 'sidecar' }
        }
      }
    } catch {
      /* fall through to local */
    }
  }

  await localBlurOutpaintToFile(opts.inputPath, opts.outputPath, opts.width, opts.height)
  return { outputPath: opts.outputPath, engine: 'local_blur' }
}

export async function pingSidecar(sidecarUrl?: string): Promise<{ ok: boolean; url: string }> {
  const url = (sidecarUrl || DEFAULT_SIDECAR_URL).replace(/\/outpaint\/?$/, '/health')
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return { ok: res.ok, url }
  } catch {
    return { ok: false, url }
  }
}
