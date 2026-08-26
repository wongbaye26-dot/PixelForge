import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { isLibraryViewEnabled } from '@/featureFlags'
import { useUiStore } from '@/stores/ui'
import { useExportStore } from '@/stores/export'
import { useExportSizeStore } from '@/stores/export-size'
import { useBatchStore } from '@/modules/batch/stores/batch'
import { useCompressStore } from '@/modules/compress/stores/compress'
import { useConvertStore } from '@/modules/convert/stores/convert'
import { useExportMatcherStore } from '@/modules/export-matcher/stores/export-matcher'
import { useSmartExportSizeStore } from '@/modules/smart-export/stores/smart-export-size'
import { useEditStore } from '@/modules/edit/stores/edit'
import { useAiStore } from '@/modules/ai/stores/ai'
import { useOcrStore } from '@/modules/ocr/stores/ocr'
import type { BatchSettings } from '@/modules/batch/types'
import type { CompressSettings } from '@/modules/compress/types'
import type { ConvertSettings } from '@/modules/convert/types'
import type { EditParams } from '@/modules/edit/types'
import type { AiParams } from '@/modules/ai/types'
import type { OcrLang } from '@/modules/ocr/types'
import type { ExportFormat, FitMode } from '@/types'
import type { LibraryView } from '@/stores/ui'

const STORAGE_KEY = 'pixel-forge:beta-settings:v1'

interface PersistedSettings {
  version: 1
  ui: {
    isDark: boolean
    galleryLayout: 'comfortable' | 'compact' | 'detail'
    gallerySort: 'imported_desc' | 'filename_asc' | 'size_desc' | 'resolution_desc'
    libraryView: LibraryView
  }
  export: {
    formats: ExportFormat[]
    fitMode: FitMode
    quality: number
    targetSizeKb?: number
    namingPattern: string
    outputDir: string
    sizeInput: string
    enabledSizeKeys: string[]
  }
  batch: BatchSettings
  compress: CompressSettings
  convert: ConvertSettings
  smartExport: {
    enabled: boolean
    autoPickBestImage: boolean
    autoRecommendMode: boolean
    autoCompressOptimize: boolean
    autoBackgroundOptimize: boolean
    avoidUpscale: boolean
    preferSlightDownscale: boolean
    avoidOversize: boolean
    highQualityFirst: boolean
    debugMode: boolean
    format: ExportFormat
    quality: number
    targetSizeKb?: number
    namingPattern: string
    sizeInput: string
    enabledSizeKeys: string[]
  }
  edit: EditParams
  ai: AiParams
  ocr: { lang: OcrLang }
}

type StoredSettings = {
  version?: 1
  ui?: Partial<PersistedSettings['ui']>
  export?: Partial<PersistedSettings['export']>
  batch?: Partial<BatchSettings>
  compress?: Partial<CompressSettings>
  convert?: Partial<ConvertSettings>
  smartExport?: Partial<PersistedSettings['smartExport']>
  edit?: Partial<EditParams>
  ai?: Partial<AiParams>
  ocr?: Partial<{ lang: OcrLang }>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function readLocalSettings(): StoredSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSettings) : null
  } catch {
    return null
  }
}

async function readDesktopSettings(): Promise<StoredSettings | null> {
  try {
    return (await window.pixelForge?.readUserSettings?.()) as StoredSettings | null
  } catch {
    return null
  }
}

