import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ExportFormat, ImageAsset, FitMode } from '@/types'
import type { ExportMatcherJob, ExportMatcherSubmitPayload } from '../types'
import { exportMatcherService } from '../services/export-matcher-service'

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

  const format = ref<ExportFormat>('webp')
  const quality = ref(90)
  const targetSizeKb = ref<number | undefined>(undefined)
  const namingPattern = ref('{name}_{size}.{format}')

  const batchId = ref<string | null>(null)
  const jobs = ref<ExportMatcherJob[]>([])
  const polling = ref(false)
  const loading = ref(false)

  const previewing = ref(false)
  const previewJobId = ref<string | null>(null)
  const previewName = ref<string | null>(null)
  const previewAsset = ref<ImageAsset | null>(null)

  const overallProgress = computed(() => {
    if (!jobs.value.length) return 0
    const sum = jobs.value.reduce((acc, j) => acc + (j.progress ?? 0), 0)
    return Math.round(sum / jobs.value.length)
  })

  function setPreviewAsset(asset: ImageAsset | null) {
    previewAsset.value = asset
  }

  async function submit(payload: ExportMatcherSubmitPayload) {
    loading.value = true
    try {
      const r = await exportMatcherService.submit(payload)
      batchId.value = r.batchId
      jobs.value = r.jobs
      poll()
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
      return {
        ...j,
        status: n.status,
        progress: n.progress,
        outputPath: n.outputPath ?? j.outputPath,
        previewName: n.previewName ?? j.previewName,
        error: n.error ?? j.error,
      }
    })
  }

  function poll() {
    if (polling.value) return
    polling.value = true

    const tick = async () => {
      if (!polling.value) return
      try {
        await refreshJobs()
        const allDone =
          jobs.value.length > 0 &&
          jobs.value.every((j) => j.status === 'done' || j.status === 'error')
        if (allDone) {
          polling.value = false
          return
        }
      } catch {
      }
      setTimeout(tick, 600)
    }

    void tick()
  }

  function stopPolling() {
    polling.value = false
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
    batchId.value = null
    jobs.value = []
    polling.value = false
    clearPreview()
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
    polling,
    loading,
    overallProgress,
    previewing,
    previewJobId,
    previewName,
    previewAsset,
    setPreviewAsset,
    submit,
    refreshJobs,
    poll,
    stopPolling,
    preview,
    clearPreview,
    reset,
  }
})
