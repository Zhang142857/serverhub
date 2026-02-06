/**
 * 插件元数据
 */
export interface PluginMetadata {
  id: string
  name: string
  version: string
  description: string
  author: string
  icon?: string
  homepage?: string
  repository?: string
  main: string
  renderer?: string
  permissions: string[]
  capabilities?: PluginCapabilities
  config?: PluginConfigSchema
  dependencies?: string[]
  minAppVersion?: string
}

/**
 * 插件能力声明
 */
export interface PluginCapabilities {
  menus?: MenuDefinition[]
  routes?: RouteDefinition[]
  tools?: ToolDefinition[]
  commands?: CommandDefinition[]
}

/**
 * 插件配置模式
 */
export interface PluginConfigSchema {
  [key: string]: {
    label: string
    type: 'string' | 'number' | 'boolean' | 'password' | 'select'
    description?: string
    required?: boolean
    default?: any
    options?: Array<{ label: string; value: any }>
  }
}

/**
 * 插件配置
 */
export type PluginConfig = Record<string, any>

/**
 * 菜单定义
 */
export interface MenuDefinition {
  id: string
  label: string
  icon?: string
  route?: string
  position: 'sidebar' | 'toolbar' | 'context'
  order?: number
  children?: MenuDefinition[]
  visible?: boolean
}

/**
 * 路由定义
 */
export interface RouteDefinition {
  path: string
  name: string
  component?: string
  meta?: {
    title?: string
    icon?: string
    requiresAuth?: boolean
    [key: string]: any
  }
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string
  displayName: string
  description: string
  category: string
  dangerous?: boolean
  parameters: Record<string, ParameterDefinition>
  handler: (params: any) => Promise<any>
  permissions?: string[]
}

/**
 * 参数定义
 */
export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
  default?: any
  enum?: any[]
  validation?: (value: any) => boolean
}

/**
 * 命令定义
 */
export interface CommandDefinition {
  id: string
  name: string
  description: string
  handler: (...args: any[]) => Promise<any>
  shortcut?: string
}

/**
 * Agent工具定义
 */
export interface AgentToolDefinition {
  name: string
  displayName: string
  description: string
  category: string
  dangerous: boolean
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
    }>
    required: string[]
  }
  handler: string
}

/**
 * HTTP请求选项
 */
export interface HttpOptions {
  headers?: Record<string, string>
  timeout?: number
  params?: Record<string, any>
}

/**
 * HTTP请求配置
 */
export interface HttpRequestConfig extends HttpOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  data?: any
}

/**
 * HTTP响应
 */
export interface HttpResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
}

/**
 * 对话框选项
 */
export interface DialogOptions {
  title: string
  message: string
  type?: 'info' | 'warning' | 'error' | 'question'
  buttons?: string[]
  defaultButton?: number
  cancelButton?: number
}

/**
 * 对话框结果
 */
export interface DialogResult {
  response: number
  checkboxChecked?: boolean
}

/**
 * 命令执行选项
 */
export interface ExecOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  shell?: boolean
}

/**
 * 命令执行结果
 */
export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * 系统信息
 */
export interface SystemInfo {
  platform: string
  arch: string
  hostname: string
  cpus: number
  totalMemory: number
  freeMemory: number
  uptime: number
}

/**
 * 事件处理器
 */
export type EventHandler = (data?: any) => void

/**
 * Agent调用选项
 */
export interface AgentCallOptions {
  tools?: string[]
  temperature?: number
  maxTokens?: number
}

/**
 * Agent响应
 */
export interface AgentResponse {
  message: string
  toolCalls?: Array<{
    tool: string
    params: any
    result: any
  }>
}

/**
 * 聊天选项
 */
export interface ChatOptions {
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

/**
 * 插件权限枚举
 */
export enum PluginPermission {
  // 网络权限
  NETWORK_REQUEST = 'network:request',
  
  // 文件系统权限
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  
  // 系统权限
  SYSTEM_EXECUTE = 'system:execute',
  SYSTEM_INFO = 'system:info',
  
  // UI权限
  UI_NOTIFICATION = 'ui:notification',
  UI_DIALOG = 'ui:dialog',
  
  // 注册权限
  MENU_REGISTER = 'menu:register',
  ROUTE_REGISTER = 'route:register',
  TOOL_REGISTER = 'tool:register',
  COMMAND_REGISTER = 'command:register',
  
  // Agent权限
  AGENT_TOOL = 'agent:tool',
  AGENT_CHAT = 'agent:chat'
}
