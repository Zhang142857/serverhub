<template>
  <div class="server-detail">
    <div class="page-header">
      <div class="server-title">
        <el-button text @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <h1>{{ server?.name || '服务器详情' }}</h1>
        <el-tag :type="server?.status === 'connected' ? 'success' : 'info'">
          {{ server?.status === 'connected' ? '已连接' : '未连接' }}
        </el-tag>
        <span class="uptime-badge" v-if="systemInfo.uptime">运行 {{ formatUptime(systemInfo.uptime) }}</span>
      </div>
      <div class="header-actions">
        <el-button @click="refreshData" :loading="refreshing"><el-icon><Refresh /></el-icon>刷新</el-button>
        <el-button @click="openTerminal">终端</el-button>
        <el-button @click="openFiles">文件管理</el-button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <template v-else>
      <div class="info-grid">
        <!-- 系统信息卡片 -->
        <el-card class="info-card">
          <template #header>系统信息</template>
          <div class="info-list">
            <div class="info-item">
              <span class="label">主机名</span>
              <span class="value">{{ systemInfo.hostname }}</span>
            </div>
            <div class="info-item">
              <span class="label">操作系统</span>
              <span class="value">{{ systemInfo.platform }} {{ systemInfo.arch }}</span>
            </div>
            <div class="info-item">
              <span class="label">内核版本</span>
              <span class="value">{{ systemInfo.kernel_version || systemInfo.kernelVersion }}</span>
            </div>
            <div class="info-item">
              <span class="label">运行时间</span>
              <span class="value">{{ formatUptime(systemInfo.uptime) }}</span>
            </div>
          </div>
        </el-card>

        <!-- CPU 卡片 -->
        <el-card class="info-card">
          <template #header>CPU</template>
          <div class="metric-display">
            <div class="metric-chart">
              <el-progress
                type="dashboard"
                :percentage="Math.round(metrics.cpu)"
                :color="getProgressColor(metrics.cpu)"
                :stroke-width="10"
              />
            </div>
            <div class="metric-info">
              <div class="info-item">
                <span class="label">型号</span>
                <span class="value">{{ systemInfo.cpu?.model || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">核心数</span>
                <span class="value">{{ systemInfo.cpu?.cores || '-' }} 核</span>
              </div>
              <div class="info-item">
                <span class="label">负载</span>
                <span class="value">{{ metrics.load1?.toFixed(2) || '-' }}</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 内存卡片 -->
        <el-card class="info-card">
          <template #header>内存</template>
          <div class="metric-display">
            <div class="metric-chart">
              <el-progress
                type="dashboard"
                :percentage="Math.round(metrics.memory)"
                :color="getProgressColor(metrics.memory)"
                :stroke-width="10"
              />
            </div>
            <div class="metric-info">
              <div class="info-item">
                <span class="label">总量</span>
                <span class="value">{{ formatBytes(systemInfo.memory?.total) }}</span>
              </div>
              <div class="info-item">
                <span class="label">已用</span>
                <span class="value">{{ formatBytes(systemInfo.memory?.used) }}</span>
              </div>
              <div class="info-item">
                <span class="label">可用</span>
                <span class="value">{{ formatBytes(systemInfo.memory?.available) }}</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 网络卡片 -->
        <el-card class="info-card">
          <template #header>网络流量</template>
          <div class="network-stats">
            <div class="network-item">
              <div class="network-label">
                <span class="arrow up">↑</span>
                <span>上传</span>
              </div>
              <div class="network-value">{{ formatBytesRate(metrics.networkOut) }}/s</div>
            </div>
            <div class="network-item">
              <div class="network-label">
                <span class="arrow down">↓</span>
                <span>下载</span>
              </div>
              <div class="network-value">{{ formatBytesRate(metrics.networkIn) }}/s</div>
            </div>
          </div>
        </el-card>

        <!-- 磁盘卡片 -->
        <el-card class="info-card disk-card">
          <template #header>磁盘</template>
          <div class="disk-list" v-if="systemInfo.disks?.length">
            <div v-for="disk in systemInfo.disks" :key="disk.mountpoint" class="disk-item">
              <div class="disk-header">
                <span class="disk-mount">{{ disk.mountpoint }}</span>
                <span class="disk-usage">{{ (disk.used_percent || disk.usedPercent || 0).toFixed(1) }}%</span>
              </div>
              <el-progress
                :percentage="disk.used_percent || disk.usedPercent || 0"
                :stroke-width="8"
                :show-text="false"
                :color="getProgressColor(disk.used_percent || disk.usedPercent || 0)"
              />
              <div class="disk-size">
                {{ formatBytes(disk.used) }} / {{ formatBytes(disk.total) }}
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无磁盘信息" :image-size="60" />
        </el-card>
      </div>

      <!-- 快捷操作 -->
      <el-card class="quick-actions">
        <template #header>快捷操作</template>
        <div class="action-grid">
          <el-button @click="executeQuickCommand('uptime')">查看运行时间</el-button>
          <el-button @click="executeQuickCommand('df -h')">磁盘使用</el-button>
          <el-button @click="executeQuickCommand('free -h')">内存使用</el-button>
          <el-button @click="executeQuickCommand('top -bn1 | head -20')">进程列表</el-button>
          <el-button @click="executeQuickCommand('docker ps')">Docker 容器</el-button>
          <el-button @click="executeQuickCommand('systemctl list-units --failed')">失败服务</el-button>
        </div>
      </el-card>

      <!-- 命令输出 -->
      <el-card v-if="commandOutput" class="command-output">
        <template #header>
          <div class="output-header">
            <span>命令输出</span>
            <el-button text size="small" @click="commandOutput = ''">清除</el-button>
          </div>
        </template>
        <pre class="output-content">{{ commandOutput }}</pre>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Refresh, Loading } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const serverStore = useServerStore()

const serverId = route.params.id as string
const server = computed(() => serverStore.servers.find(s => s.id === serverId))

const loading = ref(true)
const refreshing = ref(false)
const commandOutput = ref('')
const systemInfo = ref<any>({})
const metrics = ref({
  cpu: 0,
  memory: 0,
  disk: 0,
  networkIn: 0,
  networkOut: 0,
  load1: 0,
  load5: 0,
  load15: 0
})

let cleanupMetrics: (() => void) | null = null

onMounted(async () => {
  await loadData()
})

onUnmounted(() => {
  if (cleanupMetrics) {
    cleanupMetrics()
  }
})

async function loadData() {
  loading.value = true
  try {
    // 获取系统信息
    const info = await window.electronAPI.server.getSystemInfo(serverId)
    if (info) {
      systemInfo.value = info
      // 初始化 metrics
      metrics.value.cpu = info.cpu?.usage ?? info.cpu?.usedPercent ?? 0
      metrics.value.memory = info.memory?.used_percent ?? info.memory?.usedPercent ?? 0
      if (info.disks?.length) {
        metrics.value.disk = info.disks.reduce((s: number, d: any) => s + (d.used_percent || d.usedPercent || 0), 0) / info.disks.length
      }
    }

    // 启动实时指标流
    await startMetricsStream()
  } catch (e) {
    console.error('Load data error:', e)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

async function startMetricsStream() {
  try {
    await window.electronAPI.server.startMetrics(serverId, 2)
    cleanupMetrics = window.electronAPI.server.onMetrics(serverId, (m: any) => {
      metrics.value.cpu = m.cpu_usage ?? 0
      metrics.value.memory = m.memory_usage ?? 0
      metrics.value.load1 = m.load_1 ?? 0
      metrics.value.load5 = m.load_5 ?? 0
      metrics.value.load15 = m.load_15 ?? 0
      
      // 计算网络流量（从 network_metrics 数组）
      let netIn = 0, netOut = 0
      if (m.network_metrics?.length) {
        m.network_metrics.forEach((n: any) => {
          netIn += n.bytes_recv || 0
          netOut += n.bytes_sent || 0
        })
      }
      metrics.value.networkIn = netIn
      metrics.value.networkOut = netOut
    })
  } catch (e) {
    console.error('Start metrics error:', e)
  }
}

async function refreshData() {
  refreshing.value = true
  try {
    // 重新获取系统信息
    const info = await window.electronAPI.server.getSystemInfo(serverId)
    if (info) {
      systemInfo.value = info
    }
    ElMessage.success('数据已刷新')
  } catch (e) {
    ElMessage.error('刷新失败')
  } finally {
    refreshing.value = false
  }
}

function openTerminal() {
  serverStore.setCurrentServer(serverId)
  router.push('/terminal')
}

function openFiles() {
  serverStore.setCurrentServer(serverId)
  router.push('/files')
}

async function executeQuickCommand(command: string) {
  try {
    commandOutput.value = `$ ${command}\n执行中...`
    const result = await window.electronAPI.server.executeCommand(serverId, command, [], { timeout: 30 })
    if (result.stdout) {
      commandOutput.value = `$ ${command}\n${result.stdout}`
    } else if (result.stderr) {
      commandOutput.value = `$ ${command}\n${result.stderr}`
    } else {
      commandOutput.value = `$ ${command}\n命令执行完成 (exit code: ${result.exit_code})`
    }
  } catch (e) {
    commandOutput.value = `$ ${command}\n执行失败: ${(e as Error).message}`
  }
}

function formatUptime(seconds: number): string {
  if (!seconds) return '-'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}天${hours}小时`
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}小时${minutes}分钟`
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatBytesRate(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return bytes.toFixed(0) + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

function getProgressColor(percentage: number): string {
  if (percentage < 60) return '#22c55e'
  if (percentage < 80) return '#f59e0b'
  return '#ef4444'
}
</script>

<style lang="scss" scoped>
.server-detail {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  .server-title {
    display: flex;
    align-items: center;
    gap: 12px;

    h1 { font-size: 24px; font-weight: 600; }
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 300px;
  color: var(--text-secondary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.info-card {
  .info-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;

    .label { color: var(--text-secondary); }
    .value { font-family: monospace; font-size: 13px; }
  }
}

.metric-display {
  display: flex;
  gap: 24px;

  .metric-chart { flex-shrink: 0; }

  .metric-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
  }
}

.disk-card {
  grid-column: span 2;

  .disk-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
  }

  .disk-item {
    .disk-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;

      .disk-mount { font-family: monospace; }
      .disk-usage { font-weight: 500; }
    }

    .disk-size {
      margin-top: 4px;
      font-size: 12px;
      color: var(--text-secondary);
    }
  }
}

.network-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .network-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background-color: var(--bg-tertiary);
    border-radius: 8px;

    .network-label {
      display: flex;
      align-items: center;
      gap: 8px;

      .arrow {
        font-size: 16px;
        font-weight: bold;
        &.up { color: #22c55e; }
        &.down { color: #3b82f6; }
      }
    }

    .network-value {
      font-family: monospace;
      font-size: 18px;
      font-weight: 600;
    }
  }
}

.uptime-badge {
  padding: 4px 12px;
  background-color: var(--bg-tertiary);
  border-radius: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.quick-actions {
  margin-bottom: 24px;

  .action-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
}

.command-output {
  .output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .output-content {
    background-color: var(--bg-color);
    padding: 16px;
    border-radius: 8px;
    font-family: 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    max-height: 400px;
    overflow-y: auto;
  }
}
</style>
