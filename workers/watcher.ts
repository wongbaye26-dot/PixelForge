import chokidar from 'chokidar'
import type Database from 'better-sqlite3'
import { scanFiles } from './scanner.js'

let watcher: chokidar.FSWatcher | null = null
const pendingPaths = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

type WatcherCallback = (result: { added: number; updated: number }) => void

let onUpdated: WatcherCallback | null = null

function scheduleScan(db: Database.Database, filePath: string) {
  pendingPaths.add(filePath)
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    void flushPending(db)
  }, 500)
}

async function flushPending(db: Database.Database) {
  const batch = [...pendingPaths]
  pendingPaths.clear()
  flushTimer = null
  if (!batch.length) return

  try {
    const result = await scanFiles(db, batch)
    onUpdated?.(result)
  } catch (err) {
    console.warn('[watcher] scan failed:', err)
  }
}

export function setWatcherCallback(cb: WatcherCallback | null) {
  onUpdated = cb
}

export function refreshFolderWatcher(db: Database.Database) {
  const rows = db.prepare(`SELECT path FROM folders ORDER BY id`).all() as Array<{ path: string }>
  const paths = rows.map((r) => r.path).filter(Boolean)

  watcher?.close()
  watcher = null

  if (!paths.length) return

  watcher = chokidar.watch(paths, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    depth: 99,
  })

  watcher.on('add', (filePath) => scheduleScan(db, filePath))
  watcher.on('change', (filePath) => scheduleScan(db, filePath))

  console.info('[watcher] watching folders:', paths.length)
}

export function stopFolderWatcher() {
  watcher?.close()
  watcher = null
  pendingPaths.clear()
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
}
