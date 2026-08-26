<script setup lang="ts">
import { NButton, NCheckbox, NColorPicker, NInputNumber, NSlider, NSwitch } from 'naive-ui'
import { useEditStore } from '../stores/edit'
import { useFeedback } from '@/composables/use-feedback'

const edit = useEditStore()
const feedback = useFeedback()

async function handleExport() {
  try {
    const result = await edit.exportImages()
    if (!result) {
      feedback.warning('请先选择要导出的图片')
      return
    }
    const ok = result.results.filter((r) => r.success).length
    const failed = result.results.length - ok
    if (failed > 0) {
      feedback.warning(`已导出 ${ok} 张，${failed} 张失败。输出目录：${result.outputDir}`)
    } else {
      feedback.success(`已导出 ${ok} 张到 ${result.outputDir}`)
    }
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '导出失败')
  }
}
</script>

<template>
  <div class="pf-panel-shell pf-panel-shell--rail">
    <div class="head">
      <div class="title">编辑参数</div>
    </div>

    <div class="section">
      <div class="sec-title">形状</div>
      <div class="row">
        <NCheckbox v-model:checked="edit.params.circleCrop">圆形裁切</NCheckbox>
      </div>
      <div class="row">
        <div class="label">圆角</div>
        <NSlider v-model:value="edit.params.cornerRadius" :min="0" :max="200" :step="1" :disabled="edit.params.circleCrop" />
        <div class="val">{{ edit.params.cornerRadius }}</div>
      </div>
    </div>

    <div class="section">
      <div class="sec-title">描边</div>
      <div class="row">
        <div class="label">宽度</div>
        <NSlider v-model:value="edit.params.strokeWidth" :min="0" :max="40" :step="1" />
        <div class="val">{{ edit.params.strokeWidth }}</div>
      </div>
      <div class="row">
        <div class="label">颜色</div>
        <NColorPicker v-model:value="edit.params.strokeColor" size="small" :modes="['hex', 'rgb']" />
      </div>
    </div>

    <div class="section">
      <div class="sec-title">阴影</div>
      <div class="row">
        <NSwitch v-model:value="edit.params.shadowEnabled" />
        <div class="label">启用</div>
      </div>
      <div class="row">
        <div class="label">模糊</div>
        <NSlider v-model:value="edit.params.shadowBlur" :min="0" :max="60" :step="1" :disabled="!edit.params.shadowEnabled" />
        <div class="val">{{ edit.params.shadowBlur }}</div>
      </div>
      <div class="row">
        <div class="label">X</div>
        <NInputNumber v-model:value="edit.params.shadowOffsetX" :min="-60" :max="60" :disabled="!edit.params.shadowEnabled" />
        <div class="label">Y</div>
        <NInputNumber v-model:value="edit.params.shadowOffsetY" :min="-60" :max="60" :disabled="!edit.params.shadowEnabled" />
      </div>
      <div class="row">
        <div class="label">颜色</div>
        <NColorPicker v-model:value="edit.params.shadowColor" size="small" :modes="['rgb', 'hex']" />
      </div>
    </div>

    <div class="section">
      <div class="sec-title">背景</div>
      <div class="row">
        <NCheckbox v-model:checked="edit.params.transparentBackground">透明背景</NCheckbox>
      </div>
      <div class="row">
        <div class="label">填充色</div>
        <NColorPicker v-model:value="edit.params.backgroundColor" size="small" :modes="['hex', 'rgb']" :disabled="edit.params.transparentBackground" />
      </div>
    </div>

    <div class="section">
      <div class="sec-title">预览尺寸</div>
      <div class="row">
        <div class="label">最大值</div>
        <NSlider v-model:value="edit.params.maxSize" :min="256" :max="1400" :step="16" />
        <div class="val">{{ edit.params.maxSize }}</div>
      </div>
    </div>

    <div class="foot">
      <NButton
        type="primary"
        block
        :loading="edit.exporting"
        :disabled="!edit.activeAsset"
        @click="handleExport"
      >
        导出编辑结果
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
  min-width: 40px;
}
.val {
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text);
  min-width: 34px;
  text-align: right;
}
.foot {
  margin-top: auto;
  padding: 12px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
</style>

