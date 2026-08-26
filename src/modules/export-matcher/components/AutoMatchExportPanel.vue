<script setup lang="ts">
import { NButton, NCollapse, NCollapseItem, NInput, NInputNumber, NModal, NProgress, NSelect, NSwitch } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import type { ImageAsset } from '@/types'
import { resolveMediaUrl } from '@/utils/media-url'
import { useLibraryStore } from '@/stores/library'
import { useAssetScopeStore } from '@/stores/asset-scope'
import { useSmartExportSizeStore } from '@/modules/smart-export/stores/smart-export-size'
import { useExportMatcherStore } from '../stores/export-matcher'
import { ratioMatchPercent } from '../algorithms/ratio-match'
import { formatRatioMatchPercent } from '../utils/format'
import { useFeedback } from '@/composables/use-feedback'
import StrategyOptionCard from '@/components/module/StrategyOptionCard.vue'
import ExportDirPanel from '@/components/export/ExportDirPanel.vue'
import ExportSizePresets from '@/components/export/ExportSizePresets.vue'
import { sizeCardPresentation } from '@/core/size-parser'
import { FORMAT_OPTIONS } from '@/core/format-options'

const library = useLibraryStore()
const assetScope = useAssetScopeStore()
const matcher = useExportMatcherStore()
const smartSizes = useSmartExportSizeStore()
const feedback = useFeedback()

const showPreview = ref(false)
const showSwapModal = ref(false)
const selectedJobId = ref<string | null>(null)
const swapJobId = ref<string | null>(null)

function sizeCard(s: (typeof smartSizes.parsedSizes)[number]) {
  return sizeCardPresentation(s, '点击启用智能匹配')
}

watch(
  () => smartSizes.sizeInput,
  () => {
    smartSizes.parseSizes()
  },
  { immediate: true },
)

const formatOptions = FORMAT_OPTIONS

const statusLabel: Record<string, string> = {
  pending: '等待',
  processing: '处理中',
  done: '完成',
  error: '失败',
  cancelled: '已取消',
}

const selectedJob = computed(() => matcher.jobs.find((j) => j.id === selectedJobId.value) ?? null)
const swapJob = computed(() => matcher.jobs.find((j) => j.id === swapJobId.value) ?? null)
const swapCandidates = computed(() => {
  if (!swapJob.value) return [] as ImageAsset[]
  const ids = new Set<number>()
  const list: ImageAsset[] = []
  for (const id of library.selectedIds) {
    const asset = library.assets.find((a) => a.id === id)
    if (asset && !ids.has(asset.id)) {
      ids.add(asset.id)
      list.push(asset)
    }
  }
  for (const c of swapJob.value.debugCandidates ?? []) {
    const asset = library.assets.find((a) => a.id === c.imageId)
    if (asset && !ids.has(asset.id)) {
      ids.add(asset.id)
      list.push(asset)
    }
  }
  return list
})

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

watch(
  () => assetScope.currentScope,
  () => {
    matcher.reset()
  },
)

watch(
  () => matcher.batchFinished,
  (finished) => {
    if (!finished || !matcher.lastBatchSummary) return
    const s = matcher.lastBatchSummary
    const msg = `智能导出完成：成功 ${s.done}，失败 ${s.failed}${s.cancelled ? `，取消 ${s.cancelled}` : ''}`
    if (s.failed > 0) feedback.warning(msg)
    else feedback.success(msg)
    matcher.acknowledgeBatchFinish()
  },
)

watch(
  () => matcher.pollError,
  (err) => {
    if (err) feedback.error(err)
  },
)

async function openPreview(jobId: string) {
  const j = matcher.jobs.find((x) => x.id === jobId)
  if (!j) return
  selectedJobId.value = j.id
  showPreview.value = true
  try {
    await matcher.preview(j.id, j.imageId, j.targetWidth, j.targetHeight, j.recommendedMode)
  } catch {
    feedback.error('预览生成失败，请稍后重试')
  }
}

function openSwapModal(jobId: string, event?: Event) {
  event?.stopPropagation()
  swapJobId.value = jobId
  showSwapModal.value = true
}

