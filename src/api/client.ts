import type { ExportFormat, FitMode, ImageAsset, LibraryFolder } from '@/types'
import type { MatchScore, MatchDebugCandidate } from '@/core/match-scoring'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export type ExportTaskApiStatus =
  | 'pending'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ExportTaskApiJob {
  id: string
  batchId: string
  assetId: number
  filename: string
  thumbnailUrl?: string
  targetWidth: number
  targetHeight: number
  format: ExportFormat
  progress: number
  status: ExportTaskApiStatus
  outputPath?: string
  error?: string
}

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

export interface AutoMatchJob {
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
  matchScore?: MatchScore
  debugCandidates?: MatchDebugCandidate[]
  status: string
  progress: number
  outputPath?: string
  previewName?: string
  error?: string
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  systemMetrics: () =>
    request<{ cpuPercent: number; memUsedBytes: number; memTotalBytes: number }>('/system/metrics'),

  systemDisk: () => request<{ totalBytes: number; availableBytes: number; usedBytes: number }>('/system/disk'),

  listAssets: (filters?: {
    q?: string
    favorite?: boolean
    recent?: boolean
    folderId?: number
    format?: string
    ratio?: number
    width?: number
    height?: number
    duplicate?: boolean
    trash?: boolean
    limit?: number
  }) => {
    const params = new URLSearchParams()
    if (filters?.q) params.set('q', filters.q)
    if (filters?.favorite) params.set('favorite', '1')
    if (filters?.recent) params.set('recent', '1')
    if (filters?.folderId) params.set('folderId', String(filters.folderId))
    if (filters?.format) params.set('format', filters.format)
    if (filters?.ratio) params.set('ratio', String(filters.ratio))
    if (filters?.width) params.set('width', String(filters.width))
    if (filters?.height) params.set('height', String(filters.height))
    if (filters?.duplicate) params.set('duplicate', '1')
    if (filters?.trash) params.set('trash', '1')
    if (filters?.limit) params.set('limit', String(filters.limit))
    const qs = params.toString()
    return request<{ assets: ImageAsset[] }>(`/assets${qs ? `?${qs}` : ''}`)
  },

  assetMetadata: (assetId: number) =>
    request<{
      exif: {
        make?: string
        model?: string
        lens?: string
        dateTime?: string
        exposureTime?: string
        fNumber?: string
        iso?: number
        focalLength?: string
        gps?: string
        orientation?: number
        software?: string
      }
      hasExif: boolean
      colorSpace?: string
      density?: number
      hasProfile?: boolean
    }>(`/assets/${assetId}/metadata`),

  listFolders: () => request<{ folders: LibraryFolder[] }>('/folders'),

  removeFolder: (id: number) =>
    request<{ removed: boolean; assetsMoved: number; foldersRemoved: number; path: string; label: string }>(
      '/folders/remove',
      {
        method: 'POST',
        body: JSON.stringify({ id }),
      },
    ),

