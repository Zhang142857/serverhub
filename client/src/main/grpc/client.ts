import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { join } from 'path'
import { EventEmitter } from 'events'
import { app } from 'electron'
import type {
  ServerConfig,
  ApiSystemInfo,
  Metrics,
  CommandResult,
  DirContent,
  FileContent,
  ServiceInfo,
  ProcessInfo
} from '../../types'

// 根据运行环境确定 proto 文件路径
function getProtoPath(): string {
  if (app.isPackaged) {
    // 打包后从 resources 目录加载
    return join(process.resourcesPath, 'proto', 'agent.proto')
  } else {
    // 开发环境从项目根目录加载
    return join(__dirname, '../../../../proto/agent.proto')
  }
}

// gRPC 响应类型
interface ActionResponse {
  success: boolean
  message: string
  error: string
}

interface ServiceListResponse {
  services: ServiceInfo[]
}

interface ProcessListResponse {
  processes: ProcessInfo[]
}

interface LogLine {
  content: string
  timestamp: string
}

export class GrpcClient extends EventEmitter {
  private client: any
  private updateClient: any
  private config: ServerConfig
  private connected: boolean = false
  private metadata: grpc.Metadata

  constructor(config: ServerConfig) {
    super()
    this.config = config
    this.metadata = new grpc.Metadata()
    this.metadata.set('authorization', `Bearer ${config.token}`)
  }

