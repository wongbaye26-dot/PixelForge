import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BatchFormat, BatchJob, BatchSettings } from '../types'
import { listBatchJobs, submitBatch, cancelBatchJobs, retryBatchJob } from '../workers/batch-worker'
import { useModuleStoreLogic } from '@/core/module-store'

const BATCH_DEFAULTS: BatchSettings = {
  resize: { enabled: true, width: 1920, height: 1080, fit: 'contain' },
  format: 'webp',
  quality: 90,
  namingPattern: '{name}_{op}.{format}',
  outputDir: '',
}

function createJobPlaceholder(id: string, batchId: string): BatchJob {
  return { id, batchId, assetId: 0, outputPath: '', status: 'queued', progress: 0 }
}

export const useBatchStore = defineStore('batch', () => {
  const base = useModuleStoreLogic<BatchJob>({
    submitFn: (p) => submitBatch(p as unknown as Parameters<typeof submitBatch>[0]),
    listJobsFn: listBatchJobs,
    cancelJobsFn: cancelBatchJobs,
    retryJobFn: retryBatchJob,
    createJobPlaceholder,
    hasActive: false,
  })

  const settings = ref<BatchSettings>({ ...BATCH_DEFAULTS })

  async function loadDefaultOutputDir() {
    await base.loadDefaultOutputDir(settings.value)
  }

  async function chooseOutputDir() {
    await base.chooseOutputDir(settings.value)
  }

  async function startExport() {
    if (!settings.value.outputDir) await loadDefaultOutputDir()
    const s = settings.value
    const resize = s.resize.enabled
      ? { width: s.resize.width, height: s.resize.height, fit: s.resize.fit }
      : undefined
    const format = s.format === 'original' ? undefined : (s.format as Exclude<BatchFormat, 'original'>)

    await base.submitJob({
      resize,
      format,
      quality: s.quality,
      namingPattern: s.namingPattern,
      outputDir: s.outputDir || undefined,
    })
  }

  return {
    ...base,
    settings,
    loadDefaultOutputDir,
    chooseOutputDir,
    startExport,
  }
})
