// ServerHub 客户端类型定义
// 这些类型与 gRPC/protobuf API 格式匹配（使用 snake_case）

// ==================== 服务器相关类型 ====================

export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  token: string
  useTls?: boolean
}

export interface ServerConnectResult {
  success: boolean
  serverId?: string
  error?: string
}

// API 返回的系统信息（snake_case 格式）
export interface ApiSystemInfo {
  hostname: string
  os: string
  platform: string
  platform_version: string
  kernel_version: string
  arch: string
  uptime: number
  boot_time: number
  cpu: ApiCpuInfo | null
  memory: ApiMemoryInfo | null
  disks: ApiDiskInfo[]
  networks: ApiNetworkInfo[]
  gpus: ApiGpuInfo[]
}

export interface ApiCpuInfo {
  model: string
  cores: number
  threads: number
  frequency: number
  usage_per_core: number[]
}

export interface ApiMemoryInfo {
  total: number
  available: number
  used: number
  used_percent: number
  swap_total: number
  swap_used: number
}

export interface ApiDiskInfo {
  device: string
  mountpoint: string
  fstype: string
  total: number
  used: number
  free: number
  used_percent: number
}

export interface ApiNetworkInfo {
  name: string
  addresses: string[]
  mac: string
  bytes_sent: number
  bytes_recv: number
}

export interface ApiGpuInfo {
  name: string
  driver_version: string
  memory_total: number
  memory_used: number
  temperature: number
  utilization: number
}

// ==================== 监控指标类型 ====================

export interface Metrics {
  timestamp: string
  cpu_usage: number
  memory_usage: number
  disk_metrics: DiskMetric[]
  network_metrics: NetworkMetric[]
  load_1: number
  load_5: number
  load_15: number
}

export interface DiskMetric {
  device: string
  read_bytes: number
  write_bytes: number
  read_count: number
  write_count: number
}

export interface NetworkMetric {
  interface: string
  bytes_sent: number
  bytes_recv: number
  packets_sent: number
  packets_recv: number
}

// ==================== 命令执行类型 ====================

export interface CommandResult {
  exit_code: number
  stdout: string
  stderr: string
  duration_ms: number
}

// ==================== 容器相关类型 ====================

export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: string
  state: string
  created: number
  ports: PortBinding[]
  labels: Record<string, string>
  stats: ContainerStats | null
}

export interface PortBinding {
  container_port: string
  host_port: string
  protocol: string
}

export interface ContainerStats {
  cpu_percent: number
  memory_usage: number
  memory_limit: number
  network_rx: number
  network_tx: number
  block_read: number
  block_write: number
}

export interface ContainerListResult {
  containers: ContainerInfo[]
}

export interface ContainerActionResult {
  success: boolean
  message?: string
  error?: string
}

export type ContainerAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove'

// ==================== 镜像相关类型 ====================

export interface ImageInfo {
  id: string
  tags: string[]
  size: number
  created: number
}

export interface ImageListResult {
  images: ImageInfo[]
}

// ==================== Docker Compose 相关类型 ====================

export interface ComposeProject {
  name: string
  status: string
  config_files: string
  services: ComposeService[]
}

export interface ComposeService {
  name: string
  image: string
  status: string
  state: string
  health: string
  ports: string
  replicas: string
  exit_code: number
}

export interface ComposeProjectListResult {
  projects: ComposeProject[]
}

export interface ComposeUpOptions {
  project_path: string
  detach?: boolean
  build?: boolean
  services?: string[]
}

export interface ComposeDownOptions {
  project_path: string
  remove_volumes?: boolean
  remove_images?: string
}

export interface ComposeServiceOptions {
  project_path: string
  services?: string[]
}

export interface ComposeBuildOptions {
  project_path: string
  services?: string[]
  no_cache?: boolean
}

export interface ComposeLogOptions {
  project_path: string
  services?: string[]
  follow?: boolean
  tail?: number
}

export interface ComposeValidationResult {
  valid: boolean
  message: string
  error?: string
}

// ==================== 文件相关类型 ====================

export interface FileInfo {
  name: string
  path: string
  size: number
  mode: number
  mod_time: number
  is_dir: boolean
  owner: string
  group: string
}

export interface FileContent {
  content: string | Uint8Array
  info: FileInfo
}

export interface DirContent {
  path: string
  files: FileInfo[]
}

export interface FileWriteResult {
  success: boolean
  message?: string
  error?: string
}

// ==================== 服务相关类型 ====================

export interface ServiceInfo {
  name: string
  status: string
  description: string
  enabled: boolean
  pid: number
  uptime: number
}

export interface ServiceListResult {
  services: ServiceInfo[]
}

export interface ServiceActionResult {
  success: boolean
  message?: string
  error?: string
}

export type ServiceAction = 'start' | 'stop' | 'restart' | 'enable' | 'disable'

// ==================== 进程相关类型 ====================

export interface ProcessInfo {
  pid: number
  ppid: number
  name: string
  user: string
  status: string
  cpu_percent: number
  memory_percent: number
  memory_rss: number
  create_time: number
  cmdline: string
}

