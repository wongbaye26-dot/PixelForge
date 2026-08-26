import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sqliteNode = path.join(root, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node')

function hostArch() {
  return process.arch
}

function moduleArch(file) {
  if (!fs.existsSync(file)) return null
  try {
    const out = execFileSync('file', [file], { encoding: 'utf8' })
    if (out.includes('arm64')) return 'arm64'
    if (out.includes('x86_64')) return 'x64'
  } catch {
    return null
  }
  return null
}

const expected = hostArch() === 'arm64' ? 'arm64' : hostArch() === 'x64' ? 'x64' : null
const actual = moduleArch(sqliteNode)

if (expected && actual && expected !== actual) {
  console.log(
    `[postinstall] better-sqlite3 arch mismatch (have ${actual}, need ${expected}), rebuilding...`,
  )
  execFileSync('npm', ['rebuild', 'better-sqlite3', 'sharp'], {
    cwd: root,
    stdio: 'inherit',
  })
}
