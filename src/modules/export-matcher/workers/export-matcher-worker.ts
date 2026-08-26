import { api } from '@/api/client'
import type { FitMode } from '@/types'
import type { ExportMatcherJob, ExportMatcherSubmitPayload, ExportMatcherSubmitResult } from '../types'

function statusCast(v: string): ExportMatcherJob['status'] {
  if (v === 'pending' || v === 'processing' || v === 'done' || v === 'error' || v === 'cancelled') return v
  return 'pending'
}

function mapJob(j: Record<string, unknown>): ExportMatcherJob {
  return {
    id: String(j.id),
    batchId: String(j.batchId),
    targetWidth: Number(j.targetWidth),
    targetHeight: Number(j.targetHeight),
    targetRatio: Number(j.targetRatio),
    imageId: Number(j.imageId),
    imageFilename: String(j.imageFilename),
    imageRatio: Number(j.imageRatio),
    similarity: Number(j.similarity),
    recommendedMode: j.recommendedMode as FitMode,
    matchScore: j.matchScore as ExportMatcherJob['matchScore'],
    debugCandidates: j.debugCandidates as ExportMatcherJob['debugCandidates'],
    status: statusCast(String(j.status)),
    progress: Number(j.progress ?? 0),
    outputPath: j.outputPath ? String(j.outputPath) : undefined,
    previewName: j.previewName ? String(j.previewName) : undefined,
    error: j.error ? String(j.error) : undefined,
  }
}

export async function submitAutoMatch(payload: ExportMatcherSubmitPayload): Promise<ExportMatcherSubmitResult> {
  const r = await api.autoMatchSubmit(payload)
  return {
    batchId: r.batchId,
    jobs: r.jobs.map((j) => mapJob(j as unknown as Record<string, unknown>)),
    unmatchedSizes: r.unmatchedSizes ?? [],
  }
}

export async function listAutoMatchJobs(batchId: string): Promise<ExportMatcherJob[]> {
  const r = await api.autoMatchJobs(batchId)
  return r.jobs.map((j) => mapJob(j as unknown as Record<string, unknown>))
}

export async function previewAutoMatch(payload: {
  assetId: number
  targetWidth: number
  targetHeight: number
  mode: FitMode
}): Promise<{ previewName: string }> {
  return api.autoMatchPreview(payload)
}

export async function cancelAutoMatch(batchId: string, jobId?: string): Promise<ExportMatcherJob[]> {
  const r = await api.autoMatchCancel({ batchId, jobId })
  return (r.jobs ?? []).map((j) => mapJob(j))
}

export async function retryAutoMatch(batchId: string, jobId: string): Promise<ExportMatcherJob> {
  const r = await api.autoMatchRetry({ batchId, jobId })
  return mapJob(r.job)
}

export async function swapAutoMatchJob(
  batchId: string,
  jobId: string,
  assetId: number,
  options?: { autoRecommendMode?: boolean; autoBackgroundOptimize?: boolean },
): Promise<ExportMatcherJob> {
  const r = await api.autoMatchSwap({ batchId, jobId, assetId, ...options })
  return mapJob(r.job)
}
