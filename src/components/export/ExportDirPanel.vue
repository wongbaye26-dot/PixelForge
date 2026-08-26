<script setup lang="ts">
import { NButton, NInput } from 'naive-ui'
import { computed } from 'vue'
import { useExportStore } from '@/stores/export'
import { useFeedback } from '@/composables/use-feedback'

withDefaults(
  defineProps<{
    caption?: string
    showReset?: boolean
  }>(),
  {
    caption: '导出文件将保存到此目录',
    showReset: true,
  },
)

const exportStore = useExportStore()
const feedback = useFeedback()
const isElectron = typeof window !== 'undefined' && !!window.pixelForge?.isElectron

const hasPath = computed(() => Boolean(exportStore.outputDir.trim()))
const displayPath = computed(() => exportStore.outputDir.trim() || '未选择导出目录')
const folderName = computed(() => {
  const p = exportStore.outputDir.trim()
  if (!p) return '未选择目录'
  const parts = p.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] || p
})

async function pickExportDir() {
  try {
    if (isElectron) {
      const p = await window.pixelForge?.pickFolder()
      if (p) await exportStore.saveExportDir(p)
      return
    }
    if (exportStore.outputDir.trim()) {
      await exportStore.saveExportDir(exportStore.outputDir.trim())
      feedback.success('导出目录已更新')
    } else {
      feedback.warning('请输入导出目录路径')
    }
  } catch {
    feedback.error('导出目录更新失败')
  }
}

async function applyExportDir() {
  if (!exportStore.outputDir.trim()) return
  try {
    await exportStore.saveExportDir(exportStore.outputDir.trim())
    feedback.success('导出目录已保存')
  } catch {
    feedback.error('导出目录保存失败')
  }
}

async function openExportDir() {
  if (!exportStore.outputDir.trim()) {
    feedback.warning('请先设置导出目录')
    return
  }
  try {
    await window.pixelForge?.openPath?.(exportStore.outputDir)
  } catch {
    feedback.error('无法打开导出目录')
  }
}
</script>

<template>
  <section class="export-dir">
    <div class="export-dir-head">
      <div>
        <h3 class="export-dir-title">导出目录</h3>
        <p class="export-dir-caption">{{ caption }}</p>
      </div>
      <span class="export-dir-badge" :class="{ ok: hasPath }">{{ hasPath ? '已设置' : '未设置' }}</span>
    </div>

    <div class="export-dir-card" :class="{ empty: !hasPath }">
      <div class="export-dir-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="folder-svg">
          <path
            d="M4 7.5A2.5 2.5 0 0 1 6.5 5H9l1.2 1.5H17.5A2.5 2.5 0 0 1 20 9v8.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5V7.5Z"
            fill="currentColor"
            opacity="0.92"
          />
        </svg>
      </div>
      <div class="export-dir-body">
        <div class="export-dir-name">{{ folderName }}</div>
        <div class="export-dir-path" :title="displayPath">{{ displayPath }}</div>
      </div>
    </div>

    <div v-if="!isElectron" class="export-dir-input">
      <NInput
        v-model:value="exportStore.outputDir"
        size="small"
        placeholder="输入或粘贴导出目录路径…"
        @blur="applyExportDir"
      />
    </div>

    <div class="export-dir-actions">
      <NButton size="small" type="primary" @click="pickExportDir">
        {{ isElectron ? '选择文件夹' : '保存路径' }}
      </NButton>
      <NButton size="small" secondary :disabled="!hasPath || !isElectron" @click="openExportDir">打开</NButton>
      <NButton
        v-if="showReset"
        size="small"
        quaternary
        :disabled="!exportStore.defaultOutputDir"
        @click="exportStore.resetExportDir()"
      >
        恢复默认
      </NButton>
    </div>
  </section>
</template>

<style scoped>
.export-dir {
  display: flex;
  flex-direction: column;
  gap: var(--pf-gap-sm);
  padding: var(--pf-gap-sm);
  border-radius: var(--pf-radius-md);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-primary) 16%, var(--pf-border-color));
  background: color-mix(in srgb, var(--pf-primary-soft) 18%, var(--pf-bg-soft));
  min-width: 0;
}
.export-dir-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--pf-gap-sm);
}
.export-dir-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.export-dir-caption {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.35;
  color: var(--pf-text-secondary);
}
.export-dir-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: var(--pf-radius-pill);
  font-size: 10px;
  font-weight: 800;
  color: var(--pf-text-secondary);
  background: color-mix(in srgb, var(--pf-bg) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
}
.export-dir-badge.ok {
  color: var(--pf-primary);
  background: color-mix(in srgb, var(--pf-primary-soft) 70%, var(--pf-bg));
  border-color: color-mix(in srgb, var(--pf-primary) 24%, transparent);
}
.export-dir-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: var(--pf-radius-md);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 86%, transparent);
  background: var(--pf-bg);
  min-width: 0;
}
.export-dir-card.empty {
  border-style: dashed;
  background: color-mix(in srgb, var(--pf-bg-soft) 90%, transparent);
}
.export-dir-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pf-primary);
  background: color-mix(in srgb, var(--pf-primary-soft) 65%, var(--pf-bg));
}
.folder-svg {
  width: 20px;
  height: 20px;
}
.export-dir-body {
  min-width: 0;
  flex: 1;
}
.export-dir-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--pf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.export-dir-path {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--pf-text-secondary);
  line-height: 1.4;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.export-dir-input {
  min-width: 0;
}
.export-dir-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
