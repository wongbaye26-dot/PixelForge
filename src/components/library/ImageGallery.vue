<script setup lang="ts">
import {
  NInput,
  NButton,
  NSpin,
  NSlider,
  NSelect,
  NModal,
  useDialog,
} from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import ExportTaskTable from './ExportTaskTable.vue'
import { resolveMediaUrl, assetDisplayUrl } from '@/utils/media-url'
import type { ImageAsset } from '@/types'
import { useFeedback } from '@/composables/use-feedback'
import { featureFlags } from '@/featureFlags'

const dialog = useDialog()

type GalleryCell =
  | { kind: 'asset'; key: string; asset: ImageAsset; index: number }
  | { kind: 'add'; key: 'add-card' }

const GRID_GAP = 16
const ROW_BUFFER = 4
const SELECTED_PREVIEW_LIMIT = 50
const SELECTED_PREVIEW_COLLAPSE_THRESHOLD = 100

const library = useLibraryStore()
const tasks = useTasksStore()
const ui = useUiStore()
const feedback = useFeedback()

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

const sortOptions = [
  { label: '最近导入', value: 'imported_desc' },
  { label: '文件名 A-Z', value: 'filename_asc' },
  { label: '文件大小', value: 'size_desc' },
  { label: '分辨率', value: 'resolution_desc' },
]

const layoutOptions = [
  { label: '标准', value: 'comfortable' },
  { label: '紧凑', value: 'compact' },
  { label: '详情', value: 'detail' },
]

const formatOptions = [
  { label: '全部格式', value: '' },
  { label: 'JPG', value: 'jpg' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'GIF', value: 'gif' },
  { label: 'SVG', value: 'svg' },
  { label: 'AVIF', value: 'avif' },
]

const sizeTierOptions = [
  { label: '全部尺寸', value: 'all' },
  { label: '超大 4K+', value: '4k' },
  { label: '高清 1080P+', value: '1080p' },
  { label: '小图', value: 'small' },
]

const orientationOptions = [
  { label: '全部方向', value: 'all' },
  { label: '横向', value: 'landscape' },
  { label: '纵向', value: 'portrait' },
  { label: '正方形', value: 'square' },
]

const ratioFilterOptions = [
  { label: '全部比例', value: '' },
  { label: '16:9', value: '16:9' },
  { label: '4:3', value: '4:3' },
  { label: '1:1', value: '1:1' },
  { label: '3:2', value: '3:2' },
  { label: '9:16', value: '9:16' },
  { label: '21:9', value: '21:9' },
]

const favoriteFilterOptions = [
  { label: '全部状态', value: 'all' },
  { label: '仅收藏', value: 'favorite' },
  { label: '未收藏', value: 'unfavorite' },
]

const selectedFormatFilter = ref('')
const selectedSizeTier = ref<'all' | '4k' | '1080p' | 'small'>('all')
const selectedOrientation = ref<'all' | 'landscape' | 'portrait' | 'square'>('all')
const selectedRatioFilter = ref('')
const selectedFavoriteFilter = ref<'all' | 'favorite' | 'unfavorite'>('all')
const selectedSort = computed({
  get: () => ui.gallerySort,
  set: (value) => {
    ui.gallerySort = value
  },
})
const selectedLayout = computed({
  get: () => ui.galleryLayout,
  set: (value) => {
    ui.galleryLayout = value
  },
})
const gridAreaRef = ref<HTMLElement | null>(null)
const measureRowRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(0)
const contentWidth = ref(0)
const measuredRowHeight = ref(0)
const lastSelectedIndex = ref<number | null>(null)
let gridAreaObserver: ResizeObserver | null = null
let measureObserver: ResizeObserver | null = null

const gridMinWidth = computed(() => {
  const base = ui.galleryLayout === 'compact' ? 132 : ui.galleryLayout === 'detail' ? 196 : 160
  return Math.round(base * ui.thumbScale)
})

const sortedAssets = computed(() => {
  const list = [...library.assets]
  switch (ui.gallerySort) {
    case 'filename_asc':
      return list.sort((a, b) => a.filename.localeCompare(b.filename, 'zh-Hans-CN'))
    case 'size_desc':
      return list.sort((a, b) => b.size - a.size || b.id - a.id)
    case 'resolution_desc':
      return list.sort((a, b) => (b.width * b.height) - (a.width * a.height) || b.id - a.id)
    case 'imported_desc':
    default:
      return list.sort((a, b) => {
        const at = Date.parse(a.createdAt ?? '') || 0
        const bt = Date.parse(b.createdAt ?? '') || 0
        return bt - at || b.id - a.id
      })
  }
})

function parseRatioKey(key: string) {
  const [w, h] = key.split(':').map(Number)
  if (!w || !h) return null
  return w / h
}

function matchesOrientationFilter(
  asset: ImageAsset,
  orientation: 'all' | 'landscape' | 'portrait' | 'square',
) {
  if (orientation === 'all') return true
  const diff = Math.abs(asset.width - asset.height)
  if (orientation === 'square') return diff <= Math.max(2, Math.min(asset.width, asset.height) * 0.02)
  if (orientation === 'landscape') return asset.width > asset.height
  if (orientation === 'portrait') return asset.height > asset.width
  return true
}

function matchesRatioFilter(asset: ImageAsset, ratioKey: string) {
  const target = parseRatioKey(ratioKey)
  if (target == null) return true
  return Math.abs(asset.ratio - target) <= 0.06
}

