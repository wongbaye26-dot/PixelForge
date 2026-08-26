/**
 * Dev stub for AI outpaint sidecar.
 * Run: npm run ai:sidecar
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const PORT = Number(process.env.PIXELFORGE_AI_PORT ?? 3848)

async function stubOutpaint(inputPath, outputPath, width, height) {
  const w = Number(width)
  const h = Number(height)
  const input = sharp(inputPath, { animated: false, limitInputPixels: false })

  const bg = await input.clone().resize(w, h, { fit: 'cover' }).blur(48).toBuffer()
  const fg = await input
    .clone()
    .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  const meta = await sharp(fg).metadata()
  const fw = meta.width ?? w
  const fh = meta.height ?? h
  const left = Math.round((w - fw) / 2)
  const top = Math.round((h - fh) / 2)

  await sharp(bg)
    .composite([{ input: fg, left, top }])
    .webp({ quality: 90 })
    .toFile(outputPath)
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'pixel-forge-ai-stub' }))
    return
  }

  if (req.method === 'POST' && url.pathname === '/outpaint') {
    const body = await readBody(req)
    const { inputPath, outputPath, width, height } = body
    if (!inputPath || !outputPath || !width || !height) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'inputPath, outputPath, width, height required' }))
      return
    }
    if (!existsSync(inputPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'input not found' }))
      return
    }
    const outDir = path.dirname(outputPath)
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

    try {
      await stubOutpaint(inputPath, outputPath, width, height)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, outputPath, engine: 'stub_blur' }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
    }
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[pixel-forge] AI sidecar stub http://127.0.0.1:${PORT}`)
})
