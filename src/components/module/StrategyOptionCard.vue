<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    desc?: string
    tag: string
    compact?: boolean
    behavior?: 'toggle' | 'select'
  }>(),
  {
    desc: '',
    compact: false,
    behavior: 'toggle',
  },
)

const active = defineModel<boolean>({ required: true })

function onClick() {
  if (props.behavior === 'select') {
    if (!active.value) active.value = true
    return
  }
  active.value = !active.value
}
</script>

<template>
  <button
    type="button"
    class="strategy-card"
    :class="{ active, compact }"
    @click="onClick()"
  >
    <span class="strategy-mark" aria-hidden="true">
      <svg v-if="active" viewBox="0 0 12 12" class="strategy-check">
        <path
          d="M2 6.2 4.8 9 10 3"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span class="strategy-tag">{{ tag }}</span>
    <span class="strategy-body">
      <span class="strategy-title">{{ title }}</span>
      <span v-if="desc" class="strategy-desc">{{ desc }}</span>
    </span>
  </button>
</template>

<style scoped>
.strategy-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-height: 84px;
  padding: 10px 10px 11px;
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 88%, transparent);
  border-radius: var(--pf-radius-md);
  background: var(--pf-bg);
  cursor: pointer;
  text-align: left;
  transition:
    border-color var(--pf-transition-fast) var(--pf-ease-standard),
    background-color var(--pf-transition-fast) var(--pf-ease-standard),
    box-shadow var(--pf-transition-fast) var(--pf-ease-standard);
}
.strategy-card.compact {
  min-height: 68px;
  gap: 6px;
  padding: 9px 9px 10px;
}
.strategy-card:hover {
  border-color: color-mix(in srgb, var(--pf-primary) 22%, var(--pf-border-color));
  background: var(--pf-bg-hover);
}
.strategy-card.active {
  border-color: color-mix(in srgb, var(--pf-primary) 38%, var(--pf-border-color));
  background: color-mix(in srgb, var(--pf-primary-soft) 42%, var(--pf-bg));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--pf-primary) 12%, transparent);
}
.strategy-mark {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1.5px solid color-mix(in srgb, var(--pf-border-color) 90%, transparent);
  background: color-mix(in srgb, var(--pf-bg) 92%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition:
    border-color var(--pf-transition-fast) var(--pf-ease-standard),
    background-color var(--pf-transition-fast) var(--pf-ease-standard);
}
.strategy-card.compact .strategy-mark {
  top: 7px;
  right: 7px;
  width: 16px;
  height: 16px;
}
.strategy-card.active .strategy-mark {
  border-color: var(--pf-primary);
  background: var(--pf-primary);
}
.strategy-check {
  width: 11px;
  height: 11px;
}
.strategy-card.compact .strategy-check {
  width: 10px;
  height: 10px;
}
.strategy-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: var(--pf-radius-pill);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--pf-primary);
  background: color-mix(in srgb, var(--pf-primary-soft) 72%, var(--pf-bg));
  border: 1px solid color-mix(in srgb, var(--pf-primary) 16%, transparent);
}
.strategy-card.compact .strategy-tag {
  height: 18px;
  font-size: 9px;
}
.strategy-card.active .strategy-tag {
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-primary-soft) 90%, var(--pf-bg));
}
.strategy-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 22px;
  min-width: 0;
}
.strategy-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--pf-text);
  line-height: 1.3;
}
.strategy-card.compact .strategy-title {
  font-size: 11px;
}
.strategy-desc {
  font-size: 10px;
  font-weight: 600;
  color: var(--pf-text-secondary);
  line-height: 1.4;
}
.strategy-card.compact .strategy-desc {
  font-size: 9px;
}
</style>
