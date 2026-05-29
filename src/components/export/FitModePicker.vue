<script setup lang="ts">
import type { FitMode } from '@/types'

const model = defineModel<FitMode>({ required: true })

const modes: { value: FitMode; label: string; icon: string }[] = [
  { value: 'cover', label: '裁切填满', icon: '▣' },
  { value: 'contain', label: '留白适配', icon: '□' },
  { value: 'blur_extend', label: '模糊扩展', icon: '◎' },
  { value: 'gradient_fill', label: '渐变背景', icon: '◐' },
  { value: 'ai_outpaint', label: 'AI 扩图', icon: '✦' },
]
</script>

<template>
  <div class="fit-grid">
    <button
      v-for="m in modes"
      :key="m.value"
      type="button"
      class="fit-card"
      :class="{ active: model === m.value, disabled: m.value === 'ai_outpaint' }"
      :disabled="m.value === 'ai_outpaint'"
      @click="model = m.value"
    >
      <span class="fit-icon">{{ m.icon }}</span>
      <span class="fit-label">{{ m.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.fit-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.fit-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  border: 1px solid var(--pf-border);
  border-radius: 8px;
  background: var(--pf-bg);
  color: var(--pf-text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.fit-card:hover:not(.disabled) {
  border-color: #555;
  color: var(--pf-text);
}
.fit-card.active {
  border-color: var(--pf-primary);
  background: rgba(0, 122, 255, 0.12);
  color: var(--pf-primary);
}
.fit-card.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.fit-icon {
  font-size: 20px;
  line-height: 1;
}
.fit-label {
  font-size: 10px;
  text-align: center;
}
</style>
