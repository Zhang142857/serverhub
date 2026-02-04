<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 512 512" width="32" height="32">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea" />
                <stop offset="100%" style="stop-color:#764ba2" />
              </linearGradient>
            </defs>
            <circle cx="256" cy="256" r="240" fill="url(#logoGrad)"/>
            <g fill="#ffffff">
              <rect x="120" y="120" width="272" height="60" rx="6"/>
              <rect x="120" y="200" width="272" height="60" rx="6"/>
              <rect x="120" y="280" width="272" height="60" rx="6"/>
              <circle cx="160" cy="150" r="10" fill="#f5576c"/>
              <circle cx="190" cy="150" r="10" fill="#4ade80"/>
              <circle cx="160" cy="230" r="10" fill="#f5576c"/>
              <circle cx="190" cy="230" r="10" fill="#4ade80"/>
              <circle cx="160" cy="310" r="10" fill="#f5576c"/>
              <circle cx="190" cy="310" r="10" fill="#4ade80"/>
            </g>
            <g fill="#fbbf24">
              <path d="M380 360 L390 380 L380 400 L370 380 Z"/>
              <path d="M400 340 L408 355 L400 370 L392 355 Z" opacity="0.7"/>
            </g>
          </svg>
        </div>
        <span class="logo-text">ServerHub</span>
      </div>
    </div>

    <div class="sidebar-content">
      <el-menu
        :default-active="currentRoute"
        router
      >
        <el-menu-item index="/">
          <el-icon><Odometer /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/servers">
          <el-icon><Monitor /></el-icon>
          <span>服务器管理</span>
        </el-menu-item>
        <el-menu-item index="/containers">
          <el-icon><Box /></el-icon>
          <span>容器管理</span>
        </el-menu-item>
        <el-menu-item index="/files">
          <el-icon><Folder /></el-icon>
          <span>文件管理</span>
        </el-menu-item>
        <el-menu-item index="/terminal">
          <el-icon><Monitor /></el-icon>
          <span>终端</span>
        </el-menu-item>
        <el-menu-item index="/services">
          <el-icon><Setting /></el-icon>
          <span>服务管理</span>
        </el-menu-item>
        <el-menu-item index="/processes">
          <el-icon><Cpu /></el-icon>
          <span>进程管理</span>
        </el-menu-item>
        <el-menu-item index="/compose">
          <el-icon><Files /></el-icon>
          <span>Compose</span>
        </el-menu-item>
        <el-menu-item index="/websites">
          <el-icon><Monitor /></el-icon>
          <span>网站管理</span>
        </el-menu-item>
        <el-menu-item index="/environment">
          <el-icon><Box /></el-icon>
          <span>环境管理</span>
        </el-menu-item>

        <el-divider />

        <el-menu-item index="/ai">
          <el-icon><ChatDotRound /></el-icon>
          <span>AI 助手</span>
        </el-menu-item>

        <el-menu-item index="/cloud">
          <el-icon><Cloudy /></el-icon>
          <span>云服务</span>
        </el-menu-item>
        <el-menu-item index="/plugins">
          <el-icon><Grid /></el-icon>
          <span>插件市场</span>
        </el-menu-item>
      </el-menu>

      <!-- 已连接服务器列表 -->
      <div class="connected-servers" v-if="connectedServers.length > 0">
        <div class="section-title">已连接服务器</div>
        <div
          v-for="server in connectedServers"
          :key="server.id"
          class="server-item"
          :class="{ active: currentServerId === server.id }"
          @click="selectServer(server.id)"
        >
          <div class="server-status connected"></div>
          <span class="server-name">{{ server.name }}</span>
        </div>
      </div>
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
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import {
  Monitor,
  Odometer,
  Box,
  Folder,
  Setting,
  Cloudy,
  Grid,
  Cpu,
  Files,
  ChatDotRound
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const serverStore = useServerStore()

const currentRoute = computed(() => route.path)
const connectedServers = computed(() => serverStore.connectedServers)
const currentServerId = computed(() => serverStore.currentServerId)

function selectServer(id: string) {
  serverStore.setCurrentServer(id)
  router.push(`/server/${id}`)
}
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
  padding: 0 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;

  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3));
    }
  }

  .logo-text {
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.5px;
  }
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.el-divider {
  margin: 12px 16px;
  border-color: var(--border-color);
}

.connected-servers {
  padding: 12px 16px;

  .section-title {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .server-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--bg-tertiary);
    }

    &.active {
      background-color: var(--bg-tertiary);
      color: var(--primary-color);
    }

    .server-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.connected {
        background-color: var(--success-color);
      }
    }

    .server-name {
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.sidebar-footer {
  border-top: 1px solid var(--border-color);
  padding: 8px 0;
}
</style>
