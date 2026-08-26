export function ratioSimilarity(targetRatio: number, imageRatio: number): number {
  return Math.abs(targetRatio - imageRatio)
}

export function ratioDiffToPercent(ratioDiff: number): number {
  const pct = 100 - Math.min(100, Math.max(0, Math.round(ratioDiff * 100)))
  return Math.max(0, pct)
}

export function ratioMatchPercent(targetRatio: number, imageRatio: number): number {
  return ratioDiffToPercent(ratioSimilarity(targetRatio, imageRatio))
}
