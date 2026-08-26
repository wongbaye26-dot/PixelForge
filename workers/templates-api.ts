import type Database from 'better-sqlite3'
import { mapTemplateRow, type TemplateCategory } from './templates-data.js'
import { json, readBody } from './utils.js'

const VALID_CATEGORIES = new Set<TemplateCategory>(['my', 'common', 'social', 'ecommerce', 'custom'])

export async function handleTemplatesApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'GET' && pathname === '/api/templates') {
    const category = url.searchParams.get('category')?.trim()
    let sql = `SELECT * FROM export_templates`
    const params: unknown[] = []
    if (category) {
      sql += ` WHERE category = ?`
      params.push(category)
    }
    sql += ` ORDER BY builtin DESC, id ASC`
    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>
    json(res, { templates: rows.map(mapTemplateRow) })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/templates') {
    const body = (await readBody(req)) as {
      name?: string
      category?: TemplateCategory
      sizes?: Array<{ width: number; height: number }>
      formats?: string[]
    }

    const name = body.name?.trim()
    const category = body.category ?? 'custom'
    const sizes = body.sizes ?? []

    if (!name) {
      json(res, { error: '缺少名称' }, 400)
      return true
    }
    if (!VALID_CATEGORIES.has(category)) {
      json(res, { error: '无效的分类' }, 400)
      return true
    }
    if (!sizes.length) {
      json(res, { error: '缺少尺寸信息' }, 400)
      return true
    }

    const cleaned = sizes
      .map((s) => ({ width: Math.round(Number(s.width)), height: Math.round(Number(s.height)) }))
      .filter((s) => s.width > 0 && s.height > 0)

    if (!cleaned.length) {
      json(res, { error: '无效的尺寸' }, 400)
      return true
    }

    const formats = (body.formats ?? ['webp']).map((f) => f.toLowerCase())
    const r = db
      .prepare(
        `INSERT INTO export_templates (name, category, sizes_json, formats_json, builtin)
         VALUES (?, ?, ?, ?, 0)`,
      )
      .run(name, category, JSON.stringify(cleaned), JSON.stringify(formats))

    const row = db.prepare(`SELECT * FROM export_templates WHERE id = ?`).get(r.lastInsertRowid) as Record<
      string,
      unknown
    >
    json(res, { template: mapTemplateRow(row) })
    return true
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/templates/')) {
    const id = Number(pathname.split('/').pop())
    if (!id) {
      json(res, { error: '缺少 ID 参数' }, 400)
      return true
    }
    const row = db.prepare(`SELECT builtin FROM export_templates WHERE id = ?`).get(id) as
      | { builtin: number }
      | undefined
    if (!row) {
      json(res, { error: '未找到模板' }, 404)
      return true
    }
    if (row.builtin) {
      json(res, { error: '不能删除内置模板' }, 400)
      return true
    }
    db.prepare(`DELETE FROM export_templates WHERE id = ?`).run(id)
    json(res, { ok: true })
    return true
  }

  return false
}
