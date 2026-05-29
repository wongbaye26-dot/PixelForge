<script setup lang="ts">
import SidebarNav from './SidebarNav.vue'
import ImageGallery from '@/components/library/ImageGallery.vue'
import ExportPanel from '@/components/export/ExportPanel.vue'
import StatusBar from './StatusBar.vue'
import { useUiStore } from '@/stores/ui'
import BatchView from '@/modules/batch/views/BatchView.vue'
import BatchSettingsPanel from '@/modules/batch/components/BatchSettingsPanel.vue'
import CompressView from '@/modules/compress/views/CompressView.vue'
import CompressSettingsPanel from '@/modules/compress/components/CompressSettingsPanel.vue'
import ConvertView from '@/modules/convert/views/ConvertView.vue'
import ConvertSettingsPanel from '@/modules/convert/components/ConvertSettingsPanel.vue'
import EditView from '@/modules/edit/views/EditView.vue'
import EditSettingsPanel from '@/modules/edit/components/EditSettingsPanel.vue'

const ui = useUiStore()
</script>

<template>
  <div class="app-shell">
    <SidebarNav />
    <main class="main">
      <BatchView v-if="ui.libraryView === 'batch'" />
      <CompressView v-else-if="ui.libraryView === 'compress'" />
      <ConvertView v-else-if="ui.libraryView === 'convert'" />
      <EditView v-else-if="ui.libraryView === 'edit'" />
      <ImageGallery v-else />
    </main>
    <aside class="right-panel">
      <BatchSettingsPanel v-if="ui.libraryView === 'batch'" />
      <CompressSettingsPanel v-else-if="ui.libraryView === 'compress'" />
      <ConvertSettingsPanel v-else-if="ui.libraryView === 'convert'" />
      <EditSettingsPanel v-else-if="ui.libraryView === 'edit'" />
      <ExportPanel v-else />
    </aside>
    <StatusBar />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: var(--pf-sidebar-width) 1fr var(--pf-right-width);
  grid-template-rows: 1fr var(--pf-status-height);
  height: 100vh;
  min-height: 0;
  max-height: 100vh;
  overflow: hidden;
  background: var(--pf-bg);
}
.main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--pf-bg);
}
.right-panel {
  min-height: 0;
  overflow: hidden;
  background: var(--pf-bg-elevated);
}
</style>
