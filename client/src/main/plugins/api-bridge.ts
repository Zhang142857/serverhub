/**
 * 插件 API 桥接
 * 提供受限的 API 给插件使用
 */

import { EventEmitter } from 'events'
import { BrowserWindow, ipcMain, net } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { LoadedPlugin, PluginPermission, pluginLoader } from './loader'
import { pluginRuntime } from './runtime'

// 插件 API 接口
export interface PluginAPI {
  // 元信息
  readonly pluginId: string
  readonly version: string

  // 事件系统
  events: PluginEventAPI

  // UI 相关
  ui: PluginUIAPI

  // 服务器操作
  server: PluginServerAPI

  // 文件操作
  file: PluginFileAPI

  // 网络请求
  network: PluginNetworkAPI

  // 存储
  storage: PluginStorageAPI

  // 工具注册
  tools: PluginToolsAPI

  // 清理资源
  dispose: () => void
}

// 事件 API
export interface PluginEventAPI {
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
  emit(event: string, ...args: unknown[]): void
}

// UI API
export interface PluginUIAPI {
  showNotification(options: { title: string; body: string; type?: 'info' | 'success' | 'warning' | 'error' }): void
  showDialog(options: { type: 'info' | 'warning' | 'error'; title: string; message: string; buttons?: string[] }): Promise<number>
  registerMenu(menu: { id: string; label: string; icon?: string; route?: string; order?: number }): void
  unregisterMenu(menuId: string): void
}

