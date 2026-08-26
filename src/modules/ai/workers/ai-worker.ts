import { api } from '@/api/client'
import type { AiParams } from '../types'

export function requestAiPreview(assetId: number, params: Pick<AiParams, 'width' | 'height'>) {
  return api.aiPreview({ assetId, ...params })
}

export function requestAiExport(assetIds: number[], params: Pick<AiParams, 'width' | 'height' | 'sidecarUrl'>) {
  return api.aiExport({ assetIds, ...params })
}

export async function fetchAiStatus() {
  return api.aiStatus()
}
