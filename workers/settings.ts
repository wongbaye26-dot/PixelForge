import type Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { getExportsDir } from './paths.js'

const EXPORT_DIR_KEY = 'export_dir'
const AI_SIDECAR_KEY = 'ai_sidecar_url'

export function getAiSidecarUrl(db: Database.Database): string | undefined {
  return getStoredSetting(db, AI_SIDECAR_KEY) || process.env.PIXELFORGE_AI_SIDECAR_URL
}

export function getStoredExportDir(db: Database.Database): string {
  return getStoredSetting(db, EXPORT_DIR_KEY) || getExportsDir()
}

export function setStoredExportDir(db: Database.Database, dir: string): void {
  setStoredSetting(db, EXPORT_DIR_KEY, dir)
  mkdirSync(dir, { recursive: true })
}

export function getStoredSetting(db: Database.Database, key: string): string | undefined {
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(key) as { value: string } | undefined
  return row?.value
}

export function setStoredSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value)
}
