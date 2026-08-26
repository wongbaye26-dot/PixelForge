import { describe, expect, it } from 'vitest'
import { clamp } from './math'

describe('clamp', () => {
  it('returns n when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to min', () => {
    expect(clamp(-1, 0, 10)).toBe(0)
  })

  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('handles equal min and max', () => {
    expect(clamp(5, 3, 3)).toBe(3)
  })
})
