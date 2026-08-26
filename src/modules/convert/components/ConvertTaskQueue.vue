<script setup lang="ts">
import { computed } from 'vue'
import { useConvertStore } from '../stores/convert'
import { useFeedback } from '@/composables/use-feedback'
import ModuleTaskQueue from '@/components/module/ModuleTaskQueue.vue'

defineProps<{ embedded?: boolean }>()

const convert = useConvertStore()
const feedback = useFeedback()

const nameById = computed(() => {
  const m = new Map<number, string>()
  for (const a of convert.items) m.set(a.id, a.filename)
  return m
})

async function handleCancel(jobId: string) {
  try {
    await convert.cancelJob(jobId)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '取消失败')
  }
}

async function handleRetry(jobId: string) {
  try {
    await convert.retryJob(jobId)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '重试失败')
  }
}
</script>

<template>
  <ModuleTaskQueue
    title="导出任务"
    :jobs="convert.jobs"
    :overall-progress="convert.overallProgress"
    :batch-id="convert.batchId"
    :poll-error="convert.pollError"
    :name-by-id="nameById"
    :embedded="embedded"
    :on-refresh="() => convert.refreshJobs()"
    :on-cancel-all="() => convert.cancelJob()"
    :on-cancel-job="handleCancel"
    :on-retry-job="handleRetry"
  />
</template>
