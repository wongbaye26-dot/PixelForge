import { describe, expect, it } from 'vitest'
import { sanitizeFilename, applyNamingPattern, resolveUniquePath } from './naming'

describe('sanitizeFilename', () => {
  it('replaces invalid characters', () => {
    expect(sanitizeFilename('a<b>c"d')).toBe('a_b_c_d')
  })

  it('collapses multiple underscores', () => {
    expect(sanitizeFilename('a___b')).toBe('a_b')
  })

  it('trims trailing dots and spaces', () => {
    expect(sanitizeFilename('file... ')).toBe('file')
  })

  it('returns 未命名 for empty input', () => {
    expect(sanitizeFilename('')).toBe('未命名')
    expect(sanitizeFilename('   ')).toBe('未命名')
  })

  it('appends underscore to Windows reserved names', () => {
    expect(sanitizeFilename('CON')).toBe('CON_')
    expect(sanitizeFilename('lpt1')).toBe('lpt1_')
  })
})

describe('applyNamingPattern', () => {
  const ctx = { name: 'mountain', width: 1920, height: 1080, format: 'webp' as const, index: 1 }

  it('applies default pattern when empty', () => {
    expect(applyNamingPattern('', ctx)).toBe('mountain_1920x1080.webp')
  })

  it('replaces {name}, {size}, {format}', () => {
    expect(applyNamingPattern('{name}_{size}.{format}', ctx)).toBe('mountain_1920x1080.webp')
  })

  it('replaces {index} with zero-padded number', () => {
    expect(applyNamingPattern('{name}_{index}.{format}', { ...ctx, index: 5 })).toBe('mountain_005.webp')
  })

  it('adds format extension if missing', () => {
    expect(applyNamingPattern('{name}_{size}', ctx)).toBe('mountain_1920x1080.webp')
  })

  it('uses ratioLabel when provided', () => {
    expect(applyNamingPattern('{name}_{ratio}', { ...ctx, ratioLabel: '16:9' })).toBe('mountain_16_9.webp')
  })
})

describe('resolveUniquePath', () => {
  it('returns basePath if no conflict', () => {
    const exists = () => false
    expect(resolveUniquePath('/out/file.webp', exists)).toBe('/out/file.webp')
  })

  it('appends _1, _2 etc on conflict', () => {
    const existing = new Set(['/out/file.webp', '/out/file_1.webp'])
    const exists = (p: string) => existing.has(p)
    expect(resolveUniquePath('/out/file.webp', exists)).toBe('/out/file_2.webp')
  })
})