  async connect(): Promise<void> {
    const PROTO_PATH = getProtoPath()
    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    })

    const proto = grpc.loadPackageDefinition(packageDefinition) as any

    let credentials: grpc.ChannelCredentials
    if (this.config.useTls) {
      // 自签名证书：跳过 CA 验证，仍然加密传输
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      credentials = grpc.credentials.createSsl()
    } else {
      credentials = grpc.credentials.createInsecure()
    }

    const address = `${this.config.host}:${this.config.port}`
    this.client = new proto.runixo.AgentService(address, credentials)
    this.updateClient = new proto.runixo.UpdateService(address, credentials)

    // 测试连接
    return new Promise((resolve, reject) => {
      this.client.Authenticate(
        { token: this.config.token, client_version: '0.1.0' },
        (error: any, response: any) => {
          if (error) {
            reject(new Error(`Connection failed: ${error.message}`))
          } else if (!response.success) {
            reject(new Error(`Authentication failed: ${response.message}`))
          } else {
            this.connected = true
            resolve()
          }
        }
      )
    })
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      grpc.closeClient(this.client)
      this.connected = false
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  // 系统信息
  async getSystemInfo(): Promise<ApiSystemInfo> {
    return this.unaryCall<ApiSystemInfo>('GetSystemInfo', {})
  }

  // 实时监控流
  streamMetrics(intervalSeconds: number = 2): EventEmitter {
    const emitter = new EventEmitter()
    const call = this.client.GetMetrics(
      { interval_seconds: intervalSeconds },
      this.metadata
    )

    call.on('data', (data: Metrics) => emitter.emit('data', data))
    call.on('error', (error: Error) => emitter.emit('error', error))
    call.on('end', () => emitter.emit('end'))

    return emitter
  }

  // 命令执行
  async executeCommand(command: string, args?: string[], options?: {
    workingDir?: string
    env?: Record<string, string>
    timeout?: number
    sudo?: boolean
  }): Promise<CommandResult> {
    return this.unaryCall<CommandResult>('ExecuteCommand', {
      command,
      args: args || [],
      working_dir: options?.workingDir || '',
      env: options?.env || {},
      timeout_seconds: options?.timeout || 60,
      sudo: options?.sudo || false
    })
  }

  // 交互式Shell
  createShell(rows: number = 24, cols: number = 80): grpc.ClientDuplexStream<unknown, unknown> {
    const call = this.client.ExecuteShell(this.metadata)

    // 发送启动消息
    call.write({
      start: {
        shell: 'bash',
        rows,
        cols
      }
    })

    return call
  }

  // 文件操作
  async listDirectory(path: string, recursive: boolean = false): Promise<DirContent> {
    return this.unaryCall<DirContent>('ListDirectory', { path, recursive, show_hidden: true })
  }

  async readFile(path: string): Promise<FileContent> {
    return this.unaryCall<FileContent>('ReadFile', { path })
  }

  async writeFile(path: string, content: string, mode: number = 0o644): Promise<ActionResponse> {
    return this.unaryCall<ActionResponse>('WriteFile', {
      path,
      content: Buffer.from(content),
      mode,
      create_dirs: true
    })
  }

  async deleteFile(path: string): Promise<ActionResponse> {
    return this.unaryCall<ActionResponse>('DeleteFile', { path })
  }

  // 日志流
  streamLog(path: string, lines: number = 100, follow: boolean = true): EventEmitter {
    const emitter = new EventEmitter()
    const call = this.client.TailLog(
      { path, lines, follow },
      this.metadata
    )

    call.on('data', (data: LogLine) => emitter.emit('data', data))
    call.on('error', (error: Error) => emitter.emit('error', error))
    call.on('end', () => emitter.emit('end'))

    return emitter
  }

  // 服务管理
  async listServices(): Promise<ServiceListResponse> {
    return this.unaryCall<ServiceListResponse>('ListServices', {})
  }

  async serviceAction(name: string, action: string): Promise<ActionResponse> {
    const actionMap: Record<string, number> = {
      start: 0,
      stop: 1,
      restart: 2,
      enable: 3,
      disable: 4
    }
    return this.unaryCall<ActionResponse>('ServiceAction', {
      name,
      action: actionMap[action] ?? 0
    })
  }

  // 进程管理
  async listProcesses(): Promise<ProcessListResponse> {
    return this.unaryCall<ProcessListResponse>('ListProcesses', {})
  }

  async killProcess(pid: number, signal: number = 15): Promise<ActionResponse> {
    return this.unaryCall<ActionResponse>('KillProcess', { pid, signal })
  }

  // ==================== Docker 操作（通过命令执行） ====================

  // 容器管理
  async listContainers(all: boolean = false): Promise<CommandResult> {
    const args = ['ps', '--format', '{{json .}}']
    if (all) args.push('-a')
    return this.executeCommand('docker', args)
  }

  async getContainer(containerId: string): Promise<CommandResult> {
    return this.executeCommand('docker', ['inspect', containerId])
  }

  async containerAction(containerId: string, action: string): Promise<CommandResult> {
    return this.executeCommand('docker', [action, containerId])
  }

  async containerLogs(containerId: string, tail: number = 100): Promise<CommandResult> {
    return this.executeCommand('docker', ['logs', '--tail', String(tail), containerId])
  }

  // 镜像管理
  async listImages(all: boolean = false): Promise<CommandResult> {
    const args = ['images', '--format', '{{json .}}']
    if (all) args.push('-a')
    return this.executeCommand('docker', args)
  }

  async pullImage(image: string, tag: string = 'latest'): Promise<CommandResult> {
    return this.executeCommand('docker', ['pull', `${image}:${tag}`], { timeout: 600 })
  }

  async removeImage(imageId: string, force: boolean = false): Promise<CommandResult> {
    const args = ['rmi', imageId]
    if (force) args.push('-f')
    return this.executeCommand('docker', args)
  }

  // Docker Compose 管理
  async listComposeProjects(): Promise<CommandResult> {
    return this.executeCommand('docker', ['compose', 'ls', '--format', 'json'])
  }

  async getComposeProject(projectName: string): Promise<CommandResult> {
    return this.executeCommand('docker', ['compose', '-p', projectName, 'ps', '--format', 'json'])
  }

  async composeUp(projectPath: string, detach: boolean = true, build: boolean = false): Promise<CommandResult> {
    const args = ['compose', '-f', projectPath, 'up']
    if (detach) args.push('-d')
    if (build) args.push('--build')
    return this.executeCommand('docker', args, { timeout: 600 })
  }

  async composeDown(projectPath: string, removeVolumes: boolean = false, removeImages: string = ''): Promise<CommandResult> {
    const args = ['compose', '-f', projectPath, 'down']
    if (removeVolumes) args.push('-v')
    if (removeImages) args.push('--rmi', removeImages)
    return this.executeCommand('docker', args)
  }

  async composeRestart(projectPath: string, services: string[] = []): Promise<CommandResult> {
    const args = ['compose', '-f', projectPath, 'restart', ...services]
    return this.executeCommand('docker', args)
  }

  async composeStop(projectPath: string, services: string[] = []): Promise<CommandResult> {
    const args = ['compose', '-f', projectPath, 'stop', ...services]
    return this.executeCommand('docker', args)
  }

  async composeStart(projectPath: string, services: string[] = []): Promise<CommandResult> {
    const args = ['compose', '-f', projectPath, 'start', ...services]
    return this.executeCommand('docker', args)
  }

  async composeLogs(projectPath: string, services: string[] = [], tail: number = 100): Promise<CommandResult> {
    const args = ['compose', '-f', projectPath, 'logs', '--tail', String(tail), ...services]
    return this.executeCommand('docker', args)
  }

  async composePull(projectPath: string, services: string[] = []): Promise<CommandResult> {
    const args = ['compose', '-f', projectPath, 'pull', ...services]
    return this.executeCommand('docker', args, { timeout: 600 })
  }

  async composeBuild(projectPath: string, services: string[] = [], noCache: boolean = false): Promise<CommandResult> {
    const args = ['compose', '-f', projectPath, 'build', ...services]
    if (noCache) args.push('--no-cache')
    return this.executeCommand('docker', args, { timeout: 600 })
  }

  async validateComposeFile(projectPath: string): Promise<CommandResult> {
    return this.executeCommand('docker', ['compose', '-f', projectPath, 'config', '--quiet'])
  }

  // Docker 网络管理
  async listNetworks(): Promise<CommandResult> {
    return this.executeCommand('docker', ['network', 'ls', '--format', '{{json .}}'])
  }

  async createNetwork(name: string, driver: string = 'bridge', subnet?: string, gateway?: string): Promise<CommandResult> {
    const args = ['network', 'create', '--driver', driver]
    if (subnet) args.push('--subnet', subnet)
    if (gateway) args.push('--gateway', gateway)
    args.push(name)
    return this.executeCommand('docker', args)
  }

  async removeNetwork(networkId: string): Promise<CommandResult> {
    return this.executeCommand('docker', ['network', 'rm', networkId])
  }

  // Docker 卷管理
  async listVolumes(): Promise<CommandResult> {
    return this.executeCommand('docker', ['volume', 'ls', '--format', '{{json .}}'])
  }

  async createVolume(name: string, driver: string = 'local'): Promise<CommandResult> {
    return this.executeCommand('docker', ['volume', 'create', '--driver', driver, name])
  }

  async removeVolume(volumeName: string, force: boolean = false): Promise<CommandResult> {
    const args = ['volume', 'rm', volumeName]
    if (force) args.push('-f')
    return this.executeCommand('docker', args)
  }

  // 流式文件上传
  async uploadFile(
    localData: Buffer | Uint8Array,
    remotePath: string,
    options?: {
      mode?: number
      createDirs?: boolean
      isTarGz?: boolean
      extractTo?: string
      onProgress?: (sent: number, total: number) => void
    }
  ): Promise<{ success: boolean; message: string; bytesWritten: number; path: string }> {
    return new Promise((resolve, reject) => {
      const call = this.client.UploadFile(this.metadata, (error: Error | null, response: any) => {
        if (error) {
          reject(error)
        } else {
          resolve({
            success: response.success,
            message: response.message || response.error || '',
            bytesWritten: parseInt(response.bytes_written || '0', 10),
            path: response.path || remotePath
          })
        }
      })

      const data = localData instanceof Buffer ? localData : Buffer.from(localData)
      const totalSize = data.length
      const chunkSize = 64 * 1024 // 64KB chunks

      // 发送开始消息
      call.write({
        start: {
          path: remotePath,
          total_size: totalSize,
          mode: options?.mode || 0o644,
          create_dirs: options?.createDirs ?? true,
          is_tar_gz: options?.isTarGz ?? false,
          extract_to: options?.extractTo || ''
        }
      })

      // 分块发送数据
      let sent = 0
      const sendChunk = () => {
        while (sent < totalSize) {
          const end = Math.min(sent + chunkSize, totalSize)
          const chunk = data.slice(sent, end)
          
          const canContinue = call.write({ chunk })
          sent = end

          if (options?.onProgress) {
            options.onProgress(sent, totalSize)
          }

          if (!canContinue) {
            // 等待 drain 事件
            call.once('drain', sendChunk)
            return
          }
        }

        // 发送结束消息
        call.write({ end: {} })
        call.end()
      }

      sendChunk()

      call.on('error', (err: Error) => {
        reject(err)
      })
    })
  }

  // ==================== 更新服务 ====================

  async checkUpdate(): Promise<{
    available: boolean; current_version: string; latest_version: string
    release_notes: string; download_url: string; size: number
    checksum: string; release_date: string; is_critical: boolean
  }> {
    return new Promise((resolve, reject) => {
      this.updateClient.CheckUpdate({}, this.metadata, (err: Error | null, res: any) => {
        err ? reject(err) : resolve(res)
      })
    })
  }

  async applyUpdate(version: string): Promise<ActionResponse> {
    return new Promise((resolve, reject) => {
      this.updateClient.ApplyUpdate({ version }, this.metadata, (err: Error | null, res: any) => {
        err ? reject(err) : resolve(res)
      })
    })
  }

  // 通用一元调用
  private unaryCall<T>(method: string, request: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      this.client[method](request, this.metadata, (error: Error | null, response: T) => {
        if (error) {
          reject(error)
        } else {
          resolve(response)
        }
      })
    })
  }

  // ==================== Docker Hub 搜索（服务端代理） ====================
  
  async searchDockerHub(query: string, pageSize: number = 25, page: number = 1): Promise<{
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
  }> {
    return this.unaryCall('SearchDockerHub', {
      query,
      page_size: pageSize,
      page
    })
  }

  // HTTP 代理请求
  async proxyHttpRequest(options: {
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
  }> {
    return this.unaryCall('ProxyHttpRequest', {
      url: options.url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body || Buffer.alloc(0),
      timeout_seconds: options.timeout || 30
    })
  }
}
