import { app, BrowserWindow, shell, session, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
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

  // 外部请求 IPC 代理（渲染进程不直接 fetch 外部 URL）
  ipcMain.handle('proxy:fetch', async (_, url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    // SSRF 防护
    let parsed: URL
    try { parsed = new URL(url) } catch { return { status: 0, headers: {}, body: '' } }
    const hostname = parsed.hostname
    const blockedPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254']
    const blockedPrefixes = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.']
    if (blockedPatterns.includes(hostname) || blockedPrefixes.some(p => hostname.startsWith(p)) || hostname.startsWith('[')) {
      return { status: 0, headers: {}, body: '' }
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { status: 0, headers: {}, body: '' }
    }
    const https = require('https')
    const http = require('http')
    const mod = parsed.protocol === 'https:' ? https : http
    const reqOptions = {
      method: options?.method || 'GET',
      headers: options?.headers || {},
    }
    return new Promise((resolve) => {
      const req = mod.request(url, reqOptions, (res: any) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8')
          resolve({ status: res.statusCode, headers: res.headers, body })
        })
        res.on('error', () => resolve({ status: 0, headers: {}, body: '' }))
      })
      req.on('error', () => resolve({ status: 0, headers: {}, body: '' }))
      if (options?.body) req.write(options.body)
      req.end()
    })
  })
  
  // 设置新功能的IPC处理器
  setupBackupHandlers(serverConnections)
  setupTaskHandlers()
  setupAppStoreHandlers(serverConnections)
  registerSshHandlers()
  registerCertHandlers()
  
  // 初始化任务调度器和应用商店
  await initTaskScheduler()
  await initAppStore(serverConnections)

  // 客户端自动更新（仅生产环境）
  if (!isDev) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: '发现新版本',
        message: `Runixo ${info.version} 已发布，是否下载更新？`,
        buttons: ['下载更新', '稍后提醒'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate()
          mainWindow?.webContents.send('update:downloading')
        }
      })
    })

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: '更新就绪',
        message: '更新已下载完成，重启应用以完成安装。',
        buttons: ['立即重启', '稍后'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
    })

    autoUpdater.on('error', (err) => {
      console.error('自动更新错误:', err.message)
    })

    // 延迟 5 秒检查，避免影响启动速度
    setTimeout(() => autoUpdater.checkForUpdates(), 5000)
  }

  // IPC: 手动检查更新
  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { available: !!result?.updateInfo, version: result?.updateInfo?.version }
    } catch {
      return { available: false }
    }
  })

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
