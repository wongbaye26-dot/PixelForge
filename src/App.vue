<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { NConfigProvider, darkTheme, NMessageProvider, NDialogProvider } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const themeOverrides = computed<GlobalThemeOverrides>(() => {
  const isDark = ui.isDark
  return {
    common: {
      primaryColor: '#007AFF',
      primaryColorHover: '#0066DD',
      primaryColorPressed: '#0055BB',
      bodyColor: isDark ? '#1a1a1a' : '#ffffff',
      cardColor: isDark ? '#242424' : '#f8f8f9',
      modalColor: isDark ? '#242424' : '#ffffff',
      popoverColor: isDark ? '#2c2c2c' : '#ffffff',
      borderColor: isDark ? '#333333' : '#e0e0e2',
      dividerColor: isDark ? '#333333' : '#e0e0e2',
      hoverColor: isDark ? '#2c2c2c' : '#ececed',
      textColor1: isDark ? '#f5f5f7' : '#1d1d1f',
      textColor2: isDark ? '#98989d' : '#515154',
      borderRadius: '6px',
      fontSize: '13px',
    },
    Button: {
      borderRadiusMedium: '6px',
      textColorGhostHover: '#007AFF',
      textColorTextHover: '#007AFF',
    },
    Input: {
      color: isDark ? '#2c2c2c' : '#ffffff',
      colorFocus: isDark ? '#2c2c2c' : '#ffffff',
      textColor: isDark ? '#f5f5f7' : '#1d1d1f',
      border: `1px solid ${isDark ? '#333333' : '#e0e0e2'}`,
    },
    Card: {
      color: isDark ? '#242424' : '#ffffff',
      borderColor: isDark ? '#333333' : '#e0e0e2',
    },
    Slider: {
      railColor: isDark ? '#333333' : '#e5e5ea',
      railColorHover: isDark ? '#444444' : '#d1d1d6',
      fillColor: '#007AFF',
      fillColorHover: '#0066DD',
      handleColor: '#ffffff',
      handleBoxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    },
    Tabs: {
      tabTextColorActiveLine: '#007AFF',
      barColor: '#007AFF',
      tabTextColorLine: isDark ? '#98989d' : '#515154',
    },
    Checkbox: {
      colorChecked: '#007AFF',
      borderChecked: '1px solid #007AFF',
    },
  }
})

watchEffect(() => {
  document.documentElement.setAttribute('data-theme', ui.isDark ? 'dark' : 'light')
})
</script>

<template>
  <NConfigProvider
    :theme="ui.isDark ? darkTheme : null"
    :theme-overrides="themeOverrides"
  >
    <NMessageProvider>
      <NDialogProvider>
        <AppLayout />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
