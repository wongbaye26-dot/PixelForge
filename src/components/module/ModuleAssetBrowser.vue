<script setup lang="ts">
import { NButton, NEmpty, NInput, NModal, NPagination } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { resolveMediaUrl } from '@/utils/media-url'
import ModuleAssetCard from './ModuleAssetCard.vue'
import type { ModuleAssetItem, ModuleBrowserView } from './types'

const props = withDefaults(
  defineProps<{
    title?: string
    items: ModuleAssetItem[]
    selectedIds: Set<number>
    activeId?: number | null
    loading?: boolean
    emptyHint?: string
    defaultView?: ModuleBrowserView
    pageSize?: number
    compactDrop?: boolean
    selectionMode?: 'multi' | 'single'
    showImportFolder?: boolean
    showDrop?: boolean
    showFooter?: boolean
    importLabel?: string
  }>(),
  {
    title: '素材',
    activeId: null,
    loading: false,
    emptyHint: '暂无图片',
    defaultView: 'grid',
    pageSize: 48,
    compactDrop: true,
    selectionMode: 'multi',
    showImportFolder: true,
    showDrop: true,
    showFooter: true,
    importLabel: '导入文件夹',
  },
)

const emit = defineEmits<{
  importFolder: []
  importDropped: [paths: string[]]
  refresh: []
  toggle: [id: number]
  setActive: [id: number]
  clearSelection: []
  removeSelected: []
}>()

const q = ref('')
const viewMode = ref<ModuleBrowserView>(props.defaultView)
const page = ref(1)
const preview = ref<ModuleAssetItem | null>(null)
const showPreview = ref(false)

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return props.items
  return props.items.filter((a) => a.filename.toLowerCase().includes(term))
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / props.pageSize)))

const paged = computed(() => {
  const start = (page.value - 1) * props.pageSize
  return filtered.value.slice(start, start + props.pageSize)
})

const previewSrc = computed(() =>
  preview.value ? resolveMediaUrl(`/api/assets/${preview.value.id}/preview`) : undefined,
)

const showDropExpanded = computed(() => !props.compactDrop || !props.items.length)

watch(
  () => filtered.value.length,
  () => {
    if (page.value > pageCount.value) page.value = pageCount.value
  },
)

watch(q, () => {
  page.value = 1
})

function isSelected(id: number) {
  return props.selectedIds.has(id)
}

function isActive(id: number) {
  return props.activeId != null && props.activeId === id
}

function onRowClick(id: number) {
  if (props.selectionMode === 'single') {
    emit('setActive', id)
    return
  }
  emit('toggle', id)
}

function onRowDblClick(id: number) {
  if (props.selectionMode === 'single') return
  emit('setActive', id)
}

function onGridClick(id: number) {
  if (props.selectionMode === 'single') {
    emit('setActive', id)
    return
  }
  emit('toggle', id)
}

function onGridDblClick(item: ModuleAssetItem) {
  if (props.selectionMode === 'single') {
    openPreview(item)
    return
  }
  emit('setActive', item.id)
}

function openPreview(item: ModuleAssetItem) {
  preview.value = item
  showPreview.value = true
}

async function onDrop(ev: DragEvent) {
  const files = Array.from(ev.dataTransfer?.files ?? [])
  const paths = files
    .map((f) => (f as File & { path?: string }).path)
    .filter((p): p is string => Boolean(p && p.trim()))
  if (!paths.length) return
  emit('importDropped', paths)
}
</script>

