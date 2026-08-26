import path from 'node:path'

/** Canonical folder root path for DB storage and matching. */
export function normalizeFolderPath(folderPath: string): string {
  return path.normalize(folderPath).replace(/[/\\]+$/, '')
}

export function childPathLikePrefix(folderPath: string): string {
  return `${normalizeFolderPath(folderPath)}${path.sep}%`
}
