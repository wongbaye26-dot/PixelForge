export interface WorkerJob {
  id: string
  batchId: string
  assetId: number
  status: string
  progress: number
  outputPath: string
  error?: string
}

export interface ModuleWorkerOptions<J extends WorkerJob, P> {
  apiSubmit: (payload: P) => Promise<{ batchId: string; jobIds: string[] }>
  apiList: (params: { batchId: string }) => Promise<{ jobs: Array<Record<string, unknown>> }>
  apiCancel: (params: { batchId: string; jobId?: string }) => Promise<{ jobs: Array<Record<string, unknown>> }>
  apiRetry: (params: { batchId: string; jobId: string }) => Promise<{ job: Record<string, unknown> }>
  mapJob: (raw: Record<string, unknown>) => J
}

export function createModuleWorker<J extends WorkerJob, P>(opts: ModuleWorkerOptions<J, P>) {
  async function submit(payload: P): Promise<{ batchId: string; jobIds: string[] }> {
    return opts.apiSubmit(payload)
  }

  async function listJobs(batchId: string): Promise<J[]> {
    const r = await opts.apiList({ batchId })
    return r.jobs.map(opts.mapJob)
  }

  async function cancelJobs(batchId: string, jobId?: string): Promise<J[]> {
    const r = await opts.apiCancel({ batchId, jobId })
    return r.jobs.map(opts.mapJob)
  }

  async function retryJob(batchId: string, jobId: string): Promise<J> {
    const r = await opts.apiRetry({ batchId, jobId })
    return opts.mapJob(r.job)
  }

  return { submit, listJobs, cancelJobs, retryJob }
}
