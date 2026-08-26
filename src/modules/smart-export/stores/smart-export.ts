import { defineStore } from 'pinia'
import { useExportMatcherStore } from '@/modules/export-matcher/stores/export-matcher'

export const useSmartExportStore = defineStore('smartExport', () => {
  const matcher = useExportMatcherStore()
  return matcher
})

