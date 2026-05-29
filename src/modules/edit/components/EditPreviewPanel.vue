<script setup lang="ts">
import { NEmpty, NSpin, NButton } from 'naive-ui'
import { useEditStore } from '../stores/edit'

const edit = useEditStore()
</script>

<template>
  <div class="panel">
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
      <div class="grid">
        <div class="box">
          <div class="box-head">Before</div>
          <div class="img-wrap">
            <img v-if="edit.beforeSrc" :src="edit.beforeSrc" class="img" />
          </div>
        </div>
        <div class="box">
          <div class="box-head">After</div>
          <div class="img-wrap">
            <NSpin v-if="edit.generating" size="small" />
            <img v-else-if="edit.afterSrc" :src="edit.afterSrc" class="img" />
            <div v-else class="ph">等待生成…</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  height: 100%;
  background: var(--pf-bg-elevated);
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
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
  background: #0f0f10;
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
@media (max-width: 980px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>

