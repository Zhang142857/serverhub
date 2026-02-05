/**
 * 插件运行时
 * 提供插件沙箱环境和生命周期管理
 */

import { EventEmitter } from 'events'
import * as vm from 'vm'
import * as path from 'path'
import * as fs from 'fs'
import { pluginLoader, LoadedPlugin, PluginManifest } from './loader'
import { createPluginAPI, PluginAPI } from './api-bridge'

// 插件实例
export interface PluginInstance {
  id: string
  manifest: PluginManifest
  api: PluginAPI
  context: vm.Context
  exports: PluginExports
  state: PluginState
}

// 插件导出
export interface PluginExports {
  activate?: () => Promise<void> | void
  deactivate?: () => Promise<void> | void
  onConfigChange?: (config: Record<string, unknown>) => void
  [key: string]: unknown
}

// 插件状态
export type PluginState = 'inactive' | 'activating' | 'active' | 'deactivating' | 'error'

// 运行时事件
export interface RuntimeEvents {
  'plugin:activating': (pluginId: string) => void
  'plugin:activated': (pluginId: string) => void
  'plugin:deactivating': (pluginId: string) => void
  'plugin:deactivated': (pluginId: string) => void
  'plugin:error': (pluginId: string, error: Error) => void
}

class PluginRuntime extends EventEmitter {
  private instances: Map<string, PluginInstance> = new Map()
  private globalContext: Record<string, unknown> = {}

  constructor() {
    super()
    this.setupGlobalContext()
  }

  /**
   * 设置全局上下文（所有插件共享的只读对象）
   */
  private setupGlobalContext(): void {
    this.globalContext = {
      // 安全的全局对象
      console: {
        log: (...args: unknown[]) => console.log('[Plugin]', ...args),
        warn: (...args: unknown[]) => console.warn('[Plugin]', ...args),
        error: (...args: unknown[]) => console.error('[Plugin]', ...args),
        info: (...args: unknown[]) => console.info('[Plugin]', ...args),
        debug: (...args: unknown[]) => console.debug('[Plugin]', ...args)
      },
      setTimeout: (fn: () => void, ms: number) => {
        if (ms > 60000) ms = 60000 // 最大1分钟
        return setTimeout(fn, ms)
      },
      clearTimeout,
      setInterval: (fn: () => void, ms: number) => {
        if (ms < 1000) ms = 1000 // 最小1秒
        return setInterval(fn, ms)
      },
      clearInterval,
      Promise,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Symbol,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      RegExp,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURI,
      decodeURI,
      encodeURIComponent,
      decodeURIComponent,
      atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
      btoa: (str: string) => Buffer.from(str, 'binary').toString('base64')
    }
  }

  /**
   * 创建插件沙箱上下文
   */
  private createSandbox(plugin: LoadedPlugin, api: PluginAPI): vm.Context {
    const sandbox = {
      ...this.globalContext,
      // 插件专属 API
      serverhub: api,
      // 模块系统
      module: { exports: {} },
      exports: {},
      require: this.createRequire(plugin),
      __dirname: plugin.path,
      __filename: path.join(plugin.path, plugin.manifest.main || 'index.js')
    }

    return vm.createContext(sandbox, {
      name: `plugin:${plugin.manifest.id}`,
      codeGeneration: {
        strings: false, // 禁止 eval
        wasm: false     // 禁止 WebAssembly
      }
    })
  }

