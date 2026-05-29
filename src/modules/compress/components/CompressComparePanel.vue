<script setup lang="ts">
import { NEmpty, NProgress } from 'naive-ui'
import { computed } from 'vue'
import { resolveMediaUrl } from '@/utils/media-url'
import { useCompressStore } from '../stores/compress'

const compress = useCompressStore()

const beforeSrc = computed(() =>
  compress.activeItem ? resolveMediaUrl(`/api/assets/${compress.activeItem.id}/preview`) : undefined,
)

const afterSrc = computed(() => {
  const j = compress.activeJob
  if (!j?.previewName) return undefined
  return resolveMediaUrl(`/cache/thumbnails/${j.previewName}`)
})
</script>

<template>
  <div class="panel">
    <div class="head">
      <div class="title">压缩前后对比</div>
      <div class="sub">{{ compress.activeItem?.filename || '未选择图片' }}</div>
    </div>

    <div v-if="!compress.activeItem" class="empty">
      <NEmpty description="请在左侧选择图片" />
    </div>

    <div v-else class="body">
      <div class="compare">
        <div class="box">
          <div class="box-head">Before</div>
          <div class="img-wrap">
            <img v-if="beforeSrc" :src="beforeSrc" class="img" />
          </div>
          <div class="meta">
            <span>{{ compress.activeItem.width }}×{{ compress.activeItem.height }}</span>
            <span>{{ (compress.activeItem.size / 1024).toFixed(1) }} KB</span>
          </div>
        </div>

        <div class="box">
          <div class="box-head">After</div>
          <div class="img-wrap">
            <img v-if="afterSrc" :src="afterSrc" class="img" />
            <div v-else class="ph">未生成</div>
          </div>
          <div class="meta">
            <span>{{ compress.activeJob?.format?.toUpperCase?.() || '-' }}</span>
            <span v-if="compress.activeJob?.afterBytes">{{ (compress.activeJob.afterBytes / 1024).toFixed(1) }} KB</span>
            <span v-else>-</span>
          </div>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="k">节省</div>
          <div class="v">{{ compress.activeCompare?.savingPct == null ? '-' : `${compress.activeCompare.savingPct}%` }}</div>
        </div>
        <div class="stat">
          <div class="k">质量</div>
          <div class="v">{{ compress.activeJob?.finalQuality == null ? '-' : compress.activeJob.finalQuality }}</div>
        </div>
        <div class="stat prog">
          <div class="k">进度</div>
          <div class="v">
            <NProgress
              type="line"
              :percentage="compress.activeJob?.progress || 0"
              :show-indicator="false"
              :height="6"
              color="var(--pf-primary)"
              :rail-color="'#333'"
              style="width: 240px"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  height: 100%;
  background: var(--pf-bg-elevated);
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.head {
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.title {
  font-size: 13px;
  font-weight: 900;
  color: var(--pf-text);
}
.sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--pf-text-secondary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.compare {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
}
.box {
  background: var(--pf-bg);
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 700;
}
.meta {
  padding: 10px 12px;
  border-top: 1px solid var(--pf-border);
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--pf-text);
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.stat {
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  background: var(--pf-bg-elevated);
  padding: 10px 12px;
}
.k {
  font-size: 11px;
  color: var(--pf-text-secondary);
  font-weight: 800;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.v {
  font-size: 14px;
  color: var(--pf-text);
  font-weight: 900;
}
.prog .v {
  display: flex;
  align-items: center;
}
@media (max-width: 980px) {
  .compare {
    grid-template-columns: 1fr;
  }
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
