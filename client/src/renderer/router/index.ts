import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw, Router } from 'vue-router'

// 静态路由
const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: '仪表盘', icon: 'Monitor' }
  },
  {
    path: '/websites',
    name: 'Websites',
    component: () => import('../views/Websites.vue'),
    meta: { title: '网站管理', icon: 'Globe' }
  },
  {
    path: '/docker',
    name: 'Docker',
    component: () => import('../views/Docker.vue'),
    meta: { title: 'Docker 管理', icon: 'Box' }
  },
  {
    path: '/files/:serverId?',
    name: 'Files',
    component: () => import('../views/Files.vue'),
    meta: { title: '文件管理', icon: 'Folder' }
  },
  {
    path: '/terminal/:serverId?',
    name: 'Terminal',
    component: () => import('../views/Terminal.vue'),
    meta: { title: '终端', icon: 'Monitor' }
  },
  {
    path: '/services',
    name: 'Services',
    component: () => import('../views/Services.vue'),
    meta: { title: '服务管理', icon: 'Setting' }
  },
  {
    path: '/processes',
    name: 'Processes',
    component: () => import('../views/Processes.vue'),
    meta: { title: '进程管理', icon: 'Cpu' }
  },
  {
    path: '/environment',
    name: 'Environment',
    component: () => import('../views/Environment.vue'),
    meta: { title: '环境管理', icon: 'Box' }
  },
  {
    path: '/monitor',
    name: 'Monitor',
    component: () => import('../views/Monitor.vue'),
    meta: { title: '监控中心', icon: 'DataLine' }
  },
  {
    path: '/servers',
    name: 'Servers',
    component: () => import('../views/Servers.vue'),
    meta: { title: '服务器管理', icon: 'Server' }
  },
  {
    path: '/server/:id',
    name: 'ServerDetail',
    component: () => import('../views/ServerDetail.vue'),
    meta: { title: '服务器详情', hidden: true }
  },
  // 保留旧路由兼容
  {
    path: '/containers',
    redirect: '/docker'
  },
  {
    path: '/compose',
    redirect: '/docker'
  },
  {
    path: '/database',
    name: 'Database',
    component: () => import('../views/Database.vue'),
    meta: { title: '数据库', icon: 'Coin' }
  },
  {
    path: '/logs',
    name: 'LogAnalysis',
    component: () => import('../views/LogAnalysis.vue'),
    meta: { title: '日志分析', icon: 'Document' }
  },
  {
    path: '/ai',
    name: 'AIAssistant',
    component: () => import('../views/AIAssistant.vue'),
    meta: { title: 'AI 助手', icon: 'ChatDotRound' }
  },
  {
    path: '/cloud',
    name: 'Cloud',
    component: () => import('../views/Cloud.vue'),
    meta: { title: '云服务', icon: 'Cloudy' }
  },
  {
    path: '/cloud/cloudflare',
    name: 'Cloudflare',
    component: () => import('../views/Cloudflare.vue'),
    meta: { title: 'Cloudflare', hidden: true }
  },
  {
    path: '/cloud/aws',
    name: 'AWS',
    component: () => import('../views/AWS.vue'),
    meta: { title: 'AWS', hidden: true }
  },
  {
    path: '/cloud/aliyun',
    name: 'Aliyun',
    component: () => import('../views/Aliyun.vue'),
    meta: { title: '阿里云', hidden: true }
  },
  {
    path: '/cloud/tencent',
    name: 'TencentCloud',
    component: () => import('../views/TencentCloud.vue'),
    meta: { title: '腾讯云', hidden: true }
  },
  {
    path: '/cloud/digitalocean',
    name: 'DigitalOcean',
    component: () => import('../views/DigitalOcean.vue'),
    meta: { title: 'DigitalOcean', hidden: true }
  },
  {
    path: '/storage',
    name: 'ObjectStorage',
    component: () => import('../views/ObjectStorage.vue'),
    meta: { title: '对象存储', icon: 'Box' }
  },
  {
    path: '/ssl',
    name: 'SSL',
    component: () => import('../views/SSL.vue'),
    meta: { title: 'SSL 证书', icon: 'Lock' }
  },
  {
    path: '/ssh-keys',
    name: 'SSHKeys',
    component: () => import('../views/SSHKeys.vue'),
    meta: { title: 'SSH 密钥', icon: 'Key' }
  },
  {
    path: '/alerts',
    name: 'Alerts',
    component: () => import('../views/Alerts.vue'),
    meta: { title: '告警系统', icon: 'Bell' }
  },
  {
    path: '/network',
    name: 'NetworkTools',
    component: () => import('../views/NetworkTools.vue'),
    meta: { title: '网络工具', icon: 'Connection' }
  },
  {
    path: '/backup',
    name: 'Backup',
    component: () => import('../views/Backup/BackupList.vue'),
    meta: { title: '备份管理', icon: 'FolderOpened' }
  },
  {
    path: '/cron-jobs',
    name: 'CronJobs',
    component: () => import('../views/CronJobs/TaskList.vue'),
    meta: { title: '计划任务', icon: 'Clock' }
  },
  {
    path: '/app-store',
    name: 'AppStore',
    component: () => import('../views/AppStore.vue'),
    meta: { title: '应用商店', icon: 'Shop' }
  },
  {
    path: '/plugins',
    name: 'Plugins',
    component: () => import('../views/Plugins.vue'),
    meta: { title: '插件市场', icon: 'Grid' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { title: '设置', icon: 'Setting' }
  },
  // 插件通用路由（用于加载插件页面）
  {
    path: '/plugin/:pluginId/:page?',
    name: 'PluginPage',
    component: () => import('../views/PluginPage.vue'),
    meta: { title: '插件页面', hidden: true }
  }
]

