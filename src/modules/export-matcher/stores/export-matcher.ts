import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ExportFormat, FitMode, ImageAsset } from '@/types'
import type { ExportMatcherJob, ExportMatcherSubmitPayload } from '../types'
import { exportMatcherService } from '../services/export-matcher-service'
import { useTasksStore, type ExportTaskRow, type TaskStatus } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'

function mapSmartStatus(status: ExportMatcherJob['status']): TaskStatus {
  if (status === 'done') return 'completed'
  if (status === 'error') return 'failed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'processing') return 'processing'
  return 'pending'
}

function toTaskRow(job: ExportMatcherJob, format: ExportFormat): ExportTaskRow {
  return {
    id: job.id,
    batchId: job.batchId,
    assetId: job.imageId,
    filename: job.imageFilename,
    targetSize: `${job.targetWidth}×${job.targetHeight}`,
    format,
    progress: job.progress,
    status: mapSmartStatus(job.status),
    outputPath: job.outputPath,
    errorMessage: job.error,
    actionPending: false,
    source: 'smart-export',
  }
}

export const useExportMatcherStore = defineStore('exportMatcher', () => {
  const enabled = ref(true)
  const autoPickBestImage = ref(true)
  const autoRecommendMode = ref(true)
  const autoCompressOptimize = ref(true)
  const autoBackgroundOptimize = ref(true)
  const avoidUpscale = ref(true)
  const preferSlightDownscale = ref(true)
  const avoidOversize = ref(true)
  const highQualityFirst = ref(true)
  const debugMode = ref(false)

  const format = ref<ExportFormat>('original')
  const quality = ref(90)
  const targetSizeKb = ref<number | undefined>(undefined)
  const namingPattern = ref('{name}_{size}.{format}')

  const batchId = ref<string | null>(null)
  const jobs = ref<ExportMatcherJob[]>([])
  const unmatchedSizes = ref<Array<{ width: number; height: number }>>([])
  const polling = ref(false)
  const loading = ref(false)
  const pollError = ref<string | null>(null)
  const batchFinished = ref(false)
  const lastBatchSummary = ref<{ done: number; failed: number; cancelled: number } | null>(null)

  const previewing = ref(false)
  const previewJobId = ref<string | null>(null)
  const previewName = ref<string | null>(null)
  const previewAsset = ref<ImageAsset | null>(null)

  const overallProgress = computed(() => {
    if (!jobs.value.length) return 0
    const sum = jobs.value.reduce((acc, j) => acc + (j.progress ?? 0), 0)
    return Math.round(sum / jobs.value.length)
  })

  const failedJobs = computed(() => jobs.value.filter((j) => j.status === 'error'))
  const activeJobs = computed(() => jobs.value.filter((j) => j.status === 'pending' || j.status === 'processing'))

  function setPreviewAsset(asset: ImageAsset | null) {
    previewAsset.value = asset
  }

  function syncTasksStore() {
    if (!batchId.value) return
    const tasks = useTasksStore()
    tasks.batchId = batchId.value
    tasks.tasks = jobs.value.map((job) => toTaskRow(job, format.value))
  }

  function applyJobs(nextJobs: ExportMatcherJob[]) {
    jobs.value = nextJobs
    syncTasksStore()
  }

  function updateJob(job: ExportMatcherJob) {
    jobs.value = jobs.value.map((j) => (j.id === job.id ? job : j))
    syncTasksStore()
  }

  async function submit(payload: ExportMatcherSubmitPayload) {
    loading.value = true
    batchFinished.value = false
    lastBatchSummary.value = null
    pollError.value = null
    try {
      const r = await exportMatcherService.submit(payload)
      batchId.value = r.batchId
      unmatchedSizes.value = r.unmatchedSizes
      applyJobs(r.jobs)
      useUiStore().showExportTasks = true
      poll()
      return r
    } finally {
      loading.value = false
    }
  }

  async function refreshJobs() {
    if (!batchId.value) return
    const nextJobs = await exportMatcherService.listJobs(batchId.value)
    const byId = new Map(nextJobs.map((j) => [j.id, j]))
    jobs.value = jobs.value.map((j) => {
      const n = byId.get(j.id)
      if (!n) return j
      return { ...j, ...n }
    })
    syncTasksStore()
  }

  function finishPollingIfDone() {
    const terminal = new Set(['done', 'error', 'cancelled'])
    const allDone = jobs.value.length > 0 && jobs.value.every((j) => terminal.has(j.status))
    if (!allDone) return false
    polling.value = false
    batchFinished.value = true
    lastBatchSummary.value = {
      done: jobs.value.filter((j) => j.status === 'done').length,
      failed: jobs.value.filter((j) => j.status === 'error').length,
      cancelled: jobs.value.filter((j) => j.status === 'cancelled').length,
    }
    return true
  }

  function poll() {
    if (polling.value) return
    polling.value = true
    pollError.value = null

    const tick = async () => {
      if (!polling.value) return
      try {
        await refreshJobs()
        if (finishPollingIfDone()) return
      } catch (err) {
        pollError.value = err instanceof Error ? err.message : '任务状态同步失败'
        polling.value = false
        return
      }
      setTimeout(tick, 600)
    }

    void tick()
  }

  function stopPolling() {
    polling.value = false
  }

  async function cancelJob(jobId?: string) {
    if (!batchId.value) return
    const next = await exportMatcherService.cancel(batchId.value, jobId)
    applyJobs(next.length ? next : jobs.value)
    finishPollingIfDone()
  }

  async function retryJob(jobId: string) {
    if (!batchId.value) return
    const job = await exportMatcherService.retry(batchId.value, jobId)
    updateJob(job)
    batchFinished.value = false
    poll()
  }

  async function swapJob(jobId: string, assetId: number) {
    if (!batchId.value) return
    const job = await exportMatcherService.swap(batchId.value, jobId, assetId, {
      autoRecommendMode: autoRecommendMode.value,
      autoBackgroundOptimize: autoBackgroundOptimize.value,
    })
    updateJob(job)
    batchFinished.value = false
    poll()
  }

  async function preview(jobId: string, assetId: number, targetWidth: number, targetHeight: number, mode: FitMode) {
    previewing.value = true
    previewJobId.value = jobId
    previewName.value = null
    try {
      const r = await exportMatcherService.preview({ assetId, targetWidth, targetHeight, mode })
      previewName.value = r.previewName
    } finally {
      previewing.value = false
    }
  }

  function clearPreview() {
    previewing.value = false
    previewJobId.value = null
    previewName.value = null
    previewAsset.value = null
  }

  function reset() {
    const tasks = useTasksStore()
    tasks.clearTasks()
    batchId.value = null
    jobs.value = []
    unmatchedSizes.value = []
    polling.value = false
    pollError.value = null
    batchFinished.value = false
    lastBatchSummary.value = null
    clearPreview()
  }

  function acknowledgeBatchFinish() {
    batchFinished.value = false
  }

  return {
    enabled,
    autoPickBestImage,
    autoRecommendMode,
    autoCompressOptimize,
    autoBackgroundOptimize,
    avoidUpscale,
    preferSlightDownscale,
    avoidOversize,
    highQualityFirst,
    debugMode,
    format,
    quality,
    targetSizeKb,
    namingPattern,
    batchId,
    jobs,
    unmatchedSizes,
    polling,
    loading,
    pollError,
    batchFinished,
    lastBatchSummary,
    overallProgress,
    failedJobs,
    activeJobs,
    previewing,
    previewJobId,
    previewName,
    previewAsset,
    setPreviewAsset,
    submit,
    refreshJobs,
    poll,
    stopPolling,
    cancelJob,
    retryJob,
    swapJob,
    preview,
    clearPreview,
    reset,
    acknowledgeBatchFinish,
  }
})
