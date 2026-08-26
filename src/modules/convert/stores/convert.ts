import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ConvertJob, ConvertSettings } from '../types'
import { listConvertJobs, submitConvert, cancelConvertJobs, retryConvertJob } from '../workers/convert-worker'
import { useModuleStoreLogic } from '@/core/module-store'

const CONVERT_DEFAULTS: ConvertSettings = {
  targetFormat: 'webp',
  quality: 90,
  keepExif: true,
  namingPattern: '{name}.{format}',
  outputDir: '',
}

function createJobPlaceholder(id: string, batchId: string): ConvertJob {
  return { id, batchId, assetId: 0, status: 'queued', progress: 0, outputPath: '' }
}

export const useConvertStore = defineStore('convert', () => {
  const base = useModuleStoreLogic<ConvertJob>({
    submitFn: (p) => submitConvert(p as Parameters<typeof submitConvert>[0]),
    listJobsFn: listConvertJobs,
    cancelJobsFn: cancelConvertJobs,
    retryJobFn: retryConvertJob,
    createJobPlaceholder,
    hasActive: true,
  })

  const settings = ref<ConvertSettings>({ ...CONVERT_DEFAULTS })

  async function loadDefaultOutputDir() {
    await base.loadDefaultOutputDir(settings.value)
  }

  async function chooseOutputDir() {
    await base.chooseOutputDir(settings.value)
  }

  async function startConvert() {
    if (!settings.value.outputDir) await loadDefaultOutputDir()
    const s = settings.value
    await base.submitJob({
      targetFormat: s.targetFormat,
      quality: s.quality,
      keepExif: s.keepExif,
      namingPattern: s.namingPattern,
      outputDir: s.outputDir || undefined,
    })
  }

  return {
    ...base,
    settings,
    loadDefaultOutputDir,
    chooseOutputDir,
    startConvert,
  }
})
