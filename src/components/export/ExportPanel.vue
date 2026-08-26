<script setup lang="ts">
import {
  NInput,
  NSlider,
  NButton,
  NTabs,
  NTabPane,
  NEmpty,
} from 'naive-ui'
import { computed, watch, onMounted, ref } from 'vue'
import { useExportStore } from '@/stores/export'
import { useExportSizeStore } from '@/stores/export-size'
import { useLibraryStore } from '@/stores/library'
import { useAssetScopeStore } from '@/stores/asset-scope'
import { useTasksStore, type ExportTaskRow } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import type { ExportFormat } from '@/types'
import FitModePicker from './FitModePicker.vue'
import SmartExportTab from '@/modules/smart-export/components/SmartExportTab.vue'
import { useExportMatcherStore } from '@/modules/export-matcher/stores/export-matcher'
import { useSmartExportRun } from '@/modules/export-matcher/composables/use-smart-export-run'
import { assetDisplayUrl, resolveMediaUrl } from '@/utils/media-url'
import { useFeedback } from '@/composables/use-feedback'
import { api } from '@/api/client'
import StrategyOptionCard from '@/components/module/StrategyOptionCard.vue'
import ExportDirPanel from './ExportDirPanel.vue'
import ExportSizePresets from './ExportSizePresets.vue'
import { sizeCardPresentation } from '@/core/size-parser'
import { FORMAT_OPTIONS_WITH_META } from '@/core/format-options'

const exportStore = useExportStore()
const exportSizes = useExportSizeStore()
const library = useLibraryStore()
const assetScope = useAssetScopeStore()
const tasks = useTasksStore()
const ui = useUiStore()
const feedback = useFeedback()
const matcher = useExportMatcherStore()
const { runAutoMatchExport } = useSmartExportRun()

const formatOptions = FORMAT_OPTIONS_WITH_META

function isFormatEnabled(format: ExportFormat) {
  return exportStore.formats.includes(format)
}

function setFormatEnabled(format: ExportFormat, enabled: boolean) {
  const current = exportStore.formats
  if (enabled) {
    if (!current.includes(format)) exportStore.formats = [...current, format]
    return
  }
  exportStore.formats = current.filter((f) => f !== format)
}

const metadataAssets = computed(() => library.selectedAssets)
const metadataAsset = computed(() => metadataAssets.value[0] ?? null)
const metadataPreviewSrc = computed(() => {
  const asset = metadataAsset.value
  if (!asset) return undefined
  return assetDisplayUrl(asset) ?? resolveMediaUrl(`/api/assets/${asset.id}/preview`)
})
const metadataSummary = computed(() => {
  if (!metadataAssets.value.length) return null
  const totalBytes = metadataAssets.value.reduce((sum, asset) => sum + asset.size, 0)
  const formats = new Set(metadataAssets.value.map((asset) => asset.format.toUpperCase()))
  const favorites = metadataAssets.value.filter((asset) => asset.favorite).length
  return {
    count: metadataAssets.value.length,
    totalBytes,
    formatCount: formats.size,
    favorites,
  }
})
const metadataRows = computed(() => {
  const asset = metadataAsset.value
  if (!asset) return []
  const rows = [
    { label: '文件名', value: asset.filename },
    { label: '路径', value: asset.path, mono: true, multiline: true },
    { label: '格式', value: asset.format.toUpperCase() },
    { label: '文件大小', value: formatBytes(asset.size) },
    { label: '尺寸', value: `${asset.width} × ${asset.height}` },
    { label: '宽高比', value: asset.ratio.toFixed(3) },
    { label: '像素面积', value: asset.area ? asset.area.toLocaleString() : '—' },
    { label: '清晰度等级', value: asset.resolutionLevel != null ? `L${asset.resolutionLevel}` : '—' },
    { label: '主色', value: asset.dominantColor ?? '—', color: asset.dominantColor },
    { label: '亮度', value: asset.brightness != null ? `${Math.round(asset.brightness * 100)}%` : '—' },
    { label: '导入时间', value: formatDateTime(asset.createdAt) },
    { label: '收藏', value: asset.favorite ? '是' : '否' },
    { label: '哈希', value: asset.hash, mono: true },
  ]
  if (asset.ocrText?.trim()) {
    rows.splice(6, 0, { label: 'OCR 文本', value: asset.ocrText.trim(), multiline: true, mono: false })
  }
  return rows
})

