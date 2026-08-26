<script setup lang="ts">
import { NTag } from 'naive-ui'
import { useOcrStore } from '../stores/ocr'
import ModuleAssetList from '@/components/module/ModuleAssetList.vue'
import type { ImageAsset } from '@/types'

const ocr = useOcrStore()

function searchFilter(asset: ImageAsset, term: string): boolean {
  return (
    asset.filename.toLowerCase().includes(term) ||
    (asset.ocrText ?? '').toLowerCase().includes(term)
  )
}
</script>

<template>
  <ModuleAssetList
    :active-id="ocr.activeAsset?.id ?? null"
    search-placeholder="搜索文件名 / OCR 文本…"
    :on-search-filter="searchFilter"
    @select="ocr.setActive($event)"
  >
    <template #row-extra="{ asset }">
      <NTag v-if="asset.ocrText" size="tiny" :bordered="false">OCR</NTag>
    </template>
  </ModuleAssetList>
</template>
