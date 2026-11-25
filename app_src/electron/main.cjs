const { app, BrowserWindow, ipcMain, shell, Menu, screen } = require('electron')
const path = require('path')
const fs = require('fs')

const logPath = 'c:/Users/Administrator/Desktop/debug_log.txt'
function log(...args) {
  try {
    const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`
    fs.appendFileSync(logPath, line)
  } catch {}
}

log('=== APP STARTUP ===', process.argv)

let engine
try {
  engine = require('./engine.cjs')
  log('engine loaded ok')
} catch (e) {
  log('engine load failed:', e.stack || e)
}

const cancels = new Map()
let win = null
let petWin = null

function createWindow() {
  log('createWindow called')
  if (win && !win.isDestroyed()) {
    log('win already exists, restoring')
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return
  }

  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#07090c',
    show: true,
    title: '六本豆',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => {
    log('win ready-to-show')
    win.show()
    win.focus()
  })

  win.webContents.on('did-finish-load', () => {
    log('win did-finish-load')
  })

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('win did-fail-load:', code, desc, url)
  })

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html')
  log('distIndex path:', distIndex, 'exists:', fs.existsSync(distIndex))

  if (fs.existsSync(distIndex)) {
    win.loadFile(distIndex).catch((e) => log('win loadFile error:', e))
  } else {
    win.loadURL('http://localhost:5173').catch(() => {
      win.loadFile(distIndex).catch((e) => log('win fallback loadFile error:', e))
    })
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => {
    log('win closed')
    win = null
    if (!petWin || petWin.isDestroyed() || !petWin.isVisible()) {
      log('both win and petWin gone/hidden after win close -> quitting app')
      app.quit()
    }
  })
}

function createPetWindow() {
  log('createPetWindow called')
  if (petWin && !petWin.isDestroyed()) {
    log('petWin already exists, restoring')
    petWin.show()
    petWin.focus()
    return
  }

  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
    const petW = 260
    const petH = 280

    petWin = new BrowserWindow({
      width: petW,
      height: petH,
      x: Math.round(screenWidth - petW - 24),
      y: Math.round(screenHeight - petH - 24),
      show: true,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false,
      },
    })

    petWin.once('ready-to-show', () => {
      log('petWin ready-to-show')
      petWin.show()
    })

    const petPath = path.join(__dirname, 'pet.html')
    log('petPath:', petPath, 'exists:', fs.existsSync(petPath))
    petWin.loadFile(petPath).catch((e) => log('petWin loadFile error:', e))

    petWin.webContents.on('did-finish-load', () => {
      log('petWin did-finish-load')
    })
    petWin.webContents.on('did-fail-load', (_e, code, desc, url) => {
      log('petWin did-fail-load:', code, desc, url)
    })

    petWin.on('closed', () => {
      log('petWin closed')
      petWin = null
    })
  } catch (err) {
    log('createPetWindow error:', err.stack || err)
  }
}

// IPC: Pet Window handlers
ipcMain.handle('pet:toggle', () => {
  if (petWin && !petWin.isDestroyed()) {
    if (petWin.isVisible()) {
      petWin.hide()
      return false
    } else {
      petWin.show()
      return true
    }
  } else {
    createPetWindow()
    return true
  }
})

ipcMain.on('pet:show-main', () => {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  } else {
    createWindow()
  }
})

ipcMain.on('pet:hide', () => {
  if (petWin && !petWin.isDestroyed()) {
    petWin.hide()
  }
  if (!win || win.isDestroyed() || !win.isVisible()) {
    log('both win and petWin gone/hidden after pet:hide -> quitting app')
    if (petWin && !petWin.isDestroyed()) petWin.close()
    app.quit()
  }
})

let dragStart = null
ipcMain.on('pet:drag-start', () => {
  if (!petWin || petWin.isDestroyed()) return
  dragStart = petWin.getBounds()
})
ipcMain.on('pet:drag-move', (_e, d) => {
  if (!petWin || petWin.isDestroyed() || !dragStart || !d) return
  // setBounds 固定宽高，避免高 DPI 下 setPosition 导致窗口尺寸漂移
  petWin.setBounds({
    x: Math.round(dragStart.x + d.dx),
    y: Math.round(dragStart.y + d.dy),
    width: 260,
    height: 280,
  })
})

ipcMain.on('pet:set-top', (_e, isTop) => {
  if (petWin && !petWin.isDestroyed()) {
    petWin.setAlwaysOnTop(!!isTop)
  }
})

ipcMain.handle('app:info', async () => {
  if (engine && engine.init) {
    try {
      await engine.init()
    } catch {}
  }
  const i = engine ? engine.info() : { status: 'fallback' }
  return {
    ...i,
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  }
})

ipcMain.handle('chat:start', async (event, payload) => {
  const { requestId, messages } = payload
  let cancelled = false
  cancels.set(requestId, () => {
    cancelled = true
  })
  const sender = event.sender
  try {
    const result = await engine.chat({
      messages,
      isCancelled: () => cancelled || sender.isDestroyed(),
      onDelta: (text) => {
        if (!sender.isDestroyed()) {
          sender.send('chat:chunk', { requestId, delta: text })
        }
      },
    })
    if (!sender.isDestroyed()) sender.send('chat:done', { requestId, ...result })
    return { ok: true, ...result }
  } catch (e) {
    if (!sender.isDestroyed()) {
      sender.send('chat:done', { requestId, error: String(e.message || e) })
    }
    return { ok: false, error: String(e.message || e) }
  } finally {
    cancels.delete(requestId)
  }
})

ipcMain.on('chat:cancel', (_e, requestId) => {
  const fn = cancels.get(requestId)
  if (fn) fn()
})

ipcMain.handle('app:open', (_e, url) => {
  if (/^https?:/.test(url)) return shell.openExternal(url)
  return null
})

process.on('uncaughtException', (err) => {
  log('UNCAUGHT EXCEPTION:', err.stack || err)
})

process.on('unhandledRejection', (err) => {
  log('UNHANDLED REJECTION:', err.stack || err)
})

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  log('second instance detected -> quitting')
  app.quit()
} else {
  app.on('second-instance', () => {
    log('second-instance event -> restoring windows')
    createWindow()
    createPetWindow()
  })

  app.whenReady().then(() => {
    log('app.whenReady resolved')
    Menu.setApplicationMenu(null)
    createWindow()
    createPetWindow()
    if (engine) {
      engine.init().catch((e) => log('engine.init error:', e))
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  log('window-all-closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  log('app will-quit')
  if (engine && engine.cleanup) {
    engine.cleanup()
  }
})
