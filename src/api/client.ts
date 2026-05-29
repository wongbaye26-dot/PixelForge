import type { ExportFormat, FitMode, ImageAsset, LibraryFolder } from '@/types'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  listAssets: (filters?: {
    q?: string
    favorite?: boolean
    folderId?: number
    format?: string
    ratio?: number
    width?: number
    height?: number
    duplicate?: boolean
    limit?: number
  }) => {
    const params = new URLSearchParams()
    if (filters?.q) params.set('q', filters.q)
    if (filters?.favorite) params.set('favorite', '1')
    if (filters?.folderId) params.set('folderId', String(filters.folderId))
    if (filters?.format) params.set('format', filters.format)
    if (filters?.ratio) params.set('ratio', String(filters.ratio))
    if (filters?.width) params.set('width', String(filters.width))
    if (filters?.height) params.set('height', String(filters.height))
    if (filters?.duplicate) params.set('duplicate', '1')
    if (filters?.limit) params.set('limit', String(filters.limit))
    const qs = params.toString()
    return request<{ assets: ImageAsset[] }>(`/assets${qs ? `?${qs}` : ''}`)
  },

  listFolders: () => request<{ folders: LibraryFolder[] }>('/folders'),

  scanFolder: (folderPath: string, label?: string) =>
    request<{ added: number; updated: number }>('/scan', {
      method: 'POST',
      body: JSON.stringify({ path: folderPath, label }),
    }),

  scanFiles: (paths: string[]) =>
    request<{ added: number; updated: number }>('/scan-files', {
      method: 'POST',
      body: JSON.stringify({ paths }),
    }),

  toggleFavorite: (id: number, favorite: boolean) =>
    request<{ ok: boolean }>('/favorite', {
      method: 'POST',
      body: JSON.stringify({ id, favorite }),
    }),

  exportBatch: (payload: {
    assetIds: number[]
    sizes: Array<{ width: number; height: number }>
    formats: ExportFormat[]
    fitMode: FitMode
    quality: number
    targetSizeKb?: number
    namingPattern: string
    outputDir?: string
  }) =>
    request<{
      total: number
      completed: number
      failed: number
      results: Array<{ job: unknown; outputPath?: string; error?: string }>
    }>('/export', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getExportDir: () =>
    request<{ path: string; defaultPath: string }>('/settings/export-dir'),

  setExportDir: (dirPath: string) =>
    request<{ path: string }>('/settings/export-dir', {
      method: 'POST',
      body: JSON.stringify({ path: dirPath }),
    }),

  getSetting: (key: string) =>
    request<{ key: string; value: string | null }>(`/settings/${key}`),

  setSetting: (key: string, value: string) =>
    request<{ key: string; value: string }>(`/settings/${key}`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    }),

  batchSubmit: (payload: {
    assetIds: number[]
    resize?: { width: number; height: number; fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside' }
    format?: 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'
    quality?: number
    outputDir?: string
    namingPattern?: string
  }) =>
    request<{ batchId: string; total: number; jobIds: string[] }>('/batch/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  batchJobs: (params: { batchId?: string; ids?: string[] }) => {
    const sp = new URLSearchParams()
    if (params.batchId) sp.set('batchId', params.batchId)
    if (params.ids?.length) sp.set('ids', params.ids.join(','))
    const qs = sp.toString()
    return request<{ jobs: Array<{ id: string; status: string; progress: number; error?: string; outputPath: string; assetId: number; batchId: string }> }>(
      `/batch/jobs${qs ? `?${qs}` : ''}`,
    )
  },

  compressSubmit: (payload: {
    assetIds: number[]
    outputFormat?: 'auto' | 'original' | 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif'
    quality: number
    targetSizeKb?: number
    mozjpeg?: boolean
    usePngquant?: boolean
    outputDir?: string
    namingPattern?: string
  }) =>
    request<{ batchId: string; total: number; jobIds: string[] }>('/compress/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  compressJobs: (params: { batchId?: string; ids?: string[] }) => {
    const sp = new URLSearchParams()
    if (params.batchId) sp.set('batchId', params.batchId)
    if (params.ids?.length) sp.set('ids', params.ids.join(','))
    const qs = sp.toString()
    return request<{
      jobs: Array<{
        id: string
        batchId: string
        assetId: number
        status: string
        progress: number
        beforeBytes: number
        afterBytes: number
        finalQuality?: number
        format: string
        previewName?: string
        outputPath: string
        error?: string
      }>
    }>(`/compress/jobs${qs ? `?${qs}` : ''}`)
  },

  convertSubmit: (payload: {
    assetIds: number[]
    targetFormat?: 'png' | 'webp' | 'avif' | 'jpg' | 'jpeg'
    quality?: number
    keepExif?: boolean
    outputDir?: string
    namingPattern?: string
  }) =>
    request<{ batchId: string; total: number; jobIds: string[] }>('/convert/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  convertJobs: (params: { batchId?: string; ids?: string[] }) => {
    const sp = new URLSearchParams()
    if (params.batchId) sp.set('batchId', params.batchId)
    if (params.ids?.length) sp.set('ids', params.ids.join(','))
    const qs = sp.toString()
    return request<{
      jobs: Array<{
        id: string
        batchId: string
        assetId: number
        status: string
        progress: number
        bytes?: number
        format?: string
        outputPath: string
        error?: string
      }>
    }>(`/convert/jobs${qs ? `?${qs}` : ''}`)
  },

  editPreview: (payload: {
    assetId: number
    params: {
      maxSize?: number
      transparentBackground?: boolean
      backgroundColor?: string
      cornerRadius?: number
      circleCrop?: boolean
      strokeWidth?: number
      strokeColor?: string
      shadowEnabled?: boolean
      shadowBlur?: number
      shadowOffsetX?: number
      shadowOffsetY?: number
      shadowColor?: string
    }
  }) =>
    request<{ previewName: string; bytes: number; width?: number; height?: number }>('/edit/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  autoMatchSubmit: (payload: {
    sizes: Array<{ width: number; height: number }>
    outputDir?: string
    format?: ExportFormat
    quality?: number
    targetSizeKb?: number
    namingPattern?: string
    autoRecommendMode?: boolean
    autoCompressOptimize?: boolean
    autoBackgroundOptimize?: boolean
    candidateAssetIds?: number[]
    avoidUpscale?: boolean
    preferSlightDownscale?: boolean
    avoidOversize?: boolean
    highQualityFirst?: boolean
    debugMode?: boolean
  }) =>
    request<{
      batchId: string
      jobs: Array<{
        id: string
        batchId: string
        targetWidth: number
        targetHeight: number
        targetRatio: number
        imageId: number
        imageFilename: string
        imageRatio: number
        similarity: number
        recommendedMode: FitMode
        matchScore?: {
          ratioScore: number
          sizeScore: number
          upscalePenalty: number
          oversizePenalty: number
          finalScore: number
        }
        debugCandidates?: Array<{
          imageId: number
          width: number
          height: number
          ratio: number
          area: number
          score: {
            ratioScore: number
            sizeScore: number
            upscalePenalty: number
            oversizePenalty: number
            finalScore: number
          }
        }>
        status: string
        progress: number
        outputPath?: string
        previewName?: string
        error?: string
      }>
    }>('/auto-match/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  autoMatchJobs: (batchId: string) => {
    const qs = new URLSearchParams({ batchId }).toString()
    return request<{
      jobs: Array<{
        id: string
        batchId: string
        targetWidth: number
        targetHeight: number
        targetRatio: number
        imageId: number
        imageFilename: string
        imageRatio: number
        similarity: number
        recommendedMode: FitMode
        matchScore?: {
          ratioScore: number
          sizeScore: number
          upscalePenalty: number
          oversizePenalty: number
          finalScore: number
        }
        debugCandidates?: Array<{
          imageId: number
          width: number
          height: number
          ratio: number
          area: number
          score: {
            ratioScore: number
            sizeScore: number
            upscalePenalty: number
            oversizePenalty: number
            finalScore: number
          }
        }>
        status: string
        progress: number
        outputPath?: string
        previewName?: string
        error?: string
      }>
    }>(
      `/auto-match/jobs?${qs}`,
    )
  },

  autoMatchPreview: (payload: { assetId: number; targetWidth: number; targetHeight: number; mode: FitMode }) =>
    request<{ previewName: string }>('/auto-match/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
