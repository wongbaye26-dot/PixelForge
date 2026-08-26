<script setup lang="ts">
import { computed } from 'vue'
import { useBatchStore } from '../stores/batch'
import { useFeedback } from '@/composables/use-feedback'
import ModuleTaskQueue from '@/components/module/ModuleTaskQueue.vue'

defineProps<{ embedded?: boolean }>()

const batch = useBatchStore()
const feedback = useFeedback()

const nameById = computed(() => {
  const m = new Map<number, string>()
  for (const a of batch.items) m.set(a.id, a.filename)
  return m
})

async function handleCancel(jobId: string) {
  try {
    await batch.cancelJob(jobId)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '取消失败')
  }
}

async function handleRetry(jobId: string) {
  try {
    await batch.retryJob(jobId)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '重试失败')
  }
}
</script>

<template>
  <ModuleTaskQueue
    title="导出任务队列"
    :jobs="batch.jobs"
    :overall-progress="batch.overallProgress"
    :batch-id="batch.batchId"
    :poll-error="batch.pollError"
    :name-by-id="nameById"
    :embedded="embedded"
    :on-refresh="() => batch.refreshJobs()"
    :on-cancel-all="() => batch.cancelJob()"
    :on-cancel-job="handleCancel"
    :on-retry-job="handleRetry"
  />
</template>
