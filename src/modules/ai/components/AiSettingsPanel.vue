<script setup lang="ts">
import { NButton, NInput, NInputNumber } from 'naive-ui'
import { onMounted } from 'vue'
import { useAiStore } from '../stores/ai'
import { useFeedback } from '@/composables/use-feedback'

const ai = useAiStore()
const feedback = useFeedback()

onMounted(() => void ai.refreshStatus())

async function handleExport() {
  try {
    const result = await ai.exportImages()
    if (!result) {
      feedback.warning('请先选择图片')
      return
    }
    const ok = result.results.filter((r) => r.success).length
    feedback.success(`已导出 ${ok} 张到 ${result.outputDir}`)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '导出失败')
  }
}

async function handleSaveSidecar() {
  try {
    await ai.saveSidecarUrl()
    feedback.success('Sidecar 地址已保存')
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : '保存失败')
  }
}
</script>

<template>
  <div class="pf-panel-shell pf-panel-shell--rail">
    <div class="head">
      <div class="title">AI 扩图</div>
    </div>

    <div class="section">
      <div class="sec-title">目标尺寸</div>
      <div class="row">
        <div class="label">宽</div>
        <NInputNumber v-model:value="ai.params.width" :min="64" :max="8192" />
        <div class="label">高</div>
        <NInputNumber v-model:value="ai.params.height" :min="64" :max="8192" />
      </div>
    </div>

    <div class="section">
      <div class="sec-title">Sidecar（可选）</div>
      <div class="hint">未连接时自动使用本地模糊扩展。开发可运行 <code>npm run ai:sidecar</code></div>
      <NInput
        v-model:value="ai.params.sidecarUrl"
        size="small"
        placeholder="http://127.0.0.1:3848/outpaint"
        clearable
      />
      <NButton size="small" secondary class="mt" @click="handleSaveSidecar">保存地址</NButton>
    </div>

    <div class="foot">
      <NButton type="primary" block :loading="ai.exporting" :disabled="!ai.activeAsset" @click="handleExport">
        导出扩图结果
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.label {
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text-secondary);
}
.hint {
  font-size: 11px;
  color: var(--pf-text-secondary);
  margin-bottom: 8px;
  line-height: 1.5;
}
.mt {
  margin-top: 8px;
}
.foot {
  margin-top: auto;
  padding: 12px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
</style>
