<script setup lang="ts">
import { useNarrowWorkspace } from '@/composables/use-narrow-workspace'
import AiAssetList from '../components/AiAssetList.vue'
import AiPreviewPanel from '../components/AiPreviewPanel.vue'

const { narrow } = useNarrowWorkspace()
</script>

<template>
  <div class="pf-page pf-module-workspace" :class="{ 'pf-module-workspace--narrow': narrow }">
    <div class="pf-page__top pf-module-workspace__split">
      <div class="pf-module-workspace__aside">
        <AiAssetList />
      </div>
      <div class="pf-module-workspace__main">
        <AiPreviewPanel />
      </div>
    </div>
  </div>
</template>
