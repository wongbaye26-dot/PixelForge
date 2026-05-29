import { onMounted } from 'vue'
import { useBatchStore } from '../stores/batch'

export function useBatchInit() {
  const batch = useBatchStore()
  onMounted(() => {
    if (!batch.settings.outputDir) {
      void batch.loadDefaultOutputDir()
    }
  })
}
