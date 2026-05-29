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
  return result
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
