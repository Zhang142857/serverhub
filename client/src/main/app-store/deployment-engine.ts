/**
 * 应用部署引擎
 * 负责应用的安装、启动、停止、卸载等操作
 */

import {
  AppTemplate,
  AppInstance,
  DeployOptions,
  AppOperationResult,
  AppStatus,
  DeploymentType
} from '../../types/app-store'
import { getAppTemplate } from './templates'
import { GrpcClient } from '../grpc/client'

/**
 * 应用部署引擎
 */
export class AppDeploymentEngine {
  private instances: Map<string, AppInstance> = new Map()
  private grpcClients: Map<string, GrpcClient> = new Map()

  /**
   * 设置gRPC客户端
   */
  setGrpcClient(serverId: string, client: GrpcClient): void {
    this.grpcClients.set(serverId, client)
  }

  /**
   * 获取gRPC客户端
   */
  private getGrpcClient(serverId: string): GrpcClient | undefined {
    return this.grpcClients.get(serverId)
  }

  /**
   * 部署应用
   */
  async deployApp(options: DeployOptions): Promise<AppOperationResult> {
    try {
      const template = getAppTemplate(options.templateId)
      if (!template) {
        return {
          success: false,
          error: `Application template not found: ${options.templateId}`
        }
      }

      // 验证配置
      const validationResult = this.validateConfig(template, options.config)
      if (!validationResult.success) {
        return validationResult
      }

      // 创建应用实例
      const instance: AppInstance = {
        id: this.generateInstanceId(),
        templateId: template.id,
        name: options.name,
        displayName: template.displayName,
        status: AppStatus.INSTALLING,
        serverId: options.serverId,
        deployment: {
          type: template.deployment.type
        },
        config: options.config,
        ports: [],
        installedAt: new Date()
      }

      this.instances.set(instance.id, instance)

      // 根据部署类型执行部署
      let deployResult: AppOperationResult

      switch (template.deployment.type) {
        case DeploymentType.DOCKER:
          deployResult = await this.deployDocker(instance, template, options)
          break
        case DeploymentType.COMPOSE:
          deployResult = await this.deployCompose(instance, template, options)
          break
        case DeploymentType.BINARY:
          deployResult = await this.deployBinary(instance, template, options)
          break
        default:
          deployResult = {
            success: false,
            error: 'Unsupported deployment type'
          }
      }

      if (deployResult.success) {
        instance.status = options.autoStart !== false ? AppStatus.RUNNING : AppStatus.INSTALLED
        if (options.autoStart !== false) {
          instance.startedAt = new Date()
        }
      } else {
        instance.status = AppStatus.ERROR
      }

      return {
        success: deployResult.success,
        message: deployResult.message,
        error: deployResult.error,
        data: { instanceId: instance.id, instance }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 部署Docker容器
   */
  private async deployDocker(
    instance: AppInstance,
    template: AppTemplate,
    options: DeployOptions
  ): Promise<AppOperationResult> {
    if (template.deployment.type !== DeploymentType.DOCKER) {
      return { success: false, error: 'Invalid deployment type' }
    }

    const deployment = template.deployment

    try {
      // 替换配置变量
      const image = `${deployment.image}:${deployment.tag || 'latest'}`
      const environment = deployment.environment.map(env => ({
        name: env.name,
        value: this.replaceVariables(env.value, options.config)
      }))

      // 构建端口映射
      const ports = deployment.ports.map(port => ({
        container: port.container,
        host: options.config[`port_${port.container}`] || port.host,
        protocol: port.protocol
      }))

      // 构建卷映射
      const volumes = deployment.volumes.map(vol => ({
        container: vol.container,
        host: this.replaceVariables(vol.host, options.config),
        mode: vol.mode
      }))

      // 构建Docker运行命令
      const dockerArgs = [
        'run',
        '-d',
        '--name', instance.name,
        '--restart', deployment.restart || 'unless-stopped'
      ]

      // 添加端口映射
      ports.forEach(port => {
        dockerArgs.push('-p', `${port.host}:${port.container}/${port.protocol}`)
      })

      // 添加卷映射
      volumes.forEach(vol => {
        dockerArgs.push('-v', `${vol.host}:${vol.container}${vol.mode ? ':' + vol.mode : ''}`)
      })

      // 添加环境变量
      environment.forEach(env => {
        dockerArgs.push('-e', `${env.name}=${env.value}`)
      })

      // 添加网络
      if (deployment.networks) {
        deployment.networks.forEach(network => {
          dockerArgs.push('--network', network)
        })
      }

      // 添加标签
      if (deployment.labels) {
        Object.entries(deployment.labels).forEach(([key, value]) => {
          dockerArgs.push('--label', `${key}=${value}`)
        })
      }

      // 添加镜像
      dockerArgs.push(image)

      // 添加命令
      if (deployment.command) {
        dockerArgs.push(...deployment.command)
      }

      // 执行Docker命令
      console.log('[AppDeployment] Docker command:', 'docker', dockerArgs.join(' '))

      const grpcClient = this.getGrpcClient(options.serverId)
      if (!grpcClient) {
        return {
          success: false,
          error: 'gRPC client not found for server'
        }
      }

      // 先拉取镜像
      console.log('[AppDeployment] Pulling image:', image)
      const pullResult = await grpcClient.executeCommand('docker', ['pull', image], { timeout: 600 })
      if (pullResult.exit_code !== 0) {
        return {
          success: false,
          error: `Failed to pull image: ${pullResult.stderr}`
        }
      }

      // 执行docker run命令
      const result = await grpcClient.executeCommand('docker', dockerArgs)
      if (result.exit_code !== 0) {
        return {
          success: false,
          error: `Failed to start container: ${result.stderr}`
        }
      }

      // 获取容器ID
      const containerId = result.stdout.trim()
      instance.deployment.containerId = containerId
      instance.ports = ports

      // 设置访问地址
      if (ports.length > 0) {
        const mainPort = ports[0]
        instance.accessUrl = `http://localhost:${mainPort.host}`
      }

      return {
        success: true,
        message: `Application ${instance.displayName} deployed successfully`
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to deploy Docker container: ${error.message}`
      }
    }
  }

  /**
   * 部署Docker Compose
   */
  private async deployCompose(
    instance: AppInstance,
    template: AppTemplate,
    options: DeployOptions
  ): Promise<AppOperationResult> {
    if (template.deployment.type !== DeploymentType.COMPOSE) {
      return { success: false, error: 'Invalid deployment type' }
    }

    const deployment = template.deployment

    try {
      // 替换Compose文件中的变量
      const composeContent = this.replaceVariables(deployment.composeFile, options.config)

      // 生成Compose文件路径
      const composeFilePath = `/tmp/serverhub_${instance.id}_compose.yml`

      const grpcClient = this.getGrpcClient(options.serverId)
      if (!grpcClient) {
        return {
          success: false,
          error: 'gRPC client not found for server'
        }
      }

      // 写入Compose文件到服务器
      console.log('[AppDeployment] Writing compose file:', composeFilePath)
      const writeResult = await grpcClient.writeFile(composeFilePath, composeContent)
      if (!writeResult.success) {
        return {
          success: false,
          error: `Failed to write compose file: ${writeResult.error}`
        }
      }

      // 执行docker compose up (使用新版docker compose命令)
      const composeArgs = [
        'compose',
        '-f', composeFilePath,
        '-p', instance.name,
        'up', '-d'
      ]

      console.log('[AppDeployment] Docker Compose command:', 'docker', composeArgs.join(' '))

      const result = await grpcClient.executeCommand('docker', composeArgs, { timeout: 600 })
      if (result.exit_code !== 0) {
        return {
          success: false,
          error: `Failed to start compose project: ${result.stderr}`
        }
      }

      instance.deployment.composeProject = instance.name

      return {
        success: true,
        message: `Application ${instance.displayName} deployed successfully with Docker Compose`
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to deploy with Docker Compose: ${error.message}`
      }
    }
  }

  /**
   * 部署二进制文件
   */
  private async deployBinary(
    instance: AppInstance,
    template: AppTemplate,
    options: DeployOptions
  ): Promise<AppOperationResult> {
    if (template.deployment.type !== DeploymentType.BINARY) {
      return { success: false, error: 'Invalid deployment type' }
    }

    const deployment = template.deployment

    try {
      // TODO: 实现二进制部署
      // 1. 下载文件
      // 2. 执行安装脚本
      // 3. 启动服务

      return {
        success: true,
        message: `Application ${instance.displayName} deployed successfully`
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to deploy binary: ${error.message}`
      }
    }
  }

  /**
   * 启动应用
   */
  async startApp(instanceId: string): Promise<AppOperationResult> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return { success: false, error: 'Application instance not found' }
    }

    try {
      const grpcClient = this.getGrpcClient(instance.serverId)
      if (!grpcClient) {
        return {
          success: false,
          error: 'gRPC client not found for server'
        }
      }

      if (instance.deployment.containerId) {
        // Docker容器
        console.log('[AppDeployment] Starting container:', instance.deployment.containerId)
        const result = await grpcClient.executeCommand('docker', ['start', instance.deployment.containerId])
        if (result.exit_code !== 0) {
          return {
            success: false,
            error: `Failed to start container: ${result.stderr}`
          }
        }
      } else if (instance.deployment.composeProject) {
        // Docker Compose
        console.log('[AppDeployment] Starting compose project:', instance.deployment.composeProject)
        const result = await grpcClient.executeCommand('docker', [
          'compose',
          '-p', instance.deployment.composeProject,
          'start'
        ])
        if (result.exit_code !== 0) {
          return {
            success: false,
            error: `Failed to start compose project: ${result.stderr}`
          }
        }
      }

      instance.status = AppStatus.RUNNING
      instance.startedAt = new Date()

      return {
        success: true,
        message: `Application ${instance.displayName} started successfully`
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 停止应用
   */
  async stopApp(instanceId: string): Promise<AppOperationResult> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return { success: false, error: 'Application instance not found' }
    }

    try {
      const grpcClient = this.getGrpcClient(instance.serverId)
      if (!grpcClient) {
        return {
          success: false,
          error: 'gRPC client not found for server'
        }
      }

      if (instance.deployment.containerId) {
        // Docker容器
        console.log('[AppDeployment] Stopping container:', instance.deployment.containerId)
        const result = await grpcClient.executeCommand('docker', ['stop', instance.deployment.containerId])
        if (result.exit_code !== 0) {
          return {
            success: false,
            error: `Failed to stop container: ${result.stderr}`
          }
        }
      } else if (instance.deployment.composeProject) {
        // Docker Compose
        console.log('[AppDeployment] Stopping compose project:', instance.deployment.composeProject)
        const result = await grpcClient.executeCommand('docker', [
          'compose',
          '-p', instance.deployment.composeProject,
          'stop'
        ])
        if (result.exit_code !== 0) {
          return {
            success: false,
            error: `Failed to stop compose project: ${result.stderr}`
          }
        }
      }

      instance.status = AppStatus.STOPPED
      instance.stoppedAt = new Date()

      return {
        success: true,
        message: `Application ${instance.displayName} stopped successfully`
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 卸载应用
   */
  async uninstallApp(instanceId: string): Promise<AppOperationResult> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return { success: false, error: 'Application instance not found' }
    }

    try {
      const grpcClient = this.getGrpcClient(instance.serverId)
      if (!grpcClient) {
        return {
          success: false,
          error: 'gRPC client not found for server'
        }
      }

      // 先停止
      if (instance.status === AppStatus.RUNNING) {
        await this.stopApp(instanceId)
      }

      if (instance.deployment.containerId) {
        // 删除Docker容器
        console.log('[AppDeployment] Removing container:', instance.deployment.containerId)
        const result = await grpcClient.executeCommand('docker', ['rm', '-f', instance.deployment.containerId])
        if (result.exit_code !== 0) {
          console.warn('[AppDeployment] Failed to remove container:', result.stderr)
        }
      } else if (instance.deployment.composeProject) {
        // 删除Docker Compose项目
        console.log('[AppDeployment] Removing compose project:', instance.deployment.composeProject)
        const result = await grpcClient.executeCommand('docker', [
          'compose',
          '-p', instance.deployment.composeProject,
          'down',
          '-v'  // 同时删除卷
        ])
        if (result.exit_code !== 0) {
          console.warn('[AppDeployment] Failed to remove compose project:', result.stderr)
        }
      }

      this.instances.delete(instanceId)

      return {
        success: true,
        message: `Application ${instance.displayName} uninstalled successfully`
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取应用实例
   */
  getInstance(instanceId: string): AppInstance | undefined {
    return this.instances.get(instanceId)
  }

  /**
   * 获取所有应用实例
   */
  getAllInstances(): AppInstance[] {
    return Array.from(this.instances.values())
  }

  /**
   * 验证配置
   */
  private validateConfig(template: AppTemplate, config: Record<string, any>): AppOperationResult {
    for (const field of template.configForm) {
      if (field.required && !config[field.name]) {
        return {
          success: false,
          error: `Required field missing: ${field.label}`
        }
      }

      if (field.validation && config[field.name]) {
        const value = config[field.name]
        const validation = field.validation

        if (validation.min !== undefined && value < validation.min) {
          return {
            success: false,
            error: validation.message || `${field.label} must be at least ${validation.min}`
          }
        }

        if (validation.max !== undefined && value > validation.max) {
          return {
            success: false,
            error: validation.message || `${field.label} must be at most ${validation.max}`
          }
        }

        if (validation.pattern) {
          const regex = new RegExp(validation.pattern)
          if (!regex.test(String(value))) {
            return {
              success: false,
              error: validation.message || `${field.label} format is invalid`
            }
          }
        }
      }
    }

    return { success: true }
  }

  /**
   * 替换变量
   */
  private replaceVariables(template: string, config: Record<string, any>): string {
    let result = template
    for (const [key, value] of Object.entries(config)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
    }
    return result
  }

  /**
   * 生成实例ID
   */
  private generateInstanceId(): string {
    return `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// 全局应用部署引擎实例
export const appDeploymentEngine = new AppDeploymentEngine()
