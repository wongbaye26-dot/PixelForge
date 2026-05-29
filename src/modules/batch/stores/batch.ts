import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { BatchFormat, BatchItem, BatchJob, BatchSettings } from '../types'
import { pickFolder } from '../services/pick-folder'
import { listBatchJobs, submitBatch } from '../workers/batch-worker'

export const useBatchStore = defineStore('batch', () => {
  const items = ref<BatchItem[]>([])
  const selectedIds = ref<Set<number>>(new Set())
  const loading = ref(false)

  const batchId = ref<string | null>(null)
  const jobs = ref<BatchJob[]>([])
  const polling = ref(false)

  const settings = ref<BatchSettings>({
    resize: { enabled: true, width: 1920, height: 1080, fit: 'contain' },
    format: 'webp',
    quality: 90,
    namingPattern: '{name}_{op}.{format}',
    outputDir: '',
  })

  const selectedItems = computed(() => items.value.filter((a) => selectedIds.value.has(a.id)))

  const overallProgress = computed(() => {
    if (!jobs.value.length) return 0
    const sum = jobs.value.reduce((acc, j) => acc + j.progress, 0)
    return Math.round(sum / jobs.value.length)
  })

  function toggleSelect(id: number) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function clearSelection() {
    selectedIds.value = new Set()
  }

  function removeSelected() {
    const remove = selectedIds.value
    items.value = items.value.filter((a) => !remove.has(a.id))
    selectedIds.value = new Set()
  }

  async function loadDefaultOutputDir() {
    const r = await api.getExportDir()
    settings.value.outputDir = r.path || r.defaultPath
  }

  async function chooseOutputDir() {
    const dir = await pickFolder()
    if (dir) settings.value.outputDir = dir
  }

  async function importFolder() {
    const dir = await pickFolder()
    if (!dir) return
    loading.value = true
    try {
      await api.scanFolder(dir)
      const { folders } = await api.listFolders()
      const folder = folders.find((f) => f.path === dir)
      const folderId = folder?.id
      const { assets } = await api.listAssets({ folderId })
      items.value = assets
      selectedIds.value = new Set()
    } finally {
      loading.value = false
    }
  }

  async function startExport() {
    if (!settings.value.outputDir) await loadDefaultOutputDir()
    const assetIds = [...selectedIds.value]
    if (assetIds.length === 0) return

    const resize = settings.value.resize.enabled
      ? { width: settings.value.resize.width, height: settings.value.resize.height, fit: settings.value.resize.fit }
      : undefined

    const format = (settings.value.format === 'original' ? undefined : (settings.value.format as Exclude<BatchFormat, 'original'>))

    const r = await submitBatch({
      assetIds,
      resize,
      format,
      quality: settings.value.quality,
      outputDir: settings.value.outputDir || undefined,
      namingPattern: settings.value.namingPattern,
    })

    batchId.value = r.batchId
    jobs.value = r.jobIds.map((id) => ({
      id,
      batchId: r.batchId,
      assetId: 0,
      outputPath: '',
      status: 'queued',
      progress: 0,
    }))

    await refreshJobs()
    pollJobs()
  }

  async function refreshJobs() {
    if (!batchId.value) return
    const list = await listBatchJobs(batchId.value)
    const byId = new Map(list.map((j) => [j.id, j]))
    jobs.value = jobs.value.map((j) => byId.get(j.id) ?? j)
  }

  function pollJobs() {
    if (polling.value) return
    polling.value = true

    const tick = async () => {
      if (!polling.value) return
      try {
        await refreshJobs()
        const allDone = jobs.value.length > 0 && jobs.value.every((j) => j.status === 'done' || j.status === 'error')
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

  function loadMock() {
    items.value = [
      {
        id: 1,
        path: '/mock/1.jpg',
        filename: 'mock_1.jpg',
        width: 1920,
        height: 1080,
        ratio: 1920 / 1080,
        format: 'jpg',
        size: 123456,
        hash: 'mock1',
        thumbnailUrl: '',
        previewUrl: '',
      },
      {
        id: 2,
        path: '/mock/2.png',
        filename: 'mock_2.png',
        width: 1080,
        height: 1080,
        ratio: 1,
        format: 'png',
        size: 234567,
        hash: 'mock2',
        thumbnailUrl: '',
        previewUrl: '',
      },
    ]
    selectedIds.value = new Set([1, 2])
    batchId.value = 'mock_batch'
    jobs.value = [
      { id: 'mock_job_1', batchId: 'mock_batch', assetId: 1, outputPath: '/mock/out1.webp', status: 'running', progress: 42 },
      { id: 'mock_job_2', batchId: 'mock_batch', assetId: 2, outputPath: '/mock/out2.webp', status: 'queued', progress: 0 },
    ]
  }

  return {
    items,
    selectedIds,
    selectedItems,
    loading,
    settings,
    batchId,
    jobs,
    polling,
    overallProgress,
    toggleSelect,
    clearSelection,
    removeSelected,
    importFolder,
    chooseOutputDir,
    loadDefaultOutputDir,
    startExport,
    refreshJobs,
    stopPolling,
    loadMock,
  }
})
