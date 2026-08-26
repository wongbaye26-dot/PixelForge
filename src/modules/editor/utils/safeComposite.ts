import sharp, { type OverlayOptions, type Sharp } from 'sharp'

export async function safeComposite(baseSharp: Sharp, overlayBuffer: Buffer, options: OverlayOptions) {
  const baseMeta = await baseSharp.metadata()
  const baseW = baseMeta.width ?? 0
  const baseH = (baseMeta.pageHeight ?? baseMeta.height) ?? 0
  if (!baseW || !baseH) {
    return baseSharp.composite([{ input: overlayBuffer, ...options }])
  }

  const overlayMeta = await sharp(overlayBuffer, { limitInputPixels: false }).metadata()
  const overlayW = overlayMeta.width ?? 0
  const overlayH = (overlayMeta.pageHeight ?? overlayMeta.height) ?? 0

  let finalOverlay = overlayBuffer
  if (overlayW > baseW || overlayH > baseH) {
    finalOverlay = await sharp(overlayBuffer, { limitInputPixels: false })
      .resize({
        width: Math.min(overlayW || baseW, baseW),
        height: Math.min(overlayH || baseH, baseH),
        fit: 'inside',
      })
      .toBuffer()
  }

  return baseSharp.composite([{ input: finalOverlay, ...options }])
}

