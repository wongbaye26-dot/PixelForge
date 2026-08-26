import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { resolveMediaUrl } from '@/utils/media-url'
import type { EditParams } from '../types'
import { requestEditPreview, requestEditExport } from '../workers/edit-worker'

import { clamp } from '@/core/math'

export const useEditStore = defineStore('edit', () => {
  const library = useLibraryStore()

  const activeId = ref<number | null>(null)
  const generating = ref(false)
  const exporting = ref(false)
  const previewName = ref<string | null>(null)

  const params = ref<EditParams>({
    maxSize: 960,
    transparentBackground: true,
    backgroundColor: '#ffffff',
    cornerRadius: 24,
    circleCrop: false,
    strokeWidth: 0,
    strokeColor: '#ffffff',
    shadowEnabled: false,
    shadowBlur: 18,
    shadowOffsetX: 0,
    shadowOffsetY: 10,
    shadowColor: 'rgba(0,0,0,0.35)',
  })

  const activeAsset = computed(() => {
    const id = activeId.value ?? [...library.selectedIds][0]
    if (!id) return undefined
    return library.assets.find((a) => a.id === id) ?? library.selectedAssets.find((a) => a.id === id)
  })

  const beforeSrc = computed(() => (activeAsset.value ? resolveMediaUrl(`/api/assets/${activeAsset.value.id}/preview`) : undefined))
  const afterSrc = computed(() => (previewName.value ? resolveMediaUrl(`/cache/thumbnails/${previewName.value}`) : undefined))

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
      const r = await requestEditPreview(asset.id, safeParams())
      previewName.value = r.previewName
    } finally {
      generating.value = false
    }
  }

  function schedulePreview() {
    if (t) window.clearTimeout(t)
    t = window.setTimeout(() => {
      void generatePreview()
    }, 250)
  }

  function safeParams(): EditParams {
    return {
      ...params.value,
      maxSize: clamp(params.value.maxSize, 256, 2048),
      cornerRadius: clamp(params.value.cornerRadius, 0, 9999),
      strokeWidth: clamp(params.value.strokeWidth, 0, 200),
      shadowBlur: clamp(params.value.shadowBlur, 0, 200),
      shadowOffsetX: clamp(params.value.shadowOffsetX, -200, 200),
      shadowOffsetY: clamp(params.value.shadowOffsetY, -200, 200),
    }
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
      return await requestEditExport(ids, safeParams())
    } finally {
      exporting.value = false
    }
  }

  watch(
    () => [activeAsset.value?.id, params.value],
    () => {
      schedulePreview()
    },
    { deep: true },
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
    setActive,
    generatePreview,
    exportImages,
  }
})

