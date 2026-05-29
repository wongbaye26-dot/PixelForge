import path from 'node:path'
import { processAndExport } from './image-processor.js'
import type { ExportFormat, FitMode } from '../src/types/index.js'

export interface ExportMatcherProcessorInput {
  inputPath: string
  outputDir: string
  width: number
  height: number
  format: ExportFormat
  fitMode: FitMode
  quality: number
  targetSizeKb?: number
  namingPattern: string
  index: number
}

export interface ExportMatcherProcessorOutput {
  outputPath: string
  outputName: string
}

export default async function runOne(
  input: ExportMatcherProcessorInput,
): Promise<ExportMatcherProcessorOutput> {
  const outputPath = await processAndExport({
    inputPath: input.inputPath,
    outputDir: input.outputDir,
    width: input.width,
    height: input.height,
    format: input.format,
    fitMode: input.fitMode,
    quality: input.quality,
    targetSizeKb: input.targetSizeKb,
    namingPattern: input.namingPattern,
    index: input.index,
  })
  return { outputPath, outputName: path.basename(outputPath) }
}

