<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton } from 'naive-ui'
import {
  ECOMMERCE_SIZE_PRESETS,
  SOCIAL_SIZE_PRESETS,
  formatSizeInputLine,
  type ExportSizeEntry,
  type ExportSizeTemplate,
} from '@/data/export-size-presets'

type PresetTab = 'social' | 'ecommerce'

const emit = defineEmits<{
  apply: [text: string]
}>()

const activeTab = ref<PresetTab>('social')
const expandedGroup = ref<string | null>(null)

const tabs = [
  { key: 'social' as const, label: '社交媒体', groups: SOCIAL_SIZE_PRESETS },
  { key: 'ecommerce' as const, label: '电商平台', groups: ECOMMERCE_SIZE_PRESETS },
]

const activeSection = computed(() => tabs.find((t) => t.key === activeTab.value) ?? tabs[0])

const sectionStats = computed(() => {
  const groups = activeSection.value.groups
  const sizeCount = groups.reduce((sum, g) => sum + g.sizes.length, 0)
  return { groups: groups.length, sizes: sizeCount }
})

watch(activeTab, () => {
  expandedGroup.value = null
})

function toggleGroup(name: string) {
  expandedGroup.value = expandedGroup.value === name ? null : name
}

function isExpanded(name: string) {
  return expandedGroup.value === name
}

function applyGroup(group: ExportSizeTemplate, event?: Event) {
  event?.stopPropagation()
  emit('apply', group.sizes.map((s) => formatSizeInputLine(s)).join('\n'))
}

function applySingle(entry: ExportSizeEntry) {
  emit('apply', formatSizeInputLine(entry))
}
</script>

<template>
  <div class="preset-panel">
    <div class="preset-panel-head">
      <div class="preset-panel-title-row">
        <span class="preset-panel-title">常用模块尺寸</span>
        <span class="preset-panel-stat">
          {{ sectionStats.groups }} 平台 · {{ sectionStats.sizes }} 项
        </span>
      </div>
      <div class="preset-tabs" role="tablist" aria-label="模块分类">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="preset-tab"
          :class="{ active: activeTab === tab.key }"
          role="tab"
          :aria-selected="activeTab === tab.key"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span class="preset-tab-count">{{ tab.groups.length }}</span>
        </button>
      </div>
    </div>

    <div class="preset-scroll pf-scroll">
      <article
        v-for="group in activeSection.groups"
        :key="group.name"
        class="preset-module"
        :class="{ expanded: isExpanded(group.name) }"
      >
        <header
          class="preset-module-head"
          role="button"
          tabindex="0"
          :aria-expanded="isExpanded(group.name)"
          @click="toggleGroup(group.name)"
          @keydown.enter.prevent="toggleGroup(group.name)"
          @keydown.space.prevent="toggleGroup(group.name)"
        >
          <span class="preset-module-chevron" aria-hidden="true" />
          <div class="preset-module-meta">
            <h4 class="preset-module-name">{{ group.name }}</h4>
            <p class="preset-module-hint">{{ group.sizes.length }} 个常用尺寸</p>
          </div>
          <NButton size="tiny" secondary type="primary" @click="applyGroup(group, $event)">
            填入本组
          </NButton>
        </header>
        <div v-show="isExpanded(group.name)" class="preset-size-grid pf-scroll">
          <button
            v-for="(size, index) in group.sizes"
            :key="`${group.name}-${index}`"
            type="button"
            class="preset-size-card"
            @click="applySingle(size)"
          >
            <span class="preset-size-card-dim">{{ size.width }}×{{ size.height }}</span>
            <span class="preset-size-card-label">{{ size.label }}</span>
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.preset-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
  padding: 10px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  border-radius: var(--pf-radius-md);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 82%, transparent);
  background: color-mix(in srgb, var(--pf-bg) 92%, var(--pf-bg-soft));
}

.preset-panel-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-panel-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.preset-panel-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--pf-text);
  letter-spacing: 0.02em;
}

.preset-panel-stat {
  font-size: 10px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  white-space: nowrap;
}

.preset-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 3px;
  border-radius: var(--pf-radius-md);
  background: color-mix(in srgb, var(--pf-bg-soft) 88%, var(--pf-bg));
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 70%, transparent);
}

.preset-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: calc(var(--pf-radius-md) - 2px);
  background: transparent;
  color: var(--pf-text-secondary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease,
    box-shadow 0.12s ease;
}

.preset-tab:hover {
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-bg-hover) 70%, transparent);
}

.preset-tab.active {
  color: var(--pf-primary);
  background: var(--pf-bg);
  box-shadow: var(--pf-shadow-sm);
}

.preset-tab-count {
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: var(--pf-radius-pill);
  background: color-mix(in srgb, var(--pf-primary-soft) 70%, var(--pf-bg));
  color: var(--pf-primary);
  font-size: 10px;
  font-weight: 800;
  line-height: 16px;
}

.preset-scroll {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  max-height: clamp(148px, 24vh, 220px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
}

.preset-module {
  flex-shrink: 0;
  border-radius: var(--pf-radius-md);
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 75%, transparent);
  background: var(--pf-bg);
  overflow: hidden;
}

.preset-module.expanded {
  border-color: color-mix(in srgb, var(--pf-primary) 22%, var(--pf-border-color));
}

.preset-module-head {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 7px 8px;
  border: none;
  background: color-mix(in srgb, var(--pf-bg-soft) 80%, var(--pf-bg));
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease;
}

.preset-module.expanded .preset-module-head {
  border-bottom: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 55%, transparent);
}

.preset-module-head:hover {
  background: color-mix(in srgb, var(--pf-bg-hover) 72%, var(--pf-bg-soft));
}

.preset-module-chevron {
  width: 8px;
  height: 8px;
  border-right: 1.5px solid var(--pf-text-secondary);
  border-bottom: 1.5px solid var(--pf-text-secondary);
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.preset-module.expanded .preset-module-chevron {
  transform: rotate(45deg) translateY(-1px);
}

.preset-module-meta {
  min-width: 0;
  overflow: hidden;
}

.preset-module-name {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  color: var(--pf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-module-hint {
  margin: 2px 0 0;
  font-size: 10px;
  color: var(--pf-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-module-head :deep(.n-button) {
  flex-shrink: 0;
  max-width: 72px;
  padding: 0 6px;
  font-size: 10px;
}

.preset-size-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 5px;
  padding: 6px;
  max-height: min(200px, 30vh);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.preset-size-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 7px 8px;
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 80%, transparent);
  border-radius: var(--pf-radius-md);
  background: color-mix(in srgb, var(--pf-bg) 96%, var(--pf-bg-soft));
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.12s ease,
    background-color 0.12s ease,
    transform 0.12s ease;
}

.preset-size-card:hover {
  border-color: color-mix(in srgb, var(--pf-primary) 28%, var(--pf-border-color));
  background: color-mix(in srgb, var(--pf-primary-soft) 28%, var(--pf-bg));
  transform: translateY(-1px);
}

.preset-size-card-dim {
  font-size: 11px;
  font-weight: 800;
  color: var(--pf-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
  flex-shrink: 0;
}

.preset-size-card-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--pf-text);
  line-height: 1.35;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
