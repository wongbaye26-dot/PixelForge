<script setup lang="ts">
import { NProgress } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useUiStore, type LibraryView } from '@/stores/ui'

const library = useLibraryStore()
const ui = useUiStore()
const isElectron = typeof window !== 'undefined' && !!window.pixelForge?.isElectron

const assetCount = computed(() => library.assets.length)
const favoriteCount = computed(() => library.assets.filter((a) => a.favorite).length)

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
  ui.libraryView = view
  library.resetFilters()

  if (view === 'favorites') {
    library.showFavoritesOnly = true
  } else if (view === 'duplicate') {
    library.filterDuplicate = true
  } else if (view === 'folder' && params?.folderId) {
    library.filterFolderId = params.folderId
  }

  if (['all', 'favorites', 'recent', 'duplicate', 'folder', 'tag', 'format', 'ratio', 'size'].includes(view)) {
    library.refresh()
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

async function pickFolder() {
  const p = await window.pixelForge?.pickFolder()
  if (p) {
    library.scanPath = p
    await library.scan()
  }
}

async function importFolder() {
  if (isElectron) {
    await pickFolder()
    return
  }
  if (library.scanPath.trim()) await library.scan()
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">
        <svg viewBox="0 0 100 100" class="logo-svg">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="8" />
          <path d="M50 20 C35 20 25 35 25 50 C25 65 35 80 50 80 C65 80 75 65 75 50" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
          <circle cx="50" cy="50" r="10" fill="currentColor" />
          <path d="M60 60 L80 80" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
          <path d="M55 25 L75 25 L75 45" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M65 35 L85 35 L85 55" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="brand-info">
        <span class="brand-name">PixelForge</span>
        <span class="brand-sub">智能图片资产处理工具</span>
      </div>
    </div>

    <div class="sidebar-content">
      <div class="pf-section-title">图库</div>
      <nav class="nav">
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'all' }"
          @click="setView('all')"
        >
          <span class="icon">🖼</span>
          <span class="label">全部照片</span>
          <span class="badge">{{ assetCount.toLocaleString() }}</span>
        </button>
        <button class="nav-item" :class="{ active: ui.libraryView === 'recent' }" @click="setView('recent')">
          <span class="icon">🕐</span>
          <span class="label">最近导入</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'favorites' }"
          @click="setView('favorites')"
        >
          <span class="icon">★</span>
          <span class="label">收藏</span>
          <span v-if="favoriteCount" class="badge">{{ favoriteCount }}</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'trash' }"
          @click="setView('trash')"
        >
          <span class="icon">🗑</span>
          <span class="label">回收站</span>
        </button>
      </nav>

      <div class="pf-section-title">智能分类</div>
      <nav class="nav sub">
        <div class="collapsible-group">
          <button
            class="nav-item group-header"
            :class="{ active: ui.libraryView === 'folder' }"
            @click="setView('folder')"
          >
            <span class="icon">📁</span>
            <span class="label">文件夹</span>
            <span class="chevron" :class="{ open: expanded.folder }" @click.stop="toggleExpanded('folder')">▾</span>
          </button>
          <div v-if="expanded.folder && library.folders.length > 0" class="sub-list">
            <button
              v-for="f in library.folders"
              :key="f.id"
              class="sub-item"
              :class="{ active: library.filterFolderId === f.id }"
              @click="setView('folder', { folderId: f.id })"
            >
              <span class="sub-icon">📁</span>
              <span class="sub-label">{{ f.label }}</span>
            </button>
          </div>
        </div>
        <div class="collapsible-group">
          <button class="nav-item group-header" :class="{ active: ui.libraryView === 'tag' }" @click="setView('tag')">
            <span class="icon">🏷️</span>
            <span class="label">标签</span>
            <span class="chevron" :class="{ open: expanded.tag }" @click.stop="toggleExpanded('tag')">▾</span>
          </button>
          <div v-if="expanded.tag && tagFacets.length" class="sub-list">
            <button v-for="t in tagFacets" :key="t.value" class="sub-item" @click="applyTag(t.value)">
              <span class="sub-icon">#</span>
              <span class="sub-label">{{ t.value }}</span>
              <span class="sub-count">{{ t.count }}</span>
            </button>
          </div>
        </div>

        <div class="collapsible-group">
          <button class="nav-item group-header" :class="{ active: ui.libraryView === 'format' }" @click="setView('format')">
            <span class="icon">🔖</span>
            <span class="label">格式</span>
            <span class="chevron" :class="{ open: expanded.format }" @click.stop="toggleExpanded('format')">▾</span>
          </button>
          <div v-if="expanded.format && formatFacets.length" class="sub-list">
            <button v-for="f in formatFacets" :key="f.value" class="sub-item" @click="applyFormat(f.value)">
              <span class="sub-icon">•</span>
              <span class="sub-label">{{ f.value.toUpperCase() }}</span>
              <span class="sub-count">{{ f.count }}</span>
            </button>
          </div>
        </div>

        <div class="collapsible-group">
          <button class="nav-item group-header" :class="{ active: ui.libraryView === 'ratio' }" @click="setView('ratio')">
            <span class="icon">📐</span>
            <span class="label">比例</span>
            <span class="chevron" :class="{ open: expanded.ratio }" @click.stop="toggleExpanded('ratio')">▾</span>
          </button>
          <div v-if="expanded.ratio && ratioFacets.length" class="sub-list">
            <button v-for="r in ratioFacets" :key="r.label" class="sub-item" @click="applyRatio(r.value)">
              <span class="sub-icon">▦</span>
              <span class="sub-label" :title="r.label">{{ r.label }}</span>
              <span class="sub-count">{{ r.count }}</span>
            </button>
          </div>
        </div>

        <div class="collapsible-group">
          <button class="nav-item group-header" :class="{ active: ui.libraryView === 'size' }" @click="setView('size')">
            <span class="icon">📏</span>
            <span class="label">尺寸</span>
            <span class="chevron" :class="{ open: expanded.size }" @click.stop="toggleExpanded('size')">▾</span>
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
        </div>

        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'duplicate' }"
          @click="setView('duplicate')"
        >
          <span class="icon">🧬</span>
          <span class="label">重复图片</span>
        </button>
      </nav>

      <div class="pf-section-title">模板中心</div>
      <nav class="nav sub">
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'template_my' }"
          @click="setView('template_my')"
        >
          <span class="icon">🧩</span>
          <span class="label">我的模板</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'template_common' }"
          @click="setView('template_common')"
        >
          <span class="icon">⭐️</span>
          <span class="label">常用</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'template_social' }"
          @click="setView('template_social')"
        >
          <span class="icon">💬</span>
          <span class="label">社交媒体</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'template_ecommerce' }"
          @click="setView('template_ecommerce')"
        >
          <span class="icon">🛒</span>
          <span class="label">电商</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'template_custom' }"
          @click="setView('template_custom')"
        >
          <span class="icon">✨</span>
          <span class="label">自定义</span>
        </button>
      </nav>

      <div class="pf-section-title">工具箱</div>
      <nav class="nav sub">
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'batch' }"
          @click="setView('batch')"
        >
          <span class="icon">⚡️</span>
          <span class="label">批量处理</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'compress' }"
          @click="setView('compress')"
        >
          <span class="icon">📦</span>
          <span class="label">图片压缩</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'convert' }"
          @click="setView('convert')"
        >
          <span class="icon">🔄</span>
          <span class="label">格式转换</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'edit' }"
          @click="setView('edit')"
        >
          <span class="icon">🎨</span>
          <span class="label">图片编辑</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'ai' }"
          @click="setView('ai')"
        >
          <span class="icon">🤖</span>
          <span class="label">AI 扩图</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: ui.libraryView === 'ocr' }"
          @click="setView('ocr')"
        >
          <span class="icon">🔍</span>
          <span class="label">OCR 识别</span>
        </button>
      </nav>
    </div>

    <div class="sidebar-footer">
      <div class="storage">
        <div class="storage-label">
          <span>存储空间</span>
          <span class="storage-val">256GB / 512GB</span>
        </div>
        <NProgress
          type="line"
          :percentage="50"
          :show-indicator="false"
          :height="4"
          color="#007AFF"
          :rail-color="ui.isDark ? '#333' : '#e5e5ea'"
        />
      </div>
      <div class="footer-actions">
        <div class="ver-info">v1.2.0</div>
        <button class="pf-icon-btn theme-toggle" @click="ui.toggleTheme()">
          <span class="btn-icon">{{ ui.isDark ? '🌙' : '☀️' }}</span>
        </button>
        <button class="pf-icon-btn settings-btn">
          <span class="btn-icon">⚙</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--pf-bg-elevated);
  border-right: 1px solid var(--pf-border);
  height: 100%;
  overflow: hidden;
}
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-bottom: 20px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 20px 20px;
  color: var(--pf-text);
  border-bottom: 1px solid var(--pf-border);
  margin-bottom: 8px;
}
.logo {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #007aff, #5856d6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4);
  flex-shrink: 0;
}
.logo-svg {
  width: 28px;
  height: 28px;
  display: block;
}
.brand-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}
.brand-name {
  font-weight: 850;
  font-size: 20px;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--pf-text);
}
.brand-sub {
  font-size: 10px;
  font-weight: 500;
  color: var(--pf-text-secondary);
  white-space: nowrap;
  opacity: 0.8;
}
.pf-section-title {
  padding: 16px 16px 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.nav {
  padding: 4px 10px;
}
.nav.sub {
  padding-top: 0;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 2px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--pf-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}
.group-header {
  position: relative;
}
.chevron {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.7;
  transform: rotate(-90deg);
  transition: transform 0.2s, opacity 0.2s;
  padding: 4px 6px;
  border-radius: 6px;
}
.chevron:hover {
  background: var(--pf-bg-hover);
  opacity: 1;
}
.chevron.open {
  transform: rotate(0deg);
}
.icon {
  font-size: 16px;
  width: 20px;
  display: flex;
  justify-content: center;
  opacity: 0.8;
}
.nav-item.active {
  background: var(--pf-primary);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}
.nav-item.active .icon {
  filter: brightness(0) invert(1);
}
.nav-item.active .badge {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}
.icon {
  font-size: 18px;
  width: 24px;
  display: flex;
  justify-content: center;
}
.badge {
  margin-left: auto;
  font-size: 11px;
  background: var(--pf-bg-hover);
  color: var(--pf-text-secondary);
  padding: 2px 8px;
  border-radius: 12px;
  min-width: 24px;
  text-align: center;
}
.sub-list {
  padding: 2px 0 8px 48px;
}
.sub-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--pf-text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
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
  opacity: 0.9;
}
.sub-item:hover {
  background: var(--pf-bg-hover);
  color: var(--pf-text);
}
.sub-item.active {
  color: var(--pf-primary);
  font-weight: 600;
}

.sidebar-footer {
  padding: 16px 14px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg-elevated);
}
.storage {
  margin-bottom: 12px;
}
.storage-label {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--pf-text-secondary);
  margin-bottom: 6px;
  font-weight: 600;
}
.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ver-info {
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  background: var(--pf-bg-hover);
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: auto;
}
.pf-icon-btn {
  background: transparent;
  border: none;
  color: var(--pf-text-secondary);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  transition: all 0.2s;
}
.pf-icon-btn:hover {
  background: var(--pf-bg-hover);
  color: var(--pf-text);
  transform: translateY(-1px);
}
</style>
