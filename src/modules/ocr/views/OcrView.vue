<script setup lang="ts">
import { useNarrowWorkspace } from '@/composables/use-narrow-workspace'
import OcrAssetList from '../components/OcrAssetList.vue'
import OcrResultPanel from '../components/OcrResultPanel.vue'

const { narrow } = useNarrowWorkspace()
</script>

<template>
  <div class="pf-page pf-module-workspace" :class="{ 'pf-module-workspace--narrow': narrow }">
    <div class="pf-page__top pf-module-workspace__split">
      <div class="pf-module-workspace__aside">
        <OcrAssetList />
      </div>
      <div class="pf-module-workspace__main">
        <OcrResultPanel />
      </div>
    </div>
  </div>
</template>
