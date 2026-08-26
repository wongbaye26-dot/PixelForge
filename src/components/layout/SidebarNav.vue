<script setup lang="ts">
import { NProgress, useDialog } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useUiStore, type LibraryView } from '@/stores/ui'
import logoUrl from '@/assets/logo.png'
import { useSystemMetricsStore } from '@/stores/system-metrics'
import { featureFlags } from '@/featureFlags'
import { APP_VERSION } from '@/constants/app'
import { useFeedback } from '@/composables/use-feedback'
import { api } from '@/api/client'
import type { LibraryFolder } from '@/types'

const appVersion = APP_VERSION

const library = useLibraryStore()
const ui = useUiStore()
const sys = useSystemMetricsStore()
const dialog = useDialog()
const feedback = useFeedback()

const assetCount = computed(() => library.assets.length)
const favoriteCount = computed(() => library.assets.filter((a) => a.favorite).length)
const trashCount = ref(0)

async function refreshTrashCount() {
  if (!featureFlags.ENABLE_TRASH) return
  try {
    const r = await api.trashCount()
    trashCount.value = r.count
  } catch {
    trashCount.value = 0
  }
}
const storageText = computed(() => {
  const usedGb = Math.round(sys.diskUsedBytes / 1024 / 1024 / 1024)
  const totalGb = Math.round(sys.diskTotalBytes / 1024 / 1024 / 1024)
  if (!totalGb) return '—'
  return `${usedGb}GB / ${totalGb}GB`
})

const expanded = ref({
  folder: true,
  tag: false,
  format: false,
  ratio: false,
  size: false,
})

watch(
  () => ui.libraryView,
  (view) => {
    if (view in expanded.value) {
      expanded.value[view as keyof typeof expanded.value] = true
    }
  },
  { immediate: true },
)

onMounted(() => {
  sys.start()
  void refreshTrashCount()
})

watch(
  () => library.assets.length,
  () => {
    void refreshTrashCount()
  },
)

onUnmounted(() => {
  sys.stop()
})

function toggleExpanded(view: keyof typeof expanded.value) {
  expanded.value[view] = !expanded.value[view]
}

const formatFacets = computed(() => {
  const counts = new Map<string, number>()
  for (const a of library.facetAssets.length ? library.facetAssets : library.assets) {
    const key = a.format?.toLowerCase?.() ?? ''
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const preferred = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'bmp', 'tiff']
  const ordered = preferred
    .filter((k) => counts.has(k))
    .map((k) => ({ value: k, count: counts.get(k) ?? 0 }))
  const rest = [...counts.entries()]
    .filter(([k]) => !preferred.includes(k))
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
  return [...ordered, ...rest]
})

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

const ratioFacets = computed(() => {
  const source = library.facetAssets.length ? library.facetAssets : library.assets
  const counts = new Map<string, { rw: number; rh: number; count: number; value: number }>()
  for (const a of source) {
    const w = Math.max(1, Math.round(a.width))
    const h = Math.max(1, Math.round(a.height))
    const g = gcd(w, h)
    const rw = Math.max(1, Math.round(w / g))
    const rh = Math.max(1, Math.round(h / g))
    const key = `${rw}:${rh}`
    const prev = counts.get(key)
    if (prev) prev.count += 1
    else counts.set(key, { rw, rh, count: 1, value: rw / rh })
  }
  return [...counts.entries()]
    .map(([label, v]) => ({ label, value: v.value, count: v.count }))
    .sort((a, b) => b.count - a.count || b.value - a.value)
})

