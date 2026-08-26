import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { resolveMediaUrl } from '@/utils/media-url'
import type { AiParams } from '../types'
import { fetchAiStatus, requestAiExport, requestAiPreview } from '../workers/ai-worker'
import { api } from '@/api/client'

export const useAiStore = defineStore('ai', () => {
  const library = useLibraryStore()

  const activeId = ref<number | null>(null)
  const generating = ref(false)
  const exporting = ref(false)
  const previewName = ref<string | null>(null)
  const lastEngine = ref<string | null>(null)
  const sidecarOnline = ref(false)

  const params = ref<AiParams>({
    width: 1920,
    height: 1080,
    sidecarUrl: '',
  })

  const activeAsset = computed(() => {
    const id = activeId.value ?? [...library.selectedIds][0]
    if (!id) return undefined
    return library.assets.find((a) => a.id === id) ?? library.selectedAssets.find((a) => a.id === id)
  })

  const beforeSrc = computed(() =>
    activeAsset.value ? resolveMediaUrl(`/api/assets/${activeAsset.value.id}/preview`) : undefined,
  )
  const afterSrc = computed(() =>
    previewName.value ? resolveMediaUrl(`/cache/thumbnails/${previewName.value}`) : undefined,
  )

  async function refreshStatus() {
    try {
      const [status, settings] = await Promise.all([fetchAiStatus(), api.getAiSidecarUrl()])
      sidecarOnline.value = status.sidecar.ok
      if (!params.value.sidecarUrl && settings.url) {
        params.value.sidecarUrl = settings.url
      }
    } catch {
      sidecarOnline.value = false
    }
  }

  function setActive(id: number) {
    activeId.value = id
    if (!library.selectedIds.has(id)) library.toggleSelect(id)
  }

  let t: number | undefined
  async function generatePreview() {
    const asset = activeAsset.value
    if (!asset) return

    generating.value = true
    try {
      const r = await requestAiPreview(asset.id, {
        width: params.value.width,
        height: params.value.height,
      })
      previewName.value = r.previewName
      lastEngine.value = r.engine ?? null
    } finally {
      generating.value = false
    }
  }

  function schedulePreview() {
    if (t) window.clearTimeout(t)
    t = window.setTimeout(() => void generatePreview(), 300)
  }

  async function exportImages(assetIds?: number[]) {
    const ids = assetIds?.length
      ? assetIds
      : activeId.value
        ? [activeId.value]
        : [...library.selectedIds]
    if (!ids.length) return null

    exporting.value = true
    try {
      return await requestAiExport(ids, {
        width: params.value.width,
        height: params.value.height,
        sidecarUrl: params.value.sidecarUrl || undefined,
      })
    } finally {
      exporting.value = false
    }
  }

  async function saveSidecarUrl() {
    const url = params.value.sidecarUrl?.trim() ?? ''
    await api.setAiSidecarUrl(url || null)
    await refreshStatus()
  }

  watch(
    () => [activeAsset.value?.id, params.value.width, params.value.height],
    () => schedulePreview(),
  )

  return {
    params,
    activeId,
    activeAsset,
    beforeSrc,
    afterSrc,
    previewName,
    generating,
    exporting,
    lastEngine,
    sidecarOnline,
    setActive,
    generatePreview,
    exportImages,
    refreshStatus,
    saveSidecarUrl,
  }
})
