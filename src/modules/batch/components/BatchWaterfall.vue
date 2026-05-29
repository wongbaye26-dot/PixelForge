<script setup lang="ts">
import { NEmpty, NModal } from 'naive-ui'
import { computed, ref } from 'vue'
import { resolveMediaUrl, assetDisplayUrl } from '@/utils/media-url'
import { useBatchStore } from '../stores/batch'
import type { BatchItem } from '../types'

const batch = useBatchStore()
const preview = ref<BatchItem | null>(null)
const showPreview = ref(false)

const previewSrc = computed(() => (preview.value ? resolveMediaUrl(`/api/assets/${preview.value.id}/preview`) : undefined))

function toggle(id: number) {
  batch.toggleSelect(id)
}

function openPreview(item: BatchItem) {
  preview.value = item
  showPreview.value = true
}
</script>

<template>
  <div class="wrap">
    <div v-if="!batch.items.length" class="empty">
      <NEmpty description="请先在左侧导入图片" />
    </div>

    <div v-else class="grid">
      <button
        v-for="a in batch.items"
        :key="a.id"
        type="button"
        class="card"
        :class="{ active: batch.selectedIds.has(a.id) }"
        @click="toggle(a.id)"
        @dblclick="openPreview(a)"
      >
        <div class="thumb-wrap">
          <img v-if="a.thumbnailUrl || a.previewUrl" :src="assetDisplayUrl(a)" alt="" class="thumb" loading="lazy" />
          <div v-else class="thumb ph" />
          <div class="check">{{ batch.selectedIds.has(a.id) ? '✓' : '' }}</div>
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
.wrap {
  height: 100%;
  background: var(--pf-bg-elevated);
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
}
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
  gap: 14px;
}
.card {
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--pf-bg);
  cursor: pointer;
  text-align: left;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-shadow: var(--pf-shadow);
  transition: transform 0.15s, border-color 0.15s;
}
.card:hover {
  transform: translateY(-2px);
}
.card.active {
  border-color: rgba(0, 122, 255, 0.6);
}
.thumb-wrap {
  position: relative;
}
.thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
}
.thumb.ph {
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
