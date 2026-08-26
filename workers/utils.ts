import type { IncomingMessage, ServerResponse } from 'node:http'

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

export async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}
