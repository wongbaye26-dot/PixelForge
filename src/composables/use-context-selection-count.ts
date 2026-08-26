import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useLibraryStore } from '@/stores/library'
import { useBatchStore } from '@/modules/batch/stores/batch'
import { useCompressStore } from '@/modules/compress/stores/compress'
import { useConvertStore } from '@/modules/convert/stores/convert'
import { useEditStore } from '@/modules/edit/stores/edit'

export function useContextSelectionCount() {
  const ui = useUiStore()
  const library = useLibraryStore()
  const batch = useBatchStore()
  const compress = useCompressStore()
  const convert = useConvertStore()
  const edit = useEditStore()

  const selectedCount = computed(() => {
    switch (ui.libraryView) {
      case 'batch':
        return batch.selectedIds.size
      case 'compress':
        return compress.selectedIds.size
      case 'convert':
        return convert.selectedIds.size
      case 'edit':
        return edit.activeAsset ? 1 : 0
      default:
        return library.selectedIds.size
    }
  })

  const selectionMetricLabel = computed(() => (ui.libraryView === 'edit' ? '当前图片' : '已选数量'))

  return { selectedCount, selectionMetricLabel }
}
