<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NProgress } from 'naive-ui'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import { useFeedback } from '@/composables/use-feedback'
import { resolveMediaUrl } from '@/utils/media-url'

const emit = defineEmits<{ close: [] }>()

const tasks = useTasksStore()
const ui = useUiStore()
const feedback = useFeedback()
const collapsed = ref(true)

const failedCount = computed(() => tasks.tasks.filter((row) => row.status === 'failed').length)
const runningCount = computed(() =>
  tasks.tasks.filter((row) => row.status === 'processing' || row.status === 'pending').length,
)

const statusLabel: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

watch(
  () => tasks.tasks.length,
  (count, prev) => {
    if (count > 0 && (prev === undefined || prev === 0 || count > prev)) collapsed.value = false
  },
  { immediate: true },
)

function taskThumb(row: { thumbnailUrl?: string; format: string; assetId?: number }) {
  if (row.format === 'gif' && row.assetId) {
    return resolveMediaUrl(`/api/assets/${row.assetId}/preview`)
  }
  return resolveMediaUrl(row.thumbnailUrl)
}

function actionLabel(row: { status: string; source?: string }) {
  if (row.source === 'smart-export') {
    if (row.status === 'failed') return '重试'
    return ''
  }
  if (row.status === 'processing') return '暂停'
  if (row.status === 'paused') return '继续'
  if (row.status === 'failed') return '重试'
  return '取消'
}

function canPrimaryAction(status: string, source?: string) {
  if (source === 'smart-export') return status === 'failed'
  return ['processing', 'paused', 'failed'].includes(status)
}

async function handlePrimaryAction(id: string, status: string) {
  try {
    if (status === 'processing') {
      await tasks.pauseTask(id)
      return
    }
    if (status === 'paused') {
      await tasks.resumeTask(id)
      return
    }
    if (status === 'failed') {
      await tasks.retryTask(id)
    }
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '任务操作失败，请稍后重试')
  }
}

async function handleCancel(id: string) {
  try {
    await tasks.cancelTask(id)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '任务取消失败，请稍后重试')
  }
}

function canCancel(status: string, source?: string) {
  if (source === 'smart-export') return ['pending', 'processing'].includes(status)
  return ['pending', 'processing', 'paused'].includes(status)
}
</script>

<template>
  <div class="task-dock" :class="{ collapsed }">
    <div class="task-dock-bar">
      <button type="button" class="task-dock-toggle" @click="collapsed = !collapsed">
        <span class="task-dock-chevron" :class="{ up: !collapsed }">▾</span>
        <span class="task-dock-title">导出任务</span>
        <span v-if="tasks.tasks.length" class="task-dock-count">{{ tasks.tasks.length }}</span>
        <NProgress
          v-if="tasks.tasks.length"
          type="line"
          :percentage="tasks.overallProgress"
          :show-indicator="false"
          :height="3"
          class="task-dock-mini-progress"
          color="var(--pf-primary)"
          :rail-color="ui.isDark ? '#333' : '#e5e5ea'"
        />
        <span v-if="tasks.tasks.length && collapsed" class="task-dock-hint">
          {{ tasks.completedCount }}/{{ tasks.tasks.length }} 完成
          <template v-if="runningCount"> · {{ runningCount }} 进行中</template>
        </span>
      </button>
      <div class="task-dock-actions">
        <NButton
          size="tiny"
          quaternary
          :disabled="!tasks.tasks.length"
          @click.stop="tasks.clearTasks()"
        >
          清空
        </NButton>
        <button type="button" class="task-dock-close" title="关闭面板" @click="emit('close')">
          ×
        </button>
      </div>
    </div>

    <div v-show="!collapsed" class="task-dock-body">
      <div v-if="!tasks.tasks.length" class="task-empty">
        <span class="task-empty-icon" aria-hidden="true">📤</span>
        <p class="task-empty-title">暂无导出任务</p>
        <p class="task-empty-desc">在右侧导出设置或智能导出中发起任务后，将在此显示进度</p>
      </div>

      <ul v-else class="task-list">
        <li
          v-for="row in tasks.tasks"
          :key="row.id"
          class="task-card"
          :class="row.status"
        >
          <img
            v-if="taskThumb(row)"
            :src="taskThumb(row)"
            alt=""
            class="task-thumb"
          />
          <div v-else class="task-thumb task-thumb--placeholder" />

          <div class="task-main">
            <div class="task-row-top">
              <span class="task-name" :title="row.filename">{{ row.filename }}</span>
              <span class="status-badge" :class="row.status">{{ statusLabel[row.status] }}</span>
              <span class="fmt-badge">{{ row.format.toUpperCase() }}</span>
            </div>
            <div class="task-row-meta">
              <span class="task-size">{{ row.targetSize }}</span>
              <span
                v-if="row.errorMessage"
                class="task-detail task-detail--error"
                :title="row.errorMessage"
              >
                {{ row.errorMessage }}
              </span>
              <span
                v-else-if="row.outputPath"
                class="task-detail"
                :title="row.outputPath"
              >
                {{ row.outputPath }}
              </span>
            </div>
            <div class="task-progress">
              <NProgress
                type="line"
                :percentage="row.progress"
                :show-indicator="false"
                :height="3"
                color="var(--pf-primary)"
                :rail-color="ui.isDark ? '#333' : '#e5e5ea'"
              />
              <span class="task-progress-text">{{ row.progress }}%</span>
            </div>
          </div>

          <div class="task-row-actions">
            <NButton
              v-if="canPrimaryAction(row.status, row.source)"
              size="tiny"
              secondary
              :loading="row.actionPending"
              @click="handlePrimaryAction(row.id, row.status)"
            >
              {{ actionLabel(row) }}
            </NButton>
            <NButton
              v-if="canCancel(row.status, row.source)"
              size="tiny"
              quaternary
              :loading="row.actionPending"
              @click="handleCancel(row.id)"
            >
              取消
            </NButton>
          </div>
        </li>
      </ul>

      <div v-if="tasks.tasks.length" class="task-dock-footer">
        <span class="footer-label">总进度</span>
        <NProgress
          type="line"
          :percentage="tasks.overallProgress"
          :show-indicator="false"
          :height="4"
          class="footer-progress"
          color="var(--pf-primary)"
          :rail-color="ui.isDark ? '#333' : '#e5e5ea'"
        />
        <span class="footer-stat">{{ tasks.overallProgress }}%</span>
        <span class="footer-meta">
          完成 {{ tasks.completedCount }} · 失败 {{ failedCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-dock {
  flex-shrink: 0;
  border-top: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 88%, transparent);
  background: var(--pf-bg-soft);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.task-dock-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 0;
  min-height: 36px;
  background: color-mix(in srgb, var(--pf-bg-elevated) 92%, var(--pf-bg-soft));
  border-bottom: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 70%, transparent);
}

