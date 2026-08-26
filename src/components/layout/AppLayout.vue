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
import TemplatePanel from '@/components/templates/TemplatePanel.vue'
import TemplateBrowseView from '@/components/templates/TemplateBrowseView.vue'
import AiView from '@/modules/ai/views/AiView.vue'
import AiSettingsPanel from '@/modules/ai/components/AiSettingsPanel.vue'
import OcrView from '@/modules/ocr/views/OcrView.vue'
import OcrSettingsPanel from '@/modules/ocr/components/OcrSettingsPanel.vue'
import { computed, onMounted } from 'vue'
import { featureFlags } from '@/featureFlags'
import { useLibraryStore } from '@/stores/library'
import { useExportStore } from '@/stores/export'
import { useSettingsStore } from '@/stores/settings-store'
import { useFeedback } from '@/composables/use-feedback'

const ui = useUiStore()
const library = useLibraryStore()
const exportStore = useExportStore()
const settingsStore = useSettingsStore()
const feedback = useFeedback()

const isTemplateView = computed(() => ui.libraryView.startsWith('template_'))

onMounted(async () => {
  await settingsStore.init()
  try {
    await Promise.all([library.refresh(), exportStore.loadExportDir()])
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '启动加载失败，请确认 Worker 已运行')
  }
})
</script>

<template>
  <div class="app-shell">
    <div class="pf-flat-card pf-flat-card--nav">
      <SidebarNav />
    </div>
    <div class="pf-flat-card pf-flat-card--main">
      <main class="main">
        <BatchView v-if="ui.libraryView === 'batch'" />
        <CompressView v-else-if="ui.libraryView === 'compress'" />
        <ConvertView v-else-if="ui.libraryView === 'convert'" />
        <EditView v-else-if="ui.libraryView === 'edit'" />
        <AiView v-else-if="ui.libraryView === 'ai' && featureFlags.ENABLE_AI" />
        <OcrView v-else-if="ui.libraryView === 'ocr' && featureFlags.ENABLE_OCR" />
        <TemplateBrowseView v-else-if="isTemplateView && featureFlags.ENABLE_TEMPLATE" />
        <ImageGallery v-else />
      </main>
    </div>
    <div class="pf-flat-card pf-flat-card--rail">
      <aside class="right-panel">
        <BatchSettingsPanel v-if="ui.libraryView === 'batch'" />
        <CompressSettingsPanel v-else-if="ui.libraryView === 'compress'" />
        <ConvertSettingsPanel v-else-if="ui.libraryView === 'convert'" />
        <EditSettingsPanel v-else-if="ui.libraryView === 'edit'" />
        <AiSettingsPanel v-else-if="ui.libraryView === 'ai' && featureFlags.ENABLE_AI" />
        <OcrSettingsPanel v-else-if="ui.libraryView === 'ocr' && featureFlags.ENABLE_OCR" />
        <TemplatePanel v-else-if="isTemplateView && featureFlags.ENABLE_TEMPLATE" />
        <ExportPanel v-else />
      </aside>
    </div>
    <StatusBar />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: var(--pf-sidebar-width) minmax(0, 1fr) var(--pf-right-width);
  grid-template-rows: minmax(0, 1fr) var(--pf-status-height);
  gap: var(--pf-shell-gap);
  padding: var(--pf-shell-pad);
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  max-height: 100vh;
  max-height: 100dvh;
  overflow: hidden;
  background: var(--pf-bg-soft);
}
.main {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.right-panel {
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
</style>