const filteredAssets = computed(() => {
  const term = library.searchQuery.trim().toLowerCase()
  return sortedAssets.value.filter((asset) => {
    const format = asset.format.toLowerCase()
    const searchHit =
      !term ||
      asset.filename.toLowerCase().includes(term) ||
      asset.path.toLowerCase().includes(term) ||
      format.includes(term) ||
      (featureFlags.ENABLE_OCR && (asset.ocrText ?? '').toLowerCase().includes(term))
    if (!searchHit) return false
    if (selectedFormatFilter.value && format !== selectedFormatFilter.value) return false

    const area = asset.area ?? asset.width * asset.height
    if (selectedSizeTier.value === '4k') {
      if (!(asset.width >= 3840 || asset.height >= 2160 || area >= 3840 * 2160)) return false
    } else if (selectedSizeTier.value === '1080p') {
      if (!(asset.width >= 1920 || asset.height >= 1080 || area >= 1920 * 1080)) return false
    } else if (selectedSizeTier.value === 'small') {
      if (!(Math.max(asset.width, asset.height) < 1080)) return false
    }

    if (!matchesOrientationFilter(asset, selectedOrientation.value)) return false
    if (!matchesRatioFilter(asset, selectedRatioFilter.value)) return false

    if (selectedFavoriteFilter.value === 'favorite' && !asset.favorite) return false
    if (selectedFavoriteFilter.value === 'unfavorite' && asset.favorite) return false

    return true
  })
})

const runningTaskCount = computed(() =>
  tasks.tasks.filter((t) => t.status === 'processing' || t.status === 'pending').length,
)

const selectedFavoriteCount = computed(() => library.selectedAssets.filter((asset) => asset.favorite).length)
const batchFavoriteLabel = computed(() =>
  selectedFavoriteCount.value === library.selectedAssets.length && library.selectedAssets.length > 0 ? '取消收藏' : '收藏',
)
const hasActiveGalleryFilters = computed(
  () =>
    Boolean(
      library.searchQuery.trim() ||
        selectedFormatFilter.value ||
        selectedSizeTier.value !== 'all' ||
        selectedOrientation.value !== 'all' ||
        selectedRatioFilter.value ||
        selectedFavoriteFilter.value !== 'all',
    ),
)
const activeGalleryFilterCount = computed(() => {
  let count = 0
  if (library.searchQuery.trim()) count += 1
  if (selectedFormatFilter.value) count += 1
  if (selectedSizeTier.value !== 'all') count += 1
  if (selectedOrientation.value !== 'all') count += 1
  if (selectedRatioFilter.value) count += 1
  if (selectedFavoriteFilter.value !== 'all') count += 1
  return count
})
const emptyStateTitle = computed(() =>
  library.assets.length && hasActiveGalleryFilters.value ? '没有匹配当前筛选条件的图片' : '图库中还没有图片',
)
const emptyStateDescription = computed(() =>
  library.assets.length && hasActiveGalleryFilters.value
    ? '尝试调整筛选条件或清空筛选，重新浏览全部结果。'
    : '从左侧资源管理导入或扫描目录，建立图库后可批量处理与导出。',
)
const rowTemplateColumns = computed(() => `repeat(${columnCount.value}, minmax(0, 1fr))`)
const rowWidth = computed(() => {
  const width = Math.max(contentWidth.value, gridMinWidth.value)
  return Math.max(gridMinWidth.value, (width - GRID_GAP * Math.max(0, columnCount.value - 1)) / columnCount.value)
})
const estimatedRowHeight = computed(() => {
  const mediaRatio = ui.galleryLayout === 'compact' ? 1 : ui.galleryLayout === 'detail' ? 0.8 : 0.75
  const bodyBase = ui.galleryLayout === 'detail' ? 88 : ui.galleryLayout === 'compact' ? 48 : 64
  const bodyHeight = Math.ceil(bodyBase * ui.thumbScale)
  return Math.ceil(rowWidth.value * mediaRatio + bodyHeight)
})
const rowHeight = computed(() => Math.max(estimatedRowHeight.value, measuredRowHeight.value || 0))
const rowStride = computed(() => rowHeight.value + GRID_GAP)
const columnCount = computed(() => {
  const width = Math.max(contentWidth.value, gridMinWidth.value)
  return Math.max(1, Math.floor((width + GRID_GAP) / (gridMinWidth.value + GRID_GAP)))
})
const gridCells = computed<GalleryCell[]>(() => {
  const cells: GalleryCell[] = filteredAssets.value.map((asset, index) => ({
    kind: 'asset' as const,
    key: `asset-${asset.id}`,
    asset,
    index,
  }))
  if (filteredAssets.value.length) {
    cells.push({ kind: 'add', key: 'add-card' })
  }
  return cells
})
const allRows = computed<GalleryCell[][]>(() => {
  if (!gridCells.value.length) return []
  const rows: GalleryCell[][] = []
  for (let index = 0; index < gridCells.value.length; index += columnCount.value) {
    rows.push(gridCells.value.slice(index, index + columnCount.value))
  }
  return rows
})
const visibleRowCount = computed(() => {
  const stride = Math.max(1, rowStride.value)
  return Math.max(1, Math.ceil((containerHeight.value + GRID_GAP) / stride))
})
const maxStartRow = computed(() => Math.max(0, allRows.value.length - visibleRowCount.value))
const startRow = computed(() => {
  const stride = Math.max(1, rowStride.value)
  const raw = Math.floor(scrollTop.value / stride) - ROW_BUFFER
  return Math.max(0, Math.min(maxStartRow.value, raw))
})
const endRow = computed(() =>
  Math.min(allRows.value.length, startRow.value + visibleRowCount.value + ROW_BUFFER * 2),
)
const visibleRows = computed(() =>
  allRows.value.slice(startRow.value, endRow.value).map((cells, offset) => ({
    index: startRow.value + offset,
    cells,
  })),
)
const topSpacerHeight = computed(() => startRow.value * rowStride.value)
const bottomSpacerHeight = computed(() => Math.max(0, allRows.value.length - endRow.value) * rowStride.value)
const totalContentHeight = computed(() =>
  allRows.value.length === 0
    ? 0
    : allRows.value.length * rowHeight.value + (allRows.value.length - 1) * GRID_GAP,
)
const measureRowCells = computed(() => allRows.value[0] ?? [])
const selectedPreviewAssets = computed(() => library.selectedAssets.slice(0, SELECTED_PREVIEW_LIMIT))
const selectedPreviewOverflow = computed(() => Math.max(0, library.selectedAssets.length - SELECTED_PREVIEW_LIMIT))
const selectedPreviewMode = computed(() => {
  if (library.selectedAssets.length > SELECTED_PREVIEW_COLLAPSE_THRESHOLD) return 'collapsed'
  if (library.selectedAssets.length > SELECTED_PREVIEW_LIMIT) return 'summary'
  return 'full'
})

