<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 512 512" width="28" height="28">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#6366f1" />
                <stop offset="100%" style="stop-color:#8b5cf6" />
              </linearGradient>
            </defs>
            <circle cx="256" cy="256" r="240" fill="url(#logoGrad)"/>
            <g fill="#ffffff">
              <rect x="120" y="120" width="272" height="60" rx="6"/>
              <rect x="120" y="200" width="272" height="60" rx="6"/>
              <rect x="120" y="280" width="272" height="60" rx="6"/>
              <circle cx="160" cy="150" r="10" fill="#f87171"/>
              <circle cx="190" cy="150" r="10" fill="#10b981"/>
              <circle cx="160" cy="230" r="10" fill="#f87171"/>
              <circle cx="190" cy="230" r="10" fill="#10b981"/>
              <circle cx="160" cy="310" r="10" fill="#f87171"/>
              <circle cx="190" cy="310" r="10" fill="#10b981"/>
            </g>
          </svg>
        </div>
        <span class="logo-text">Runixo</span>
      </div>
    </div>

    <div class="sidebar-content">
      <el-menu :default-active="currentRoute" :default-openeds="openedMenus" router unique-opened>
        <!-- 仪表盘 -->
        <el-menu-item index="/">
          <el-icon><Odometer /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>

        <!-- 应用服务 -->
        <el-sub-menu index="group-app">
          <template #title>
            <el-icon><Promotion /></el-icon>
            <span>应用服务</span>
          </template>
          <el-menu-item index="/websites">
            <el-icon><Link /></el-icon>
            <span>网站管理</span>
          </el-menu-item>
          <el-menu-item index="/ssl">
            <el-icon><Lock /></el-icon>
            <span>SSL 证书</span>
          </el-menu-item>
          <el-menu-item index="/docker">
            <el-icon><Box /></el-icon>
            <span>Docker</span>
          </el-menu-item>
          <el-menu-item index="/database">
            <el-icon><Coin /></el-icon>
            <span>数据库</span>
          </el-menu-item>
        </el-sub-menu>

        <!-- 环境与软件 -->
        <el-sub-menu index="group-env">
          <template #title>
            <el-icon><Box /></el-icon>
            <span>环境与软件</span>
          </template>
          <el-menu-item index="/environment">
            <el-icon><Tools /></el-icon>
            <span>环境包</span>
          </el-menu-item>
          <el-menu-item index="/software-store">
            <el-icon><Shop /></el-icon>
            <span>软件商城</span>
          </el-menu-item>
        </el-sub-menu>

        <!-- 系统运维 -->
        <el-sub-menu index="group-sys">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统运维</span>
          </template>
          <el-menu-item index="/files">
            <el-icon><Folder /></el-icon>
            <span>文件管理</span>
          </el-menu-item>
          <el-menu-item index="/terminal">
            <el-icon><Monitor /></el-icon>
            <span>终端</span>
          </el-menu-item>
          <el-menu-item index="/services">
            <el-icon><Operation /></el-icon>
            <span>服务管理</span>
          </el-menu-item>
          <el-menu-item index="/processes">
            <el-icon><Cpu /></el-icon>
            <span>进程管理</span>
          </el-menu-item>
          <el-menu-item index="/monitor">
            <el-icon><DataLine /></el-icon>
            <span>监控中心</span>
          </el-menu-item>
          <el-menu-item index="/logs">
            <el-icon><Document /></el-icon>
            <span>日志分析</span>
          </el-menu-item>
          <el-menu-item index="/alerts">
            <el-icon><Bell /></el-icon>
            <span>告警系统</span>
          </el-menu-item>
          <el-menu-item index="/firewall">
            <el-icon><Warning /></el-icon>
            <span>防火墙</span>
          </el-menu-item>
          <el-menu-item index="/network">
            <el-icon><Connection /></el-icon>
            <span>网络工具</span>
          </el-menu-item>
        </el-sub-menu>

        <!-- 数据管理 -->
        <el-sub-menu index="group-data">
          <template #title>
            <el-icon><FolderOpened /></el-icon>
            <span>数据管理</span>
          </template>
          <el-menu-item index="/backup">
            <el-icon><Upload /></el-icon>
            <span>备份管理</span>
          </el-menu-item>
          <el-menu-item index="/cron-jobs">
            <el-icon><Clock /></el-icon>
            <span>计划任务</span>
          </el-menu-item>
        </el-sub-menu>

        <!-- 多服务器模式 -->
        <el-menu-item v-if="hasMultipleServers" index="/servers">
          <el-icon><DataBoard /></el-icon>
          <span>服务器管理</span>
        </el-menu-item>

        <!-- AI -->
        <el-sub-menu index="group-ai">
          <template #title>
            <el-icon><ChatDotRound /></el-icon>
            <span>AI</span>
          </template>
          <el-menu-item index="/ai">
            <el-icon><ChatDotRound /></el-icon>
            <span>AI 助手</span>
          </el-menu-item>
          <el-menu-item index="/ai-deploy">
            <el-icon><Upload /></el-icon>
            <span>AI 部署</span>
          </el-menu-item>
          <el-menu-item index="/ai-ops">
            <el-icon><Setting /></el-icon>
            <span>AI 运维</span>
          </el-menu-item>
        </el-sub-menu>

        <!-- 扩展 -->
        <el-sub-menu index="group-ext">
          <template #title>
            <el-icon><Grid /></el-icon>
            <span>扩展</span>
          </template>
          <el-menu-item index="/plugins">
            <el-icon><Goods /></el-icon>
            <span>插件市场</span>
          </el-menu-item>
          <!-- 已安装插件动态菜单 -->
          <el-menu-item
            v-for="menu in pluginMenus"
            :key="menu.id"
            :index="menu.route || `/plugin/${menu.pluginId}`"
          >
            <el-icon><component :is="getMenuIcon(menu.icon)" /></el-icon>
            <span>{{ menu.label }}</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </div>

    <div class="sidebar-footer">
      <el-menu router>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { usePluginStore } from '@/stores/plugin'
