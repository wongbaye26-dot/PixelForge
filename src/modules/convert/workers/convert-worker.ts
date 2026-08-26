import { api } from '@/api/client'
import type { ConvertJob } from '../types'
import { createModuleWorker } from '@/core/module-worker'

function mapConvertJob(j: Record<string, unknown>): ConvertJob {
  return {
    id: j.id as string,
    batchId: j.batchId as string,
    assetId: j.assetId as number,
    status: j.status as ConvertJob['status'],
    progress: j.progress as number,
    bytes: j.bytes as number | undefined,
    format: j.format as string | undefined,
    outputPath: (j.outputPath as string) ?? '',
    error: j.error as string | undefined,
  }
}

const worker = createModuleWorker<ConvertJob, Parameters<typeof api.convertSubmit>[0]>({
  apiSubmit: api.convertSubmit.bind(api),
  apiList: api.convertJobs.bind(api),
  apiCancel: api.convertCancel.bind(api),
  apiRetry: api.convertRetry.bind(api),
  mapJob: mapConvertJob,
})

export const submitConvert = worker.submit
export const listConvertJobs = worker.listJobs
export const cancelConvertJobs = worker.cancelJobs
export const retryConvertJob = worker.retryJob
