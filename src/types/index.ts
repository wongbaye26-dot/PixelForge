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
  thumbnailUrl?: string
  /** GIF 等动图预览（原文件或动画缩略图） */
  previewUrl?: string
}

/** PRD §3.2 — 尺寸解析结果 */
export interface ParsedSize {
  width: number
  height: number
  ratio: number
  ratioLabel: string
}

export type FitMode =
  | 'contain'
  | 'cover'
  | 'blur_extend'
  | 'gradient_fill'
  | 'ai_outpaint'

export type ExportFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'ico' | 'original'

export interface ExportSettings {
  sizes: ParsedSize[]
  formats: ExportFormat[]
  fitMode: FitMode
  quality: number
  targetSizeKb?: number
  namingPattern: string
  outputDir: string
}

export interface ExportJob {
  id: string
  assetId: number
  assetPath: string
  targetWidth: number
  targetHeight: number
  format: ExportFormat
  status: 'pending' | 'running' | 'done' | 'error'
  progress: number
  outputPath?: string
  error?: string
}

export interface ExportTaskSummary {
  total: number
  completed: number
  failed: number
  running: boolean
}

export interface LibraryFolder {
  id: number
  path: string
  label: string
}