const sizeFacets = computed(() => {
  const source = library.facetAssets.length ? library.facetAssets : library.assets
  const counts = new Map<string, { width: number; height: number; count: number }>()
  for (const a of source) {
    const key = `${a.width}x${a.height}`
    const prev = counts.get(key)
    if (prev) prev.count += 1
    else counts.set(key, { width: a.width, height: a.height, count: 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
})

function normalizeTokens(filename: string): string[] {
  const base = filename.replace(/\.[^.]+$/, '')
  return base
    .split(/[^0-9a-zA-Z\u4e00-\u9fa5]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t))
}

const tagFacets = computed(() => {
  const source = library.facetAssets.length ? library.facetAssets : library.assets
  const counts = new Map<string, number>()
  for (const a of source) {
    for (const t of normalizeTokens(a.filename)) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([value, count]) => ({ value, count }))
})

function setView(view: LibraryView, params?: { folderId?: number }) {
  if (view === 'ai' && !featureFlags.ENABLE_AI) return
  if (view === 'ocr' && !featureFlags.ENABLE_OCR) return
  if (view === 'trash' && !featureFlags.ENABLE_TRASH) return
  if (view.startsWith('template_') && !featureFlags.ENABLE_TEMPLATE) return

  ui.libraryView = view
  library.resetFilters()

  if (view === 'favorites') {
    library.showFavoritesOnly = true
  } else if (view === 'recent') {
    library.showRecentOnly = true
  } else if (view === 'duplicate') {
    library.filterDuplicate = true
  } else if (view === 'trash') {
    library.showTrashOnly = true
  } else if (view === 'folder' && params?.folderId) {
    library.filterFolderId = params.folderId
  }

  if (view.startsWith('template_')) return

  if (['all', 'favorites', 'recent', 'duplicate', 'folder', 'tag', 'format', 'ratio', 'size', 'trash'].includes(view)) {
    void library.refresh().catch(() => {})
  }
}

async function applyTag(tag: string) {
  ui.libraryView = 'tag'
  library.resetFilters()
  library.searchQuery = tag
  expanded.value.tag = true
  await library.refresh()
}

async function applyFormat(format: string) {
  ui.libraryView = 'format'
  library.resetFilters()
  library.filterFormat = format
  expanded.value.format = true
  await library.refresh()
}

async function applyRatio(ratio: number) {
  ui.libraryView = 'ratio'
  library.resetFilters()
  library.filterRatio = ratio
  expanded.value.ratio = true
  await library.refresh()
}

async function applySize(width: number, height: number) {
  ui.libraryView = 'size'
  library.resetFilters()
  library.filterWidth = width
  library.filterHeight = height
  expanded.value.size = true
  await library.refresh()
}

function confirmRemoveFolder(folder: LibraryFolder, event: MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
  const trashHint = featureFlags.ENABLE_TRASH
    ? '该文件夹下的图片将移入回收站（不会删除磁盘文件）。'
    : '该文件夹下的图片将从图库中移除（不会删除磁盘文件）。'
  dialog.warning({
    title: '移除文件夹',
    content: `确定从图库移除「${folder.label}」？${trashHint}`,
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const wasViewingFolder = ui.libraryView === 'folder' && library.filterFolderId === folder.id
        const result = await library.removeFolder(folder.id)
        if (wasViewingFolder) {
          ui.libraryView = 'all'
        }
        const moved = result.assetsMoved
        if (moved > 0) {
          feedback.success(
            featureFlags.ENABLE_TRASH
              ? `已移除文件夹，${moved} 张图片已移入回收站`
              : `已移除文件夹，${moved} 张图片已从图库移除`,
          )
        } else {
          feedback.success('已从图库移除该文件夹')
        }
      } catch (err) {
        feedback.error(err instanceof Error ? err.message : '移除失败')
        return false
      }
    },
  })
}