.task-dock.collapsed .task-dock-bar {
  border-bottom: none;
}

.task-dock-toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--pf-text);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  text-align: left;
}

.task-dock-chevron {
  font-size: 10px;
  color: var(--pf-text-secondary);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.task-dock-chevron.up {
  transform: rotate(180deg);
}

.task-dock-title {
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.task-dock-count {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--pf-radius-pill);
  background: var(--pf-primary-soft);
  color: var(--pf-primary);
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.task-dock-mini-progress {
  flex: 1;
  min-width: 48px;
  max-width: 120px;
}

.task-dock-hint {
  font-size: 11px;
  font-weight: 600;
  color: var(--pf-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-dock-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.task-dock-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--pf-radius-md);
  background: transparent;
  color: var(--pf-text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-dock-close:hover {
  background: var(--pf-bg-hover);
  color: var(--pf-text);
}

.task-dock-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: min(220px, 30vh);
}

.task-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px 20px;
  text-align: center;
}

.task-empty-icon {
  font-size: 20px;
  opacity: 0.5;
}

.task-empty-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text-secondary);
}

.task-empty-desc {
  margin: 0;
  font-size: 11px;
  color: var(--pf-text-tertiary, var(--pf-text-secondary));
  max-width: 320px;
  line-height: 1.4;
}

.task-list {
  list-style: none;
  margin: 0;
  padding: 6px 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border-radius: var(--pf-radius-md);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 75%, transparent);
  background: var(--pf-bg);
}

.task-thumb {
  width: 36px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 80%, transparent);
}

.task-thumb--placeholder {
  background: var(--pf-bg-soft);
}

.task-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-row-top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.task-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.task-row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 10px;
  color: var(--pf-text-secondary);
}

.task-size {
  flex-shrink: 0;
  font-weight: 600;
}

.task-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.task-detail--error {
  color: var(--pf-danger);
  font-weight: 600;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 6px;
}

.task-progress :deep(.n-progress) {
  flex: 1;
  min-width: 0;
}

.task-progress-text {
  font-size: 10px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  flex-shrink: 0;
  width: 28px;
  text-align: right;
}

.status-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}

.status-badge.processing {
  background: rgba(0, 122, 255, 0.12);
  color: var(--pf-primary);
}

.status-badge.completed {
  background: rgba(40, 167, 69, 0.12);
  color: var(--pf-success);
}

.status-badge.pending {
  background: var(--pf-bg-soft);
  color: var(--pf-text-secondary);
}

.status-badge.paused {
  background: rgba(245, 124, 0, 0.12);
  color: var(--pf-warning);
}

.status-badge.failed {
  background: rgba(211, 47, 47, 0.12);
  color: var(--pf-danger);
}

.status-badge.cancelled {
  background: rgba(120, 120, 128, 0.12);
  color: var(--pf-text-secondary);
}

.fmt-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 800;
  color: var(--pf-text-secondary);
}

.task-row-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.task-dock-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-top: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 70%, transparent);
  background: color-mix(in srgb, var(--pf-bg-elevated) 90%, var(--pf-bg-soft));
  font-size: 11px;
  font-weight: 600;
  color: var(--pf-text);
  flex-shrink: 0;
}

.footer-label {
  flex-shrink: 0;
  color: var(--pf-text-secondary);
}

.footer-progress {
  flex: 1;
  min-width: 60px;
}

.footer-stat {
  flex-shrink: 0;
  font-weight: 800;
  color: var(--pf-primary);
  min-width: 32px;
}

.footer-meta {
  flex-shrink: 0;
  color: var(--pf-text-secondary);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .task-dock-mini-progress {
    display: none;
  }

  .task-card {
    grid-template-columns: 32px minmax(0, 1fr);
    grid-template-rows: auto auto;
  }

  .task-row-actions {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: flex-end;
  }

  .task-dock-footer {
    flex-wrap: wrap;
    gap: 4px 8px;
  }

  .footer-meta {
    width: 100%;
    font-size: 10px;
  }
}
</style>
