import { ipcMain, dialog, shell } from 'electron'
import { GrpcClient } from '../grpc/client'
import { AIGateway } from '../ai/gateway'
import * as secureStorage from '../security/secureStorage'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { promisify } from 'util'

const gzip = promisify(zlib.gzip)

// 存储所有服务器连接
const serverConnections = new Map<string, GrpcClient>()
const aiGateway = new AIGateway()

// 存储活跃的流
const activeStreams = new Map<string, any>()

// 存储活跃的 Shell 会话
const activeShells = new Map<string, any>()

export function setupIpcHandlers() {
  // ==================== 服务器连接管理 ====================
  ipcMain.handle('server:connect', async (_, config: ServerConfig) => {
    try {
      const client = new GrpcClient(config)
      await client.connect()
      serverConnections.set(config.id, client)
      return { success: true, serverId: config.id }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('server:disconnect', async (_, serverId: string) => {
    const client = serverConnections.get(serverId)
    if (client) {
      await client.disconnect()
      serverConnections.delete(serverId)
    }
    return { success: true }
  })

  ipcMain.handle('server:list', async () => {
    return Array.from(serverConnections.keys())
  })

  ipcMain.handle('server:isConnected', async (_, serverId: string) => {
    const client = serverConnections.get(serverId)
    return client?.isConnected() ?? false
  })

  // ==================== 系统信息 ====================
  ipcMain.handle('server:getSystemInfo', async (_, serverId: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.getSystemInfo()
  })

  // ==================== 实时监控 ====================
  ipcMain.handle('server:startMetrics', async (event, serverId: string, interval: number) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }

    const streamKey = `metrics:${serverId}`
    // 停止已有的流
    if (activeStreams.has(streamKey)) {
      activeStreams.get(streamKey).removeAllListeners()
    }

    const stream = client.streamMetrics(interval)
    activeStreams.set(streamKey, stream)

    stream.on('data', (metrics: any) => {
      // 调试：打印收到的指标数据结构
      console.log('[Metrics Debug] Received metrics:', JSON.stringify(metrics, null, 2))
      console.log('[Metrics Debug] cpu_usage:', metrics.cpu_usage, 'cpuUsage:', metrics.cpuUsage)
      event.sender.send(`metrics:${serverId}`, metrics)
    })
    stream.on('error', (error: Error) => {
      event.sender.send(`metrics:error:${serverId}`, error.message)
    })
    stream.on('end', () => {
      activeStreams.delete(streamKey)
    })

    return { success: true }
  })

  ipcMain.handle('server:stopMetrics', async (_, serverId: string) => {
    const streamKey = `metrics:${serverId}`
    if (activeStreams.has(streamKey)) {
      activeStreams.get(streamKey).removeAllListeners()
      activeStreams.delete(streamKey)
    }
    return { success: true }
  })

  // ==================== 命令执行 ====================
  ipcMain.handle('server:executeCommand', async (_, serverId: string, command: string, args?: string[], options?: any) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.executeCommand(command, args, options)
  })

  // ==================== 容器管理（通过命令执行） ====================
  ipcMain.handle('container:list', async (_, serverId: string, all?: boolean) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.listContainers(all)
  })

  ipcMain.handle('container:get', async (_, serverId: string, containerId: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.getContainer(containerId)
  })

  ipcMain.handle('container:action', async (_, serverId: string, containerId: string, action: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.containerAction(containerId, action)
  })

  ipcMain.handle('container:logs', async (_, serverId: string, containerId: string, tail: number) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.containerLogs(containerId, tail)
  })

  // ==================== 镜像管理（通过命令执行） ====================
  ipcMain.handle('image:list', async (_, serverId: string, all?: boolean) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.listImages(all)
  })

  ipcMain.handle('image:pull', async (_, serverId: string, image: string, tag: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.pullImage(image, tag)
  })

  ipcMain.handle('image:remove', async (_, serverId: string, imageId: string, force?: boolean) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.removeImage(imageId, force)
  })

  // ==================== Docker Compose 管理（通过命令执行） ====================
  ipcMain.handle('compose:list', async (_, serverId: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.listComposeProjects()
  })

  ipcMain.handle('compose:get', async (_, serverId: string, projectName: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.getComposeProject(projectName)
  })

  ipcMain.handle('compose:up', async (_, serverId: string, projectPath: string, detach: boolean, build: boolean) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.composeUp(projectPath, detach, build)
  })

  ipcMain.handle('compose:down', async (_, serverId: string, projectPath: string, removeVolumes: boolean, removeImages: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.composeDown(projectPath, removeVolumes, removeImages)
  })

  ipcMain.handle('compose:restart', async (_, serverId: string, projectPath: string, services: string[]) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.composeRestart(projectPath, services)
  })

  ipcMain.handle('compose:stop', async (_, serverId: string, projectPath: string, services: string[]) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.composeStop(projectPath, services)
  })

  ipcMain.handle('compose:start', async (_, serverId: string, projectPath: string, services: string[]) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.composeStart(projectPath, services)
  })

  ipcMain.handle('compose:logs', async (_, serverId: string, projectPath: string, services: string[], tail: number) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.composeLogs(projectPath, services, tail)
  })

  ipcMain.handle('compose:pull', async (_, serverId: string, projectPath: string, services: string[]) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.composePull(projectPath, services)
  })

  ipcMain.handle('compose:build', async (_, serverId: string, projectPath: string, services: string[], noCache: boolean) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.composeBuild(projectPath, services, noCache)
  })

  ipcMain.handle('compose:validate', async (_, serverId: string, projectPath: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.validateComposeFile(projectPath)
  })

  // ==================== 文件管理 ====================
  ipcMain.handle('file:list', async (_, serverId: string, path: string, recursive?: boolean) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.listDirectory(path, recursive)
  })

  ipcMain.handle('file:read', async (_, serverId: string, path: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.readFile(path)
  })

  ipcMain.handle('file:write', async (_, serverId: string, path: string, content: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.writeFile(path, content)
  })

  ipcMain.handle('file:delete', async (_, serverId: string, path: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.deleteFile(path)
  })

  // ==================== 日志流 ====================
  ipcMain.handle('log:tail', async (event, serverId: string, path: string, lines: number, follow: boolean) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }

    const streamKey = `log:${serverId}:${path}`
    if (activeStreams.has(streamKey)) {
      activeStreams.get(streamKey).removeAllListeners()
    }

    const stream = client.streamLog(path, lines, follow)
    activeStreams.set(streamKey, stream)

    stream.on('data', (log: any) => {
      event.sender.send(`log:data:${path}`, log)
    })
    stream.on('error', (error: Error) => {
      event.sender.send(`log:error:${path}`, error.message)
    })
    stream.on('end', () => {
      activeStreams.delete(streamKey)
      event.sender.send(`log:end:${path}`)
    })

    return { success: true }
  })

  ipcMain.handle('log:stop', async (_, serverId: string, path: string) => {
    const streamKey = `log:${serverId}:${path}`
    if (activeStreams.has(streamKey)) {
      activeStreams.get(streamKey).removeAllListeners()
      activeStreams.delete(streamKey)
    }
    return { success: true }
  })

  // ==================== 服务管理 ====================
  ipcMain.handle('service:list', async (_, serverId: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.listServices()
  })

  ipcMain.handle('service:action', async (_, serverId: string, name: string, action: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.serviceAction(name, action)
  })

  // ==================== 进程管理 ====================
  ipcMain.handle('process:list', async (_, serverId: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.listProcesses()
  })

  ipcMain.handle('process:kill', async (_, serverId: string, pid: number, signal?: number) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.killProcess(pid, signal)
  })

  // ==================== Docker 网络管理（通过命令执行） ====================
  ipcMain.handle('network:list', async (_, serverId: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.listNetworks()
  })

  ipcMain.handle('network:create', async (_, serverId: string, name: string, driver?: string, subnet?: string, gateway?: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.createNetwork(name, driver, subnet, gateway)
  })

  ipcMain.handle('network:remove', async (_, serverId: string, networkId: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.removeNetwork(networkId)
  })

  // ==================== Docker 卷管理（通过命令执行） ====================
  ipcMain.handle('volume:list', async (_, serverId: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.listVolumes()
  })

  ipcMain.handle('volume:create', async (_, serverId: string, name: string, driver?: string) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.createVolume(name, driver)
  })

  ipcMain.handle('volume:remove', async (_, serverId: string, volumeName: string, force?: boolean) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.removeVolume(volumeName, force)
  })

  // ==================== AI 功能 ====================
  ipcMain.handle('ai:chat', async (event, message: string, context?: AIContext) => {
    return await aiGateway.chat(message, context, (chunk) => {
      event.sender.send('ai:stream', chunk)
    })
  })

  ipcMain.handle('ai:setProvider', async (_, provider: string, config: any) => {
    return aiGateway.setProvider(provider, config)
  })

  ipcMain.handle('ai:getProviders', async () => {
    return aiGateway.getProviders()
  })

  // ==================== 系统对话框 ====================
  ipcMain.handle('dialog:openFile', async (_, options: any) => {
    return await dialog.showOpenDialog(options)
  })

  ipcMain.handle('dialog:saveFile', async (_, options: any) => {
    return await dialog.showSaveDialog(options)
  })

  ipcMain.handle('dialog:message', async (_, options: any) => {
    return await dialog.showMessageBox(options)
  })

  ipcMain.handle('dialog:showOpenDialog', async (_, options: any) => {
    return await dialog.showOpenDialog(options)
  })

  // ==================== 本地文件系统 ====================
  ipcMain.handle('fs:scanDirectory', async (_, dirPath: string, options?: { ignore?: string[] }) => {
    const ignore = options?.ignore || ['node_modules', '.git', '__pycache__', '.venv', 'venv']
    const files: { name: string; path: string; size: number; isDir: boolean }[] = []
    
    function scan(currentPath: string, relativePath: string = '') {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        if (ignore.includes(entry.name)) continue
        
        const fullPath = path.join(currentPath, entry.name)
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
        
        if (entry.isDirectory()) {
          files.push({ name: entry.name, path: relPath, size: 0, isDir: true })
          scan(fullPath, relPath)
        } else {
          const stats = fs.statSync(fullPath)
          files.push({ name: entry.name, path: relPath, size: stats.size, isDir: false })
        }
      }
    }
    
    scan(dirPath)
    return files
  })

  ipcMain.handle('fs:packDirectory', async (_, dirPath: string, options?: { ignore?: string[] }) => {
    const ignore = options?.ignore || ['node_modules', '.git', '__pycache__', '.venv', 'venv', '.next', '.nuxt', 'target', 'vendor', 'dist', 'build']
    
    // 使用 tar 格式打包（简化版，直接创建 tar 数据）
    const tarChunks: Buffer[] = []
    
    function addFile(filePath: string, relativePath: string) {
      const stats = fs.statSync(filePath)
      const content = fs.readFileSync(filePath)
      
      // TAR header (512 bytes)
      const header = Buffer.alloc(512)
      
      // 文件名 (100 bytes)
      header.write(relativePath.slice(0, 99), 0, 100)
      
      // 文件模式 (8 bytes)
      header.write('0000644 ', 100, 8)
      
      // UID (8 bytes)
      header.write('0000000 ', 108, 8)
      
      // GID (8 bytes)
      header.write('0000000 ', 116, 8)
      
      // 文件大小 (12 bytes, octal)
      header.write(stats.size.toString(8).padStart(11, '0') + ' ', 124, 12)
      
      // 修改时间 (12 bytes, octal)
      header.write(Math.floor(stats.mtime.getTime() / 1000).toString(8).padStart(11, '0') + ' ', 136, 12)
      
      // 校验和占位 (8 bytes)
      header.write('        ', 148, 8)
      
      // 类型标志 (1 byte) - '0' 表示普通文件
      header.write('0', 156, 1)
      
      // 计算校验和
      let checksum = 0
      for (let i = 0; i < 512; i++) {
        checksum += header[i]
      }
      header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8)
      
      tarChunks.push(header)
      tarChunks.push(content)
      
      // 填充到 512 字节边界
      const padding = 512 - (content.length % 512)
      if (padding < 512) {
        tarChunks.push(Buffer.alloc(padding))
      }
    }
    
    function scanAndAdd(currentPath: string, relativePath: string = '') {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        if (ignore.includes(entry.name)) continue
        
        const fullPath = path.join(currentPath, entry.name)
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
        
        if (entry.isDirectory()) {
          scanAndAdd(fullPath, relPath)
        } else {
          try {
            addFile(fullPath, relPath)
          } catch (e) {
            console.error(`Failed to add file ${fullPath}:`, e)
          }
        }
      }
    }
    
    scanAndAdd(dirPath)
    
    // 添加 tar 结束标记 (两个 512 字节的空块)
    tarChunks.push(Buffer.alloc(1024))
    
    const tarData = Buffer.concat(tarChunks)
    
    // gzip 压缩
    const gzipped = await gzip(tarData)
    return gzipped
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    return fs.readFileSync(filePath)
  })

  // ==================== 外部链接 ====================
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('shell:openPath', async (_, path: string) => {
    await shell.openPath(path)
  })

  // ==================== 交互式 Shell ====================
  ipcMain.handle('terminal:start', async (event, serverId: string, sessionId: string, rows: number, cols: number) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }

    const shellKey = `shell:${serverId}:${sessionId}`

    // 如果已存在，先关闭
    if (activeShells.has(shellKey)) {
      const oldShell = activeShells.get(shellKey)
      oldShell.end()
      activeShells.delete(shellKey)
    }

    const shellStream = client.createShell(rows, cols)
    activeShells.set(shellKey, shellStream)

    shellStream.on('data', (data: { data: Buffer }) => {
      if (data.data) {
        event.sender.send(`terminal:data:${sessionId}`, data.data.toString())
      }
    })

    shellStream.on('error', (error: Error) => {
      event.sender.send(`terminal:error:${sessionId}`, error.message)
      activeShells.delete(shellKey)
    })

    shellStream.on('end', () => {
      event.sender.send(`terminal:end:${sessionId}`)
      activeShells.delete(shellKey)
    })

    return { success: true, sessionId }
  })

  ipcMain.handle('terminal:write', async (_, serverId: string, sessionId: string, data: string) => {
    const shellKey = `shell:${serverId}:${sessionId}`
    const shellStream = activeShells.get(shellKey)
    if (!shellStream) {
      throw new Error('Shell session not found')
    }
    shellStream.write({ data: Buffer.from(data) })
    return { success: true }
  })

  ipcMain.handle('terminal:resize', async (_, serverId: string, sessionId: string, rows: number, cols: number) => {
    const shellKey = `shell:${serverId}:${sessionId}`
    const shellStream = activeShells.get(shellKey)
    if (!shellStream) {
      throw new Error('Shell session not found')
    }
    shellStream.write({ resize: { rows, cols } })
    return { success: true }
  })

  ipcMain.handle('terminal:stop', async (_, serverId: string, sessionId: string) => {
    const shellKey = `shell:${serverId}:${sessionId}`
    const shellStream = activeShells.get(shellKey)
    if (shellStream) {
      shellStream.end()
      activeShells.delete(shellKey)
    }
    return { success: true }
  })

  // ==================== 安全凭据存储 ====================
  ipcMain.handle('secure:isAvailable', async () => {
    return secureStorage.isEncryptionAvailable()
  })

  ipcMain.handle('secure:setCredential', async (_, key: string, value: string) => {
    try {
      secureStorage.setCredential(key, value)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('secure:getCredential', async (_, key: string) => {
    try {
      const value = secureStorage.getCredential(key)
      return { success: true, value }
    } catch (error) {
      return { success: false, error: (error as Error).message, value: null }
    }
  })

  ipcMain.handle('secure:deleteCredential', async (_, key: string) => {
    try {
      secureStorage.deleteCredential(key)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('secure:hasCredential', async (_, key: string) => {
    try {
      return secureStorage.hasCredential(key)
    } catch (error) {
      return false
    }
  })

  ipcMain.handle('secure:listKeys', async () => {
    try {
      return secureStorage.listCredentialKeys()
    } catch (error) {
      return []
    }
  })

  ipcMain.handle('secure:clearAll', async () => {
    try {
      secureStorage.clearAllCredentials()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}

// 类型定义
interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  token: string
  useTls?: boolean
}

interface AIContext {
  serverId?: string
  history?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
}
