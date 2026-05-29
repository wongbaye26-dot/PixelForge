import { ratioMatchPercent } from '../algorithms/ratio-match'

export function formatRatioMatchPercent(targetRatio: number, imageRatio: number): string {
  return `${ratioMatchPercent(targetRatio, imageRatio)}%`
}
