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
  const showRecentOnly = ref(false)
  const filterFolderId = ref<number | undefined>()
  const filterFormat = ref<string | undefined>()
  const filterRatio = ref<number | undefined>()
  const filterWidth = ref<number | undefined>()
  const filterHeight = ref<number | undefined>()
  const filterDuplicate = ref(false)
  const showTrashOnly = ref(false)
  const loading = ref(false)
  const lastRefreshError = ref<string | null>(null)
  const scanPath = ref('')

  const selectedAssets = computed(() =>
    assets.value.filter((a) => selectedIds.value.has(a.id)),
  )

  const viewTitle = computed(() => {
    if (showTrashOnly.value) return '回收站'
    if (showFavoritesOnly.value) return '收藏'
    if (showRecentOnly.value) return '最近导入'
    if (filterFolderId.value) {
      const f = folders.value.find((f) => f.id === filterFolderId.value)
      return f ? `文件夹: ${f.label}` : '文件夹'
    }
    if (filterFormat.value) return `格式: ${filterFormat.value.toUpperCase()}`
    if (filterWidth.value && filterHeight.value) return `尺寸: ${filterWidth.value}×${filterHeight.value}`
    if (filterRatio.value) return '比例筛选'
    if (filterDuplicate.value) return '重复图片'
    if (searchQuery.value.trim()) return `搜索: ${searchQuery.value.trim()}`
    return '全部照片'
  })

  async function refresh() {
    loading.value = true
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const baseFacetFilters = {
        q: searchQuery.value || undefined,
        favorite: showFavoritesOnly.value,
        recent: showRecentOnly.value,
        folderId: filterFolderId.value,
        duplicate: filterDuplicate.value,
        trash: showTrashOnly.value,
      }

      const [{ assets: list }, { folders: fl }] = await Promise.all([
        api.listAssets({
          ...baseFacetFilters,
          format: filterFormat.value,
          ratio: filterRatio.value,
          width: filterWidth.value,
          height: filterHeight.value,
        }),
        api.listFolders(),
      ])
      assets.value = list
      facetAssets.value = list
      folders.value = fl
      const thumbnailCount = list.filter((asset) => Boolean(asset.thumbnailUrl || asset.previewUrl)).length
      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
      console.info('[library] refresh', {
        loadTime: `${Math.round(endedAt - startedAt)}ms`,
        assetCount: list.length,
        thumbnailCount,
      })
      lastRefreshError.value = null
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法连接 Worker 服务'
      lastRefreshError.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    showFavoritesOnly.value = false
    showRecentOnly.value = false
    filterFolderId.value = undefined
    filterFormat.value = undefined
    filterRatio.value = undefined
    filterWidth.value = undefined
    filterHeight.value = undefined
    filterDuplicate.value = false
    showTrashOnly.value = false
    searchQuery.value = ''
  }

  async function moveToTrash(ids: number[]) {
    if (!ids.length) return
    await api.trashMove(ids)
    selectedIds.value = new Set()
    await refresh()
  }

  async function restoreFromTrash(ids: number[]) {
    if (!ids.length) return
    await api.trashRestore(ids)
    selectedIds.value = new Set()
    await refresh()
  }

  async function deleteFromTrash(ids: number[]) {
    if (!ids.length) return
    await api.trashDelete(ids)
    selectedIds.value = new Set()
    await refresh()
  }

  async function emptyTrash() {
    await api.trashEmpty()
    selectedIds.value = new Set()
    await refresh()
  }

  async function removeFolder(id: number) {
    const folder = folders.value.find((f) => f.id === id)
    const result = await api.removeFolder(id)
    const basePath = folder?.path ?? result.path
    if (basePath) {
      const normalized = basePath.replace(/[/\\]+$/, '')
      folders.value = folders.value.filter(
        (f) => f.path !== normalized && !f.path.startsWith(`${normalized}/`),
      )
    } else {
      folders.value = folders.value.filter((f) => f.id !== id)
    }
    if (filterFolderId.value === id) {
      filterFolderId.value = undefined
    } else if (basePath && folder?.path) {
      const stillFiltered = folders.value.some((f) => f.id === filterFolderId.value)
      if (!stillFiltered) filterFolderId.value = undefined
    }
    if (folder?.path) {
      const base = folder.path.replace(/[/\\]+$/, '')
      const nextSel = new Set(selectedIds.value)
      for (const asset of assets.value) {
        if (asset.path === base || asset.path.startsWith(`${base}/`)) {
          nextSel.delete(asset.id)
        }
      }
      selectedIds.value = nextSel
    }
    await refresh()
    return result
  }

  async function scan() {
    if (!scanPath.value.trim()) return
    loading.value = true
    try {
      const result = await api.scanFolder(scanPath.value.trim())
      if (showTrashOnly.value) {
        showTrashOnly.value = false
      }
      filterFolderId.value = undefined
      await refresh()
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : '目录不可访问'
      throw new Error(`扫描失败：${message}`)
    } finally {
      loading.value = false
    }
  }

  async function scanDroppedFiles(paths: string[]) {
    const cleaned = paths.map((p) => p.trim()).filter(Boolean)
    if (!cleaned.length) return
    loading.value = true
    try {
      await api.scanFiles(cleaned)
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : '文件不可访问'
      throw new Error(`导入失败：${message}`)
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

  async function setFavoriteForIds(ids: number[], favorite: boolean) {
    if (!ids.length) return
    await Promise.all(ids.map((id) => api.toggleFavorite(id, favorite)))

    const idSet = new Set(ids)
    for (const asset of assets.value) {
      if (idSet.has(asset.id)) asset.favorite = favorite
    }
    for (const asset of facetAssets.value) {
      if (idSet.has(asset.id)) asset.favorite = favorite
    }
  }

  return {
    assets,
    facetAssets,
    folders,
    selectedIds,
    selectedAssets,
    searchQuery,
    showFavoritesOnly,
    showRecentOnly,
    viewTitle,
    loading,
    lastRefreshError,
    scanPath,
    filterFolderId,
    filterFormat,
    filterRatio,
    filterWidth,
    filterHeight,
    filterDuplicate,
    showTrashOnly,
    refresh,
    resetFilters,
    scan,
    scanDroppedFiles,
    moveToTrash,
    restoreFromTrash,
    deleteFromTrash,
    emptyTrash,
    removeFolder,
    toggleSelect,
    selectAll,
    clearSelection,
    toggleFavorite,
    setFavoriteForIds,
  }
})