  /**
   * 创建受限的 require 函数
   */
  private createRequire(plugin: LoadedPlugin): (moduleName: string) => unknown {
    const allowedModules = ['path', 'url', 'querystring', 'crypto', 'buffer']

    return (moduleName: string): unknown => {
      // 允许的内置模块
      if (allowedModules.includes(moduleName)) {
        return require(moduleName)
      }

      // 相对路径模块（插件内部模块）
      if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
        const modulePath = path.resolve(plugin.path, moduleName)

        // 确保模块在插件目录内
        if (!modulePath.startsWith(plugin.path)) {
          throw new Error(`Cannot require module outside plugin directory: ${moduleName}`)
        }

        // 添加 .js 扩展名
        let fullPath = modulePath
        if (!fs.existsSync(fullPath)) {
          if (fs.existsSync(fullPath + '.js')) {
            fullPath = fullPath + '.js'
          } else if (fs.existsSync(path.join(fullPath, 'index.js'))) {
            fullPath = path.join(fullPath, 'index.js')
          } else {
            throw new Error(`Module not found: ${moduleName}`)
          }
        }

        const code = fs.readFileSync(fullPath, 'utf-8')
        const moduleContext = vm.createContext({
          ...this.globalContext,
          module: { exports: {} },
          exports: {},
          require: this.createRequire(plugin),
          __dirname: path.dirname(fullPath),
          __filename: fullPath
        })

        vm.runInContext(code, moduleContext, { filename: fullPath })
        return moduleContext.module.exports
      }

      throw new Error(`Module not allowed: ${moduleName}`)
    }
  }

  /**
   * 激活插件
   */
  async activate(pluginId: string): Promise<void> {
    const plugin = pluginLoader.getPlugin(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    if (this.instances.has(pluginId)) {
      console.warn(`Plugin ${pluginId} is already active`)
      return
    }

    this.emit('plugin:activating', pluginId)

    try {
      // 创建插件 API
      const api = createPluginAPI(plugin)

      // 创建沙箱
      const context = this.createSandbox(plugin, api)

      // 加载主模块
      const mainPath = path.join(plugin.path, plugin.manifest.main || 'index.js')
      let exports: PluginExports = {}

      if (fs.existsSync(mainPath)) {
        const code = fs.readFileSync(mainPath, 'utf-8')
        vm.runInContext(code, context, {
          filename: mainPath,
          timeout: 10000 // 10秒超时
        })
        exports = context.module.exports as PluginExports
      }

      // 创建实例
      const instance: PluginInstance = {
        id: pluginId,
        manifest: plugin.manifest,
        api,
        context,
        exports,
        state: 'activating'
      }

      this.instances.set(pluginId, instance)

      // 调用激活钩子
      if (exports.activate) {
        await exports.activate()
      }

      instance.state = 'active'
      this.emit('plugin:activated', pluginId)
      console.log(`[PluginRuntime] Plugin ${pluginId} activated`)

    } catch (error) {
      this.emit('plugin:error', pluginId, error as Error)
      throw error
    }
  }

  /**
   * 停用插件
   */
  async deactivate(pluginId: string): Promise<void> {
    const instance = this.instances.get(pluginId)
    if (!instance) {
      console.warn(`Plugin ${pluginId} is not active`)
      return
    }

    this.emit('plugin:deactivating', pluginId)
    instance.state = 'deactivating'

    try {
      // 调用停用钩子
      if (instance.exports.deactivate) {
        await instance.exports.deactivate()
      }

      // 清理 API
      instance.api.dispose()

      // 移除实例
      this.instances.delete(pluginId)

      this.emit('plugin:deactivated', pluginId)
      console.log(`[PluginRuntime] Plugin ${pluginId} deactivated`)

    } catch (error) {
      instance.state = 'error'
      this.emit('plugin:error', pluginId, error as Error)
      throw error
    }
  }

  /**
   * 重新加载插件
   */
  async reload(pluginId: string): Promise<void> {
    if (this.instances.has(pluginId)) {
      await this.deactivate(pluginId)
    }
    await this.activate(pluginId)
  }

  /**
   * 获取插件实例
   */
  getInstance(pluginId: string): PluginInstance | undefined {
    return this.instances.get(pluginId)
  }

  /**
   * 获取所有活动插件
   */
  getActivePlugins(): PluginInstance[] {
    return Array.from(this.instances.values()).filter(i => i.state === 'active')
  }

  /**
   * 调用插件导出的函数
   */
  async callPluginFunction(
    pluginId: string,
    functionName: string,
    ...args: unknown[]
  ): Promise<unknown> {
    const instance = this.instances.get(pluginId)
    if (!instance) {
      throw new Error(`Plugin ${pluginId} is not active`)
    }

    const fn = instance.exports[functionName]
    if (typeof fn !== 'function') {
      throw new Error(`Plugin ${pluginId} does not export function ${functionName}`)
    }

    try {
      return await fn(...args)
    } catch (error) {
      console.error(`[PluginRuntime] Error calling ${pluginId}.${functionName}:`, error)
      throw error
    }
  }

  /**
   * 通知插件配置变更
   */
  notifyConfigChange(pluginId: string, config: Record<string, unknown>): void {
    const instance = this.instances.get(pluginId)
    if (instance?.exports.onConfigChange) {
      try {
        instance.exports.onConfigChange(config)
      } catch (error) {
        console.error(`[PluginRuntime] Error in ${pluginId}.onConfigChange:`, error)
      }
    }
  }

  /**
   * 执行插件工具
   */
  async executePluginTool(
    pluginId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const instance = this.instances.get(pluginId)
    if (!instance) {
      throw new Error(`Plugin ${pluginId} is not active`)
    }

    const plugin = pluginLoader.getPlugin(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    const tool = plugin.manifest.capabilities.tools?.find(t => t.name === toolName)
    if (!tool) {
      throw new Error(`Tool ${toolName} not found in plugin ${pluginId}`)
    }

    // 调用工具处理函数
    return await this.callPluginFunction(pluginId, tool.handler, args)
  }

  /**
   * 停用所有插件
   */
  async deactivateAll(): Promise<void> {
    const pluginIds = Array.from(this.instances.keys())
    for (const pluginId of pluginIds) {
      try {
        await this.deactivate(pluginId)
      } catch (error) {
        console.error(`[PluginRuntime] Failed to deactivate ${pluginId}:`, error)
      }
    }
  }
}

// 单例导出
export const pluginRuntime = new PluginRuntime()
export default pluginRuntime
