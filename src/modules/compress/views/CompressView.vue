<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NTabs, NTabPane } from 'naive-ui'
import ModuleAssetBrowser from '@/components/module/ModuleAssetBrowser.vue'
import ModuleTaskQueueShell from '@/components/module/ModuleTaskQueueShell.vue'
import { useNarrowWorkspace } from '@/composables/use-narrow-workspace'
import CompressComparePanel from '../components/CompressComparePanel.vue'
import CompressTaskQueue from '../components/CompressTaskQueue.vue'
import { useCompressStore } from '../stores/compress'

const compress = useCompressStore()
const { narrow } = useNarrowWorkspace()
const workspaceTab = ref<'assets' | 'compare'>('assets')

const queueActive = computed(() => compress.jobs.some((j) => j.status === 'queued' || j.status === 'running'))
const activeAssetId = computed(() => compress.activeItem?.id ?? null)

onMounted(() => {
  if (!compress.settings.outputDir) {
    void compress.loadDefaultOutputDir()
  }
})
</script>

<template>
  <div class="pf-page pf-page--with-footer pf-module-workspace" :class="{ 'pf-module-workspace--narrow': narrow }">
    <div v-if="!narrow" class="pf-page__top pf-module-workspace__split">
      <div class="pf-module-workspace__aside">
        <ModuleAssetBrowser
          title="压缩素材"
          :items="compress.items"
          :selected-ids="compress.selectedIds"
          :active-id="activeAssetId"
          :loading="compress.loading"
          default-view="list"
          @import-folder="compress.importFolder()"
          @import-dropped="compress.importDroppedFiles($event)"
          @toggle="compress.toggleSelect($event)"
          @set-active="compress.setActive($event)"
          @clear-selection="compress.clearSelection()"
          @remove-selected="compress.removeSelected()"
        />
      </div>
      <div class="pf-module-workspace__main">
        <CompressComparePanel />
      </div>
    </div>

    <div v-else class="pf-page__top pf-module-workspace__stacked">
      <NTabs v-model:value="workspaceTab" type="line" size="small" class="workspace-tabs">
        <NTabPane name="assets" tab="素材列表">
          <ModuleAssetBrowser
            title="压缩素材"
            :items="compress.items"
            :selected-ids="compress.selectedIds"
            :active-id="activeAssetId"
            :loading="compress.loading"
            default-view="list"
            @import-folder="compress.importFolder()"
            @import-dropped="compress.importDroppedFiles($event)"
            @toggle="compress.toggleSelect($event)"
            @set-active="compress.setActive($event)"
            @clear-selection="compress.clearSelection()"
            @remove-selected="compress.removeSelected()"
          />
        </NTabPane>
        <NTabPane name="compare" tab="前后对比">
          <CompressComparePanel />
        </NTabPane>
      </NTabs>
    </div>

    <div class="pf-page__bottom">
      <ModuleTaskQueueShell title="压缩任务" :job-count="compress.jobs.length" :active="queueActive">
        <CompressTaskQueue embedded />
      </ModuleTaskQueueShell>
    </div>
  </div>
</template>

<style scoped>
.workspace-tabs {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.workspace-tabs :deep(.n-tabs-nav) {
  flex-shrink: 0;
  padding: 0 8px;
}
.workspace-tabs :deep(.n-tab-pane) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
