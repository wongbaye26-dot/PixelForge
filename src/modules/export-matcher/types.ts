import type { ExportFormat, FitMode, ImageAsset } from '@/types'

export interface TargetSize {
  width: number
  height: number
}

export interface FocalPoint {
  x: number
  y: number
}

export type BackgroundMode = 'solid' | 'gradient' | 'transparent'

export interface MatchScore {
  ratioScore: number
  sizeScore: number
  upscalePenalty: number
  oversizePenalty: number
  finalScore: number
}

export interface MatchDebugCandidate {
  imageId: number
  width: number
  height: number
  ratio: number
  area: number
  score: MatchScore
}

export interface MatchResult {
  imageId: number
  similarity: number
  targetRatio: number
  imageRatio: number
  recommendedMode: FitMode
}

export interface ExportMatcherJob {
  id: string
  batchId: string
  targetWidth: number
  targetHeight: number
  targetRatio: number
  imageId: number
  imageFilename: string
  imageRatio: number
  similarity: number
  recommendedMode: FitMode
  matchScore?: MatchScore
  debugCandidates?: MatchDebugCandidate[]
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: number
  outputPath?: string
  previewName?: string
  error?: string
}

export interface ExportMatcherSubmitPayload {
  sizes: TargetSize[]
  outputDir?: string
  format?: ExportFormat
  quality?: number
  targetSizeKb?: number
  namingPattern?: string
  autoRecommendMode?: boolean
  autoCompressOptimize?: boolean
  autoBackgroundOptimize?: boolean
  avoidUpscale?: boolean
  preferSlightDownscale?: boolean
  avoidOversize?: boolean
  highQualityFirst?: boolean
  debugMode?: boolean
  candidateAssetIds?: number[]
}

export interface ExportMatcherState {
  enabled: boolean
  autoPickBestImage: boolean
  autoRecommendMode: boolean
  autoCompressOptimize: boolean
  autoBackgroundOptimize: boolean
  avoidUpscale: boolean
  preferSlightDownscale: boolean
  avoidOversize: boolean
  highQualityFirst: boolean
  debugMode: boolean
  format: ExportFormat
  quality: number
  targetSizeKb?: number
  namingPattern: string
  batchId: string | null
  jobs: ExportMatcherJob[]
  polling: boolean
  loading: boolean
  previewing: boolean
  previewJobId: string | null
  previewName: string | null
  previewAsset: ImageAsset | null
}
