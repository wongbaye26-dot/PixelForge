<script setup lang="ts">
import { onMounted } from 'vue'
import { useConvertStore } from '../stores/convert'
import ConvertImportPanel from '../components/ConvertImportPanel.vue'
import ConvertGrid from '../components/ConvertGrid.vue'
import ConvertTaskQueue from '../components/ConvertTaskQueue.vue'

const convert = useConvertStore()

onMounted(() => {
  if (!convert.settings.outputDir) {
    void convert.loadDefaultOutputDir()
  }
})
</script>

<template>
  <div class="page">
    <div class="top">
      <div class="left">
        <ConvertImportPanel />
      </div>
      <div class="center">
        <ConvertGrid />
      </div>
    </div>
    <div class="bottom">
      <ConvertTaskQueue />
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
    grid-template-rows: 340px 1fr;
  }
}
</style>
