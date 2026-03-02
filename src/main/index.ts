import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'

app.setName('Table')
import { join } from 'path'
import updaterPkg from 'electron-updater'
const { autoUpdater } = updaterPkg
import { registerConnectionHandlers } from './ipc/connection'
import { registerQueryHandlers } from './ipc/query'
import { registerSchemaHandlers } from './ipc/schema'
import { registerExportHandlers } from './ipc/export'
import { registerHistoryHandlers } from './ipc/history'
import { registerSavedQueriesHandlers } from './ipc/savedQueries'
import { registerSettingsHandlers, applyStoredTheme } from './ipc/settings'
import { buildAppMenu } from './menu'
import { disconnectAll } from './db/client'

const isDev = process.env['NODE_ENV'] !== 'production' && !!process.env['ELECTRON_RENDERER_URL']

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.on('did-finish-load', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    win.webContents.send('theme-changed', theme)
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.bruvimtired.table')
  }

  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme-changed', theme)
    })
  })

  applyStoredTheme()
  buildAppMenu()

  registerConnectionHandlers()
  registerQueryHandlers()
  registerSchemaHandlers()
  registerExportHandlers()
  registerHistoryHandlers()
  registerSavedQueriesHandlers()
  registerSettingsHandlers()

  createWindow()

  if (!isDev) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.checkForUpdatesAndNotify()
  }

  ipcMain.handle('updater:download', async () => {
    await autoUpdater.downloadUpdate()
  })
  ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall()
  })
  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', async () => {
  await disconnectAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

autoUpdater.on('update-available', () => {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('update-available')
  })
})

autoUpdater.on('update-downloaded', () => {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('update-downloaded')
  })
})

autoUpdater.on('update-not-available', () => {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('update-not-available')
  })
})

autoUpdater.on('error', (error) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(
      'update-error',
      typeof error === 'string' ? error : (error?.message ?? 'Unknown updater error')
    )
  })
})

autoUpdater.on('download-progress', (progress) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('download-progress', progress)
  })
})
