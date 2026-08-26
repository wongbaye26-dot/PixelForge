import type Database from 'better-sqlite3'
import { createModuleJobApi } from './module-job-api.js'

type ConvertBody = {
  targetFormat?: 'png' | 'webp' | 'avif' | 'jpg' | 'jpeg'
  quality?: number
  keepExif?: boolean
}

const convertApi = createModuleJobApi<ConvertBody>({
  moduleName: 'convert',
  workerName: 'convert',
  apiPrefix: 'api/convert',
  defaultNamingPattern: '{name}.{format}',
  extraJobFields: () => ({}),
  formatOutputName: (row, pattern, extra) => {
    const safeName = row.filename.replace(/\.[^.]+$/, '').replace(/[\\/:"*?<>|]+/g, '_')
    const targetFormat = (extra.targetFormat as string) || 'webp'
    return pattern
      .replaceAll('{name}', safeName)
      .replaceAll('{format}', targetFormat === 'jpeg' ? 'jpg' : targetFormat)
  },
  createRunPayload: (job, body) => ({
    inputPath: job.inputPath,
    outputPath: job.outputPath,
    targetFormat: body.targetFormat ?? 'webp',
    quality: body.quality ?? 90,
    keepExif: Boolean(body.keepExif),
  }),
  handleRunResult: (job, result) => {
    const r = result as { bytes: number; format: string }
    job.bytes = r.bytes
    job.format = r.format
  },
  errorMessage: '转换失败',
  submitErrorMessage: '转换提交失败',
})

export async function handleConvertApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  return convertApi.handleApi(req, res, url, db)
}

export function pruneConvertJobs(): number {
  return convertApi.pruneJobs()
}
