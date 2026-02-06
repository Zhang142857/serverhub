/**
 * 计划任务类型定义
 */

/**
 * 任务类型
 */
export enum TaskType {
  SHELL = 'shell',
  HTTP = 'http',
  BACKUP = 'backup',
  CLEANUP = 'cleanup',
  SCRIPT = 'script'
}

/**
 * 调度类型
 */
export enum ScheduleType {
  CRON = 'cron',
  INTERVAL = 'interval'
}

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILURE = 'failure'
}

/**
 * Shell任务配置
 */
export interface ShellTaskConfig {
  command: string
  workdir?: string
  env?: Record<string, string>
  timeout?: number
}

/**
 * HTTP任务配置
 */
export interface HttpTaskConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
  timeout?: number
}

/**
 * 备份任务配置
 */
export interface BackupTaskConfig {
  backupStrategyId: string
}

/**
 * 清理任务配置
 */
export interface CleanupTaskConfig {
  cleanupType: 'logs' | 'temp' | 'docker' | 'custom'
  path?: string
  olderThanDays?: number
  pattern?: string
}

/**
 * 脚本任务配置
 */
export interface ScriptTaskConfig {
  scriptPath: string
  args?: string[]
  interpreter?: string
}

/**
 * 任务配置联合类型
 */
export type TaskConfig = 
  | ShellTaskConfig 
  | HttpTaskConfig 
  | BackupTaskConfig 
  | CleanupTaskConfig 
  | ScriptTaskConfig

/**
 * 调度配置
 */
export interface TaskSchedule {
  type: ScheduleType
  cron?: string
  interval?: number  // 秒
}

/**
 * 通知配置
 */
export interface TaskNotification {
  onSuccess: boolean
  onFailure: boolean
  channels: Array<'email' | 'webhook' | 'notification'>
  email?: string
  webhook?: string
}

/**
 * 计划任务
 */
export interface ScheduledTask {
  id: string
  name: string
  description?: string
  enabled: boolean
  serverId: string
  
  // 任务类型和配置
  type: TaskType
  config: TaskConfig
  
  // 调度配置
  schedule: TaskSchedule
  
  // 通知配置
  notification?: TaskNotification
  
  // 执行历史
  lastRun?: Date
  lastStatus?: TaskStatus
  nextRun?: Date
  
  // 统计
  totalRuns: number
  successRuns: number
  failureRuns: number
  
  // 时间戳
  createdAt: Date
  updatedAt: Date
}

/**
 * 任务执行记录
 */
export interface TaskExecutionRecord {
  id: string
  taskId: string
  taskName: string
  serverId: string
  status: TaskStatus
  
  // 执行信息
  startTime: Date
  endTime?: Date
  duration?: number
  
  // 输出
  stdout?: string
  stderr?: string
  exitCode?: number
  
  // 错误信息
  error?: string
  
  // 触发方式
  triggeredBy: 'schedule' | 'manual'
}

/**
 * Cron表达式部分
 */
export interface CronParts {
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
}

/**
 * 任务操作结果
 */
export interface TaskOperationResult {
  success: boolean
  message?: string
  error?: string
  data?: any
}
