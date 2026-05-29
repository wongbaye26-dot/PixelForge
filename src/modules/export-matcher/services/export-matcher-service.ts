import type { FitMode } from '@/types'
import type { ExportMatcherJob, ExportMatcherSubmitPayload } from '../types'
import { listAutoMatchJobs, previewAutoMatch, submitAutoMatch } from '../workers/export-matcher-worker'

export const exportMatcherService = {
  submit: (payload: ExportMatcherSubmitPayload) => submitAutoMatch(payload),
  listJobs: (batchId: string): Promise<ExportMatcherJob[]> => listAutoMatchJobs(batchId),
  preview: (payload: { assetId: number; targetWidth: number; targetHeight: number; mode: FitMode }) =>
    previewAutoMatch(payload),
}

