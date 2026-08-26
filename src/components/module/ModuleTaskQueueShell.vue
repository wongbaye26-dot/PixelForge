<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    jobCount?: number
    active?: boolean
    defaultCollapsed?: boolean
  }>(),
  {
    title: '任务队列',
    jobCount: 0,
    active: false,
    defaultCollapsed: true,
  },
)

const collapsed = ref(props.defaultCollapsed && props.jobCount === 0)

const summary = computed(() => `${props.title} (${props.jobCount})`)

watch(
  () => [props.jobCount, props.active] as const,
  ([count, active]) => {
    if (active || count > 0) collapsed.value = false
  },
)

function toggle() {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <div class="queue-shell" :class="{ collapsed }">
    <button type="button" class="queue-toggle" @click="toggle">
      <span class="queue-title">{{ summary }}</span>
      <span class="queue-chevron">{{ collapsed ? '▾' : '▴' }}</span>
    </button>
    <div v-show="!collapsed" class="queue-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.queue-shell {
  min-height: 0;
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 88%, transparent);
  border-radius: var(--pf-radius-lg);
  background: var(--pf-bg);
  overflow: hidden;
}
.queue-shell.collapsed {
  flex: 0 0 auto;
}
.queue-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: var(--pf-bg-soft);
  color: var(--pf-text-secondary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.queue-title {
  color: var(--pf-text);
}
.queue-chevron {
  font-size: 10px;
  opacity: 0.8;
}
.queue-body {
  min-height: 0;
  max-height: min(280px, 38vh);
  overflow: hidden;
}
.queue-body :deep(.pf-panel-shell--queue) {
  border: none;
  border-radius: 0;
  box-shadow: none;
  min-height: 0;
  max-height: min(280px, 38vh);
}
</style>
