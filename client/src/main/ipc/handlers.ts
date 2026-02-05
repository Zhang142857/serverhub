import { ipcMain, dialog, shell, net } from 'electron'
import { GrpcClient } from '../grpc/client'
import { AIGateway } from '../ai/gateway'
import * as secureStorage from '../security/secureStorage'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { promisify } from 'util'
import { execSync } from 'child_process'
import * as os from 'os'
import * as https from 'https'

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

  // ==================== Docker Hub 搜索（服务端代理） ====================
  ipcMain.handle('docker:searchHub', async (_, serverId: string, query: string, pageSize?: number, page?: number) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.searchDockerHub(query, pageSize || 25, page || 1)
  })

  ipcMain.handle('docker:proxyRequest', async (_, serverId: string, options: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: Buffer
    timeout?: number
  }) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }
    return await client.proxyHttpRequest(options)
  })

  // ==================== AI 功能 ====================

  // 设置工具执行器
  aiGateway.setToolExecutor({
    executeCommand: async (serverId, command, args, options) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.executeCommand(command, args, options)
    },
    listContainers: async (serverId, all) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.listContainers(all)
    },
    containerAction: async (serverId, containerId, action) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.containerAction(containerId, action)
    },
    containerLogs: async (serverId, containerId, tail) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.containerLogs(containerId, tail)
    },
    readFile: async (serverId, path) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.readFile(path)
    },
    writeFile: async (serverId, path, content) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.writeFile(path, content)
    },
    listDirectory: async (serverId, path, recursive) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.listDirectory(path, recursive)
    },
    deleteFile: async (serverId, path) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.deleteFile(path)
    },
    getSystemInfo: async (serverId) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.getSystemInfo()
    },
    listServices: async (serverId) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.listServices()
    },
    serviceAction: async (serverId, name, action) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.serviceAction(name, action)
    },
    listProcesses: async (serverId) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.listProcesses()
    },
    killProcess: async (serverId, pid, signal) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.killProcess(pid, signal)
    },
    listImages: async (serverId, all) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.listImages(all)
    },
    pullImage: async (serverId, image, tag) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.pullImage(image, tag)
    },
    removeImage: async (serverId, imageId, force) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.removeImage(imageId, force)
    },
    listNetworks: async (serverId) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.listNetworks()
    },
    listVolumes: async (serverId) => {
      const client = serverConnections.get(serverId)
      if (!client) throw new Error('Server not connected')
      return await client.listVolumes()
    }
  })

  ipcMain.handle('ai:chat', async (event, message: string, context?: AIContext) => {
    return await aiGateway.chat(message, context, (chunk) => {
      event.sender.send('ai:stream', chunk)
    })
  })

  ipcMain.handle('ai:executeAgent', async (event, message: string, context?: AIContext) => {
    // 转发 Agent 事件到渲染进程
    const onStep = (step: any) => event.sender.send('ai:agent:step', step)
    const onPlan = (plan: any) => event.sender.send('ai:agent:plan', plan)
    const onConfirm = (data: any) => event.sender.send('ai:agent:confirm', data)

    aiGateway.on('agent:step', onStep)
    aiGateway.on('agent:plan', onPlan)
    aiGateway.on('agent:confirm', onConfirm)

    try {
      const result = await aiGateway.executeAgent(message, context || {})
      return result
    } finally {
      aiGateway.off('agent:step', onStep)
      aiGateway.off('agent:plan', onPlan)
      aiGateway.off('agent:confirm', onConfirm)
    }
  })

  ipcMain.handle('ai:getAvailableTools', async () => {
    return aiGateway.getAvailableTools()
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
    
    // 创建临时文件
    const tempDir = os.tmpdir()
    const tarFile = path.join(tempDir, `upload_${Date.now()}.tar.gz`)
    
    console.log('[packDirectory] Source dir:', dirPath)
    console.log('[packDirectory] Temp tar file:', tarFile)
    console.log('[packDirectory] Ignore list:', ignore)
    
    try {
      // 构建排除参数 - Windows tar 使用不同的格式
      const isWindows = process.platform === 'win32'
      const excludeArgs = ignore.map(i => `--exclude=${i}`).join(' ')
      
      // 使用系统 tar 命令打包
      const cmd = `tar -czf "${tarFile}" ${excludeArgs} -C "${dirPath}" .`
      console.log('[packDirectory] Running:', cmd)
      
      try {
        execSync(cmd, { 
          stdio: 'pipe', 
          windowsHide: true,
          encoding: 'utf8'
        })
      } catch (execError: any) {
        console.error('[packDirectory] Tar command failed:', execError.message)
        if (execError.stderr) {
          console.error('[packDirectory] Stderr:', execError.stderr)
        }
        throw execError
      }
      
      // 检查文件是否创建成功
      if (!fs.existsSync(tarFile)) {
        throw new Error('Tar file was not created')
      }
      
      const stats = fs.statSync(tarFile)
      console.log(`[packDirectory] Tar file created, size: ${stats.size} bytes`)
      
      if (stats.size < 100) {
        throw new Error(`Tar file too small (${stats.size} bytes), something went wrong`)
      }
      
      // 读取打包后的文件
      const result = fs.readFileSync(tarFile)
      console.log(`[packDirectory] Read tar.gz, buffer size: ${result.length} bytes`)
      
      return result
    } catch (error) {
      console.error('[packDirectory] Error:', error)
      throw error
    } finally {
      // 清理临时文件
      try {
        if (fs.existsSync(tarFile)) {
          fs.unlinkSync(tarFile)
          console.log('[packDirectory] Cleaned up temp file')
        }
      } catch (e) {
        console.error('[packDirectory] Failed to cleanup temp file:', e)
      }
    }
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    return fs.readFileSync(filePath)
  })

  // ==================== 流式文件上传 ====================
  ipcMain.handle('file:uploadStream', async (event, serverId: string, localData: Buffer | Uint8Array | { type: string; data: number[] }, remotePath: string, options?: {
    mode?: number
    createDirs?: boolean
    isTarGz?: boolean
    extractTo?: string
  }) => {
    const client = serverConnections.get(serverId)
    if (!client) {
      throw new Error('Server not connected')
    }

    // 处理 IPC 序列化后的 Buffer
    let data: Buffer
    if (Buffer.isBuffer(localData)) {
      data = localData
    } else if (localData instanceof Uint8Array) {
      data = Buffer.from(localData)
    } else if (localData && typeof localData === 'object' && localData.type === 'Buffer' && Array.isArray(localData.data)) {
      data = Buffer.from(localData.data)
    } else {
      throw new Error('Invalid data format')
    }

    console.log(`[uploadStream] Uploading ${data.length} bytes to ${remotePath}`)

    return await client.uploadFile(data, remotePath, {
      mode: options?.mode,
      createDirs: options?.createDirs,
      isTarGz: options?.isTarGz,
      extractTo: options?.extractTo,
      onProgress: (sent, total) => {
        const percent = Math.floor((sent / total) * 100)
        event.sender.send(`upload:progress:${remotePath}`, { sent, total, percent })
      }
    })
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

  // ==================== 代理测试 ====================
  ipcMain.handle('proxy:test', async (_, config: { type: string; host: string; port: number; username?: string; password?: string }) => {
    return new Promise((resolve) => {
      const testUrl = 'https://www.google.com'
      const timeout = 10000 // 10秒超时

      try {
        // 构建代理 URL
        let proxyUrl = `${config.type}://${config.host}:${config.port}`
        if (config.username && config.password) {
          proxyUrl = `${config.type}://${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}`
        }

        // 使用 https 模块通过代理测试连接
        const url = new URL(testUrl)
        const proxyHost = config.host
        const proxyPort = config.port

        // 创建 CONNECT 请求到代理服务器
        const http = require('http')
        const connectReq = http.request({
          host: proxyHost,
          port: proxyPort,
          method: 'CONNECT',
          path: `${url.hostname}:443`,
          timeout: timeout,
          headers: config.username && config.password ? {
            'Proxy-Authorization': 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64')
          } : {}
        })

        connectReq.on('connect', (res: any, socket: any) => {
          if (res.statusCode === 200) {
            // 代理连接成功，现在通过隧道发送 HTTPS 请求
            const tlsSocket = require('tls').connect({
              socket: socket,
              servername: url.hostname
            }, () => {
              // TLS 握手成功
              tlsSocket.write(`HEAD / HTTP/1.1\r\nHost: ${url.hostname}\r\nConnection: close\r\n\r\n`)
            })

            tlsSocket.on('data', () => {
              tlsSocket.destroy()
              socket.destroy()
              resolve({ success: true, message: '代理连接成功' })
            })

            tlsSocket.on('error', (err: Error) => {
              tlsSocket.destroy()
              socket.destroy()
              resolve({ success: false, message: `TLS 连接失败: ${err.message}` })
            })

            tlsSocket.setTimeout(timeout, () => {
              tlsSocket.destroy()
              socket.destroy()
              resolve({ success: false, message: '连接超时' })
            })
          } else {
            socket.destroy()
            resolve({ success: false, message: `代理返回错误状态码: ${res.statusCode}` })
          }
        })

        connectReq.on('error', (err: Error) => {
          resolve({ success: false, message: `代理连接失败: ${err.message}` })
        })

        connectReq.on('timeout', () => {
          connectReq.destroy()
          resolve({ success: false, message: '连接超时' })
        })

        connectReq.end()
      } catch (error) {
        resolve({ success: false, message: `测试失败: ${(error as Error).message}` })
      }
    })
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

  // ==================== HTTP 请求（用于外部 API 调用） ====================
  ipcMain.handle('http:request', async (_, options: {
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
  }) => {
    return new Promise((resolve) => {
      const url = new URL(options.url)
      const method = options.method || 'GET'
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers
      }

      const bodyData = options.body
        ? typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)
        : undefined

      if (bodyData) {
        headers['Content-Length'] = Buffer.byteLength(bodyData).toString()
      }

      const timeout = options.timeout || 30000

      // 如果有代理配置，使用代理
      if (options.proxy && options.proxy.host && options.proxy.port) {
        const http = require('http')
        const tls = require('tls')
        
        const proxyHeaders: Record<string, string> = {}
        if (options.proxy.username && options.proxy.password) {
          proxyHeaders['Proxy-Authorization'] = 'Basic ' + Buffer.from(
            `${options.proxy.username}:${options.proxy.password}`
          ).toString('base64')
        }

        const connectReq = http.request({
          host: options.proxy.host,
          port: options.proxy.port,
          method: 'CONNECT',
          path: `${url.hostname}:${url.port || 443}`,
          timeout: timeout,
          headers: proxyHeaders
        })

        connectReq.on('connect', (proxyRes: any, socket: any) => {
          if (proxyRes.statusCode !== 200) {
            socket.destroy()
            resolve({
              success: false,
              status: proxyRes.statusCode,
              statusText: `Proxy error: ${proxyRes.statusCode}`,
              data: null,
              error: `Proxy returned status ${proxyRes.statusCode}`
            })
            return
          }

          const tlsSocket = tls.connect({
            socket: socket,
            servername: url.hostname
          }, () => {
            // 构建 HTTP 请求
            let requestLine = `${method} ${url.pathname}${url.search} HTTP/1.1\r\n`
            requestLine += `Host: ${url.hostname}\r\n`
            for (const [key, value] of Object.entries(headers)) {
              requestLine += `${key}: ${value}\r\n`
            }
            requestLine += 'Connection: close\r\n\r\n'
            if (bodyData) {
              requestLine += bodyData
            }
            tlsSocket.write(requestLine)
          })

          let responseData = ''
          tlsSocket.on('data', (chunk: Buffer) => {
            responseData += chunk.toString()
          })

          tlsSocket.on('end', () => {
            tlsSocket.destroy()
            socket.destroy()
            
            // 解析 HTTP 响应
            const headerEndIndex = responseData.indexOf('\r\n\r\n')
            if (headerEndIndex === -1) {
              resolve({
                success: false,
                status: 0,
                statusText: 'Invalid response',
                data: null,
                error: 'Invalid HTTP response'
              })
              return
            }

            const headerPart = responseData.substring(0, headerEndIndex)
            const bodyPart = responseData.substring(headerEndIndex + 4)
            
            const statusLine = headerPart.split('\r\n')[0]
            const statusMatch = statusLine.match(/HTTP\/\d\.\d (\d+) (.*)/)
            const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0
            const statusText = statusMatch ? statusMatch[2] : 'Unknown'

            let parsedData: any = bodyPart
            try {
              parsedData = JSON.parse(bodyPart)
            } catch {
              // 保持原始字符串
            }

            resolve({
              success: statusCode >= 200 && statusCode < 300,
              status: statusCode,
              statusText: statusText,
              data: parsedData
            })
          })

          tlsSocket.on('error', (error: Error) => {
            tlsSocket.destroy()
            socket.destroy()
            resolve({
              success: false,
              status: 0,
              statusText: error.message,
              data: null,
              error: error.message
            })
          })

          tlsSocket.setTimeout(timeout, () => {
            tlsSocket.destroy()
            socket.destroy()
            resolve({
              success: false,
              status: 0,
              statusText: 'Request timeout',
              data: null,
              error: 'Request timeout'
            })
          })
        })

        connectReq.on('error', (error: Error) => {
          resolve({
            success: false,
            status: 0,
            statusText: error.message,
            data: null,
            error: `Proxy connection failed: ${error.message}`
          })
        })

        connectReq.on('timeout', () => {
          connectReq.destroy()
          resolve({
            success: false,
            status: 0,
            statusText: 'Proxy connection timeout',
            data: null,
            error: 'Proxy connection timeout'
          })
        })

        connectReq.end()
      } else {
        // 无代理，直接请求
        const requestOptions = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers,
          timeout: timeout
        }

        const req = https.request(requestOptions, (res) => {
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            let parsedData: any = data
            try {
              parsedData = JSON.parse(data)
            } catch {
              // 保持原始字符串
            }
            resolve({
              success: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              data: parsedData,
              headers: res.headers
            })
          })
        })

        req.on('error', (error) => {
          resolve({
            success: false,
            status: 0,
            statusText: error.message,
            data: null,
            error: error.message
          })
        })

        req.on('timeout', () => {
          req.destroy()
          resolve({
            success: false,
            status: 0,
            statusText: 'Request timeout',
            data: null,
            error: 'Request timeout'
          })
        })

        if (bodyData) {
          req.write(bodyData)
        }
        req.end()
      }
    })
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
