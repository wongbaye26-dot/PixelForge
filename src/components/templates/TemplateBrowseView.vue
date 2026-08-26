<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const title = computed(() => {
  switch (ui.libraryView) {
    case 'template_my':
      return '我的模板'
    case 'template_common':
      return '常用模板'
    case 'template_social':
      return '社交媒体模板'
    case 'template_ecommerce':
      return '电商模板'
    case 'template_custom':
      return '自定义模板'
    default:
      return '导出模板'
  }
})
</script>

<template>
  <div class="pf-page template-page">
    <div class="pf-card pf-card--elevated pf-card--section template-card">
      <div class="pf-empty-state__icon">📐</div>
      <h2 class="pf-empty-state__title">{{ title }}</h2>
      <p class="pf-empty-state__desc">
        在右侧选择模板并点击「应用尺寸」，尺寸将自动填入导出面板。应用后可从侧栏返回「全部照片」继续选图导出。
      </p>
    </div>
  </div>
</template>

<style scoped>
.template-page {
  place-items: center;
  align-content: center;
}
.template-card {
  max-width: 440px;
  text-align: center;
  padding: var(--pf-gap-2xl) var(--pf-gap-xl);
}
</style>
