<script setup lang="ts">
import { computed } from 'vue'
import ModuleAssetBrowser from '@/components/module/ModuleAssetBrowser.vue'
import ModuleTaskQueueShell from '@/components/module/ModuleTaskQueueShell.vue'
import BatchTaskQueue from '../components/BatchTaskQueue.vue'
import { useBatchInit } from '../composables/use-batch-init'
import { useBatchStore } from '../stores/batch'

const batch = useBatchStore()
useBatchInit()

const queueActive = computed(() => batch.jobs.some((j) => j.status === 'queued' || j.status === 'running'))
</script>

<template>
  <div class="pf-page pf-page--with-footer pf-module-workspace pf-module-workspace--single">
    <div class="pf-page__top">
      <ModuleAssetBrowser
        title="批处理素材"
        :items="batch.items"
        :selected-ids="batch.selectedIds"
        :loading="batch.loading"
        default-view="grid"
        @import-folder="batch.importFolder()"
        @import-dropped="batch.importDroppedFiles($event)"
        @toggle="batch.toggleSelect($event)"
        @clear-selection="batch.clearSelection()"
        @remove-selected="batch.removeSelected()"
      />
    </div>
    <div class="pf-page__bottom">
      <ModuleTaskQueueShell
        title="导出任务队列"
        :job-count="batch.jobs.length"
        :active="queueActive"
      >
        <BatchTaskQueue embedded />
      </ModuleTaskQueueShell>
    </div>
  </div>
</template>
