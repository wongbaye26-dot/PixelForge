import type { ParsedSize } from '@/types'

/** 从文本中提取 WxH（支持 x / X / × / * / 全角＊） */
export const SIZE_TOKEN_REGEX = /(\d{2,5})\s*[xX×*＊]\s*(\d{2,5})/

const SIZE_LINE_REGEX =
  /^(\d{2,5})\s*[xX×*＊]\s*(\d{2,5})(?:\s*(?:#\s*|\/\/\s*|--\s+|-\s+)(.+))?$/

const KNOWN_RATIO_LABELS: Record<string, string> = {
  '16-9': '16:9',
  '9-16': '9:16',
  '4-3': '4:3',
  '3-4': '3:4',
  '1-1': '1:1',
  '3-2': '3:2',
  '2-3': '2:3',
  '21-9': '21:9',
}

function ratioLabel(width: number, height: number): string {
  const r = width / height
  const presets: [number, string][] = [
    [16 / 9, '16-9'],
    [9 / 16, '9-16'],
    [4 / 3, '4-3'],
    [3 / 4, '3-4'],
    [1, '1-1'],
    [3 / 2, '3-2'],
    [2 / 3, '2-3'],
    [21 / 9, '21-9'],
  ]
  for (const [target, label] of presets) {
    if (Math.abs(r - target) < 0.02) return label
  }
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const g = gcd(width, height)
  return `${width / g}-${height / g}`
}

function buildParsedSize(width: number, height: number, label?: string): ParsedSize {
  const parsed: ParsedSize = {
    width,
    height,
    ratio: width / height,
    ratioLabel: ratioLabel(width, height),
  }
  const trimmed = label?.trim()
  if (trimmed) parsed.label = trimmed
  return parsed
}

function isReasonableSize(width: number, height: number) {
  return width >= 16 && height >= 16 && width <= 20000 && height <= 20000
}

function extractLabelRemainder(text: string, endIndex: number) {
  const tail = text.slice(endIndex).trim().replace(/^[,.，、;；]+/, '').trim()
  if (!tail || /^\d/.test(tail)) return undefined
  return tail
}

function parseToken(token: string): ParsedSize | null {
  const trimmed = token.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const strict = trimmed.match(SIZE_LINE_REGEX)
  if (strict) {
    const width = parseInt(strict[1], 10)
    const height = parseInt(strict[2], 10)
    if (!isReasonableSize(width, height)) return null
    return buildParsedSize(width, height, strict[3] ?? strict[4])
  }

  const loose = SIZE_TOKEN_REGEX.exec(trimmed)
  if (!loose || loose.index === undefined) return null
  const width = parseInt(loose[1], 10)
  const height = parseInt(loose[2], 10)
  if (!isReasonableSize(width, height)) return null
  const label = extractLabelRemainder(trimmed, loose.index + loose[0].length)
  return buildParsedSize(width, height, label)
}

export function parseSingleSize(text: string): ParsedSize | null {
  return parseToken(text)
}

/** 从多行 / 逗号分隔文本解析尺寸（忽略纯文案行，支持行内备注） */
export function parseSizeList(input: string): ParsedSize[] {
  const results: ParsedSize[] = []
  const seen = new Set<string>()

  const tokens = input
    .split(/[\n\r]+/)
    .flatMap((line) => line.split(/[,，;；]+/))
    .map((part) => part.trim())
    .filter(Boolean)

  for (const token of tokens) {
    const parsed = parseToken(token)
    if (!parsed) continue
    const key = `${parsed.width}x${parsed.height}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(parsed)
  }

  return results
}

export function formatKnownRatio(ratioLabel: string) {
  return KNOWN_RATIO_LABELS[ratioLabel] ?? ratioLabel.replace('-', ':')
}

export function sizeDisplayTitle(size: ParsedSize) {
  return `${size.width} × ${size.height}`
}

export function sizeDisplayDesc(size: ParsedSize, fallback = '点击启用') {
  if (size.label?.trim()) return size.label.trim()
  return fallback
}

export function sizeDisplayTag(size: ParsedSize) {
  return formatKnownRatio(size.ratioLabel)
}

export function sizeCardPresentation(size: ParsedSize, fallbackDesc = '点击启用') {
  const dimension = sizeDisplayTitle(size)
  const ratio = sizeDisplayTag(size)
  if (size.label?.trim()) {
    return {
      tag: dimension,
      title: size.label.trim(),
      desc: ratio,
    }
  }
  return {
    tag: ratio,
    title: dimension,
    desc: fallbackDesc,
  }
}
