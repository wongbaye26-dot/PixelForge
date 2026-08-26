import type Database from 'better-sqlite3'
import { EXPORT_SIZE_TEMPLATES } from '../src/data/export-size-presets.js'

export type TemplateCategory = 'my' | 'common' | 'social' | 'ecommerce' | 'custom'

export interface ExportTemplateSize {
  width: number
  height: number
  label?: string
}

export interface ExportTemplateRow {
  id: number
  name: string
  category: TemplateCategory
  sizes: ExportTemplateSize[]
  formats: string[]
  builtin: boolean
  createdAt?: string
}

const BUILTIN = EXPORT_SIZE_TEMPLATES.map((t) => ({
  name: t.name,
  category: t.category,
  sizes: t.sizes.map((s) => ({ width: s.width, height: s.height, label: s.label })),
  formats: t.formats,
}))

export function seedExportTemplates(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS export_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      sizes_json TEXT NOT NULL,
      formats_json TEXT NOT NULL DEFAULT '[]',
      builtin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_export_templates_category ON export_templates(category);
  `)

  syncBuiltinExportTemplates(db)
}

export function syncBuiltinExportTemplates(db: Database.Database) {
  const find = db.prepare(
    `SELECT id FROM export_templates WHERE builtin = 1 AND category = ? AND name = ? LIMIT 1`,
  )
  const update = db.prepare(
    `UPDATE export_templates SET sizes_json = ?, formats_json = ? WHERE id = ?`,
  )
  const insert = db.prepare(
    `INSERT INTO export_templates (name, category, sizes_json, formats_json, builtin) VALUES (?, ?, ?, ?, 1)`,
  )

  const validKeys = new Set(BUILTIN.map((t) => `${t.category}:${t.name}`))

  for (const t of BUILTIN) {
    const row = find.get(t.category, t.name) as { id: number } | undefined
    const sizesJson = JSON.stringify(t.sizes)
    const formatsJson = JSON.stringify(t.formats)
    if (row) {
      update.run(sizesJson, formatsJson, row.id)
    } else {
      insert.run(t.name, t.category, sizesJson, formatsJson)
    }
  }

  const staleRows = db
    .prepare(`SELECT id, name, category FROM export_templates WHERE builtin = 1`)
    .all() as Array<{ id: number; name: string; category: string }>
  const remove = db.prepare(`DELETE FROM export_templates WHERE id = ?`)
  for (const row of staleRows) {
    if (!validKeys.has(`${row.category}:${row.name}`)) {
      remove.run(row.id)
    }
  }
}

export function mapTemplateRow(row: Record<string, unknown>): ExportTemplateRow {
  let sizes: ExportTemplateSize[] = []
  let formats: string[] = []
  try {
    sizes = JSON.parse(String(row.sizes_json ?? '[]'))
  } catch {
    sizes = []
  }
  try {
    formats = JSON.parse(String(row.formats_json ?? '[]'))
  } catch {
    formats = []
  }
  return {
    id: Number(row.id),
    name: String(row.name),
    category: String(row.category) as TemplateCategory,
    sizes,
    formats,
    builtin: Boolean(row.builtin),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  }
}
