import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLibraryStore } from './library'
import { useUiStore } from './ui'
import type { AssetScope } from '@/types'

export const useAssetScopeStore = defineStore('assetScope', () => {
  const library = useLibraryStore()
  const ui = useUiStore()

  const currentScope = computed<AssetScope>(() => {
    if (library.showFavoritesOnly) {
      return { type: 'favorite', id: undefined, name: '收藏' }
    }
    if (library.filterFolderId != null) {
      const folder = library.folders.find(f => f.id === library.filterFolderId)
      return { type: 'folder', id: library.filterFolderId, name: folder?.label ?? '文件夹' }
    }
    if (ui.libraryView === 'recent') {
      return { type: 'recent', id: undefined, name: '最近导入' }
    }
    return { type: 'all', id: undefined, name: '全部照片' }
  })

  const scopeAssetCount = computed(() => library.assets.length)

  return {
    currentScope,
    scopeAssetCount,
  }
})
