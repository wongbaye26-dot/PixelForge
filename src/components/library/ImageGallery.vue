<script setup lang="ts">
import {
  NInput,
  NButton,
  NEmpty,
  NSpin,
  NSlider,
  NSwitch,
  NSelect,
  NModal,
  useMessage,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import ExportTaskTable from './ExportTaskTable.vue'
import { resolveMediaUrl, assetDisplayUrl } from '@/utils/media-url'
import type { ImageAsset } from '@/types'

const library = useLibraryStore()
const ui = useUiStore()
const message = useMessage()

// Double click preview
const previewAsset = ref<ImageAsset | null>(null)
const showPreview = ref(false)

function handleDoubleClick(asset: ImageAsset) {
  previewAsset.value = asset
  showPreview.value = true
}

const previewSrc = computed(() =>
  previewAsset.value ? resolveMediaUrl(`/api/assets/${previewAsset.value.id}/preview`) : undefined,
)

const formatOptions = [
  { label: '全部格式', value: '' },
  { label: 'JPG', value: 'jpg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'GIF', value: 'gif' },
  { label: 'AVIF', value: 'avif' },
]

const ratioOptions = [
  { label: '全部比例', value: 0 },
  { label: '1:1 正方形', value: 1 },
  { label: '16:9 宽屏', value: 1.777 },
  { label: '9:16 竖屏', value: 0.562 },
  { label: '4:3 标准', value: 1.333 },
  { label: '3:4 竖向', value: 0.75 },
]

const selectedFormat = ref('')
const selectedRatio = ref(0)

watch(selectedFormat, (val) => {
  library.filterFormat = val || undefined
  library.refresh()
})

watch(selectedRatio, (val) => {
  library.filterRatio = val || undefined
  library.refresh()
})

const isElectron = typeof window !== 'undefined' && !!window.pixelForge?.isElectron

async function importFolder() {
  if (isElectron) {
    const p = await window.pixelForge?.pickFolder()
    if (p) {
      library.scanPath = p
      await library.scan()
    }
  } else {
    message.info('Web端暂不支持直接扫描文件夹，请使用 Electron 版本')
  }
}

function formatBadge(fmt: string) {
  return fmt.toUpperCase()
}

function toggleSelect(id: number) {
  library.toggleSelect(id)
}

function isSelected(id: number) {
  return library.selectedIds.has(id)
}

function handleBatchAction(action: string) {
  message.info(`执行批量操作: ${action}`)
}
</script>

<template>
  <div class="gallery">
    <header class="top-bar">
      <h2 class="page-title">{{ library.viewTitle }} <span class="count">({{ library.assets.length }})</span></h2>
      <div class="top-center">
        <NInput
          v-model:value="library.searchQuery"
          placeholder="搜索文件名、标签、尺寸..."
          clearable
          class="search"
          @keyup.enter="library.refresh()"
        >
          <template #prefix>🔍</template>
        </NInput>
      </div>
      <div class="top-right-actions">
        <button class="task-btn" @click="ui.showExportTasks = !ui.showExportTasks">
          导出任务 ({{ library.selectedIds.size }})
          <span v-if="library.selectedIds.size" class="dot"></span>
        </button>
      </div>
    </header>

    <div class="action-bar">
      <div class="action-left">
        <NButton size="small" secondary @click="importFolder">
          <template #icon>🖼️</template>
          导入图片
        </NButton>
        <NButton size="small" secondary @click="importFolder">
          <template #icon>📁</template>
          导入文件夹
        </NButton>
        
        <div class="divider"></div>
        
        <NSelect
          v-model:value="selectedFormat"
          :options="formatOptions"
          size="small"
          placeholder="筛选"
          class="filter-select"
        />
        <NSelect
          v-model:value="selectedRatio"
          :options="ratioOptions"
          size="small"
          placeholder="排序"
          class="filter-select"
        />
        <NSelect
          v-model:value="selectedRatio"
          :options="ratioOptions"
          size="small"
          placeholder="视图"
          class="filter-select"
        />
      </div>

      <div class="action-right">
        <button class="icon-action">⛶</button>
        <div class="zoom-control">
          <span>-</span>
          <div class="zoom-slider">
            <NSlider v-model:value="ui.thumbScale" :min="0.5" :max="2" :step="0.1" />
          </div>
          <span>+</span>
        </div>
      </div>
    </div>

    <div v-if="library.loading" class="loading-area">
      <NSpin size="large" />
    </div>

    <div v-else class="grid-area">
      <div
        v-if="library.assets.length"
        class="grid"
        :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${160 * ui.thumbScale}px, 1fr))` }"
      >
        <div
          v-for="asset in library.assets"
          :key="asset.id"
          class="card"
          :class="{ selected: isSelected(asset.id) }"
          @click="toggleSelect(asset.id)"
          @dblclick="handleDoubleClick(asset)"
        >
          <input
            type="checkbox"
            class="checkbox"
            :checked="isSelected(asset.id)"
            @click.stop="toggleSelect(asset.id)"
          />
          <img
            v-if="asset.previewUrl || asset.thumbnailUrl"
            :src="assetDisplayUrl(asset)"
            loading="lazy"
          />
          <div v-else class="img-placeholder" />
          <div class="overlay">
            <span v-if="library.filterDuplicate" class="dup-tag">重复</span>
            <span>{{ asset.width }}×{{ asset.height }}</span>
            <span class="fmt">{{ formatBadge(asset.format) }}</span>
          </div>
        </div>
        
        <div class="card add-card" @click="importFolder">
          <div class="add-icon">+</div>
          <div>导入更多图片</div>
          <div class="add-sub">支持拖拽导入</div>
        </div>
      </div>

      <NEmpty v-else description="暂无图片，请先导入" class="empty" />
    </div>

    <!-- Selected Preview Tray -->
    <div v-if="library.selectedIds.size > 0" class="selected-preview">
      <div class="tray-header">
        <span class="tray-title">已选图片 ({{ library.selectedIds.size }})</span>
        <div class="tray-actions">
          <NButton size="tiny" quaternary @click="library.clearSelection()">清空选择</NButton>
        </div>
      </div>
      <div class="tray-scroll">
        <div
          v-for="asset in library.selectedAssets"
          :key="asset.id"
          class="tray-card"
        >
          <img :src="assetDisplayUrl(asset)" />
          <div class="tray-overlay">
            <span class="tray-size">{{ asset.width }}×{{ asset.height }}</span>
            <span class="tray-fmt">{{ asset.format.toUpperCase() }}</span>
          </div>
          <button class="tray-remove" @click.stop="toggleSelect(asset.id)">×</button>
        </div>
      </div>
    </div>

    <div v-if="library.selectedIds.size > 0" class="selection-footer-floating">
      <div class="selection-info">
        已选择 {{ library.selectedIds.size }} 张
      </div>
      <div class="selection-actions">
        <NButton size="small" secondary @click="handleBatchAction('favorite')">
          <template #icon>★</template> 收藏
        </NButton>
        <NButton size="small" secondary @click="handleBatchAction('tag')">
          <template #icon>🏷️</template> 添加标签
        </NButton>
        <NButton size="small" secondary type="error" @click="handleBatchAction('delete')">
          <template #icon>🗑️</template> 删除
        </NButton>
      </div>
    </div>

    <!-- Preview Modal -->
    <NModal v-model:show="showPreview" preset="card" style="width: 90vw; max-width: 1200px">
      <template #header>图片预览: {{ previewAsset?.filename }}</template>
      <div class="preview-container">
        <img v-if="previewAsset" :src="previewSrc" class="preview-img" />
      </div>
    </NModal>

    <ExportTaskTable v-if="ui.showExportTasks" />
  </div>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--pf-bg);
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--pf-text);
}

.page-title .count {
  font-size: 13px;
  font-weight: 400;
  color: var(--pf-text-secondary);
  margin-left: 4px;
}

.top-center {
  flex: 1;
  max-width: 480px;
}

.task-btn {
  background: var(--pf-bg-elevated);
  border: 1px solid var(--pf-border);
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--pf-text);
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.task-btn:hover {
  background: var(--pf-bg-hover);
}

.task-btn .dot {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  background: var(--pf-danger);
  border-radius: 50%;
  border: 2px solid var(--pf-bg);
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--pf-bg);
  border-bottom: 1px solid var(--pf-border);
  gap: 12px;
  flex-wrap: wrap;
}

.action-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--pf-border);
  margin: 0 8px;
}

.filter-select {
  width: 100px;
}

.action-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.icon-action {
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--pf-text-secondary);
  cursor: pointer;
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--pf-text-secondary);
  white-space: nowrap;
}
.zoom-slider {
  width: clamp(84px, 14vw, 120px);
  height: 24px;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}
.zoom-slider :deep(.n-slider) {
  width: 100%;
  min-width: 0;
}
.zoom-slider :deep(.n-slider-rail) {
  height: 4px;
}
.zoom-slider :deep(.n-slider-fill) {
  height: 4px;
}
.zoom-slider :deep(.n-slider-handle) {
  width: 14px;
  height: 14px;
}
.zoom-slider :deep(.n-slider-handle::before) {
  width: 14px;
  height: 14px;
}

.grid-area {
  flex: 1;
  overflow-y: auto;
  background: var(--pf-bg-elevated);
  padding: 20px;
}

@media (max-width: 920px) {
  .filter-select {
    width: 92px;
  }
  .action-right {
    margin-left: auto;
  }
}

@media (max-width: 680px) {
  .action-right {
    width: 100%;
    justify-content: flex-end;
  }
  .zoom-slider {
    width: clamp(96px, 40vw, 180px);
  }
}

.grid {
  display: grid;
  gap: 20px;
}

.card {
  background: var(--pf-bg);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s;
  box-shadow: var(--pf-shadow);
  position: relative;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}

.card.selected {
  border-color: var(--pf-primary);
}

.card img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
}

.checkbox {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  width: 18px;
  height: 18px;
  accent-color: var(--pf-primary);
}

.overlay {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--pf-text-secondary);
  background: var(--pf-bg);
}

.add-card {
  border: 2px dashed var(--pf-border);
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--pf-text-secondary);
  box-shadow: none;
  aspect-ratio: 4/3;
}

.add-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.add-sub {
  font-size: 10px;
  opacity: 0.6;
}

.selected-preview {
  background: var(--pf-bg);
  border-top: 1px solid var(--pf-border);
  padding: 12px 20px;
  flex-shrink: 0;
}

.tray-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tray-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--pf-text);
}

.tray-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.tray-card {
  width: 100px;
  height: 75px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  border: 1px solid var(--pf-border);
}

.tray-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tray-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 6px;
  background: rgba(0,0,0,0.6);
  color: white;
  font-size: 8px;
  display: flex;
  justify-content: space-between;
}

.tray-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.7);
  color: white;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.selection-footer-floating {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--pf-bg);
  border: 1px solid var(--pf-border);
  padding: 6px 16px;
  border-radius: 100px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.selection-info {
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text);
  border-right: 1px solid var(--pf-border);
  padding-right: 16px;
}

.selection-actions {
  display: flex;
  gap: 6px;
}

.preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.preview-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.loading-area {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
