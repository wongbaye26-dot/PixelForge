import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, type ExportTaskApiJob } from '@/api/client'
import { useExportSizeStore } from '@/stores/export-size'
import type { ExportFormat, FitMode } from '@/types'

export const useExportStore = defineStore('export', () => {
  const exportSizes = useExportSizeStore()
  const formats = ref<ExportFormat[]>(['original'])
  const fitMode = ref<FitMode>('cover')
  const quality = ref(90)
  const targetSizeKb = ref<number | undefined>(300)
  const mozjpeg = ref(true)
  const usePngquant = ref(true)
  const namingPattern = ref('{name}_{size}.{format}')
  const outputDir = ref('')
  const defaultOutputDir = ref('')
  const exporting = ref(false)
  const lastResult = ref<{ total: number; completed: number; failed: number } | null>(null)

  async function loadExportDir() {
    const { path, defaultPath } = await api.getExportDir()
    outputDir.value = path
    defaultOutputDir.value = defaultPath
  }

  async function saveExportDir(dir: string) {
    const { path } = await api.setExportDir(dir)
    outputDir.value = path
  }

  async function resetExportDir() {
    await saveExportDir(defaultOutputDir.value)
  }

  function parseSizes() {
    exportSizes.parseSizes()
  }

  function toggleSizeKey(key: string) {
    exportSizes.setSizeEnabled(key, !exportSizes.enabledSizeKeys.has(key))
  }

  function setSizeEnabled(key: string, enabled: boolean) {
    exportSizes.setSizeEnabled(key, enabled)
  }

  function activeSizes() {
    return exportSizes.activeSizes()
  }

  async function submitExport(assetIds: number[]) {
    exportSizes.parseSizes()
    const sizes = exportSizes.activeSizes()
    if (sizes.length === 0 || assetIds.length === 0) return

    exporting.value = true
    try {
      return await api.exportBatchSubmit({
        assetIds,
        sizes: sizes.map((s) => ({ width: s.width, height: s.height })),
        formats: formats.value,
        fitMode: fitMode.value,
        quality: quality.value,
        targetSizeKb: targetSizeKb.value,
        namingPattern: namingPattern.value,
        outputDir: outputDir.value || undefined,
        mozjpeg: mozjpeg.value,
        usePngquant: usePngquant.value,
      })
    } finally {
      exporting.value = false
    }
  }

  async function listExportJobs(batchId: string) {
    const result = await api.exportBatchJobs({ batchId })
    const jobs = result.jobs
    lastResult.value = {
      total: jobs.length,
      completed: jobs.filter((job) => job.status === 'completed').length,
      failed: jobs.filter((job) => job.status === 'failed').length,
    }
    return jobs
  }

  async function controlExportJob(id: string, action: 'pause' | 'resume' | 'cancel' | 'retry'): Promise<ExportTaskApiJob> {
    const result = await api.exportBatchControl(id, action)
    return result.job
  }

  return {
    sizeInput: exportSizes.sizeInput,
    parsedSizes: exportSizes.parsedSizes,
    enabledSizeKeys: exportSizes.enabledSizeKeys,
    formats,
    fitMode,
    quality,
    targetSizeKb,
    mozjpeg,
    usePngquant,
    namingPattern,
    outputDir,
    defaultOutputDir,
    exporting,
    lastResult,
    loadExportDir,
    saveExportDir,
    resetExportDir,
    parseSizes,
    toggleSizeKey,
    setSizeEnabled,
    activeSizes,
    submitExport,
    listExportJobs,
    controlExportJob,
    sizeKey: exportSizes.sizeKey,
  }
})
