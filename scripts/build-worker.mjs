import * as esbuild from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('electron-dist', { recursive: true })

await esbuild.build({
  entryPoints: ['workers/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'electron-dist/server.cjs',
  external: ['sharp', 'better-sqlite3', 'piscina'],
  sourcemap: true,
})

await esbuild.build({
  entryPoints: ['workers/batch-processor.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'electron-dist/batch-processor.cjs',
  external: ['sharp'],
  sourcemap: true,
})

await esbuild.build({
  entryPoints: ['workers/compress-processor.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'electron-dist/compress-processor.cjs',
  external: ['sharp'],
  sourcemap: true,
})

await esbuild.build({
  entryPoints: ['workers/convert-processor.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'electron-dist/convert-processor.cjs',
  external: ['sharp'],
  sourcemap: true,
})

await esbuild.build({
  entryPoints: ['workers/edit-processor.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'electron-dist/edit-processor.cjs',
  external: ['sharp'],
  sourcemap: true,
})

await esbuild.build({
  entryPoints: ['workers/export-matcher-processor.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'electron-dist/export-matcher-processor.cjs',
  external: ['sharp'],
  sourcemap: true,
})

await esbuild.build({
  entryPoints: ['workers/ai-processor.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'electron-dist/ai-processor.cjs',
  external: ['sharp'],
  sourcemap: true,
})

await esbuild.build({
  entryPoints: ['workers/ocr-processor.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'electron-dist/ocr-processor.cjs',
  external: ['sharp', 'tesseract.js'],
  sourcemap: true,
})

console.log('Built electron-dist/server.cjs')
