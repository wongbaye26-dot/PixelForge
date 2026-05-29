import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import type { ImageAsset, LibraryFolder } from '@/types'

export const useLibraryStore = defineStore('library', () => {
  const assets = ref<ImageAsset[]>([])
  const facetAssets = ref<ImageAsset[]>([])
  const folders = ref<LibraryFolder[]>([])
  const selectedIds = ref<Set<number>>(new Set())
  const searchQuery = ref('')
  const showFavoritesOnly = ref(false)
  const filterFolderId = ref<number | undefined>()
  const filterFormat = ref<string | undefined>()
  const filterRatio = ref<number | undefined>()
  const filterWidth = ref<number | undefined>()
  const filterHeight = ref<number | undefined>()
  const filterDuplicate = ref(false)
  const loading = ref(false)
  const scanPath = ref('')

  const selectedAssets = computed(() =>
    assets.value.filter((a) => selectedIds.value.has(a.id)),
  )

  const viewTitle = computed(() => {
    if (showFavoritesOnly.value) return '收藏'
    if (filterFolderId.value) {
      const f = folders.value.find((f) => f.id === filterFolderId.value)
      return f ? `文件夹: ${f.label}` : '文件夹'
    }
    if (filterFormat.value) return `格式: ${filterFormat.value.toUpperCase()}`
    if (filterRatio.value) return `比例过滤`
    if (filterWidth.value && filterHeight.value) return `尺寸: ${filterWidth.value}×${filterHeight.value}`
    if (filterDuplicate.value) return '重复图片'
    return '全部照片'
  })

  async function refresh() {
    loading.value = true
    try {
      const baseFacetFilters = {
        q: searchQuery.value || undefined,
        favorite: showFavoritesOnly.value,
        folderId: filterFolderId.value,
        duplicate: filterDuplicate.value,
      }

      const [{ assets: list }, { assets: facetList }, { folders: fl }] = await Promise.all([
        api.listAssets({
          ...baseFacetFilters,
          format: filterFormat.value,
          ratio: filterRatio.value,
          width: filterWidth.value,
          height: filterHeight.value,
        }),
        api.listAssets(baseFacetFilters),
        api.listFolders(),
      ])
      assets.value = list
      facetAssets.value = facetList
      folders.value = fl
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    showFavoritesOnly.value = false
    filterFolderId.value = undefined
    filterFormat.value = undefined
    filterRatio.value = undefined
    filterWidth.value = undefined
    filterHeight.value = undefined
    filterDuplicate.value = false
    searchQuery.value = ''
  }

  async function scan() {
    if (!scanPath.value.trim()) return
    loading.value = true
    try {
      await api.scanFolder(scanPath.value.trim())
      await refresh()
    } finally {
      loading.value = false
    }
  }

  function toggleSelect(id: number) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function selectAll() {
    selectedIds.value = new Set(assets.value.map((a) => a.id))
  }

  function clearSelection() {
    selectedIds.value = new Set()
  }

  async function toggleFavorite(asset: ImageAsset) {
    const next = !asset.favorite
    await api.toggleFavorite(asset.id, next)
    asset.favorite = next
  }

  return {
    assets,
    facetAssets,
    folders,
    selectedIds,
    selectedAssets,
    searchQuery,
    showFavoritesOnly,
    viewTitle,
    loading,
    scanPath,
    filterFolderId,
    filterFormat,
    filterRatio,
    filterWidth,
    filterHeight,
    filterDuplicate,
    refresh,
    resetFilters,
    scan,
    toggleSelect,
    selectAll,
    clearSelection,
    toggleFavorite,
  }
})
