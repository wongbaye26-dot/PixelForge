export interface SafeCanvas {
  width: number
  height: number
  padding: number
}

export function createSafeCanvas(
  baseWidth: number,
  baseHeight: number,
  opts: {
    shadowEnabled: boolean
    shadowBlur: number
    shadowOffsetX: number
    shadowOffsetY: number
  },
): SafeCanvas {
  const padding = opts.shadowEnabled
    ? Math.ceil(opts.shadowBlur * 2 + Math.max(Math.abs(opts.shadowOffsetX), Math.abs(opts.shadowOffsetY)))
    : 0
  return {
    width: baseWidth + padding * 2,
    height: baseHeight + padding * 2,
    padding,
  }
}