const exifLoading = ref(false)
const exifRows = ref<Array<{ label: string; value: string; mono?: boolean; multiline?: boolean }>>([])

async function loadExifMetadata(assetId: number) {
  exifLoading.value = true
  exifRows.value = []
  try {
    const r = await api.assetMetadata(assetId)
    const rows: Array<{ label: string; value: string; mono?: boolean; multiline?: boolean }> = []
    const e = r.exif
    if (e.make || e.model) rows.push({ label: '相机', value: [e.make, e.model].filter(Boolean).join(' ') })
    if (e.lens) rows.push({ label: '镜头', value: e.lens })
    if (e.dateTime) rows.push({ label: '拍摄时间', value: e.dateTime })
    if (e.exposureTime) rows.push({ label: '曝光', value: e.exposureTime })
    if (e.fNumber) rows.push({ label: '光圈', value: e.fNumber })
    if (e.iso != null) rows.push({ label: 'ISO', value: String(e.iso) })
    if (e.focalLength) rows.push({ label: '焦距', value: e.focalLength })
    if (e.gps) rows.push({ label: 'GPS', value: e.gps, mono: true })
    if (e.orientation != null) rows.push({ label: '方向', value: String(e.orientation) })
    if (e.software) rows.push({ label: '软件', value: e.software })
    if (r.colorSpace) rows.push({ label: '色彩空间', value: r.colorSpace })
    if (r.density) rows.push({ label: '分辨率', value: `${r.density} DPI` })
    if (r.hasProfile) rows.push({ label: 'ICC 配置', value: '有' })
    exifRows.value = rows
  } catch {
    exifRows.value = []
  } finally {
    exifLoading.value = false
  }
}

watch(
  [metadataAsset, () => ui.rightTab],
  ([asset, tab]) => {
    if (tab !== 'metadata' || !asset) {
      exifRows.value = []
      return
    }
    void loadExifMetadata(asset.id)
  },
  { immediate: true },
)

const exportSummary = computed(() => {
  exportSizes.parseSizes()
  const nImg = library.selectedIds.size
  const nSize = exportSizes.activeSizes().length
  const nFmt = exportStore.formats.length
  const total = nImg * nSize * nFmt
  if (!nImg) return '请先选择图片'
  if (!nSize) return '请解析并勾选尺寸'
  return `开始导出 (${nImg} 张 × ${nSize} 尺寸 × ${nFmt} 格式 = ${total} 项)`
})

const smartExportSummary = computed(() => {
  if (!matcher.enabled) return '请先启用智能导出'
  if (!library.assets.length) return '图库暂无图片'
  return '自动匹配并导出'
})

watch(
  () => exportSizes.sizeInput,
  () => {
    exportSizes.parseSizes()
  },
  { immediate: true },
)

onMounted(async () => {
  await exportStore.loadExportDir()
})

