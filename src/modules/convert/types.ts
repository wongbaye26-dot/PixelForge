import type { ImageAsset } from '@/types'

export type ConvertTargetFormat = 'png' | 'webp' | 'avif' | 'jpg' | 'jpeg'

export type ConvertJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export interface ConvertSettings {
  targetFormat: ConvertTargetFormat
  quality: number
  keepExif: boolean
  namingPattern: string
  outputDir: string
}

export interface ConvertJob {
  id: string
  batchId: string
  assetId: number
  status: ConvertJobStatus
  progress: number
  bytes?: number
  format?: string
  outputPath: string
  error?: string
}

export interface ConvertItem extends ImageAsset {}