async function confirmSwap(assetId: number) {
  if (!swapJobId.value) return
  try {
    await matcher.swapJob(swapJobId.value, assetId)
    showSwapModal.value = false
    feedback.success('已更换匹配图片并重新导出')
  } catch {
    feedback.error('更换图片失败')
  }
}

async function retryJob(jobId: string, event?: Event) {
  event?.stopPropagation()
  try {
    await matcher.retryJob(jobId)
    feedback.success('已重新加入导出队列')
  } catch {
    feedback.error('重试失败')
  }
}

async function cancelJob(jobId: string, event?: Event) {
  event?.stopPropagation()
  try {
    await matcher.cancelJob(jobId)
  } catch {
    feedback.error('取消失败')
  }
}

async function cancelBatch() {
  try {
    await matcher.cancelJob()
    feedback.success('已取消待处理任务')
  } catch {
    feedback.error('取消失败')
  }
}

async function openOutput(job: { outputPath?: string }) {
  if (!job.outputPath) return
  try {
    if (window.pixelForge?.showItemInFolder) {
      await window.pixelForge.showItemInFolder(job.outputPath)
      return
    }
    if (window.pixelForge?.openPath) {
      const parent = job.outputPath.replace(/[/\\][^/\\]+$/, '')
      await window.pixelForge.openPath(parent || job.outputPath)
    }
  } catch {
    feedback.error('无法打开输出位置')
  }
}
</script>

