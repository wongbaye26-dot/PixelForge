/** PRD §3.1 — 图片资产 */
export interface ImageAsset {
  id: number
  path: string
  filename: string
  width: number
  height: number
  ratio: number
  area?: number
  resolutionLevel?: number
  dominantColor?: string
  brightness?: number
  format: string
  size: number
  hash: string
  favorite?: boolean
  createdAt?: string
  thumbnailUrl?: string
  /** GIF 等动图预览（原文件或动画缩略图） */
  previewUrl?: string
  ocrText?: string
}

/** PRD §3.2 — 尺寸解析结果 */
export interface ParsedSize {
  width: number
  height: number
  ratio: number
  ratioLabel: string
  /** 行内注释，如「公众号头图」 */
  label?: string
}

export type FitMode =
  | 'contain'
  | 'cover'
  | 'blur_extend'
  | 'gradient_fill'
  | 'ai_outpaint'

export type ExportFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'ico' | 'original'

export interface LibraryFolder {
  id: number
  path: string
  label: string
}

export interface AssetScope {
  type: 'all' | 'folder' | 'favorite' | 'recent'
  id?: number
  name: string
}
