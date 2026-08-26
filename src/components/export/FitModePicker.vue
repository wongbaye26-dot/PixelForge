<script setup lang="ts">
import type { FitMode } from '@/types'
import { featureFlags } from '@/featureFlags'
import StrategyOptionCard from '@/components/module/StrategyOptionCard.vue'

const model = defineModel<FitMode>({ required: true })

const modes: { value: FitMode; label: string; tag: string; desc: string }[] = [
  { value: 'cover', label: '裁切填满', tag: 'Cover', desc: '铺满目标区域，可能裁切' },
  { value: 'contain', label: '留白适配', tag: 'Contain', desc: '完整显示，保留留白' },
  { value: 'blur_extend', label: '模糊扩展', tag: 'Blur', desc: '模糊延伸填充边缘' },
  { value: 'gradient_fill', label: '渐变背景', tag: 'Grad', desc: '渐变填充留白区域' },
]

if (featureFlags.ENABLE_AI) {
  modes.push({ value: 'ai_outpaint', label: 'AI 扩图', tag: 'AI', desc: '智能向外扩展画面' })
}

function selectMode(value: FitMode, selected: boolean) {
  if (selected) model.value = value
}
</script>

<template>
  <div class="fit-section">
    <div class="fit-heading">
      <span class="fit-title">适配模式</span>
      <span class="fit-caption">为每个导出尺寸选择缩放策略</span>
    </div>
    <div class="fit-grid">
      <StrategyOptionCard
        v-for="m in modes"
        :key="m.value"
        compact
        behavior="select"
        :tag="m.tag"
        :title="m.label"
        :desc="m.desc"
        :model-value="model === m.value"
        @update:model-value="(on) => selectMode(m.value, on)"
      />
    </div>
  </div>
</template>

<style scoped>
.fit-section {
  display: flex;
  flex-direction: column;
  gap: var(--pf-gap-sm);
}
.fit-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fit-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--pf-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.fit-caption {
  font-size: 10px;
  color: var(--pf-text-secondary);
  line-height: 1.35;
}
.fit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 980px) {
  .fit-grid {
    grid-template-columns: 1fr;
  }
}
</style>
