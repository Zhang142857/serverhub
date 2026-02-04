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
    onMetrics: (serverId: string, callback: (metrics: Metrics) => void): (() => void) => {
      const channel = `metrics:${serverId}`
      ipcRenderer.on(channel, (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners(channel)
    }
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
      if (onOutput) {
        const channel = `compose:output:${serverId}`
        ipcRenderer.on(channel, (_, line) => onOutput(line))
      }
      return ipcRenderer.invoke('compose:up', serverId, options)
    },
    down: (serverId: string, options: ComposeDownOptions, onOutput?: (line: string) => void): Promise<void> => {
      if (onOutput) {
        const channel = `compose:output:${serverId}`
        ipcRenderer.on(channel, (_, line) => onOutput(line))
      }
      return ipcRenderer.invoke('compose:down', serverId, options)
    },
    restart: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void): Promise<void> => {
      if (onOutput) {
        const channel = `compose:output:${serverId}`
        ipcRenderer.on(channel, (_, line) => onOutput(line))
      }
      return ipcRenderer.invoke('compose:restart', serverId, options)
    },
    stop: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void): Promise<void> => {
      if (onOutput) {
        const channel = `compose:output:${serverId}`
        ipcRenderer.on(channel, (_, line) => onOutput(line))
      }
      return ipcRenderer.invoke('compose:stop', serverId, options)
    },
    start: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void): Promise<void> => {
      if (onOutput) {
        const channel = `compose:output:${serverId}`
        ipcRenderer.on(channel, (_, line) => onOutput(line))
      }
      return ipcRenderer.invoke('compose:start', serverId, options)
    },
    logs: (serverId: string, options: ComposeLogOptions, onLog?: (line: string) => void): Promise<void> => {
      if (onLog) {
        const channel = `compose:logs:${serverId}`
        ipcRenderer.on(channel, (_, line) => onLog(line))
      }
      return ipcRenderer.invoke('compose:logs', serverId, options)
    },
    pull: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void): Promise<void> => {
      if (onOutput) {
        const channel = `compose:output:${serverId}`
        ipcRenderer.on(channel, (_, line) => onOutput(line))
      }
      return ipcRenderer.invoke('compose:pull', serverId, options)
    },
    build: (serverId: string, options: ComposeBuildOptions, onOutput?: (line: string) => void): Promise<void> => {
      if (onOutput) {
        const channel = `compose:output:${serverId}`
        ipcRenderer.on(channel, (_, line) => onOutput(line))
      }
      return ipcRenderer.invoke('compose:build', serverId, options)
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
      ipcRenderer.invoke('file:write', serverId, path, content)
  },

  // AI 功能
  ai: {
    chat: (message: string, context?: AIContext): Promise<string> =>
      ipcRenderer.invoke('ai:chat', message, context),
    setProvider: (provider: string, config: AIProviderConfig): Promise<boolean> =>
      ipcRenderer.invoke('ai:setProvider', provider, config),
    onStream: (callback: (chunk: string) => void): (() => void) => {
      ipcRenderer.on('ai:stream', (_, chunk) => callback(chunk))
      return () => ipcRenderer.removeAllListeners('ai:stream')
    }
  },

  // 系统对话框
  dialog: {
    openFile: (options: OpenDialogOptions): Promise<OpenDialogResult> =>
      ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options: SaveDialogOptions): Promise<SaveDialogResult> =>
      ipcRenderer.invoke('dialog:saveFile', options),
    showOpenDialog: (options: { properties?: string[]; title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<{ canceled: boolean; filePaths: string[] }> =>
      ipcRenderer.invoke('dialog:showOpenDialog', options)
  },

  // 本地文件系统
  fs: {
    scanDirectory: (path: string, options?: { ignore?: string[] }): Promise<{ name: string; path: string; size: number; isDir: boolean }[]> =>
      ipcRenderer.invoke('fs:scanDirectory', path, options),
    packDirectory: (path: string, options?: { ignore?: string[] }): Promise<Buffer> =>
      ipcRenderer.invoke('fs:packDirectory', path, options),
    readFile: (path: string): Promise<Buffer> =>
      ipcRenderer.invoke('fs:readFile', path)
  },

  // Shell
  shell: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('shell:openExternal', url)
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
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 重新导出类型以便其他模块使用
export type { ElectronAPI }
