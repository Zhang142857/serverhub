/**
 * 应用商店IPC处理器
 */

import { appDeploymentEngine } from '../app-store/deployment-engine'
import { getAllAppTemplates } from '../app-store/templates'
import type { DeployOptions, AppInstance } from '../../types/app-store'
import { GrpcClient } from '../grpc/client'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

// 数据存储路径
const getAppDataPath = () => path.join(app.getPath('userData'), 'app-data.json')

/**
 * 加载应用数据
 */
async function loadAppData(): Promise<{
  instances: AppInstance[]
}> {
  try {
    const dataPath = getAppDataPath()
    const data = await fs.readFile(dataPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return { instances: [] }
  }
}

/**
 * 保存应用数据
 */
async function saveAppData(data: {
  instances: AppInstance[]
}): Promise<void> {
  const dataPath = getAppDataPath()
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 设置应用商店的IPC处理器
 */
export function setupAppStoreHandlers(serverConnections: Map<string, GrpcClient>) {
  const { ipcMain } = require('electron')

  // 设置gRPC客户端
  for (const [serverId, client] of serverConnections.entries()) {
    appDeploymentEngine.setGrpcClient(serverId, client)
  }

  // 获取所有应用模板
  ipcMain.handle('appStore:getTemplates', async () => {
    return getAllAppTemplates()
  })

  // 部署应用
  ipcMain.handle('appStore:deploy', async (_, options: DeployOptions) => {
    const grpcClient = serverConnections.get(options.serverId)
    if (grpcClient) {
      appDeploymentEngine.setGrpcClient(options.serverId, grpcClient)
    }
    
    const result = await appDeploymentEngine.deployApp(options)
    
    if (result.success && result.data?.instance) {
      const data = await loadAppData()
      data.instances.push(result.data.instance)
      await saveAppData(data)
    }
    
    return result
  })

  // 获取已安装的应用
  ipcMain.handle('appStore:getInstances', async () => {
    return appDeploymentEngine.getAllInstances()
  })

  // 获取应用实例详情
  ipcMain.handle('appStore:getInstance', async (_, instanceId: string) => {
    return appDeploymentEngine.getInstance(instanceId)
  })

  // 启动应用
  ipcMain.handle('appStore:start', async (_, instanceId: string) => {
    const result = await appDeploymentEngine.startApp(instanceId)
    
    if (result.success) {
      const data = await loadAppData()
      const index = data.instances.findIndex(i => i.id === instanceId)
      if (index !== -1) {
        const instance = appDeploymentEngine.getInstance(instanceId)
        if (instance) {
          data.instances[index] = instance
          await saveAppData(data)
        }
      }
    }
    
    return result
  })

  // 停止应用
  ipcMain.handle('appStore:stop', async (_, instanceId: string) => {
    const result = await appDeploymentEngine.stopApp(instanceId)
    
    if (result.success) {
      const data = await loadAppData()
      const index = data.instances.findIndex(i => i.id === instanceId)
      if (index !== -1) {
        const instance = appDeploymentEngine.getInstance(instanceId)
        if (instance) {
          data.instances[index] = instance
          await saveAppData(data)
        }
      }
    }
    
    return result
  })

  // 卸载应用
  ipcMain.handle('appStore:uninstall', async (_, instanceId: string) => {
    const result = await appDeploymentEngine.uninstallApp(instanceId)
    
    if (result.success) {
      const data = await loadAppData()
      const index = data.instances.findIndex(i => i.id === instanceId)
      if (index !== -1) {
        data.instances.splice(index, 1)
        await saveAppData(data)
      }
    }
    
    return result
  })

  // 获取应用统计
  ipcMain.handle('appStore:getStats', async () => {
    const instances = appDeploymentEngine.getAllInstances()
    const totalApps = instances.length
    const runningApps = instances.filter(i => i.status === 'running').length
    const stoppedApps = instances.filter(i => i.status === 'stopped').length
    
    return {
      totalApps,
      runningApps,
      stoppedApps
    }
  })
}

/**
 * 初始化应用商店
 * 从持久化存储加载应用实例
 */
export async function initAppStore(serverConnections: Map<string, GrpcClient>) {
  const data = await loadAppData()
  
  // 恢复所有应用实例到引擎
  // 注意：这里只是恢复数据，不会实际启动容器
  // 实际的容器状态需要通过Docker API查询
  
  console.log(`[AppStore] Loaded ${data.instances.length} app instances from storage`)
}
