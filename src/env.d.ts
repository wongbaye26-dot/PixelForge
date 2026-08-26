/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_WORKER_BASE?: string
  readonly VITE_APP_VERSION?: string
}

interface Window {
  pixelForge?: {
    pickFolder: () => Promise<string | null>
    openPath?: (targetPath: string) => Promise<{ ok: boolean; error?: string }>
    showItemInFolder?: (targetPath: string) => Promise<{ ok: boolean }>
    readUserSettings?: () => Promise<Record<string, unknown> | null>
    writeUserSettings?: (payload: Record<string, unknown>) => Promise<{ ok: boolean }>
    isElectron: boolean
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