function writeLocalSettings(snapshot: PersistedSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

async function writeDesktopSettings(snapshot: PersistedSettings) {
  try {
    await window.pixelForge?.writeUserSettings?.(snapshot as unknown as Record<string, unknown>)
  } catch {
  }
}

function mergeSnapshots(
  desktopSnapshot: StoredSettings | null,
  localSnapshot: StoredSettings | null,
): StoredSettings {
  return {
    ...(desktopSnapshot ?? {}),
    ...(localSnapshot ?? {}),
    ui: {
      ...(desktopSnapshot?.ui ?? {}),
      ...(localSnapshot?.ui ?? {}),
    },
    export: {
      ...(desktopSnapshot?.export ?? {}),
      ...(localSnapshot?.export ?? {}),
    },
    batch: {
      ...(desktopSnapshot?.batch ?? {}),
      ...(localSnapshot?.batch ?? {}),
    } as Partial<BatchSettings>,
    compress: {
      ...(desktopSnapshot?.compress ?? {}),
      ...(localSnapshot?.compress ?? {}),
    } as Partial<CompressSettings>,
    convert: {
      ...(desktopSnapshot?.convert ?? {}),
      ...(localSnapshot?.convert ?? {}),
    } as Partial<ConvertSettings>,
    smartExport: {
      ...(desktopSnapshot?.smartExport ?? {}),
      ...(localSnapshot?.smartExport ?? {}),
    },
    edit: {
      ...(desktopSnapshot?.edit ?? {}),
      ...(localSnapshot?.edit ?? {}),
    },
    ai: {
      ...(desktopSnapshot?.ai ?? {}),
      ...(localSnapshot?.ai ?? {}),
    },
    ocr: {
      ...(desktopSnapshot?.ocr ?? {}),
      ...(localSnapshot?.ocr ?? {}),
    },
  }
}

export const useSettingsStore = defineStore('settingsStore', () => {
  const ready = ref(false)
  const saving = ref(false)
  let unwatchPersist: (() => void) | null = null

  function buildSnapshot(): PersistedSettings {
    const ui = useUiStore()
    const exportStore = useExportStore()
    const exportSize = useExportSizeStore()
    const batch = useBatchStore()
    const compress = useCompressStore()
    const convert = useConvertStore()
    const matcher = useExportMatcherStore()
    const smartSizes = useSmartExportSizeStore()
    const edit = useEditStore()
    const ai = useAiStore()
    const ocr = useOcrStore()

    return {
      version: 1,
      ui: {
        isDark: ui.isDark,
        galleryLayout: ui.galleryLayout,
        gallerySort: ui.gallerySort,
        libraryView: isLibraryViewEnabled(ui.libraryView) ? ui.libraryView : 'all',
      },
      export: {
        formats: [...exportStore.formats],
        fitMode: exportStore.fitMode,
        quality: exportStore.quality,
        targetSizeKb: exportStore.targetSizeKb,
        namingPattern: exportStore.namingPattern,
        outputDir: exportStore.outputDir,
        sizeInput: exportSize.sizeInput,
        enabledSizeKeys: [...exportSize.enabledSizeKeys],
      },
      batch: clone(batch.settings),
      compress: clone(compress.settings),
      convert: clone(convert.settings),
      smartExport: {
        enabled: matcher.enabled,
        autoPickBestImage: matcher.autoPickBestImage,
        autoRecommendMode: matcher.autoRecommendMode,
        autoCompressOptimize: matcher.autoCompressOptimize,
        autoBackgroundOptimize: matcher.autoBackgroundOptimize,
        avoidUpscale: matcher.avoidUpscale,
        preferSlightDownscale: matcher.preferSlightDownscale,
        avoidOversize: matcher.avoidOversize,
        highQualityFirst: matcher.highQualityFirst,
        debugMode: matcher.debugMode,
        format: matcher.format,
        quality: matcher.quality,
        targetSizeKb: matcher.targetSizeKb,
        namingPattern: matcher.namingPattern,
        sizeInput: smartSizes.sizeInput,
        enabledSizeKeys: [...smartSizes.enabledSizeKeys],
      },
      edit: clone(edit.params),
      ai: clone(ai.params),
      ocr: { lang: ocr.lang },
    }
  }

  async function persist() {
    if (!ready.value || saving.value) return
    saving.value = true
    try {
      const snapshot = buildSnapshot()
      writeLocalSettings(snapshot)
      await writeDesktopSettings(snapshot)
    } finally {
      saving.value = false
    }
  }

  function ensurePersistWatcher() {
    if (unwatchPersist) return
    unwatchPersist = watch(buildSnapshot, () => {
      void persist()
    }, { deep: true })
  }

  async function init() {
    if (ready.value) return

    const ui = useUiStore()
    const exportStore = useExportStore()
    const exportSize = useExportSizeStore()
    const batch = useBatchStore()
    const compress = useCompressStore()
    const convert = useConvertStore()
    const matcher = useExportMatcherStore()
    const smartSizes = useSmartExportSizeStore()
    const edit = useEditStore()
    const ai = useAiStore()
    const ocr = useOcrStore()

    await exportStore.loadExportDir()

    const [desktopSnapshot, localSnapshot] = await Promise.all([
      readDesktopSettings(),
      Promise.resolve(readLocalSettings()),
    ])
    const snapshot = mergeSnapshots(desktopSnapshot, localSnapshot)

    const uiSettings = snapshot.ui
    if (uiSettings) {
      if (typeof uiSettings.isDark === 'boolean') ui.isDark = uiSettings.isDark
      if (uiSettings.galleryLayout) ui.galleryLayout = uiSettings.galleryLayout
      if (uiSettings.gallerySort) ui.gallerySort = uiSettings.gallerySort
      if (uiSettings.libraryView && isLibraryViewEnabled(uiSettings.libraryView)) {
        ui.libraryView = uiSettings.libraryView
      } else {
        ui.libraryView = 'all'
      }
    }

    const exportSettings = snapshot.export
    if (exportSettings) {
      if (Array.isArray(exportSettings.formats) && exportSettings.formats.length) {
        exportStore.formats = exportSettings.formats
      }
      if (exportSettings.fitMode) exportStore.fitMode = exportSettings.fitMode
      if (typeof exportSettings.quality === 'number') exportStore.quality = exportSettings.quality
      if ('targetSizeKb' in exportSettings) exportStore.targetSizeKb = exportSettings.targetSizeKb
      if (typeof exportSettings.namingPattern === 'string') exportStore.namingPattern = exportSettings.namingPattern
      if (typeof exportSettings.sizeInput === 'string') exportSize.sizeInput = exportSettings.sizeInput
      exportSize.parseSizes()
      if (Array.isArray(exportSettings.enabledSizeKeys)) {
        exportSize.enabledSizeKeys = new Set(exportSettings.enabledSizeKeys)
      }
      if (typeof exportSettings.outputDir === 'string' && exportSettings.outputDir.trim()) {
        exportStore.outputDir = exportSettings.outputDir.trim()
        if (exportStore.outputDir !== exportStore.defaultOutputDir) {
          try {
            await exportStore.saveExportDir(exportStore.outputDir)
          } catch {
          }
        }
      }
    }

    if (snapshot.batch) batch.settings = { ...batch.settings, ...clone(snapshot.batch) }
    if (snapshot.compress) compress.settings = { ...compress.settings, ...clone(snapshot.compress) }
    if (snapshot.convert) convert.settings = { ...convert.settings, ...clone(snapshot.convert) }

    const smartExport = snapshot.smartExport
    if (smartExport) {
      if (typeof smartExport.enabled === 'boolean') matcher.enabled = smartExport.enabled
      if (typeof smartExport.autoPickBestImage === 'boolean') matcher.autoPickBestImage = smartExport.autoPickBestImage
      if (typeof smartExport.autoRecommendMode === 'boolean') matcher.autoRecommendMode = smartExport.autoRecommendMode
      if (typeof smartExport.autoCompressOptimize === 'boolean') matcher.autoCompressOptimize = smartExport.autoCompressOptimize
      if (typeof smartExport.autoBackgroundOptimize === 'boolean') matcher.autoBackgroundOptimize = smartExport.autoBackgroundOptimize
      if (typeof smartExport.avoidUpscale === 'boolean') matcher.avoidUpscale = smartExport.avoidUpscale
      if (typeof smartExport.preferSlightDownscale === 'boolean') matcher.preferSlightDownscale = smartExport.preferSlightDownscale
      if (typeof smartExport.avoidOversize === 'boolean') matcher.avoidOversize = smartExport.avoidOversize
      if (typeof smartExport.highQualityFirst === 'boolean') matcher.highQualityFirst = smartExport.highQualityFirst
      if (typeof smartExport.debugMode === 'boolean') matcher.debugMode = smartExport.debugMode
      if (smartExport.format) matcher.format = smartExport.format
      if (typeof smartExport.quality === 'number') matcher.quality = smartExport.quality
      if ('targetSizeKb' in smartExport) matcher.targetSizeKb = smartExport.targetSizeKb
      if (typeof smartExport.namingPattern === 'string') matcher.namingPattern = smartExport.namingPattern
      if (typeof smartExport.sizeInput === 'string') smartSizes.sizeInput = smartExport.sizeInput
      smartSizes.parseSizes()
      if (Array.isArray(smartExport.enabledSizeKeys)) {
        smartSizes.enabledSizeKeys = new Set(smartExport.enabledSizeKeys)
      }
    }

    if (snapshot.edit) edit.params = { ...edit.params, ...clone(snapshot.edit) }
    if (snapshot.ai) ai.params = { ...ai.params, ...clone(snapshot.ai) }
    if (snapshot.ocr?.lang) ocr.lang = snapshot.ocr.lang

    ready.value = true
    ensurePersistWatcher()
    await persist()
  }

  return {
    ready,
    saving,
    init,
    persist,
  }
})
