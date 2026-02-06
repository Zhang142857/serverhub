/**
 * 计划任务AI工具
 */

import { ToolDefinition } from '../types'

export const taskTools: ToolDefinition[] = [
  {
    name: 'task_create',
    displayName: '创建计划任务',
    description: '创建一个新的计划任务，可以定期执行Shell命令、HTTP请求、备份等操作',
    category: 'task',
    dangerous: false,
    parameters: {
      name: {
        type: 'string',
        description: '任务名称',
        required: true
      },
      task_type: {
        type: 'string',
        description: '任务类型：shell（Shell命令）、http（HTTP请求）、backup（备份）、cleanup（清理）、script（脚本）',
        required: true,
        enum: ['shell', 'http', 'backup', 'cleanup', 'script']
      },
      command: {
        type: 'string',
        description: 'Shell命令（task_type为shell时使用）',
        required: false
      },
      workdir: {
        type: 'string',
        description: '工作目录（task_type为shell时使用）',
        required: false
      },
      url: {
        type: 'string',
        description: 'HTTP请求URL（task_type为http时使用）',
        required: false
      },
      method: {
        type: 'string',
        description: 'HTTP请求方法（task_type为http时使用）',
        required: false,
        enum: ['GET', 'POST', 'PUT', 'DELETE'],
        default: 'GET'
      },
      schedule_type: {
        type: 'string',
        description: '调度类型：cron（Cron表达式）、interval（固定间隔）',
        required: true,
        enum: ['cron', 'interval']
      },
      cron_expression: {
        type: 'string',
        description: 'Cron表达式（schedule_type为cron时使用，如：0 2 * * * 表示每天凌晨2点）',
        required: false
      },
      interval_seconds: {
        type: 'number',
        description: '执行间隔（秒，schedule_type为interval时使用）',
        required: false
      },
      notify_on_success: {
        type: 'boolean',
        description: '成功时是否通知',
        required: false,
        default: false
      },
      notify_on_failure: {
        type: 'boolean',
        description: '失败时是否通知',
        required: false,
        default: true
      }
    },
    handler: async (params) => {
      // 构建任务对象
      const task = {
        name: params.name,
        enabled: true,
        serverId: 'default', // TODO: 从上下文获取
        type: params.task_type,
        config: {
          command: params.command,
          workdir: params.workdir,
          url: params.url,
          method: params.method || 'GET'
        },
        schedule: {
          type: params.schedule_type,
          cron: params.cron_expression,
          interval: params.interval_seconds
        },
        notification: {
          onSuccess: params.notify_on_success || false,
          onFailure: params.notify_on_failure !== false,
          channels: ['notification']
        }
      }

      // 调用IPC创建任务
      const result = await (window as any).electronAPI.task.create(task)
      
      if (result.success) {
        return {
          success: true,
          message: `计划任务"${params.name}"创建成功`,
          data: result.data
        }
      } else {
        return {
          success: false,
          error: result.error
        }
      }
    }
  },
  {
    name: 'task_execute',
    displayName: '执行任务',
    description: '立即执行指定的计划任务',
    category: 'task',
    dangerous: false,
    parameters: {
      task_name: {
        type: 'string',
        description: '任务名称',
        required: true
      }
    },
    handler: async (params) => {
      // 先获取所有任务
      const tasks = await (window as any).electronAPI.task.getTasks()
      const task = tasks.find((t: any) => t.name === params.task_name)
      
      if (!task) {
        return {
          success: false,
          error: `未找到任务"${params.task_name}"`
        }
      }

      // 执行任务
      const result = await (window as any).electronAPI.task.execute(task.id)
      
      if (result.success) {
        return {
          success: true,
          message: `任务"${params.task_name}"执行成功`,
          data: result.data
        }
      } else {
        return {
          success: false,
          error: result.error
        }
      }
    }
  },
  {
    name: 'task_list',
    displayName: '列出计划任务',
    description: '列出所有已创建的计划任务',
    category: 'task',
    dangerous: false,
    parameters: {
      enabled_only: {
        type: 'boolean',
        description: '是否只列出已启用的任务',
        required: false,
        default: false
      }
    },
    handler: async (params) => {
      let tasks = await (window as any).electronAPI.task.getTasks()
      
      // 筛选已启用的任务
      if (params.enabled_only) {
        tasks = tasks.filter((t: any) => t.enabled)
      }
      
      return {
        success: true,
        message: `共有${tasks.length}个计划任务`,
        data: tasks.map((t: any) => ({
          name: t.name,
          type: t.type,
          enabled: t.enabled,
          schedule: t.schedule.type === 'cron' ? t.schedule.cron : `每${t.schedule.interval}秒`,
          lastRun: t.lastRun,
          lastStatus: t.lastStatus,
          nextRun: t.nextRun,
          totalRuns: t.totalRuns,
          successRuns: t.successRuns,
          failureRuns: t.failureRuns
        }))
      }
    }
  },
  {
    name: 'task_enable',
    displayName: '启用任务',
    description: '启用指定的计划任务',
    category: 'task',
    dangerous: false,
    parameters: {
      task_name: {
        type: 'string',
        description: '任务名称',
        required: true
      }
    },
    handler: async (params) => {
      const tasks = await (window as any).electronAPI.task.getTasks()
      const task = tasks.find((t: any) => t.name === params.task_name)
      
      if (!task) {
        return {
          success: false,
          error: `未找到任务"${params.task_name}"`
        }
      }

      const result = await (window as any).electronAPI.task.enable(task.id)
      
      if (result.success) {
        return {
          success: true,
          message: `任务"${params.task_name}"已启用`
        }
      } else {
        return {
          success: false,
          error: result.error
        }
      }
    }
  },
  {
    name: 'task_disable',
    displayName: '禁用任务',
    description: '禁用指定的计划任务',
    category: 'task',
    dangerous: false,
    parameters: {
      task_name: {
        type: 'string',
        description: '任务名称',
        required: true
      }
    },
    handler: async (params) => {
      const tasks = await (window as any).electronAPI.task.getTasks()
      const task = tasks.find((t: any) => t.name === params.task_name)
      
      if (!task) {
        return {
          success: false,
          error: `未找到任务"${params.task_name}"`
        }
      }

      const result = await (window as any).electronAPI.task.disable(task.id)
      
      if (result.success) {
        return {
          success: true,
          message: `任务"${params.task_name}"已禁用`
        }
      } else {
        return {
          success: false,
          error: result.error
        }
      }
    }
  },
  {
    name: 'task_delete',
    displayName: '删除任务',
    description: '删除指定的计划任务',
    category: 'task',
    dangerous: true,
    parameters: {
      task_name: {
        type: 'string',
        description: '任务名称',
        required: true
      }
    },
    handler: async (params) => {
      const tasks = await (window as any).electronAPI.task.getTasks()
      const task = tasks.find((t: any) => t.name === params.task_name)
      
      if (!task) {
        return {
          success: false,
          error: `未找到任务"${params.task_name}"`
        }
      }

      const result = await (window as any).electronAPI.task.delete(task.id)
      
      if (result.success) {
        return {
          success: true,
          message: `任务"${params.task_name}"已删除`
        }
      } else {
        return {
          success: false,
          error: result.error
        }
      }
    }
  },
  {
    name: 'task_history',
    displayName: '查看任务历史',
    description: '查看计划任务的执行历史记录',
    category: 'task',
    dangerous: false,
    parameters: {
      task_name: {
        type: 'string',
        description: '任务名称（可选，不指定则列出所有历史）',
        required: false
      },
      limit: {
        type: 'number',
        description: '返回记录数量限制',
        required: false,
        default: 10
      }
    },
    handler: async (params) => {
      let taskId: string | undefined
      
      // 如果指定了任务名称，先查找任务ID
      if (params.task_name) {
        const tasks = await (window as any).electronAPI.task.getTasks()
        const task = tasks.find((t: any) => t.name === params.task_name)
        
        if (!task) {
          return {
            success: false,
            error: `未找到任务"${params.task_name}"`
          }
        }
        
        taskId = task.id
      }
      
      // 获取历史记录
      const history = await (window as any).electronAPI.task.getHistory(taskId, params.limit)
      
      return {
        success: true,
        message: `找到${history.length}条执行记录`,
        data: history.map((h: any) => ({
          taskName: h.taskName,
          status: h.status,
          startTime: h.startTime,
          duration: h.duration,
          triggeredBy: h.triggeredBy,
          exitCode: h.exitCode,
          error: h.error
        }))
      }
    }
  },
  {
    name: 'task_stats',
    displayName: '任务统计',
    description: '获取计划任务的统计信息',
    category: 'task',
    dangerous: false,
    parameters: {},
    handler: async () => {
      const stats = await (window as any).electronAPI.task.getStats()
      
      return {
        success: true,
        message: '任务统计信息',
        data: {
          totalTasks: stats.totalTasks,
          enabledTasks: stats.enabledTasks,
          totalRuns: stats.totalRuns,
          successRuns: stats.successRuns,
          successRate: `${stats.successRate}%`
        }
      }
    }
  }
]
