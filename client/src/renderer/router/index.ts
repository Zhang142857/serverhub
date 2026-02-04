import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: '仪表盘', icon: 'Monitor' }
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
  {
    path: '/containers',
    name: 'Containers',
    component: () => import('../views/Containers.vue'),
    meta: { title: '容器管理', icon: 'Box' }
  },
  {
    path: '/compose',
    name: 'Compose',
    component: () => import('../views/Compose.vue'),
    meta: { title: 'Compose 项目', icon: 'Files' }
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
    path: '/cron',
    name: 'CronJobs',
    component: () => import('../views/CronJobs.vue'),
    meta: { title: '定时任务', icon: 'Timer' }
  },
  {
    path: '/firewall',
    name: 'Firewall',
    component: () => import('../views/Firewall.vue'),
    meta: { title: '防火墙', icon: 'Shield' }
  },
  {
    path: '/nginx',
    name: 'Nginx',
    component: () => import('../views/Nginx.vue'),
    meta: { title: 'Nginx', icon: 'Connection' }
  },
  {
    path: '/websites',
    name: 'Websites',
    component: () => import('../views/Websites.vue'),
    meta: { title: '网站管理', icon: 'Globe' }
  },
  {
    path: '/environment',
    name: 'Environment',
    component: () => import('../views/Environment.vue'),
    meta: { title: '环境管理', icon: 'Box' }
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
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
