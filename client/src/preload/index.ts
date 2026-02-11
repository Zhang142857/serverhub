import { contextBridge, ipcRenderer } from 'electron'
import type {
  ServerConfig,
  ServerConnectResult,
  SystemInfo,
  Metrics,
  CommandResult,
  ContainerListResult,
  ContainerActionResult,
  ContainerAction,
  ComposeProject,
  ComposeProjectListResult,
  ComposeUpOptions,
  ComposeDownOptions,
  ComposeServiceOptions,
  ComposeBuildOptions,
  ComposeLogOptions,
  ComposeValidationResult,
  ServiceListResult,
  ServiceActionResult,
  ServiceAction,
  ProcessListResult,
  DirContent,
  FileContent,
  FileWriteResult,
  AIContext,
  AIProviderConfig,
  OpenDialogOptions,
  SaveDialogOptions,
  OpenDialogResult,
  SaveDialogResult,
  ElectronAPI
} from '../types'

// 暴露安全的 API 给渲染进程
const electronAPI: ElectronAPI = {
  // 外部请求代理
  fetch: (url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; headers: Record<string, string>; body: string }> =>
    ipcRenderer.invoke('proxy:fetch', url, options),

  // 服务器管理
  server: {
    connect: (config: ServerConfig): Promise<ServerConnectResult> =>
      ipcRenderer.invoke('server:connect', config),
    disconnect: (serverId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('server:disconnect', serverId),
    list: (): Promise<string[]> =>
      ipcRenderer.invoke('server:list'),
    getSystemInfo: (serverId: string): Promise<SystemInfo> =>
      ipcRenderer.invoke('server:getSystemInfo', serverId),
    startMetrics: (serverId: string, interval: number): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('server:startMetrics', serverId, interval),
    executeCommand: (serverId: string, command: string, args?: string[], options?: { timeout?: number; sudo?: boolean }): Promise<CommandResult> =>
      ipcRenderer.invoke('server:executeCommand', serverId, command, args, options),
    executeCommandStream: (serverId: string, cmd: string, streamId: string, onOutput: (data: string) => void): Promise<{ exit_code: number }> => {
      const channel = `cmd:output:${streamId}`
      const handler = (_: any, data: string) => onOutput(data)
      ipcRenderer.on(channel, handler)
      return ipcRenderer.invoke('server:executeCommandStream', serverId, cmd, streamId).finally(() => {
        ipcRenderer.removeListener(channel, handler)
      })
    },
    onMetrics: (serverId: string, callback: (metrics: Metrics) => void): (() => void) => {
      const channel = `metrics:${serverId}`
      ipcRenderer.on(channel, (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners(channel)
    },
    checkUpdate: (serverId: string): Promise<any> =>
      ipcRenderer.invoke('server:checkUpdate', serverId),
    applyUpdate: (serverId: string, version: string): Promise<any> =>
      ipcRenderer.invoke('server:applyUpdate', serverId, version),
  },

  // SSH 安装
  ssh: {
    installAgent: (params: any): Promise<{ success: boolean; port: number; token: string; certificate?: string; error?: string }> =>
      ipcRenderer.invoke('ssh:installAgent', params),
    onInstallLog: (callback: (log: { text: string; type: string }) => void): (() => void) => {
      const handler = (_: any, log: any) => callback(log)
      ipcRenderer.on('ssh:install:log', handler)
      return () => ipcRenderer.removeListener('ssh:install:log', handler)
    }
  },

  // 证书管理
  cert: {
    save: (serverId: string, certificate: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('cert:save', serverId, certificate),
    get: (serverId: string): Promise<string | null> =>
      ipcRenderer.invoke('cert:get', serverId),
    delete: (serverId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('cert:delete', serverId)
  },

  // 容器管理
  container: {
    list: (serverId: string, all?: boolean): Promise<ContainerListResult> =>
      ipcRenderer.invoke('container:list', serverId, all),
    action: (serverId: string, containerId: string, action: ContainerAction): Promise<ContainerActionResult> =>
      ipcRenderer.invoke('container:action', serverId, containerId, action)
  },

  // Docker Compose 管理
  compose: {
    list: (serverId: string): Promise<ComposeProjectListResult> =>
      ipcRenderer.invoke('compose:list', serverId),
    get: (serverId: string, projectName: string): Promise<ComposeProject> =>
      ipcRenderer.invoke('compose:get', serverId, projectName),
    up: (serverId: string, options: ComposeUpOptions, onOutput?: (line: string) => void): Promise<void> => {
      const channel = `compose:output:${serverId}`
      const handler = onOutput ? (_: any, line: string) => onOutput(line) : null
      if (handler) ipcRenderer.on(channel, handler)
      return ipcRenderer.invoke('compose:up', serverId, options).finally(() => {
        if (handler) ipcRenderer.removeListener(channel, handler)
      })
    },
    down: (serverId: string, options: ComposeDownOptions, onOutput?: (line: string) => void): Promise<void> => {
      const channel = `compose:output:${serverId}`
      const handler = onOutput ? (_: any, line: string) => onOutput(line) : null
      if (handler) ipcRenderer.on(channel, handler)
      return ipcRenderer.invoke('compose:down', serverId, options).finally(() => {
        if (handler) ipcRenderer.removeListener(channel, handler)
      })
    },
    restart: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void): Promise<void> => {
      const channel = `compose:output:${serverId}`
      const handler = onOutput ? (_: any, line: string) => onOutput(line) : null
      if (handler) ipcRenderer.on(channel, handler)
      return ipcRenderer.invoke('compose:restart', serverId, options).finally(() => {
        if (handler) ipcRenderer.removeListener(channel, handler)
      })
    },
    stop: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void): Promise<void> => {
      const channel = `compose:output:${serverId}`
      const handler = onOutput ? (_: any, line: string) => onOutput(line) : null
      if (handler) ipcRenderer.on(channel, handler)
      return ipcRenderer.invoke('compose:stop', serverId, options).finally(() => {
        if (handler) ipcRenderer.removeListener(channel, handler)
      })
    },
    start: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void): Promise<void> => {
      const channel = `compose:output:${serverId}`
      const handler = onOutput ? (_: any, line: string) => onOutput(line) : null
      if (handler) ipcRenderer.on(channel, handler)
      return ipcRenderer.invoke('compose:start', serverId, options).finally(() => {
        if (handler) ipcRenderer.removeListener(channel, handler)
      })
    },
    logs: (serverId: string, options: ComposeLogOptions, onLog?: (line: string) => void): Promise<void> => {
      const channel = `compose:logs:${serverId}`
      const handler = onLog ? (_: any, line: string) => onLog(line) : null
      if (handler) ipcRenderer.on(channel, handler)
      return ipcRenderer.invoke('compose:logs', serverId, options).finally(() => {
        if (handler) ipcRenderer.removeListener(channel, handler)
      })
    },
    pull: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void): Promise<void> => {
      const channel = `compose:output:${serverId}`
      const handler = onOutput ? (_: any, line: string) => onOutput(line) : null
      if (handler) ipcRenderer.on(channel, handler)
      return ipcRenderer.invoke('compose:pull', serverId, options).finally(() => {
        if (handler) ipcRenderer.removeListener(channel, handler)
      })
    },
    build: (serverId: string, options: ComposeBuildOptions, onOutput?: (line: string) => void): Promise<void> => {
      const channel = `compose:output:${serverId}`
      const handler = onOutput ? (_: any, line: string) => onOutput(line) : null
      if (handler) ipcRenderer.on(channel, handler)
      return ipcRenderer.invoke('compose:build', serverId, options).finally(() => {
        if (handler) ipcRenderer.removeListener(channel, handler)
      })
    },
    validate: (serverId: string, projectPath: string): Promise<ComposeValidationResult> =>
      ipcRenderer.invoke('compose:validate', serverId, projectPath)
  },

  // 服务管理
  service: {
    list: (serverId: string): Promise<ServiceListResult> =>
      ipcRenderer.invoke('service:list', serverId),
    action: (serverId: string, name: string, action: ServiceAction): Promise<ServiceActionResult> =>
      ipcRenderer.invoke('service:action', serverId, name, action)
  },

  // 进程管理
  process: {
    list: (serverId: string): Promise<ProcessListResult> =>
      ipcRenderer.invoke('process:list', serverId),
    kill: (serverId: string, pid: number, signal?: number): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('process:kill', serverId, pid, signal)
  },

  // 文件管理
  file: {
    list: (serverId: string, path: string): Promise<DirContent> =>
      ipcRenderer.invoke('file:list', serverId, path),
    read: (serverId: string, path: string): Promise<FileContent> =>
      ipcRenderer.invoke('file:read', serverId, path),
    write: (serverId: string, path: string, content: string): Promise<FileWriteResult> =>
      ipcRenderer.invoke('file:write', serverId, path, content),
    delete: (serverId: string, path: string): Promise<{ success: boolean; message?: string; error?: string }> =>
      ipcRenderer.invoke('file:delete', serverId, path),
    uploadStream: (serverId: string, data: Buffer | Uint8Array, remotePath: string, options?: {
      mode?: number
      createDirs?: boolean
      isTarGz?: boolean
      extractTo?: string
    }): Promise<{ success: boolean; message: string; bytesWritten: number; path: string }> =>
      ipcRenderer.invoke('file:uploadStream', serverId, data, remotePath, options),
    onUploadProgress: (remotePath: string, callback: (progress: { sent: number; total: number; percent: number }) => void): (() => void) => {
      const channel = `upload:progress:${remotePath}`
      ipcRenderer.on(channel, (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners(channel)
    }
  },

  // AI 功能
  ai: {
    chat: (message: string, context?: AIContext): Promise<string> =>
      ipcRenderer.invoke('ai:chat', message, context),
    streamChat: (message: string, context?: AIContext): Promise<void> =>
      ipcRenderer.invoke('ai:streamChat', message, context),
    onStreamDelta: (callback: (delta: { type: string; content?: string; toolName?: string; args?: any; result?: any }) => void): (() => void) => {
      const handler = (_: any, delta: any) => callback(delta)
      ipcRenderer.on('ai:stream:delta', handler)
      return () => ipcRenderer.removeListener('ai:stream:delta', handler)
    },
    getAvailableTools: (): Promise<Array<{
      name: string
      displayName: string
      description: string
      category: string
      dangerous: boolean
    }>> => ipcRenderer.invoke('ai:getAvailableTools'),
    setProvider: (provider: string, config: AIProviderConfig): Promise<boolean> =>
      ipcRenderer.invoke('ai:setProvider', provider, config),
    getProviders: (): Promise<Array<{ id: string; name: string; description: string }>> =>
      ipcRenderer.invoke('ai:getProviders'),
    getCommandPolicy: (): Promise<string> =>
      ipcRenderer.invoke('ai:getCommandPolicy'),
    setCommandPolicy: (policy: string): Promise<boolean> =>
      ipcRenderer.invoke('ai:setCommandPolicy', policy),
    confirmTool: (confirmId: string, approved: boolean): Promise<boolean> =>
      ipcRenderer.invoke('ai:confirmTool', confirmId, approved),
    stopStream: (): Promise<boolean> =>
      ipcRenderer.invoke('ai:stopStream'),
  },

  // MCP
  mcp: {
    getServers: (): Promise<any[]> => ipcRenderer.invoke('mcp:getServers'),
    getStatus: (): Promise<any[]> => ipcRenderer.invoke('mcp:getStatus'),
    addServer: (config: any): Promise<boolean> => ipcRenderer.invoke('mcp:addServer', config),
    removeServer: (name: string): Promise<boolean> => ipcRenderer.invoke('mcp:removeServer', name),
    startServer: (name: string): Promise<boolean> => ipcRenderer.invoke('mcp:startServer', name),
    stopServer: (name: string): Promise<boolean> => ipcRenderer.invoke('mcp:stopServer', name),
    startAll: (): Promise<boolean> => ipcRenderer.invoke('mcp:startAll'),
  },

  // Agent
  agent: {
    list: (): Promise<any[]> => ipcRenderer.invoke('agent:list'),
    get: (id: string): Promise<any> => ipcRenderer.invoke('agent:get', id),
  },

  // 系统对话框
  dialog: {
    openFile: (options: OpenDialogOptions): Promise<OpenDialogResult> =>
      ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options: SaveDialogOptions): Promise<SaveDialogResult> =>
      ipcRenderer.invoke('dialog:saveFile', options),
    showOpenDialog: (options: { properties?: string[]; title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<{ canceled: boolean; filePaths: string[] }> =>
      ipcRenderer.invoke('dialog:showOpenDialog', options),
    selectFile: async (options: { title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> => {
      const result = await ipcRenderer.invoke('dialog:openFile', { ...options, properties: ['openFile'] })
      return result.canceled ? null : result.filePaths[0]
    }
  },

  // 本地文件系统
  fs: {
    scanDirectory: (path: string, options?: { ignore?: string[] }): Promise<{ name: string; path: string; size: number; isDir: boolean }[]> =>
      ipcRenderer.invoke('fs:scanDirectory', path, options),
    packDirectory: (path: string, options?: { ignore?: string[] }): Promise<Buffer> =>
      ipcRenderer.invoke('fs:packDirectory', path, options),
    readFile: (path: string): Promise<Buffer> =>
      ipcRenderer.invoke('fs:readBinary', path)
  },

  // 更新 & 版本
  updater: {
    check: (): Promise<{ available: boolean; version?: string }> =>
      ipcRenderer.invoke('updater:check'),
  },
  app: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke('app:getVersion'),
    getPath: (name: string): Promise<string> =>
      ipcRenderer.invoke('app:getPath', name)
  },

  // Shell
  shell: {
    openExternal: (url: string): Promise<void> => {
      // 只允许 http/https 协议，防止恶意协议调用
      if (/^https?:\/\//i.test(url)) {
        return ipcRenderer.invoke('shell:openExternal', url)
      }
      return Promise.reject(new Error('Only http/https URLs are allowed'))
    }
  },

  // 交互式终端
  terminal: {
    start: (serverId: string, sessionId: string, rows: number, cols: number): Promise<{ success: boolean; sessionId: string }> =>
      ipcRenderer.invoke('terminal:start', serverId, sessionId, rows, cols),
    write: (serverId: string, sessionId: string, data: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('terminal:write', serverId, sessionId, data),
    resize: (serverId: string, sessionId: string, rows: number, cols: number): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('terminal:resize', serverId, sessionId, rows, cols),
    stop: (serverId: string, sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('terminal:stop', serverId, sessionId),
    onData: (sessionId: string, callback: (data: string) => void): (() => void) => {
      const channel = `terminal:data:${sessionId}`
      ipcRenderer.on(channel, (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners(channel)
    },
    onError: (sessionId: string, callback: (error: string) => void): (() => void) => {
      const channel = `terminal:error:${sessionId}`
      ipcRenderer.on(channel, (_, error) => callback(error))
      return () => ipcRenderer.removeAllListeners(channel)
    },
    onEnd: (sessionId: string, callback: () => void): (() => void) => {
      const channel = `terminal:end:${sessionId}`
      ipcRenderer.on(channel, () => callback())
      return () => ipcRenderer.removeAllListeners(channel)
    }
  },

  // 日志流
  log: {
    tail: (serverId: string, path: string, lines: number, follow: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('log:tail', serverId, path, lines, follow),
    stop: (serverId: string, path: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('log:stop', serverId, path),
    onData: (path: string, callback: (data: { line: string }) => void): (() => void) => {
      const channel = `log:data:${path}`
      ipcRenderer.on(channel, (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners(channel)
    },
    onError: (path: string, callback: (error: string) => void): (() => void) => {
      const channel = `log:error:${path}`
      ipcRenderer.on(channel, (_, error) => callback(error))
      return () => ipcRenderer.removeAllListeners(channel)
    },
    onEnd: (path: string, callback: () => void): (() => void) => {
      const channel = `log:end:${path}`
      ipcRenderer.on(channel, () => callback())
      return () => ipcRenderer.removeAllListeners(channel)
    }
  },

  // 代理测试
  proxy: {
    test: (config: { type: string; host: string; port: number; username?: string; password?: string }): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('proxy:test', config)
  },

  // 安全凭据存储
  secure: {
    isAvailable: (): Promise<boolean> =>
      ipcRenderer.invoke('secure:isAvailable'),
    setCredential: (key: string, value: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('secure:setCredential', key, value),
    getCredential: (key: string): Promise<{ success: boolean; value: string | null; error?: string }> =>
      ipcRenderer.invoke('secure:getCredential', key),
    deleteCredential: (key: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('secure:deleteCredential', key),
    hasCredential: (key: string): Promise<boolean> =>
      ipcRenderer.invoke('secure:hasCredential', key),
    listKeys: (): Promise<string[]> =>
      ipcRenderer.invoke('secure:listKeys'),
    clearAll: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('secure:clearAll')
  },

  // 紧急避险
  emergency: {
    enable: (serverId: string, cpuThreshold: number, memThreshold: number): Promise<any> =>
      ipcRenderer.invoke('emergency:enable', serverId, cpuThreshold, memThreshold),
    disable: (serverId: string): Promise<any> =>
      ipcRenderer.invoke('emergency:disable', serverId),
    status: (serverId: string): Promise<any> =>
      ipcRenderer.invoke('emergency:status', serverId),
  },

  // HTTP 请求（用于外部 API 调用）
  http: {
    request: (options: {
      url: string
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      headers?: Record<string, string>
      body?: string | object
      timeout?: number
      proxy?: {
        host: string
        port: number
        username?: string
        password?: string
      }
    }): Promise<{
      success: boolean
      status: number
      statusText: string
      data: any
      headers?: Record<string, string>
      error?: string
    }> => ipcRenderer.invoke('http:request', options)
  },

  // Docker 操作（服务端代理）
  docker: {
    searchHub: (serverId: string, query: string, pageSize?: number, page?: number): Promise<{
      success: boolean
      error?: string
      results: Array<{
        name: string
        description: string
        star_count: number
        is_official: boolean
        is_automated: boolean
        pull_count: number
      }>
      total_count: number
    }> => ipcRenderer.invoke('docker:searchHub', serverId, query, pageSize, page),
    
    proxyRequest: (serverId: string, options: {
      url: string
      method?: string
      headers?: Record<string, string>
      body?: Buffer
      timeout?: number
    }): Promise<{
      success: boolean
      status_code: number
      status_text: string
      headers: Record<string, string>
      body: Buffer
      error?: string
    }> => ipcRenderer.invoke('docker:proxyRequest', serverId, options)
  },

  // 插件系统
  plugin: {
    list: (): Promise<Array<{
      id: string
      name: string
      version: string
      description: string
      author: string
      icon?: string
      status: string
      permissions: string[]
      capabilities: {
        menus?: Array<{ id: string; label: string; icon?: string; route?: string; order?: number }>
        routes?: Array<{ path: string; name: string; component: string }>
        tools?: Array<{ name: string; displayName: string; description: string; category: string; dangerous?: boolean }>
      }
    }>> => ipcRenderer.invoke('plugin:list'),

    install: (pluginId: string, source?: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('plugin:install', pluginId, source),

    installFromFile: (filePath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('plugin:installFromFile', filePath),

    installFromUrl: (url: string): Promise<{ success: boolean; pluginId?: string; error?: string }> =>
      ipcRenderer.invoke('plugin:installFromUrl', url),

    uninstall: (pluginId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('plugin:uninstall', pluginId),

    enable: (pluginId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('plugin:enable', pluginId),

    disable: (pluginId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('plugin:disable', pluginId),

    getConfig: (pluginId: string): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke('plugin:getConfig', pluginId),

    setConfig: (pluginId: string, config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('plugin:setConfig', pluginId, config),

    getMenus: (): Promise<Array<{
      id: string
      pluginId: string
      label: string
      icon?: string
      route?: string
      position?: string
      order?: number
    }>> => ipcRenderer.invoke('plugin:getMenus'),

    getRoutes: (): Promise<Array<{
      path: string
      name: string
      component: string
      pluginId: string
      meta?: Record<string, unknown>
    }>> => ipcRenderer.invoke('plugin:getRoutes'),

    getMarketPlugins: (): Promise<Array<{
      id: string
      name: string
      version: string
      description: string
      author: string
      icon?: string
      downloads: number
      rating: number
      ratingCount: number
      tags: string[]
      category: string
      official: boolean
      downloadUrl: string
      updatedAt: string
    }>> => ipcRenderer.invoke('plugin:getMarketPlugins'),

    // 事件监听
    onMenuRegister: (callback: (data: { pluginId: string; menu: { id: string; label: string; icon?: string; route?: string; order?: number } }) => void): (() => void) => {
      ipcRenderer.on('plugin:menu:register', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('plugin:menu:register')
    },

    onMenuUnregister: (callback: (data: { menuId: string }) => void): (() => void) => {
      ipcRenderer.on('plugin:menu:unregister', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('plugin:menu:unregister')
    },

    onNotification: (callback: (data: { pluginId: string; title: string; body: string; type?: string }) => void): (() => void) => {
      ipcRenderer.on('plugin:notification', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('plugin:notification')
    }
  },

  // 备份管理
  backup: {
    getStrategies: (): Promise<any[]> =>
      ipcRenderer.invoke('backup:getStrategies'),
    createStrategy: (strategy: any): Promise<any> =>
      ipcRenderer.invoke('backup:createStrategy', strategy),
    updateStrategy: (id: string, updates: any): Promise<any> =>
      ipcRenderer.invoke('backup:updateStrategy', id, updates),
    deleteStrategy: (id: string): Promise<any> =>
      ipcRenderer.invoke('backup:deleteStrategy', id),
    executeBackup: (strategyId: string): Promise<any> =>
      ipcRenderer.invoke('backup:execute', strategyId),
    getRecords: (strategyId?: string): Promise<any[]> =>
      ipcRenderer.invoke('backup:getRecords', strategyId),
    restoreBackup: (recordId: string, options?: any): Promise<any> =>
      ipcRenderer.invoke('backup:restore', recordId, options),
    deleteRecord: (recordId: string): Promise<any> =>
      ipcRenderer.invoke('backup:deleteRecord', recordId)
  },

  // 计划任务
  task: {
    getTasks: (): Promise<any[]> =>
      ipcRenderer.invoke('task:getTasks'),
    createTask: (task: any): Promise<any> =>
      ipcRenderer.invoke('task:create', task),
    updateTask: (id: string, updates: any): Promise<any> =>
      ipcRenderer.invoke('task:update', id, updates),
    deleteTask: (id: string): Promise<any> =>
      ipcRenderer.invoke('task:delete', id),
    enableTask: (id: string): Promise<any> =>
      ipcRenderer.invoke('task:enable', id),
    disableTask: (id: string): Promise<any> =>
      ipcRenderer.invoke('task:disable', id),
    executeTask: (id: string): Promise<any> =>
      ipcRenderer.invoke('task:execute', id),
    getHistory: (taskId?: string): Promise<any[]> =>
      ipcRenderer.invoke('task:getHistory', taskId),
    getStats: (): Promise<any> =>
      ipcRenderer.invoke('task:getStats')
  },

  // 应用商店
  appStore: {
    getTemplates: (): Promise<any[]> =>
      ipcRenderer.invoke('appStore:getTemplates'),
    deploy: (options: any): Promise<any> =>
      ipcRenderer.invoke('appStore:deploy', options),
    getInstalled: (): Promise<any[]> =>
      ipcRenderer.invoke('appStore:getInstalled'),
    startApp: (instanceId: string): Promise<any> =>
      ipcRenderer.invoke('appStore:start', instanceId),
    stopApp: (instanceId: string): Promise<any> =>
      ipcRenderer.invoke('appStore:stop', instanceId),
    uninstallApp: (instanceId: string): Promise<any> =>
      ipcRenderer.invoke('appStore:uninstall', instanceId),
    getStats: (): Promise<any> =>
      ipcRenderer.invoke('appStore:getStats')
  },

  // 本地文件系统操作
  fsLocal: {
    ensureDir: (dirPath: string): Promise<void> =>
      ipcRenderer.invoke('fs:ensureDir', dirPath),
    readFile: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, data: string): Promise<void> =>
      ipcRenderer.invoke('fs:writeFile', filePath, data),
    deleteFile: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('fs:deleteFile', filePath),
    exists: (filePath: string): Promise<boolean> =>
      ipcRenderer.invoke('fs:exists', filePath)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 重新导出类型以便其他模块使用
export type { ElectronAPI }
