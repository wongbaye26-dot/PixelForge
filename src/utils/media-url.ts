import type { ImageAsset } from '@/types'

/** 将 Worker 相对资源路径转为可加载的完整 URL（Electron file:// 下必须用绝对地址） */
export function resolveMediaUrl(url?: string): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url

  const base =
    import.meta.env.VITE_WORKER_BASE ||
    (import.meta.env.VITE_API_BASE
      ? String(import.meta.env.VITE_API_BASE).replace(/\/api\/?$/, '')
      : '')

  if (!base) return url
  return `${base}${url.startsWith('/') ? url : `/${url}`}`
}

/** 图库卡片预览：GIF 优先用 previewUrl 保持动画 */
export function assetDisplayUrl(asset: Pick<ImageAsset, 'format' | 'previewUrl' | 'thumbnailUrl'>): string | undefined {
  const url =
    asset.format.toLowerCase() === 'gif'
      ? asset.previewUrl ?? asset.thumbnailUrl
      : asset.thumbnailUrl ?? asset.previewUrl
  return resolveMediaUrl(url)
}
