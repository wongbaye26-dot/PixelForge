import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

/** 开发：项目根目录；打包：Electron userData（由 electron/main.cjs 注入） */
export function getAppRoot(): string {
  if (process.env.PIXELFORGE_ROOT) return process.env.PIXELFORGE_ROOT
  return process.cwd()
}

export function getDatabaseDir(): string {
  const dir = path.join(getAppRoot(), 'database')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getCacheDir(): string {
  const dir = path.join(getAppRoot(), 'cache', 'thumbnails')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getExportsDir(): string {
  const dir = path.join(getAppRoot(), 'exports')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}
