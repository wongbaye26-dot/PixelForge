import path from 'node:path'
import type Database from 'better-sqlite3'
import { refreshFolderWatcher } from './watcher.js'
import { childPathLikePrefix, normalizeFolderPath } from './fs-path.js'
import { json, readBody } from './utils.js'

export async function handleFoldersApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  db: Database.Database,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'POST' && pathname === '/api/folders/remove') {
    const body = (await readBody(req)) as { id?: number }
    const folderId = Number(body.id)
    if (!Number.isFinite(folderId) || folderId <= 0) {
      json(res, { error: '缺少 ID 参数' }, 400)
      return true
    }

    const folder = db
      .prepare(`SELECT id, path, label FROM folders WHERE id = ?`)
      .get(folderId) as { id: number; path: string; label: string } | undefined

    if (!folder) {
      json(res, { error: '未找到文件夹' }, 404)
      return true
    }

    const rootPath = normalizeFolderPath(folder.path)
    const childLike = childPathLikePrefix(rootPath)

    const removeFolderTree = db.transaction(() => {
      const moveResult = db
        .prepare(
          `UPDATE assets
           SET deleted_at = datetime('now')
           WHERE deleted_at IS NULL
             AND (folder_id = ? OR path = ? OR path LIKE ?)`,
        )
        .run(folderId, rootPath, childLike)

      db.prepare(
        `UPDATE assets
         SET folder_id = NULL
         WHERE folder_id IN (
           SELECT id FROM folders WHERE path = ? OR path LIKE ?
         )`,
      ).run(rootPath, childLike)

      let foldersRemoved = 0
      const allFolders = db.prepare(`SELECT id, path FROM folders`).all() as Array<{ id: number; path: string }>
      const deleteFolderById = db.prepare(`DELETE FROM folders WHERE id = ?`)
      for (const row of allFolders) {
        const norm = normalizeFolderPath(row.path)
        if (norm === rootPath || norm.startsWith(`${rootPath}${path.sep}`)) {
          foldersRemoved += deleteFolderById.run(row.id).changes
        }
      }

      return {
        assetsMoved: moveResult.changes,
        foldersRemoved,
      }
    })

    try {
      const { assetsMoved, foldersRemoved } = removeFolderTree()
      refreshFolderWatcher(db)
      json(res, {
        removed: true,
        assetsMoved,
        foldersRemoved,
        path: rootPath,
        label: folder.label,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除文件夹失败'
      console.error('[folders] remove failed:', err)
      json(res, { error: message }, 500)
    }
    return true
  }

  return false
}
