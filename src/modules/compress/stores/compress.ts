import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CompressJob, CompressSettings } from '../types'
import { listCompressJobs, submitCompress, cancelCompressJobs, retryCompressJob } from '../workers/compress-worker'
import { useModuleStoreLogic } from '@/core/module-store'

function bytesToKb(n: number): number {
  return Math.round((n / 1024) * 10) / 10
}

const COMPRESS_DEFAULTS: CompressSettings = {
  outputFormat: 'auto',
  quality: 85,
  targetSizeKb: 300,
  mozjpeg: true,
  usePngquant: true,
  namingPattern: '{name}_compressed.{format}',
  outputDir: '',
}

function createJobPlaceholder(id: string, batchId: string): CompressJob {
  return { id, batchId, assetId: 0, status: 'queued', progress: 0, beforeBytes: 0, afterBytes: 0, format: '', outputPath: '' }
}

export const useCompressStore = defineStore('compress', () => {
  const base = useModuleStoreLogic<CompressJob>({
    submitFn: (p) => submitCompress(p as Parameters<typeof submitCompress>[0]),
    listJobsFn: listCompressJobs,
    cancelJobsFn: cancelCompressJobs,
    retryJobFn: retryCompressJob,
    createJobPlaceholder,
    hasActive: true,
  })

  const settings = ref<CompressSettings>({ ...COMPRESS_DEFAULTS })

  const activeCompare = computed(() => {
    const a = base.activeItem.value
    const j = base.activeJob.value as CompressJob | undefined
    if (!a) return null
    return {
      before: { bytes: a.size, kb: bytesToKb(a.size) },
      after: j?.afterBytes ? { bytes: j.afterBytes, kb: bytesToKb(j.afterBytes) } : null,
      savingPct: j?.afterBytes ? Math.max(0, Math.round(((a.size - j.afterBytes) / a.size) * 100)) : null,
    }
  })

  async function loadDefaultOutputDir() {
    await base.loadDefaultOutputDir(settings.value)
  }

  async function chooseOutputDir() {
    await base.chooseOutputDir(settings.value)
  }

  async function startCompress() {
    if (!settings.value.outputDir) await loadDefaultOutputDir()
    const s = settings.value
    await base.submitJob({
      outputFormat: s.outputFormat,
      quality: s.quality,
      targetSizeKb: s.targetSizeKb,
      mozjpeg: s.mozjpeg,
      usePngquant: s.usePngquant,
      namingPattern: s.namingPattern,
      outputDir: s.outputDir || undefined,
    })
  }

  return {
    ...base,
    settings,
    activeCompare,
    loadDefaultOutputDir,
    chooseOutputDir,
    startCompress,
  }
})
