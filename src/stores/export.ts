import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import { parseSizeList } from '@/core/size-parser'
import type { ExportFormat, FitMode, ParsedSize } from '@/types'

function sizeKey(s: ParsedSize) {
  return `${s.width}x${s.height}`
}

export const useExportStore = defineStore('export', () => {
  const sizeInput = ref(
    '1920x1080\n1080x1920\n800x800\n1242x1660',
  )
  const parsedSizes = ref<ParsedSize[]>([])
  const enabledSizeKeys = ref<Set<string>>(new Set())
  const formats = ref<ExportFormat[]>(['original'])
  const fitMode = ref<FitMode>('contain')
  const quality = ref(90)
  const targetSizeKb = ref<number | undefined>(300)
  const namingPattern = ref('{name}_{size}.{format}')
  const outputDir = ref('')
  const defaultOutputDir = ref('')
  const exporting = ref(false)
  const lastResult = ref<{ total: number; completed: number; failed: number } | null>(null)

  async function loadSettings() {
    const [sizeRes, enabledRes] = await Promise.all([
      api.getSetting('size_input'),
      api.getSetting('enabled_size_keys'),
    ])
    if (sizeRes.value) {
      sizeInput.value = sizeRes.value
    }
    if (enabledRes.value) {
      enabledSizeKeys.value = new Set(enabledRes.value.split(','))
    }
    parseSizes()
  }

  async function persistSettings() {
    await Promise.all([
      api.setSetting('size_input', sizeInput.value),
      api.setSetting('enabled_size_keys', [...enabledSizeKeys.value].join(',')),
    ])
  }

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
    const parsed = parseSizeList(sizeInput.value)
    const prev = enabledSizeKeys.value
    const next = new Set<string>()
    for (const s of parsed) {
      const k = sizeKey(s)
      if (prev.size === 0 || prev.has(k)) next.add(k)
    }
    if (next.size === 0 && parsed.length > 0) {
      parsed.forEach((s) => next.add(sizeKey(s)))
    }
    parsedSizes.value = parsed
    enabledSizeKeys.value = next
  }

  function toggleSizeKey(key: string) {
    const next = new Set(enabledSizeKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    enabledSizeKeys.value = next
  }

  function setSizeEnabled(key: string, enabled: boolean) {
    const next = new Set(enabledSizeKeys.value)
    if (enabled) next.add(key)
    else next.delete(key)
    enabledSizeKeys.value = next
  }

  function activeSizes() {
    return parsedSizes.value.filter((s) => enabledSizeKeys.value.has(sizeKey(s)))
  }

  async function runExport(assetIds: number[]) {
    parseSizes()
    const sizes = activeSizes()
    if (sizes.length === 0 || assetIds.length === 0) return

    exporting.value = true
    try {
      const result = await api.exportBatch({
        assetIds,
        sizes: sizes.map((s) => ({ width: s.width, height: s.height })),
        formats: formats.value,
        fitMode: fitMode.value,
        quality: quality.value,
        targetSizeKb: targetSizeKb.value,
        namingPattern: namingPattern.value,
        outputDir: outputDir.value || undefined,
      })
      lastResult.value = {
        total: result.total,
        completed: result.completed,
        failed: result.failed,
      }
      return result
    } finally {
      exporting.value = false
    }
  }

  return {
    sizeInput,
    parsedSizes,
    enabledSizeKeys,
    formats,
    fitMode,
    quality,
    targetSizeKb,
    namingPattern,
    outputDir,
    defaultOutputDir,
    exporting,
    lastResult,
    loadSettings,
    persistSettings,
    loadExportDir,
    saveExportDir,
    resetExportDir,
    parseSizes,
    toggleSizeKey,
    setSizeEnabled,
    activeSizes,
    runExport,
    sizeKey,
  }
})
