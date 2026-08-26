<script setup lang="ts">
import { NButton, NEmpty, NProgress } from 'naive-ui'

export interface TaskQueueJob {
  id: string
  assetId: number
  status: string
  progress: number
  error?: string
  outputPath?: string
}

defineProps<{
  title: string
  jobs: TaskQueueJob[]
  overallProgress: number
  batchId: string | null
  pollError: string | null
  nameById: Map<number, string>
  embedded?: boolean
  onRefresh: () => void
  onCancelAll: () => void
  onCancelJob: (id: string) => void
  onRetryJob: (id: string) => void
}>()

const statusLabel: Record<string, string> = {
  queued: '等待中',
  running: '处理中',
  done: '已完成',
  error: '失败',
  cancelled: '已取消',
}
</script>

<template>
  <div class="pf-panel-shell pf-panel-shell--queue">
    <div class="head">
      <div v-if="!embedded" class="title">{{ title }} ({{ jobs.length }})</div>
      <div class="actions" :class="{ 'actions-only': embedded }">
        <NButton size="tiny" secondary :disabled="!batchId" @click="onRefresh()">刷新</NButton>
        <NButton
          size="tiny"
          tertiary
          :disabled="!jobs.some((j) => j.status === 'queued' || j.status === 'running')"
          @click="onCancelAll()"
        >
          取消待处理
        </NButton>
      </div>
    </div>

    <div v-if="pollError" class="poll-err">{{ pollError }}</div>

    <NEmpty v-if="!jobs.length" size="small" description="暂无任务" class="empty" />

    <div v-else class="wrap">
      <table class="table">
        <thead>
          <tr>
            <th>图片</th>
            <th>进度</th>
            <slot name="extra-head" />
            <th>状态</th>
            <th>输出</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="j in jobs" :key="j.id">
            <td class="name" :title="nameById.get(j.assetId) || j.id">{{ nameById.get(j.assetId) || j.id }}</td>
            <td class="prog">
              <NProgress
                type="line"
                :percentage="j.progress"
                :show-indicator="false"
                :height="4"
                color="var(--pf-primary)"
                :rail-color="'#333'"
              />
            </td>
            <slot name="extra-row" :job="j" />
            <td>
              <span class="status" :class="j.status">{{ statusLabel[j.status] || j.status }}</span>
              <span v-if="j.error" class="err" :title="j.error">!</span>
            </td>
            <td class="out" :title="j.outputPath">{{ j.outputPath }}</td>
            <td class="ops">
              <NButton
                v-if="j.status === 'queued' || j.status === 'running'"
                size="tiny"
                tertiary
                @click="onCancelJob(j.id)"
              >
                取消
              </NButton>
              <NButton v-if="j.status === 'error' || j.status === 'cancelled'" size="tiny" secondary @click="onRetryJob(j.id)">
                重试
              </NButton>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="foot">
        <div class="sum">
          总进度
          <NProgress
            type="line"
            :percentage="overallProgress"
            :show-indicator="true"
            :height="8"
            color="var(--pf-primary)"
            :rail-color="'#333'"
            style="width: 220px"
          />
        </div>
        <slot name="footer-extra" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.poll-err {
  margin: 0 12px 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(211, 47, 47, 0.1);
  color: var(--pf-danger);
  font-size: 12px;
  font-weight: 700;
}
.ops {
  white-space: nowrap;
}
.ops :deep(.n-button + .n-button) {
  margin-left: 6px;
}
.actions-only {
  width: 100%;
  justify-content: flex-end;
}
</style>
