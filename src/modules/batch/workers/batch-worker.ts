import { api } from '@/api/client'
import type { BatchJob } from '../types'
import { createModuleWorker } from '@/core/module-worker'

function mapBatchJob(j: Record<string, unknown>): BatchJob {
  return {
    id: j.id as string,
    batchId: j.batchId as string,
    assetId: j.assetId as number,
    outputPath: (j.outputPath as string) ?? '',
    status: j.status as BatchJob['status'],
    progress: j.progress as number,
    error: j.error as string | undefined,
  }
}

const worker = createModuleWorker<BatchJob, Parameters<typeof api.batchSubmit>[0]>({
  apiSubmit: api.batchSubmit.bind(api),
  apiList: api.batchJobs.bind(api),
  apiCancel: api.batchCancel.bind(api),
  apiRetry: api.batchRetry.bind(api),
  mapJob: mapBatchJob,
})

export const submitBatch = worker.submit
export const listBatchJobs = worker.listJobs
export const cancelBatchJobs = worker.cancelJobs
export const retryBatchJob = worker.retryJob
