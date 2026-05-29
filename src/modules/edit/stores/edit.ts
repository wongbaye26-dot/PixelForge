import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { resolveMediaUrl } from '@/utils/media-url'
import type { EditParams } from '../types'
import { requestEditPreview } from '../workers/edit-worker'

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export const useEditStore = defineStore('edit', () => {
  const library = useLibraryStore()

  const activeId = ref<number | null>(null)
  const generating = ref(false)
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
      const safe = {
        ...params.value,
        maxSize: clamp(params.value.maxSize, 256, 2048),
        cornerRadius: clamp(params.value.cornerRadius, 0, 9999),
        strokeWidth: clamp(params.value.strokeWidth, 0, 200),
        shadowBlur: clamp(params.value.shadowBlur, 0, 200),
        shadowOffsetX: clamp(params.value.shadowOffsetX, -200, 200),
        shadowOffsetY: clamp(params.value.shadowOffsetY, -200, 200),
      }
      const r = await requestEditPreview(asset.id, safe)
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
    setActive,
    generatePreview,
  }
})