<template>
  <div class="se-root" :class="{ 'is-disabled': !matcher.enabled }">
    <div class="scope-banner">
      <span class="scope-banner-label">匹配范围</span>
      <span class="scope-banner-value">{{ assetScope.currentScope.name }}（{{ assetScope.scopeAssetCount }} 张）</span>
    </div>

    <div class="toolbar">
      <div class="toolbar-main">
        <NSwitch v-model:value="matcher.enabled" size="medium" />
        <span class="toolbar-label">{{ matcher.enabled ? '智能导出已启用' : '智能导出已关闭' }}</span>
      </div>
      <div class="toolbar-actions">
        <NButton size="tiny" tertiary :disabled="!matcher.batchId" @click="matcher.refreshJobs()">刷新</NButton>
        <NButton size="tiny" quaternary :disabled="!matcher.jobs.length" @click="matcher.reset()">清空</NButton>
      </div>
    </div>

    <div v-if="matcher.unmatchedSizes.length" class="alert-warn">
      未匹配：{{ matcher.unmatchedSizes.map((s) => `${s.width}×${s.height}`).join('、') }}
    </div>

    <div class="se-body">
      <ExportDirPanel caption="与「导出设置」共用同一输出路径" />

      <section class="block">
        <div class="block-heading">
          <h3 class="block-title">匹配策略</h3>
          <span class="block-caption">自动挑选图片与适配模式</span>
        </div>
        <div class="strategy-grid">
          <StrategyOptionCard
            v-model="matcher.autoPickBestImage"
            tag="匹配"
            title="自动匹配最佳图片"
            desc="综合比例与尺寸，优先轻微缩小"
          />
          <StrategyOptionCard
            v-model="matcher.autoRecommendMode"
            tag="模式"
            title="自动推荐适配模式"
            desc="按比例差异选择 cover / contain / blur"
          />
          <StrategyOptionCard
            v-model="matcher.autoBackgroundOptimize"
            tag="背景"
            title="自动背景优化"
            desc="比例差异大时优化留白与观感"
          />
          <StrategyOptionCard
            v-model="matcher.autoCompressOptimize"
            tag="压缩"
            title="按目标大小压缩"
            desc="在体积限制下尽量保持清晰度"
          />
        </div>
      </section>

      <section class="block">
        <div class="block-heading">
          <h3 class="block-title">导出尺寸</h3>
          <span class="block-caption">每行一个尺寸，用于自动匹配</span>
        </div>
        <NInput
          v-model:value="smartSizes.sizeInput"
          type="textarea"
          :rows="3"
          placeholder="每行一个，如 1080x1080 # Instagram 正方形"
          class="size-input"
        />
        <ExportSizePresets @apply="smartSizes.appendSizeInput" />
        <NButton block size="small" class="parse-btn" @click="smartSizes.parseSizes()">解析尺寸</NButton>
        <div v-if="smartSizes.parsedSizes.length" class="parsed-list">
          <div class="parsed-head">
            <div class="parsed-label">解析结果 · 点击卡片启用</div>
            <NButton size="tiny" quaternary @click="smartSizes.clearParsedResults()">清空</NButton>
          </div>
          <div class="strategy-grid strategy-grid-compact">
            <StrategyOptionCard
              v-for="s in smartSizes.parsedSizes"
              :key="smartSizes.sizeKey(s)"
              compact
              :tag="sizeCard(s).tag"
              :title="sizeCard(s).title"
              :desc="sizeCard(s).desc"
              :model-value="smartSizes.enabledSizeKeys.has(smartSizes.sizeKey(s))"
              @update:model-value="(on) => smartSizes.setSizeEnabled(smartSizes.sizeKey(s), on)"
            />
          </div>
        </div>
      </section>

      <NCollapse arrow-placement="right" class="se-collapse">
        <NCollapseItem title="质量与导出参数" name="advanced">
          <div class="collapse-stack">
            <div class="strategy-grid strategy-grid-compact">
              <StrategyOptionCard
                v-model="matcher.avoidUpscale"
                tag="放大"
                title="避免放大"
                desc="目标大于原图时降权"
              />
              <StrategyOptionCard
                v-model="matcher.preferSlightDownscale"
                tag="缩小"
                title="优先轻微缩小"
                desc="偏好 1–3 倍面积范围"
              />
              <StrategyOptionCard
                v-model="matcher.highQualityFirst"
                tag="画质"
                title="高质量优先"
                desc="无需放大时优先高质候选"
              />
              <StrategyOptionCard
                v-model="matcher.avoidOversize"
                tag="超大"
                title="避免超大原图"
                desc="面积超目标 5 倍时降权"
              />
            </div>
            <div class="field-row">
              <span class="field-label">输出格式</span>
              <NSelect v-model:value="matcher.format" size="small" :options="formatOptions" />
            </div>
            <div class="field-row">
              <span class="field-label">导出质量</span>
              <NSelect
                v-model:value="matcher.quality"
                size="small"
                :options="[100, 95, 90, 85, 80, 75, 70].map((v) => ({ label: String(v), value: v }))"
              />
            </div>
            <div class="field-row">
              <span class="field-label">命名规则</span>
              <NInput v-model:value="matcher.namingPattern" size="small" placeholder="{name}_{size}.{format}" />
            </div>
            <div class="field-row">
              <span class="field-label">目标大小</span>
              <NInputNumber
                v-model:value="matcher.targetSizeKb"
                size="small"
                :min="1"
                :max="50000"
                clearable
                placeholder="KB，不限"
                style="width: 100%"
              />
            </div>
            <div class="field-row field-row-switch">
              <span class="field-label">调试模式</span>
              <NSwitch v-model:value="matcher.debugMode" size="small" />
              <span class="field-hint">显示候选评分，便于换图</span>
            </div>
          </div>
        </NCollapseItem>
      </NCollapse>

      <section v-if="matcher.jobs.length" class="block">
        <div class="block-heading block-heading-row">
          <div>
            <h3 class="block-title">匹配结果</h3>
            <span class="block-caption">{{ matcher.jobs.length }} 项任务</span>
          </div>
          <NButton
            v-if="matcher.activeJobs.length"
            size="tiny"
            tertiary
            @click="cancelBatch"
          >
            取消待处理
          </NButton>
        </div>
        <div class="summary-row">
          <NProgress
            type="line"
            :percentage="matcher.overallProgress"
            :show-indicator="true"
            :height="6"
            color="var(--pf-primary)"
            :rail-color="'#333'"
          />
        </div>
        <div class="result-list">
          <div v-for="j in matcher.jobs" :key="j.id" class="result-item">
            <button type="button" class="result-main" @click="openPreview(j.id)">
              <div class="result-text">
                <div class="result-size">{{ j.targetWidth }}×{{ j.targetHeight }}</div>
                <div class="result-file" :title="j.imageFilename">{{ j.imageFilename }}</div>
                <div v-if="j.error" class="result-err" :title="j.error">{{ j.error }}</div>
              </div>
              <div class="result-badges">
                <span class="badge">{{ formatRatioMatchPercent(j.targetRatio, j.imageRatio) }}</span>
                <span class="badge muted">{{ j.recommendedMode }}</span>
                <span class="badge status" :class="j.status">{{ statusLabel[j.status] ?? j.status }}</span>
              </div>
            </button>
            <div class="result-actions">
              <NButton
                v-if="j.status === 'pending' || j.status === 'processing'"
                size="tiny"
                tertiary
                @click="cancelJob(j.id, $event)"
              >
                取消
              </NButton>
              <NButton v-if="j.status === 'error'" size="tiny" secondary @click="retryJob(j.id, $event)">重试</NButton>
              <NButton
                v-if="j.status === 'done' || j.status === 'error'"
                size="tiny"
                tertiary
                :disabled="!j.outputPath"
                @click.stop="openOutput(j)"
              >
                打开
              </NButton>
              <NButton size="tiny" quaternary @click="openSwapModal(j.id, $event)">换图</NButton>
            </div>
          </div>
        </div>
      </section>
    </div>

    <NModal v-model:show="showPreview" preset="card" class="se-preview-modal">
      <template #header>
        <div class="modal-title">
          <span v-if="selectedJob">目标 {{ selectedJob.targetWidth }}×{{ selectedJob.targetHeight }}</span>
          <span v-if="selectedJob" class="modal-sub">
            {{ selectedJob.recommendedMode }} · 匹配度 {{ matchPct }}%
          </span>
        </div>
      </template>
      <div class="compare-grid pf-compare-canvas">
        <div class="compare-box">
          <div class="compare-head">原图</div>
          <div class="compare-body"><img v-if="beforeSrc" :src="beforeSrc" class="compare-img" alt="" /></div>
        </div>
        <div class="compare-box">
          <div class="compare-head">导出预览</div>
          <div class="compare-body">
            <div v-if="matcher.previewing" class="compare-ph">生成中…</div>
            <img v-else-if="afterSrc" :src="afterSrc" class="compare-img" alt="" />
            <div v-else class="compare-ph">暂无</div>
          </div>
        </div>
      </div>
      <div v-if="matcher.debugMode && selectedJob?.debugCandidates?.length" class="debug-panel">
        <div class="debug-title">匹配调试</div>
        <div v-for="c in selectedJob.debugCandidates" :key="c.imageId" class="debug-row">
          <div>
            <div class="debug-size">{{ c.width }}×{{ c.height }}</div>
            <div class="debug-meta">比例 {{ c.ratio.toFixed(3) }}</div>
          </div>
          <div class="debug-score">分 {{ c.score.finalScore.toFixed(2) }}</div>
        </div>
      </div>
    </NModal>

    <NModal v-model:show="showSwapModal" preset="card" title="更换匹配图片" class="se-swap-modal">
      <div v-if="swapJob" class="swap-head">
        目标 {{ swapJob.targetWidth }}×{{ swapJob.targetHeight }} · 当前 {{ swapJob.imageFilename }}
      </div>
      <div v-if="!swapCandidates.length" class="swap-empty">请先在图库选中候选图片，或开启调试模式</div>
      <div v-else class="swap-list">
        <button
          v-for="asset in swapCandidates"
          :key="asset.id"
          type="button"
          class="swap-item"
          @click="confirmSwap(asset.id)"
        >
          <img :src="resolveMediaUrl(`/api/assets/${asset.id}/preview`)" class="swap-thumb" alt="" />
          <div>
            <div class="swap-name">{{ asset.filename }}</div>
            <div class="swap-size">{{ asset.width }}×{{ asset.height }}</div>
          </div>
        </button>
      </div>
    </NModal>
  </div>
</template>

<style scoped src="./AutoMatchExportPanel.css"></style>
