import { api } from '@/api/client'
import type { CompressJob } from '../types'
import { createModuleWorker } from '@/core/module-worker'

function mapCompressJob(j: Record<string, unknown>): CompressJob {
  return {
    id: j.id as string,
    batchId: j.batchId as string,
    assetId: j.assetId as number,
    status: j.status as CompressJob['status'],
    progress: j.progress as number,
    beforeBytes: (j.beforeBytes as number) ?? 0,
    afterBytes: (j.afterBytes as number) ?? 0,
    finalQuality: j.finalQuality as number | undefined,
    format: (j.format as string) ?? '',
    previewName: j.previewName as string | undefined,
    outputPath: (j.outputPath as string) ?? '',
    error: j.error as string | undefined,
  }
}

const worker = createModuleWorker<CompressJob, Parameters<typeof api.compressSubmit>[0]>({
  apiSubmit: api.compressSubmit.bind(api),
  apiList: api.compressJobs.bind(api),
  apiCancel: api.compressCancel.bind(api),
  apiRetry: api.compressRetry.bind(api),
  mapJob: mapCompressJob,
})

export const submitCompress = worker.submit
export const listCompressJobs = worker.listJobs
export const cancelCompressJobs = worker.cancelJobs
export const retryCompressJob = worker.retryJob
