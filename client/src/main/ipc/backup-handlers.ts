/**
 * 备份管理IPC处理器
 */

import { BackupEngine } from '../backup/backup-engine'
import { OSSStorageProvider, S3StorageProvider, COSStorageProvider } from '../backup/storage-providers'
import type { BackupStrategy, RestoreOptions } from '../../types/backup'
import { GrpcClient } from '../grpc/client'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

// 备份引擎实例
const backupEngines = new Map<string, BackupEngine>()

// 数据存储路径
const getBackupDataPath = () => path.join(app.getPath('userData'), 'backup-data.json')

/**
 * 获取或创建备份引擎
 */
function getBackupEngine(serverId: string, grpcClient: GrpcClient): BackupEngine {
  let engine = backupEngines.get(serverId)
  if (!engine) {
    engine = new BackupEngine(grpcClient)
    
    // 注册云存储提供商
    engine.registerStorageProvider('oss', new OSSStorageProvider())
    engine.registerStorageProvider('s3', new S3StorageProvider())
    engine.registerStorageProvider('cos', new COSStorageProvider())
    
    backupEngines.set(serverId, engine)
  }
  return engine
}

/**
 * 加载备份数据
 */
async function loadBackupData(): Promise<{
  strategies: BackupStrategy[]
  records: any[]
}> {
  try {
    const dataPath = getBackupDataPath()
    const data = await fs.readFile(dataPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // 文件不存在或解析失败，返回空数据
    return { strategies: [], records: [] }
  }
}

/**
 * 保存备份数据
 */
async function saveBackupData(data: {
  strategies: BackupStrategy[]
  records: any[]
}): Promise<void> {
  const dataPath = getBackupDataPath()
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 设置备份管理的IPC处理器
 */
export function setupBackupHandlers(serverConnections: Map<string, GrpcClient>) {
  const { ipcMain } = require('electron')

  // 获取所有备份策略
  ipcMain.handle('backup:getStrategies', async () => {
    const data = await loadBackupData()
    return data.strategies
  })

  // 创建备份策略
  ipcMain.handle('backup:createStrategy', async (_, strategy: BackupStrategy) => {
    const data = await loadBackupData()
    
    // 生成ID
    strategy.id = `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    strategy.totalBackups = 0
    strategy.totalSize = 0
    
    data.strategies.push(strategy)
    await saveBackupData(data)
    
    return { success: true, data: strategy }
  })

  // 更新备份策略
  ipcMain.handle('backup:updateStrategy', async (_, strategyId: string, updates: Partial<BackupStrategy>) => {
    const data = await loadBackupData()
    const index = data.strategies.findIndex(s => s.id === strategyId)
    
    if (index === -1) {
      return { success: false, error: 'Strategy not found' }
    }
    
    data.strategies[index] = { ...data.strategies[index], ...updates }
    await saveBackupData(data)
    
    return { success: true, data: data.strategies[index] }
  })

  // 删除备份策略
  ipcMain.handle('backup:deleteStrategy', async (_, strategyId: string) => {
    const data = await loadBackupData()
    const index = data.strategies.findIndex(s => s.id === strategyId)
    
    if (index === -1) {
      return { success: false, error: 'Strategy not found' }
    }
    
    data.strategies.splice(index, 1)
    await saveBackupData(data)
    
    return { success: true }
  })

  // 执行备份
  ipcMain.handle('backup:execute', async (_, strategyId: string) => {
    const data = await loadBackupData()
    const strategy = data.strategies.find(s => s.id === strategyId)
    
    if (!strategy) {
      return { success: false, error: 'Strategy not found' }
    }
    
    const grpcClient = serverConnections.get(strategy.serverId)
    if (!grpcClient) {
      return { success: false, error: 'Server not connected' }
    }
    
    try {
      const engine = getBackupEngine(strategy.serverId, grpcClient)
      const record = await engine.executeBackup(strategy)
      
      // 更新策略统计
      strategy.lastBackup = record.startTime
      strategy.totalBackups++
      strategy.totalSize += record.size
      
      // 保存记录
      data.records.push(record)
      await saveBackupData(data)
      
      return { success: true, data: record }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取备份记录
  ipcMain.handle('backup:getRecords', async (_, strategyId?: string) => {
    const data = await loadBackupData()
    
    if (strategyId) {
      return data.records.filter(r => r.strategyId === strategyId)
    }
    
    return data.records
  })

  // 恢复备份
  ipcMain.handle('backup:restore', async (_, options: RestoreOptions) => {
    const data = await loadBackupData()
    const record = data.records.find(r => r.id === options.backupId)
    
    if (!record) {
      return { success: false, error: 'Backup record not found' }
    }
    
    const grpcClient = serverConnections.get(options.serverId)
    if (!grpcClient) {
      return { success: false, error: 'Server not connected' }
    }
    
    try {
      const engine = getBackupEngine(options.serverId, grpcClient)
      const result = await engine.restoreBackup(options)
      
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 删除备份记录
  ipcMain.handle('backup:deleteRecord', async (_, recordId: string) => {
    const data = await loadBackupData()
    const index = data.records.findIndex(r => r.id === recordId)
    
    if (index === -1) {
      return { success: false, error: 'Record not found' }
    }
    
    data.records.splice(index, 1)
    await saveBackupData(data)
    
    return { success: true }
  })
}
