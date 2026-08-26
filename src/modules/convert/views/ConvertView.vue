<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ModuleAssetBrowser from '@/components/module/ModuleAssetBrowser.vue'
import ModuleTaskQueueShell from '@/components/module/ModuleTaskQueueShell.vue'
import ConvertTaskQueue from '../components/ConvertTaskQueue.vue'
import { useConvertStore } from '../stores/convert'

const convert = useConvertStore()

const queueActive = computed(() => convert.jobs.some((j) => j.status === 'queued' || j.status === 'running'))

onMounted(() => {
  if (!convert.settings.outputDir) {
    void convert.loadDefaultOutputDir()
  }
})
</script>

<template>
  <div class="pf-page pf-page--with-footer pf-module-workspace pf-module-workspace--single">
    <div class="pf-page__top">
      <ModuleAssetBrowser
        title="转换素材"
        :items="convert.items"
        :selected-ids="convert.selectedIds"
        :loading="convert.loading"
        default-view="grid"
        @import-folder="convert.importFolder()"
        @import-dropped="convert.importDroppedFiles($event)"
        @toggle="convert.toggleSelect($event)"
        @clear-selection="convert.clearSelection()"
        @remove-selected="convert.removeSelected()"
      />
    </div>
    <div class="pf-page__bottom">
      <ModuleTaskQueueShell title="导出任务" :job-count="convert.jobs.length" :active="queueActive">
        <ConvertTaskQueue embedded />
      </ModuleTaskQueueShell>
    </div>
  </div>
</template>
