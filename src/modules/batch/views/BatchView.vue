<script setup lang="ts">
import BatchImportPanel from '../components/BatchImportPanel.vue'
import BatchWaterfall from '../components/BatchWaterfall.vue'
import BatchTaskQueue from '../components/BatchTaskQueue.vue'
import { useBatchInit } from '../composables/use-batch-init'

useBatchInit()
</script>

<template>
  <div class="page">
    <div class="top">
      <div class="left">
        <BatchImportPanel />
      </div>
      <div class="center">
        <BatchWaterfall />
      </div>
    </div>
    <div class="bottom">
      <BatchTaskQueue />
    </div>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 12px;
  padding: 12px;
  height: 100%;
  min-height: 0;
  background: var(--pf-bg);
}
.top {
  min-height: 0;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 12px;
}
.left,
.center {
  min-height: 0;
}
.bottom {
  min-height: 0;
}
@media (max-width: 1100px) {
  .top {
    grid-template-columns: 260px 1fr;
  }
}
@media (max-width: 920px) {
  .top {
    grid-template-columns: 1fr;
    grid-template-rows: 320px 1fr;
  }
}
</style>
