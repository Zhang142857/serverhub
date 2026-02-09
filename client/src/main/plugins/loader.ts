/**
 * 插件加载器
 * 负责插件的发现、验证、加载和卸载
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'

// 插件清单格式
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  icon?: string
  main?: string           // 主进程入口
  renderer?: string       // 渲染进程入口
  permissions: PluginPermission[]
  capabilities: {
    menus?: PluginMenu[]
    routes?: PluginRoute[]
    tools?: PluginTool[]
  }
  dependencies?: string[]
  minAppVersion?: string
  homepage?: string
  repository?: string
}

export type PluginPermission =
  | 'menu:register'
  | 'route:register'
  | 'tool:register'
  | 'server:read'
  | 'server:write'
  | 'file:read'
  | 'file:write'
  | 'command:execute'
  | 'network:request'

export interface PluginMenu {
  id: string
  label: string
  icon?: string
  route?: string
  position?: 'sidebar' | 'topbar' | 'context'
  order?: number
  parent?: string
}

export interface PluginRoute {
  path: string
  name: string
  component: string  // 相对于插件目录的组件路径
  meta?: Record<string, unknown>
}

export interface PluginTool {
  name: string
  displayName: string
  description: string
  category: string
  dangerous?: boolean
  parameters: Record<string, {
    type: string
    description: string
    required?: boolean
    default?: unknown
  }>
  handler: string  // 处理函数名
}

// 插件状态
export type PluginStatus = 'installed' | 'enabled' | 'disabled' | 'error' | 'updating'

// 加载的插件信息
export interface LoadedPlugin {
  manifest: PluginManifest
  status: PluginStatus
  path: string
  error?: string
  installedAt: Date
  updatedAt: Date
  config?: Record<string, unknown>
}

// 插件源
export interface PluginSource {
  id: string
  name: string
  url: string
  type: 'official' | 'community' | 'local'
}

// 远程插件信息
export interface RemotePlugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  icon?: string
  downloads: number
  rating: number
  ratingCount: number
  tags: string[]
  category: string
  official: boolean
  downloadUrl: string
  homepage?: string
  updatedAt: string
}

class PluginLoader extends EventEmitter {
  private pluginsDir: string
  private plugins: Map<string, LoadedPlugin> = new Map()
  private sources: PluginSource[] = []

  constructor() {
    super()
    // 插件目录
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins')
    this.ensurePluginsDir()
    this.initSources()
  }

  private ensurePluginsDir(): void {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true })
    }
  }

  private initSources(): void {
    // 官方插件源
    this.sources = [
      {
        id: 'official',
        name: 'Runixo Official',
        url: 'https://plugins.runixo.dev/api/v1',
        type: 'official'
      }
    ]
  }

  /**
   * 初始化插件系统，加载所有已安装的插件
   */
  async initialize(): Promise<void> {
    console.log('[PluginLoader] Initializing plugin system...')
    await this.discoverPlugins()
    await this.loadEnabledPlugins()
    console.log(`[PluginLoader] Loaded ${this.plugins.size} plugins`)
  }

  /**
   * 发现已安装的插件
   */
  async discoverPlugins(): Promise<void> {
    const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(this.pluginsDir, entry.name)
        const manifestPath = path.join(pluginPath, 'plugin.json')

        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = await this.loadManifest(manifestPath)
            const statusPath = path.join(pluginPath, '.status.json')
            let status: PluginStatus = 'installed'
            let config: Record<string, unknown> = {}
            let installedAt = new Date()
            let updatedAt = new Date()

            if (fs.existsSync(statusPath)) {
              const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
              status = statusData.enabled ? 'enabled' : 'disabled'
              config = statusData.config || {}
              installedAt = new Date(statusData.installedAt || Date.now())
              updatedAt = new Date(statusData.updatedAt || Date.now())
            }

            this.plugins.set(manifest.id, {
              manifest,
              status,
              path: pluginPath,
              installedAt,
              updatedAt,
              config
            })
          } catch (error) {
            console.error(`[PluginLoader] Failed to load plugin from ${pluginPath}:`, error)
          }
        }
      }
    }
  }

  /**
   * 加载插件清单
   */
  private async loadManifest(manifestPath: string): Promise<PluginManifest> {
    const content = fs.readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(content) as PluginManifest

    // 验证必需字段
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error('Invalid manifest: missing required fields (id, name, version)')
    }

    // 设置默认值
    manifest.permissions = manifest.permissions || []
    manifest.capabilities = manifest.capabilities || {}

    return manifest
  }

  /**
   * 加载所有启用的插件
   */
  private async loadEnabledPlugins(): Promise<void> {
    for (const [id, plugin] of this.plugins) {
      if (plugin.status === 'enabled') {
        try {
          await this.loadPlugin(id)
        } catch (error) {
          console.error(`[PluginLoader] Failed to load plugin ${id}:`, error)
          plugin.status = 'error'
          plugin.error = (error as Error).message
        }
      }
    }
  }

  /**
   * 加载单个插件
   */
  async loadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    // 检查依赖
    if (plugin.manifest.dependencies) {
      for (const dep of plugin.manifest.dependencies) {
        const depPlugin = this.plugins.get(dep)
        if (!depPlugin || depPlugin.status !== 'enabled') {
          throw new Error(`Missing dependency: ${dep}`)
        }
      }
    }

    // 加载主进程模块
    if (plugin.manifest.main) {
      const mainPath = path.join(plugin.path, plugin.manifest.main)
      if (fs.existsSync(mainPath)) {
        // 动态加载主进程模块
        // 注意：实际实现需要使用沙箱环境
        console.log(`[PluginLoader] Loading main module: ${mainPath}`)
      }
    }

    plugin.status = 'enabled'
    this.emit('plugin:loaded', pluginId, plugin)
  }

  /**
   * 卸载插件
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    // 检查是否有其他插件依赖此插件
    for (const [id, p] of this.plugins) {
      if (p.manifest.dependencies?.includes(pluginId) && p.status === 'enabled') {
        throw new Error(`Cannot unload: plugin ${id} depends on ${pluginId}`)
      }
    }

    plugin.status = 'disabled'
    this.savePluginStatus(pluginId)
    this.emit('plugin:unloaded', pluginId)
  }

  /**
   * 安装插件
   */
  async installPlugin(source: string, pluginId: string): Promise<LoadedPlugin> {
    console.log(`[PluginLoader] Installing plugin ${pluginId} from ${source}`)

    // 从远程下载插件
    // 这里简化实现，实际需要下载、解压、验证签名等
    const pluginPath = path.join(this.pluginsDir, pluginId)

    if (fs.existsSync(pluginPath)) {
      throw new Error(`Plugin ${pluginId} already installed`)
    }

    // 创建插件目录
    fs.mkdirSync(pluginPath, { recursive: true })

    // TODO: 实际下载和解压插件包
    // 这里创建一个示例清单
    const manifest: PluginManifest = {
      id: pluginId,
      name: pluginId,
      version: '1.0.0',
      description: 'Plugin description',
      author: 'Unknown',
      permissions: [],
      capabilities: {}
    }

    fs.writeFileSync(
      path.join(pluginPath, 'plugin.json'),
      JSON.stringify(manifest, null, 2)
    )

    const plugin: LoadedPlugin = {
      manifest,
      status: 'enabled',
      path: pluginPath,
      installedAt: new Date(),
      updatedAt: new Date()
    }

    this.plugins.set(pluginId, plugin)
    this.savePluginStatus(pluginId)
    this.emit('plugin:installed', pluginId, plugin)

    return plugin
  }

  /**
   * 从 .shplugin 文件安装插件
   */
  async installFromFile(filePath: string): Promise<LoadedPlugin> {
    if (!filePath.endsWith('.shplugin')) throw new Error('Invalid file: must be .shplugin format')
    const { execSync } = require('child_process')
    const tmpDir = path.join(this.pluginsDir, '_tmp_' + Date.now())
    fs.mkdirSync(tmpDir, { recursive: true })
    try {
      // 使用系统自带的解压工具
      if (process.platform === 'win32') {
        const zipPath = filePath.replace(/\.shplugin$/, '.zip')
        fs.copyFileSync(filePath, zipPath)
        try {
          execSync(`powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${tmpDir}'"`)
        } finally {
          try { fs.unlinkSync(zipPath) } catch {}
        }
      } else {
        execSync(`unzip -o "${filePath}" -d "${tmpDir}"`)
      }
      const mPath = path.join(tmpDir, 'plugin.json')
      if (!fs.existsSync(mPath)) throw new Error('Invalid plugin: plugin.json not found in archive')
      const manifest = await this.loadManifest(mPath)
      const targetPath = path.join(this.pluginsDir, manifest.id)
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true })
        this.plugins.delete(manifest.id)
      }
      fs.renameSync(tmpDir, targetPath)
      const plugin: LoadedPlugin = { manifest, status: 'enabled', path: targetPath, installedAt: new Date(), updatedAt: new Date() }
      this.plugins.set(manifest.id, plugin)
      this.savePluginStatus(manifest.id)
      this.emit('plugin:installed', manifest.id, plugin)
      return plugin
    } catch (e) {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true })
      throw e
    }
  }

  /**
   * 从本地路径安装插件
   */
  async installFromPath(sourcePath: string): Promise<LoadedPlugin> {
    const manifestPath = path.join(sourcePath, 'plugin.json')
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Invalid plugin: plugin.json not found')
    }

    const manifest = await this.loadManifest(manifestPath)
    const targetPath = path.join(this.pluginsDir, manifest.id)

    if (fs.existsSync(targetPath)) {
      throw new Error(`Plugin ${manifest.id} already installed`)
    }

    // 复制插件文件
    this.copyDirectory(sourcePath, targetPath)

    const plugin: LoadedPlugin = {
      manifest,
      status: 'enabled',
      path: targetPath,
      installedAt: new Date(),
      updatedAt: new Date()
    }

    this.plugins.set(manifest.id, plugin)
    this.savePluginStatus(manifest.id)
    this.emit('plugin:installed', manifest.id, plugin)

    return plugin
  }

  /**
   * 卸载插件（删除文件）
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    // 先卸载
    if (plugin.status === 'enabled') {
      await this.unloadPlugin(pluginId)
    }

    // 删除文件
    this.removeDirectory(plugin.path)
    this.plugins.delete(pluginId)
    this.emit('plugin:uninstalled', pluginId)
  }

  /**
   * 启用插件
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    await this.loadPlugin(pluginId)
    this.savePluginStatus(pluginId)
  }

  /**
   * 禁用插件
   */
  async disablePlugin(pluginId: string): Promise<void> {
    await this.unloadPlugin(pluginId)
  }

  /**
   * 更新插件配置
   */
  updatePluginConfig(pluginId: string, config: Record<string, unknown>): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    plugin.config = { ...plugin.config, ...config }
    this.savePluginStatus(pluginId)
    this.emit('plugin:config-updated', pluginId, plugin.config)
  }

  /**
   * 保存插件状态
   */
  private savePluginStatus(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    const statusPath = path.join(plugin.path, '.status.json')
    const statusData = {
      enabled: plugin.status === 'enabled',
      config: plugin.config,
      installedAt: plugin.installedAt.toISOString(),
      updatedAt: new Date().toISOString()
    }

    fs.writeFileSync(statusPath, JSON.stringify(statusData, null, 2))
  }

  /**
   * 获取所有插件
   */
  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取单个插件
   */
  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * 获取启用的插件
   */
  getEnabledPlugins(): LoadedPlugin[] {
    return this.getPlugins().filter(p => p.status === 'enabled')
  }

  /**
   * 获取所有插件菜单
   */
  getPluginMenus(): Array<PluginMenu & { pluginId: string }> {
    const menus: Array<PluginMenu & { pluginId: string }> = []

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.manifest.capabilities.menus) {
        for (const menu of plugin.manifest.capabilities.menus) {
          menus.push({ ...menu, pluginId: plugin.manifest.id })
        }
      }
    }

    return menus.sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  /**
   * 获取所有插件路由
   */
  getPluginRoutes(): Array<PluginRoute & { pluginId: string }> {
    const routes: Array<PluginRoute & { pluginId: string }> = []

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.manifest.capabilities.routes) {
        for (const route of plugin.manifest.capabilities.routes) {
          routes.push({ ...route, pluginId: plugin.manifest.id })
        }
      }
    }

    return routes
  }

  /**
   * 获取所有插件工具
   */
  getPluginTools(): Array<PluginTool & { pluginId: string }> {
    const tools: Array<PluginTool & { pluginId: string }> = []

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.manifest.capabilities.tools) {
        for (const tool of plugin.manifest.capabilities.tools) {
          tools.push({ ...tool, pluginId: plugin.manifest.id })
        }
      }
    }

    return tools
  }

  /**
   * 获取插件源列表
   */
  getSources(): PluginSource[] {
    return this.sources
  }

  /**
   * 添加插件源
   */
  addSource(source: PluginSource): void {
    if (this.sources.find(s => s.id === source.id)) {
      throw new Error(`Source ${source.id} already exists`)
    }
    this.sources.push(source)
    this.emit('source:added', source)
  }

  /**
   * 移除插件源
   */
  removeSource(sourceId: string): void {
    const index = this.sources.findIndex(s => s.id === sourceId)
    if (index === -1) {
      throw new Error(`Source ${sourceId} not found`)
    }
    if (this.sources[index].type === 'official') {
      throw new Error('Cannot remove official source')
    }
    this.sources.splice(index, 1)
    this.emit('source:removed', sourceId)
  }

  // 辅助方法
  private copyDirectory(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true })
    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  private removeDirectory(dir: string): void {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
}

// 单例导出
export const pluginLoader = new PluginLoader()
export default pluginLoader
