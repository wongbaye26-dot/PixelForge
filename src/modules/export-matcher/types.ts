import type { ExportFormat, FitMode, ImageAsset } from '@/types'
import type { MatchScore, MatchDebugCandidate } from '@/core/match-scoring'

export type { MatchScore, MatchDebugCandidate }

export interface TargetSize {
  width: number
  height: number
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
  status: 'pending' | 'processing' | 'done' | 'error' | 'cancelled'
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
  scopeType?: 'all' | 'folder' | 'favorite' | 'recent'
  scopeId?: number
}

export interface ExportMatcherSubmitResult {
  batchId: string
  jobs: ExportMatcherJob[]
  unmatchedSizes: Array<{ width: number; height: number }>
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
