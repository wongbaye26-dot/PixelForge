import { defineStore } from 'pinia'
import { ref } from 'vue'

export type LibraryView =
  | 'all'
  | 'recent'
  | 'favorites'
  | 'trash'
  | 'batch'
  | 'compress'
  | 'convert'
  | 'edit'
  | 'ai'
  | 'ocr'
  | 'folder'
  | 'tag'
  | 'format'
  | 'ratio'
  | 'size'
  | 'duplicate'
  | 'template_my'
  | 'template_common'
  | 'template_social'
  | 'template_ecommerce'
  | 'template_custom'

export const useUiStore = defineStore('ui', () => {
  const libraryView = ref<LibraryView>('all')
  const showExportTasks = ref(true)
  const thumbScale = ref(1)
  const rightTab = ref<'export' | 'edit' | 'metadata'>('export')
  const outputExpanded = ref(true)
  const compressExpanded = ref(false)
  const isDark = ref(true)

  function toggleTheme() {
    isDark.value = !isDark.value
  }

  return {
    libraryView,
    showExportTasks,
    thumbScale,
    rightTab,
    outputExpanded,
    compressExpanded,
    isDark,
    toggleTheme,
  }
})
