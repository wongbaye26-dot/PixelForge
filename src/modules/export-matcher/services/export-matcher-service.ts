import {
  cancelAutoMatch,
  listAutoMatchJobs,
  previewAutoMatch,
  retryAutoMatch,
  submitAutoMatch,
  swapAutoMatchJob,
} from '../workers/export-matcher-worker'
import type { ExportMatcherSubmitPayload } from '../types'

export const exportMatcherService = {
  submit: submitAutoMatch,
  listJobs: listAutoMatchJobs,
  preview: previewAutoMatch,
  cancel: cancelAutoMatch,
  retry: retryAutoMatch,
  swap: swapAutoMatchJob,
}

export type { ExportMatcherSubmitPayload }
