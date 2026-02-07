/**
 * 工具注册中心
 * 统一管理内置工具和插件工具
 */

import { EventEmitter } from 'events'

// 工具参数定义
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required?: boolean
  enum?: string[]
  items?: { type: string }
  default?: unknown
}

// 工具定义
export interface ToolDefinition {
  name: string
  displayName: string
  description: string
  category: 'system' | 'docker' | 'file' | 'network' | 'database' | 'plugin' | 'deployment' | 'monitoring' | 'environment' | 'security' | 'cron' | 'user'
  dangerous?: boolean  // 危险操作标记，执行前需用户确认
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>
}

// 工具执行上下文
export interface ToolContext {
  serverId: string
  executor: ToolExecutor
  onProgress?: (message: string) => void
}

// 工具执行器接口
export interface ToolExecutor {
  executeCommand: (serverId: string, command: string, args?: string[], options?: Record<string, unknown>) => Promise<CommandResult>
  listContainers: (serverId: string, all?: boolean) => Promise<ContainerListResult>
  containerAction: (serverId: string, containerId: string, action: string) => Promise<ActionResult>
  containerLogs: (serverId: string, containerId: string, tail: number) => Promise<LogResult>
  readFile: (serverId: string, path: string) => Promise<FileResult>
  writeFile: (serverId: string, path: string, content: string) => Promise<ActionResult>
  listDirectory: (serverId: string, path: string, recursive?: boolean) => Promise<DirectoryResult>
  deleteFile: (serverId: string, path: string) => Promise<ActionResult>
  getSystemInfo: (serverId: string) => Promise<SystemInfoResult>
  listServices: (serverId: string) => Promise<ServiceListResult>
  serviceAction: (serverId: string, name: string, action: string) => Promise<ActionResult>
  listProcesses: (serverId: string) => Promise<ProcessListResult>
  killProcess: (serverId: string, pid: number, signal?: number) => Promise<ActionResult>
  listImages: (serverId: string, all?: boolean) => Promise<ImageListResult>
  pullImage: (serverId: string, image: string, tag: string) => Promise<ActionResult>
  removeImage: (serverId: string, imageId: string, force?: boolean) => Promise<ActionResult>
  listNetworks: (serverId: string) => Promise<NetworkListResult>
  listVolumes: (serverId: string) => Promise<VolumeListResult>
}

// 结果类型定义
export interface CommandResult {
  stdout: string
  stderr: string
  exit_code: number
}

export interface ContainerListResult {
  stdout: string
  stderr?: string
}

export interface ActionResult {
  success: boolean
  message?: string
  error?: string
}

export interface LogResult {
  stdout: string
  stderr?: string
}

export interface FileResult {
  content: string
  size?: number
  mode?: string
}

export interface DirectoryResult {
  entries: Array<{
    name: string
    path: string
    size: number
    mode: string
    isDir: boolean
    modTime: string
  }>
}

export interface SystemInfoResult {
  hostname: string
  os: string
  platform: string
  platformVersion: string
  kernelVersion: string
  arch: string
  uptime: number
  cpu: {
    model: string
    cores: number
    threads: number
    usage: number
  }
  memory: {
    total: number
    used: number
    usedPercent: number
  }
  disks: Array<{
    device: string
    mountpoint: string
    total: number
    used: number
    usedPercent: number
  }>
}

export interface ServiceListResult {
  services: Array<{
    name: string
    status: string
    enabled: boolean
    description?: string
  }>
}

export interface ProcessListResult {
  processes: Array<{
    pid: number
    name: string
    cpu: number
    memory: number
    user: string
    command: string
  }>
}

export interface ImageListResult {
  stdout: string
}

export interface NetworkListResult {
  stdout: string
}

export interface VolumeListResult {
  stdout: string
}

// 工具执行结果
export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  message?: string
}

/**
 * 工具注册中心
 */
export class ToolRegistry extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map()
  private categories: Map<string, Set<string>> = new Map()

  constructor() {
    super()
    // 初始化分类
    const defaultCategories = ['system', 'docker', 'file', 'network', 'database', 'plugin', 'deployment', 'monitoring']
    defaultCategories.forEach(cat => this.categories.set(cat, new Set()))
  }

  /**
   * 注册工具
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} already registered, overwriting...`)
    }

    this.tools.set(tool.name, tool)

    // 添加到分类
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set())
    }
    this.categories.get(tool.category)!.add(tool.name)

    this.emit('tool:registered', tool)
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: ToolDefinition[]): void {
    tools.forEach(tool => this.register(tool))
  }

  /**
   * 注销工具
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name)
    if (!tool) return false

    this.tools.delete(name)
    this.categories.get(tool.category)?.delete(name)

    this.emit('tool:unregistered', name)
    return true
  }

  /**
   * 获取工具
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * 获取所有工具
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /**
   * 按分类获取工具
   */
  getByCategory(category: string): ToolDefinition[] {
    const toolNames = this.categories.get(category)
    if (!toolNames) return []
    return Array.from(toolNames)
      .map(name => this.tools.get(name)!)
      .filter(Boolean)
  }

  /**
   * 获取危险工具列表
   */
  getDangerousTools(): ToolDefinition[] {
    return this.getAll().filter(tool => tool.dangerous)
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 获取工具定义（用于 AI 调用）
   */
  getToolDefinitions(): Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, unknown>
    }
  }> {
    return this.getAll().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
  }

  /**
   * 执行工具
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` }
    }

    // 发出执行前事件
    this.emit('tool:before_execute', { name, params, dangerous: tool.dangerous })

    try {
      const result = await tool.execute(params, context)

      // 发出执行后事件
      this.emit('tool:after_execute', { name, params, result })

      return result
    } catch (error) {
      const errorResult: ToolResult = {
        success: false,
        error: (error as Error).message
      }

      this.emit('tool:error', { name, params, error })

      return errorResult
    }
  }

  /**
   * 获取工具数量
   */
  get size(): number {
    return this.tools.size
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear()
    this.categories.forEach(set => set.clear())
    this.emit('tools:cleared')
  }
}

// 全局工具注册中心实例
export const toolRegistry = new ToolRegistry()