import {
  Monitor, Odometer, Box, Folder, Setting, Cloudy, Grid, Cpu, ChatDotRound, Link, Coin,
  DataBoard, DataLine, Lock, Connection, Document, Bell, Clock, FolderOpened, Shop, Tools,
  Promotion, Upload, Operation, Goods, Warning
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const serverStore = useServerStore()
const pluginStore = usePluginStore()

const openedMenus = ref(['group-app', 'group-env'])

const currentRoute = computed(() => route.path)
const hasMultipleServers = computed(() => serverStore.hasMultipleServers)
const pluginMenus = computed(() => pluginStore.sidebarMenus)

const iconComponents: Record<string, unknown> = {
  Monitor, Odometer, Box, Folder, Setting, Cloudy, Grid, Cpu, ChatDotRound, Link, Coin,
  DataBoard, DataLine, Lock, Connection, Document, Bell, Clock, FolderOpened, Shop, Tools,
  Promotion, Upload, Operation, Goods, Warning
}

function getMenuIcon(iconName?: string) {
  return iconName ? (iconComponents[iconName] || Grid) : Grid
}

onMounted(() => { pluginStore.initialize() })
</script>

<style lang="scss" scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  height: var(--header-height);
  padding: 0 var(--space-4);
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);

  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    svg { filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3)); }
  }

  .logo-text {
    font-size: var(--text-lg);
    font-weight: 700;
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.5px;
  }
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) 0;

  :deep(.el-sub-menu__title) {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-secondary);
  }

  :deep(.el-sub-menu .el-menu-item) {
    padding-left: 44px !important;
    min-width: unset;
  }

  :deep(.el-sub-menu__icon-arrow) {
    font-size: 12px;
  }
}

.sidebar-footer {
  border-top: 1px solid var(--border-color);
  padding: var(--space-2) 0;
}

.plugin-tag {
  margin-left: auto;
  font-size: 10px;
  padding: 0 var(--space-1);
  height: 16px;
  line-height: 16px;
}
</style>
