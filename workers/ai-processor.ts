import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { runOutpaint } from './ai-outpaint.js'

export interface AiProcessorInput {
  inputPath: string
  outputPath: string
  width: number
  height: number
  sidecarUrl?: string
}

export interface AiProcessorOutput {
  outputPath: string
  bytes: number
  engine: 'sidecar' | 'local_blur'
  width: number
  height: number
}

export default async function aiOutpaintOne(input: AiProcessorInput): Promise<AiProcessorOutput> {
  const outDir = path.dirname(input.outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const result = await runOutpaint({
    inputPath: input.inputPath,
    outputPath: input.outputPath,
    width: input.width,
    height: input.height,
    sidecarUrl: input.sidecarUrl,
  })

  const st = statSync(result.outputPath)
  return {
    outputPath: result.outputPath,
    bytes: st.size,
    engine: result.engine,
    width: input.width,
    height: input.height,
  }
}
