export type OcrLang = 'chi_sim+eng' | 'eng' | 'chi_sim' | 'chi_tra'

export interface OcrJob {
  id: string
  batchId: string
  assetId: number
  status: 'queued' | 'running' | 'done' | 'error'
  progress: number
  text: string
  engine: string
  error?: string
}
