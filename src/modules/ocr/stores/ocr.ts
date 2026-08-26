import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLibraryStore } from '@/stores/library'
import type { OcrJob, OcrLang } from '../types'
import { listOcrJobs, submitOcrScan, fetchOcrStatus } from '../workers/ocr-worker'

export const useOcrStore = defineStore('ocr', () => {
  const library = useLibraryStore()

  const activeId = ref<number | null>(null)
  const lang = ref<OcrLang>('chi_sim+eng')
  const scanning = ref(false)
  const batchId = ref<string | null>(null)
  const jobs = ref<OcrJob[]>([])
  const engine = ref<'tesseract-cli' | 'tesseract.js' | 'unavailable'>('tesseract.js')
  const workerReady = ref(true)
  const lastError = ref<string | null>(null)

  const activeAsset = computed(() => {
    const id = activeId.value ?? [...library.selectedIds][0]
    if (!id) return undefined
    return library.assets.find((a) => a.id === id) ?? library.selectedAssets.find((a) => a.id === id)
  })

  const activeText = computed(() => {
    const asset = activeAsset.value
    if (!asset) return ''
    const job = jobs.value.find((j) => j.assetId === asset.id && j.status === 'done')
    if (job?.text) return job.text
    return asset.ocrText ?? ''
  })

  const activeError = computed(() => {
    const asset = activeAsset.value
    if (!asset) return lastError.value
    const job = jobs.value.find((j) => j.assetId === asset.id && j.status === 'error')
    return job?.error ?? lastError.value
  })

  const activeJobStatus = computed(() => {
    const asset = activeAsset.value
    if (!asset) return null
    const job = jobs.value.find((j) => j.assetId === asset.id)
    return job?.status ?? null
  })

  const jobByAssetId = computed(() => {
    const m = new Map<number, OcrJob>()
    for (const j of jobs.value) m.set(j.assetId, j)
    return m
  })

  function setActive(id: number) {
    activeId.value = id
    if (!library.selectedIds.has(id)) library.toggleSelect(id)
  }

  async function loadStatus() {
    try {
      const status = await fetchOcrStatus()
      workerReady.value = status.workerReady
      engine.value = status.engine
    } catch {
      workerReady.value = false
      engine.value = 'unavailable'
    }
  }

  async function scanSelected() {
    const assetIds = activeId.value ? [activeId.value] : [...library.selectedIds]
    if (!assetIds.length) return { done: 0, failed: 0, errors: [] as string[] }

    lastError.value = null
    scanning.value = true
    try {
      await loadStatus()
      if (!workerReady.value) {
        throw new Error('OCR 工作线程未就绪，请重启应用或执行 npm run build:worker')
      }

      const r = await submitOcrScan(assetIds, lang.value)
      batchId.value = r.batchId
      jobs.value = r.jobIds.map((id) => ({
        id,
        batchId: r.batchId,
        assetId: 0,
        status: 'queued',
        progress: 0,
        text: '',
        engine: '',
      }))
      await waitForJobs()
      const failed = jobs.value.filter((j) => j.status === 'error')
      const done = jobs.value.filter((j) => j.status === 'done')
      const errors = failed.map((j) => j.error).filter((msg): msg is string => Boolean(msg))
      if (errors.length) lastError.value = errors[0]
      if (done.length) void library.refresh()
      return { done: done.length, failed: failed.length, errors }
    } finally {
      scanning.value = false
    }
  }

  async function waitForJobs() {
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      await refreshJobs()
      if (
        jobs.value.length > 0 &&
        jobs.value.every((j) => j.status === 'done' || j.status === 'error')
      ) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 700))
    }
    throw new Error('OCR 识别超时，请稍后重试')
  }

  async function refreshJobs() {
    if (!batchId.value) return
    const list = await listOcrJobs(batchId.value)
    const byId = new Map(list.jobs.map((j) => [j.id, j]))
    jobs.value = jobs.value.map((j) => {
      const next = byId.get(j.id)
      if (!next) return j
      return {
        ...next,
        status: next.status as OcrJob['status'],
      }
    })

    const done = jobs.value.some((j) => j.status === 'done')
    if (done) void library.refresh()
  }

  return {
    activeId,
    activeAsset,
    activeText,
    activeError,
    activeJobStatus,
    lang,
    scanning,
    jobs,
    jobByAssetId,
    engine,
    workerReady,
    lastError,
    setActive,
    loadStatus,
    scanSelected,
    refreshJobs,
  }
})
