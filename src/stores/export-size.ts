import { defineStore } from 'pinia'
import { ref } from 'vue'
import { parseSizeList } from '@/core/size-parser'
import { formatSizeInputLines } from '@/data/export-size-presets'
import type { ParsedSize } from '@/types'

function sizeKey(s: ParsedSize) {
  return `${s.width}x${s.height}`
}

export const useExportSizeStore = defineStore('exportSize', () => {
  const sizeInput = ref('')
  const parsedSizes = ref<ParsedSize[]>([])
  const enabledSizeKeys = ref<Set<string>>(new Set())

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

  function setSizeEnabled(key: string, enabled: boolean) {
    const next = new Set(enabledSizeKeys.value)
    if (enabled) next.add(key)
    else next.delete(key)
    enabledSizeKeys.value = next
  }

  function activeSizes() {
    return parsedSizes.value.filter((s) => enabledSizeKeys.value.has(sizeKey(s)))
  }

  function applyTemplateSizes(
    sizes: Array<{ width: number; height: number; label?: string }>,
    formats?: string[],
  ) {
    sizeInput.value = formatSizeInputLines(sizes)
    parseSizes()
    if (formats?.length) {
      // formats applied by TemplatePanel via export store
    }
  }

  function appendSizeInput(text: string) {
    const next = text.trim()
    if (!next) return
    sizeInput.value = sizeInput.value.trim() ? `${sizeInput.value.trim()}\n${next}` : next
    parseSizes()
  }

  function clearParsedResults() {
    sizeInput.value = ''
    parsedSizes.value = []
    enabledSizeKeys.value = new Set()
  }

  return {
    sizeInput,
    parsedSizes,
    enabledSizeKeys,
    parseSizes,
    setSizeEnabled,
    activeSizes,
    applyTemplateSizes,
    appendSizeInput,
    clearParsedResults,
    sizeKey,
  }
})
