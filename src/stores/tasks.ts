import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, type ExportTaskApiJob } from '@/api/client'
import { useExportMatcherStore } from '@/modules/export-matcher/stores/export-matcher'

export type TaskStatus = 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled'

export type TaskSource = 'export' | 'smart-export'

export interface ExportTaskRow {
  id: string
  batchId: string
  assetId: number
  filename: string
  thumbnailUrl?: string
  targetSize: string
  format: string
  progress: number
  status: TaskStatus
  outputPath?: string
  errorMessage?: string
  actionPending?: boolean
  source?: TaskSource
}

function mapJobToRow(job: ExportTaskApiJob): ExportTaskRow {
  return {
    id: job.id,
    batchId: job.batchId,
    assetId: job.assetId,
    filename: job.filename,
    thumbnailUrl: job.thumbnailUrl,
    targetSize: `${job.targetWidth}×${job.targetHeight}`,
    format: job.format,
    progress: job.progress,
    status: job.status,
    outputPath: job.outputPath,
    errorMessage: job.error,
    actionPending: false,
  }
}

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<ExportTaskRow[]>([])
  const polling = ref(false)
  const batchId = ref<string | null>(null)
  let pollTimer: number | null = null

  const overallProgress = computed(() => {
    if (tasks.value.length === 0) return 0
    const sum = tasks.value.reduce((a, t) => a + t.progress, 0)
    return Math.round(sum / tasks.value.length)
  })

  const completedCount = computed(() => tasks.value.filter((t) => t.status === 'completed').length)
  const failedCount = computed(() => tasks.value.filter((t) => t.status === 'failed').length)
  const activeCount = computed(() => tasks.value.filter((t) => ['pending', 'processing', 'paused'].includes(t.status)).length)

  function clearTasks() {
    stopPolling()
    tasks.value = []
    batchId.value = null
  }

  function setTasks(rows: ExportTaskRow[]) {
    stopPolling()
    batchId.value = null
    tasks.value = rows
  }

  function beginBatch(nextBatchId: string, jobs: ExportTaskApiJob[]) {
    batchId.value = nextBatchId
    tasks.value = jobs.map(mapJobToRow)
  }

  function updateTask(id: string, patch: Partial<ExportTaskRow>) {
    const row = tasks.value.find((t) => t.id === id)
    if (row) Object.assign(row, patch)
  }

  function markTasksFailed(reason: string, ids?: string[]) {
    const targetIds = ids ? new Set(ids) : null
    for (const row of tasks.value) {
      if (targetIds && !targetIds.has(row.id)) continue
      if (row.status === 'completed' || row.status === 'cancelled') continue
      row.status = 'failed'
      row.progress = 100
      row.errorMessage = reason
      row.actionPending = false
    }
    stopPolling()
  }

  async function refreshJobs() {
    if (!batchId.value) return
    const { jobs } = await api.exportBatchJobs({ batchId: batchId.value })
    const byId = new Map(jobs.map((job) => [job.id, job]))
    tasks.value = tasks.value.map((row) => {
      const next = byId.get(row.id)
      if (!next) return row
      return {
        ...row,
        ...mapJobToRow(next),
        actionPending: row.actionPending && next.status === row.status ? row.actionPending : false,
      }
    })
  }

  function schedulePoll(delay = 500) {
    if (!polling.value) return
    if (pollTimer != null) window.clearTimeout(pollTimer)
    pollTimer = window.setTimeout(async () => {
      if (!polling.value) return
      try {
        await refreshJobs()
        const done = tasks.value.length > 0 && tasks.value.every((row) => ['completed', 'failed', 'cancelled'].includes(row.status))
        if (done) {
          stopPolling()
          return
        }
      } catch (err) {
        markTasksFailed(err instanceof Error ? err.message : '导出任务状态同步失败')
        return
      }
      schedulePoll()
    }, delay)
  }

  function startPolling() {
    if (polling.value) return
    polling.value = true
    schedulePoll(0)
  }

  function stopPolling() {
    polling.value = false
    if (pollTimer != null) {
      window.clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  async function performAction(id: string, action: 'pause' | 'resume' | 'cancel' | 'retry', interim: Partial<ExportTaskRow>) {
    updateTask(id, { actionPending: true, ...interim })
    try {
      const { job } = await api.exportBatchControl(id, action)
      updateTask(id, {
        ...mapJobToRow(job),
        actionPending: false,
      })
      if (['pending', 'processing', 'paused'].includes(job.status)) {
        startPolling()
      }
    } catch (err) {
      updateTask(id, {
        actionPending: false,
        errorMessage: err instanceof Error ? err.message : '任务操作失败',
      })
      throw err
    }
  }

  async function pauseTask(id: string) {
    const row = tasks.value.find((t) => t.id === id)
    if (row?.source === 'smart-export') return
    await performAction(id, 'pause', { status: 'paused' })
  }

  async function resumeTask(id: string) {
    const row = tasks.value.find((t) => t.id === id)
    if (row?.source === 'smart-export') return
    await performAction(id, 'resume', { status: 'pending' })
  }

  async function cancelTask(id: string) {
    const row = tasks.value.find((t) => t.id === id)
    if (row?.source === 'smart-export') {
      const matcher = useExportMatcherStore()
      await matcher.cancelJob(id)
      return
    }
    await performAction(id, 'cancel', { status: 'cancelled' })
  }

  async function retryTask(id: string) {
    const row = tasks.value.find((t) => t.id === id)
    if (row?.source === 'smart-export') {
      const matcher = useExportMatcherStore()
      await matcher.retryJob(id)
      return
    }
    await performAction(id, 'retry', {
      status: 'pending',
      progress: 0,
      errorMessage: undefined,
      outputPath: undefined,
    })
  }

  return {
    tasks,
    batchId,
    polling,
    overallProgress,
    completedCount,
    failedCount,
    activeCount,
    clearTasks,
    setTasks,
    beginBatch,
    updateTask,
    markTasksFailed,
    refreshJobs,
    startPolling,
    stopPolling,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
  }
})
