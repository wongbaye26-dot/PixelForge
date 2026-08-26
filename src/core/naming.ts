import type { ExportFormat } from '@/types'

export interface NamingContext {
  name: string
  width: number
  height: number
  format: ExportFormat
  index: number
  ratioLabel?: string
}

const DEFAULT_PATTERN = '{name}_{size}.{format}'
const INVALID_FILENAME_RE = /[<>:"/\\|?*]/g
const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

export function sanitizeFilename(input: string): string {
  const withoutControlChars = Array.from(input || '', (char) => (char < ' ' ? '_' : char)).join('')
  const normalized = withoutControlChars
    .replace(INVALID_FILENAME_RE, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  const safeName = normalized || '未命名'
  return WINDOWS_RESERVED_NAMES.has(safeName.toUpperCase()) ? `${safeName}_` : safeName
}

export function applyNamingPattern(
  pattern: string,
  ctx: NamingContext,
): string {
  const size = `${ctx.width}x${ctx.height}`
  const ratio =
    ctx.ratioLabel ??
  (() => {
      const r = ctx.width / ctx.height
      return r >= 1 ? `${Math.round(r * 100) / 100}` : `${ctx.width}-${ctx.height}`
    })()

  let result = (pattern || DEFAULT_PATTERN)
    .replace(/\{name\}/g, ctx.name)
    .replace(/\{width\}/g, String(ctx.width))
    .replace(/\{height\}/g, String(ctx.height))
    .replace(/\{size\}/g, size)
    .replace(/\{format\}/g, ctx.format)
    .replace(/\{ratio\}/g, ratio)
    .replace(/\{index\}/g, String(ctx.index).padStart(3, '0'))

  if (!result.includes('.')) {
    result += `.${ctx.format}`
  }

  const dot = result.lastIndexOf('.')
  if (dot <= 0) return sanitizeFilename(result)
  const stem = sanitizeFilename(result.slice(0, dot))
  const ext = sanitizeFilename(result.slice(dot + 1))
  return ext ? `${stem}.${ext}` : stem
}

/** 自动重名：mountain_1920x1080_1.webp */
export function resolveUniquePath(
  basePath: string,
  exists: (p: string) => boolean,
): string {
  if (!exists(basePath)) return basePath
  const dot = basePath.lastIndexOf('.')
  const stem = dot >= 0 ? basePath.slice(0, dot) : basePath
  const ext = dot >= 0 ? basePath.slice(dot) : ''
  let n = 1
  while (exists(`${stem}_${n}${ext}`)) n++
  return `${stem}_${n}${ext}`
}