function sizeCard(s: (typeof exportSizes.parsedSizes)[number]) {
  return sizeCardPresentation(s)
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value.toFixed(value >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

function formatDateTime(input?: string) {
  if (!input) return '—'
  const date = new Date(input.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return input
  return date.toLocaleString('zh-CN')
}

function buildTaskRows(assetIds: number[]): ExportTaskRow[] {
  const sizes = exportSizes.activeSizes()
  const draftBatchId = `draft_${Date.now()}`
  const rows: ExportTaskRow[] = []
  for (const id of assetIds) {
    const asset = library.assets.find((a) => a.id === id)
    if (!asset) continue
    for (const size of sizes) {
      for (const format of exportStore.formats) {
        rows.push({
          id: `draft-${id}-${size.width}x${size.height}-${format}`,
          batchId: draftBatchId,
          assetId: id,
          filename: asset.filename,
          thumbnailUrl: asset.previewUrl ?? asset.thumbnailUrl,
          targetSize: `${size.width}×${size.height}`,
          format,
          progress: 0,
          status: 'processing',
        })
      }
    }
  }
  return rows
}

async function handleExport() {
  const ids = [...library.selectedIds]
  if (!ids.length) {
    feedback.warning('请先在图库中选择图片')
    return
  }
  exportSizes.parseSizes()
  if (!exportSizes.activeSizes().length) {
    feedback.warning('请填写有效尺寸并勾选')
    return
  }

  try {
    const rows = buildTaskRows(ids)
    tasks.setTasks(rows)
    ui.showExportTasks = true
    rows.forEach((r) => tasks.updateTask(r.id, { progress: 12 }))

    const result = await exportStore.submitExport(ids)
    if (!result) return
    tasks.beginBatch(result.batchId, result.jobs)
    tasks.startPolling()
    feedback.success(`已开始导出 ${result.total} 项 → ${exportStore.outputDir || exportStore.defaultOutputDir}`)
  } catch (err) {
    tasks.markTasksFailed(err instanceof Error ? err.message : '导出任务执行失败，请稍后重试')
    feedback.error(err instanceof Error ? err.message : '导出任务执行失败，请稍后重试')
  }
}
</script>

<template>
  <div class="pf-panel-shell pf-panel-shell--rail">
    <NTabs v-model:value="ui.rightTab" type="line" size="small" class="tabs">
      <NTabPane name="export" tab="导出设置" />
      <NTabPane name="edit" tab="智能导出" />
      <NTabPane name="metadata" tab="元数据" />
    </NTabs>

    <div class="panel-body">
      <div v-if="ui.rightTab === 'export'" class="export-stack">
        <div class="scope-banner">
          <span class="scope-banner-label">当前作用域</span>
          <span class="scope-banner-value">{{ assetScope.currentScope.name }}（{{ assetScope.scopeAssetCount }} 张）</span>
        </div>

        <ExportDirPanel caption="保存导出文件与默认输出路径" />

        <section class="block">
          <div class="block-heading">
            <h3 class="block-title">输出格式</h3>
            <span class="block-caption">可多选，将按格式组合生成导出任务</span>
          </div>
          <div class="option-card-grid">
            <StrategyOptionCard
              v-for="opt in formatOptions"
              :key="opt.value"
              compact
              :tag="opt.tag"
              :title="opt.label"
              :desc="opt.desc"
              :model-value="isFormatEnabled(opt.value)"
              @update:model-value="(on) => setFormatEnabled(opt.value, on)"
            />
          </div>
          <div class="field">
            <span class="field-label">命名规则</span>
            <NInput
              v-model:value="exportStore.namingPattern"
              size="small"
              placeholder="{name}_{size}.{format}"
            />
          </div>
        </section>

        <section class="block">
          <div class="block-heading">
            <h3 class="block-title">尺寸策略</h3>
            <span class="block-caption">解析尺寸列表并为每个尺寸选择适配模式</span>
          </div>
          <NInput
            v-model:value="exportSizes.sizeInput"
            type="textarea"
            :rows="4"
            placeholder="每行一个，如 1920x1080 # 全高清横版"
            class="size-input"
          />
          <ExportSizePresets @apply="exportSizes.appendSizeInput" />
          <NButton block size="small" class="parse-btn" @click="exportSizes.parseSizes()">
            解析尺寸
          </NButton>
          <div v-if="exportSizes.parsedSizes.length" class="parsed-list">
            <div class="parsed-head">
              <div class="parsed-label">解析结果 · 点击卡片启用</div>
              <NButton size="tiny" quaternary @click="exportSizes.clearParsedResults()">清空</NButton>
            </div>
            <div class="option-card-grid option-card-grid-compact">
              <StrategyOptionCard
                v-for="s in exportSizes.parsedSizes"
                :key="exportSizes.sizeKey(s)"
                compact
                :tag="sizeCard(s).tag"
                :title="sizeCard(s).title"
                :desc="sizeCard(s).desc"
                :model-value="exportSizes.enabledSizeKeys.has(exportSizes.sizeKey(s))"
                @update:model-value="(on) => exportSizes.setSizeEnabled(exportSizes.sizeKey(s), on)"
              />
            </div>
          </div>
          <div class="divider-line"></div>
          <FitModePicker v-model="exportStore.fitMode" />
        </section>

        <section class="block">
          <div class="block-heading">
            <h3 class="block-title">质量设置</h3>
            <span class="block-caption">平衡图像质量、体积与导出性能</span>
          </div>
          <div class="field">
            <span class="field-label">质量 {{ exportStore.quality }}</span>
            <NSlider v-model:value="exportStore.quality" :min="1" :max="100" :step="1" />
          </div>
          <div class="field">
            <span class="field-label">目标体积 ≤ {{ exportStore.targetSizeKb }} KB</span>
            <NSlider
              v-model:value="exportStore.targetSizeKb"
              :min="10"
              :max="5000"
              :step="10"
            />
          </div>
          <div class="option-card-grid option-card-grid-compact">
            <StrategyOptionCard
              v-model="exportStore.mozjpeg"
              tag="JPG"
              title="MozJPEG"
              desc="JPG 导出时启用更高压缩效率"
              compact
            />
            <StrategyOptionCard
              v-model="exportStore.usePngquant"
              tag="PNG"
              title="pngquant"
              desc="PNG 导出时启用调色板压缩"
              compact
            />
          </div>
        </section>

        <section class="block">
          <div class="block-heading">
            <h3 class="block-title">高级选项</h3>
            <span class="block-caption">导出前确认命名、作用域与任务规模</span>
          </div>
          <div class="advanced-grid">
            <div class="advanced-card">
              <span class="advanced-label">当前作用域</span>
              <span class="advanced-value">{{ assetScope.currentScope.name }}</span>
            </div>
            <div class="advanced-card">
              <span class="advanced-label">已选图片</span>
              <span class="advanced-value">{{ library.selectedIds.size }} 张</span>
            </div>
            <div class="advanced-card">
              <span class="advanced-label">启用格式</span>
              <span class="advanced-value">{{ exportStore.formats.length }} 种</span>
            </div>
            <div class="advanced-card">
              <span class="advanced-label">启用尺寸</span>
              <span class="advanced-value">{{ exportSizes.activeSizes().length }} 组</span>
            </div>
          </div>
        </section>
      </div>

      <div v-else-if="ui.rightTab === 'edit'" class="edit-tab">
        <div class="smart-export-tab">
          <SmartExportTab />
        </div>
      </div>

      <div v-else class="meta-tab">
        <section v-if="metadataSummary" class="block">
          <h3 class="block-title">元数据概览</h3>
          <div class="meta-summary">
            <div class="meta-summary-item">
              <span class="meta-summary-label">已选图片</span>
              <span class="meta-summary-value">{{ metadataSummary.count }} 张</span>
            </div>
            <div class="meta-summary-item">
              <span class="meta-summary-label">总大小</span>
              <span class="meta-summary-value">{{ formatBytes(metadataSummary.totalBytes) }}</span>
            </div>
            <div class="meta-summary-item">
              <span class="meta-summary-label">格式种类</span>
              <span class="meta-summary-value">{{ metadataSummary.formatCount }}</span>
            </div>
            <div class="meta-summary-item">
              <span class="meta-summary-label">已收藏</span>
              <span class="meta-summary-value">{{ metadataSummary.favorites }} 张</span>
            </div>
          </div>
          <p v-if="metadataAssets.length > 1" class="meta-note">当前展示首张选中图片的详细元数据。</p>
        </section>

        <section v-if="metadataAsset" class="block meta-detail-block">
          <div class="block-heading">
            <h3 class="block-title">图片详情</h3>
            <span class="block-caption">{{ metadataAsset.filename }}</span>
          </div>
          <div class="meta-detail-stack">
            <div class="meta-preview-hero pf-compare-canvas">
              <img
                v-if="metadataPreviewSrc"
                :src="metadataPreviewSrc"
                :alt="metadataAsset.filename"
                class="meta-preview-hero-img"
              />
              <div v-else class="meta-preview-empty">暂无预览</div>
            </div>
            <div class="meta-info-panel">
              <div class="meta-grid">
                <div
                  v-for="row in metadataRows"
                  :key="row.label"
                  class="meta-row"
                  :class="{ multiline: row.multiline }"
                >
                  <span class="meta-label">{{ row.label }}</span>
                  <span class="meta-value" :class="{ mono: row.mono }">
                    <span v-if="row.color" class="meta-color" :style="{ background: row.color }"></span>
                    {{ row.value }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="metadataAsset" class="block">
          <h3 class="block-title">EXIF / 拍摄信息</h3>
          <div v-if="exifLoading" class="meta-note">正在读取 EXIF…</div>
          <div v-else-if="!exifRows.length" class="meta-note">该图片未包含可识别的 EXIF 信息。</div>
          <div v-else class="meta-grid">
            <div
              v-for="row in exifRows"
              :key="`exif-${row.label}`"
              class="meta-row"
              :class="{ multiline: row.multiline }"
            >
              <span class="meta-label">{{ row.label }}</span>
              <span class="meta-value" :class="{ mono: row.mono }">{{ row.value }}</span>
            </div>
          </div>
        </section>

        <section v-else class="block">
          <h3 class="block-title">元数据</h3>
          <NEmpty size="small" description="选择 1 张图片以查看元数据" />
        </section>
      </div>
    </div>

    <div v-if="ui.rightTab === 'export'" class="panel-footer">
      <NButton
        type="primary"
        block
        size="large"
        class="export-btn"
        :loading="exportStore.exporting"
        :disabled="!library.selectedIds.size"
        @click="handleExport"
      >
        {{ exportSummary }}
      </NButton>
    </div>
    <div v-else-if="ui.rightTab === 'edit'" class="panel-footer">
      <NButton
        type="primary"
        block
        size="large"
        class="export-btn"
        :loading="matcher.loading"
        :disabled="!matcher.enabled || !library.assets.length"
        @click="runAutoMatchExport"
      >
        {{ smartExportSummary }}
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.pf-panel-shell,
.pf-panel-shell * {
  box-sizing: border-box;
}
.tabs {
  flex-shrink: 0;
  padding: 0 var(--pf-gap-sm);
  background: var(--pf-bg-soft);
  border-bottom: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 88%, transparent);
}
.tabs :deep(.n-tabs-tab) {
  font-size: 12px;
  padding: var(--pf-gap-sm) var(--pf-gap-md);
  font-weight: 700;
}
.panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  min-width: 0;
  padding: var(--pf-gap-sm);
  background: var(--pf-bg);
}

.export-stack,
.meta-tab,
.edit-tab {
  display: flex;
  flex-direction: column;
  gap: var(--export-stack-gap, var(--pf-gap-sm));
  width: 100%;
  min-width: 0;
}

.edit-tab {
  min-width: 0;
}
.smart-export-tab {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--export-stack-gap, var(--pf-gap-sm));
}
.block {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--pf-gap-sm);
  background: var(--pf-bg-soft);
  padding: var(--pf-gap-sm);
  border-radius: var(--pf-radius-md);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 88%, transparent);
  box-shadow: none;
  min-width: 0;
}
.block-emphasis {
  background: color-mix(in srgb, var(--pf-primary-soft) 18%, var(--pf-bg-soft));
  border-color: color-mix(in srgb, var(--pf-primary) 16%, var(--pf-border-color));
}
.block-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
}
.block-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.block-caption {
  color: var(--pf-text-secondary);
  font-size: 10px;
  line-height: 1.35;
}
.size-input {
  margin: 0;
  min-width: 0;
}
.size-input :deep(textarea) {
  max-height: 220px;
  resize: vertical;
  border-radius: var(--pf-radius-md);
}
.parse-btn {
  margin: 0;
}
.parsed-list {
  background: transparent;
  border: none;
  overflow: visible;
  max-height: none;
  min-width: 0;
}
.parsed-label {
  font-size: 11px;
  color: var(--pf-text-secondary);
  padding: 0;
  font-weight: 700;
}

