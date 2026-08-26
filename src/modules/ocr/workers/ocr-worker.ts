import { api } from '@/api/client'
import type { OcrLang } from '../types'

export function submitOcrScan(assetIds: number[], lang: OcrLang) {
  return api.ocrScan({ assetIds, lang })
}

export function listOcrJobs(batchId: string) {
  return api.ocrJobs(batchId)
}

export function fetchOcrStatus() {
  return api.ocrStatus()
}
