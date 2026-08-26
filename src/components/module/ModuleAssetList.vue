<script setup lang="ts">
import { NButton, NInput, NEmpty } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useLibraryStore } from '@/stores/library'
import type { ImageAsset } from '@/types'

const props = withDefaults(
  defineProps<{
    activeId: number | null
    searchPlaceholder?: string
    onSearchFilter?: (asset: ImageAsset, term: string) => boolean
    onInit?: () => void
  }>(),
  {
    searchPlaceholder: '搜索…',
    onSearchFilter: undefined,
    onInit: undefined,
  },
)

const emit = defineEmits<{ select: [id: number] }>()

const library = useLibraryStore()
const q = ref('')

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return library.assets
  if (props.onSearchFilter) return library.assets.filter((a) => props.onSearchFilter!(a, term))
  return library.assets.filter((a) => a.filename.toLowerCase().includes(term))
})

onMounted(() => {
  if (!library.assets.length) void library.refresh()
  props.onInit?.()
})
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <div class="title">图片列表</div>
      <NButton size="small" secondary :loading="library.loading" @click="library.refresh()">刷新</NButton>
    </div>
    <div class="search">
      <NInput v-model:value="q" size="small" :placeholder="searchPlaceholder" clearable />
    </div>
    <div v-if="!filtered.length" class="empty-wrap">
      <NEmpty size="small" description="暂无图片" />
    </div>
    <div v-else class="list">
      <button
        v-for="a in filtered"
        :key="a.id"
        type="button"
        class="row"
        :class="{ active: activeId === a.id }"
        @click="emit('select', a.id)"
      >
        <span class="name" :title="a.filename">{{ a.filename }}</span>
        <slot name="row-extra" :asset="a" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--pf-bg-elevated);
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.title {
  font-size: 13px;
  font-weight: 800;
}
.search {
  padding: 10px 12px;
  border-bottom: 1px solid var(--pf-border);
}
.empty-wrap {
  padding: 18px 0;
}
.list {
  flex: 1;
  overflow: auto;
  padding: 8px;
}
.row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--pf-text-secondary);
  cursor: pointer;
  text-align: left;
}
.row.active {
  background: rgba(0, 122, 255, 0.14);
  border-color: rgba(0, 122, 255, 0.3);
  color: var(--pf-text);
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  flex: 1;
}
</style>
