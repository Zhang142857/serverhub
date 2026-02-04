<template>
  <header class="header">
    <div class="header-left">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item v-if="currentRoute.meta?.title">
          {{ currentRoute.meta.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="header-center">
      <el-input
        v-model="searchQuery"
        placeholder="搜索服务器、容器、文件..."
        prefix-icon="Search"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
      />
    </div>

    <div class="header-right">
      <!-- 当前服务器选择 -->
      <el-select
        v-if="connectedServers.length > 0"
        v-model="selectedServerId"
        placeholder="选择服务器"
        class="server-select"
        @change="handleServerChange"
      >
        <el-option
          v-for="server in connectedServers"
          :key="server.id"
          :label="server.name"
          :value="server.id"
        >
          <div class="server-option">
            <span class="status-dot connected"></span>
            <span>{{ server.name }}</span>
          </div>
        </el-option>
      </el-select>

      <!-- AI 助手按钮 -->
      <el-tooltip content="AI 助手 (Ctrl+K)" placement="bottom">
        <el-button
          circle
          class="ai-button"
          @click="toggleAI"
        >
          <el-icon><ChatDotRound /></el-icon>
        </el-button>
      </el-tooltip>

      <!-- 通知 -->
      <el-badge :value="notifications" :hidden="notifications === 0" class="notification-badge">
        <el-button circle>
          <el-icon><Bell /></el-icon>
        </el-button>
      </el-badge>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { ChatDotRound, Bell } from '@element-plus/icons-vue'

const route = useRoute()
const serverStore = useServerStore()

const searchQuery = ref('')
const notifications = ref(0)

const currentRoute = computed(() => route)
const connectedServers = computed(() => serverStore.connectedServers)
const selectedServerId = computed({
  get: () => serverStore.currentServerId,
  set: (val) => serverStore.setCurrentServer(val)
})

// 监听已连接服务器变化，自动选择
watch(connectedServers, (servers) => {
  if (servers.length > 0 && !serverStore.currentServerId) {
    serverStore.autoSelectServer()
  }
}, { immediate: true })

const emit = defineEmits(['toggle-ai'])

function handleSearch() {
  // 实现全局搜索
  console.log('Search:', searchQuery.value)
}

function handleServerChange(serverId: string) {
  serverStore.setCurrentServer(serverId)
}

function toggleAI() {
  emit('toggle-ai')
}

// 快捷键
function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    toggleAI()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style lang="scss" scoped>
.header {
  height: var(--header-height);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  flex: 0 0 auto;
}

.header-center {
  flex: 1;
  max-width: 480px;
  margin: 0 24px;

  .search-input {
    :deep(.el-input__wrapper) {
      background-color: var(--bg-tertiary);
      border-radius: 8px;
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;

  .server-select {
    width: 160px;

    :deep(.el-input__wrapper) {
      background-color: var(--bg-tertiary);
    }
  }

  .server-option {
    display: flex;
    align-items: center;
    gap: 8px;

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.connected {
        background-color: var(--success-color);
      }
    }
  }

  .ai-button {
    background: linear-gradient(135deg, var(--primary-color), #8b5cf6);
    border: none;
    color: white;

    &:hover {
      opacity: 0.9;
    }
  }

  .notification-badge {
    :deep(.el-badge__content) {
      background-color: var(--danger-color);
    }
  }
}
</style>
