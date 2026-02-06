/**
 * 应用商店类型定义
 */

/**
 * 应用分类
 */
export enum AppCategory {
  WEB = 'web',              // Web应用
  DATABASE = 'database',    // 数据库
  CACHE = 'cache',          // 缓存
  MESSAGE_QUEUE = 'mq',     // 消息队列
  MONITORING = 'monitoring', // 监控
  DEVOPS = 'devops',        // DevOps工具
  STORAGE = 'storage',      // 存储
  NETWORK = 'network',      // 网络工具
  SECURITY = 'security',    // 安全工具
  OTHER = 'other'           // 其他
}

/**
 * 部署类型
 */
export enum DeploymentType {
  DOCKER = 'docker',        // Docker容器
  COMPOSE = 'compose',      // Docker Compose
  BINARY = 'binary'         // 二进制文件
}

/**
 * 应用状态
 */
export enum AppStatus {
  AVAILABLE = 'available',  // 可用
  INSTALLING = 'installing', // 安装中
  INSTALLED = 'installed',  // 已安装
  RUNNING = 'running',      // 运行中
  STOPPED = 'stopped',      // 已停止
  ERROR = 'error'           // 错误
}

/**
 * 端口配置
 */
export interface PortConfig {
  container: number
  host: number
  protocol: 'tcp' | 'udp'
}

/**
 * 卷配置
 */
export interface VolumeConfig {
  container: string
  host: string
  mode?: 'rw' | 'ro'
}

/**
 * 环境变量配置
 */
export interface EnvConfig {
  name: string
  value: string
  description?: string
}

/**
 * 配置表单字段
 */
export interface ConfigField {
  name: string
  label: string
  type: 'text' | 'password' | 'number' | 'select' | 'boolean'
  required: boolean
  default?: any
  options?: Array<{ label: string; value: any }>
  description?: string
  placeholder?: string
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

/**
 * Docker部署配置
 */
export interface DockerDeployment {
  type: DeploymentType.DOCKER
  image: string
  tag?: string
  ports: PortConfig[]
  volumes: VolumeConfig[]
  environment: EnvConfig[]
  command?: string[]
  entrypoint?: string[]
  restart?: 'no' | 'always' | 'on-failure' | 'unless-stopped'
  networks?: string[]
  labels?: Record<string, string>
}

/**
 * Docker Compose部署配置
 */
export interface ComposeDeployment {
  type: DeploymentType.COMPOSE
  composeFile: string
  services: string[]
  environment?: EnvConfig[]
}

/**
 * 二进制部署配置
 */
export interface BinaryDeployment {
  type: DeploymentType.BINARY
  downloadUrl: string
  installScript: string
  startCommand: string
  stopCommand: string
  configPath?: string
}

/**
 * 部署配置联合类型
 */
export type DeploymentConfig = DockerDeployment | ComposeDeployment | BinaryDeployment

/**
 * 应用模板
 */
export interface AppTemplate {
  id: string
  name: string
  displayName: string
  description: string
  icon: string
  category: AppCategory
  version: string
  author: string
  homepage?: string
  documentation?: string
  
  // 部署配置
  deployment: DeploymentConfig
  
  // 配置表单
  configForm: ConfigField[]
  
  // 依赖
  dependencies?: string[]
  
  // 健康检查
  healthCheck?: {
    type: 'http' | 'tcp' | 'command'
    endpoint?: string
    port?: number
    command?: string
    interval?: number
    timeout?: number
    retries?: number
  }
  
  // 标签
  tags: string[]
  
  // 统计
  downloads: number
  rating: number
  
  // 截图
  screenshots?: string[]
  
  // 最低要求
  requirements?: {
    memory?: number
    cpu?: number
    disk?: number
  }
}

/**
 * 已安装的应用实例
 */
export interface AppInstance {
  id: string
  templateId: string
  name: string
  displayName: string
  status: AppStatus
  serverId: string
  
  // 部署信息
  deployment: {
    type: DeploymentType
    containerId?: string
    composeProject?: string
    pid?: number
  }
  
  // 配置
  config: Record<string, any>
  
  // 端口映射
  ports: PortConfig[]
  
  // 访问地址
  accessUrl?: string
  
  // 时间戳
  installedAt: Date
  startedAt?: Date
  stoppedAt?: Date
  
  // 资源使用
  resources?: {
    cpu: number
    memory: number
    disk: number
  }
  
  // 日志
  logs?: string[]
}

/**
 * 应用部署选项
 */
export interface DeployOptions {
  serverId: string
  templateId: string
  name: string
  config: Record<string, any>
  autoStart?: boolean
}

/**
 * 应用操作结果
 */
export interface AppOperationResult {
  success: boolean
  message?: string
  error?: string
  data?: any
}
