<script setup lang="ts">
import { NButton, NEmpty, NProgress } from 'naive-ui'
import { computed } from 'vue'
import { useCompressStore } from '../stores/compress'

const compress = useCompressStore()

const nameById = computed(() => {
  const m = new Map<number, string>()
  for (const a of compress.items) m.set(a.id, a.filename)
  return m
})

const statusLabel: Record<string, string> = {
  queued: '等待中',
  running: '处理中',
  done: '已完成',
  error: '失败',
}
</script>

<template>
  <div class="panel">
    <div class="head">
      <div class="title">任务队列 ({{ compress.jobs.length }})</div>
      <div class="actions">
        <NButton size="tiny" secondary :disabled="!compress.batchId" @click="compress.refreshJobs()">刷新</NButton>
        <NButton size="tiny" secondary :disabled="!compress.polling" @click="compress.stopPolling()">停止轮询</NButton>
      </div>
    </div>

    <NEmpty v-if="!compress.jobs.length" size="small" description="暂无任务" class="empty" />

    <div v-else class="wrap">
      <table class="table">
        <thead>
          <tr>
            <th>图片</th>
            <th>进度</th>
            <th>Before/After</th>
            <th>格式</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="j in compress.jobs" :key="j.id">
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
            <td class="ba">
              <span>{{ (j.beforeBytes / 1024).toFixed(1) }}KB</span>
              <span class="arrow">→</span>
              <span>{{ j.afterBytes ? (j.afterBytes / 1024).toFixed(1) : '-' }}KB</span>
            </td>
            <td class="fmt">{{ (j.format || '-').toUpperCase?.() || '-' }}</td>
            <td>
              <span class="status" :class="j.status">{{ statusLabel[j.status] || j.status }}</span>
              <span v-if="j.error" class="err" :title="j.error">!</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="foot">
        <div class="sum">
          总进度
          <NProgress
            type="line"
            :percentage="compress.overallProgress"
            :show-indicator="true"
            :height="8"
            color="var(--pf-primary)"
            :rail-color="'#333'"
            style="width: 220px"
          />
        </div>
        <div class="sys">
          <span>CPU: 32%</span>
          <span>内存: 48%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  background: var(--pf-bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 220px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg-elevated);
}
.title {
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text);
}
.actions {
  display: flex;
  gap: 8px;
}
.empty {
  padding: 24px 0;
}
.wrap {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.table th,
.table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--pf-border);
  color: var(--pf-text);
  vertical-align: middle;
}
.table th {
  color: var(--pf-text-secondary);
  font-weight: 700;
  background: var(--pf-bg-elevated);
  position: sticky;
  top: 0;
}
.name {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}
.prog {
  width: 160px;
}
.ba {
  color: var(--pf-text-secondary);
  font-weight: 700;
  white-space: nowrap;
}
.arrow {
  margin: 0 6px;
  opacity: 0.8;
}
.fmt {
  font-weight: 800;
  color: var(--pf-text-secondary);
}
.status {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  background: var(--pf-bg-elevated);
  color: var(--pf-text-secondary);
}
.status.running {
  background: rgba(0, 122, 255, 0.12);
  color: var(--pf-primary);
}
.status.done {
  background: rgba(40, 167, 69, 0.12);
  color: var(--pf-success);
}
.status.error {
  background: rgba(255, 69, 58, 0.12);
  color: var(--pf-danger);
}
.err {
  margin-left: 6px;
  font-weight: 900;
  color: var(--pf-danger);
}
.foot {
  padding: 10px 12px;
  background: var(--pf-bg-elevated);
  border-top: 1px solid var(--pf-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.sum {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text);
}
.sys {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--pf-text-secondary);
  font-weight: 700;
}
</style>