const isElectron = typeof window !== 'undefined' && !!window.pixelForge?.isElectron

async function importFolder() {
  if (!isElectron) return
  const p = await window.pixelForge?.pickFolder()
  if (p) {
    try {
      library.scanPath = p
      const result = await library.scan()
      const total = (result?.added ?? 0) + (result?.updated ?? 0) + (result?.restored ?? 0)
      feedback.success(total > 0 ? `目录扫描完成，共 ${total} 张图片` : '目录扫描完成')
    } catch (err) {
      feedback.error(err instanceof Error ? err.message : '目录扫描失败')
    }
  }
}

async function scanFromPath() {
  try {
    const result = await library.scan()
    const total = (result?.added ?? 0) + (result?.updated ?? 0) + (result?.restored ?? 0)
    feedback.success(total > 0 ? `目录扫描完成，共 ${total} 张图片` : '目录扫描完成')
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '目录扫描失败')
  }
}

async function onGalleryDrop(ev: DragEvent) {
  const files = Array.from(ev.dataTransfer?.files ?? [])
  const paths = files
    .map((f) => (f as File & { path?: string }).path)
    .filter((p): p is string => Boolean(p?.trim()))
  if (!paths.length) return

  try {
    await library.scanDroppedFiles(paths)
    feedback.success(`已导入 ${paths.length} 个文件`)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '拖拽导入失败')
  }
}

function formatBadge(fmt: string) {
  return fmt.toUpperCase()
}

function updateSelectedIds(ids: Iterable<number>) {
  library.selectedIds = new Set(ids)
}

function handleAssetClick(event: MouseEvent, asset: ImageAsset, index: number) {
  if (event.shiftKey && lastSelectedIndex.value !== null) {
    const [start, end] =
      lastSelectedIndex.value <= index ? [lastSelectedIndex.value, index] : [index, lastSelectedIndex.value]
    const rangeIds = filteredAssets.value.slice(start, end + 1).map((item) => item.id)
    const next = event.metaKey || event.ctrlKey ? new Set(library.selectedIds) : new Set<number>()
    rangeIds.forEach((id) => next.add(id))
    updateSelectedIds(next)
  } else if (event.metaKey || event.ctrlKey) {
    library.toggleSelect(asset.id)
  } else {
    updateSelectedIds([asset.id])
  }
  lastSelectedIndex.value = index
}

function toggleSelect(id: number, index?: number) {
  library.toggleSelect(id)
  if (typeof index === 'number') {
    lastSelectedIndex.value = index
  }
}

function removeSelected(id: number) {
  if (!library.selectedIds.has(id)) return
  const next = new Set(library.selectedIds)
  next.delete(id)
  updateSelectedIds(next)
}

function isSelected(id: number) {
  return library.selectedIds.has(id)
}

function formatDateTime(input?: string) {
  if (!input) return '—'
  const date = new Date(input.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return input
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function clearGalleryFilters() {
  library.searchQuery = ''
  selectedFormatFilter.value = ''
  selectedSizeTier.value = 'all'
  selectedOrientation.value = 'all'
  selectedRatioFilter.value = ''
  selectedFavoriteFilter.value = 'all'
}

function handleGridScroll(event: Event) {
  scrollTop.value = (event.target as HTMLElement).scrollTop
}

function syncGridMetrics() {
  if (!gridAreaRef.value) return
  const styles = window.getComputedStyle(gridAreaRef.value)
  const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
  const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom)
  containerHeight.value = Math.max(0, gridAreaRef.value.clientHeight - paddingY)
  contentWidth.value = Math.max(0, gridAreaRef.value.clientWidth - paddingX)
  scrollTop.value = gridAreaRef.value.scrollTop
}

function clampScrollPosition() {
  if (!gridAreaRef.value) return
  const maxScrollTop = Math.max(0, totalContentHeight.value - containerHeight.value)
  if (gridAreaRef.value.scrollTop > maxScrollTop) {
    gridAreaRef.value.scrollTop = maxScrollTop
    scrollTop.value = maxScrollTop
  }
}

function observeGridArea(element: HTMLElement | null) {
  gridAreaObserver?.disconnect()
  gridAreaObserver = null
  if (!element || typeof ResizeObserver === 'undefined') return
  gridAreaObserver = new ResizeObserver(() => {
    syncGridMetrics()
  })
  gridAreaObserver.observe(element)
}

function observeMeasureRow(element: HTMLElement | null) {
  measureObserver?.disconnect()
  measureObserver = null
  if (!element || typeof ResizeObserver === 'undefined') return
  measureObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    measuredRowHeight.value = Math.ceil(entry.contentRect.height)
  })
  measureObserver.observe(element)
}

const isTrashView = computed(() => ui.libraryView === 'trash')

