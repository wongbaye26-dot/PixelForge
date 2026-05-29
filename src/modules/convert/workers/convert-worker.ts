import { api } from '@/api/client'
import type { ConvertJob, ConvertTargetFormat } from '../types'

export async function submitConvert(payload: {
  assetIds: number[]
  targetFormat?: ConvertTargetFormat
  quality?: number
  keepExif?: boolean
  outputDir?: string
  namingPattern?: string
}): Promise<{ batchId: string; jobIds: string[] }> {
  const r = await api.convertSubmit(payload)
  return { batchId: r.batchId, jobIds: r.jobIds }
}

export async function listConvertJobs(batchId: string): Promise<ConvertJob[]> {
  const r = await api.convertJobs({ batchId })
  return r.jobs.map((j) => ({
    id: j.id,
    batchId: j.batchId,
    assetId: j.assetId,
    status: j.status as any,
    progress: j.progress,
    bytes: j.bytes,
    format: j.format,
    outputPath: j.outputPath,
    error: j.error,
  }))
}
