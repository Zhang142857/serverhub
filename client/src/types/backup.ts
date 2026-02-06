/**
 * 备份管理系统类型定义
 */

/**
 * 备份目标类型
 */
export enum BackupTargetType {
  DATABASE = 'database',
  FILES = 'files',
  DOCKER = 'docker',
  CONFIG = 'config'
}

/**
 * 备份调度类型
 */
export enum BackupScheduleType {
  MANUAL = 'manual',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CRON = 'cron'
}

/**
 * 存储类型
 */
export enum StorageType {
  LOCAL = 'local',
  S3 = 's3',
  OSS = 'oss',
  COS = 'cos',
  FTP = 'ftp',
  SFTP = 'sftp'
}

/**
 * 备份状态
 */
export enum BackupStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * 备份目标
 */
export interface BackupTarget {
  type: BackupTargetType
  path?: string
  database?: string
  container?: string
  include?: string[]
  exclude?: string[]
}

/**
 * 备份调度配置
 */
export interface BackupSchedule {
  type: BackupScheduleType
  time?: string  // HH:mm
  dayOfWeek?: number  // 0-6
  dayOfMonth?: number  // 1-31
  cron?: string
}

/**
 * 存储配置
 */
export interface StorageConfig {
  type: StorageType
  path: string
  credentials?: {
    accessKeyId?: string
    secretAccessKey?: string
    region?: string
    bucket?: string
    endpoint?: string
    username?: string
    password?: string
    host?: string
    port?: number
  }
}

/**
 * 保留策略
 */
export interface RetentionPolicy {
  keepLast: number  // 保留最近N个
  keepDays?: number  // 保留N天内的
  keepWeekly?: number  // 保留N周的
  keepMonthly?: number  // 保留N月的
}

/**
 * 备份策略
 */
export interface BackupStrategy {
  id: string
  name: string
  description?: string
  enabled: boolean
  serverId: string
  
  // 备份目标
  targets: BackupTarget[]
  
  // 调度配置
  schedule: BackupSchedule
  
  // 存储配置
  storage: StorageConfig
  
  // 保留策略
  retention: RetentionPolicy
  
  // 压缩和加密
  compression: boolean
  encryption?: {
    enabled: boolean
    password: string
  }
  
  // 通知
  notification?: {
    onSuccess: boolean
    onFailure: boolean
    email?: string
    webhook?: string
  }
  
  // 统计
  lastBackup?: Date
  nextBackup?: Date
  totalBackups: number
  totalSize: number
}

/**
 * 备份记录
 */
export interface BackupRecord {
  id: string
  strategyId: string
  strategyName: string
  serverId: string
  status: BackupStatus
  
  // 备份信息
  targets: BackupTarget[]
  startTime: Date
  endTime?: Date
  duration?: number
  
  // 文件信息
  filename: string
  size: number
  compressed: boolean
  encrypted: boolean
  
  // 存储位置
  storage: {
    type: StorageType
    path: string
  }
  
  // 错误信息
  error?: string
  
  // 日志
  logs?: string[]
}

/**
 * 备份操作结果
 */
export interface BackupOperationResult {
  success: boolean
  message?: string
  error?: string
  data?: any
}

/**
 * 恢复选项
 */
export interface RestoreOptions {
  backupId: string
  serverId: string
  targetPath?: string
  overwrite?: boolean
}
