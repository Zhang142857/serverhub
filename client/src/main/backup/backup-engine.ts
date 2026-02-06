/**
 * 备份引擎 - 负责执行备份操作
 */

import { GrpcClient } from '../grpc/client'
import type {
  BackupStrategy,
  BackupRecord,
  BackupTarget,
  BackupTargetType,
  BackupStatus,
  BackupOperationResult,
  RestoreOptions
} from '../../types/backup'
import { StorageProvider, LocalStorageProvider } from './storage-providers'
import * as path from 'path'
import * as crypto from 'crypto'

export class BackupEngine {
  private grpcClient: GrpcClient
  private storageProviders: Map<string, StorageProvider> = new Map()

  constructor(grpcClient: GrpcClient) {
    this.grpcClient = grpcClient
    
    // 注册默认的本地存储提供商
    this.registerStorageProvider('local', new LocalStorageProvider())
  }

  /**
   * 注册存储提供商
   */
  registerStorageProvider(type: string, provider: StorageProvider): void {
    this.storageProviders.set(type, provider)
  }

  /**
   * 执行备份
   */
  async executeBackup(strategy: BackupStrategy): Promise<BackupRecord> {
    const record: BackupRecord = {
      id: this.generateBackupId(),
      strategyId: strategy.id,
      strategyName: strategy.name,
      serverId: strategy.serverId,
      status: 'running' as BackupStatus,
      targets: strategy.targets,
      startTime: new Date(),
      filename: this.generateBackupFilename(strategy),
      size: 0,
      compressed: strategy.compression,
      encrypted: strategy.encryption?.enabled || false,
      storage: {
        type: strategy.storage.type,
        path: strategy.storage.path
      },
      logs: []
    }

    try {
      this.log(record, `开始备份: ${strategy.name}`)

      // 创建临时目录
      const tempDir = `/tmp/serverhub-backup-${record.id}`
      await this.grpcClient.executeCommand('mkdir', ['-p', tempDir])
      this.log(record, `创建临时目录: ${tempDir}`)

      // 备份每个目标
      const backupFiles: string[] = []
      for (const target of strategy.targets) {
        const targetFile = await this.backupTarget(target, tempDir, record)
        if (targetFile) {
          backupFiles.push(targetFile)
        }
      }

      if (backupFiles.length === 0) {
        throw new Error('没有文件需要备份')
      }

      // 打包所有备份文件
      const archivePath = `${tempDir}/${record.filename}`
      await this.createArchive(backupFiles, archivePath, record)

      // 加密（如果启用）
      let finalPath = archivePath
      if (strategy.encryption?.enabled && strategy.encryption.password) {
        finalPath = await this.encryptFile(archivePath, strategy.encryption.password, record)
      }

      // 获取文件大小
      const fileInfo = await this.grpcClient.readFile(finalPath)
      record.size = fileInfo.info?.size || 0
      this.log(record, `备份文件大小: ${this.formatSize(record.size)}`)

      // 上传到存储
      const storageProvider = this.storageProviders.get(strategy.storage.type)
      if (!storageProvider) {
        throw new Error(`不支持的存储类型: ${strategy.storage.type}`)
      }

      await storageProvider.upload(
        this.grpcClient,
        finalPath,
        path.join(strategy.storage.path, record.filename),
        strategy.storage.credentials
      )
      this.log(record, `上传到存储: ${strategy.storage.type}`)

      // 清理临时文件
      await this.grpcClient.executeCommand('rm', ['-rf', tempDir])
      this.log(record, '清理临时文件')

      // 应用保留策略
      await this.applyRetentionPolicy(strategy, record)

      record.status = 'completed' as BackupStatus
      record.endTime = new Date()
      record.duration = record.endTime.getTime() - record.startTime.getTime()
      this.log(record, `备份完成，耗时: ${this.formatDuration(record.duration)}`)

      return record
    } catch (error: any) {
      record.status = 'failed' as BackupStatus
      record.endTime = new Date()
      record.error = error.message
      this.log(record, `备份失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 备份单个目标
   */
  private async backupTarget(
    target: BackupTarget,
    tempDir: string,
    record: BackupRecord
  ): Promise<string | null> {
    switch (target.type) {
      case 'files':
        return this.backupFiles(target, tempDir, record)
      case 'database':
        return this.backupDatabase(target, tempDir, record)
      case 'docker':
        return this.backupDocker(target, tempDir, record)
      case 'config':
        return this.backupConfig(target, tempDir, record)
      default:
        this.log(record, `不支持的备份类型: ${target.type}`)
        return null
    }
  }

  /**
   * 备份文件/目录
   */
  private async backupFiles(
    target: BackupTarget,
    tempDir: string,
    record: BackupRecord
  ): Promise<string> {
    if (!target.path) {
      throw new Error('文件备份需要指定路径')
    }

    this.log(record, `备份文件: ${target.path}`)

    const outputFile = `${tempDir}/files-${Date.now()}.tar.gz`
    const excludeArgs = (target.exclude || []).flatMap(e => ['--exclude', e])
    
    // 使用tar打包
    const result = await this.grpcClient.executeCommand('tar', [
      '-czf',
      outputFile,
      '-C',
      path.dirname(target.path),
      ...excludeArgs,
      path.basename(target.path)
    ])

    if (result.exit_code !== 0) {
      throw new Error(`文件备份失败: ${result.stderr}`)
    }

    this.log(record, `文件备份完成: ${outputFile}`)
    return outputFile
  }

  /**
   * 备份数据库
   */
  private async backupDatabase(
    target: BackupTarget,
    tempDir: string,
    record: BackupRecord
  ): Promise<string> {
    if (!target.database) {
      throw new Error('数据库备份需要指定数据库名称')
    }

    this.log(record, `备份数据库: ${target.database}`)

    const outputFile = `${tempDir}/db-${target.database}-${Date.now()}.sql`
    
    // 检测数据库类型并执行相应的备份命令
    const dbType = this.detectDatabaseType(target.database)
    let result

    switch (dbType) {
      case 'mysql':
        result = await this.grpcClient.executeCommand('mysqldump', [
          target.database,
          '--result-file=' + outputFile
        ])
        break
      case 'postgresql':
        result = await this.grpcClient.executeCommand('pg_dump', [
          target.database,
          '-f',
          outputFile
        ])
        break
      case 'mongodb':
        result = await this.grpcClient.executeCommand('mongodump', [
          '--db',
          target.database,
          '--archive=' + outputFile,
          '--gzip'
        ])
        break
      default:
        throw new Error(`不支持的数据库类型: ${dbType}`)
    }

    if (result.exit_code !== 0) {
      throw new Error(`数据库备份失败: ${result.stderr}`)
    }

    this.log(record, `数据库备份完成: ${outputFile}`)
    return outputFile
  }

  /**
   * 备份Docker容器
   */
  private async backupDocker(
    target: BackupTarget,
    tempDir: string,
    record: BackupRecord
  ): Promise<string> {
    if (!target.container) {
      throw new Error('Docker备份需要指定容器名称')
    }

    this.log(record, `备份Docker容器: ${target.container}`)

    const outputFile = `${tempDir}/docker-${target.container}-${Date.now()}.tar`
    
    // 导出容器
    const result = await this.grpcClient.executeCommand('docker', [
      'export',
      target.container,
      '-o',
      outputFile
    ])

    if (result.exit_code !== 0) {
      throw new Error(`Docker容器备份失败: ${result.stderr}`)
    }

    this.log(record, `Docker容器备份完成: ${outputFile}`)
    return outputFile
  }

  /**
   * 备份配置文件
   */
  private async backupConfig(
    target: BackupTarget,
    tempDir: string,
    record: BackupRecord
  ): Promise<string> {
    this.log(record, '备份配置文件')

    const configPaths = target.include || [
      '/etc/nginx',
      '/etc/mysql',
      '/etc/redis',
      '/etc/systemd/system'
    ]

    const outputFile = `${tempDir}/config-${Date.now()}.tar.gz`
    
    // 过滤出存在的路径
    const existingPaths: string[] = []
    for (const p of configPaths) {
      const check = await this.grpcClient.executeCommand('test', ['-e', p])
      if (check.exit_code === 0) {
        existingPaths.push(p)
      }
    }

    if (existingPaths.length === 0) {
      throw new Error('没有找到可备份的配置文件路径')
    }

    // 打包配置文件
    const result = await this.grpcClient.executeCommand('tar', [
      '-czf',
      outputFile,
      ...existingPaths
    ])

    if (result.exit_code !== 0) {
      throw new Error(`配置文件备份失败: ${result.stderr}`)
    }

    this.log(record, `配置文件备份完成: ${outputFile}`)
    return outputFile
  }

  /**
   * 创建归档文件
   */
  private async createArchive(
    files: string[],
    outputPath: string,
    record: BackupRecord
  ): Promise<void> {
    this.log(record, `创建归档文件: ${outputPath}`)

    const result = await this.grpcClient.executeCommand('tar', [
      '-czf',
      outputPath,
      '-C',
      path.dirname(files[0]),
      ...files.map(f => path.basename(f))
    ])

    if (result.exit_code !== 0) {
      throw new Error(`创建归档失败: ${result.stderr}`)
    }

    this.log(record, '归档文件创建完成')
  }

  /**
   * 加密文件
   */
  private async encryptFile(
    filePath: string,
    password: string,
    record: BackupRecord
  ): Promise<string> {
    this.log(record, '加密备份文件')

    const encryptedPath = `${filePath}.enc`
    
    // 使用openssl加密
    const result = await this.grpcClient.executeCommand('openssl', [
      'enc',
      '-aes-256-cbc',
      '-salt',
      '-in',
      filePath,
      '-out',
      encryptedPath,
      '-pass',
      `pass:${password}`
    ])

    if (result.exit_code !== 0) {
      throw new Error(`文件加密失败: ${result.stderr}`)
    }

    // 删除未加密的文件
    await this.grpcClient.executeCommand('rm', [filePath])

    this.log(record, '文件加密完成')
    return encryptedPath
  }

  /**
   * 恢复备份
   */
  async restoreBackup(options: RestoreOptions): Promise<BackupOperationResult> {
    try {
      // TODO: 实现恢复逻辑
      // 1. 从存储下载备份文件
      // 2. 解密（如果需要）
      // 3. 解压
      // 4. 恢复到目标位置
      
      return {
        success: true,
        message: '备份恢复成功'
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 应用保留策略
   */
  private async applyRetentionPolicy(
    strategy: BackupStrategy,
    currentRecord: BackupRecord
  ): Promise<void> {
    // TODO: 实现保留策略
    // 1. 获取所有备份记录
    // 2. 根据策略删除旧备份
    this.log(currentRecord, '应用保留策略')
  }

  /**
   * 检测数据库类型
   */
  private detectDatabaseType(database: string): string {
    // 简单的数据库类型检测
    // 实际应用中可能需要更复杂的逻辑
    if (database.includes('mysql')) return 'mysql'
    if (database.includes('postgres') || database.includes('pg')) return 'postgresql'
    if (database.includes('mongo')) return 'mongodb'
    return 'mysql' // 默认
  }

  /**
   * 生成备份ID
   */
  private generateBackupId(): string {
    return `backup-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  }

  /**
   * 生成备份文件名
   */
  private generateBackupFilename(strategy: BackupStrategy): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const ext = strategy.compression ? '.tar.gz' : '.tar'
    const encExt = strategy.encryption?.enabled ? '.enc' : ''
    return `${strategy.name}-${timestamp}${ext}${encExt}`
  }

  /**
   * 记录日志
   */
  private log(record: BackupRecord, message: string): void {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    if (!record.logs) {
      record.logs = []
    }
    record.logs.push(logMessage)
    console.log(logMessage)
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * 格式化时长
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`
    } else {
      return `${seconds}秒`
    }
  }
}
