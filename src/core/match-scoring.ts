export type MatchScore = {
  ratioScore: number
  sizeScore: number
  upscalePenalty: number
  oversizePenalty: number
  finalScore: number
}

export type MatchDebugCandidate = {
  imageId: number
  width: number
  height: number
  ratio: number
  area: number
  score: MatchScore
}

export type MatchStrategy = {
  avoidUpscale: boolean
  preferSlightDownscale: boolean
  avoidOversize: boolean
  highQualityFirst: boolean
}

export type MatchCandidate = {
  id: number
  path: string
  filename: string
  ratio: number
  width: number
  height: number
  area: number
}

export type MatchTarget = {
  width: number
  height: number
  ratio: number
  area: number
}

export function calculateMatchScore(
  image: { ratio: number; width: number; height: number; area: number },
  target: { ratio: number; width: number; height: number; area: number },
  strategy: MatchStrategy,
): MatchScore {
  const ratioDiff = Math.abs(image.ratio - target.ratio)
  const widthDiff = Math.abs(target.width - image.width)
  const heightDiff = Math.abs(target.height - image.height)
  const sizeDiff = (widthDiff + heightDiff) / 2

  let upscalePenalty = 0
  const needsUpscale = image.width < target.width || image.height < target.height
  if (strategy.avoidUpscale && needsUpscale) upscalePenalty += 1000

  const scaleRatio = image.area / target.area
  let oversizePenalty = 0
  if (strategy.avoidOversize && scaleRatio > 5) {
    oversizePenalty += scaleRatio * 10
  } else if (strategy.preferSlightDownscale && scaleRatio > 3) {
    oversizePenalty += (scaleRatio - 3) * 5
  }

  let ratioPenalty = 0
  if (ratioDiff > 0.15) {
    ratioPenalty += (ratioDiff - 0.15) * 1000
  }

  const ratioWeight = 0.65
  const sizeWeight = 0.35
  const finalScore =
    ratioDiff * ratioWeight + sizeDiff * sizeWeight + upscalePenalty + oversizePenalty + ratioPenalty

  return {
    ratioScore: ratioDiff,
    sizeScore: sizeDiff,
    upscalePenalty,
    oversizePenalty,
    finalScore,
  }
}

export function bestCandidateForTarget(
  candidates: MatchCandidate[],
  target: MatchTarget,
  used: Set<number>,
  strategy: MatchStrategy,
): { best: MatchDebugCandidate | null; debug: MatchDebugCandidate[] } {
  const scored: MatchDebugCandidate[] = []
  for (const c of candidates) {
    if (used.has(c.id)) continue
    const score = calculateMatchScore(
      { ratio: c.ratio, width: c.width, height: c.height, area: c.area },
      target,
      strategy,
    )
    scored.push({
      imageId: c.id,
      width: c.width,
      height: c.height,
      ratio: c.ratio,
      area: c.area,
      score,
    })
  }

  const hasNoUpscale = scored.some((s) => s.width >= target.width && s.height >= target.height)
  const filtered =
    strategy.highQualityFirst && hasNoUpscale
      ? scored.filter((s) => s.width >= target.width && s.height >= target.height)
      : scored

  filtered.sort((a, b) => a.score.finalScore - b.score.finalScore)
  return { best: filtered[0] ?? null, debug: filtered.slice(0, 8) }
}

export function findBestMatchCandidate(
  candidates: MatchCandidate[],
  targetWidth: number,
  targetHeight: number,
  strategy: Partial<MatchStrategy> = {},
): MatchCandidate | undefined {
  if (!candidates.length) return undefined
  const fullStrategy: MatchStrategy = {
    avoidUpscale: strategy.avoidUpscale ?? true,
    preferSlightDownscale: strategy.preferSlightDownscale ?? true,
    avoidOversize: strategy.avoidOversize ?? true,
    highQualityFirst: strategy.highQualityFirst ?? true,
  }
  const targetRatio = targetWidth / targetHeight
  const target: MatchTarget = {
    width: targetWidth,
    height: targetHeight,
    ratio: targetRatio,
    area: targetWidth * targetHeight,
  }
  const exact = candidates.find((c) => c.width === targetWidth && c.height === targetHeight)
  if (exact) return exact
  const { best } = bestCandidateForTarget(candidates, target, new Set(), fullStrategy)
  if (!best) return undefined
  return candidates.find((c) => c.id === best.imageId)
}
