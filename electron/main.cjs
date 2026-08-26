const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { spawn } = require('child_process')

const PORT = 3847
const API_BASE = `http://127.0.0.1:${PORT}`

let mainWindow = null
let workerProcess = null
let appIsQuitting = false
let lastWorkerErr = ''
let lastWorkerOut = ''

function getUnpackedRoot() {
  if (!app.isPackaged) return path.join(__dirname, '..')
  return path.join(process.resourcesPath, 'app.asar.unpacked')
}

function getDataRoot() {
  return path.join(app.getPath('userData'), 'pixel-forge-data')
}

function getUserSettingsPath() {
  return path.join(getDataRoot(), 'user-settings.json')
}

function ensureDataDirs(root) {
  for (const sub of ['database', 'cache/thumbnails', 'exports']) {
    const dir = path.join(root, sub)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

function workerScriptPath() {
  return path.join(getUnpackedRoot(), 'electron-dist', 'server.cjs')
}

function getIndexHtml() {
  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html')
  }
  return path.join(__dirname, '..', 'dist', 'index.html')
}

function getPreloadPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar', 'electron', 'preload.cjs')
  }
  return path.join(__dirname, 'preload.cjs')
}

function logWorker(stream, prefix) {
  if (!stream) return
  stream.on('data', (chunk) => {
    const text = chunk.toString().trim()
    if (text) {
      console.error(`[pixel-forge worker] ${prefix}:`, text)
      if (prefix === 'err') lastWorkerErr = `${lastWorkerErr}\n${text}`.trim().slice(-8000)
      if (prefix === 'out') lastWorkerOut = `${lastWorkerOut}\n${text}`.trim().slice(-8000)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`console.error("[Worker ${prefix}]", ${JSON.stringify(text)})`)
      }
    }
  })
}

