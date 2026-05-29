<script setup lang="ts">
import EditAssetList from '../components/EditAssetList.vue'
import EditPreviewPanel from '../components/EditPreviewPanel.vue'
</script>

<template>
  <div class="page">
    <div class="top">
      <div class="left">
        <EditAssetList />
      </div>
      <div class="center">
        <EditPreviewPanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-rows: 1fr;
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
@media (max-width: 920px) {
  .top {
    grid-template-columns: 1fr;
    grid-template-rows: 340px 1fr;
  }
}
</style>

