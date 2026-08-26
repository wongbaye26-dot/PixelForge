export type ModuleQueueJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export interface ModuleQueueJob {
  id: string
  batchId: string
  status: ModuleQueueJobStatus
  progress: number
  cancelRequested?: boolean
  error?: string
  completedAt?: number
}

const PRUNE_THRESHOLD_MS = 30 * 60 * 1000

export function markJobCompleted(job: ModuleQueueJob): void {
  job.completedAt = Date.now()
}

export function pruneStaleJobs<T extends ModuleQueueJob>(jobs: Map<string, T>): number {
  const now = Date.now()
  let pruned = 0
  for (const [id, job] of jobs) {
    if (
      (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') &&
      job.completedAt &&
      now - job.completedAt > PRUNE_THRESHOLD_MS
    ) {
      jobs.delete(id)
      pruned++
    }
  }
  return pruned
}

export interface ModuleBatchContext {
  cancelled: boolean
}

export function shouldSkipModuleJob(
  job: ModuleQueueJob,
  ctx: ModuleBatchContext | undefined,
): boolean {
  if (job.status === 'cancelled' || job.cancelRequested || ctx?.cancelled) {
    job.status = 'cancelled'
    job.progress = 100
    return true
  }
  return false
}

export function cancelModuleJobs<T extends ModuleQueueJob>(
  jobs: Map<string, T>,
  contexts: Map<string, ModuleBatchContext>,
  batchId: string,
  jobId?: string,
): T[] {
  const ctx = contexts.get(batchId) ?? { cancelled: false }
  contexts.set(batchId, ctx)

  if (jobId) {
    const job = jobs.get(jobId)
    if (job && job.batchId === batchId) {
      if (job.status === 'queued') {
        job.status = 'cancelled'
        job.progress = 100
      } else if (job.status === 'running') {
        job.cancelRequested = true
      }
    }
  } else {
    ctx.cancelled = true
    for (const job of jobs.values()) {
      if (job.batchId !== batchId) continue
      if (job.status === 'queued') {
        job.status = 'cancelled'
        job.progress = 100
      } else if (job.status === 'running') {
        job.cancelRequested = true
      }
    }
  }

  return [...jobs.values()].filter((j) => j.batchId === batchId)
}

export function prepareModuleJobRetry<T extends ModuleQueueJob>(job: T): boolean {
  if (job.status !== 'error' && job.status !== 'cancelled') return false
  job.status = 'queued'
  job.progress = 0
  job.error = undefined
  job.cancelRequested = false
  return true
}
