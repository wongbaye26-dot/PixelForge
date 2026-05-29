<script setup lang="ts">
import { NButton, NCheckbox, NProgress, NSelect, NModal, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import type { ExportFormat } from '@/types'
import { resolveMediaUrl } from '@/utils/media-url'
import { useExportStore } from '@/stores/export'
import { useLibraryStore } from '@/stores/library'
import { useExportMatcherStore } from '../stores/export-matcher'
import { ratioMatchPercent } from '../algorithms/ratio-match'
import { formatRatioMatchPercent } from '../utils/format'

const exportStore = useExportStore()
const library = useLibraryStore()
const matcher = useExportMatcherStore()
const message = useMessage()

const showPreview = ref(false)
const selectedJobId = ref<string | null>(null)

const formatOptions: { label: string; value: ExportFormat }[] = [
  { label: '原图格式', value: 'original' },
  { label: 'JPG', value: 'jpg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'AVIF', value: 'avif' },
  { label: 'GIF', value: 'gif' },
]

const selectedJob = computed(() => matcher.jobs.find((j) => j.id === selectedJobId.value) ?? null)

const beforeSrc = computed(() => {
  const j = selectedJob.value
  if (!j) return undefined
  return resolveMediaUrl(`/api/assets/${j.imageId}/preview`)
})

const afterSrc = computed(() => {
  if (!matcher.previewName) return undefined
  return resolveMediaUrl(`/cache/thumbnails/${matcher.previewName}`)
})

const matchPct = computed(() => {
  const j = selectedJob.value
  if (!j) return null
  return ratioMatchPercent(j.targetRatio, j.imageRatio)
})

watch(showPreview, (v) => {
  if (!v) {
    matcher.clearPreview()
    selectedJobId.value = null
  }
})

async function runAutoMatchExport() {
  exportStore.parseSizes()
  const sizes = exportStore.activeSizes()
  if (!sizes.length) {
    message.warning('请先解析并勾选尺寸')
    return
  }
  if (!exportStore.outputDir.trim()) {
    message.warning('请先设置导出目录')
    return
  }

  const candidateAssetIds = matcher.autoPickBestImage ? undefined : [...library.selectedIds]
  if (!matcher.autoPickBestImage && (!candidateAssetIds || candidateAssetIds.length === 0)) {
    message.warning('请先在图库中选中候选图片（关闭“自动匹配最佳图片”时生效）')
    return
  }

  await matcher.submit({
    sizes: sizes.map((s) => ({ width: s.width, height: s.height })),
    outputDir: exportStore.outputDir,
    format: matcher.format,
    quality: matcher.quality,
    targetSizeKb: matcher.targetSizeKb ?? exportStore.targetSizeKb,
    namingPattern: matcher.namingPattern,
    autoRecommendMode: matcher.autoRecommendMode,
    autoCompressOptimize: matcher.autoCompressOptimize,
    autoBackgroundOptimize: matcher.autoBackgroundOptimize,
    avoidUpscale: matcher.avoidUpscale,
    preferSlightDownscale: matcher.preferSlightDownscale,
    avoidOversize: matcher.avoidOversize,
    highQualityFirst: matcher.highQualityFirst,
    debugMode: matcher.debugMode,
    candidateAssetIds,
  })

  message.success('已开始自动匹配导出（每个尺寸 1 张）')
}

async function openPreview(jobId: string) {
  const j = matcher.jobs.find((x) => x.id === jobId)
  if (!j) return
  selectedJobId.value = j.id
  showPreview.value = true
  await matcher.preview(j.id, j.imageId, j.targetWidth, j.targetHeight, j.recommendedMode)
}
</script>

<template>
  <section class="block">
    <h3 class="block-title">自动匹配导出</h3>

    <div class="row">
      <NCheckbox v-model:checked="matcher.enabled">启用</NCheckbox>
      <NCheckbox v-model:checked="matcher.autoPickBestImage">自动匹配最佳图片</NCheckbox>
      <NCheckbox v-model:checked="matcher.autoRecommendMode">自动推荐模式</NCheckbox>
    </div>

    <div class="row">
      <NCheckbox v-model:checked="matcher.autoCompressOptimize">自动压缩优化</NCheckbox>
      <NCheckbox v-model:checked="matcher.autoBackgroundOptimize">自动背景优化</NCheckbox>
    </div>

    <div class="row">
      <NCheckbox v-model:checked="matcher.avoidUpscale">优先避免放大</NCheckbox>
      <NCheckbox v-model:checked="matcher.preferSlightDownscale">优先轻微缩小</NCheckbox>
    </div>

    <div class="row">
      <NCheckbox v-model:checked="matcher.avoidOversize">避免超大原图</NCheckbox>
      <NCheckbox v-model:checked="matcher.highQualityFirst">高质量优先</NCheckbox>
      <NCheckbox v-model:checked="matcher.debugMode">调试面板</NCheckbox>
    </div>

    <div class="row">
      <div class="label">输出格式</div>
      <NSelect v-model:value="matcher.format" size="small" :options="formatOptions" style="flex: 1" />
    </div>

    <div class="row">
      <div class="label">质量</div>
      <NSelect
        v-model:value="matcher.quality"
        size="small"
        :options="[100,95,90,85,80,75,70,65,60].map((v) => ({ label: String(v), value: v }))"
        style="flex: 1"
      />
    </div>

    <div class="actions">
      <NButton
        type="primary"
        size="small"
        :loading="matcher.loading"
        :disabled="!matcher.enabled || !library.assets.length"
        @click="runAutoMatchExport"
      >
        自动匹配并导出
      </NButton>
      <NButton size="small" secondary :disabled="!matcher.batchId" @click="matcher.refreshJobs()">刷新进度</NButton>
      <NButton size="small" tertiary :disabled="!matcher.jobs.length" @click="matcher.reset()">清空</NButton>
    </div>

    <div v-if="matcher.jobs.length" class="summary">
      <div class="sum-left">队列 {{ matcher.jobs.length }} 项</div>
      <NProgress
        type="line"
        :percentage="matcher.overallProgress"
        :show-indicator="true"
        :height="8"
        color="var(--pf-primary)"
        :rail-color="'#333'"
        style="flex: 1"
      />
    </div>

    <div v-if="matcher.jobs.length" class="list">
      <button v-for="j in matcher.jobs" :key="j.id" type="button" class="item" @click="openPreview(j.id)">
        <div class="item-main">
          <div class="t">{{ j.targetWidth }}×{{ j.targetHeight }}</div>
          <div class="f" :title="j.imageFilename">{{ j.imageFilename }}</div>
        </div>
        <div class="item-meta">
          <span class="pct">{{ formatRatioMatchPercent(j.targetRatio, j.imageRatio) }}</span>
          <span class="mode">{{ j.recommendedMode }}</span>
          <span class="st" :class="j.status">{{ j.status }}</span>
        </div>
      </button>
    </div>

    <NModal v-model:show="showPreview" preset="card" style="width: 92vw; max-width: 1080px">
      <template #header>
        <div class="modal-title">
          <span v-if="selectedJob">目标 {{ selectedJob.targetWidth }}×{{ selectedJob.targetHeight }}</span>
          <span v-if="selectedJob" class="modal-sub"
            >模式 {{ selectedJob.recommendedMode }} / 分 {{ selectedJob.matchScore?.finalScore?.toFixed?.(2) ?? selectedJob.similarity.toFixed(2) }} /
            匹配度 {{ matchPct }}%</span
          >
        </div>
      </template>

      <div class="compare">
        <div class="box">
          <div class="box-head">原图</div>
          <div class="img-wrap"><img v-if="beforeSrc" :src="beforeSrc" class="img" /></div>
        </div>
        <div class="box">
          <div class="box-head">导出预览</div>
          <div class="img-wrap">
            <div v-if="matcher.previewing" class="ph">生成中…</div>
            <img v-else-if="afterSrc" :src="afterSrc" class="img" />
            <div v-else class="ph">暂无</div>
          </div>
        </div>
      </div>

      <div v-if="matcher.debugMode && selectedJob?.debugCandidates?.length" class="debug">
        <div class="debug-title">匹配调试</div>
        <div class="debug-list">
          <div v-for="c in selectedJob.debugCandidates" :key="c.imageId" class="debug-item">
            <div class="debug-left">
              <div class="debug-size">{{ c.width }}×{{ c.height }}</div>
              <div class="debug-meta">ratio {{ c.ratio.toFixed(3) }} / area {{ c.area.toLocaleString() }}</div>
            </div>
            <div class="debug-right">
              <div class="debug-score">分 {{ c.score.finalScore.toFixed(2) }}</div>
              <div class="debug-meta">
                r {{ c.score.ratioScore.toFixed(3) }} / s {{ c.score.sizeScore.toFixed(2) }} / up {{ c.score.upscalePenalty.toFixed(0) }} / ov
                {{ c.score.oversizePenalty.toFixed(1) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </NModal>
  </section>
</template>

<style scoped>
.block {
  margin-bottom: 20px;
  background: var(--pf-bg);
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--pf-border);
  box-shadow: var(--pf-shadow);
}
.block-title {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.label {
  width: 60px;
  color: var(--pf-text-secondary);
  font-size: 12px;
  font-weight: 700;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.sum-left {
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text);
}
.list {
  margin-top: 12px;
  border: 1px solid var(--pf-border);
  border-radius: 10px;
  overflow: hidden;
}
.item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-top: 1px solid var(--pf-border);
  cursor: pointer;
  text-align: left;
}
.item:first-child {
  border-top: none;
}
.item:hover {
  background: var(--pf-bg-hover);
}
.item-main {
  min-width: 0;
}
.t {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text);
}
.f {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--pf-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}
.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.pct {
  font-size: 11px;
  font-weight: 800;
  color: var(--pf-text);
  font-family: 'JetBrains Mono', monospace;
}
.mode {
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
}
.st {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--pf-bg-elevated);
  color: var(--pf-text-secondary);
}
.st.processing {
  background: rgba(0, 122, 255, 0.12);
  color: var(--pf-primary);
}
.st.done {
  background: rgba(40, 167, 69, 0.12);
  color: var(--pf-success);
}
.st.error {
  background: rgba(255, 69, 58, 0.12);
  color: var(--pf-danger);
}
.modal-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.modal-sub {
  font-size: 12px;
  color: var(--pf-text-secondary);
  font-weight: 600;
}
.compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.box {
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--pf-bg);
  display: flex;
  flex-direction: column;
  min-height: 360px;
}
.box-head {
  padding: 10px 12px;
  border-bottom: 1px solid var(--pf-border);
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text-secondary);
}
.img-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f0f10;
}
.img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.ph {
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  font-weight: 700;
}
.debug {
  margin-top: 12px;
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--pf-bg);
}
.debug-title {
  padding: 10px 12px;
  border-bottom: 1px solid var(--pf-border);
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text-secondary);
}
.debug-list {
  display: flex;
  flex-direction: column;
}
.debug-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid var(--pf-border);
}
.debug-item:first-child {
  border-top: none;
}
.debug-size {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 12px;
  color: var(--pf-text);
}
.debug-score {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 900;
  font-size: 12px;
  color: var(--pf-text);
  text-align: right;
}
.debug-meta {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
}
.debug-right {
  text-align: right;
}
@media (max-width: 980px) {
  .compare {
    grid-template-columns: 1fr;
  }
}
</style>