export interface ProcessListResult {
  processes: ProcessInfo[]
}

// ==================== AI 相关类型 ====================

export interface AIContext {
  serverId?: string
  history?: ChatMessage[]
  systemPrompt?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIProviderConfig {
  provider: 'openai' | 'claude' | 'ollama' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
}

// ==================== 对话框相关类型 ====================

export interface OpenDialogOptions {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  filters?: FileFilter[]
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>
}

export interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  filters?: FileFilter[]
}

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface OpenDialogResult {
  canceled: boolean
  filePaths: string[]
}

export interface SaveDialogResult {
  canceled: boolean
  filePath?: string
}

// ==================== Electron API 类型 ====================

// SystemInfo 类型别名（用于 ElectronAPI，实际是 ApiSystemInfo）
export type SystemInfo = ApiSystemInfo

export interface ElectronAPI {
  server: {
    connect: (config: ServerConfig) => Promise<ServerConnectResult>
    disconnect: (serverId: string) => Promise<{ success: boolean }>
    list: () => Promise<string[]>
    getSystemInfo: (serverId: string) => Promise<any>  // Returns API format, store transforms it
    startMetrics: (serverId: string, interval: number) => Promise<{ success: boolean }>
    executeCommand: (serverId: string, command: string, args?: string[], options?: { timeout?: number; sudo?: boolean }) => Promise<CommandResult>
    onMetrics: (serverId: string, callback: (metrics: Metrics) => void) => () => void
  }
  container: {
    list: (serverId: string, all?: boolean) => Promise<ContainerListResult>
    action: (serverId: string, containerId: string, action: ContainerAction) => Promise<ContainerActionResult>
  }
  compose: {
    list: (serverId: string) => Promise<ComposeProjectListResult>
    get: (serverId: string, projectName: string) => Promise<ComposeProject>
    up: (serverId: string, options: ComposeUpOptions, onOutput?: (line: string) => void) => Promise<void>
    down: (serverId: string, options: ComposeDownOptions, onOutput?: (line: string) => void) => Promise<void>
    restart: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void) => Promise<void>
    stop: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void) => Promise<void>
    start: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void) => Promise<void>
    logs: (serverId: string, options: ComposeLogOptions, onLog?: (line: string) => void) => Promise<void>
    pull: (serverId: string, options: ComposeServiceOptions, onOutput?: (line: string) => void) => Promise<void>
    build: (serverId: string, options: ComposeBuildOptions, onOutput?: (line: string) => void) => Promise<void>
    validate: (serverId: string, projectPath: string) => Promise<ComposeValidationResult>
  }
  service: {
    list: (serverId: string) => Promise<ServiceListResult>
    action: (serverId: string, name: string, action: ServiceAction) => Promise<ServiceActionResult>
  }
  process: {
    list: (serverId: string) => Promise<ProcessListResult>
    kill: (serverId: string, pid: number, signal?: number) => Promise<{ success: boolean; error?: string }>
  }
  file: {
    list: (serverId: string, path: string) => Promise<DirContent>
    read: (serverId: string, path: string) => Promise<FileContent>
    write: (serverId: string, path: string, content: string) => Promise<FileWriteResult>
  }
  ai: {
    chat: (message: string, context?: AIContext) => Promise<string>
    setProvider: (provider: string, config: AIProviderConfig) => Promise<boolean>
    onStream: (callback: (chunk: string) => void) => () => void
  }
  dialog: {
    openFile: (options: OpenDialogOptions) => Promise<OpenDialogResult>
    saveFile: (options: SaveDialogOptions) => Promise<SaveDialogResult>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
  }
  terminal: {
    start: (serverId: string, sessionId: string, rows: number, cols: number) => Promise<{ success: boolean; sessionId: string }>
    write: (serverId: string, sessionId: string, data: string) => Promise<{ success: boolean }>
    resize: (serverId: string, sessionId: string, rows: number, cols: number) => Promise<{ success: boolean }>
    stop: (serverId: string, sessionId: string) => Promise<{ success: boolean }>
    onData: (sessionId: string, callback: (data: string) => void) => () => void
    onError: (sessionId: string, callback: (error: string) => void) => () => void
    onEnd: (sessionId: string, callback: () => void) => () => void
  }
  log: {
    tail: (serverId: string, path: string, lines: number, follow: boolean) => Promise<{ success: boolean }>
    stop: (serverId: string, path: string) => Promise<{ success: boolean }>
    onData: (path: string, callback: (data: { line: string }) => void) => () => void
    onError: (path: string, callback: (error: string) => void) => () => void
    onEnd: (path: string, callback: () => void) => () => void
  }
  secure: {
    isAvailable: () => Promise<boolean>
    setCredential: (key: string, value: string) => Promise<{ success: boolean; error?: string }>
    getCredential: (key: string) => Promise<{ success: boolean; value: string | null; error?: string }>
    deleteCredential: (key: string) => Promise<{ success: boolean; error?: string }>
    hasCredential: (key: string) => Promise<boolean>
    listKeys: () => Promise<string[]>
    clearAll: () => Promise<{ success: boolean; error?: string }>
  }
}

// 全局 Window 接口扩展
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
