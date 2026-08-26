<script setup lang="ts">
import { NEmpty, NModal } from 'naive-ui'
import { computed, ref } from 'vue'
import { assetDisplayUrl, resolveMediaUrl } from '@/utils/media-url'
import { useConvertStore } from '../stores/convert'
import type { ConvertItem } from '../types'

const convert = useConvertStore()
const preview = ref<ConvertItem | null>(null)
const showPreview = ref(false)

const previewSrc = computed(() => (preview.value ? resolveMediaUrl(`/api/assets/${preview.value.id}/preview`) : undefined))

function toggle(id: number) {
  convert.toggleSelect(id)
}

function openPreview(item: ConvertItem) {
  convert.setActive(item.id)
  preview.value = item
  showPreview.value = true
}
</script>

<template>
  <div class="wrap pf-panel-shell">
    <div v-if="!convert.items.length" class="empty">
      <NEmpty description="请在左侧导入图片" />
    </div>

    <div v-else class="grid">
      <button
        v-for="a in convert.items"
        :key="a.id"
        type="button"
        class="card"
        :class="{ active: convert.selectedIds.has(a.id) }"
        @click="toggle(a.id)"
        @dblclick="openPreview(a)"
      >
        <div class="thumb-wrap">
          <img v-if="a.thumbnailUrl || a.previewUrl" :src="assetDisplayUrl(a)" alt="" class="thumb" loading="lazy" />
          <div v-else class="thumb ph" />
          <div class="check">{{ convert.selectedIds.has(a.id) ? '✓' : '' }}</div>
        </div>
        <div class="meta">
          <div class="name" :title="a.filename">{{ a.filename }}</div>
          <div class="sub">
            <span>{{ a.width }}×{{ a.height }}</span>
            <span>{{ a.format.toUpperCase() }}</span>
          </div>
        </div>
      </button>
    </div>

    <NModal v-model:show="showPreview" preset="card" style="width: 90vw; max-width: 1200px">
      <template #header>预览: {{ preview?.filename }}</template>
      <div class="preview">
        <img v-if="preview" :src="previewSrc" class="preview-img" />
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.grid {
  height: 100%;
  overflow: auto;
  padding: 14px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  grid-auto-rows: auto;
  align-items: start;
  gap: 14px;
}
.card {
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 82%, transparent);
  border-radius: var(--pf-radius-lg);
  overflow: hidden;
  background: color-mix(in srgb, var(--pf-bg) 96%, transparent);
  cursor: pointer;
  text-align: left;
  padding: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  box-shadow: var(--pf-shadow-sm);
  transition:
    transform var(--pf-transition-fast) var(--pf-ease-standard),
    border-color var(--pf-transition-fast) var(--pf-ease-standard),
    box-shadow var(--pf-transition-fast) var(--pf-ease-standard);
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--pf-shadow-md);
}
.card.active {
  border-color: color-mix(in srgb, var(--pf-primary) 42%, transparent);
  box-shadow: var(--pf-shadow-glow);
}
.thumb-wrap {
  position: relative;
  width: 100%;
  height: 108px;
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #121214;
}
.thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
}
.thumb.ph {
  width: 48px;
  height: 32px;
  border-radius: 6px;
  background: var(--pf-bg-hover);
}
.check {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 22px;
  height: 22px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 12px;
}
.meta {
  padding: 10px 12px 12px;
}
.name {
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--pf-text-secondary);
  font-weight: 600;
}
.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px;
}
.preview-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}
</style>
