import { describe, expect, it } from 'vitest'
import { bestCandidateForTarget, calculateMatchScore, findBestMatchCandidate } from './match-scoring'

const strategy = {
  avoidUpscale: true,
  preferSlightDownscale: true,
  avoidOversize: true,
  highQualityFirst: true,
}

describe('calculateMatchScore', () => {
  it('prefers exact ratio match over distant ratio', () => {
    const target = { ratio: 16 / 9, width: 1920, height: 1080, area: 1920 * 1080 }
    const close = calculateMatchScore(
      { ratio: 16 / 9, width: 1600, height: 900, area: 1600 * 900 },
      target,
      strategy,
    )
    const far = calculateMatchScore(
      { ratio: 1, width: 1080, height: 1080, area: 1080 * 1080 },
      target,
      strategy,
    )
    expect(close.finalScore).toBeLessThan(far.finalScore)
  })

  it('penalizes upscale when avoidUpscale is enabled', () => {
    const target = { ratio: 1, width: 2000, height: 2000, area: 2000 * 2000 }
    const small = calculateMatchScore(
      { ratio: 1, width: 800, height: 800, area: 800 * 800 },
      target,
      strategy,
    )
    const large = calculateMatchScore(
      { ratio: 1, width: 2400, height: 2400, area: 2400 * 2400 },
      target,
      strategy,
    )
    expect(small.upscalePenalty).toBeGreaterThan(0)
    expect(large.upscalePenalty).toBe(0)
    expect(large.finalScore).toBeLessThan(small.finalScore)
  })
})

describe('bestCandidateForTarget', () => {
  it('skips already used images', () => {
    const candidates = [
      { id: 1, path: '/a.jpg', filename: 'a.jpg', ratio: 1, width: 1000, height: 1000, area: 1_000_000 },
      { id: 2, path: '/b.jpg', filename: 'b.jpg', ratio: 1, width: 900, height: 900, area: 810_000 },
    ]
    const target = { width: 1000, height: 1000, ratio: 1, area: 1_000_000 }
    const used = new Set([1])
    const { best } = bestCandidateForTarget(candidates, target, used, strategy)
    expect(best?.imageId).toBe(2)
  })
})

describe('findBestMatchCandidate', () => {
  it('returns exact dimension match when available', () => {
    const candidates = [
      { id: 1, path: '/a.jpg', filename: 'a.jpg', ratio: 16 / 9, width: 1920, height: 1080, area: 1920 * 1080 },
      { id: 2, path: '/b.jpg', filename: 'b.jpg', ratio: 1, width: 1080, height: 1080, area: 1080 * 1080 },
    ]
    const best = findBestMatchCandidate(candidates, 1920, 1080, strategy)
    expect(best?.id).toBe(1)
  })
})
