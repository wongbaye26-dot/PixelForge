import type { ImageAsset } from '@/types'

export function sortByRatio(images: ImageAsset[], targetRatio: number): ImageAsset[] {
  return [...images].sort((a, b) => {
    return Math.abs(a.ratio - targetRatio) - Math.abs(b.ratio - targetRatio)
  })
}

export function findBestMatch(
  images: ImageAsset[],
  targetWidth: number,
  targetHeight: number,
): ImageAsset | undefined {
  if (images.length === 0) return undefined
  const targetRatio = targetWidth / targetHeight

  const exact = images.find((img) => img.width === targetWidth && img.height === targetHeight)
  if (exact) return exact

  const ratioMatch = images.find(
    (img) => Math.abs(img.ratio - targetRatio) < 1e-6,
  )
  if (ratioMatch) return ratioMatch

  return sortByRatio(images, targetRatio)[0]
}

export function similarity(targetRatio: number, imageRatio: number): number {
  return Math.abs(targetRatio - imageRatio)
}