// 服务器操作 API
export interface PluginServerAPI {
  getConnectedServers(): Promise<Array<{ id: string; name: string; host: string }>>
  getCurrentServer(): Promise<{ id: string; name: string; host: string } | null>
  getSystemInfo(serverId: string): Promise<Record<string, unknown>>
  executeCommand(serverId: string, command: string, args?: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

// 文件操作 API
export interface PluginFileAPI {
  list(serverId: string, path: string): Promise<Array<{ name: string; isDir: boolean; size: number; modTime: string }>>
  read(serverId: string, path: string): Promise<string>
  write(serverId: string, path: string, content: string): Promise<void>
  exists(serverId: string, path: string): Promise<boolean>
}

// 网络请求 API
export interface PluginNetworkAPI {
  fetch(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; data: unknown }>
}

// 存储 API
export interface PluginStorageAPI {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

// 工具注册 API
export interface PluginToolsAPI {
  register(tool: {
    name: string
    displayName: string
    description: string
    category: string
    dangerous?: boolean
    parameters: Record<string, { type: string; description: string; required?: boolean }>
    handler: (args: Record<string, unknown>) => Promise<unknown>
  }): void
  unregister(toolName: string): void
}

/**
 * 创建插件 API 实例
 */
export function createPluginAPI(plugin: LoadedPlugin): PluginAPI {
  const permissions = new Set(plugin.manifest.permissions)
  const eventEmitter = new EventEmitter()
  const registeredMenus: string[] = []
  const registeredTools: string[] = []
  const storagePrefix = `plugin:${plugin.manifest.id}:`

  // 权限检查
  function checkPermission(required: PluginPermission, action: string): void {
    if (!permissions.has(required)) {
      throw new Error(`Plugin ${plugin.manifest.id} lacks permission '${required}' for action: ${action}`)
    }
  }

  // 事件 API
  const events: PluginEventAPI = {
    on(event: string, handler: (...args: unknown[]) => void): void {
      eventEmitter.on(`plugin:${plugin.manifest.id}:${event}`, handler)
    },
    off(event: string, handler: (...args: unknown[]) => void): void {
      eventEmitter.off(`plugin:${plugin.manifest.id}:${event}`, handler)
    },
    emit(event: string, ...args: unknown[]): void {
      eventEmitter.emit(`plugin:${plugin.manifest.id}:${event}`, ...args)
    }
  }

  // UI API
  const ui: PluginUIAPI = {
    showNotification(options): void {
      const win = BrowserWindow.getFocusedWindow()
      if (win) {
        win.webContents.send('plugin:notification', {
          pluginId: plugin.manifest.id,
          ...options
        })
      }
    },

    async showDialog(options): Promise<number> {
      const { dialog } = require('electron')
      const result = await dialog.showMessageBox({
        type: options.type,
        title: options.title,
        message: options.message,
        buttons: options.buttons || ['OK']
      })
      return result.response
    },

    registerMenu(menu): void {
      checkPermission('menu:register', 'registerMenu')
      const menuId = `${plugin.manifest.id}:${menu.id}`
      registeredMenus.push(menuId)

      // 通知渲染进程添加菜单
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('plugin:menu:register', {
          pluginId: plugin.manifest.id,
          menu: { ...menu, id: menuId }
        })
      })
    },

    unregisterMenu(menuId): void {
      const fullId = `${plugin.manifest.id}:${menuId}`
      const index = registeredMenus.indexOf(fullId)
      if (index !== -1) {
        registeredMenus.splice(index, 1)
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('plugin:menu:unregister', { menuId: fullId })
        })
      }
    }
  }

  // 服务器操作 API
  const server: PluginServerAPI = {
    async getConnectedServers(): Promise<Array<{ id: string; name: string; host: string }>> {
      checkPermission('server:read', 'getConnectedServers')
      // 通过 IPC 获取连接的服务器列表
      return new Promise((resolve) => {
        const channel = `plugin:${plugin.manifest.id}:getServers`
        ipcMain.once(channel + ':response', (_, data) => resolve(data))
        BrowserWindow.getAllWindows()[0]?.webContents.send(channel)
      })
    },

    async getCurrentServer(): Promise<{ id: string; name: string; host: string } | null> {
      checkPermission('server:read', 'getCurrentServer')
      return new Promise((resolve) => {
        const channel = `plugin:${plugin.manifest.id}:getCurrentServer`
        ipcMain.once(channel + ':response', (_, data) => resolve(data))
        BrowserWindow.getAllWindows()[0]?.webContents.send(channel)
      })
    },

    async getSystemInfo(serverId: string): Promise<Record<string, unknown>> {
      checkPermission('server:read', 'getSystemInfo')
      // 调用主进程的服务器管理模块
      const { serverManager } = require('../server/manager')
      return await serverManager.getSystemInfo(serverId)
    },

    async executeCommand(serverId: string, command: string, args?: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
      checkPermission('command:execute', 'executeCommand')

      // 命令白名单检查（安全措施）
      const allowedCommands = [
        'ls', 'cat', 'head', 'tail', 'grep', 'find', 'ps', 'top', 'df', 'du',
        'docker', 'systemctl', 'service', 'nginx', 'mysql', 'redis-cli'
      ]

      const baseCommand = command.split(' ')[0]
      if (!allowedCommands.includes(baseCommand)) {
        throw new Error(`Command '${baseCommand}' is not allowed for plugins`)
      }

      const { serverManager } = require('../server/manager')
      return await serverManager.executeCommand(serverId, command, args)
    }
  }

  // 文件操作 API
  const file: PluginFileAPI = {
    async list(serverId: string, path: string): Promise<Array<{ name: string; isDir: boolean; size: number; modTime: string }>> {
      checkPermission('file:read', 'file.list')
      const { serverManager } = require('../server/manager')
      const result = await serverManager.listDirectory(serverId, path)
      return result.files || []
    },

    async read(serverId: string, path: string): Promise<string> {
      checkPermission('file:read', 'file.read')

      // 限制可读取的路径
      const allowedPaths = ['/etc', '/var/log', '/home', '/opt', '/tmp']
      const isAllowed = allowedPaths.some(p => path.startsWith(p))
      if (!isAllowed) {
        throw new Error(`Reading path '${path}' is not allowed for plugins`)
      }

      const { serverManager } = require('../server/manager')
      const result = await serverManager.readFile(serverId, path)
      return result.content || ''
    },

    async write(serverId: string, path: string, content: string): Promise<void> {
      checkPermission('file:write', 'file.write')

      // 限制可写入的路径
      const allowedPaths = ['/tmp', '/home', '/opt']
      const isAllowed = allowedPaths.some(p => path.startsWith(p))
      if (!isAllowed) {
        throw new Error(`Writing to path '${path}' is not allowed for plugins`)
      }

      const { serverManager } = require('../server/manager')
      await serverManager.writeFile(serverId, path, content)
    },

    async exists(serverId: string, path: string): Promise<boolean> {
      checkPermission('file:read', 'file.exists')
      try {
        const { serverManager } = require('../server/manager')
        await serverManager.getFileInfo(serverId, path)
        return true
      } catch {
        return false
      }
    }
  }

  // 网络请求 API
  const network: PluginNetworkAPI = {
    async fetch(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; data: unknown }> {
      checkPermission('network:request', 'network.fetch')

      // URL 白名单检查
      const allowedHosts = [
        'api.github.com',
        'registry.npmjs.org',
        'hub.docker.com',
        'api.cloudflare.com'
      ]

      const urlObj = new URL(url)
      if (!allowedHosts.includes(urlObj.host)) {
        throw new Error(`Network request to '${urlObj.host}' is not allowed for plugins`)
      }

      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body
      })

      const data = await response.json().catch(() => response.text())
      return { status: response.status, data }
    }
  }

  // 存储 API
  const storage: PluginStorageAPI = {
    async get(key: string): Promise<unknown> {
      const { app } = require('electron')
      const fs = require('fs')
      const path = require('path')

      const storagePath = path.join(app.getPath('userData'), 'plugin-storage', `${plugin.manifest.id}.json`)

      if (!fs.existsSync(storagePath)) {
        return undefined
      }

      const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'))
      return data[key]
    },

    async set(key: string, value: unknown): Promise<void> {
      const { app } = require('electron')
      const fs = require('fs')
      const path = require('path')

      const storageDir = path.join(app.getPath('userData'), 'plugin-storage')
      const storagePath = path.join(storageDir, `${plugin.manifest.id}.json`)

      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true })
      }

      let data: Record<string, unknown> = {}
      if (fs.existsSync(storagePath)) {
        data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'))
      }

      data[key] = value
      fs.writeFileSync(storagePath, JSON.stringify(data, null, 2))
    },

    async delete(key: string): Promise<void> {
      const { app } = require('electron')
      const fs = require('fs')
      const path = require('path')

      const storagePath = path.join(app.getPath('userData'), 'plugin-storage', `${plugin.manifest.id}.json`)

      if (!fs.existsSync(storagePath)) {
        return
      }

      const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'))
      delete data[key]
      fs.writeFileSync(storagePath, JSON.stringify(data, null, 2))
    },

    async clear(): Promise<void> {
      const { app } = require('electron')
      const fs = require('fs')
      const path = require('path')

      const storagePath = path.join(app.getPath('userData'), 'plugin-storage', `${plugin.manifest.id}.json`)

      if (fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath)
      }
    }
  }

  // 工具注册 API
  const tools: PluginToolsAPI = {
    register(tool): void {
      checkPermission('tool:register', 'tools.register')

      const toolName = `${plugin.manifest.id}:${tool.name}`
      registeredTools.push(toolName)

      // 注册到 AI 工具系统
      const { toolRegistry } = require('../ai/tools/registry')
      toolRegistry.register({
        name: toolName,
        displayName: tool.displayName,
        description: tool.description,
        category: 'plugin',
        dangerous: tool.dangerous || false,
        parameters: tool.parameters,
        execute: async (args, context) => {
          try {
            const result = await tool.handler(args)
            return { success: true, data: result }
          } catch (error) {
            return { success: false, error: (error as Error).message }
          }
        }
      })
    },

    unregister(toolName): void {
      const fullName = `${plugin.manifest.id}:${toolName}`
      const index = registeredTools.indexOf(fullName)
      if (index !== -1) {
        registeredTools.splice(index, 1)
        const { toolRegistry } = require('../ai/tools/registry')
        toolRegistry.unregister(fullName)
      }
    }
  }

  // 清理函数
  function dispose(): void {
    // 移除所有注册的菜单
    registeredMenus.forEach(menuId => {
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('plugin:menu:unregister', { menuId })
      })
    })

    // 移除所有注册的工具
    registeredTools.forEach(toolName => {
      try {
        const { toolRegistry } = require('../ai/tools/registry')
        toolRegistry.unregister(toolName)
      } catch { /* ignore */ }
    })

    // 清理事件监听
    eventEmitter.removeAllListeners()
  }

  return {
    pluginId: plugin.manifest.id,
    version: plugin.manifest.version,
    events,
    ui,
    server,
    file,
    network,
    storage,
    tools,
    dispose
  }
}

