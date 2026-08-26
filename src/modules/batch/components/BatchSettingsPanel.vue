<script setup lang="ts">
import { NButton, NCheckbox, NInput, NInputNumber, NSelect, NSlider } from 'naive-ui'
import { computed } from 'vue'
import { useBatchStore } from '../stores/batch'
import type { BatchFit } from '../types'
import { FORMAT_OPTIONS } from '@/core/format-options'

const batch = useBatchStore()

const fitOptions: Array<{ label: string; value: BatchFit }> = [
  { label: '适应', value: 'contain' },
  { label: '覆盖', value: 'cover' },
  { label: '填充', value: 'fill' },
  { label: '内适应', value: 'inside' },
  { label: '外适应', value: 'outside' },
]

const formatOptions = FORMAT_OPTIONS

const canStart = computed(() => batch.selectedIds.size > 0 && !batch.loading)
</script>

<template>
  <div class="pf-panel-shell pf-panel-shell--rail">
    <div class="head">
      <div class="title">批量设置</div>
      <NButton size="small" secondary @click="batch.chooseOutputDir()">选择输出目录</NButton>
    </div>

    <div class="rail-body">
      <div class="section">
        <div class="row">
          <div class="label">输出目录</div>
          <div class="value path" :title="batch.settings.outputDir">{{ batch.settings.outputDir || '未选择' }}</div>
        </div>
      </div>

      <div class="section">
        <div class="sec-title">尺寸设置</div>
      <div class="row">
        <NCheckbox v-model:checked="batch.settings.resize.enabled">启用 Resize</NCheckbox>
      </div>
      <div class="grid2">
        <div class="field">
          <div class="label">宽</div>
          <NInputNumber v-model:value="batch.settings.resize.width" :min="1" :disabled="!batch.settings.resize.enabled" />
        </div>
        <div class="field">
          <div class="label">高</div>
          <NInputNumber v-model:value="batch.settings.resize.height" :min="1" :disabled="!batch.settings.resize.enabled" />
        </div>
      </div>
      <div class="row">
        <div class="label">适配模式</div>
        <NSelect v-model:value="batch.settings.resize.fit" size="small" :options="fitOptions" :disabled="!batch.settings.resize.enabled" />
      </div>
    </div>

    <div class="section">
      <div class="sec-title">输出格式</div>
      <div class="row">
        <NSelect v-model:value="batch.settings.format" size="small" :options="formatOptions" />
      </div>
    </div>

    <div class="section">
      <div class="sec-title">压缩质量</div>
      <div class="row">
        <NSlider v-model:value="batch.settings.quality" :min="1" :max="100" :step="1" />
        <div class="val">{{ batch.settings.quality }}</div>
      </div>
    </div>

    <div class="section">
      <div class="sec-title">命名规则</div>
      <div class="row">
        <NInput v-model:value="batch.settings.namingPattern" size="small" placeholder="{name}_{op}.{format}" />
      </div>
    </div>
    </div>

    <div class="footer">
      <NButton type="primary" :disabled="!canStart" @click="batch.startExport()">
        开始导出 ({{ batch.selectedIds.size }})
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.label {
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  min-width: 64px;
}
.value {
  color: var(--pf-text);
  font-weight: 700;
  min-width: 0;
}
.path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
}
.field .label {
  margin-bottom: 6px;
  min-width: 0;
}
.val {
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text);
  min-width: 28px;
  text-align: right;
}
</style>
