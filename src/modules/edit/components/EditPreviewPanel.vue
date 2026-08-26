<script setup lang="ts">
import { NEmpty, NSpin, NButton, NTabPane, NTabs } from 'naive-ui'
import { ref } from 'vue'
import { useNarrowWorkspace } from '@/composables/use-narrow-workspace'
import { useEditStore } from '../stores/edit'

const edit = useEditStore()
const { narrow } = useNarrowWorkspace()
const compareTab = ref<'before' | 'after'>('before')
</script>

<template>
  <div class="pf-panel-shell">
    <div class="head">
      <div class="title">实时预览</div>
      <div class="actions">
        <NButton size="tiny" secondary :disabled="!edit.activeAsset" :loading="edit.generating" @click="edit.generatePreview()">
          刷新
        </NButton>
      </div>
    </div>

    <div v-if="!edit.activeAsset" class="empty">
      <NEmpty description="请选择一张图片" />
    </div>

    <div v-else class="body">
      <div v-if="narrow" class="compare-tabs">
        <NTabs v-model:value="compareTab" type="segment" size="small">
          <NTabPane name="before" tab="原图" />
          <NTabPane name="after" tab="处理后" />
        </NTabs>
      </div>
      <div class="grid" :class="{ stacked: narrow }">
        <div v-show="!narrow || compareTab === 'before'" class="box">
          <div class="box-head">原图</div>
          <div class="img-wrap pf-compare-canvas">
            <img v-if="edit.beforeSrc" :src="edit.beforeSrc" class="img" alt="" />
          </div>
        </div>
        <div v-show="!narrow || compareTab === 'after'" class="box">
          <div class="box-head">处理后</div>
          <div class="img-wrap pf-compare-canvas">
            <NSpin v-if="edit.generating" size="small" />
            <img v-else-if="edit.afterSrc" :src="edit.afterSrc" class="img" alt="" />
            <div v-else class="ph">等待生成…</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head {
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 13px;
  font-weight: 900;
  color: var(--pf-text);
}
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
}
.grid.stacked {
  grid-template-columns: 1fr;
  padding-top: 8px;
}
.compare-tabs {
  padding: 8px 12px 0;
  flex-shrink: 0;
}
.box {
  background: var(--pf-bg);
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.box-head {
  padding: 10px 12px;
  border-bottom: 1px solid var(--pf-border);
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text-secondary);
}
.img-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.ph {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 700;
}
</style>

