import { useExportStore } from '@/stores/export'
import { useLibraryStore } from '@/stores/library'
import { useAssetScopeStore } from '@/stores/asset-scope'
import { useSmartExportSizeStore } from '@/modules/smart-export/stores/smart-export-size'
import { useExportMatcherStore } from '../stores/export-matcher'
import { useFeedback } from '@/composables/use-feedback'

export function useSmartExportRun() {
  const exportStore = useExportStore()
  const library = useLibraryStore()
  const assetScope = useAssetScopeStore()
  const matcher = useExportMatcherStore()
  const smartSizes = useSmartExportSizeStore()
  const feedback = useFeedback()

  async function runAutoMatchExport() {
    try {
      smartSizes.parseSizes()
      const sizes = smartSizes.activeSizes()
      if (!sizes.length) {
        feedback.warning('请先解析并勾选尺寸')
        return
      }
      if (!exportStore.outputDir.trim()) {
        feedback.warning('请先设置导出目录')
        return
      }

      const candidateAssetIds = matcher.autoPickBestImage ? undefined : [...library.selectedIds]
      if (!matcher.autoPickBestImage && (!candidateAssetIds || candidateAssetIds.length === 0)) {
        feedback.warning('请先在图库中选中候选图片（关闭「自动匹配最佳图片」时生效）')
        return
      }

      const scope = assetScope.currentScope
      const scopeType = scope.type === 'all' ? undefined : scope.type
      const scopeId = scope.id

      const result = await matcher.submit({
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
        scopeType,
        scopeId,
      })

      if (result.unmatchedSizes.length) {
        feedback.warning(
          `${result.unmatchedSizes.length} 个尺寸未找到匹配：${result.unmatchedSizes.map((s) => `${s.width}×${s.height}`).join('、')}`,
        )
      }
      feedback.success(`已开始自动匹配导出（${result.jobs.length} 项）`)
    } catch {
      feedback.error('智能导出启动失败，请稍后重试')
    }
  }

  return { runAutoMatchExport }
}
