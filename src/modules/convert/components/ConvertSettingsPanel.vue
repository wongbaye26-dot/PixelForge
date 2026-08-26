<script setup lang="ts">
import { NButton, NCheckbox, NInput, NSelect, NSlider } from 'naive-ui'
import { computed } from 'vue'
import { useConvertStore } from '../stores/convert'
import type { ConvertTargetFormat } from '../types'

const convert = useConvertStore()

const fmtOptions: Array<{ label: string; value: ConvertTargetFormat }> = [
  { label: 'JPG → PNG', value: 'png' },
  { label: 'PNG → WebP', value: 'webp' },
  { label: 'WebP → AVIF', value: 'avif' },
  { label: 'GIF → WebP', value: 'webp' },
  { label: '统一转 JPG', value: 'jpg' },
]

const canStart = computed(() => convert.selectedIds.size > 0 && !convert.loading)
</script>

<template>
  <div class="pf-panel-shell pf-panel-shell--rail">
    <div class="head">
      <div class="title">转换参数</div>
      <NButton size="small" secondary @click="convert.chooseOutputDir()">选择导出目录</NButton>
    </div>

    <div class="rail-body">
      <div class="section">
        <div class="row">
          <div class="label">导出目录</div>
          <div class="value path" :title="convert.settings.outputDir">{{ convert.settings.outputDir || '未选择' }}</div>
        </div>
      </div>

      <div class="section">
        <div class="sec-title">转换目标</div>
      <div class="row">
        <NSelect v-model:value="convert.settings.targetFormat" size="small" :options="fmtOptions" />
      </div>
    </div>

    <div class="section">
      <div class="sec-title">质量</div>
      <div class="row">
        <NSlider v-model:value="convert.settings.quality" :min="1" :max="100" :step="1" />
        <div class="val">{{ convert.settings.quality }}</div>
      </div>
      <div class="row toggles">
        <NCheckbox v-model:checked="convert.settings.keepExif">保留 Exif</NCheckbox>
      </div>
    </div>

    <div class="section">
      <div class="sec-title">命名规则</div>
      <div class="row">
        <NInput v-model:value="convert.settings.namingPattern" size="small" placeholder="{name}.{format}" />
      </div>
    </div>
    </div>

    <div class="footer">
      <NButton type="primary" :disabled="!canStart" @click="convert.startConvert()">
        开始转换 ({{ convert.selectedIds.size }})
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
.toggles {
  margin-top: 10px;
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
.val {
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text);
  min-width: 28px;
  text-align: right;
}
</style>
