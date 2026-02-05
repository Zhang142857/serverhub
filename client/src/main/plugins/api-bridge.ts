/**
 * 插件 API 桥接
 * 提供受限的 API 给插件使用
 */

import { EventEmitter } from 'events'
import { BrowserWindow, ipcMain } from 'electron'
import { LoadedPlugin, PluginPermission } from './loader'

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
    const { pluginLoader } = require('./loader')
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
    const { pluginLoader } = require('./loader')
    return await pluginLoader.installPlugin(source || 'official', pluginId)
  })

  ipcMain.handle('plugin:uninstall', async (_, pluginId: string) => {
    const { pluginLoader } = require('./loader')
    await pluginLoader.uninstallPlugin(pluginId)
    return { success: true }
  })

  ipcMain.handle('plugin:enable', async (_, pluginId: string) => {
    const { pluginLoader } = require('./loader')
    const { pluginRuntime } = require('./runtime')
    await pluginLoader.enablePlugin(pluginId)
    await pluginRuntime.activate(pluginId)
    return { success: true }
  })

  ipcMain.handle('plugin:disable', async (_, pluginId: string) => {
    const { pluginLoader } = require('./loader')
    const { pluginRuntime } = require('./runtime')
    await pluginRuntime.deactivate(pluginId)
    await pluginLoader.disablePlugin(pluginId)
    return { success: true }
  })

  ipcMain.handle('plugin:getConfig', async (_, pluginId: string) => {
    const { pluginLoader } = require('./loader')
    const plugin = pluginLoader.getPlugin(pluginId)
    return plugin?.config || {}
  })

  ipcMain.handle('plugin:setConfig', async (_, pluginId: string, config: Record<string, unknown>) => {
    const { pluginLoader } = require('./loader')
    const { pluginRuntime } = require('./runtime')
    pluginLoader.updatePluginConfig(pluginId, config)
    pluginRuntime.notifyConfigChange(pluginId, config)
    return { success: true }
  })

  ipcMain.handle('plugin:getMenus', async () => {
    const { pluginLoader } = require('./loader')
    return pluginLoader.getPluginMenus()
  })

  ipcMain.handle('plugin:getRoutes', async () => {
    const { pluginLoader } = require('./loader')
    return pluginLoader.getPluginRoutes()
  })
}
