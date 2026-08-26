<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useCompressStore } from '../stores/compress'
import { useSystemMetricsStore } from '@/stores/system-metrics'
import { useFeedback } from '@/composables/use-feedback'
import ModuleTaskQueue from '@/components/module/ModuleTaskQueue.vue'
import type { CompressJob } from '../types'

defineProps<{ embedded?: boolean }>()

const compress = useCompressStore()
const sys = useSystemMetricsStore()
const feedback = useFeedback()

onMounted(() => sys.start())
onUnmounted(() => sys.stop())

const memPercent = computed(() => {
  if (!sys.memTotalBytes) return 0
  return Math.round((sys.memUsedBytes / sys.memTotalBytes) * 100)
})

const nameById = computed(() => {
  const m = new Map<number, string>()
  for (const a of compress.items) m.set(a.id, a.filename)
  return m
})

function asCompressJob(job: unknown): CompressJob {
  return job as CompressJob
}

async function handleCancel(jobId: string) {
  try {
    await compress.cancelJob(jobId)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '取消失败')
  }
}

async function handleRetry(jobId: string) {
  try {
    await compress.retryJob(jobId)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '重试失败')
  }
}
</script>

<template>
  <ModuleTaskQueue
    title="压缩任务"
    :jobs="compress.jobs"
    :overall-progress="compress.overallProgress"
    :batch-id="compress.batchId"
    :poll-error="compress.pollError"
    :name-by-id="nameById"
    :embedded="embedded"
    :on-refresh="() => compress.refreshJobs()"
    :on-cancel-all="() => compress.cancelJob()"
    :on-cancel-job="handleCancel"
    :on-retry-job="handleRetry"
  >
    <template #extra-head>
      <th>压缩前/后</th>
      <th>格式</th>
    </template>
    <template #extra-row="{ job }">
      <td class="ba">
        <span>{{ (asCompressJob(job).beforeBytes / 1024).toFixed(1) }}KB</span>
        <span class="arrow">→</span>
        <span>{{ asCompressJob(job).afterBytes ? (asCompressJob(job).afterBytes / 1024).toFixed(1) : '-' }}KB</span>
      </td>
      <td class="fmt">{{ (asCompressJob(job).format || '-').toUpperCase?.() || '-' }}</td>
    </template>
    <template #footer-extra>
      <div class="sys">
        <span>CPU: {{ sys.cpuPercent }}%</span>
        <span>内存: {{ memPercent }}%</span>
      </div>
    </template>
  </ModuleTaskQueue>
</template>

<style scoped>
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
.sys {
  display: flex;
  gap: var(--pf-gap-sm);
  font-size: 11px;
  color: var(--pf-text-secondary);
  font-weight: 700;
}
</style>
