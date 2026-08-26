<script setup lang="ts">
import { NButton, NSelect } from 'naive-ui'
import { computed, onMounted } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useOcrStore } from '../stores/ocr'
import { useFeedback } from '@/composables/use-feedback'
import type { OcrLang } from '../types'

const library = useLibraryStore()
const ocr = useOcrStore()
const feedback = useFeedback()

const langOptions: Array<{ label: string; value: OcrLang }> = [
  { label: '中英混合', value: 'chi_sim+eng' },
  { label: '简体中文', value: 'chi_sim' },
  { label: '繁体中文', value: 'chi_tra' },
  { label: '英文', value: 'eng' },
]

const targetCount = computed(() =>
  ocr.activeId ? 1 : library.selectedIds.size,
)

const engineLabel = computed(() => {
  if (!ocr.workerReady) return '引擎未就绪'
  if (ocr.engine === 'tesseract-cli') return '系统 Tesseract'
  return '内置 OCR 引擎'
})

onMounted(() => {
  void ocr.loadStatus()
})

async function handleScan() {
  if (!targetCount.value) {
    feedback.warning('请先选择图片')
    return
  }
  try {
    const result = await ocr.scanSelected()
    if (!result) return
    if (result.failed > 0 && result.done === 0) {
      feedback.error(result.errors[0] ?? 'OCR 识别失败')
      return
    }
    if (result.failed > 0) {
      feedback.warning(`OCR 完成：成功 ${result.done} 张，失败 ${result.failed} 张`)
      return
    }
    feedback.success(`OCR 完成（${result.done} 张）`)
  } catch (err) {
    feedback.error(err instanceof Error ? err.message : 'OCR 失败')
  }
}
</script>

<template>
  <div class="pf-panel-shell pf-panel-shell--rail">
    <div class="head">
      <div class="title">OCR 识别</div>
    </div>

    <div class="section">
      <div class="sec-title">语言</div>
      <NSelect v-model:value="ocr.lang" size="small" :options="langOptions" />
    </div>

    <div class="section hint">
      <div class="engine-line">
        <span class="engine-label">当前引擎</span>
        <span class="engine-value" :class="{ warn: !ocr.workerReady }">{{ engineLabel }}</span>
      </div>
      优先使用系统 <code>tesseract</code>；未安装时自动使用内置引擎（首次识别需下载语言包）。
      <br />
      macOS 可选安装：<code>brew install tesseract tesseract-lang</code>
      <br />
      识别结果会写入数据库，可在图库搜索框中按文字搜索。
    </div>

    <div class="foot">
      <NButton
        type="primary"
        block
        :loading="ocr.scanning"
        :disabled="!ocr.workerReady"
        @click="handleScan"
      >
        开始 OCR（{{ targetCount || 0 }} 张）
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.hint {
  font-size: 11px;
  color: var(--pf-text-secondary);
  line-height: 1.6;
}
.engine-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: var(--pf-radius-md);
  background: color-mix(in srgb, var(--pf-bg-soft) 88%, var(--pf-bg));
  border: 1px solid color-mix(in srgb, var(--pf-border-color) 80%, transparent);
}
.engine-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.engine-value {
  font-size: 11px;
  font-weight: 800;
  color: var(--pf-primary);
}
.engine-value.warn {
  color: var(--pf-warning);
}
.foot {
  margin-top: auto;
  padding: 12px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
</style>
