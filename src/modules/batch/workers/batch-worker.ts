import { api } from '@/api/client'
import type { BatchJob, BatchSubmitPayload } from '../types'

export async function submitBatch(payload: BatchSubmitPayload): Promise<{ batchId: string; jobIds: string[] }> {
  const r = await api.batchSubmit(payload)
  return { batchId: r.batchId, jobIds: r.jobIds }
}

export async function listBatchJobs(batchId: string): Promise<BatchJob[]> {
  const r = await api.batchJobs({ batchId })
  return r.jobs.map((j) => ({
    id: j.id,
    batchId: j.batchId,
    assetId: j.assetId,
    outputPath: j.outputPath,
    status: j.status as any,
    progress: j.progress,
    error: j.error,
  }))
}
