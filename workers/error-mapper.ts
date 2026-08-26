const ERROR_MESSAGES = {
  ENOENT: '文件不存在',
  EACCES: '权限不足',
  EPERM: '操作被系统拒绝',
  ENOSPC: '磁盘空间不足',
  EMFILE: '打开文件过多',
  SQLITE_BUSY: '数据库被占用',
  SQLITE_READONLY: '数据库只读',
} as const

type KnownErrorCode = keyof typeof ERROR_MESSAGES
type PatternRule = { pattern: RegExp; message: string; code?: string }

const MESSAGE_RULES: PatternRule[] = [
  { pattern: /permission denied/i, message: '权限不足', code: 'EACCES' },
  { pattern: /operation not permitted/i, message: '操作被系统拒绝', code: 'EPERM' },
  { pattern: /no space left on device/i, message: '磁盘空间不足', code: 'ENOSPC' },
  { pattern: /too many open files/i, message: '打开文件过多', code: 'EMFILE' },
  { pattern: /database is locked|database is busy/i, message: '数据库被占用', code: 'SQLITE_BUSY' },
  { pattern: /read-only database/i, message: '数据库只读', code: 'SQLITE_READONLY' },
  { pattern: /unsupported image format|corrupt|premature end of|invalid image/i, message: '图片文件已损坏或格式不受支持' },
  { pattern: /resource busy|file is busy|text file busy|used by another process/i, message: '文件被占用' },
  { pattern: /no such file|file not found/i, message: '文件不存在', code: 'ENOENT' },
]

function readErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err) {
    if ('code' in err && (err as { code?: unknown }).code != null) {
      return String((err as { code?: unknown }).code)
    }
    if ('errno' in err && (err as { errno?: unknown }).errno != null) {
      return String((err as { errno?: unknown }).errno)
    }
  }

  const message = err instanceof Error ? err.message : String(err ?? '')
  for (const code of Object.keys(ERROR_MESSAGES) as KnownErrorCode[]) {
    if (message.includes(code)) return code
  }
  for (const rule of MESSAGE_RULES) {
    if (rule.pattern.test(message)) return rule.code
  }
  return undefined
}

export function mapWorkerError(err: unknown, fallbackMessage: string) {
  const code = readErrorCode(err)
  const rawMessage = err instanceof Error ? err.message : String(err ?? '')
  const matchedRule = MESSAGE_RULES.find((rule) => rule.pattern.test(rawMessage))
  const mappedMessage = code && code in ERROR_MESSAGES
    ? ERROR_MESSAGES[code as KnownErrorCode]
    : matchedRule?.message

  return {
    code,
    message: mappedMessage ?? (err instanceof Error && err.message ? err.message : fallbackMessage),
  }
}