</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo-shell">
        <div class="logo">
          <img :src="logoUrl" alt="PixelForge" class="logo-img" />
        </div>
      </div>
      <div class="brand-info">
        <span class="brand-name">PixelForge</span>
        <span class="brand-sub">本地图片批量处理</span>
      </div>
    </div>

    <div class="sidebar-content">
      <section class="sidebar-group">
        <div class="section-head">
          <div>
            <div class="pf-section-title">资源管理</div>
            <p class="section-subtitle">图库、收藏与快速筛选</p>
          </div>
        </div>
        <nav class="nav">
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'all' }"
            @click="setView('all')"
          >
            <span class="icon-shell"><span class="icon">🖼</span></span>
            <span class="label">全部照片</span>
            <span class="badge">{{ assetCount.toLocaleString() }}</span>
          </button>
          <button class="nav-item" :class="{ active: ui.libraryView === 'recent' }" @click="setView('recent')">
            <span class="icon-shell"><span class="icon">🕐</span></span>
            <span class="label">最近导入</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'favorites' }"
            @click="setView('favorites')"
          >
            <span class="icon-shell"><span class="icon">★</span></span>
            <span class="label">收藏</span>
            <span v-if="favoriteCount" class="badge">{{ favoriteCount }}</span>
          </button>
          <button
            v-if="featureFlags.ENABLE_TRASH"
            class="nav-item"
            :class="{ active: ui.libraryView === 'trash' }"
            @click="setView('trash')"
          >
            <span class="icon-shell"><span class="icon">🗑️</span></span>
            <span class="label">回收站</span>
            <span v-if="trashCount" class="badge">{{ trashCount }}</span>
          </button>
        </nav>
        <nav class="nav sub">
          <div class="collapsible-group">
            <button
              class="nav-item group-header"
              :class="{ active: ui.libraryView === 'folder' && library.filterFolderId }"
              @click="toggleExpanded('folder')"
            >
              <span class="icon-shell"><span class="icon">📁</span></span>
              <span class="label">文件夹</span>
              <span class="chevron" :class="{ open: expanded.folder }">▾</span>
            </button>
            <div v-if="expanded.folder && library.folders.length > 0" class="sub-list">
              <div
                v-for="f in library.folders"
                :key="f.id"
                class="sub-item-wrap"
                :class="{ active: library.filterFolderId === f.id }"
              >
                <button
                  type="button"
                  class="sub-item"
                  :class="{ active: library.filterFolderId === f.id }"
                  @click="setView('folder', { folderId: f.id })"
                >
                  <span class="sub-icon">📁</span>
                  <span class="sub-label" :title="f.path">{{ f.label }}</span>
                </button>
                <button
                  type="button"
                  class="sub-item-remove pf-icon-btn"
                  title="从图库移除此文件夹"
                  aria-label="从图库移除此文件夹"
                  @click="confirmRemoveFolder(f, $event)"
                >
                  ×
                </button>
              </div>
            </div>
            <div v-else-if="expanded.folder" class="sub-empty">暂无已扫描文件夹</div>
          </div>
          <div class="collapsible-group">
            <button
              class="nav-item group-header"
              :class="{ active: ui.libraryView === 'tag' }"
              @click="toggleExpanded('tag')"
            >
              <span class="icon-shell"><span class="icon">🏷️</span></span>
              <span class="label">关键词</span>
              <span class="chevron" :class="{ open: expanded.tag }">▾</span>
            </button>
            <div v-if="expanded.tag && tagFacets.length" class="sub-list">
              <button v-for="t in tagFacets" :key="t.value" class="sub-item" @click="applyTag(t.value)">
                <span class="sub-icon">#</span>
                <span class="sub-label">{{ t.value }}</span>
                <span class="sub-count">{{ t.count }}</span>
              </button>
            </div>
            <div v-else-if="expanded.tag" class="sub-empty">暂无可用关键词</div>
          </div>
          <div class="collapsible-group">
            <button
              class="nav-item group-header"
              :class="{ active: ui.libraryView === 'format' }"
              @click="toggleExpanded('format')"
            >
              <span class="icon-shell"><span class="icon">🔖</span></span>
              <span class="label">格式</span>
              <span class="chevron" :class="{ open: expanded.format }">▾</span>
            </button>
            <div v-if="expanded.format && formatFacets.length" class="sub-list">
              <button v-for="f in formatFacets" :key="f.value" class="sub-item" @click="applyFormat(f.value)">
                <span class="sub-icon">•</span>
                <span class="sub-label">{{ f.value.toUpperCase() }}</span>
                <span class="sub-count">{{ f.count }}</span>
              </button>
            </div>
            <div v-else-if="expanded.format" class="sub-empty">暂无格式数据</div>
          </div>
          <div class="collapsible-group">
            <button
              class="nav-item group-header"
              :class="{ active: ui.libraryView === 'ratio' }"
              @click="toggleExpanded('ratio')"
            >
              <span class="icon-shell"><span class="icon">📐</span></span>
              <span class="label">比例</span>
              <span class="chevron" :class="{ open: expanded.ratio }">▾</span>
            </button>
            <div v-if="expanded.ratio && ratioFacets.length" class="sub-list">
              <button v-for="r in ratioFacets" :key="r.label" class="sub-item" @click="applyRatio(r.value)">
                <span class="sub-icon">▦</span>
                <span class="sub-label" :title="r.label">{{ r.label }}</span>
                <span class="sub-count">{{ r.count }}</span>
              </button>
            </div>
            <div v-else-if="expanded.ratio" class="sub-empty">暂无比例数据</div>
          </div>
          <div class="collapsible-group">
            <button
              class="nav-item group-header"
              :class="{ active: ui.libraryView === 'size' }"
              @click="toggleExpanded('size')"
            >
              <span class="icon-shell"><span class="icon">📏</span></span>
              <span class="label">尺寸</span>
              <span class="chevron" :class="{ open: expanded.size }">▾</span>
            </button>
            <div v-if="expanded.size && sizeFacets.length" class="sub-list">
              <button
                v-for="s in sizeFacets"
                :key="`${s.width}x${s.height}`"
                class="sub-item"
                @click="applySize(s.width, s.height)"
              >
                <span class="sub-icon">▣</span>
                <span class="sub-label" :title="`${s.width}×${s.height}`">{{ s.width }}×{{ s.height }}</span>
                <span class="sub-count">{{ s.count }}</span>
              </button>
            </div>
            <div v-else-if="expanded.size" class="sub-empty">暂无尺寸数据</div>
          </div>
        </nav>
      </section>

      <section class="sidebar-group">
        <div class="section-head">
          <div>
            <div class="pf-section-title">图片处理</div>
            <p class="section-subtitle">面向批量处理与编辑工作流</p>
          </div>
        </div>
        <nav class="nav">
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'batch' }"
            @click="setView('batch')"
          >
            <span class="icon-shell"><span class="icon">⚡️</span></span>
            <span class="label">批量处理</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'compress' }"
            @click="setView('compress')"
          >
            <span class="icon-shell"><span class="icon">📦</span></span>
            <span class="label">图片压缩</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'convert' }"
            @click="setView('convert')"
          >
            <span class="icon-shell"><span class="icon">🔄</span></span>
            <span class="label">格式转换</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'edit' }"
            @click="setView('edit')"
          >
            <span class="icon-shell"><span class="icon">🎨</span></span>
            <span class="label">图片编辑</span>
          </button>
        </nav>
      </section>

      <section class="sidebar-group">
        <div class="section-head">
          <div>
            <div class="pf-section-title">导出工具</div>
            <p class="section-subtitle">导出前的素材整理与检测</p>
          </div>
        </div>
        <nav class="nav">
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'duplicate' }"
            @click="setView('duplicate')"
          >
            <span class="icon-shell"><span class="icon">🧬</span></span>
            <span class="label">重复图片</span>
          </button>
        </nav>
        <nav v-if="featureFlags.ENABLE_TEMPLATE" class="nav sub">
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'template_my' }"
            @click="setView('template_my')"
          >
            <span class="icon-shell"><span class="icon">🧩</span></span>
            <span class="label">我的模板</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'template_common' }"
            @click="setView('template_common')"
          >
            <span class="icon-shell"><span class="icon">⭐️</span></span>
            <span class="label">常用</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'template_social' }"
            @click="setView('template_social')"
          >
            <span class="icon-shell"><span class="icon">💬</span></span>
            <span class="label">社交媒体</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'template_ecommerce' }"
            @click="setView('template_ecommerce')"
          >
            <span class="icon-shell"><span class="icon">🛒</span></span>
            <span class="label">电商</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: ui.libraryView === 'template_custom' }"
            @click="setView('template_custom')"
          >
            <span class="icon-shell"><span class="icon">✨</span></span>
            <span class="label">自定义</span>
          </button>
        </nav>
      </section>

      <section
        v-if="featureFlags.ENABLE_AI || featureFlags.ENABLE_OCR"
        class="sidebar-group"
      >
        <div class="section-head">
          <div>
            <div class="pf-section-title">高级功能</div>
            <p class="section-subtitle">AI 扩图与文字识别</p>
          </div>
        </div>
        <nav class="nav">
          <button
            v-if="featureFlags.ENABLE_AI"
            class="nav-item"
            :class="{ active: ui.libraryView === 'ai' }"
            @click="setView('ai')"
          >
            <span class="icon-shell"><span class="icon">🤖</span></span>
            <span class="label">AI 扩图</span>
          </button>
          <button
            v-if="featureFlags.ENABLE_OCR"
            class="nav-item"
            :class="{ active: ui.libraryView === 'ocr' }"
            @click="setView('ocr')"
          >
            <span class="icon-shell"><span class="icon">🔍</span></span>
            <span class="label">OCR 识别</span>
          </button>
        </nav>
      </section>
    </div>

    <div class="sidebar-footer">
      <div class="storage-card">
        <div class="storage-label">
          <span>存储空间</span>
          <span class="storage-val">{{ storageText }}</span>
        </div>
        <NProgress
          type="line"
          :percentage="Math.round(sys.diskPercent)"
          :show-indicator="false"
          :height="6"
          color="var(--pf-primary)"
          :rail-color="ui.isDark ? '#333' : '#e5e5ea'"
        />
      </div>
      <div class="sidebar-meta">
        <div class="sidebar-meta-info">
          <span class="meta-chip">v{{ appVersion }}</span>
          <span class="meta-chip muted">{{ assetCount.toLocaleString() }} 张</span>
        </div>
        <button class="pf-icon-btn theme-toggle" title="切换主题" @click="ui.toggleTheme()">
          <span class="btn-icon">{{ ui.isDark ? '🌙' : '☀️' }}</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  --sidebar-pad-x: var(--pf-gap-sm);
  --sidebar-stack-gap: var(--pf-gap-sm);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: transparent;
}
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sidebar-stack-gap);
  padding: var(--sidebar-stack-gap) var(--sidebar-pad-x) 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-sm);
  padding: var(--pf-gap-sm) var(--sidebar-pad-x);
  color: var(--pf-text);
  border-bottom: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  flex-shrink: 0;
}
.logo-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--pf-radius-md);
  padding: var(--pf-gap-2xs);
  background: color-mix(in srgb, var(--pf-primary-soft) 36%, var(--pf-bg));
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  box-shadow: none;
  flex-shrink: 0;
}
.logo {
  width: 38px;
  height: 38px;
  border-radius: var(--pf-radius-sm);
  background: var(--pf-bg);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  overflow: hidden;
}
.logo-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.brand-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  gap: 2px;
  min-width: 0;
}
.brand-name {
  font-weight: 800;
  font-size: clamp(15px, 1.6vw, 18px);
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--pf-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-sub {
  font-size: 10px;
  font-weight: 600;
  color: var(--pf-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar-group,
.storage-card {
  padding: var(--pf-gap-sm);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  border-radius: var(--pf-radius-md);
  background: var(--pf-bg-soft);
  box-shadow: none;
}
.sidebar-group {
  margin: 0;
}
.section-head {
  padding: 0 0 var(--pf-gap-xs);
}
.section-subtitle {
  margin: 2px 0 0;
  color: var(--pf-text-secondary);
  font-size: 10px;
  line-height: 1.35;
}
.nav {
  padding: 0;
}
.nav.sub {
  margin-top: var(--pf-gap-xs);
}
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-sm);
  width: 100%;
  min-height: 40px;
  padding: 0 var(--pf-gap-sm);
  margin-bottom: var(--pf-gap-2xs);
  border: none;
  border-radius: var(--pf-radius-md);
  background: transparent;
  color: var(--pf-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition:
    color var(--pf-transition-fast) var(--pf-ease-standard),
    background-color var(--pf-transition-fast) var(--pf-ease-standard),
    border-color var(--pf-transition-fast) var(--pf-ease-standard),
    transform var(--pf-transition-fast) var(--pf-ease-standard),
    opacity var(--pf-transition-fast) var(--pf-ease-standard),
    box-shadow var(--pf-transition-fast) var(--pf-ease-standard);
}
.group-header {
  position: relative;
}
.nav-item::before {
  content: '';
  position: absolute;
  left: var(--pf-gap-xs);
  top: 50%;
  width: 3px;
  height: 18px;
  border-radius: var(--pf-radius-pill);
  background: transparent;
  transform: translateY(-50%);
  transition:
    background-color var(--pf-transition-fast) var(--pf-ease-standard),
    opacity var(--pf-transition-fast) var(--pf-ease-standard);
}
.nav-item:hover {
  background: color-mix(in srgb, var(--pf-primary-soft) 35%, var(--pf-bg-hover));
  color: var(--pf-text);
  transform: translateX(2px);
}
.chevron {
  margin-left: auto;
  font-size: 11px;
  color: var(--pf-text-secondary);
  transform: rotate(-90deg);
  transition:
    transform var(--pf-transition-fast) var(--pf-ease-standard),
    opacity var(--pf-transition-fast) var(--pf-ease-standard),
    background-color var(--pf-transition-fast) var(--pf-ease-standard);
  padding: var(--pf-gap-xs) var(--pf-gap-sm);
  border-radius: var(--pf-radius-sm);
}
.chevron:hover {
  background: var(--pf-bg-hover);
}
.chevron.open {
  transform: rotate(0deg);
}
.icon-shell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--pf-radius-sm);
  background: color-mix(in srgb, var(--pf-bg-hover) 84%, transparent);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border) 78%, transparent);
  flex: 0 0 auto;
  transition:
    background-color var(--pf-transition-fast) var(--pf-ease-standard),
    border-color var(--pf-transition-fast) var(--pf-ease-standard),
    transform var(--pf-transition-fast) var(--pf-ease-standard);
}
.icon {
  font-size: 16px;
  display: flex;
  justify-content: center;
}
.badge {
  margin-left: auto;
  font-size: 11px;
  background: var(--pf-bg-hover);
  color: var(--pf-text-secondary);
  padding: 2px 8px;
  border-radius: var(--pf-radius-pill);
  min-width: 24px;
  text-align: center;
  font-weight: 700;
}
.nav-item.active {
  background: color-mix(in srgb, var(--pf-primary-soft) 48%, var(--pf-bg));
  color: var(--pf-text);
  box-shadow: none;
}
.nav-item.active::before {
  background: var(--pf-primary);
}
.nav-item.active .icon-shell {
  background: color-mix(in srgb, var(--pf-primary-soft) 56%, var(--pf-bg));
  border-color: color-mix(in srgb, var(--pf-primary) 24%, var(--pf-border-color));
  transform: none;
}
.nav-item.active .badge {
  background: color-mix(in srgb, var(--pf-primary) 18%, transparent);
  color: var(--pf-primary);
}
.sub-list {
  padding: var(--pf-gap-xs) 0 var(--pf-gap-sm) 38px;
}
.sub-item-wrap {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-2xs);
  margin-bottom: var(--pf-gap-2xs);
  border-radius: var(--pf-radius-sm);
  padding-right: var(--pf-gap-2xs);
}
.sub-item-wrap:hover,
.sub-item-wrap.active {
  background: color-mix(in srgb, var(--pf-bg-hover) 70%, transparent);
}
.sub-item-wrap.active {
  background: var(--pf-primary-soft);
}
.sub-item-wrap .sub-item {
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}
.sub-item-wrap .sub-item:hover,
.sub-item-wrap .sub-item.active {
  background: transparent;
  transform: none;
}
.sub-item-remove {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  opacity: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--pf-text-secondary);
}
.sub-item-wrap:hover .sub-item-remove,
.sub-item-wrap:focus-within .sub-item-remove {
  opacity: 1;
}
.sub-item-remove:hover {
  color: var(--pf-danger);
  background: color-mix(in srgb, var(--pf-danger) 12%, transparent);
}
.sub-item {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-sm);
  width: 100%;
  min-height: 34px;
  padding: 0 var(--pf-gap-sm);
  border: none;
  border-radius: var(--pf-radius-sm);
  background: transparent;
  color: var(--pf-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition:
    color var(--pf-transition-fast) var(--pf-ease-standard),
    background-color var(--pf-transition-fast) var(--pf-ease-standard),
    border-color var(--pf-transition-fast) var(--pf-ease-standard),
    transform var(--pf-transition-fast) var(--pf-ease-standard),
    opacity var(--pf-transition-fast) var(--pf-ease-standard);
}
.sub-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--pf-text-secondary);
  opacity: 0.8;
  font-weight: 700;
}
.sub-empty {
  padding: 6px 12px 10px 40px;
  font-size: 11px;
  color: var(--pf-text-secondary);
  opacity: 0.85;
}
.sub-item:hover {
  background: var(--pf-bg-hover);
  color: var(--pf-text);
  transform: translateX(2px);
}
.sub-item.active {
  color: var(--pf-primary);
  background: var(--pf-primary-soft);
}

.sidebar-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sidebar-stack-gap);
  padding: var(--sidebar-stack-gap) var(--sidebar-pad-x);
  border-top: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  background: transparent;
}
.storage-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--pf-text-secondary);
  margin-bottom: var(--pf-gap-sm);
  font-weight: 700;
}
.sidebar-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pf-gap-sm);
  min-height: 28px;
}
.sidebar-meta-info {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-xs);
  min-width: 0;
  flex-wrap: wrap;
}
.meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 var(--pf-gap-sm);
  border-radius: var(--pf-radius-pill);
  background: var(--pf-primary-soft);
  color: var(--pf-primary);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.meta-chip.muted {
  background: var(--pf-bg-hover);
  color: var(--pf-text-secondary);
}
.theme-toggle {
  flex-shrink: 0;
  margin-left: auto;
}

@media (max-width: 1024px) {
  .nav-item {
    min-height: 36px;
    font-size: 12px;
  }
  .icon-shell {
    width: 24px;
    height: 24px;
  }
  .icon {
    font-size: 14px;
  }
}
</style>
