import type { ImageAsset } from '@/types'

export type CompressOutputFormat = 'auto' | 'original' | 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif'

export type CompressJobStatus = 'queued' | 'running' | 'done' | 'error'

export interface CompressSettings {
  outputFormat: CompressOutputFormat
  quality: number
  targetSizeKb?: number
  mozjpeg: boolean
  usePngquant: boolean
  namingPattern: string
  outputDir: string
}

export interface CompressJob {
  id: string
  batchId: string
  assetId: number
  status: CompressJobStatus
  progress: number
  beforeBytes: number
  afterBytes: number
  finalQuality?: number
  format: string
  previewName?: string
  outputPath: string
  error?: string
}

export interface CompressItem extends ImageAsset {}
