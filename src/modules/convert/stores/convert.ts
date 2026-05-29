import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { ConvertItem, ConvertJob, ConvertSettings } from '../types'
import { pickFolder } from '../services/pick-folder'
import { listConvertJobs, submitConvert } from '../workers/convert-worker'

export const useConvertStore = defineStore('convert', () => {
  const items = ref<ConvertItem[]>([])
  const selectedIds = ref<Set<number>>(new Set())
  const activeId = ref<number | null>(null)
  const loading = ref(false)

  const batchId = ref<string | null>(null)
  const jobs = ref<ConvertJob[]>([])
  const polling = ref(false)

  const settings = ref<ConvertSettings>({
    targetFormat: 'webp',
    quality: 90,
    keepExif: true,
    namingPattern: '{name}.{format}',
    outputDir: '',
  })

  const activeItem = computed(() => (activeId.value ? items.value.find((a) => a.id === activeId.value) : undefined))
  const selectedItems = computed(() => items.value.filter((a) => selectedIds.value.has(a.id)))

  const jobByAssetId = computed(() => {
    const m = new Map<number, ConvertJob>()
    for (const j of jobs.value) m.set(j.assetId, j)
    return m
  })

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
    if (!activeId.value) activeId.value = id
  }

  function setActive(id: number) {
    activeId.value = id
    if (!selectedIds.value.has(id)) {
      const next = new Set(selectedIds.value)
      next.add(id)
      selectedIds.value = next
    }
  }

  function clearSelection() {
    selectedIds.value = new Set()
    activeId.value = null
  }

  function removeSelected() {
    const remove = selectedIds.value
    items.value = items.value.filter((a) => !remove.has(a.id))
    selectedIds.value = new Set()
    if (activeId.value && remove.has(activeId.value)) activeId.value = items.value[0]?.id ?? null
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
      const { assets } = await api.listAssets({ folderId, limit: 5000 })
      items.value = assets
      selectedIds.value = new Set()
      activeId.value = assets[0]?.id ?? null
    } finally {
      loading.value = false
    }
  }

  async function importDroppedFiles(paths: string[]) {
    const normalized = paths.map((p) => p.trim()).filter(Boolean)
    if (!normalized.length) return
    loading.value = true
    try {
      await api.scanFiles(normalized)
      const { assets } = await api.listAssets({ limit: 5000 })
      const wanted = new Set(normalized)
      const picked = assets.filter((a) => wanted.has(a.path))
      const map = new Map(items.value.map((a) => [a.id, a]))
      for (const a of picked) map.set(a.id, a)
      items.value = [...map.values()].sort((a, b) => b.id - a.id)
      if (!activeId.value) activeId.value = items.value[0]?.id ?? null
    } finally {
      loading.value = false
    }
  }

  async function startConvert() {
    if (!settings.value.outputDir) await loadDefaultOutputDir()
    const assetIds = [...selectedIds.value]
    if (assetIds.length === 0) return

    const r = await submitConvert({
      assetIds,
      targetFormat: settings.value.targetFormat,
      quality: settings.value.quality,
      keepExif: settings.value.keepExif,
      outputDir: settings.value.outputDir || undefined,
      namingPattern: settings.value.namingPattern,
    })

    batchId.value = r.batchId
    jobs.value = r.jobIds.map((id) => ({
      id,
      batchId: r.batchId,
      assetId: 0,
      status: 'queued',
      progress: 0,
      outputPath: '',
    }))

    await refreshJobs()
    pollJobs()
  }

  async function refreshJobs() {
    if (!batchId.value) return
    const list = await listConvertJobs(batchId.value)
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
        path: '/mock/2.gif',
        filename: 'mock_2.gif',
        width: 480,
        height: 270,
        ratio: 480 / 270,
        format: 'gif',
        size: 345678,
        hash: 'mock2',
        thumbnailUrl: '',
        previewUrl: '',
      },
    ]
    selectedIds.value = new Set([1, 2])
    activeId.value = 1
    batchId.value = 'mock_convert'
    jobs.value = [
      { id: 'mock_job_1', batchId: 'mock_convert', assetId: 1, status: 'running', progress: 55, outputPath: '/mock/out1.png' },
      { id: 'mock_job_2', batchId: 'mock_convert', assetId: 2, status: 'queued', progress: 0, outputPath: '/mock/out2.webp' },
    ]
  }

  return {
    items,
    selectedIds,
    activeId,
    loading,
    settings,
    batchId,
    jobs,
    polling,
    activeItem,
    selectedItems,
    jobByAssetId,
    overallProgress,
    toggleSelect,
    setActive,
    clearSelection,
    removeSelected,
    importFolder,
    importDroppedFiles,
    chooseOutputDir,
    loadDefaultOutputDir,
    startConvert,
    refreshJobs,
    stopPolling,
    loadMock,
  }
})

