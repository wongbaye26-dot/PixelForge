/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_WORKER_BASE?: string
}

interface Window {
  pixelForge?: {
    pickFolder: () => Promise<string | null>
    isElectron: boolean
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
