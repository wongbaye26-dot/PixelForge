<script setup lang="ts">
import { useAiStore } from '../stores/ai'
import ModuleAssetList from '@/components/module/ModuleAssetList.vue'

const ai = useAiStore()

function init() {
  void ai.refreshStatus()
}
</script>

<template>
  <ModuleAssetList
    :active-id="ai.activeAsset?.id ?? null"
    search-placeholder="搜索…"
    :on-init="init"
    @select="ai.setActive($event)"
  >
    <template #row-extra="{ asset }">
      <span class="meta">{{ asset.width }}×{{ asset.height }}</span>
    </template>
  </ModuleAssetList>
</template>

<style scoped>
.meta {
  font-size: 11px;
  opacity: 0.8;
}
</style>
