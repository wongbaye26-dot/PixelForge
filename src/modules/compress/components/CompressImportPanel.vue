<script setup lang="ts">
import { NButton, NInput, NEmpty } from 'naive-ui'
import { computed, ref } from 'vue'
import { useCompressStore } from '../stores/compress'

const compress = useCompressStore()
const q = ref('')

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return compress.items
  return compress.items.filter((a) => a.filename.toLowerCase().includes(term))
})

async function onDrop(ev: DragEvent) {
  const files = Array.from(ev.dataTransfer?.files ?? [])
  const paths = files
    .map((f) => (f as File & { path?: string }).path)
    .filter((p): p is string => Boolean(p && p.trim()))
  if (!paths.length) return
  await compress.importDroppedFiles(paths)
}
</script>

<template>
  <div class="pf-panel-shell">
    <div class="panel-head">
      <div class="title">图片列表</div>
      <div class="actions">
        <NButton size="small" secondary :loading="compress.loading" @click="compress.importFolder()">导入文件夹</NButton>
      </div>
    </div>

    <div class="drop" @dragover.prevent @drop.prevent="onDrop">
      <div class="drop-title">拖拽图片到这里导入</div>
      <div class="drop-sub">支持多选拖拽</div>
    </div>

    <div class="search">
      <NInput v-model:value="q" size="small" placeholder="搜索…" clearable />
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
        :class="{ active: compress.selectedIds.has(a.id) }"
        @click="compress.toggleSelect(a.id)"
        @dblclick="compress.setActive(a.id)"
      >
        <span class="check">{{ compress.selectedIds.has(a.id) ? '✓' : '' }}</span>
        <span class="name" :title="a.filename">{{ a.filename }}</span>
        <span class="meta">{{ a.width }}×{{ a.height }}</span>
      </button>
    </div>

    <div class="panel-foot">
      <div class="sel">已选 {{ compress.selectedIds.size }} 张</div>
      <div class="foot-actions">
        <NButton size="small" tertiary :disabled="!compress.selectedIds.size" @click="compress.clearSelection()">
          清空
        </NButton>
        <NButton size="small" secondary type="error" :disabled="!compress.selectedIds.size" @click="compress.removeSelected()">
          移出列表
        </NButton>
      </div>
    </div>
  </div>
</template>
