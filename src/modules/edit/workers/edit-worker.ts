import { api } from '@/api/client'
import type { EditParams } from '../types'

export async function requestEditPreview(assetId: number, params: Partial<EditParams>) {
  return api.editPreview({ assetId, params })
}

export async function requestEditExport(assetIds: number[], params: Partial<EditParams>, outputDir?: string) {
  return api.editExport({ assetIds, params, outputDir })
}