function probeWorkerHealth(timeoutMs = 600) {
  return new Promise((resolve) => {
    const req = http.get(`${API_BASE}/api/health`, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function resolveWorkerLaunch() {
  if (app.isPackaged) {
    return {
      execPath: process.execPath.trim(),
      extraEnv: { ELECTRON_RUN_AS_NODE: '1' },
    }
  }

  const devNode = process.env.PIXELFORGE_DEV_NODE
  if (devNode && fs.existsSync(devNode)) {
    return { execPath: devNode, extraEnv: {} }
  }

  // 开发态使用系统 Node，与 `npm run dev:api` / npm rebuild 的原生模块 ABI 一致
  return { execPath: 'node', extraEnv: {} }
}

function buildWorkerPath() {
  const extra = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/opt/local/bin',
  ].filter((dir) => fs.existsSync(dir))
  const base = process.env.PATH || ''
  return [...extra, base].filter(Boolean).join(path.delimiter)
}

async function startWorker() {
  const root = getDataRoot()
  ensureDataDirs(root)

  const alreadyRunning = await probeWorkerHealth(500)
  if (alreadyRunning) {
    workerProcess = null
    return
  }

  const script = workerScriptPath()
  if (!fs.existsSync(script)) {
    throw new Error(
      `Worker 未找到: ${script}\n请先执行 npm run dev:api，或 npm run build:worker`,
    )
  }

  const unpackedRoot = getUnpackedRoot()
  const nodeModules = path.join(unpackedRoot, 'node_modules')
  const { execPath, extraEnv } = resolveWorkerLaunch()

  workerProcess = spawn(execPath, [script], {
    cwd: unpackedRoot,
    env: {
      ...process.env,
      ...extraEnv,
      PATH: buildWorkerPath(),
      PIXELFORGE_ROOT: root,
      PIXELFORGE_PORT: String(PORT),
      NODE_PATH: fs.existsSync(nodeModules) ? nodeModules : '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  logWorker(workerProcess.stdout, 'out')
  logWorker(workerProcess.stderr, 'err')

  workerProcess.on('error', (err) => {
    console.error('[pixel-forge worker] Failed to spawn:', err)
  })

  workerProcess.on('exit', (code, signal) => {
    if (appIsQuitting) return
    if (code !== 0 && code !== null) {
      console.error(`[pixel-forge worker] Exit code ${code}, signal ${signal}`)
      const details = lastWorkerErr || lastWorkerOut
      const tail = details ? `\n\n日志(末尾):\n${details.split('\n').slice(-18).join('\n')}` : ''
      dialog.showErrorBox(
        'PixelForge 后台服务已停止',
        `图片处理服务异常退出 (code=${code}, signal=${signal ?? 'none'})。${tail}`,
      )
    }
  })
}

function waitForWorker(maxAttempts = 80) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const tryOnce = () => {
      const req = http.get(`${API_BASE}/api/health`, (res) => {
        res.resume()
        if (res.statusCode === 200) resolve()
        else retry()
      })
      req.on('error', (_err) => {
        // console.log(`[pixel-forge] waiting for worker... ${attempts}/${maxAttempts}`)
        retry()
      })
      req.setTimeout(2000, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (workerProcess && workerProcess.exitCode !== null) {
        probeWorkerHealth(800).then((ok) => {
          if (ok) resolve()
          else reject(new Error('图片处理服务启动失败，请查看控制台日志'))
        })
        return
      }
      attempts += 1
      if (attempts >= maxAttempts) {
        reject(new Error(`图片处理服务启动超时 (attempts=${attempts})，请确认 3847 端口未被占用`))
        return
      }
      setTimeout(tryOnce, 300)
    }
    tryOnce()
  })
}

function createWindow() {
  const indexPath = getIndexHtml()
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'PixelForge',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return
    const key = input.key?.toLowerCase?.() ?? ''
    if (input.meta && input.alt && key === 'i') {
      mainWindow.webContents.toggleDevTools()
    }
  })

  if (indexPath.startsWith('http')) {
    mainWindow.loadURL(indexPath)
  } else {
    if (!fs.existsSync(indexPath)) {
      throw new Error(`界面文件未找到: ${indexPath}`)
    }
    mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function stopWorker() {
  if (workerProcess && !workerProcess.killed) {
    workerProcess.kill('SIGTERM')
    workerProcess = null
  }
}

function showFatalError(title, message) {
  dialog.showErrorBox(title, message)
}

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

ipcMain.handle('open-path', async (_event, targetPath) => {
  if (!targetPath || typeof targetPath !== 'string') return { ok: false }
  const err = await shell.openPath(targetPath)
  return { ok: !err, error: err || undefined }
})

ipcMain.handle('show-item-in-folder', async (_event, targetPath) => {
  if (!targetPath || typeof targetPath !== 'string') return { ok: false }
  shell.showItemInFolder(targetPath)
  return { ok: true }
})

ipcMain.handle('read-user-settings', async () => {
  try {
    const file = getUserSettingsPath()
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    console.error('[pixel-forge] read-user-settings failed:', err)
    return null
  }
})

ipcMain.handle('write-user-settings', async (_event, payload) => {
  try {
    const root = getDataRoot()
    ensureDataDirs(root)
    const file = getUserSettingsPath()
    fs.writeFileSync(file, JSON.stringify(payload ?? {}, null, 2), 'utf8')
    return { ok: true }
  } catch (err) {
    console.error('[pixel-forge] write-user-settings failed:', err)
    return { ok: false }
  }
})

app.whenReady().then(async () => {
  try {
    await startWorker()
    await waitForWorker()
    createWindow()
  } catch (err) {
    console.error('[pixel-forge]', err)
    showFatalError('PixelForge 启动失败', err instanceof Error ? err.message : String(err))
    app.exit(1)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length > 0) return
  try {
    if (!workerProcess || workerProcess.exitCode !== null) {
      await startWorker()
      await waitForWorker()
    }
    createWindow()
  } catch (err) {
    showFatalError('PixelForge 启动失败', err instanceof Error ? err.message : String(err))
  }
})

app.on('before-quit', () => {
  appIsQuitting = true
  stopWorker()
})
