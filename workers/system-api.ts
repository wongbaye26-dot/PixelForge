import { statfsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { json } from './utils.js'

type CpuTimes = { idle: number; total: number }

function snapshotCpu(): CpuTimes {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const c of cpus) {
    idle += c.times.idle
    total += c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle
  }
  return { idle, total }
}

let lastCpu: CpuTimes | null = null

function cpuPercentSinceLast(): number {
  const now = snapshotCpu()
  if (!lastCpu) {
    lastCpu = now
    return 0
  }
  const idleDelta = now.idle - lastCpu.idle
  const totalDelta = now.total - lastCpu.total
  lastCpu = now
  if (totalDelta <= 0) return 0
  const usage = 1 - idleDelta / totalDelta
  return Math.max(0, Math.min(1, usage)) * 100
}

function diskRootPath(): string {
  const root = path.parse(process.cwd()).root
  if (process.platform === 'win32') {
    const sysDrive = process.env.SystemDrive
    if (sysDrive && /^[A-Za-z]:$/.test(sysDrive)) return `${sysDrive}\\`
    return root || 'C:\\'
  }
  return root || '/'
}

function getDiskBytes(): { totalBytes: number; availableBytes: number; usedBytes: number } {
  const p = diskRootPath()
  const s = statfsSync(p)
  const blockSize = s.bsize || 4096
  const totalBytes = s.blocks * blockSize
  const availableBytes = s.bavail * blockSize
  const usedBytes = Math.max(0, totalBytes - availableBytes)
  return { totalBytes, availableBytes, usedBytes }
}

export async function handleSystemApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
): Promise<boolean> {
  const { pathname } = url

  if (req.method === 'GET' && pathname === '/api/system/metrics') {
    const cpuPercent = cpuPercentSinceLast()
    const memTotalBytes = os.totalmem()
    const memFreeBytes = os.freemem()
    const memUsedBytes = Math.max(0, memTotalBytes - memFreeBytes)
    json(res, { cpuPercent, memUsedBytes, memTotalBytes })
    return true
  }

  if (req.method === 'GET' && pathname === '/api/system/disk') {
    const { totalBytes, availableBytes, usedBytes } = getDiskBytes()
    json(res, { totalBytes, availableBytes, usedBytes })
    return true
  }

  return false
}
