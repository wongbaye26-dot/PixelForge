import sharp from 'sharp'

export async function blurExtend(
  input: sharp.Sharp,
  width: number,
  height: number,
): Promise<Buffer> {
  const vignette = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="v" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
          <stop offset="70%" stop-color="rgba(0,0,0,0.08)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.38)"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>`,
  )

  const bg = await input
    .clone()
    .resize(width, height, { fit: 'cover' })
    .blur(52)
    .modulate({ brightness: 0.75, saturation: 0.88 })
    .composite([{ input: vignette }])
    .toBuffer()

  const fg = await input
    .clone()
    .resize({
      width,
      height,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()

  const fgMeta = await sharp(fg).metadata()
  const fw = fgMeta.width ?? width
  const fh = fgMeta.height ?? height
  const left = Math.round((width - fw) / 2)
  const top = Math.round((height - fh) / 2)

  const shadow = await sharp(fg)
    .ensureAlpha()
    .flatten({ background: { r: 0, g: 0, b: 0, alpha: 0.35 } })
    .blur(18)
    .toBuffer()

  return sharp(bg)
    .composite([
      { input: shadow, left: left + 0, top: top + 10 },
      { input: fg, left, top },
    ])
    .toBuffer()
}
