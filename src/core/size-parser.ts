import type { ParsedSize } from '@/types'

/** PRD §3.2 — /(\d+)\s*[xX×*]\s*(\d+)/ */
export const SIZE_REGEX = /(\d+)\s*[xX×*]\s*(\d+)/g

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
  ]
  for (const [target, label] of presets) {
    if (Math.abs(r - target) < 0.02) return label
  }
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const g = gcd(width, height)
  return `${width / g}-${height / g}`
}

export function parseSingleSize(text: string): ParsedSize | null {
  const match = text.trim().match(/^(\d+)\s*[xX×*]\s*(\d+)$/)
  if (!match) return null
  const width = parseInt(match[1], 10)
  const height = parseInt(match[2], 10)
  if (width <= 0 || height <= 0) return null
  return {
    width,
    height,
    ratio: width / height,
    ratioLabel: ratioLabel(width, height),
  }
}

/** 从多行/逗号分隔文本解析全部尺寸 */
export function parseSizeList(input: string): ParsedSize[] {
  const results: ParsedSize[] = []
  const seen = new Set<string>()
  const re = new RegExp(SIZE_REGEX.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) {
    const width = parseInt(m[1], 10)
    const height = parseInt(m[2], 10)
    const key = `${width}x${height}`
    if (seen.has(key) || width <= 0 || height <= 0) continue
    seen.add(key)
    results.push({
      width,
      height,
      ratio: width / height,
      ratioLabel: ratioLabel(width, height),
    })
  }
  return results
}
