import path from 'node:path'
import type Database from 'better-sqlite3'
import { CACHE_DIR } from './thumbnail.js'
import { createModuleJobApi } from './module-job-api.js'

type CompressBody = {
  outputFormat?: 'auto' | 'original' | 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif'
  quality?: number
  targetSizeKb?: number
  mozjpeg?: boolean
  usePngquant?: boolean
}

const compressApi = createModuleJobApi<CompressBody>({
  moduleName: 'compress',
  workerName: 'compress',
  apiPrefix: 'api/compress',
  defaultNamingPattern: '{name}_compressed.{format}',
  extraJobFields: (row, body) => {
    const outputFormat = body.outputFormat ?? 'auto'
    const extFromFmt = outputFormat === 'original' ? path.extname(row.filename).slice(1) : outputFormat
    const fmt = (extFromFmt && extFromFmt !== 'auto' ? String(extFromFmt) : 'webp').toLowerCase()
    return { beforeBytes: 0, afterBytes: 0, format: fmt }
  },
  formatOutputName: (row, pattern, extra) => {
    const safeName = row.filename.replace(/\.[^.]+$/, '').replace(/[\\/:"*?<>|]+/g, '_')
    const outExt = (extra.format as string) || 'webp'
    return pattern
      .replaceAll('{name}', safeName)
      .replaceAll('{format}', outExt === 'jpeg' ? 'jpg' : outExt)
  },
  createRunPayload: (job, body) => ({
    inputPath: job.inputPath,
    outputPath: job.outputPath,
    previewPath: path.join(CACHE_DIR, `compress_${job.id}.webp`),
    outputFormat: body.outputFormat ?? 'auto',
    quality: body.quality ?? 85,
    targetSizeKb: body.targetSizeKb,
    mozjpeg: body.mozjpeg,
    usePngquant: body.usePngquant,
  }),
  handleRunResult: (job, result) => {
    const r = result as { beforeBytes: number; afterBytes: number; finalQuality?: number; format: string }
    job.beforeBytes = r.beforeBytes
    job.afterBytes = r.afterBytes
    job.finalQuality = r.finalQuality
    job.format = r.format
  },
  errorMessage: '压缩失败',
  submitErrorMessage: '压缩提交失败',
})

export async function handleCompressApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  return compressApi.handleApi(req, res, url, db)
}

export function pruneCompressJobs(): number {
  return compressApi.pruneJobs()
}
