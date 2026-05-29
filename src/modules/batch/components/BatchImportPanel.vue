<script setup lang="ts">
import { NButton, NInput, NEmpty } from 'naive-ui'
import { computed, ref } from 'vue'
import { useBatchStore } from '../stores/batch'

const batch = useBatchStore()
const q = ref('')

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return batch.items
  return batch.items.filter((a) => a.filename.toLowerCase().includes(term))
})

function toggle(id: number) {
  batch.toggleSelect(id)
}
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <div class="title">导入</div>
      <div class="actions">
        <NButton size="small" secondary :loading="batch.loading" @click="batch.importFolder()">导入文件夹</NButton>
        <NButton size="small" secondary @click="batch.loadMock()">示例数据</NButton>
      </div>
    </div>

    <div class="search">
      <NInput v-model:value="q" size="small" placeholder="搜索已导入图片…" clearable />
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
        :class="{ active: batch.selectedIds.has(a.id) }"
        @click="toggle(a.id)"
      >
        <span class="check">{{ batch.selectedIds.has(a.id) ? '✓' : '' }}</span>
        <span class="name" :title="a.filename">{{ a.filename }}</span>
        <span class="meta">{{ a.width }}×{{ a.height }}</span>
      </button>
    </div>

    <div class="panel-foot">
      <div class="sel">已选 {{ batch.selectedIds.size }} 张</div>
      <div class="foot-actions">
        <NButton size="small" tertiary :disabled="!batch.selectedIds.size" @click="batch.clearSelection()">
          清空
        </NButton>
        <NButton size="small" secondary type="error" :disabled="!batch.selectedIds.size" @click="batch.removeSelected()">
          删除
        </NButton>
      </div>
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
  grid-template-columns: 18px 1fr auto;
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
.check {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--pf-border);
  background: var(--pf-bg);
  color: var(--pf-primary);
  font-size: 12px;
  font-weight: 900;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.meta {
  font-size: 11px;
  opacity: 0.8;
}
.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.sel {
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text);
}
.foot-actions {
  display: flex;
  gap: 8px;
}
</style>
