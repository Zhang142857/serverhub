/**
 * 备份管理AI工具
 */

import { ToolDefinition } from '../types'

export const backupTools: ToolDefinition[] = [
  {
    name: 'backup_create_strategy',
    displayName: '创建备份策略',
    description: '创建一个新的备份策略，可以定期自动备份文件、数据库或Docker容器',
    category: 'backup',
    dangerous: false,
    parameters: {
      name: {
        type: 'string',
        description: '备份策略名称',
        required: true
      },
      target_type: {
        type: 'string',
        description: '备份目标类型：files（文件）、database（数据库）、docker（容器）、config（配置）',
        required: true,
        enum: ['files', 'database', 'docker', 'config']
      },
      target_path: {
        type: 'string',
        description: '备份目标路径（文件备份时使用）',
        required: false
      },
      database_name: {
        type: 'string',
        description: '数据库名称（数据库备份时使用）',
        required: false
      },
      container_name: {
        type: 'string',
        description: 'Docker容器名称（容器备份时使用）',
        required: false
      },
      storage_type: {
        type: 'string',
        description: '存储类型：local（本地）、oss（阿里云）、s3（AWS）、cos（腾讯云）',
        required: true,
        enum: ['local', 'oss', 's3', 'cos']
      },
      storage_path: {
        type: 'string',
        description: '存储路径',
        required: true
      },
      schedule_type: {
        type: 'string',
        description: '调度类型：manual（手动）、daily（每日）、weekly（每周）、monthly（每月）、cron（自定义）',
        required: true,
        enum: ['manual', 'daily', 'weekly', 'monthly', 'cron']
      },
      schedule_time: {
        type: 'string',
        description: '调度时间（格式：HH:mm，如 02:00）',
        required: false
      },
      cron_expression: {
        type: 'string',
        description: 'Cron表达式（schedule_type为cron时使用）',
        required: false
      },
      compression: {
        type: 'boolean',
        description: '是否压缩',
        required: false,
        default: true
      },
      encryption: {
        type: 'boolean',
        description: '是否加密',
        required: false,
        default: false
      },
      keep_last: {
        type: 'number',
        description: '保留最近N个备份',
        required: false,
        default: 7
      }
    },
    handler: async (params) => {
      // 构建备份策略对象
      const strategy = {
        name: params.name,
        enabled: true,
        targets: [{
          type: params.target_type,
          path: params.target_path,
          database: params.database_name,
          container: params.container_name
        }],
        schedule: {
          type: params.schedule_type,
          time: params.schedule_time,
          cron: params.cron_expression
        },
        storage: {
          type: params.storage_type,
          path: params.storage_path
        },
        compression: params.compression !== false,
        encryption: params.encryption ? {
          enabled: true,
          password: '' // 需要用户输入
        } : undefined,
        retention: {
          keepLast: params.keep_last || 7
        }
      }

      // 调用IPC创建备份策略
      const result = await (window as any).electronAPI.backup.createStrategy(strategy)
      
      if (result.success) {
        return {
          success: true,
          message: `备份策略"${params.name}"创建成功`,
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
    name: 'backup_execute',
    displayName: '执行备份',
    description: '立即执行指定的备份策略',
    category: 'backup',
    dangerous: false,
    parameters: {
      strategy_name: {
        type: 'string',
        description: '备份策略名称',
        required: true
      }
    },
    handler: async (params) => {
      // 先获取所有策略
      const strategies = await (window as any).electronAPI.backup.getStrategies()
      const strategy = strategies.find((s: any) => s.name === params.strategy_name)
      
      if (!strategy) {
        return {
          success: false,
          error: `未找到备份策略"${params.strategy_name}"`
        }
      }

      // 执行备份
      const result = await (window as any).electronAPI.backup.execute(strategy.id)
      
      if (result.success) {
        return {
          success: true,
          message: `备份"${params.strategy_name}"执行成功`,
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
    name: 'backup_list_strategies',
    displayName: '列出备份策略',
    description: '列出所有已创建的备份策略',
    category: 'backup',
    dangerous: false,
    parameters: {},
    handler: async () => {
      const strategies = await (window as any).electronAPI.backup.getStrategies()
      
      return {
        success: true,
        message: `共有${strategies.length}个备份策略`,
        data: strategies.map((s: any) => ({
          name: s.name,
          enabled: s.enabled,
          targets: s.targets.map((t: any) => t.type).join(', '),
          schedule: s.schedule.type,
          storage: s.storage.type,
          lastBackup: s.lastBackup,
          totalBackups: s.totalBackups
        }))
      }
    }
  },
  {
    name: 'backup_list_records',
    displayName: '列出备份记录',
    description: '列出备份执行历史记录',
    category: 'backup',
    dangerous: false,
    parameters: {
      strategy_name: {
        type: 'string',
        description: '备份策略名称（可选，不指定则列出所有记录）',
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
      let records = await (window as any).electronAPI.backup.getRecords()
      
      // 按策略名称筛选
      if (params.strategy_name) {
        records = records.filter((r: any) => r.strategyName === params.strategy_name)
      }
      
      // 限制数量
      if (params.limit) {
        records = records.slice(0, params.limit)
      }
      
      return {
        success: true,
        message: `找到${records.length}条备份记录`,
        data: records.map((r: any) => ({
          strategyName: r.strategyName,
          status: r.status,
          startTime: r.startTime,
          duration: r.duration,
          size: r.size,
          filename: r.filename
        }))
      }
    }
  },
  {
    name: 'backup_restore',
    displayName: '恢复备份',
    description: '从备份记录恢复数据',
    category: 'backup',
    dangerous: true,
    parameters: {
      backup_filename: {
        type: 'string',
        description: '备份文件名',
        required: true
      },
      target_path: {
        type: 'string',
        description: '恢复目标路径（可选，留空使用原路径）',
        required: false
      },
      overwrite: {
        type: 'boolean',
        description: '是否覆盖已存在的文件',
        required: false,
        default: false
      }
    },
    handler: async (params) => {
      // 查找备份记录
      const records = await (window as any).electronAPI.backup.getRecords()
      const record = records.find((r: any) => r.filename === params.backup_filename)
      
      if (!record) {
        return {
          success: false,
          error: `未找到备份文件"${params.backup_filename}"`
        }
      }

      // 执行恢复
      const result = await (window as any).electronAPI.backup.restore({
        backupId: record.id,
        serverId: record.serverId,
        targetPath: params.target_path,
        overwrite: params.overwrite
      })
      
      if (result.success) {
        return {
          success: true,
          message: `备份恢复成功`
        }
      } else {
        return {
          success: false,
          error: result.error
        }
      }
    }
  }
]
