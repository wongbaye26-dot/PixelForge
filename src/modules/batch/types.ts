import type { ImageAsset } from '@/types'

export type BatchFit = 'contain' | 'cover' | 'fill' | 'inside' | 'outside'
export type BatchFormat = 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'original'

export type BatchJobStatus = 'queued' | 'running' | 'done' | 'error'

export interface BatchResize {
  enabled: boolean
  width: number
  height: number
  fit: BatchFit
}

export interface BatchSettings {
  resize: BatchResize
  format: BatchFormat
  quality: number
  namingPattern: string
  outputDir: string
}

export interface BatchJob {
  id: string
  batchId: string
  assetId: number
  outputPath: string
  status: BatchJobStatus
  progress: number
  error?: string
}

export interface BatchItem extends ImageAsset {}

export interface BatchSubmitPayload {
  assetIds: number[]
  resize?: { width: number; height: number; fit?: BatchFit }
  format?: Exclude<BatchFormat, 'original'>
  quality?: number
  outputDir?: string
  namingPattern?: string
}