.parsed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 0 var(--pf-gap-xs);
  min-width: 0;
}

.option-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.option-card-grid-compact :deep(.strategy-card) {
  min-height: 72px;
}

.option-card-grid-compact :deep(.strategy-title) {
  font-size: 12px;
  line-height: 1.35;
  word-break: break-word;
}

.option-card-grid-compact :deep(.strategy-tag) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.divider-line {
  height: 1px;
  margin: 0;
  background: color-mix(in srgb, var(--pf-border-color) 84%, transparent);
}

.field {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--pf-gap-xs);
}
.field-label {
  display: block;
  font-size: 12px;
  color: var(--pf-text);
  margin: 0;
  font-weight: 700;
}

@media (max-width: 980px) {
  .option-card-grid {
    grid-template-columns: 1fr;
  }
}

.panel-footer {
  position: sticky;
  bottom: 0;
  z-index: 4;
  padding: var(--pf-gap-sm);
  background: var(--pf-bg-soft);
  border-top: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 88%, transparent);
  flex-shrink: 0;
}
.export-btn {
  height: 48px;
  font-weight: 700;
  font-size: 14px;
  border-radius: var(--pf-radius-md);
  transition:
    color var(--pf-transition-normal) var(--pf-ease-standard),
    background-color var(--pf-transition-normal) var(--pf-ease-standard),
    border-color var(--pf-transition-normal) var(--pf-ease-standard),
    transform var(--pf-transition-normal) var(--pf-ease-standard),
    opacity var(--pf-transition-normal) var(--pf-ease-standard),
    box-shadow var(--pf-transition-normal) var(--pf-ease-standard);
}

