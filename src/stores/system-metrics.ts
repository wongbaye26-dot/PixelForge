import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import { clamp } from '@/core/math'

export const useSystemMetricsStore = defineStore('systemMetrics', () => {
  const cpuPercent = ref<number>(0)
  const memUsedBytes = ref<number>(0)
  const memTotalBytes = ref<number>(0)
  const diskUsedBytes = ref<number>(0)
  const diskTotalBytes = ref<number>(0)

  const subscribers = ref(0)
  let fastTimer: number | undefined
  let diskTimer: number | undefined

  const diskPercent = computed(() => {
    if (!diskTotalBytes.value) return 0
    return clamp((diskUsedBytes.value / diskTotalBytes.value) * 100, 0, 100)
  })

  async function refreshFast() {
    try {
      const r = await api.systemMetrics()
      cpuPercent.value = clamp(r.cpuPercent, 0, 100)
      memUsedBytes.value = Math.max(0, r.memUsedBytes)
      memTotalBytes.value = Math.max(0, r.memTotalBytes)
    } catch {
    }
  }

  async function refreshDisk() {
    try {
      const r = await api.systemDisk()
      diskUsedBytes.value = Math.max(0, r.usedBytes)
      diskTotalBytes.value = Math.max(0, r.totalBytes)
    } catch {
    }
  }

  function start() {
    subscribers.value += 1
    if (subscribers.value !== 1) return
    void refreshFast()
    void refreshDisk()
    fastTimer = window.setInterval(() => void refreshFast(), 2000)
    diskTimer = window.setInterval(() => void refreshDisk(), 60000)
  }

  function stop() {
    subscribers.value = Math.max(0, subscribers.value - 1)
    if (subscribers.value !== 0) return
    if (fastTimer) window.clearInterval(fastTimer)
    if (diskTimer) window.clearInterval(diskTimer)
    fastTimer = undefined
    diskTimer = undefined
  }

  return {
    cpuPercent,
    memUsedBytes,
    memTotalBytes,
    diskUsedBytes,
    diskTotalBytes,
    diskPercent,
    subscribers,
    start,
    stop,
  }
})