// 已注册的动态路由名称
const registeredDynamicRoutes: Set<string> = new Set()

const router = createRouter({
  history: createWebHashHistory(),
  routes: staticRoutes
})

/**
 * 动态路由管理器
 */
export const dynamicRouteManager = {
  /**
   * 注册动态路由
   */
  addRoute(route: {
    path: string
    name: string
    component?: () => Promise<unknown>
    componentPath?: string
    pluginId?: string
    meta?: Record<string, unknown>
  }): boolean {
    // 检查路由是否已存在
    if (router.hasRoute(route.name)) {
      console.warn(`[Router] Route ${route.name} already exists`)
      return false
    }

    const routeConfig: RouteRecordRaw = {
      path: route.path,
      name: route.name,
      meta: {
        ...route.meta,
        pluginId: route.pluginId,
        dynamic: true
      },
      component: route.component || (() => import('../views/PluginPage.vue'))
    }

    router.addRoute(routeConfig)
    registeredDynamicRoutes.add(route.name)
    console.log(`[Router] Added dynamic route: ${route.path}`)
    return true
  },

  /**
   * 移除动态路由
   */
  removeRoute(name: string): boolean {
    if (!registeredDynamicRoutes.has(name)) {
      console.warn(`[Router] Route ${name} is not a dynamic route`)
      return false
    }

    if (router.hasRoute(name)) {
      router.removeRoute(name)
      registeredDynamicRoutes.delete(name)
      console.log(`[Router] Removed dynamic route: ${name}`)
      return true
    }

    return false
  },

  /**
   * 移除插件的所有路由
   */
  removePluginRoutes(pluginId: string): void {
    const routesToRemove: string[] = []

    for (const route of router.getRoutes()) {
      if (route.meta?.pluginId === pluginId && route.name) {
        routesToRemove.push(route.name as string)
      }
    }

    for (const name of routesToRemove) {
      this.removeRoute(name)
    }
  },

  /**
   * 获取所有动态路由
   */
  getDynamicRoutes(): RouteRecordRaw[] {
    return router.getRoutes().filter(r => r.meta?.dynamic)
  },

  /**
   * 检查路由是否存在
   */
  hasRoute(name: string): boolean {
    return router.hasRoute(name)
  },

  /**
   * 批量注册路由
   */
  addRoutes(routes: Array<{
    path: string
    name: string
    component?: () => Promise<unknown>
    pluginId?: string
    meta?: Record<string, unknown>
  }>): void {
    for (const route of routes) {
      this.addRoute(route)
    }
  }
}

/**
 * 初始化插件路由
 * 从插件系统加载动态路由
 */
export async function initPluginRoutes(): Promise<void> {
  try {
    // 检查 electronAPI 是否可用
    if (typeof window !== 'undefined' && window.electronAPI?.plugin?.getRoutes) {
      const pluginRoutes = await window.electronAPI.plugin.getRoutes()

      for (const route of pluginRoutes) {
        dynamicRouteManager.addRoute({
          path: route.path,
          name: route.name,
          pluginId: route.pluginId,
          meta: route.meta
        })
      }

      console.log(`[Router] Loaded ${pluginRoutes.length} plugin routes`)
    }
  } catch (error) {
    console.error('[Router] Failed to load plugin routes:', error)
  }
}

export default router