[data-theme='light'] .export-btn {
  background: linear-gradient(180deg, #2563eb, #1d4ed8);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.28);
}
[data-theme='light'] .export-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, #1d4ed8, #1e40af);
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.34);
  transform: translateY(-2px);
}
[data-theme='light'] .export-btn:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  box-shadow: none;
}

.scope-banner {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-sm);
  padding: var(--pf-gap-sm);
  margin: 0;
  background: color-mix(in srgb, var(--pf-primary-soft) 40%, var(--pf-bg-soft));
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-primary) 14%, transparent);
  border-radius: var(--pf-radius-md);
  box-shadow: none;
}
.scope-banner-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.scope-banner-value {
  font-size: 13px;
  font-weight: 800;
  color: var(--pf-primary);
}
.advanced-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--pf-gap-sm);
}
.advanced-card {
  display: flex;
  flex-direction: column;
  gap: var(--pf-gap-xs);
  padding: var(--pf-gap-sm);
  background: var(--pf-bg);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  border-radius: var(--pf-radius-md);
}
.advanced-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.advanced-value {
  font-size: 15px;
  font-weight: 800;
  color: var(--pf-text);
}
.meta-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--pf-gap-sm);
}
.meta-summary-item {
  display: flex;
  flex-direction: column;
  gap: var(--pf-gap-xs);
  padding: var(--pf-gap-sm);
  background: var(--pf-bg);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  border-radius: var(--pf-radius-md);
}
.meta-summary-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.meta-summary-value {
  font-size: 14px;
  font-weight: 800;
  color: var(--pf-text);
}
.meta-note {
  margin: 0;
  font-size: 12px;
  color: var(--pf-text-secondary);
}
.meta-tab {
  display: flex;
  flex-direction: column;
  gap: var(--export-stack-gap, var(--pf-gap-sm));
}
.meta-detail-block {
  gap: var(--pf-gap-sm);
}
.meta-detail-stack {
  display: flex;
  flex-direction: column;
  gap: var(--pf-gap-sm);
  min-width: 0;
}
.meta-preview-hero {
  width: 100%;
  aspect-ratio: 4 / 3;
  max-height: 200px;
  border-radius: var(--pf-radius-md);
  overflow: hidden;
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.meta-preview-hero-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.meta-preview-empty {
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text-secondary);
}
.meta-info-panel {
  padding: var(--pf-gap-sm);
  border-radius: var(--pf-radius-md);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  background: var(--pf-bg);
}
.meta-grid {
  display: grid;
  gap: var(--pf-gap-sm);
}
.meta-row {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: var(--pf-gap-sm);
  align-items: center;
  min-width: 0;
  padding: 6px 0;
  border-bottom: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 72%, transparent);
}
.meta-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.meta-row:first-child {
  padding-top: 0;
}
.meta-row.multiline {
  align-items: start;
}
.meta-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text-secondary);
}
.meta-value {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--pf-gap-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--pf-text);
  word-break: break-all;
}
.meta-value.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.meta-color {
  width: 12px;
  height: 12px;
  border-radius: var(--pf-radius-pill);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border) 84%, transparent);
  flex: 0 0 auto;
}
</style>
