import { computed, ref, type Ref } from 'vue'
import { api } from '@/api/client'
import { pickFolder } from '@/modules/batch/services/pick-folder'
import type { ImageAsset } from '@/types'

export interface ModuleStoreJob {
  id: string
  batchId: string
  assetId: number
  status: string
  progress: number
  outputPath: string
}

export interface UseModuleStoreOptions<J extends ModuleStoreJob> {
  submitFn: (payload: Record<string, unknown>) => Promise<{ batchId: string; jobIds: string[] }>
  listJobsFn: (batchId: string) => Promise<J[]>
  cancelJobsFn: (batchId: string, jobId?: string) => Promise<J[]>
  retryJobFn: (batchId: string, jobId: string) => Promise<J>
  createJobPlaceholder: (id: string, batchId: string) => J
  hasActive?: boolean
}

export function useModuleStoreLogic<J extends ModuleStoreJob>(opts: UseModuleStoreOptions<J>) {
  const items = ref<ImageAsset[]>([]) as Ref<ImageAsset[]>
  const selectedIds = ref<Set<number>>(new Set())
  const activeId = ref<number | null>(opts.hasActive ? null : undefined as never)
  const loading = ref(false)

  const batchId = ref<string | null>(null)
  const jobs = ref<J[]>([]) as Ref<J[]>
  const polling = ref(false)
  const pollError = ref<string | null>(null)

  const selectedItems = computed(() => items.value.filter((a) => selectedIds.value.has(a.id)))
  const activeItem = computed(() =>
    opts.hasActive && activeId.value ? items.value.find((a) => a.id === activeId.value) : undefined,
  )
  const jobByAssetId = computed(() => {
    const m = new Map<number, J>()
    for (const j of jobs.value) m.set(j.assetId, j)
    return m
  })
  const activeJob = computed(() =>
    activeItem.value ? jobByAssetId.value.get(activeItem.value.id) : undefined,
  )
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
    if (opts.hasActive && !activeId.value) activeId.value = id
  }

  function setActive(id: number) {
    if (!opts.hasActive) return
    activeId.value = id
    if (!selectedIds.value.has(id)) {
      const next = new Set(selectedIds.value)
      next.add(id)
      selectedIds.value = next
    }
  }

  function clearSelection() {
    selectedIds.value = new Set()
    if (opts.hasActive) activeId.value = null
  }

  function removeSelected() {
    const remove = selectedIds.value
    items.value = items.value.filter((a) => !remove.has(a.id))
    selectedIds.value = new Set()
    if (opts.hasActive && activeId.value && remove.has(activeId.value)) {
      activeId.value = items.value[0]?.id ?? null
    }
  }

  async function loadDefaultOutputDir(target: { outputDir: string }) {
    const r = await api.getExportDir()
    target.outputDir = r.path || r.defaultPath
  }

  async function chooseOutputDir(target: { outputDir: string }) {
    const dir = await pickFolder()
    if (dir) target.outputDir = dir
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
      if (opts.hasActive) activeId.value = assets[0]?.id ?? null
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
      selectedIds.value = new Set()
      if (opts.hasActive) activeId.value = items.value[0]?.id ?? null
    } finally {
      loading.value = false
    }
  }

  async function submitJob(payload: Record<string, unknown>) {
    const assetIds = [...selectedIds.value]
    if (assetIds.length === 0) return

    const r = await opts.submitFn({ ...payload, assetIds })
    batchId.value = r.batchId
    jobs.value = r.jobIds.map((id) => opts.createJobPlaceholder(id, r.batchId))

    await refreshJobs()
    pollJobs()
  }

  async function refreshJobs() {
    if (!batchId.value) return
    const list = await opts.listJobsFn(batchId.value)
    const byId = new Map(list.map((j) => [j.id, j]))
    jobs.value = jobs.value.map((j) => byId.get(j.id) ?? j) as J[]
  }

  function pollJobs() {
    if (polling.value) return
    polling.value = true
    pollError.value = null

    const tick = async () => {
      if (!polling.value) return
      try {
        await refreshJobs()
        const terminal = new Set(['done', 'error', 'cancelled'])
        const allDone = jobs.value.length > 0 && jobs.value.every((j) => terminal.has(j.status))
        if (allDone) {
          polling.value = false
          return
        }
      } catch (err) {
        pollError.value = err instanceof Error ? err.message : '任务状态同步失败'
        polling.value = false
        return
      }
      setTimeout(tick, 600)
    }

    void tick()
  }

  async function cancelJob(jobId?: string) {
    if (!batchId.value) return
    const next = await opts.cancelJobsFn(batchId.value, jobId)
    if (next.length) {
      const byId = new Map(next.map((j) => [j.id, j]))
      jobs.value = jobs.value.map((j) => byId.get(j.id) ?? j) as J[]
    }
  }

  async function retryJob(jobId: string) {
    if (!batchId.value) return
    const job = await opts.retryJobFn(batchId.value, jobId)
    jobs.value = jobs.value.map((j) => (j.id === job.id ? job : j)) as J[]
    pollJobs()
  }

  function stopPolling() {
    polling.value = false
  }

  return {
    items,
    selectedIds,
    activeId,
    loading,
    batchId,
    jobs,
    polling,
    pollError,
    selectedItems,
    activeItem,
    jobByAssetId,
    activeJob,
    overallProgress,
    toggleSelect,
    setActive,
    clearSelection,
    removeSelected,
    importFolder,
    importDroppedFiles,
    chooseOutputDir,
    loadDefaultOutputDir,
    submitJob,
    refreshJobs,
    stopPolling,
    cancelJob,
    retryJob,
  }
}
