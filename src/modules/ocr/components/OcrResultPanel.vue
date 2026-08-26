<script setup lang="ts">
import { useOcrStore } from '../stores/ocr'
import { resolveMediaUrl } from '@/utils/media-url'

const ocr = useOcrStore()
</script>

<template>
  <div class="panel">
    <div class="head">
      <div class="title">识别结果</div>
    </div>

    <div v-if="!ocr.activeAsset" class="empty">请选择一张图片</div>
    <template v-else>
      <div class="preview">
        <img :src="resolveMediaUrl(`/api/assets/${ocr.activeAsset.id}/preview`)" alt="preview" />
      </div>
      <div class="text-box">
        <div v-if="ocr.scanning || ocr.activeJobStatus === 'running' || ocr.activeJobStatus === 'queued'" class="placeholder">
          正在识别…
        </div>
        <pre v-else-if="ocr.activeText" class="text">{{ ocr.activeText }}</pre>
        <div v-else-if="ocr.activeError" class="error">{{ ocr.activeError }}</div>
        <div v-else class="placeholder">尚未识别。选择图片后点击右侧「开始 OCR」。</div>
      </div>
    </template>
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
  padding: 12px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.title {
  font-size: 13px;
  font-weight: 900;
}
.empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--pf-text-secondary);
}
.preview {
  height: 220px;
  border-bottom: 1px solid var(--pf-border);
  background: #111;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.text-box {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
}
.text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  color: var(--pf-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.placeholder {
  color: var(--pf-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.error {
  color: var(--pf-danger);
  font-size: 13px;
  line-height: 1.6;
  font-weight: 600;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
