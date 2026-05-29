<script setup lang="ts">
import { NButton, NCheckbox, NInput, NInputNumber, NSelect, NSlider } from 'naive-ui'
import { computed } from 'vue'
import { useCompressStore } from '../stores/compress'
import type { CompressOutputFormat } from '../types'

const compress = useCompressStore()

const fmtOptions: Array<{ label: string; value: CompressOutputFormat }> = [
  { label: '自动策略', value: 'auto' },
  { label: '原图格式', value: 'original' },
  { label: 'JPEG', value: 'jpg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'AVIF', value: 'avif' },
]

const canStart = computed(() => compress.selectedIds.size > 0 && !compress.loading)
</script>

<template>
  <div class="panel">
    <div class="head">
      <div class="title">压缩参数</div>
      <NButton size="small" secondary @click="compress.chooseOutputDir()">选择导出目录</NButton>
    </div>

    <div class="section">
      <div class="row">
        <div class="label">导出目录</div>
        <div class="value path" :title="compress.settings.outputDir">{{ compress.settings.outputDir || '未选择' }}</div>
      </div>
    </div>

    <div class="section">
      <div class="sec-title">输出格式</div>
      <div class="row">
        <NSelect v-model:value="compress.settings.outputFormat" size="small" :options="fmtOptions" />
      </div>
    </div>

    <div class="section">
      <div class="sec-title">质量</div>
      <div class="row">
        <NSlider v-model:value="compress.settings.quality" :min="1" :max="100" :step="1" />
        <div class="val">{{ compress.settings.quality }}</div>
      </div>
      <div class="row toggles">
        <NCheckbox v-model:checked="compress.settings.mozjpeg">MozJPEG</NCheckbox>
        <NCheckbox v-model:checked="compress.settings.usePngquant">pngquant</NCheckbox>
      </div>
    </div>

    <div class="section">
      <div class="sec-title">目标大小 (KB)</div>
      <div class="row">
        <NInputNumber v-model:value="compress.settings.targetSizeKb" :min="1" :max="999999" />
        <div class="hint">while(size > targetSize) quality -= 5</div>
      </div>
    </div>

    <div class="section">
      <div class="sec-title">命名规则</div>
      <div class="row">
        <NInput v-model:value="compress.settings.namingPattern" size="small" placeholder="{name}_compressed.{format}" />
      </div>
    </div>

    <div class="footer">
      <NButton type="primary" :disabled="!canStart" @click="compress.startCompress()">
        开始压缩 ({{ compress.selectedIds.size }})
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--pf-bg-elevated);
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.title {
  font-size: 13px;
  font-weight: 900;
  color: var(--pf-text);
}
.section {
  padding: 12px;
  border-bottom: 1px solid var(--pf-border);
}
.sec-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--pf-text-secondary);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
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
.hint {
  margin-left: auto;
  color: var(--pf-text-secondary);
  font-size: 11px;
  font-weight: 600;
  opacity: 0.9;
}
.footer {
  margin-top: auto;
  padding: 12px;
  background: var(--pf-bg);
}
</style>
