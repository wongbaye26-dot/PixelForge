<script setup lang="ts">
import { assetDisplayUrl } from '@/utils/media-url'
import type { ModuleAssetItem } from './types'

defineProps<{
  asset: ModuleAssetItem
  selected?: boolean
  active?: boolean
}>()
</script>

<template>
  <button type="button" class="card" :class="{ selected, active }">
    <div class="thumb-frame pf-compare-canvas">
      <img
        v-if="asset.thumbnailUrl || asset.previewUrl"
        :src="assetDisplayUrl(asset)"
        alt=""
        class="thumb"
        loading="lazy"
        draggable="false"
      />
      <div v-else class="thumb ph" />
      <div v-if="selected" class="check">✓</div>
    </div>
    <div class="meta">
      <div class="name" :title="asset.filename">{{ asset.filename }}</div>
      <div class="sub">
        <span>{{ asset.width }}×{{ asset.height }}</span>
        <span>{{ asset.format.toUpperCase() }}</span>
      </div>
    </div>
  </button>
</template>

<style scoped>
.card {
  border: var(--pf-border-width) solid color-mix(in srgb, var(--pf-border-color) 82%, transparent);
  border-radius: var(--pf-radius-md);
  overflow: hidden;
  background: color-mix(in srgb, var(--pf-bg) 96%, transparent);
  cursor: pointer;
  text-align: left;
  padding: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  height: auto;
  transition:
    border-color var(--pf-transition-fast) var(--pf-ease-standard),
    box-shadow var(--pf-transition-fast) var(--pf-ease-standard);
}
.card:hover {
  border-color: color-mix(in srgb, var(--pf-primary) 24%, transparent);
}
.card.selected,
.card.active {
  border-color: color-mix(in srgb, var(--pf-primary) 42%, transparent);
  box-shadow: var(--pf-shadow-glow);
}
.thumb-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  flex-shrink: 0;
  overflow: hidden;
}
.thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
  pointer-events: none;
}
.thumb.ph {
  position: relative;
  inset: auto;
  width: 48px;
  height: 32px;
  margin: auto;
  border-radius: 6px;
  background: var(--pf-bg-hover);
}
.check {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 11px;
}
.meta {
  flex-shrink: 0;
  padding: 8px 10px 10px;
}
.name {
  font-size: 11px;
  font-weight: 800;
  color: var(--pf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  margin-top: 4px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 10px;
  color: var(--pf-text-secondary);
  font-weight: 600;
}
</style>
