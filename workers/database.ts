import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { getDatabaseDir } from './paths.js'

const DB_PATH = path.join(getDatabaseDir(), 'pixel-forge.db')

export function getDb(): Database.Database {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      ratio REAL NOT NULL,
      area INTEGER,
      resolution_level INTEGER,
      dominant_color TEXT,
      brightness REAL,
      format TEXT NOT NULL,
      size INTEGER NOT NULL,
      hash TEXT NOT NULL,
      favorite INTEGER DEFAULT 0,
      folder_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (folder_id) REFERENCES folders(id)
    );
    CREATE INDEX IF NOT EXISTS idx_assets_ratio ON assets(ratio);
    CREATE INDEX IF NOT EXISTS idx_assets_favorite ON assets(favorite);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const cols = db
    .prepare(`PRAGMA table_info(assets)`)
    .all() as Array<{ name: string }>
  const has = new Set(cols.map((c) => c.name))
  if (!has.has('dominant_color')) {
    db.exec(`ALTER TABLE assets ADD COLUMN dominant_color TEXT;`)
  }
  if (!has.has('brightness')) {
    db.exec(`ALTER TABLE assets ADD COLUMN brightness REAL;`)
  }
  if (!has.has('area')) {
    db.exec(`ALTER TABLE assets ADD COLUMN area INTEGER;`)
  }
  if (!has.has('resolution_level')) {
    db.exec(`ALTER TABLE assets ADD COLUMN resolution_level INTEGER;`)
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_assets_ratio ON assets(ratio);`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_assets_ratio_area ON assets(ratio, area);`)

  return db
}

export function fileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16)
}
