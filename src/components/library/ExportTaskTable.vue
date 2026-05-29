<script setup lang="ts">
import { NButton, NProgress, NEmpty } from 'naive-ui'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import { resolveMediaUrl, assetDisplayUrl } from '@/utils/media-url'
import type { ImageAsset } from '@/types'

const tasks = useTasksStore()
const ui = useUiStore()

const statusLabel: Record<string, string> = {
  waiting: '等待中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
}

function taskThumb(row: { thumbnailUrl?: string; format: string; assetId?: number }) {
  if (row.format === 'gif' && row.assetId) {
    return resolveMediaUrl(`/api/assets/${row.assetId}/preview`)
  }
  return resolveMediaUrl(row.thumbnailUrl)
}
</script>

<template>
  <div class="task-panel">
    <div class="task-header">
      <span class="task-title">导出任务 ({{ tasks.tasks.length }})</span>
      <div class="task-actions">
        <NButton size="tiny" secondary :disabled="!tasks.tasks.length">
          <template #icon>▶</template> 全部开始
        </NButton>
        <NButton size="tiny" secondary :disabled="!tasks.tasks.length">
          <template #icon>⏸</template> 暂停
        </NButton>
        <NButton size="tiny" secondary :disabled="!tasks.tasks.length" @click="tasks.clearTasks()">
          <template #icon>🗑️</template> 清空
        </NButton>
      </div>
    </div>

    <NEmpty v-if="!tasks.tasks.length" size="small" description="暂无导出任务" class="empty" />

    <div v-else class="table-wrap">
      <table class="task-table">
        <thead>
          <tr>
            <th>目标文件</th>
            <th>目标尺寸</th>
            <th>进度</th>
            <th>状态</th>
            <th>输出格式</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tasks.tasks" :key="row.id">
            <td class="file-cell">
              <img
                v-if="taskThumb(row)"
                :src="taskThumb(row)"
                alt=""
                class="thumb"
              />
              <div class="file-info">
                <span class="fname">{{ row.filename }}</span>
                <span class="fsize">等 {{ row.targetSize }} 个尺寸</span>
              </div>
            </td>
            <td class="size-cell">{{ row.targetSize }}</td>
            <td class="prog-cell">
              <div class="prog-detail">
                <span class="prog-text">处理中 1/2</span>
                <NProgress
                  type="line"
                  :percentage="row.progress"
                  :show-indicator="false"
                  :height="4"
                  color="var(--pf-primary)"
                  :rail-color="ui.isDark ? '#333' : '#e5e5ea'"
                />
              </div>
            </td>
            <td>
              <span class="status-badge" :class="row.status">{{ statusLabel[row.status] }}</span>
            </td>
            <td>
              <span class="fmt-badge">{{ row.format.toUpperCase() }}</span>
            </td>
            <td class="actions-cell">
              <button class="action-btn" title="查看文件夹">📂</button>
              <button class="action-btn" title="删除任务">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div v-if="tasks.tasks.length" class="task-footer">
      <div class="speed-info">
        总进度:
        <NProgress
          type="line"
          :percentage="75"
          :show-indicator="true"
          :height="8"
          color="var(--pf-primary)"
          :rail-color="ui.isDark ? '#333' : '#e5e5ea'"
          style="width: 300px"
        />
        <span class="speed-val">总速度: 2.4 张/秒</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-panel {
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
  flex-shrink: 0;
  max-height: 300px;
  display: flex;
  flex-direction: column;
}
.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--pf-bg-elevated);
  border-bottom: 1px solid var(--pf-border);
}
.task-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--pf-text);
}
.task-actions {
  display: flex;
  gap: 8px;
}
.empty {
  padding: 40px;
}
.table-wrap {
  overflow: auto;
  flex: 1;
}
.task-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.task-table th {
  text-align: left;
  padding: 10px 16px;
  color: var(--pf-text-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--pf-border);
  position: sticky;
  top: 0;
  background: var(--pf-bg-elevated);
  z-index: 1;
}
.task-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--pf-border);
  vertical-align: middle;
  color: var(--pf-text);
}
.file-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}
.thumb {
  width: 40px;
  height: 30px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--pf-border);
}
.file-info {
  display: flex;
  flex-direction: column;
}
.fname {
  font-weight: 600;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fsize {
  font-size: 10px;
  color: var(--pf-text-secondary);
}
.prog-cell {
  width: 200px;
}
.prog-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.prog-text {
  font-size: 10px;
  color: var(--pf-text-secondary);
}
.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.status-badge.processing {
  background: rgba(0, 122, 255, 0.1);
  color: var(--pf-primary);
}
.status-badge.completed {
  background: rgba(40, 167, 69, 0.1);
  color: var(--pf-success);
}
.status-badge.waiting {
  background: var(--pf-bg-elevated);
  color: var(--pf-text-secondary);
}
.fmt-badge {
  font-weight: 700;
  color: var(--pf-text-secondary);
}
.actions-cell {
  display: flex;
  gap: 8px;
}
.action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.7;
  transition: opacity 0.2s;
}
.action-btn:hover {
  opacity: 1;
}
.task-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg-elevated);
}
.speed-info {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 12px;
  font-weight: 600;
  color: var(--pf-text);
}
.speed-val {
  margin-left: auto;
}
</style>
