/**
 * 系统工具定义
 * 包含系统信息、服务管理、进程管理等工具
 */

import { ToolDefinition, ToolContext, ToolResult } from './registry'

/**
 * 获取系统信息工具
 */
export const getSystemInfoTool: ToolDefinition = {
  name: 'get_system_info',
  displayName: '获取系统信息',
  description: '获取服务器的系统信息，包括 CPU、内存、磁盘、网络等详细信息',
  category: 'system',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: async (_params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await context.executor.getSystemInfo(context.serverId)
      return {
        success: true,
        data: result,
        message: '成功获取系统信息'
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
 * 执行命令工具
 */
export const executeCommandTool: ToolDefinition = {
  name: 'execute_command',
  displayName: '执行命令',
  description: '在服务器上执行 Shell 命令。可以执行任何 Linux 命令，返回命令的输出结果。',
  category: 'system',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的命令',
        required: true
      },
      args: {
        type: 'array',
        description: '命令参数列表（可选）',
        items: { type: 'string' }
      },
      sudo: {
        type: 'boolean',
        description: '是否使用 sudo 执行',
        default: false
      },
      workdir: {
        type: 'string',
        description: '工作目录（可选）'
      }
    },
    required: ['command']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const command = params.command as string
      const args = params.args as string[] | undefined
      const options = {
        sudo: params.sudo as boolean,
        workdir: params.workdir as string | undefined
      }

      const result = await context.executor.executeCommand(context.serverId, command, args, options)

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
 * 列出服务工具
 */
export const listServicesTool: ToolDefinition = {
  name: 'list_services',
  displayName: '列出服务',
  description: '列出服务器上的系统服务（systemd 服务），包括服务名称、状态、是否启用等信息',
  category: 'system',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: async (_params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await context.executor.listServices(context.serverId)
      return {
        success: true,
        data: result.services,
        message: `找到 ${result.services?.length || 0} 个服务`
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
 * 服务操作工具
 */
export const serviceActionTool: ToolDefinition = {
  name: 'service_action',
  displayName: '服务操作',
  description: '对系统服务执行操作：启动(start)、停止(stop)、重启(restart)、启用(enable)、禁用(disable)',
  category: 'system',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '服务名称',
        required: true
      },
      action: {
        type: 'string',
        description: '要执行的操作',
        enum: ['start', 'stop', 'restart', 'enable', 'disable', 'status'],
        required: true
      }
    },
    required: ['name', 'action']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const name = params.name as string
      const action = params.action as string

      const result = await context.executor.serviceAction(context.serverId, name, action)

      return {
        success: result.success,
        data: result,
        message: result.success ? `服务 ${name} ${action} 操作成功` : result.error
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
 * 列出进程工具
 */
export const listProcessesTool: ToolDefinition = {
  name: 'list_processes',
  displayName: '列出进程',
  description: '列出服务器上运行的进程，包括 PID、名称、CPU 使用率、内存使用率等信息',
  category: 'system',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      sortBy: {
        type: 'string',
        description: '排序字段',
        enum: ['cpu', 'memory', 'pid', 'name'],
        default: 'cpu'
      },
      limit: {
        type: 'number',
        description: '返回的进程数量限制',
        default: 50
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await context.executor.listProcesses(context.serverId)
      let processes = result.processes || []

      // 排序
      const sortBy = (params.sortBy as string) || 'cpu'
      processes = processes.sort((a, b) => {
        switch (sortBy) {
          case 'cpu':
            return b.cpu - a.cpu
          case 'memory':
            return b.memory - a.memory
          case 'pid':
            return a.pid - b.pid
          case 'name':
            return a.name.localeCompare(b.name)
          default:
            return b.cpu - a.cpu
        }
      })

      // 限制数量
      const limit = (params.limit as number) || 50
      processes = processes.slice(0, limit)

      return {
        success: true,
        data: processes,
        message: `找到 ${processes.length} 个进程`
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
 * 终止进程工具
 */
export const killProcessTool: ToolDefinition = {
  name: 'kill_process',
  displayName: '终止进程',
  description: '终止指定的进程。可以指定信号类型（默认 SIGTERM）',
  category: 'system',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      pid: {
        type: 'number',
        description: '进程 ID',
        required: true
      },
      signal: {
        type: 'number',
        description: '信号类型（9=SIGKILL, 15=SIGTERM）',
        default: 15
      }
    },
    required: ['pid']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const pid = params.pid as number
      const signal = params.signal as number | undefined

      const result = await context.executor.killProcess(context.serverId, pid, signal)

      return {
        success: result.success,
        data: result,
        message: result.success ? `进程 ${pid} 已终止` : result.error
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
 * 获取系统日志工具
 */
export const getSystemLogsTool: ToolDefinition = {
  name: 'get_system_logs',
  displayName: '获取系统日志',
  description: '获取系统日志（journalctl），可以指定服务名称和行数',
  category: 'system',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      unit: {
        type: 'string',
        description: '服务单元名称（可选，不指定则获取所有日志）'
      },
      lines: {
        type: 'number',
        description: '返回的日志行数',
        default: 100
      },
      since: {
        type: 'string',
        description: '起始时间（如 "1 hour ago", "2024-01-01"）'
      },
      priority: {
        type: 'string',
        description: '日志优先级',
        enum: ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug']
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const args: string[] = ['journalctl', '--no-pager']

      if (params.unit) {
        args.push('-u', params.unit as string)
      }

      if (params.lines) {
        args.push('-n', String(params.lines))
      }

      if (params.since) {
        args.push('--since', params.since as string)
      }

      if (params.priority) {
        args.push('-p', params.priority as string)
      }

      const result = await context.executor.executeCommand(context.serverId, args[0], args.slice(1))

      return {
        success: result.exit_code === 0,
        data: {
          logs: result.stdout,
          stderr: result.stderr
        },
        message: result.exit_code === 0 ? '成功获取系统日志' : '获取日志失败'
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
 * 获取磁盘使用情况工具
 */
export const getDiskUsageTool: ToolDefinition = {
  name: 'get_disk_usage',
  displayName: '获取磁盘使用',
  description: '获取指定目录的磁盘使用情况',
  category: 'system',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要检查的目录路径',
        default: '/'
      },
      depth: {
        type: 'number',
        description: '目录深度',
        default: 1
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = (params.path as string) || '/'
      const depth = (params.depth as number) || 1

      const result = await context.executor.executeCommand(
        context.serverId,
        'du',
        ['-h', '--max-depth', String(depth), path]
      )

      return {
        success: result.exit_code === 0,
        data: {
          usage: result.stdout,
          stderr: result.stderr
        },
        message: result.exit_code === 0 ? '成功获取磁盘使用情况' : '获取失败'
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
 * 导出所有系统工具
 */
export const systemTools: ToolDefinition[] = [
  getSystemInfoTool,
  executeCommandTool,
  listServicesTool,
  serviceActionTool,
  listProcessesTool,
  killProcessTool,
  getSystemLogsTool,
  getDiskUsageTool
]
