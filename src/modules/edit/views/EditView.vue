<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NTabs, NTabPane } from 'naive-ui'
import ModuleAssetBrowser from '@/components/module/ModuleAssetBrowser.vue'
import { useNarrowWorkspace } from '@/composables/use-narrow-workspace'
import { useLibraryStore } from '@/stores/library'
import { useEditStore } from '../stores/edit'
import EditPreviewPanel from '../components/EditPreviewPanel.vue'

const library = useLibraryStore()
const edit = useEditStore()
const { narrow } = useNarrowWorkspace()
const workspaceTab = ref<'assets' | 'preview'>('assets')

const activeAssetId = computed(() => edit.activeAsset?.id ?? null)

const EMPTY_SELECTION = new Set<number>()

onMounted(() => {
  if (!library.assets.length) {
    void library.refresh()
  }
})
</script>

<template>
  <div class="pf-page pf-module-workspace" :class="{ 'pf-module-workspace--narrow': narrow }">
    <div v-if="!narrow" class="pf-page__top pf-module-workspace__split">
      <div class="pf-module-workspace__aside">
        <ModuleAssetBrowser
          title="编辑素材"
          :items="library.assets"
          :selected-ids="EMPTY_SELECTION"
          :active-id="activeAssetId"
          :loading="library.loading"
          selection-mode="single"
          :show-import-folder="false"
          :show-drop="false"
          :show-footer="false"
          default-view="list"
          empty-hint="暂无图片，请先在「全部图片」导入"
          @refresh="library.refresh()"
          @set-active="edit.setActive($event)"
        />
      </div>
      <div class="pf-module-workspace__main">
        <EditPreviewPanel />
      </div>
    </div>

    <div v-else class="pf-page__top pf-module-workspace__stacked">
      <NTabs v-model:value="workspaceTab" type="line" size="small" class="workspace-tabs">
        <NTabPane name="assets" tab="图片列表">
          <ModuleAssetBrowser
            title="编辑素材"
            :items="library.assets"
            :selected-ids="EMPTY_SELECTION"
            :active-id="activeAssetId"
            :loading="library.loading"
            selection-mode="single"
            :show-import-folder="false"
            :show-drop="false"
            :show-footer="false"
            default-view="list"
            empty-hint="暂无图片，请先在「全部图片」导入"
            @refresh="library.refresh()"
            @set-active="edit.setActive($event)"
          />
        </NTabPane>
        <NTabPane name="preview" tab="实时预览">
          <EditPreviewPanel />
        </NTabPane>
      </NTabs>
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
