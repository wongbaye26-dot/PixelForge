import { existsSync } from 'node:fs'
import path from 'node:path'

declare const __dirname: string | undefined
const RUNTIME_DIR = typeof __dirname === 'string' ? __dirname : process.cwd()

export function resolveWorkerFile(name: string): string | null {
  const candidates = [
    path.join(RUNTIME_DIR, `${name}-processor.cjs`),
    path.join(RUNTIME_DIR, '..', 'electron-dist', `${name}-processor.cjs`),
    path.join(process.cwd(), 'electron-dist', `${name}-processor.cjs`),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}
