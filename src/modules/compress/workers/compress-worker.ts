import { api } from '@/api/client'
import type { CompressJob, CompressOutputFormat } from '../types'

export async function submitCompress(payload: {
  assetIds: number[]
  outputFormat?: CompressOutputFormat
  quality: number
  targetSizeKb?: number
  mozjpeg?: boolean
  usePngquant?: boolean
  outputDir?: string
  namingPattern?: string
}): Promise<{ batchId: string; jobIds: string[] }> {
  const r = await api.compressSubmit(payload)
  return { batchId: r.batchId, jobIds: r.jobIds }
}

export async function listCompressJobs(batchId: string): Promise<CompressJob[]> {
  const r = await api.compressJobs({ batchId })
  return r.jobs.map((j) => ({
    id: j.id,
    batchId: j.batchId,
    assetId: j.assetId,
    status: j.status as any,
    progress: j.progress,
    beforeBytes: j.beforeBytes,
    afterBytes: j.afterBytes,
    finalQuality: j.finalQuality,
    format: j.format,
    previewName: j.previewName,
    outputPath: j.outputPath,
    error: j.error,
  }))
}
