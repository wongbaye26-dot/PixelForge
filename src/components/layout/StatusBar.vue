<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { NProgress } from 'naive-ui'
import { useExportStore } from '@/stores/export'
import { useLibraryStore } from '@/stores/library'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import { useSystemMetricsStore } from '@/stores/system-metrics'

import { useContextSelectionCount } from '@/composables/use-context-selection-count'

const exportStore = useExportStore()
const library = useLibraryStore()
const tasks = useTasksStore()
const ui = useUiStore()
const sys = useSystemMetricsStore()
const { selectedCount, selectionMetricLabel } = useContextSelectionCount()

const progress = computed(() => {
  if (exportStore.exporting) return tasks.overallProgress || 5
  if (tasks.tasks.length) return tasks.overallProgress
  return 0
})

const speedText = computed(() => {
  if (exportStore.exporting) return '处理中…'
  if (tasks.completedCount) return `${tasks.completedCount} 项已完成`
  return '就绪'
})

const memPercent = computed(() => {
  if (!sys.memTotalBytes) return 0
  return Math.round((sys.memUsedBytes / sys.memTotalBytes) * 100)
})

function formatMem(bytes: number) {
  if (!bytes) return '—'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}

const systemStatusText = computed(() => {
  if (exportStore.exporting) return `导出中 ${Math.round(progress.value)}%`
  if (tasks.tasks.length) return speedText.value
  return sys.cpuPercent > 85 ? '系统繁忙' : '系统就绪'
})

onMounted(() => {
  sys.start()
})

onUnmounted(() => {
  sys.stop()
})
</script>

<template>
  <footer class="status-bar">
    <div class="metrics">
      <div class="metric-item">
        <span class="metric-label">图片总数</span>
        <span class="val">{{ library.assets.length }}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">{{ selectionMetricLabel }}</span>
        <span class="val">{{ selectedCount }}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">导出队列</span>
        <span class="val">{{ tasks.tasks.length }}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">CPU</span>
        <span class="val">{{ Math.round(sys.cpuPercent) }}%</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">内存</span>
        <span class="val">{{ memPercent }}%</span>
        <span class="metric-sub">{{ formatMem(sys.memUsedBytes) }} / {{ formatMem(sys.memTotalBytes) }}</span>
      </div>
      <div class="metric-item status-chip">
        <span class="metric-label">系统状态</span>
        <span class="val">{{ systemStatusText }}</span>
      </div>
    </div>

    <div class="status-right">
      <div class="total-prog-wrap">
        <span class="prog-label">队列进度</span>
        <NProgress
          type="line"
          :percentage="progress"
          :show-indicator="false"
          :height="6"
          color="var(--pf-primary)"
          :rail-color="ui.isDark ? '#333' : '#e5e5ea'"
          style="width: 200px"
        />
        <span class="prog-val">{{ Math.round(progress) }}%</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(var(--pf-gap-sm), 1vw, var(--pf-gap-lg));
  padding: 0 clamp(var(--pf-gap-sm), 1.2vw, var(--pf-gap-lg));
  background: var(--pf-bg);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 90%, transparent);
  border-radius: var(--pf-radius-lg);
  box-shadow: var(--pf-shadow-flat);
  height: var(--pf-status-height);
  z-index: 100;
  min-width: 0;
}

.metrics {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-sm);
  font-size: 11px;
  color: var(--pf-text-secondary);
  font-weight: 600;
  min-width: 0;
  flex-wrap: wrap;
}

.metric-item {
  display: inline-flex;
  align-items: center;
  gap: var(--pf-gap-xs);
  min-height: 24px;
  padding: 0 var(--pf-gap-sm);
  border-radius: var(--pf-radius-pill);
  background: color-mix(in srgb, var(--pf-bg-soft) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--pf-border) 68%, transparent);
}

.metric-label {
  color: var(--pf-text-secondary);
}

.val {
  color: var(--pf-text);
  font-weight: 700;
}

.metric-sub {
  color: var(--pf-text-secondary);
  font-weight: 600;
  font-size: 10px;
}

.status-chip {
  background: color-mix(in srgb, var(--pf-primary-soft) 56%, var(--pf-bg));
}

.status-right {
  display: flex;
  align-items: center;
  min-width: 0;
}

.total-prog-wrap {
  display: flex;
  align-items: center;
  gap: var(--pf-gap-sm);
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  min-width: 0;
}

.prog-label {
  white-space: nowrap;
}

.prog-val {
  color: var(--pf-primary);
  min-width: 30px;
}
</style>