async function handleMoveToTrash() {
  const ids = [...library.selectedIds]
  if (!ids.length) return
  try {
    await library.moveToTrash(ids)
    feedback.success(`已移入回收站 ${ids.length} 张`)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '移入回收站失败')
  }
}

async function handleRestoreFromTrash() {
  const ids = [...library.selectedIds]
  if (!ids.length) return
  try {
    await library.restoreFromTrash(ids)
    feedback.success(`已恢复 ${ids.length} 张`)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '恢复失败')
  }
}

async function handleDeleteFromTrash() {
  const ids = [...library.selectedIds]
  if (!ids.length) return
  dialog.warning({
    title: '永久删除',
    content: `确定永久删除已选的 ${ids.length} 张图片？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await library.deleteFromTrash(ids)
        feedback.success(`已永久删除 ${ids.length} 张`)
      } catch (err) {
        feedback.error(err instanceof Error ? err.message : '删除失败')
      }
    },
  })
}

function handleEmptyTrash() {
  dialog.warning({
    title: '清空回收站',
    content: '确定清空回收站中的所有图片？此操作不可恢复。',
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await library.emptyTrash()
        feedback.success('回收站已清空')
      } catch (err) {
        feedback.error(err instanceof Error ? err.message : '清空失败')
      }
    },
  })
}

async function handleBatchFavorite() {
  const ids = [...library.selectedIds]
  if (!ids.length) return
  try {
    const nextFavorite = selectedFavoriteCount.value !== library.selectedAssets.length
    await library.setFavoriteForIds(ids, nextFavorite)
    await library.refresh()
    const visibleIds = new Set(filteredAssets.value.map((asset) => asset.id))
    library.selectedIds = new Set(ids.filter((id) => visibleIds.has(id)))
    feedback.success(nextFavorite ? `已收藏 ${ids.length} 张图片` : `已取消收藏 ${ids.length} 张图片`)
  } catch {
    feedback.error('批量收藏更新失败，请稍后重试')
  }
}

onMounted(() => {
  syncGridMetrics()
  observeGridArea(gridAreaRef.value)
  observeMeasureRow(measureRowRef.value)
})

onBeforeUnmount(() => {
  gridAreaObserver?.disconnect()
  measureObserver?.disconnect()
})

watch(gridAreaRef, (element) => {
  observeGridArea(element)
  nextTick(() => {
    syncGridMetrics()
    clampScrollPosition()
  })
})

watch(measureRowRef, (element) => {
  observeMeasureRow(element)
})

watch(
  [filteredAssets, gridMinWidth, contentWidth, () => ui.galleryLayout, () => ui.thumbScale],
  async () => {
    measuredRowHeight.value = 0
    await nextTick()
    syncGridMetrics()
    clampScrollPosition()
    if (lastSelectedIndex.value !== null && lastSelectedIndex.value >= filteredAssets.value.length) {
      lastSelectedIndex.value = filteredAssets.value.length ? filteredAssets.value.length - 1 : null
    }
  },
  { deep: false },
)

watch([allRows, rowHeight, containerHeight], async () => {
  await nextTick()
  clampScrollPosition()
})
</script>

<template>
  <div class="gallery pf-gallery-shell">
    <div class="gallery-chrome">
      <header class="chrome-row chrome-row--head">
        <h2 class="chrome-title">
          <span class="chrome-title-text">{{ library.viewTitle }}</span>
          <span class="chrome-title-count">{{ filteredAssets.length }}</span>
        </h2>
        <NInput
          v-model:value="library.searchQuery"
          placeholder="搜索文件名、路径、格式、OCR…"
          clearable
          size="small"
          class="chrome-search"
        >
          <template #prefix>🔍</template>
        </NInput>
        <button
          type="button"
          class="chrome-task-btn"
          :class="{ active: ui.showExportTasks }"
          @click="ui.showExportTasks = !ui.showExportTasks"
        >
          导出任务
          <span v-if="tasks.tasks.length" class="chrome-task-badge">{{ tasks.tasks.length }}</span>
          <span v-if="runningTaskCount" class="chrome-task-dot" />
        </button>
      </header>

      <div class="chrome-row chrome-row--toolbar">
        <div class="chrome-toolbar">
          <div v-if="isTrashView" class="chrome-segment chrome-segment--trash">
            <NButton size="small" quaternary type="error" @click="handleEmptyTrash">
              清空回收站
            </NButton>
            <span class="chrome-vrule" aria-hidden="true" />
          </div>

          <div class="filter-bar">
            <NSelect
              v-model:value="selectedFormatFilter"
              :options="formatOptions"
              size="small"
              placeholder="格式"
              class="filter-chip"
            />
            <NSelect
              v-model:value="selectedSizeTier"
              :options="sizeTierOptions"
              size="small"
              placeholder="尺寸"
              class="filter-chip"
            />
            <NSelect
              v-model:value="selectedRatioFilter"
              :options="ratioFilterOptions"
              size="small"
              placeholder="比例"
              class="filter-chip"
            />
            <NSelect
              v-model:value="selectedOrientation"
              :options="orientationOptions"
              size="small"
              placeholder="方向"
              class="filter-chip"
            />
            <NSelect
              v-if="!library.showFavoritesOnly"
              v-model:value="selectedFavoriteFilter"
              :options="favoriteFilterOptions"
              size="small"
              placeholder="收藏"
              class="filter-chip"
            />
            <NSelect
              v-model:value="selectedSort"
              :options="sortOptions"
              size="small"
              placeholder="排序"
              class="filter-chip"
            />
            <NSelect
              v-model:value="selectedLayout"
              :options="layoutOptions"
              size="small"
              placeholder="视图"
              class="filter-chip"
            />
            <button
              v-if="hasActiveGalleryFilters"
              type="button"
              class="filter-reset"
              @click="clearGalleryFilters"
            >
              重置
              <span v-if="activeGalleryFilterCount" class="filter-reset-count">{{ activeGalleryFilterCount }}</span>
            </button>
          </div>

          <div class="chrome-segment chrome-segment--zoom">
            <span class="zoom-glyph">−</span>
            <div class="zoom-slider">
              <NSlider v-model:value="ui.thumbScale" :min="0.5" :max="2" :step="0.1" />
            </div>
            <span class="zoom-glyph">+</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="library.lastRefreshError" class="error-banner">
      <span>无法加载图库：{{ library.lastRefreshError }}</span>
      <NButton size="tiny" secondary @click="library.refresh()">重试</NButton>
    </div>

    <div v-if="library.loading" class="loading-area">
      <NSpin size="large" />
    </div>

    <div
      v-else
      ref="gridAreaRef"
      class="grid-area pf-gallery-card--grow"
      :style="{ '--thumb-scale': String(ui.thumbScale) }"
      @scroll.passive="handleGridScroll"
      @dragover.prevent
      @drop.prevent="onGalleryDrop"
    >
      <template v-if="filteredAssets.length">
        <div class="measure-layer" aria-hidden="true">
          <div
            ref="measureRowRef"
            class="virtual-row measure-row"
            :style="{ gridTemplateColumns: rowTemplateColumns }"
          >
            <template v-for="cell in measureRowCells" :key="`measure-${cell.key}`">
              <div
                v-if="cell.kind === 'asset'"
                class="card"
                :class="`layout-${ui.galleryLayout}`"
              >
                <div class="card-selection-badge">✓</div>
                <input type="checkbox" class="checkbox" />
                <div class="card-media">
                  <img
                    v-if="cell.asset.previewUrl || cell.asset.thumbnailUrl"
                    :src="assetDisplayUrl(cell.asset)"
                    loading="lazy"
                  />
                  <div v-else class="img-placeholder" />
                  <div class="overlay">
                    <span v-if="library.filterDuplicate" class="dup-tag">重复</span>
                    <span class="overlay-date">{{ formatDateTime(cell.asset.createdAt) }}</span>
                  </div>
                </div>
                <div class="card-body">
                  <div class="card-name-row">
                    <div class="detail-name">{{ cell.asset.filename }}</div>
                    <span class="format-chip">{{ formatBadge(cell.asset.format) }}</span>
                  </div>
                  <div class="detail-meta">
                    <span>{{ cell.asset.width }} × {{ cell.asset.height }}</span>
                    <span>{{ formatFileSize(cell.asset.size) }}</span>
                  </div>
                  <div v-if="ui.galleryLayout === 'detail'" class="detail-extra">
                    <span class="detail-path">{{ cell.asset.path }}</span>
                    <span>{{ formatDateTime(cell.asset.createdAt) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="card add-card" :class="{ disabled: !isElectron }">
                <div class="add-icon">{{ isElectron ? '+' : 'i' }}</div>
                <div class="add-title">{{ isElectron ? '扫描更多目录' : '桌面端可扫描目录' }}</div>
                <div class="add-sub">
                  {{ isElectron ? '继续扫描目录并补充到图库' : '当前环境仅支持浏览已入库图片' }}
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="virtual-grid-shell">
          <div class="spacer" :style="{ height: `${topSpacerHeight}px` }" />

          <div class="visible-rows">
            <div
              v-for="row in visibleRows"
              :key="`row-${row.index}`"
              class="virtual-row"
              :style="{ gridTemplateColumns: rowTemplateColumns, height: `${rowHeight}px` }"
            >
              <template v-for="cell in row.cells" :key="cell.key">
                <div
                  v-if="cell.kind === 'asset'"
                  class="card"
                  :class="[{ selected: isSelected(cell.asset.id) }, `layout-${ui.galleryLayout}`]"
                  @click="handleAssetClick($event, cell.asset, cell.index)"
                  @dblclick="handleDoubleClick(cell.asset)"
                >
                  <div class="card-selection-badge" :class="{ visible: isSelected(cell.asset.id) }">✓</div>
                  <input
                    type="checkbox"
                    class="checkbox"
                    :checked="isSelected(cell.asset.id)"
                    @click.stop="toggleSelect(cell.asset.id, cell.index)"
                  />
                  <div class="card-media">
                    <img
                      v-if="cell.asset.previewUrl || cell.asset.thumbnailUrl"
                      :src="assetDisplayUrl(cell.asset)"
                      loading="lazy"
                    />
                    <div v-else class="img-placeholder" />
                    <div class="overlay">
                      <span v-if="library.filterDuplicate" class="dup-tag">重复</span>
                      <span class="overlay-date">{{ formatDateTime(cell.asset.createdAt) }}</span>
                    </div>
                  </div>
                  <div class="card-body">
                    <div class="card-name-row">
                      <div class="detail-name" :title="cell.asset.filename">{{ cell.asset.filename }}</div>
                      <span class="format-chip">{{ formatBadge(cell.asset.format) }}</span>
                    </div>
                    <div class="detail-meta">
                      <span>{{ cell.asset.width }} × {{ cell.asset.height }}</span>
                      <span>{{ formatFileSize(cell.asset.size) }}</span>
                    </div>
                    <div v-if="ui.galleryLayout === 'detail'" class="detail-extra">
                      <span class="detail-path" :title="cell.asset.path">{{ cell.asset.path }}</span>
                      <span>{{ formatDateTime(cell.asset.createdAt) }}</span>
                    </div>
                  </div>
                </div>

                <div
                  v-else-if="isElectron"
                  class="card add-card"
                  @click="importFolder"
                >
                  <div class="add-icon">+</div>
                  <div class="add-title">扫描更多目录</div>
                  <div class="add-sub">继续扫描目录并补充到图库</div>
                </div>
                <div v-else class="card add-card disabled">
                  <div class="add-icon">i</div>
                  <div class="add-title">桌面端可扫描目录</div>
                  <div class="add-sub">当前环境仅支持浏览已入库图片</div>
                </div>
              </template>
            </div>
          </div>

          <div class="spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
        </div>
      </template>

      <div v-else class="empty-state">
        <div class="empty-illustration">🖼️</div>
        <h3 class="empty-title">{{ emptyStateTitle }}</h3>
        <p class="empty-description">{{ emptyStateDescription }}</p>
        <div class="empty-actions">
          <NButton v-if="hasActiveGalleryFilters" secondary @click="clearGalleryFilters">清空筛选</NButton>
          <NButton v-if="isElectron" type="primary" :loading="library.loading" @click="importFolder">扫描目录</NButton>
          <NButton v-else type="primary" :loading="library.loading" @click="scanFromPath">扫描目录</NButton>
        </div>
      </div>
    </div>

    <aside v-if="library.selectedIds.size > 0" class="selection-dock">
      <div class="selection-dock-side">
        <span class="selection-dock-count">{{ library.selectedIds.size }}</span>
        <span class="selection-dock-label">已选</span>
      </div>

      <div v-if="selectedPreviewMode === 'collapsed'" class="selection-dock-collapsed">
        大批量选择已折叠缩略图预览
      </div>
      <div v-else class="selection-dock-strip">
        <div
          v-for="asset in selectedPreviewAssets"
          :key="asset.id"
          class="selection-thumb"
          :title="asset.filename"
        >
          <img :src="assetDisplayUrl(asset)" alt="" />
          <button type="button" class="selection-thumb-remove" @click.stop="removeSelected(asset.id)">
            ×
          </button>
        </div>
        <div v-if="selectedPreviewMode === 'summary'" class="selection-thumb selection-thumb--more">
          +{{ selectedPreviewOverflow }}
        </div>
      </div>

      <div class="selection-dock-actions">
        <template v-if="isTrashView">
          <NButton size="small" quaternary @click="handleRestoreFromTrash">恢复</NButton>
          <NButton size="small" quaternary type="error" @click="handleDeleteFromTrash">永久删除</NButton>
        </template>
        <template v-else>
          <NButton size="small" quaternary @click="handleBatchFavorite">
            <template #icon>★</template>
            {{ batchFavoriteLabel }}
          </NButton>
          <NButton size="small" quaternary type="error" @click="handleMoveToTrash">移入回收站</NButton>
        </template>
        <NButton size="small" quaternary @click="library.clearSelection()">清空</NButton>
      </div>
    </aside>

    <!-- Preview Modal -->
    <NModal v-model:show="showPreview" preset="card" style="width: 90vw; max-width: 1200px">
      <template #header>图片预览: {{ previewAsset?.filename }}</template>
      <div class="preview-container">
        <img v-if="previewAsset" :src="previewSrc" class="preview-img" />
      </div>
    </NModal>

    <ExportTaskTable v-if="ui.showExportTasks" @close="ui.showExportTasks = false" />
  </div>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background: transparent;
}

.gallery-chrome {
  flex-shrink: 0;
  border-bottom: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 88%, transparent);
  background: color-mix(in srgb, var(--pf-bg-soft) 72%, var(--pf-bg));
}

.chrome-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0 clamp(12px, 1.6vw, 20px);
}

.chrome-row--head {
  min-height: 40px;
  padding-top: 8px;
  padding-bottom: 6px;
}

.chrome-row--toolbar {
  min-height: 36px;
  padding-top: 2px;
  padding-bottom: 8px;
  border-top: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 55%, transparent);
}

.chrome-title {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-shrink: 0;
  min-width: 0;
  max-width: min(200px, 28vw);
}

.chrome-title-text {
  font-size: 14px;
  font-weight: 800;
  color: var(--pf-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chrome-title-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  font-variant-numeric: tabular-nums;
}

.chrome-search {
  flex: 1;
  min-width: 140px;
}

.chrome-search :deep(.n-input) {
  background: var(--pf-bg);
  border-radius: var(--pf-radius-md);
  box-shadow: inset 0 0 0 var(--pf-border-width) color-mix(in srgb, var(--pf-border) 80%, transparent);
}

.chrome-search :deep(.n-input__input-el),
.chrome-search :deep(.n-input__placeholder) {
  font-size: 12px;
}

.chrome-task-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  height: 28px;
  padding: 0 10px;
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border) 78%, transparent);
  border-radius: var(--pf-radius-md);
  background: var(--pf-bg);
  color: var(--pf-text-secondary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  position: relative;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.chrome-task-btn:hover {
  background: var(--pf-bg-hover);
  color: var(--pf-text);
}

.chrome-task-btn.active {
  background: var(--pf-primary-soft);
  border-color: color-mix(in srgb, var(--pf-primary) 35%, var(--pf-border));
  color: var(--pf-primary);
}

.chrome-task-badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--pf-radius-pill);
  background: color-mix(in srgb, var(--pf-primary) 16%, transparent);
  color: var(--pf-primary);
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chrome-task-btn.active .chrome-task-badge {
  background: color-mix(in srgb, var(--pf-primary) 24%, transparent);
}

.chrome-task-dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 7px;
  height: 7px;
  background: var(--pf-danger);
  border-radius: 50%;
  border: 1.5px solid var(--pf-bg-soft);
}

.chrome-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.chrome-segment--trash {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.filter-bar {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 6px;
  border-radius: var(--pf-radius-md);
  background: color-mix(in srgb, var(--pf-bg) 88%, transparent);
  box-shadow: inset 0 0 0 var(--pf-border-width) color-mix(in srgb, var(--pf-border) 70%, transparent);
}

.filter-chip {
  flex: 1 1 84px;
  min-width: 72px;
  max-width: 108px;
}

.filter-chip :deep(.n-base-selection) {
  --n-height: 28px;
  border-radius: var(--pf-radius-sm);
  background: transparent;
  box-shadow: none;
}

.filter-chip :deep(.n-base-selection-label) {
  font-size: 11px;
}

.filter-reset {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: var(--pf-radius-sm);
  background: color-mix(in srgb, var(--pf-primary-soft) 55%, transparent);
  color: var(--pf-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.filter-reset:hover {
  background: var(--pf-primary-soft);
}

.filter-reset-count {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--pf-radius-pill);
  background: color-mix(in srgb, var(--pf-primary) 20%, transparent);
  font-size: 10px;
  font-weight: 800;
  line-height: 16px;
}

.chrome-vrule {
  width: 1px;
  height: 18px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--pf-border-color) 80%, transparent);
}

.chrome-segment--zoom {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  height: 28px;
  padding: 0 6px;
  border-radius: var(--pf-radius-md);
  background: var(--pf-bg);
  box-shadow: inset 0 0 0 var(--pf-border-width) color-mix(in srgb, var(--pf-border) 75%, transparent);
  color: var(--pf-text-secondary);
}

.zoom-glyph {
  width: 14px;
  text-align: center;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
  font-size: 12px;
}

.zoom-slider {
  width: 68px;
  height: 20px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.zoom-slider :deep(.n-slider) {
  width: 100%;
  min-width: 0;
}
.zoom-slider :deep(.n-slider-rail) {
  height: 3px;
}
.zoom-slider :deep(.n-slider-fill) {
  height: 3px;
}
.zoom-slider :deep(.n-slider-handle) {
  width: 12px;
  height: 12px;
}
.zoom-slider :deep(.n-slider-handle::before) {
  width: 12px;
  height: 12px;
}

.grid-area {
  flex: 1;
  overflow-y: auto;
  padding: clamp(var(--pf-gap-sm), 1.2vw, var(--pf-gap-lg)) clamp(var(--pf-gap-md), 1.6vw, var(--pf-gap-xl));
  position: relative;
  background: var(--pf-bg);
  min-height: 0;
}

@media (min-width: 1180px) {
  .filter-chip {
    max-width: 112px;
  }

  .zoom-slider {
    width: clamp(80px, 10vw, 108px);
  }
}

@media (max-width: 900px) {
  .chrome-row--head {
    flex-wrap: wrap;
    gap: 6px 8px;
    padding-top: 6px;
    padding-bottom: 4px;
  }

  .chrome-title {
    max-width: none;
    flex: 1 1 auto;
  }

  .chrome-search {
    order: 3;
    flex: 1 1 100%;
    min-width: 0;
  }

  .chrome-task-btn {
    margin-left: auto;
  }

  .chrome-toolbar {
    flex-wrap: wrap;
  }

  .filter-bar {
    flex: 1 1 100%;
    order: 1;
  }

  .chrome-segment--zoom {
    margin-left: auto;
    order: 2;
  }

  .selection-dock {
    flex-wrap: wrap;
    gap: 8px;
    min-height: auto;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .selection-dock-actions {
    width: 100%;
    padding-left: 0;
    border-left: none;
    border-top: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 70%, transparent);
    padding-top: 8px;
    justify-content: flex-end;
  }
}

.virtual-grid-shell {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.visible-rows {
  display: flex;
  flex-direction: column;
  gap: var(--pf-gap-lg);
}

.virtual-row {
  display: grid;
  gap: var(--pf-gap-lg);
  align-items: stretch;
  overflow: hidden;
}

.measure-row {
  height: auto;
  align-items: start;
  overflow: visible;
}

.measure-layer {
  position: absolute;
  left: clamp(var(--pf-gap-md), 1.6vw, var(--pf-gap-xl));
  right: clamp(var(--pf-gap-md), 1.6vw, var(--pf-gap-xl));
  top: 0;
  visibility: hidden;
  pointer-events: none;
  z-index: -1;
}

.spacer {
  flex: 0 0 auto;
  width: 100%;
}

.card {
  background: var(--pf-bg);
  border-radius: var(--pf-radius-md);
  overflow: hidden;
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 88%, transparent);
  transition:
    border-color var(--pf-transition-fast) var(--pf-ease-standard),
    box-shadow var(--pf-transition-fast) var(--pf-ease-standard),
    background-color var(--pf-transition-fast) var(--pf-ease-standard);
  box-shadow: none;
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.card:hover {
  border-color: color-mix(in srgb, var(--pf-primary) 24%, var(--pf-border-color));
  box-shadow: var(--pf-shadow-sm);
}

.card.selected {
  border-color: var(--pf-primary);
  background: color-mix(in srgb, var(--pf-primary-soft) 28%, var(--pf-bg));
  box-shadow: var(--pf-shadow-glow);
}

.card-media {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}

.img-placeholder {
  width: 100%;
  aspect-ratio: 4/3;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--pf-bg-hover) 80%, transparent),
    color-mix(in srgb, var(--pf-border) 40%, transparent)
  );
  border-radius: inherit;
}

.card.layout-compact .img-placeholder {
  aspect-ratio: 1/1;
}

.card.layout-detail .img-placeholder {
  aspect-ratio: 5/4;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 16px 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, #ff3b30 12%, var(--pf-bg));
  border: 1px solid color-mix(in srgb, #ff3b30 28%, transparent);
  color: var(--pf-text);
  font-size: 12px;
  font-weight: 600;
}

.card img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
}

.card.layout-compact img {
  aspect-ratio: 1/1;
}

.card.layout-detail img {
  aspect-ratio: 5/4;
}

.checkbox {
  position: absolute;
  top: var(--pf-gap-md);
  left: var(--pf-gap-md);
  z-index: 12;
  width: 22px;
  height: 22px;
  accent-color: var(--pf-primary);
  opacity: 0;
}

.card-selection-badge {
  position: absolute;
  top: var(--pf-gap-md);
  left: var(--pf-gap-md);
  z-index: 11;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--pf-radius-pill);
  background: rgba(15, 23, 42, 0.56);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  opacity: 0;
  transform: scale(0.9);
  transition:
    opacity var(--pf-transition-fast) var(--pf-ease-standard),
    transform var(--pf-transition-fast) var(--pf-ease-standard),
    background-color var(--pf-transition-fast) var(--pf-ease-standard);
}

.card:hover .card-selection-badge,
.card-selection-badge.visible {
  opacity: 1;
  transform: scale(1);
}

.card.selected .card-selection-badge {
  background: var(--pf-primary);
}

.overlay {
  position: absolute;
  inset: auto var(--pf-gap-md) var(--pf-gap-md) var(--pf-gap-md);
  padding: var(--pf-gap-xs) var(--pf-gap-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pf-gap-sm);
  font-size: 11px;
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.6);
  border-radius: var(--pf-radius-pill);
  backdrop-filter: blur(12px);
}

.overlay-date {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dup-tag {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--pf-gap-xs);
  min-height: 18px;
  border-radius: var(--pf-radius-pill);
  background: rgba(255, 255, 255, 0.18);
  font-weight: 700;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: calc(var(--pf-gap-xs) * var(--thumb-scale, 1));
  padding:
    calc(var(--pf-gap-sm) * var(--thumb-scale, 1))
    calc(var(--pf-gap-md) * var(--thumb-scale, 1))
    calc(var(--pf-gap-md) * var(--thumb-scale, 1));
  background: var(--pf-bg);
  flex-shrink: 0;
  margin-top: auto;
}

.card-name-row {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-sm);
}

.format-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 var(--pf-gap-xs);
  border-radius: var(--pf-radius-pill);
  background: var(--pf-bg-soft);
  color: var(--pf-text-secondary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.detail-info {
  display: contents;
}

.detail-name {
  font-size: calc(12px * var(--thumb-scale, 1));
  font-weight: 700;
  color: var(--pf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.detail-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pf-gap-sm);
  font-size: calc(11px * var(--thumb-scale, 1));
  color: var(--pf-text-secondary);
}

.detail-extra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pf-gap-sm);
  font-size: calc(11px * var(--thumb-scale, 1));
  color: var(--pf-text-secondary);
}

.detail-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-card {
  border: 1px dashed color-mix(in srgb, var(--pf-border) 90%, transparent);
  background: color-mix(in srgb, var(--pf-bg) 72%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--pf-text-secondary);
  box-shadow: none;
  aspect-ratio: 4/3;
  gap: var(--pf-gap-xs);
}

.add-card.disabled {
  opacity: 0.72;
  cursor: default;
}

.add-icon {
  font-size: 32px;
}

.add-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--pf-text);
}

.add-sub {
  font-size: 11px;
  opacity: 0.75;
  text-align: center;
  max-width: 180px;
}

.selection-dock {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 68px;
  padding: 8px clamp(12px, 1.6vw, 20px);
  border-top: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 88%, transparent);
  background: color-mix(in srgb, var(--pf-bg-soft) 80%, var(--pf-bg));
}

.selection-dock-side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 44px;
  gap: 2px;
}

.selection-dock-count {
  font-size: 18px;
  font-weight: 800;
  color: var(--pf-primary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.selection-dock-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  letter-spacing: 0.04em;
}

.selection-dock-collapsed {
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--pf-text-secondary);
}

.selection-dock-strip {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 0;
}

.selection-thumb {
  position: relative;
  flex-shrink: 0;
  width: 56px;
  height: 42px;
  border-radius: var(--pf-radius-sm);
  overflow: hidden;
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-primary) 35%, var(--pf-border));
  box-shadow: var(--pf-shadow-sm);
  background: var(--pf-bg);
}

.selection-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.selection-thumb--more {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text-secondary);
  background: var(--pf-bg-soft);
  border-color: color-mix(in srgb, var(--pf-border) 80%, transparent);
}

.selection-thumb-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.selection-thumb:hover .selection-thumb-remove {
  opacity: 1;
}

.selection-dock-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 10px;
  border-left: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 75%, transparent);
}

.selection-dock-actions :deep(.n-button) {
  --n-height: 30px;
  font-size: 12px;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: var(--pf-gap-2xl);
  border-radius: var(--pf-radius-xl);
  border: 1px dashed color-mix(in srgb, var(--pf-border) 90%, transparent);
  background: color-mix(in srgb, var(--pf-bg) 86%, transparent);
  box-shadow: var(--pf-shadow-sm);
  text-align: center;
}

.empty-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  margin-bottom: var(--pf-gap-lg);
  border-radius: 24px;
  font-size: 36px;
  background: color-mix(in srgb, var(--pf-primary-soft) 42%, var(--pf-bg));
  box-shadow: var(--pf-shadow-sm);
}

.empty-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--pf-text);
}

.empty-description {
  max-width: 420px;
  margin: var(--pf-gap-sm) 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--pf-text-secondary);
}

.empty-actions {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-sm);
  margin-top: var(--pf-gap-lg);
}
</style>
