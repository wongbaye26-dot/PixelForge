import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type TaskStatus = 'waiting' | 'processing' | 'completed' | 'failed'

export interface ExportTaskRow {
  id: string
  assetId: number
  filename: string
  thumbnailUrl?: string
  targetSize: string
  format: string
  progress: number
  status: TaskStatus
  outputPath?: string
}

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<ExportTaskRow[]>([])
  const paused = ref(false)

  const overallProgress = computed(() => {
    if (tasks.value.length === 0) return 0
    const sum = tasks.value.reduce((a, t) => a + t.progress, 0)
    return Math.round(sum / tasks.value.length)
  })

  const completedCount = computed(
    () => tasks.value.filter((t) => t.status === 'completed').length,
  )

  function clearTasks() {
    tasks.value = []
  }

  function setTasks(rows: ExportTaskRow[]) {
    tasks.value = rows
  }

  function updateTask(id: string, patch: Partial<ExportTaskRow>) {
    const row = tasks.value.find((t) => t.id === id)
    if (row) Object.assign(row, patch)
  }

  return {
    tasks,
    paused,
    overallProgress,
    completedCount,
    clearTasks,
    setTasks,
    updateTask,
  }
})
