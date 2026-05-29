<script setup lang="ts">
import CompressImportPanel from '../components/CompressImportPanel.vue'
import CompressComparePanel from '../components/CompressComparePanel.vue'
import CompressTaskQueue from '../components/CompressTaskQueue.vue'
import { onMounted } from 'vue'
import { useCompressStore } from '../stores/compress'

const compress = useCompressStore()

onMounted(() => {
  if (!compress.settings.outputDir) {
    void compress.loadDefaultOutputDir()
  }
})
</script>

<template>
  <div class="page">
    <div class="top">
      <div class="left">
        <CompressImportPanel />
      </div>
      <div class="center">
        <CompressComparePanel />
      </div>
    </div>
    <div class="bottom">
      <CompressTaskQueue />
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
  grid-template-columns: 320px 1fr;
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
    grid-template-columns: 280px 1fr;
  }
}
@media (max-width: 920px) {
  .top {
    grid-template-columns: 1fr;
    grid-template-rows: 320px 1fr;
  }
}
</style>