<template>
  <div class="pf-panel-shell browser">
    <div class="panel-head">
      <div class="title">{{ title }}</div>
      <div class="actions">
        <div class="view-switch" role="group" aria-label="视图切换">
          <button
            type="button"
            class="view-btn"
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
          >
            列表
          </button>
          <button
            type="button"
            class="view-btn"
            :class="{ active: viewMode === 'grid' }"
            @click="viewMode = 'grid'"
          >
            网格
          </button>
        </div>
        <NButton
          v-if="showImportFolder"
          size="small"
          secondary
          :loading="loading"
          @click="emit('importFolder')"
        >
          {{ importLabel }}
        </NButton>
        <NButton v-else size="small" secondary :loading="loading" @click="emit('refresh')">刷新</NButton>
      </div>
    </div>

    <div
      v-if="showDrop"
      class="drop"
      :class="{ compact: compactDrop && items.length }"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <div class="drop-title">{{ items.length ? '拖拽添加更多图片' : '拖拽图片到这里导入' }}</div>
      <div v-if="showDropExpanded" class="drop-sub">支持多选拖拽</div>
    </div>

    <div class="search">
      <NInput v-model:value="q" size="small" placeholder="搜索已导入图片…" clearable />
    </div>

    <div v-if="!filtered.length" class="empty-wrap">
      <NEmpty size="small" :description="emptyHint" />
    </div>

    <div v-else-if="viewMode === 'list'" class="list">
      <button
        v-for="a in paged"
        :key="a.id"
        type="button"
        class="row"
        :class="{ active: selectionMode === 'single' ? isActive(a.id) : isSelected(a.id) || isActive(a.id) }"
        @click="onRowClick(a.id)"
        @dblclick="onRowDblClick(a.id)"
      >
        <span v-if="selectionMode === 'multi'" class="check">{{ isSelected(a.id) ? '✓' : '' }}</span>
        <span v-else class="check">{{ isActive(a.id) ? '●' : '' }}</span>
        <span class="name" :title="a.filename">{{ a.filename }}</span>
        <span class="meta">{{ a.width }}×{{ a.height }}</span>
      </button>
    </div>

    <div v-else class="grid-body">
      <div class="module-asset-grid">
        <div v-for="a in paged" :key="a.id" class="module-grid-cell">
          <ModuleAssetCard
            :asset="a"
            :selected="selectionMode === 'multi' && isSelected(a.id)"
            :active="selectionMode === 'single' ? isActive(a.id) : isActive(a.id) || isSelected(a.id)"
            @click="onGridClick(a.id)"
            @dblclick="onGridDblClick(a)"
          />
        </div>
      </div>
    </div>

    <div v-if="filtered.length > pageSize" class="pager">
      <NPagination v-model:page="page" :page-count="pageCount" size="small" :page-slot="5" />
      <span class="pager-meta">共 {{ filtered.length }} 张，每页 {{ pageSize }} 张</span>
    </div>

    <div v-if="showFooter && selectionMode === 'multi'" class="panel-foot">
      <div class="sel">已选 {{ selectedIds.size }} 张</div>
      <div class="foot-actions">
        <NButton size="small" tertiary :disabled="!selectedIds.size" @click="emit('clearSelection')">清空</NButton>
        <NButton size="small" secondary type="error" :disabled="!selectedIds.size" @click="emit('removeSelected')">
          移出列表
        </NButton>
      </div>
    </div>

    <NModal v-model:show="showPreview" preset="card" style="width: 90vw; max-width: 1200px">
      <template #header>预览: {{ preview?.filename }}</template>
      <div class="preview">
        <img v-if="preview" :src="previewSrc" class="preview-img" alt="" />
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.browser {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.view-switch {
  display: inline-flex;
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 82%, transparent);
  border-radius: var(--pf-radius-sm);
  overflow: hidden;
  flex-shrink: 0;
}
.view-btn {
  border: none;
  background: transparent;
  color: var(--pf-text-secondary);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  cursor: pointer;
}
.view-btn.active {
  background: var(--pf-primary-soft);
  color: var(--pf-text);
}
.drop.compact {
  padding: 8px 12px;
}
.drop.compact .drop-title {
  font-size: 11px;
}
.empty-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 0;
}
.list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.grid-body {
  flex: 1 1 0;
  min-height: 180px;
  overflow: auto;
}
.module-asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
  gap: 12px;
  padding: 12px;
  align-content: start;
}
.module-grid-cell {
  min-width: 0;
  display: block;
}
.pager {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-top: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  background: var(--pf-bg-soft);
}
.pager-meta {
  font-size: 11px;
  color: var(--pf-text-secondary);
  font-weight: 600;
  white-space: nowrap;
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
