import type Database from 'better-sqlite3'
import { json, readBody } from './utils.js'

export async function handleTrashApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'POST' && pathname === '/api/trash/move') {
    const body = (await readBody(req)) as { ids?: number[] }
    const ids = (body.ids ?? []).map((id) => Number(id)).filter((id) => id > 0)
    if (!ids.length) {
      json(res, { error: '缺少 IDs 参数' }, 400)
      return true
    }
    const stmt = db.prepare(`UPDATE assets SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`)
    let moved = 0
    for (const id of ids) {
      const r = stmt.run(id)
      moved += r.changes
    }
    json(res, { moved })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/trash/restore') {
    const body = (await readBody(req)) as { ids?: number[] }
    const ids = (body.ids ?? []).map((id) => Number(id)).filter((id) => id > 0)
    if (!ids.length) {
      json(res, { error: '缺少 IDs 参数' }, 400)
      return true
    }
    const stmt = db.prepare(`UPDATE assets SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`)
    let restored = 0
    for (const id of ids) {
      const r = stmt.run(id)
      restored += r.changes
    }
    json(res, { restored })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/trash/delete') {
    const body = (await readBody(req)) as { ids?: number[] }
    const ids = (body.ids ?? []).map((id) => Number(id)).filter((id) => id > 0)
    if (!ids.length) {
      json(res, { error: '缺少 IDs 参数' }, 400)
      return true
    }
    const stmt = db.prepare(`DELETE FROM assets WHERE id = ? AND deleted_at IS NOT NULL`)
    let deleted = 0
    for (const id of ids) {
      const r = stmt.run(id)
      deleted += r.changes
    }
    json(res, { deleted })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/trash/empty') {
    const r = db.prepare(`DELETE FROM assets WHERE deleted_at IS NOT NULL`).run()
    json(res, { deleted: r.changes })
    return true
  }

  if (req.method === 'GET' && pathname === '/api/trash/count') {
    const row = db.prepare(`SELECT COUNT(*) as c FROM assets WHERE deleted_at IS NOT NULL`).get() as { c: number }
    json(res, { count: row.c })
    return true
  }

  return false
}