/**
 * 设置插件 IPC 处理器
 */
export function setupPluginIPC(): void {
  // 处理插件相关的 IPC 消息
  ipcMain.handle('plugin:list', async () => {
    // pluginLoader imported at top level
    return pluginLoader.getPlugins().map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      author: p.manifest.author,
      icon: p.manifest.icon,
      status: p.status,
      permissions: p.manifest.permissions,
      capabilities: p.manifest.capabilities
    }))
  })

  ipcMain.handle('plugin:install', async (_, pluginId: string, source?: string) => {
    // pluginLoader imported at top level
    return await pluginLoader.installPlugin(source || 'official', pluginId)
  })

  ipcMain.handle('plugin:installFromUrl', async (_, url: string) => {
    const os = require('os')
    const https = require('https')
    const tmpPath = path.join(os.tmpdir(), `runixo-plugin-${Date.now()}.shplugin`)
    try {
      const buffer: Buffer = await new Promise((resolve, reject) => {
        https.get(url, (res: any) => {
          if (res.statusCode !== 200) return reject(new Error(`Download failed: ${res.statusCode}`))
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        }).on('error', reject)
      })
      fs.writeFileSync(tmpPath, buffer)
      const plugin = await pluginLoader.installFromFile(tmpPath)
      return { success: true, pluginId: plugin.manifest.id }
    } finally {
      try { fs.unlinkSync(tmpPath) } catch {}
    }
  })

  ipcMain.handle('plugin:installFromFile', async (_, filePath: string) => {
    // pluginLoader imported at top level
    const plugin = await pluginLoader.installFromFile(filePath)
    return { success: true, pluginId: plugin.manifest.id }
  })

  ipcMain.handle('plugin:uninstall', async (_, pluginId: string) => {
    // pluginLoader imported at top level
    await pluginLoader.uninstallPlugin(pluginId)
    return { success: true }
  })

  ipcMain.handle('plugin:enable', async (_, pluginId: string) => {
    // pluginLoader imported at top level
    // pluginRuntime imported at top level
    await pluginLoader.enablePlugin(pluginId)
    await pluginRuntime.activate(pluginId)
    return { success: true }
  })

  ipcMain.handle('plugin:disable', async (_, pluginId: string) => {
    // pluginLoader imported at top level
    // pluginRuntime imported at top level
    await pluginRuntime.deactivate(pluginId)
    await pluginLoader.disablePlugin(pluginId)
    return { success: true }
  })

  ipcMain.handle('plugin:getConfig', async (_, pluginId: string) => {
    // pluginLoader imported at top level
    const plugin = pluginLoader.getPlugin(pluginId)
    return plugin?.config || {}
  })

  ipcMain.handle('plugin:setConfig', async (_, pluginId: string, config: Record<string, unknown>) => {
    // pluginLoader imported at top level
    // pluginRuntime imported at top level
    pluginLoader.updatePluginConfig(pluginId, config)
    pluginRuntime.notifyConfigChange(pluginId, config)
    return { success: true }
  })

  ipcMain.handle('plugin:getMenus', async () => {
    // pluginLoader imported at top level
    return pluginLoader.getPluginMenus()
  })

  ipcMain.handle('plugin:getRoutes', async () => {
    // pluginLoader imported at top level
    return pluginLoader.getPluginRoutes()
  })

  // 获取市场插件列表
  ipcMain.handle('plugin:getMarketPlugins', async () => {
    // 返回默认的市场插件列表
    return [
      {
        id: 'cloudflare-security',
        name: 'Cloudflare 安全防护',
        version: '1.0.0',
        description: '集成 Cloudflare 安全功能，自动封禁恶意 IP，防 DDoS 攻击',
        author: 'Runixo',
        icon: '🛡️',
        downloads: 5200,
        rating: 4.7,
        ratingCount: 128,
        tags: ['安全', 'Cloudflare', '防火墙', 'DDoS'],
        category: 'security',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/cloudflare-security',
        updatedAt: '2024-01-20',
        features: ['自动封禁恶意IP', 'WAF规则管理', 'DDoS防护', '安全仪表板'],
        changelog: [
          { version: '1.0.0', date: '2024-01-20', changes: ['初始版本发布', '支持自动封禁', '集成WAF管理'] }
        ],
        reviews: [
          { id: '1', user: '用户A', rating: 5, date: '2024-01-18', content: '非常好用，自动封禁功能很强大' },
          { id: '2', user: '用户B', rating: 4, date: '2024-01-15', content: '配置简单，效果明显' }
        ]
      },
      {
        id: 'nginx-manager',
        name: 'Nginx 管理',
        version: '1.0.0',
        description: '可视化管理 Nginx 配置、虚拟主机和 SSL 证书',
        author: 'Runixo',
        icon: '🌐',
        downloads: 6200,
        rating: 4.6,
        ratingCount: 189,
        tags: ['Web服务器', 'Nginx', '反向代理'],
        category: 'web',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/nginx-manager',
        updatedAt: '2024-01-15',
        features: ['虚拟主机管理', 'SSL证书配置', '反向代理设置', '负载均衡'],
        changelog: [
          { version: '1.0.0', date: '2024-01-15', changes: ['初始版本', '支持虚拟主机管理'] }
        ],
        reviews: []
      },
      {
        id: 'mysql-manager',
        name: 'MySQL 管理',
        version: '1.0.0',
        description: '数据库管理、备份恢复、性能监控',
        author: 'Runixo',
        icon: '🗄️',
        downloads: 5100,
        rating: 4.5,
        ratingCount: 167,
        tags: ['数据库', 'MySQL', 'SQL'],
        category: 'database',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/mysql-manager',
        updatedAt: '2024-01-10',
        features: ['数据库管理', '用户权限', '备份恢复', '性能监控'],
        changelog: [],
        reviews: []
      },
      {
        id: 'redis-manager',
        name: 'Redis 管理',
        version: '1.0.0',
        description: 'Redis 数据库可视化管理，支持键值浏览、监控',
        author: 'Runixo',
        icon: '🔴',
        downloads: 4300,
        rating: 4.4,
        ratingCount: 134,
        tags: ['数据库', 'Redis', '缓存'],
        category: 'database',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/redis-manager',
        updatedAt: '2024-01-08',
        features: ['键值浏览', '数据编辑', '性能监控', '内存分析'],
        changelog: [],
        reviews: []
      },
      {
        id: 'backup-manager',
        name: '自动备份',
        version: '1.0.0',
        description: '定时备份文件和数据库到本地或云存储',
        author: 'Runixo',
        icon: '💾',
        downloads: 4200,
        rating: 4.3,
        ratingCount: 98,
        tags: ['备份', '定时任务', '云存储'],
        category: 'tools',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/backup-manager',
        updatedAt: '2024-01-05',
        features: ['定时备份', '增量备份', '云存储支持', '备份恢复'],
        changelog: [],
        reviews: []
      },
      {
        id: 'advanced-monitor',
        name: '高级监控',
        version: '1.0.0',
        description: '详细的性能监控、告警通知、历史数据',
        author: 'Runixo',
        icon: '📊',
        downloads: 5600,
        rating: 4.6,
        ratingCount: 145,
        tags: ['监控', '告警', '性能'],
        category: 'monitor',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/advanced-monitor',
        updatedAt: '2024-01-03',
        features: ['实时监控', '历史数据', '告警规则', '邮件通知'],
        changelog: [],
        reviews: []
      },
      {
        id: 'minecraft-server',
        name: 'Minecraft 服务器',
        version: '0.9.0',
        description: '管理 Minecraft 服务器、玩家、插件',
        author: 'Community',
        icon: '⛏️',
        downloads: 3800,
        rating: 4.7,
        ratingCount: 312,
        tags: ['游戏', 'Minecraft', '服务器'],
        category: 'game',
        official: false,
        downloadUrl: 'https://plugins.runixo.dev/minecraft-server',
        updatedAt: '2024-01-18',
        features: ['服务器控制', '玩家管理', '插件管理', '世界备份'],
        changelog: [],
        reviews: []
      },
      {
        id: 'firewall-manager',
        name: '防火墙管理',
        version: '1.0.0',
        description: '可视化管理 iptables/firewalld 规则',
        author: 'Runixo',
        icon: '🔥',
        downloads: 3200,
        rating: 4.2,
        ratingCount: 87,
        tags: ['安全', '防火墙', '网络'],
        category: 'security',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/firewall-manager',
        updatedAt: '2024-01-02',
        features: ['规则管理', '端口控制', 'IP黑白名单', '日志分析'],
        changelog: [],
        reviews: []
      }
    ]
  })
}
