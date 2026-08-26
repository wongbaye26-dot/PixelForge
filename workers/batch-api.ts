import type Database from 'better-sqlite3'
import { createModuleJobApi } from './module-job-api.js'

type BatchBody = {
  resize?: { width: number; height: number; fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside' }
  format?: 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'
  quality?: number
}

const batchApi = createModuleJobApi<BatchBody>({
  moduleName: 'batch',
  workerName: 'batch',
  apiPrefix: 'api/batch',
  defaultNamingPattern: '{name}_{op}.{format}',
  extraJobFields: (row, body) => {
    const fmt = (body.format ?? row.filename.replace(/.*\./, '')).toLowerCase() || 'webp'
    const opLabel = body.resize?.width && body.resize?.height ? `${body.resize.width}x${body.resize.height}` : 'copy'
    return { format: fmt, op: opLabel }
  },
  formatOutputName: (row, pattern, extra) => {
    const srcName = row.filename.replace(/\.[^.]+$/, '')
    const outExt = (extra.format as string) || 'webp'
    return pattern
      .replaceAll('{name}', srcName)
      .replaceAll('{op}', (extra.op as string) || 'copy')
      .replaceAll('{format}', outExt)
  },
  createRunPayload: (job, body) => ({
    inputPath: job.inputPath,
    outputPath: job.outputPath,
    resize: body.resize,
    format: body.format,
    quality: body.quality,
  }),
  handleRunResult: () => {},
  errorMessage: '批处理失败',
  submitErrorMessage: '批处理提交失败',
})

export async function handleBatchApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  return batchApi.handleApi(req, res, url, db)
}

export function pruneBatchJobs(): number {
  return batchApi.pruneJobs()
}
