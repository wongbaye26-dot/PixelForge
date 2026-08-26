import { describe, expect, it } from 'vitest'
import {
  markJobCompleted,
  pruneStaleJobs,
  shouldSkipModuleJob,
  cancelModuleJobs,
  prepareModuleJobRetry,
  type ModuleQueueJob,
} from '../../workers/module-job-controls'

function makeJob(overrides: Partial<ModuleQueueJob> = {}): ModuleQueueJob {
  return {
    id: 'j1',
    batchId: 'b1',
    status: 'queued',
    progress: 0,
    ...overrides,
  }
}

describe('markJobCompleted', () => {
  it('sets completedAt timestamp', () => {
    const job = makeJob()
    markJobCompleted(job)
    expect(job.completedAt).toBeGreaterThan(0)
  })
})

describe('pruneStaleJobs', () => {
  it('removes completed jobs older than threshold', () => {
    const jobs = new Map<string, ModuleQueueJob>()
    const old = makeJob({ id: 'old', status: 'done', completedAt: Date.now() - 31 * 60 * 1000 })
    const fresh = makeJob({ id: 'fresh', status: 'done', completedAt: Date.now() })
    jobs.set('old', old)
    jobs.set('fresh', fresh)
    const pruned = pruneStaleJobs(jobs)
    expect(pruned).toBe(1)
    expect(jobs.has('old')).toBe(false)
    expect(jobs.has('fresh')).toBe(true)
  })

  it('does not remove running jobs', () => {
    const jobs = new Map<string, ModuleQueueJob>()
    jobs.set('j1', makeJob({ status: 'running', completedAt: Date.now() - 60 * 60 * 1000 }))
    expect(pruneStaleJobs(jobs)).toBe(0)
  })
})

describe('shouldSkipModuleJob', () => {
  it('returns true for cancelled job', () => {
    expect(shouldSkipModuleJob(makeJob({ status: 'cancelled' }), undefined)).toBe(true)
  })

  it('returns true when cancelRequested', () => {
    expect(shouldSkipModuleJob(makeJob({ cancelRequested: true }), undefined)).toBe(true)
  })

  it('returns true when context is cancelled', () => {
    expect(shouldSkipModuleJob(makeJob(), { cancelled: true })).toBe(true)
  })

  it('returns false for normal job', () => {
    expect(shouldSkipModuleJob(makeJob(), { cancelled: false })).toBe(false)
  })
})

describe('cancelModuleJobs', () => {
  it('cancels a specific queued job', () => {
    const jobs = new Map<string, ModuleQueueJob>()
    jobs.set('j1', makeJob({ id: 'j1', status: 'queued' }))
    const contexts = new Map()
    const result = cancelModuleJobs(jobs, contexts, 'b1', 'j1')
    expect(result[0].status).toBe('cancelled')
  })

  it('cancels all jobs in batch when no jobId', () => {
    const jobs = new Map<string, ModuleQueueJob>()
    jobs.set('j1', makeJob({ id: 'j1', status: 'queued' }))
    jobs.set('j2', makeJob({ id: 'j2', status: 'queued' }))
    const contexts = new Map()
    cancelModuleJobs(jobs, contexts, 'b1')
    expect([...jobs.values()].every((j) => j.status === 'cancelled')).toBe(true)
  })
})

describe('prepareModuleJobRetry', () => {
  it('resets error job to queued', () => {
    const job = makeJob({ status: 'error', progress: 100, error: 'failed' })
    expect(prepareModuleJobRetry(job)).toBe(true)
    expect(job.status).toBe('queued')
    expect(job.progress).toBe(0)
    expect(job.error).toBeUndefined()
  })

  it('returns false for done job', () => {
    expect(prepareModuleJobRetry(makeJob({ status: 'done' }))).toBe(false)
  })
})