  scanFolder: (folderPath: string, label?: string) =>
    request<{ added: number; updated: number; restored?: number }>('/scan', {
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

  exportBatchSubmit: (payload: {
    assetIds: number[]
    sizes: Array<{ width: number; height: number }>
    formats: ExportFormat[]
    fitMode: FitMode
    quality: number
    targetSizeKb?: number
    namingPattern: string
    outputDir?: string
    mozjpeg?: boolean
    usePngquant?: boolean
  }) =>
    request<{
      batchId: string
      total: number
      jobs: ExportTaskApiJob[]
    }>('/export/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  exportBatchJobs: (params: { batchId?: string; ids?: string[] }) => {
    const sp = new URLSearchParams()
    if (params.batchId) sp.set('batchId', params.batchId)
    if (params.ids?.length) sp.set('ids', params.ids.join(','))
    const qs = sp.toString()
    return request<{ jobs: ExportTaskApiJob[] }>(`/export/jobs${qs ? `?${qs}` : ''}`)
  },

  exportBatchControl: (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') =>
    request<{ job: ExportTaskApiJob }>(`/export/jobs/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
    }),

  getExportDir: () =>
    request<{ path: string; defaultPath: string }>('/settings/export-dir'),

  setExportDir: (dirPath: string) =>
    request<{ path: string }>('/settings/export-dir', {
      method: 'POST',
      body: JSON.stringify({ path: dirPath }),
    }),

  trashMove: (ids: number[]) =>
    request<{ moved: number }>('/trash/move', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  trashRestore: (ids: number[]) =>
    request<{ restored: number }>('/trash/restore', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  trashDelete: (ids: number[]) =>
    request<{ deleted: number }>('/trash/delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  trashEmpty: () =>
    request<{ deleted: number }>('/trash/empty', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  trashCount: () => request<{ count: number }>('/trash/count'),

  listTemplates: (category?: string) => {
    const qs = category ? `?category=${encodeURIComponent(category)}` : ''
    return request<{
      templates: Array<{
        id: number
        name: string
        category: string
        sizes: Array<{ width: number; height: number; label?: string }>
        formats: string[]
        builtin: boolean
        createdAt?: string
      }>
    }>(`/templates${qs}`)
  },

  createTemplate: (payload: {
    name: string
    category?: string
    sizes: Array<{ width: number; height: number }>
    formats?: string[]
  }) =>
    request<{ template: { id: number; name: string; category: string; sizes: Array<{ width: number; height: number }> } }>(
      '/templates',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  deleteTemplate: (id: number) =>
    request<{ ok: boolean }>(`/templates/${id}`, {
      method: 'DELETE',
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

  batchCancel: (payload: { batchId: string; jobId?: string }) =>
    request<{ jobs: Array<{ id: string; status: string; progress: number; error?: string; outputPath: string; assetId: number; batchId: string }> }>(
      '/batch/cancel',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  batchRetry: (payload: { batchId: string; jobId: string }) =>
    request<{ job: { id: string; status: string; progress: number; error?: string; outputPath: string; assetId: number; batchId: string } }>(
      '/batch/retry',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

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

  compressCancel: (payload: { batchId: string; jobId?: string }) =>
    request<{ jobs: Array<Record<string, unknown>> }>('/compress/cancel', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  compressRetry: (payload: { batchId: string; jobId: string }) =>
    request<{ job: Record<string, unknown> }>('/compress/retry', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

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

  convertCancel: (payload: { batchId: string; jobId?: string }) =>
    request<{ jobs: Array<Record<string, unknown>> }>('/convert/cancel', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  convertRetry: (payload: { batchId: string; jobId: string }) =>
    request<{ job: Record<string, unknown> }>('/convert/retry', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

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

  editExport: (payload: {
    assetIds: number[]
    params?: {
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
    outputDir?: string
  }) =>
    request<{
      outputDir: string
      results: Array<{
        assetId: number
        outputPath: string
        bytes: number
        success: boolean
        error?: string
      }>
    }>('/edit/export', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  aiStatus: () =>
    request<{
      workerReady: boolean
      sidecar: { ok: boolean; url: string }
      fallback: string
    }>('/ai/status'),

  getAiSidecarUrl: () => request<{ url: string | null }>('/settings/ai-sidecar'),

  setAiSidecarUrl: (url: string | null) =>
    request<{ url: string | null }>('/settings/ai-sidecar', {
      method: 'POST',
      body: JSON.stringify({ url: url ?? '' }),
    }),

  aiPreview: (payload: { assetId: number; width: number; height: number }) =>
    request<{ previewName: string; bytes: number; engine?: string; error?: string }>('/ai/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  aiExport: (payload: {
    assetIds: number[]
    width: number
    height: number
    outputDir?: string
    sidecarUrl?: string
  }) =>
    request<{
      outputDir: string
      results: Array<{
        assetId: number
        outputPath: string
        bytes: number
        engine: string
        success: boolean
        error?: string
      }>
    }>('/ai/export', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  ocrScan: (payload: { assetIds: number[]; lang?: string }) =>
    request<{ batchId: string; total: number; jobIds: string[] }>('/ocr/scan', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  ocrStatus: () =>
    request<{
      workerReady: boolean
      cliAvailable: boolean
      engine: 'tesseract-cli' | 'tesseract.js'
    }>('/ocr/status'),

  ocrJobs: (batchId: string) => {
    const qs = new URLSearchParams({ batchId }).toString()
    return request<{
      jobs: Array<{
        id: string
        batchId: string
        assetId: number
        status: string
        progress: number
        text: string
        engine: string
        error?: string
      }>
    }>(`/ocr/jobs?${qs}`)
  },

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
    scopeType?: 'all' | 'folder' | 'favorite' | 'recent'
    scopeId?: number
  }) =>
    request<{
      batchId: string
      jobs: AutoMatchJob[]
      unmatchedSizes: Array<{ width: number; height: number }>
    }>('/auto-match/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  autoMatchJobs: (batchId: string) => {
    const qs = new URLSearchParams({ batchId }).toString()
    return request<{
      jobs: AutoMatchJob[]
    }>(
      `/auto-match/jobs?${qs}`,
    )
  },

  autoMatchPreview: (payload: { assetId: number; targetWidth: number; targetHeight: number; mode: FitMode }) =>
    request<{ previewName: string }>('/auto-match/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  autoMatchCancel: (payload: { batchId: string; jobId?: string }) =>
    request<{ jobs: Array<Record<string, unknown>> }>('/auto-match/cancel', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  autoMatchRetry: (payload: { batchId: string; jobId: string }) =>
    request<{ job: Record<string, unknown> }>('/auto-match/retry', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  autoMatchSwap: (payload: {
    batchId: string
    jobId: string
    assetId: number
    autoRecommendMode?: boolean
    autoBackgroundOptimize?: boolean
  }) =>
    request<{ job: Record<string, unknown> }>('/auto-match/swap', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
