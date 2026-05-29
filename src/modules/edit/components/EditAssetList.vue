<script setup lang="ts">
import { NButton, NInput, NEmpty } from 'naive-ui'
import { computed, ref, onMounted } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useEditStore } from '../stores/edit'

const library = useLibraryStore()
const edit = useEditStore()
const q = ref('')

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return library.assets
  return library.assets.filter((a) => a.filename.toLowerCase().includes(term))
})

onMounted(() => {
  if (!library.assets.length) {
    void library.refresh()
  }
})
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <div class="title">图片列表</div>
      <div class="actions">
        <NButton size="small" secondary :loading="library.loading" @click="library.refresh()">刷新</NButton>
      </div>
    </div>

    <div class="search">
      <NInput v-model:value="q" size="small" placeholder="搜索…" clearable />
    </div>

    <div v-if="!filtered.length" class="empty-wrap">
      <NEmpty size="small" description="暂无图片，请先在「全部图片」导入" />
    </div>

    <div v-else class="list">
      <button
        v-for="a in filtered"
        :key="a.id"
        type="button"
        class="row"
        :class="{ active: edit.activeAsset?.id === a.id }"
        @click="edit.setActive(a.id)"
      >
        <span class="name" :title="a.filename">{{ a.filename }}</span>
        <span class="meta">{{ a.width }}×{{ a.height }}</span>
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
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.title {
  font-size: 13px;
  font-weight: 800;
  color: var(--pf-text);
}
.actions {
  display: flex;
  gap: 8px;
}
.search {
  padding: 10px 12px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
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
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--pf-text-secondary);
  cursor: pointer;
  text-align: left;
}
.row:hover {
  background: var(--pf-bg-hover);
  color: var(--pf-text);
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
}
.meta {
  font-size: 11px;
  opacity: 0.8;
  white-space: nowrap;
}
</style>

