/**
 * 插件状态管理
 * 管理插件安装状态、配置、动态菜单和路由
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 插件信息
export interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  author: string
  icon?: string
  status: 'installed' | 'enabled' | 'disabled' | 'error' | 'updating'
  permissions: string[]
  capabilities: {
    menus?: PluginMenu[]
    routes?: PluginRoute[]
    tools?: PluginTool[]
  }
  config?: Record<string, unknown>
  error?: string
}

// 插件菜单
export interface PluginMenu {
  id: string
  pluginId: string
  label: string
  icon?: string
  route?: string
  position?: 'sidebar' | 'topbar' | 'context'
  order?: number
  parent?: string
}

// 插件路由
export interface PluginRoute {
  path: string
  name: string
  component: string
  pluginId: string
  meta?: Record<string, unknown>
}

// 插件工具
export interface PluginTool {
  name: string
  displayName: string
  description: string
  category: string
  dangerous?: boolean
  pluginId: string
}

// 远程插件（市场）
export interface MarketPlugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  icon?: string
  iconBg?: string
  downloads: number
  rating: number
  ratingCount: number
  tags: string[]
  category: string
  official: boolean
  downloadUrl: string
  homepage?: string
  updatedAt: string
  features?: string[]
  changelog?: Array<{ version: string; date: string; changes: string[] }>
}

export const usePluginStore = defineStore('plugin', () => {
  // 状态
  const plugins = ref<PluginInfo[]>([])
  const marketPlugins = ref<MarketPlugin[]>([])
  const dynamicMenus = ref<PluginMenu[]>([])
  const dynamicRoutes = ref<PluginRoute[]>([])
  const loading = ref(false)
  const marketLoading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const installedPlugins = computed(() => plugins.value.filter(p => p.status !== 'error'))
  const enabledPlugins = computed(() => plugins.value.filter(p => p.status === 'enabled'))
  const disabledPlugins = computed(() => plugins.value.filter(p => p.status === 'disabled'))

  const sidebarMenus = computed(() =>
    dynamicMenus.value
      .filter(m => m.position === 'sidebar' || !m.position)
      .sort((a, b) => (a.order || 100) - (b.order || 100))
  )

  const pluginTools = computed(() => {
    const tools: PluginTool[] = []
    for (const plugin of enabledPlugins.value) {
      if (plugin.capabilities.tools) {
        for (const tool of plugin.capabilities.tools) {
          tools.push({ ...tool, pluginId: plugin.id })
        }
      }
    }
    return tools
  })

  // 初始化
  async function initialize(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      // 加载已安装的插件
      await loadInstalledPlugins()
      // 加载动态菜单
      await loadDynamicMenus()
      // 加载动态路由
      await loadDynamicRoutes()
    } catch (e) {
      error.value = (e as Error).message
      console.error('[PluginStore] Initialize failed:', e)
    } finally {
      loading.value = false
    }
  }

  // 加载已安装的插件
  async function loadInstalledPlugins(): Promise<void> {
    try {
      const result = await window.electronAPI.plugin.list()
      plugins.value = result
    } catch (e) {
      console.error('[PluginStore] Failed to load plugins:', e)
      // 使用本地存储的数据作为后备
      const saved = localStorage.getItem('runixo_plugins_cache')
      if (saved) {
        plugins.value = JSON.parse(saved)
      }
    }
  }

  // 加载动态菜单
  async function loadDynamicMenus(): Promise<void> {
    try {
      const menus = await window.electronAPI.plugin.getMenus()
      dynamicMenus.value = menus
    } catch (e) {
      console.error('[PluginStore] Failed to load menus:', e)
    }
  }

  // 加载动态路由
  async function loadDynamicRoutes(): Promise<void> {
    try {
      const routes = await window.electronAPI.plugin.getRoutes()
      dynamicRoutes.value = routes
    } catch (e) {
      console.error('[PluginStore] Failed to load routes:', e)
    }
  }

  // 加载市场插件
  async function loadMarketPlugins(): Promise<void> {
    marketLoading.value = true
    try {
      // 检查在线模式
      const saved = localStorage.getItem('runixo_settings')
      const settings = saved ? JSON.parse(saved) : {}
      if (settings.server?.onlineMode && settings.server?.url) {
        const resp = await fetch(`${settings.server.url}/api/v1/plugins/list`)
        if (resp.ok) {
          const data = await resp.json()
          if (data.plugins?.length > 0) {
            marketPlugins.value = data.plugins.map((p: any) => ({
              id: p.id, name: p.name, version: p.version,
              description: p.description, author: p.author,
              icon: p.icon || '', iconBg: p.iconBg || '',
              downloads: p.downloads || 0, rating: p.rating || 0,
              ratingCount: p.ratingCount || 0,
              tags: p.tags || p.keywords || [],
              category: p.category || 'tools',
              official: p.official ?? true,
              downloadUrl: p.download_url || '',
              updatedAt: p.updatedAt || '',
              features: p.features || []
            }))
            return
          }
        }
      }
      // 离线或请求失败：尝试 IPC，再降级到默认数据
      const result = await window.electronAPI.plugin.getMarketPlugins()
      if (result && result.length > 0) {
        marketPlugins.value = result
      } else {
        marketPlugins.value = getDefaultMarketPlugins()
      }
    } catch (e) {
      console.error('[PluginStore] Failed to load market plugins:', e)
      marketPlugins.value = getDefaultMarketPlugins()
    } finally {
      marketLoading.value = false
    }
  }

  // 安装插件
  async function installPlugin(pluginId: string): Promise<boolean> {
    const plugin = marketPlugins.value.find(p => p.id === pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found in market`)
    }

    try {
      await window.electronAPI.plugin.install(pluginId)

      // 添加到已安装列表
      plugins.value.push({
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        icon: plugin.icon,
        status: 'installed',
        permissions: [],
        capabilities: {}
      })

      // 缓存到本地
      savePluginsCache()

      return true
    } catch (e) {
      console.error('[PluginStore] Install failed:', e)
      throw e
    }
  }

  // 卸载插件
  async function uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      await window.electronAPI.plugin.uninstall(pluginId)

      // 从列表中移除
      const index = plugins.value.findIndex(p => p.id === pluginId)
      if (index !== -1) {
        plugins.value.splice(index, 1)
      }

      // 移除相关菜单
      dynamicMenus.value = dynamicMenus.value.filter(m => m.pluginId !== pluginId)

      // 移除相关路由
      dynamicRoutes.value = dynamicRoutes.value.filter(r => r.pluginId !== pluginId)

      savePluginsCache()
      return true
    } catch (e) {
      console.error('[PluginStore] Uninstall failed:', e)
      throw e
    }
  }

  // 启用插件
  async function enablePlugin(pluginId: string): Promise<boolean> {
    try {
      await window.electronAPI.plugin.enable(pluginId)

      const plugin = plugins.value.find(p => p.id === pluginId)
      if (plugin) {
        plugin.status = 'enabled'
      }

      // 重新加载菜单和路由
      await loadDynamicMenus()
      await loadDynamicRoutes()

      savePluginsCache()
      return true
    } catch (e) {
      console.error('[PluginStore] Enable failed:', e)
      throw e
    }
  }

  // 禁用插件
  async function disablePlugin(pluginId: string): Promise<boolean> {
    try {
      await window.electronAPI.plugin.disable(pluginId)

      const plugin = plugins.value.find(p => p.id === pluginId)
      if (plugin) {
        plugin.status = 'disabled'
      }

      // 移除相关菜单
      dynamicMenus.value = dynamicMenus.value.filter(m => m.pluginId !== pluginId)

      // 移除相关路由
      dynamicRoutes.value = dynamicRoutes.value.filter(r => r.pluginId !== pluginId)

      savePluginsCache()
      return true
    } catch (e) {
      console.error('[PluginStore] Disable failed:', e)
      throw e
    }
  }

  // 获取插件配置
  async function getPluginConfig(pluginId: string): Promise<Record<string, unknown>> {
    try {
      return await window.electronAPI.plugin.getConfig(pluginId)
    } catch (e) {
      console.error('[PluginStore] Get config failed:', e)
      return {}
    }
  }

  // 设置插件配置
  async function setPluginConfig(pluginId: string, config: Record<string, unknown>): Promise<boolean> {
    try {
      await window.electronAPI.plugin.setConfig(pluginId, config)

      const plugin = plugins.value.find(p => p.id === pluginId)
      if (plugin) {
        plugin.config = { ...plugin.config, ...config }
      }

      return true
    } catch (e) {
      console.error('[PluginStore] Set config failed:', e)
      throw e
    }
  }

  // 检查插件是否已安装
  function isInstalled(pluginId: string): boolean {
    return plugins.value.some(p => p.id === pluginId)
  }

  // 检查插件是否已启用
  function isEnabled(pluginId: string): boolean {
    const plugin = plugins.value.find(p => p.id === pluginId)
    return plugin?.status === 'enabled'
  }

  // 获取插件
  function getPlugin(pluginId: string): PluginInfo | undefined {
    return plugins.value.find(p => p.id === pluginId)
  }

  // 保存缓存
  function savePluginsCache(): void {
    localStorage.setItem('runixo_plugins_cache', JSON.stringify(plugins.value))
  }

  // 注册动态菜单（由插件调用）
  function registerMenu(menu: PluginMenu): void {
    const existing = dynamicMenus.value.findIndex(m => m.id === menu.id)
    if (existing !== -1) {
      dynamicMenus.value[existing] = menu
    } else {
      dynamicMenus.value.push(menu)
    }
  }

  // 注销动态菜单
  function unregisterMenu(menuId: string): void {
    const index = dynamicMenus.value.findIndex(m => m.id === menuId)
    if (index !== -1) {
      dynamicMenus.value.splice(index, 1)
    }
  }

  // 注册动态路由
  function registerRoute(route: PluginRoute): void {
    const existing = dynamicRoutes.value.findIndex(r => r.path === route.path)
    if (existing !== -1) {
      dynamicRoutes.value[existing] = route
    } else {
      dynamicRoutes.value.push(route)
    }
  }

  // 注销动态路由
  function unregisterRoute(path: string): void {
    const index = dynamicRoutes.value.findIndex(r => r.path === path)
    if (index !== -1) {
      dynamicRoutes.value.splice(index, 1)
    }
  }

  // 设置 IPC 监听器
  function setupIPCListeners(): void {
    // 监听插件菜单注册
    window.electronAPI.plugin.onMenuRegister((data: { pluginId: string; menu: PluginMenu }) => {
      registerMenu({ ...data.menu, pluginId: data.pluginId })
    })

    // 监听插件菜单注销
    window.electronAPI.plugin.onMenuUnregister((data: { menuId: string }) => {
      unregisterMenu(data.menuId)
    })

    // 监听插件通知
    window.electronAPI.plugin.onNotification((data: { pluginId: string; title: string; body: string; type?: string }) => {
      // 使用 Element Plus 通知
      const { ElNotification } = require('element-plus')
      ElNotification({
        title: data.title,
        message: data.body,
        type: data.type || 'info'
      })
    })
  }

  // 默认市场插件数据
  function getDefaultMarketPlugins(): MarketPlugin[] {
    return [
      {
        id: 'cloudflare-security',
        name: 'Cloudflare 安全防护',
        version: '1.0.0',
        description: '集成 Cloudflare 安全功能，自动封禁恶意 IP，防 DDoS 攻击',
        author: 'Runixo',
        icon: 'cloudflare',
        iconBg: '#F38020',
        downloads: 5200,
        rating: 4.7,
        ratingCount: 128,
        tags: ['安全', 'Cloudflare', '防火墙', 'DDoS'],
        category: 'security',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/cloudflare-security',
        updatedAt: '2024-01-20',
        features: ['自动封禁恶意IP', 'WAF规则管理', 'DDoS防护', '安全仪表板']
      },
      {
        id: 'nginx-manager',
        name: 'Nginx 管理',
        version: '1.0.0',
        description: '可视化管理 Nginx 配置、虚拟主机和 SSL 证书',
        author: 'Runixo',
        icon: 'nginx',
        iconBg: '#009639',
        downloads: 6200,
        rating: 4.6,
        ratingCount: 189,
        tags: ['Web服务器', 'Nginx', '反向代理'],
        category: 'web',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/nginx-manager',
        updatedAt: '2024-01-15',
        features: ['虚拟主机管理', 'SSL证书配置', '反向代理设置', '负载均衡']
      },
      {
        id: 'mysql-manager',
        name: 'MySQL 管理',
        version: '1.0.0',
        description: '数据库管理、备份恢复、性能监控',
        author: 'Runixo',
        icon: 'mysql',
        iconBg: '#4479A1',
        downloads: 5100,
        rating: 4.5,
        ratingCount: 167,
        tags: ['数据库', 'MySQL', 'SQL'],
        category: 'database',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/mysql-manager',
        updatedAt: '2024-01-10',
        features: ['数据库管理', '用户权限', '备份恢复', '性能监控']
      },
      {
        id: 'redis-manager',
        name: 'Redis 管理',
        version: '1.0.0',
        description: 'Redis 数据库可视化管理，支持键值浏览、监控',
        author: 'Runixo',
        icon: 'redis',
        iconBg: '#DC382D',
        downloads: 4300,
        rating: 4.4,
        ratingCount: 134,
        tags: ['数据库', 'Redis', '缓存'],
        category: 'database',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/redis-manager',
        updatedAt: '2024-01-08',
        features: ['键值浏览', '数据编辑', '性能监控', '内存分析']
      },
      {
        id: 'backup-manager',
        name: '自动备份',
        version: '1.0.0',
        description: '定时备份文件和数据库到本地或云存储',
        author: 'Runixo',
        icon: 'backup',
        iconBg: '#1989FA',
        downloads: 4200,
        rating: 4.3,
        ratingCount: 98,
        category: 'tools',
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/backup-manager',
        updatedAt: '2024-01-05',
        features: ['定时备份', '增量备份', '云存储支持', '备份恢复']
      },
      {
        id: 'advanced-monitor',
        name: '高级监控',
        version: '1.0.0',
        description: '详细的性能监控、告警通知、历史数据',
        author: 'Runixo',
        icon: 'monitor',
        iconBg: '#6366f1',
        downloads: 5600,
        rating: 4.6,
        ratingCount: 145,
        tags: ['监控', '告警', '性能'],
        official: true,
        downloadUrl: 'https://plugins.runixo.dev/advanced-monitor',
        updatedAt: '2024-01-03',
        features: ['实时监控', '历史数据', '告警规则', '邮件通知']
      },
      {
        id: 'minecraft-server',
        name: 'Minecraft 服务器',
        version: '0.9.0',
        description: '管理 Minecraft 服务器、玩家、插件',
        author: 'Community',
        icon: 'minecraft',
        iconBg: '#3E8B3E',
        downloads: 3800,
        rating: 4.7,
        ratingCount: 312,
        tags: ['游戏', 'Minecraft', '服务器'],
        category: 'game',
        downloadUrl: 'https://plugins.runixo.dev/minecraft-server',
        updatedAt: '2024-01-18',
        features: ['服务器控制', '玩家管理', '插件管理', '世界备份']
      },
      {
        id: 'firewall-manager',
        name: '防火墙管理',
        version: '1.0.0',
        description: '可视化管理 iptables/firewalld 规则',
        author: 'Runixo',
        icon: 'firewall',
        iconBg: '#1989FA',
        downloads: 3200,
        rating: 4.2,
        ratingCount: 87,
        tags: ['安全', '防火墙', '网络'],
        category: 'security',
        official: true,
        updatedAt: '2024-01-02',
        features: ['规则管理', '端口控制', 'IP黑白名单', '日志分析']
      }
    ]
  }

  return {
    // 状态
    plugins,
    marketPlugins,
    dynamicMenus,
    dynamicRoutes,
    loading,
    marketLoading,
    error,

    // 计算属性
    installedPlugins,
    enabledPlugins,
    disabledPlugins,
    sidebarMenus,
    pluginTools,

    // 方法
    initialize,
    loadInstalledPlugins,
    loadMarketPlugins,
    installPlugin,
    uninstallPlugin,
    enablePlugin,
    disablePlugin,
    getPluginConfig,
    setPluginConfig,
    isInstalled,
    isEnabled,
    getPlugin,
    registerMenu,
    unregisterMenu,
    registerRoute,
    unregisterRoute,
    setupIPCListeners
  }
})
