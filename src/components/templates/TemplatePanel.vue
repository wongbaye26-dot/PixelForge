<script setup lang="ts">
import { NButton, NEmpty, NInput, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { api } from '@/api/client'
import { useExportStore } from '@/stores/export'
import { useExportSizeStore } from '@/stores/export-size'
import { useUiStore } from '@/stores/ui'
import type { ExportFormat } from '@/types'
import { useFeedback } from '@/composables/use-feedback'

type TemplateItem = {
  id: number
  name: string
  category: string
  sizes: Array<{ width: number; height: number; label?: string }>
  formats: string[]
  builtin: boolean
}

const ui = useUiStore()
const exportStore = useExportStore()
const exportSizes = useExportSizeStore()
const feedback = useFeedback()

const templates = ref<TemplateItem[]>([])
const loading = ref(false)
const newTemplateName = ref('')

const category = computed(() => {
  switch (ui.libraryView) {
    case 'template_my':
      return 'my'
    case 'template_common':
      return 'common'
    case 'template_social':
      return 'social'
    case 'template_ecommerce':
      return 'ecommerce'
    case 'template_custom':
      return 'custom'
    default:
      return 'common'
  }
})

const panelTitle = computed(() => {
  const map: Record<string, string> = {
    my: '我的模板',
    common: '常用模板',
    social: '社交媒体',
    ecommerce: '电商模板',
    custom: '自定义模板',
  }
  return map[category.value] ?? '导出模板'
})

async function loadTemplates() {
  loading.value = true
  try {
    const r = await api.listTemplates(category.value)
    templates.value = r.templates
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '加载模板失败')
  } finally {
    loading.value = false
  }
}

function applyTemplate(t: TemplateItem) {
  exportSizes.applyTemplateSizes(t.sizes)
  if (t.formats.length) {
    exportStore.formats = t.formats.map((f) => (f === 'jpeg' ? 'jpg' : f)) as ExportFormat[]
  }
  ui.libraryView = 'all'
  feedback.success(`已应用模板「${t.name}」`)
}

async function saveCurrentAsTemplate() {
  const name = newTemplateName.value.trim()
  if (!name) {
    feedback.warning('请输入模板名称')
    return
  }
  exportSizes.parseSizes()
  const sizes = exportSizes.activeSizes()
  if (!sizes.length) {
    feedback.warning('请先在尺寸列表中解析并启用至少一个尺寸')
    return
  }
  try {
    await api.createTemplate({
      name,
      category: category.value === 'my' ? 'my' : 'custom',
      sizes: sizes.map((s) => ({ width: s.width, height: s.height })),
      formats: exportStore.formats,
    })
    newTemplateName.value = ''
    await loadTemplates()
    feedback.success('模板已保存')
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '保存失败')
  }
}

async function removeTemplate(id: number) {
  try {
    await api.deleteTemplate(id)
    await loadTemplates()
    feedback.success('模板已删除')
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '删除失败')
  }
}

watch(category, () => void loadTemplates(), { immediate: true })
</script>

<template>
  <div class="pf-panel-shell pf-panel-shell--rail">
    <div class="head">
      <div class="title">{{ panelTitle }}</div>
      <NButton size="small" secondary :loading="loading" @click="loadTemplates">刷新</NButton>
    </div>

    <div v-if="!templates.length && !loading" class="empty">
      <NEmpty size="small" description="暂无模板" />
    </div>

    <div v-else class="list">
      <div v-for="t in templates" :key="t.id" class="card">
        <div class="card-head">
          <div class="name">{{ t.name }}</div>
          <NTag v-if="t.builtin" size="small" :bordered="false">内置</NTag>
        </div>
        <div class="sizes">
          <div v-for="(s, i) in t.sizes" :key="i" class="size-row">
            <span class="size-chip">{{ s.width }}×{{ s.height }}</span>
            <span v-if="s.label" class="size-note">{{ s.label }}</span>
          </div>
        </div>
        <div class="formats" v-if="t.formats.length">
          <span v-for="f in t.formats" :key="f" class="fmt">{{ f.toUpperCase() }}</span>
        </div>
        <div class="actions">
          <NButton size="tiny" type="primary" @click="applyTemplate(t)">应用尺寸</NButton>
          <NButton v-if="!t.builtin" size="tiny" tertiary type="error" @click="removeTemplate(t.id)">删除</NButton>
        </div>
      </div>
    </div>

    <div class="save">
      <div class="save-title">保存当前尺寸为模板</div>
      <div class="save-row">
        <NInput v-model:value="newTemplateName" size="small" placeholder="模板名称" />
        <NButton size="small" secondary @click="saveCurrentAsTemplate">保存</NButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.title {
  font-size: 13px;
  font-weight: 900;
  color: var(--pf-text);
}
.empty {
  padding: 24px 12px;
}
.list {
  flex: 1;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card {
  border: 1px solid var(--pf-border);
  border-radius: 10px;
  padding: 10px;
  background: var(--pf-bg);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.name {
  font-size: 13px;
  font-weight: 800;
  color: var(--pf-text);
}
.sizes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}
.size-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
}
.size-chip {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pf-primary-soft) 50%, var(--pf-bg));
  color: var(--pf-text);
  white-space: nowrap;
  justify-self: start;
}
.size-note {
  font-size: 10px;
  line-height: 1.35;
  color: var(--pf-text-secondary);
}
.formats {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.fmt {
  font-size: 10px;
  font-weight: 700;
  color: var(--pf-text-secondary);
}
.actions {
  display: flex;
  gap: 8px;
}
.save {
  padding: 12px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.save-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--pf-text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.save-row {
  display: flex;
  gap: 8px;
}
</style>
