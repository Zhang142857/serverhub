import { app, BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import { setupIpcHandlers } from './ipc/handlers'
import { setupPluginIPC } from './plugins/api-bridge'
import { setupBackupHandlers } from './ipc/backup-handlers'
import { setupTaskHandlers, initTaskScheduler } from './ipc/task-handlers'
import { setupAppStoreHandlers, initAppStore } from './ipc/app-store-handlers'
import { registerSshHandlers } from './ipc/ssh-install'
import { registerCertHandlers } from './ipc/cert-handlers'

// 禁用硬件加速（可选，某些系统上可能需要）
// app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Runixo',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    frame: true,
    show: false,
    backgroundColor: '#1a1a2e'
  })

  // 设置内容安全策略 (CSP)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data:; font-src 'self' data:"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; object-src 'none'; base-uri 'self'"
        ]
      }
    })
  })

  // 窗口准备好后显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 外部链接在默认浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 加载页面
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用准备就绪
app.whenReady().then(async () => {
  createWindow()
  
  // 设置IPC处理器
  const serverConnections = setupIpcHandlers()
  setupPluginIPC()
  
  // 设置新功能的IPC处理器
  setupBackupHandlers(serverConnections)
  setupTaskHandlers()
  setupAppStoreHandlers(serverConnections)
  registerSshHandlers()
  registerCertHandlers()
  
  // 初始化任务调度器和应用商店
  await initTaskScheduler()
  await initAppStore(serverConnections)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 安全性：阻止新窗口创建
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    // 只允许开发环境的本地导航
    if (!isDev || !url.startsWith('http://localhost')) {
      event.preventDefault()
    }
  })
})

export { mainWindow }
