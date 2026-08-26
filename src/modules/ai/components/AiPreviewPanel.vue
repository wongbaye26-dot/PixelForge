<script setup lang="ts">
import { NSpin, NTag } from 'naive-ui'
import { useAiStore } from '../stores/ai'

const ai = useAiStore()
</script>

<template>
  <div class="panel">
    <div class="head">
      <div class="title">扩图预览</div>
      <NTag size="small" :type="ai.sidecarOnline ? 'success' : 'warning'" :bordered="false">
        {{ ai.sidecarOnline ? 'Sidecar 在线' : '本地模糊扩展' }}
      </NTag>
    </div>

    <div v-if="!ai.activeAsset" class="empty">请选择一张图片</div>
    <div v-else class="compare">
      <div class="col">
        <div class="label">原图</div>
        <div class="frame">
          <img v-if="ai.beforeSrc" :src="ai.beforeSrc" alt="before" />
        </div>
      </div>
      <div class="col">
        <div class="label">
          扩图结果
          <span v-if="ai.lastEngine" class="engine">({{ ai.lastEngine }})</span>
        </div>
        <div class="frame">
          <NSpin v-if="ai.generating" size="small" />
          <img v-else-if="ai.afterSrc" :src="ai.afterSrc" alt="after" />
          <div v-else class="placeholder">调整参数后自动生成预览</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--pf-bg-elevated);
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.title {
  font-size: 13px;
  font-weight: 900;
}
.empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--pf-text-secondary);
  font-weight: 600;
}
.compare {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
}
.col {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.label {
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text-secondary);
}
.engine {
  font-weight: 600;
  opacity: 0.8;
}
.frame {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--pf-border);
  border-radius: 10px;
  background: #111;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.frame img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.placeholder {
  color: var(--pf-text-secondary);
  font-size: 12px;
  padding: 12px;
  text-align: center;
}
@media (max-width: 920px) {
  .compare {
    grid-template-columns: 1fr;
  }
}
</style>
