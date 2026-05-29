import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { CompressItem, CompressJob, CompressSettings } from '../types'
import { pickFolder } from '../services/pick-folder'
import { listCompressJobs, submitCompress } from '../workers/compress-worker'

function bytesToKb(n: number): number {
  return Math.round((n / 1024) * 10) / 10
}

export const useCompressStore = defineStore('compress', () => {
  const items = ref<CompressItem[]>([])
  const selectedIds = ref<Set<number>>(new Set())
  const activeId = ref<number | null>(null)
  const loading = ref(false)

  const batchId = ref<string | null>(null)
  const jobs = ref<CompressJob[]>([])
  const polling = ref(false)

  const settings = ref<CompressSettings>({
    outputFormat: 'auto',
    quality: 85,
    targetSizeKb: 300,
    mozjpeg: true,
    usePngquant: true,
    namingPattern: '{name}_compressed.{format}',
    outputDir: '',
  })

  const selectedItems = computed(() => items.value.filter((a) => selectedIds.value.has(a.id)))
  const activeItem = computed(() => (activeId.value ? items.value.find((a) => a.id === activeId.value) : undefined))

  const jobByAssetId = computed(() => {
    const m = new Map<number, CompressJob>()
    for (const j of jobs.value) m.set(j.assetId, j)
    return m
  })

  const activeJob = computed(() => (activeItem.value ? jobByAssetId.value.get(activeItem.value.id) : undefined))

  const overallProgress = computed(() => {
    if (!jobs.value.length) return 0
    const sum = jobs.value.reduce((acc, j) => acc + j.progress, 0)
    return Math.round(sum / jobs.value.length)
  })

  const activeCompare = computed(() => {
    const a = activeItem.value
    const j = activeJob.value
    if (!a) return null
    return {
      before: { bytes: a.size, kb: bytesToKb(a.size) },
      after: j?.afterBytes ? { bytes: j.afterBytes, kb: bytesToKb(j.afterBytes) } : null,
      savingPct: j?.afterBytes ? Math.max(0, Math.round(((a.size - j.afterBytes) / a.size) * 100)) : null,
    }
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
      const { assets } = await api.listAssets({ folderId })
      items.value = assets
      selectedIds.value = new Set()
      activeId.value = assets[0]?.id ?? null
    } finally {
      loading.value = false
    }
  }

  async function startCompress() {
    if (!settings.value.outputDir) await loadDefaultOutputDir()
    const assetIds = [...selectedIds.value]
    if (assetIds.length === 0) return

    const r = await submitCompress({
      assetIds,
      outputFormat: settings.value.outputFormat,
      quality: settings.value.quality,
      targetSizeKb: settings.value.targetSizeKb,
      mozjpeg: settings.value.mozjpeg,
      usePngquant: settings.value.usePngquant,
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
      beforeBytes: 0,
      afterBytes: 0,
      format: '',
      outputPath: '',
    }))

    await refreshJobs()
    pollJobs()
  }

  async function refreshJobs() {
    if (!batchId.value) return
    const list = await listCompressJobs(batchId.value)
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
    ]
    selectedIds.value = new Set([1])
    activeId.value = 1
    batchId.value = 'mock_compress'
    jobs.value = [
      {
        id: 'mock_job_1',
        batchId: 'mock_compress',
        assetId: 1,
        status: 'running',
        progress: 45,
        beforeBytes: 123456,
        afterBytes: 65432,
        finalQuality: 70,
        format: 'webp',
        previewName: '',
        outputPath: '/mock/out.webp',
      },
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
    selectedItems,
    activeItem,
    activeJob,
    activeCompare,
    overallProgress,
    jobByAssetId,
    toggleSelect,
    setActive,
    clearSelection,
    removeSelected,
    importFolder,
    chooseOutputDir,
    loadDefaultOutputDir,
    startCompress,
    refreshJobs,
    stopPolling,
    loadMock,
  }
})
