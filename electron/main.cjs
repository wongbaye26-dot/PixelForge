const { app, BrowserWindow, dialog, ipcMain } = require('electron')
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

async function startWorker() {
  const root = getDataRoot()
  ensureDataDirs(root)

  const script = workerScriptPath()
  if (!fs.existsSync(script)) {
    throw new Error(`Worker 未找到: ${script}\n请先执行 npm run build:worker`)
  }

  const alreadyRunning = await probeWorkerHealth(500)
  if (alreadyRunning) {
    workerProcess = null
    return
  }

  const unpackedRoot = getUnpackedRoot()
  const nodeModules = path.join(unpackedRoot, 'node_modules')

  // Use a cleaner spawn path and handle potential ENOENT
   const execPath = process.execPath.trim()
   
   workerProcess = spawn(execPath, [script], {
    cwd: unpackedRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
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
      req.on('error', (e) => {
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
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
