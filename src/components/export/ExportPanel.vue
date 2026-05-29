<script setup lang="ts">
import {
  NInput,
  NCheckbox,
  NCheckboxGroup,
  NSlider,
  NButton,
  NTabs,
  NTabPane,
  NCollapse,
  NCollapseItem,
  useMessage,
} from 'naive-ui'
import { computed, watch, onMounted } from 'vue'
import { useExportStore } from '@/stores/export'
import { useLibraryStore } from '@/stores/library'
import { useTasksStore, type ExportTaskRow } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import type { ExportFormat } from '@/types'
import FitModePicker from './FitModePicker.vue'
import AutoMatchExportPanel from '@/modules/export-matcher/components/AutoMatchExportPanel.vue'

const exportStore = useExportStore()
const library = useLibraryStore()
const tasks = useTasksStore()
const ui = useUiStore()
const message = useMessage()
const isElectron = typeof window !== 'undefined' && !!window.pixelForge?.isElectron

const formatOptions: { label: string; value: ExportFormat }[] = [
  { label: '原图格式', value: 'original' },
  { label: 'JPG', value: 'jpg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'AVIF', value: 'avif' },
  { label: 'GIF', value: 'gif' },
]

const exportSummary = computed(() => {
  exportStore.parseSizes()
  const nImg = library.selectedIds.size
  const nSize = exportStore.activeSizes().length
  const nFmt = exportStore.formats.length
  const total = nImg * nSize * nFmt
  if (!nImg) return '请先选择图片'
  if (!nSize) return '请解析并勾选尺寸'
  return `开始导出 (${nImg} 张 × ${nSize} 尺寸 × ${nFmt} 格式 = ${total} 项)`
})

watch(
  () => exportStore.sizeInput,
  () => {
    exportStore.parseSizes()
    exportStore.persistSettings()
  },
  { immediate: true },
)

watch(
  () => exportStore.enabledSizeKeys,
  () => {
    exportStore.persistSettings()
  },
  { deep: true },
)

onMounted(async () => {
  await exportStore.loadExportDir()
  await exportStore.loadSettings()
})

function ratioDisplay(label: string) {
  return label.replace('-', ':')
}

function buildTaskRows(assetIds: number[]): ExportTaskRow[] {
  const sizes = exportStore.activeSizes()
  const rows: ExportTaskRow[] = []
  for (const id of assetIds) {
    const asset = library.assets.find((a) => a.id === id)
    if (!asset) continue
    for (const size of sizes) {
      for (const format of exportStore.formats) {
        rows.push({
          id: `${id}-${size.width}x${size.height}-${format}`,
          assetId: id,
          filename: asset.filename,
          thumbnailUrl: asset.previewUrl ?? asset.thumbnailUrl,
          targetSize: `${size.width}×${size.height}`,
          format,
          progress: 0,
          status: 'waiting',
        })
      }
    }
  }
  return rows
}

async function pickExportDir() {
  if (isElectron) {
    const p = await window.pixelForge?.pickFolder()
    if (p) await exportStore.saveExportDir(p)
    return
  }
  if (exportStore.outputDir.trim()) {
    await exportStore.saveExportDir(exportStore.outputDir.trim())
    message.success('导出目录已更新')
  }
}

async function applyExportDir() {
  if (!exportStore.outputDir.trim()) {
    message.warning('请输入导出目录路径')
    return
  }
  await exportStore.saveExportDir(exportStore.outputDir.trim())
  message.success('导出目录已保存')
}

async function handleExport() {
  const ids = [...library.selectedIds]
  if (!ids.length) {
    message.warning('请先在图库中选择图片')
    return
  }
  exportStore.parseSizes()
  if (!exportStore.activeSizes().length) {
    message.warning('请填写有效尺寸并勾选')
    return
  }

  const rows = buildTaskRows(ids)
  tasks.setTasks(rows)
  ui.showExportTasks = true
  rows.forEach((r) => tasks.updateTask(r.id, { status: 'processing', progress: 15 }))

  const result = await exportStore.runExport(ids)
  if (!result) return

  let idx = 0
  for (const r of result.results) {
    const row = rows[idx]
    if (row) {
      tasks.updateTask(row.id, {
        status: r.error ? 'failed' : 'completed',
        progress: 100,
      })
    }
    idx++
  }
  message.success(`导出完成 ${result.completed}/${result.total} → ${exportStore.outputDir}`)
}
</script>

<template>
  <div class="panel">
    <NTabs v-model:value="ui.rightTab" type="line" size="small" class="tabs">
      <NTabPane name="export" tab="导出设置" />
      <NTabPane name="edit" tab="图片编辑" disabled />
      <NTabPane name="metadata" tab="元数据" disabled />
    </NTabs>

    <div v-show="ui.rightTab === 'export'" class="panel-body">
      <AutoMatchExportPanel />
      <section class="block">
        <h3 class="block-title">1. 批量尺寸设置</h3>
        <NInput
          v-model:value="exportStore.sizeInput"
          type="textarea"
          :rows="4"
          placeholder="每行一个，如 1920x1080"
          class="size-input"
        />
        <NButton block size="small" class="parse-btn" @click="exportStore.parseSizes()">
          解析尺寸
        </NButton>
        <div v-if="exportStore.parsedSizes.length" class="parsed-list">
          <div class="parsed-label">解析结果</div>
          <label
            v-for="s in exportStore.parsedSizes"
            :key="exportStore.sizeKey(s)"
            class="parsed-row"
          >
            <NCheckbox
              :checked="exportStore.enabledSizeKeys.has(exportStore.sizeKey(s))"
              @update:checked="(v: boolean) => exportStore.setSizeEnabled(exportStore.sizeKey(s), v)"
            />
            <span class="parsed-size">{{ s.width }} × {{ s.height }}</span>
            <span class="parsed-ratio">{{ ratioDisplay(s.ratioLabel) }}</span>
          </label>
        </div>
      </section>

      <section class="block">
        <h3 class="block-title">2. 适配模式</h3>
        <FitModePicker v-model="exportStore.fitMode" />
      </section>

      <NCollapse :default-expanded-names="['output', 'compress', 'dir']">
        <NCollapseItem title="3. 输出设置" name="output">
          <NCheckboxGroup v-model:value="exportStore.formats">
            <div class="format-grid">
              <NCheckbox
                v-for="opt in formatOptions"
                :key="opt.value"
                :value="opt.value"
                :label="opt.label"
              />
            </div>
          </NCheckboxGroup>
          <div class="field">
            <span class="field-label">命名规则</span>
            <NInput
              v-model:value="exportStore.namingPattern"
              size="small"
              placeholder="{name}_{size}.{format}"
            />
          </div>
        </NCollapseItem>

        <NCollapseItem title="4. 高级压缩设置" name="compress">
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
        </NCollapseItem>

        <NCollapseItem title="5. 导出目录" name="dir">
          <div class="field">
            <div class="path-input-group">
              <NInput
                v-model:value="exportStore.outputDir"
                size="small"
                placeholder="选择导出文件夹..."
                @blur="applyExportDir"
              />
              <NButton size="small" type="primary" @click="pickExportDir">
                {{ isElectron ? '选择' : '应用' }}
              </NButton>
            </div>
            <p class="path-hint">默认：{{ exportStore.defaultOutputDir || '—' }}</p>
            <NButton size="tiny" quaternary @click="exportStore.resetExportDir()" style="margin-top: 8px">
              恢复默认
            </NButton>
          </div>
        </NCollapseItem>
      </NCollapse>
    </div>

    <div class="panel-footer">
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
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--pf-bg-elevated);
  border-left: 1px solid var(--pf-border);
}
.tabs {
  flex-shrink: 0;
  padding: 0 8px;
  background: var(--pf-bg);
  border-bottom: 1px solid var(--pf-border);
}
.tabs :deep(.n-tabs-tab) {
  font-size: 12px;
  padding: 10px 16px;
}
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.block {
  margin-bottom: 20px;
  background: var(--pf-bg);
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--pf-border);
  box-shadow: var(--pf-shadow);
}
.block-title {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.size-input {
  margin-bottom: 10px;
}
.parse-btn {
  margin-bottom: 14px;
}
.parsed-list {
  background: var(--pf-bg-elevated);
  border-radius: 8px;
  border: 1px solid var(--pf-border);
  overflow: hidden;
}
.parsed-label {
  font-size: 11px;
  color: var(--pf-text-secondary);
  padding: 10px 12px 6px;
  font-weight: 600;
}
.parsed-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid var(--pf-border);
  cursor: pointer;
  font-size: 12px;
  color: var(--pf-text);
  transition: background 0.15s;
}
.parsed-row:hover {
  background: var(--pf-bg-hover);
}
.parsed-size {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
}
.parsed-ratio {
  margin-left: auto;
  color: var(--pf-text-secondary);
  font-size: 11px;
}

.field {
  margin-bottom: 16px;
}
.field:last-child {
  margin-bottom: 0;
}
.field-label {
  display: block;
  font-size: 12px;
  color: var(--pf-text);
  margin-bottom: 8px;
  font-weight: 500;
}
.format-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.path-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.path-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
.path-hint {
  font-size: 11px;
  color: var(--pf-text-secondary);
  margin-top: 8px;
  line-height: 1.4;
  word-break: break-all;
}

.panel-footer {
  padding: 16px;
  background: var(--pf-bg);
  border-top: 1px solid var(--pf-border);
}
.export-btn {
  height: 44px;
  font-weight: 600;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

[data-theme='light'] .export-btn {
  background: #2563eb; /* blue-600 */
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1);
}
[data-theme='light'] .export-btn:hover:not(:disabled) {
  background: #1d4ed8; /* blue-700 */
  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(37, 99, 235, 0.15);
  transform: translateY(-1px);
}
[data-theme='light'] .export-btn:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  box-shadow: none;
}
</style>
