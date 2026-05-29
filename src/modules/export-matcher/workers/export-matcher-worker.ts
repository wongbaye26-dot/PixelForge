import { api } from '@/api/client'
import type { FitMode } from '@/types'
import type { ExportMatcherJob, ExportMatcherSubmitPayload } from '../types'

function statusCast(v: string): ExportMatcherJob['status'] {
  if (v === 'pending' || v === 'processing' || v === 'done' || v === 'error') return v
  return 'pending'
}

export async function submitAutoMatch(payload: ExportMatcherSubmitPayload): Promise<{
  batchId: string
  jobs: ExportMatcherJob[]
}> {
  const r = await api.autoMatchSubmit(payload)
  return {
    batchId: r.batchId,
    jobs: r.jobs.map((j) => ({
      id: j.id,
      batchId: j.batchId,
      targetWidth: j.targetWidth,
      targetHeight: j.targetHeight,
      targetRatio: j.targetRatio,
      imageId: j.imageId,
      imageFilename: j.imageFilename,
      imageRatio: j.imageRatio,
      similarity: j.similarity,
      recommendedMode: j.recommendedMode,
      matchScore: j.matchScore,
      debugCandidates: j.debugCandidates,
      status: statusCast(j.status),
      progress: j.progress,
      outputPath: j.outputPath,
      previewName: j.previewName,
      error: j.error,
    })),
  }
}

export async function listAutoMatchJobs(batchId: string): Promise<ExportMatcherJob[]> {
  const r = await api.autoMatchJobs(batchId)
  return r.jobs.map((j) => ({
    id: j.id,
    batchId: j.batchId,
    targetWidth: j.targetWidth,
    targetHeight: j.targetHeight,
    targetRatio: j.targetRatio,
    imageId: j.imageId,
    imageFilename: j.imageFilename,
    imageRatio: j.imageRatio,
    similarity: j.similarity,
    recommendedMode: j.recommendedMode,
    matchScore: j.matchScore,
    debugCandidates: j.debugCandidates,
    status: statusCast(j.status),
    progress: j.progress,
    outputPath: j.outputPath,
    previewName: j.previewName,
    error: j.error,
  }))
}

export async function previewAutoMatch(payload: {
  assetId: number
  targetWidth: number
  targetHeight: number
  mode: FitMode
}): Promise<{ previewName: string }> {
  return api.autoMatchPreview(payload)
}
