/** PRD §3.6 — 高保真压缩策略（质量递减） */
export function computeQualitySteps(
  startQuality: number,
  minQuality = 50,
  step = 5,
): number[] {
  const steps: number[] = []
  for (let q = startQuality; q >= minQuality; q -= step) {
    steps.push(q)
  }
  return steps
}

export interface CompressPlan {
  qualities: number[]
  targetBytes?: number
}

export function planCompression(
  targetSizeKb?: number,
  startQuality = 95,
): CompressPlan {
  if (!targetSizeKb) {
    return { qualities: [startQuality] }
  }
  return {
    targetBytes: targetSizeKb * 1024,
    qualities: computeQualitySteps(startQuality),
  }
}
