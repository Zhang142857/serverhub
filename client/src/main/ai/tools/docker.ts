/**
 * Docker 工具定义
 * 包含容器、镜像、网络、卷等管理工具
 */

import { ToolDefinition, ToolContext, ToolResult } from './registry'

/**
 * 列出容器工具
 */
export const listContainersTool: ToolDefinition = {
  name: 'list_containers',
  displayName: '列出容器',
  description: '列出服务器上的 Docker 容器，包括容器 ID、名称、状态、镜像等信息',
  category: 'docker',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      all: {
        type: 'boolean',
        description: '是否包含已停止的容器',
        default: false
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const all = params.all as boolean
      const result = await context.executor.listContainers(context.serverId, all)

      // 解析容器列表
      let containers: unknown[] = []
      if (result.stdout) {
        const lines = result.stdout.trim().split('\n').filter(Boolean)
        containers = lines.map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        }).filter(Boolean)
      }

      return {
        success: true,
        data: containers,
        message: `找到 ${containers.length} 个容器`
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 容器操作工具
 */
export const containerActionTool: ToolDefinition = {
  name: 'container_action',
  displayName: '容器操作',
  description: '对 Docker 容器执行操作：启动(start)、停止(stop)、重启(restart)、暂停(pause)、恢复(unpause)、删除(remove)',
  category: 'docker',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      containerId: {
        type: 'string',
        description: '容器 ID 或名称',
        required: true
      },
      action: {
        type: 'string',
        description: '要执行的操作',
        enum: ['start', 'stop', 'restart', 'pause', 'unpause', 'remove'],
        required: true
      },
      force: {
        type: 'boolean',
        description: '是否强制执行（用于 remove）',
        default: false
      }
    },
    required: ['containerId', 'action']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const containerId = params.containerId as string
      const action = params.action as string

      const result = await context.executor.containerAction(context.serverId, containerId, action)

      return {
        success: result.success,
        data: result,
        message: result.success ? `容器 ${containerId} ${action} 操作成功` : result.error
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 获取容器日志工具
 */
export const containerLogsTool: ToolDefinition = {
  name: 'container_logs',
  displayName: '容器日志',
  description: '获取 Docker 容器的日志输出',
  category: 'docker',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      containerId: {
        type: 'string',
        description: '容器 ID 或名称',
        required: true
      },
      tail: {
        type: 'number',
        description: '返回的日志行数',
        default: 100
      }
    },
    required: ['containerId']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const containerId = params.containerId as string
      const tail = (params.tail as number) || 100

      const result = await context.executor.containerLogs(context.serverId, containerId, tail)

      return {
        success: true,
        data: {
          logs: result.stdout,
          stderr: result.stderr
        },
        message: '成功获取容器日志'
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 列出镜像工具
 */
export const listImagesTool: ToolDefinition = {
  name: 'list_images',
  displayName: '列出镜像',
  description: '列出服务器上的 Docker 镜像',
  category: 'docker',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      all: {
        type: 'boolean',
        description: '是否包含中间层镜像',
        default: false
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const all = params.all as boolean
      const result = await context.executor.listImages(context.serverId, all)

      // 解析镜像列表
      let images: unknown[] = []
      if (result.stdout) {
        const lines = result.stdout.trim().split('\n').filter(Boolean)
        images = lines.map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        }).filter(Boolean)
      }

      return {
        success: true,
        data: images,
        message: `找到 ${images.length} 个镜像`
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 拉取镜像工具
 */
export const pullImageTool: ToolDefinition = {
  name: 'pull_image',
  displayName: '拉取镜像',
  description: '从 Docker Hub 或其他仓库拉取镜像',
  category: 'docker',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        description: '镜像名称（如 nginx, mysql）',
        required: true
      },
      tag: {
        type: 'string',
        description: '镜像标签',
        default: 'latest'
      }
    },
    required: ['image']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const image = params.image as string
      const tag = (params.tag as string) || 'latest'

      context.onProgress?.(`正在拉取镜像 ${image}:${tag}...`)

      const result = await context.executor.pullImage(context.serverId, image, tag)

      return {
        success: result.success,
        data: result,
        message: result.success ? `镜像 ${image}:${tag} 拉取成功` : result.error
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 删除镜像工具
 */
export const removeImageTool: ToolDefinition = {
  name: 'remove_image',
  displayName: '删除镜像',
  description: '删除 Docker 镜像',
  category: 'docker',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      imageId: {
        type: 'string',
        description: '镜像 ID 或名称',
        required: true
      },
      force: {
        type: 'boolean',
        description: '是否强制删除',
        default: false
      }
    },
    required: ['imageId']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const imageId = params.imageId as string
      const force = params.force as boolean

      const result = await context.executor.removeImage(context.serverId, imageId, force)

      return {
        success: result.success,
        data: result,
        message: result.success ? `镜像 ${imageId} 已删除` : result.error
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 列出网络工具
 */
export const listNetworksTool: ToolDefinition = {
  name: 'list_networks',
  displayName: '列出网络',
  description: '列出 Docker 网络',
  category: 'docker',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: async (_params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await context.executor.listNetworks(context.serverId)

      // 解析网络列表
      let networks: unknown[] = []
      if (result.stdout) {
        const lines = result.stdout.trim().split('\n').filter(Boolean)
        networks = lines.map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        }).filter(Boolean)
      }

      return {
        success: true,
        data: networks,
        message: `找到 ${networks.length} 个网络`
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 列出卷工具
 */
export const listVolumesTool: ToolDefinition = {
  name: 'list_volumes',
  displayName: '列出卷',
  description: '列出 Docker 卷',
  category: 'docker',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: async (_params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await context.executor.listVolumes(context.serverId)

      // 解析卷列表
      let volumes: unknown[] = []
      if (result.stdout) {
        const lines = result.stdout.trim().split('\n').filter(Boolean)
        volumes = lines.map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        }).filter(Boolean)
      }

      return {
        success: true,
        data: volumes,
        message: `找到 ${volumes.length} 个卷`
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 执行容器命令工具
 */
export const execContainerTool: ToolDefinition = {
  name: 'exec_container',
  displayName: '容器内执行命令',
  description: '在运行中的容器内执行命令',
  category: 'docker',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      containerId: {
        type: 'string',
        description: '容器 ID 或名称',
        required: true
      },
      command: {
        type: 'string',
        description: '要执行的命令',
        required: true
      },
      workdir: {
        type: 'string',
        description: '工作目录'
      },
      user: {
        type: 'string',
        description: '执行用户'
      }
    },
    required: ['containerId', 'command']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const containerId = params.containerId as string
      const command = params.command as string
      const workdir = params.workdir as string | undefined
      const user = params.user as string | undefined

      const args = ['exec']
      if (workdir) {
        args.push('-w', workdir)
      }
      if (user) {
        args.push('-u', user)
      }
      args.push(containerId, 'sh', '-c', command)

      const result = await context.executor.executeCommand(context.serverId, 'docker', args)

      return {
        success: result.exit_code === 0,
        data: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exit_code
        },
        message: result.exit_code === 0 ? '命令执行成功' : `命令执行失败，退出码: ${result.exit_code}`
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 获取容器统计信息工具
 */
export const containerStatsTool: ToolDefinition = {
  name: 'container_stats',
  displayName: '容器统计',
  description: '获取容器的资源使用统计信息（CPU、内存、网络、磁盘 I/O）',
  category: 'docker',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      containerId: {
        type: 'string',
        description: '容器 ID 或名称（可选，不指定则获取所有容器）'
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const containerId = params.containerId as string | undefined

      const args = ['stats', '--no-stream', '--format', '{{json .}}']
      if (containerId) {
        args.push(containerId)
      }

      const result = await context.executor.executeCommand(context.serverId, 'docker', args)

      // 解析统计信息
      let stats: unknown[] = []
      if (result.stdout) {
        const lines = result.stdout.trim().split('\n').filter(Boolean)
        stats = lines.map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        }).filter(Boolean)
      }

      return {
        success: result.exit_code === 0,
        data: stats,
        message: `获取了 ${stats.length} 个容器的统计信息`
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 导出所有 Docker 工具
 */
export const dockerTools: ToolDefinition[] = [
  listContainersTool,
  containerActionTool,
  containerLogsTool,
  listImagesTool,
  pullImageTool,
  removeImageTool,
  listNetworksTool,
  listVolumesTool,
  execContainerTool,
  containerStatsTool
]
