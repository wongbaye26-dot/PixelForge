<script setup lang="ts">
import { computed } from 'vue'
import { NProgress } from 'naive-ui'
import { useExportStore } from '@/stores/export'
import { useLibraryStore } from '@/stores/library'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'

const exportStore = useExportStore()
const library = useLibraryStore()
const tasks = useTasksStore()
const ui = useUiStore()

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
</script>

<template>
  <footer class="status-bar">
    <div class="metrics">
      <div class="metric-item">CPU: <span class="val">32%</span></div>
      <div class="metric-item">内存: <span class="val">48%</span></div>
      <div class="metric-item">状态: <span class="val">{{ speedText }}</span></div>
      <div class="divider"></div>
      <div class="metric-item">图库 <span class="val">{{ library.assets.length }}</span> 张</div>
    </div>
    
    <div class="status-right">
      <div class="total-prog-wrap">
        <span class="prog-label">总进度</span>
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
  padding: 0 20px;
  background: var(--pf-bg);
  border-top: 1px solid var(--pf-border);
  height: var(--pf-status-height);
  z-index: 100;
}

.metrics {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 11px;
  color: var(--pf-text-secondary);
  font-weight: 500;
}

.val {
  color: var(--pf-text);
  font-weight: 700;
}

.divider {
  width: 1px;
  height: 12px;
  background: var(--pf-border);
}

.status-right {
  display: flex;
  align-items: center;
}

.total-prog-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--pf-text-secondary);
}

.prog-val {
  color: var(--pf-primary);
  min-width: 30px;
}
</style>
