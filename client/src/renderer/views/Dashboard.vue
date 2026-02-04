<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <h1>仪表盘</h1>
        <p class="subtitle">服务器状态概览</p>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="showAddServer = true">
          <el-icon><Plus /></el-icon>添加服务器
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" @click="$router.push('/servers')">
        <div class="stat-icon servers"><el-icon :size="24"><Monitor /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ servers.length }}</div>
          <div class="stat-label">服务器总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon connected"><el-icon :size="24"><Connection /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ connectedCount }}</div>
          <div class="stat-label">已连接</div>
        </div>
      </div>
      <div class="stat-card" @click="$router.push('/containers')">
        <div class="stat-icon containers"><el-icon :size="24"><Box /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ totalContainers }}</div>
          <div class="stat-label">运行容器</div>
          <div class="stat-breakdown">
            <span class="running">{{ runningContainers }} 运行</span>
            <span class="stopped">{{ stoppedContainers }} 停止</span>
          </div>
        </div>
      </div>
      <div class="stat-card" @click="$router.push('/services')">
        <div class="stat-icon services"><el-icon :size="24"><Setting /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ runningServices }}/{{ totalServices }}</div>
          <div class="stat-label">运行服务</div>
        </div>
      </div>
      <div class="stat-card clickable" :class="{ 'has-alerts': alertCount > 0 }" @click="showAlerts = true">
        <div class="stat-icon alerts"><el-icon :size="24"><Warning /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ alertCount }}</div>
          <div class="stat-label">告警</div>
        </div>
      </div>
    </div>

    <!-- 系统健康概览 -->
    <div class="health-overview" v-if="connectedCount > 0">
      <div class="health-card">
        <div class="health-score" :class="systemHealth.status">
          <div class="score-circle">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="8" opacity="0.2" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="8"
                :stroke-dasharray="`${systemHealth.score * 2.83} 283`"
                stroke-linecap="round" transform="rotate(-90 50 50)" />
            </svg>
            <div class="score-value">{{ systemHealth.score }}</div>
          </div>
          <div class="health-label">
            <span class="label-text">系统健康</span>
            <span class="status-text" :class="systemHealth.status">
              {{ systemHealth.status === 'healthy' ? '良好' : systemHealth.status === 'warning' ? '警告' : '异常' }}
            </span>
          </div>
        </div>
        <div class="health-metrics">
          <div class="health-metric">
            <span class="metric-name">平均 CPU</span>
            <el-progress :percentage="Math.round(systemHealth.avgCpu || 0)" :stroke-width="8" :show-text="false" :color="getProgressColor(systemHealth.avgCpu || 0)" />
            <span class="metric-value">{{ (systemHealth.avgCpu || 0).toFixed(1) }}%</span>
          </div>
          <div class="health-metric">
            <span class="metric-name">平均内存</span>
            <el-progress :percentage="Math.round(systemHealth.avgMemory || 0)" :stroke-width="8" :show-text="false" :color="getProgressColor(systemHealth.avgMemory || 0)" />
            <span class="metric-value">{{ (systemHealth.avgMemory || 0).toFixed(1) }}%</span>
          </div>
          <div class="health-metric">
            <span class="metric-name">平均磁盘</span>
            <el-progress :percentage="Math.round(systemHealth.avgDisk || 0)" :stroke-width="8" :show-text="false" :color="getProgressColor(systemHealth.avgDisk || 0)" />
            <span class="metric-value">{{ (systemHealth.avgDisk || 0).toFixed(1) }}%</span>
          </div>
        </div>
        <div class="network-overview">
          <div class="network-stat">
            <span class="arrow up">↑</span>
            <span class="net-value">{{ networkStats.totalOut.toFixed(1) }} MB/s</span>
          </div>
          <div class="network-stat">
            <span class="arrow down">↓</span>
            <span class="net-value">{{ networkStats.totalIn.toFixed(1) }} MB/s</span>
          </div>
        </div>
      </div>

      <!-- 资源趋势图 -->
      <div class="trend-card">
        <div class="trend-header">
          <h3>资源使用趋势</h3>
          <span class="trend-period">最近 1 分钟</span>
        </div>
        <div class="trend-chart">
          <div class="chart-legend">
            <span class="legend-item cpu"><span class="dot"></span>CPU</span>
            <span class="legend-item memory"><span class="dot"></span>内存</span>
          </div>
          <div class="chart-area">
            <div class="chart-grid">
              <div class="grid-line" v-for="i in 5" :key="i"></div>
            </div>
            <svg class="chart-svg" viewBox="0 0 300 100" preserveAspectRatio="none">
              <polyline
                class="chart-line cpu"
                :points="cpuChartPoints"
                fill="none"
                stroke="#6366f1"
                stroke-width="2"
              />
              <polyline
                class="chart-line memory"
                :points="memoryChartPoints"
                fill="none"
                stroke="#22c55e"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="chart-labels">
            <span>60s</span>
            <span>30s</span>
            <span>现在</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 服务器负载热力图和资源排行 -->
    <div class="extended-stats" v-if="connectedCount > 0">
      <!-- 服务器负载热力图 -->
      <div class="heatmap-card">
        <div class="card-header">
          <h3>服务器负载热力图</h3>
          <span class="card-subtitle">最近 10 分钟</span>
        </div>
        <div class="heatmap-container">
          <div class="heatmap-row" v-for="server in connectedServersWithMetrics" :key="server.id">
            <span class="heatmap-label">{{ server.name }}</span>
            <div class="heatmap-cells">
              <div
                v-for="(load, idx) in server.loadHistory"
                :key="idx"
                class="heatmap-cell"
                :class="getHeatmapClass(load)"
                :title="`${load.toFixed(1)}%`"
              ></div>
            </div>
          </div>
        </div>
        <div class="heatmap-legend">
          <span class="legend-label">低</span>
          <div class="legend-gradient"></div>
          <span class="legend-label">高</span>
        </div>
      </div>

      <!-- 资源消耗排行 -->
      <div class="top-consumers-card">
        <div class="card-header">
          <h3>资源消耗排行</h3>
          <el-radio-group v-model="topConsumersType" size="small">
            <el-radio-button value="cpu">CPU</el-radio-button>
            <el-radio-button value="memory">内存</el-radio-button>
            <el-radio-button value="disk">磁盘</el-radio-button>
          </el-radio-group>
        </div>
        <div class="consumers-list">
          <div v-for="(item, idx) in topConsumers" :key="item.name" class="consumer-item">
            <span class="consumer-rank" :class="{ top: idx < 3 }">{{ idx + 1 }}</span>
            <div class="consumer-info">
              <span class="consumer-name">{{ item.name }}</span>
              <span class="consumer-type">{{ item.type }}</span>
            </div>
            <div class="consumer-bar">
              <el-progress
                :percentage="item.value"
                :stroke-width="8"
                :show-text="false"
                :color="getProgressColor(item.value)"
              />
            </div>
            <span class="consumer-value">{{ item.value.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- 磁盘使用概览 -->
      <div class="disk-overview-card">
        <div class="card-header">
          <h3>磁盘使用概览</h3>
        </div>
        <div class="disk-list">
          <div v-for="disk in diskUsageList" :key="disk.name" class="disk-item">
            <div class="disk-header">
              <span class="disk-name">{{ disk.name }}</span>
              <span class="disk-server">{{ disk.server }}</span>
            </div>
            <div class="disk-bar">
              <el-progress
                :percentage="disk.usage"
                :stroke-width="12"
                :color="getProgressColor(disk.usage)"
              >
                <span class="disk-text">{{ disk.used }} / {{ disk.total }}</span>
              </el-progress>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard-content">
      <div class="main-content">
        <!-- 快捷操作 -->
        <div class="section quick-actions-section">
          <h2>快捷操作</h2>
          <div class="quick-actions-grid">
            <div class="quick-action" @click="$router.push('/terminal')">
              <el-icon :size="28"><Monitor /></el-icon>
              <span>终端</span>
            </div>
            <div class="quick-action" @click="$router.push('/files')">
              <el-icon :size="28"><Folder /></el-icon>
              <span>文件管理</span>
            </div>
            <div class="quick-action" @click="$router.push('/containers')">
              <el-icon :size="28"><Box /></el-icon>
              <span>容器</span>
            </div>
            <div class="quick-action" @click="$router.push('/services')">
              <el-icon :size="28"><Setting /></el-icon>
              <span>服务</span>
            </div>
            <div class="quick-action" @click="$router.push('/ai')">
              <el-icon :size="28"><ChatDotRound /></el-icon>
              <span>AI 助手</span>
            </div>
            <div class="quick-action" @click="$router.push('/cloud')">
              <el-icon :size="28"><Cloudy /></el-icon>
              <span>云服务</span>
            </div>
          </div>
        </div>

        <!-- 服务器列表 -->
        <div class="section">
          <div class="section-header">
            <h2>服务器状态</h2>
            <el-button text @click="$router.push('/servers')">查看全部</el-button>
          </div>
          <div class="server-grid" v-if="servers.length > 0">
            <div v-for="server in servers.slice(0, 6)" :key="server.id" class="server-card" :class="server.status" @click="goToServer(server)">
              <div class="server-header">
                <div class="server-status-indicator" :class="server.status"></div>
                <span class="server-name">{{ server.name }}</span>
                <el-dropdown trigger="click" @command="handleServerAction($event, server)">
                  <el-button text circle size="small" @click.stop><el-icon><MoreFilled /></el-icon></el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-if="server.status !== 'connected'" command="connect">连接</el-dropdown-item>
                      <el-dropdown-item v-if="server.status === 'connected'" command="disconnect">断开</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <div class="server-info">
                <div class="info-item">
                  <span class="label">主机</span>
                  <span class="value">{{ server.host }}:{{ server.port }}</span>
                </div>
              </div>
              <div class="server-metrics" v-if="server.status === 'connected' && serverMetrics[server.id]">
                <div class="metric">
                  <span class="metric-label">CPU</span>
                  <el-progress :percentage="serverMetrics[server.id].cpu" :stroke-width="6" :show-text="false" :color="getProgressColor(serverMetrics[server.id].cpu)" />
                  <span class="metric-value">{{ serverMetrics[server.id].cpu.toFixed(1) }}%</span>
                </div>
                <div class="metric">
                  <span class="metric-label">内存</span>
                  <el-progress :percentage="serverMetrics[server.id].memory" :stroke-width="6" :show-text="false" :color="getProgressColor(serverMetrics[server.id].memory)" />
                  <span class="metric-value">{{ serverMetrics[server.id].memory.toFixed(1) }}%</span>
                </div>
              </div>
              <div class="server-status-text">
                <span v-if="server.status === 'connected'" class="status-connected">已连接</span>
                <span v-else-if="server.status === 'connecting'" class="status-connecting">连接中...</span>
                <span v-else-if="server.status === 'error'" class="status-error">连接失败</span>
                <span v-else class="status-disconnected">未连接</span>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无服务器，点击上方按钮添加">
            <el-button type="primary" @click="showAddServer = true">添加服务器</el-button>
          </el-empty>
        </div>
      </div>

      <!-- 侧边栏 -->
      <div class="sidebar-content">
        <!-- 系统告警 -->
        <div class="section alerts-section">
          <div class="section-header">
            <h3>系统告警</h3>
            <el-badge :value="alertCount" :hidden="alertCount === 0" />
          </div>
          <div class="alerts-list" v-if="alerts.length > 0">
            <div v-for="alert in alerts.slice(0, 5)" :key="alert.id" class="alert-item" :class="alert.level">
              <el-icon v-if="alert.level === 'critical'"><CircleCloseFilled /></el-icon>
              <el-icon v-else-if="alert.level === 'warning'"><WarningFilled /></el-icon>
              <el-icon v-else><InfoFilled /></el-icon>
              <div class="alert-content">
                <span class="alert-message">{{ alert.message }}</span>
                <span class="alert-time">{{ formatTime(alert.time) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="no-alerts">
            <el-icon :size="32"><CircleCheckFilled /></el-icon>
            <span>系统运行正常</span>
          </div>
        </div>

        <!-- 最近活动 -->
        <div class="section activity-section">
          <div class="section-header">
            <h3>最近活动</h3>
          </div>
          <div class="activity-list">
            <div v-for="activity in recentActivities" :key="activity.id" class="activity-item">
              <div class="activity-icon" :class="activity.type">
                <el-icon v-if="activity.type === 'connect'"><Connection /></el-icon>
                <el-icon v-else-if="activity.type === 'container'"><Box /></el-icon>
                <el-icon v-else-if="activity.type === 'command'"><Monitor /></el-icon>
                <el-icon v-else><Document /></el-icon>
              </div>
              <div class="activity-content">
                <span class="activity-message">{{ activity.message }}</span>
                <span class="activity-time">{{ formatTime(activity.time) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加服务器对话框 -->
    <el-dialog v-model="showAddServer" title="添加服务器" width="500px" destroy-on-close>
      <el-form :model="newServer" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="newServer.name" placeholder="服务器名称" />
        </el-form-item>
        <el-form-item label="主机" required>
          <el-input v-model="newServer.host" placeholder="IP 或域名" />
        </el-form-item>
        <el-form-item label="端口" required>
          <el-input-number v-model="newServer.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="Token" required>
          <el-input v-model="newServer.token" type="password" show-password placeholder="认证令牌" />
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="newServer.group" placeholder="选择分组">
            <el-option v-for="g in groups" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="TLS">
          <el-switch v-model="newServer.useTls" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddServer = false">取消</el-button>
        <el-button type="primary" @click="addServer" :loading="adding">添加</el-button>
      </template>
    </el-dialog>

    <!-- 告警详情对话框 -->
    <el-dialog v-model="showAlerts" title="系统告警" width="600px">
      <div class="alerts-dialog">
        <div v-for="alert in alerts" :key="alert.id" class="alert-detail-item" :class="alert.level">
          <div class="alert-header">
            <el-tag :type="getAlertTagType(alert.level)" size="small">{{ getAlertLevelText(alert.level) }}</el-tag>
            <span class="alert-server">{{ alert.server }}</span>
            <span class="alert-time">{{ formatTime(alert.time) }}</span>
          </div>
          <p class="alert-message">{{ alert.message }}</p>
        </div>
        <el-empty v-if="alerts.length === 0" description="暂无告警" />
      </div>
      <template #footer>
        <el-button @click="clearAlerts" :disabled="alerts.length === 0">清除所有</el-button>
        <el-button type="primary" @click="showAlerts = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Monitor, Connection, Box, Warning, Plus, MoreFilled, Folder, Setting, ChatDotRound, Cloudy, CircleCloseFilled, WarningFilled, InfoFilled, CircleCheckFilled, Document } from '@element-plus/icons-vue'

interface Alert { id: string; level: 'critical' | 'warning' | 'info'; message: string; server: string; time: Date }
interface Activity { id: string; type: string; message: string; time: Date }
interface ServerMetric { cpu: number; memory: number; disk: number; networkIn: number; networkOut: number; uptime: number }
interface MetricHistory { time: Date; cpu: number; memory: number }

const router = useRouter()
const serverStore = useServerStore()

const showAddServer = ref(false)
const showAlerts = ref(false)
const adding = ref(false)
const newServer = ref({ name: '', host: '', port: 9527, token: '', group: '默认', useTls: false })

const serverMetrics = ref<Record<string, ServerMetric>>({})
const serverDiskInfo = ref<Record<string, any[]>>({})
const metricsHistory = ref<MetricHistory[]>([])
const loadHistory = ref<Record<string, number[]>>({})
const totalContainers = ref(0)
const runningContainers = ref(0)
const stoppedContainers = ref(0)
const totalServices = ref(0)
const runningServices = ref(0)
const topConsumersType = ref<'cpu' | 'memory' | 'disk'>('cpu')
const metricsCleanupFns = ref<Record<string, () => void>>({})
let metricsInterval: ReturnType<typeof setInterval> | null = null

const alerts = ref<Alert[]>([])

const recentActivities = ref<Activity[]>([])

const servers = computed(() => serverStore.servers)
const groups = computed(() => serverStore.groups)
const connectedCount = computed(() => serverStore.connectedServers.length)
const alertCount = computed(() => alerts.value.length)

// 计算系统整体健康状态
const systemHealth = computed(() => {
  const metrics = Object.values(serverMetrics.value)
  if (metrics.length === 0) return { status: 'unknown', score: 0 }

  const avgCpu = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length
  const avgMemory = metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length
  const avgDisk = metrics.reduce((sum, m) => sum + m.disk, 0) / metrics.length

  // 计算健康分数 (0-100)
  const cpuScore = Math.max(0, 100 - avgCpu)
  const memoryScore = Math.max(0, 100 - avgMemory)
  const diskScore = Math.max(0, 100 - avgDisk)
  const alertPenalty = Math.min(30, alerts.value.length * 10)

  const score = Math.round((cpuScore + memoryScore + diskScore) / 3 - alertPenalty)

  let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy'
  if (score < 50) status = 'critical'
  else if (score < 70) status = 'warning'

  return { status, score: Math.max(0, score), avgCpu, avgMemory, avgDisk }
})

// 计算网络总流量
const networkStats = computed(() => {
  const metrics = Object.values(serverMetrics.value)
  if (metrics.length === 0) return { totalIn: 0, totalOut: 0 }

  return {
    totalIn: metrics.reduce((sum, m) => sum + m.networkIn, 0),
    totalOut: metrics.reduce((sum, m) => sum + m.networkOut, 0)
  }
})

// 计算 CPU 图表点
const cpuChartPoints = computed(() => {
  if (metricsHistory.value.length < 2) return '0,100 300,100'
  const points = metricsHistory.value.map((m, i) => {
    const x = (i / (metricsHistory.value.length - 1)) * 300
    const y = 100 - m.cpu
    return `${x},${y}`
  })
  return points.join(' ')
})

// 计算内存图表点
const memoryChartPoints = computed(() => {
  if (metricsHistory.value.length < 2) return '0,100 300,100'
  const points = metricsHistory.value.map((m, i) => {
    const x = (i / (metricsHistory.value.length - 1)) * 300
    const y = 100 - m.memory
    return `${x},${y}`
  })
  return points.join(' ')
})

// 带负载历史的已连接服务器列表（用于热力图）
const connectedServersWithMetrics = computed(() => {
  return serverStore.connectedServers.map(server => ({
    ...server,
    loadHistory: loadHistory.value[server.id] || Array(20).fill(0)
  }))
})

// 资源消耗排行 - 只显示真实服务器数据
const topConsumers = computed(() => {
  const consumers: Array<{ name: string; type: string; value: number }> = []

  // 只添加真实服务器资源消耗
  serverStore.connectedServers.forEach(server => {
    const metrics = serverMetrics.value[server.id]
    if (metrics) {
      consumers.push({
        name: server.name,
        type: '服务器',
        value: topConsumersType.value === 'cpu' ? metrics.cpu :
               topConsumersType.value === 'memory' ? metrics.memory : metrics.disk
      })
    }
  })

  // 按值排序
  return consumers.sort((a, b) => b.value - a.value).slice(0, 5)
})

// 磁盘使用列表 - 使用真实数据
const diskUsageList = computed(() => {
  const disks: Array<{ name: string; server: string; usage: number; used: string; total: string }> = []

  serverStore.connectedServers.forEach(server => {
    const diskInfo = serverDiskInfo.value[server.id]
    if (diskInfo && diskInfo.length > 0) {
      diskInfo.forEach((d: any) => {
        const totalGB = (d.total / 1024 / 1024 / 1024).toFixed(0)
        const usedGB = (d.used / 1024 / 1024 / 1024).toFixed(0)
        disks.push({
          name: d.mountpoint || d.device,
          server: server.name,
          usage: d.used_percent || d.usedPercent || 0,
          used: `${usedGB}GB`,
          total: `${totalGB}GB`
        })
      })
    }
  })

  return disks.slice(0, 6)
})

// 初始化服务器指标 - 启动真实的指标流
async function initServerMetrics() {
  const connectedServers = serverStore.connectedServers
  // 并行启动所有服务器的指标流
  await Promise.all(connectedServers.map(server => startMetricsStream(server.id)))
}

// 获取服务器系统信息（包括磁盘）- 同时获取初始指标
async function loadServerSystemInfo(serverId: string) {
  try {
    const sysInfo = await window.electronAPI.server.getSystemInfo(serverId)
    if (sysInfo) {
      // 立即设置初始指标值（不等待流）
      const cpuUsage = sysInfo.cpu?.usage ?? sysInfo.cpu?.usedPercent ?? 0
      const memoryUsage = sysInfo.memory?.usedPercent ?? sysInfo.memory?.used_percent ?? 0
      
      // 处理磁盘信息
      if (sysInfo.disks && sysInfo.disks.length > 0) {
        serverDiskInfo.value[serverId] = sysInfo.disks
        const avgDisk = sysInfo.disks.reduce((sum: number, d: any) => 
          sum + (d.used_percent || d.usedPercent || 0), 0) / sysInfo.disks.length
        
        // 立即设置初始指标
        serverMetrics.value[serverId] = {
          cpu: cpuUsage,
          memory: memoryUsage,
          disk: avgDisk,
          networkIn: 0,
          networkOut: 0,
          uptime: sysInfo.uptime || 0
        }
        
        // 初始化负载历史
        loadHistory.value[serverId] = Array(20).fill(cpuUsage)
        
        // 立即更新图表历史
        updateMetricsHistory()
      }
    }
  } catch (e) {
    console.error('Failed to load system info:', e)
  }
}

// 启动单个服务器的指标流
async function startMetricsStream(serverId: string) {
  // 如果已有监听器，先清理
  if (metricsCleanupFns.value[serverId]) {
    metricsCleanupFns.value[serverId]()
    delete metricsCleanupFns.value[serverId]
  }

  try {
    // 先获取系统信息（包括磁盘）- 这会立即设置初始指标
    await loadServerSystemInfo(serverId)
    
    // 启动指标流（每1秒更新一次，加快响应）
    await window.electronAPI.server.startMetrics(serverId, 1)

    // 监听指标更新
    const cleanup = window.electronAPI.server.onMetrics(serverId, (metrics) => {
      
      // 更新服务器指标 - 同时支持 snake_case 和 camelCase
      const cpuUsage = metrics.cpu_usage ?? metrics.cpuUsage ?? 0
      const memoryUsage = metrics.memory_usage ?? metrics.memoryUsage ?? 0

      // 磁盘使用率从系统信息中获取
      const diskUsage = serverMetrics.value[serverId]?.disk || 0

      // 计算网络流量
      let networkIn = 0
      let networkOut = 0
      const networkMetrics = metrics.network_metrics ?? metrics.networkMetrics
      if (networkMetrics) {
        networkMetrics.forEach((net: any) => {
          const bytesRecv = net.bytes_recv ?? net.bytesRecv ?? 0
          const bytesSent = net.bytes_sent ?? net.bytesSent ?? 0
          networkIn += bytesRecv / 1024 / 1024 // 转换为 MB/s
          networkOut += bytesSent / 1024 / 1024
        })
      }

      serverMetrics.value[serverId] = {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        networkIn: networkIn,
        networkOut: networkOut,
        uptime: serverMetrics.value[serverId]?.uptime || 0
      }

      // 更新负载历史（用于热力图）
      if (!loadHistory.value[serverId]) {
        loadHistory.value[serverId] = Array(20).fill(cpuUsage)
      } else {
        loadHistory.value[serverId].push(cpuUsage)
        if (loadHistory.value[serverId].length > 20) {
          loadHistory.value[serverId].shift()
        }
      }

      // 检查是否需要生成告警
      const server = serverStore.servers.find(s => s.id === serverId)
      if (server) {
        checkAndGenerateAlerts(server, serverMetrics.value[serverId])
      }

      // 更新全局指标历史
      updateMetricsHistory()
    })

    metricsCleanupFns.value[serverId] = cleanup
  } catch (error) {
    console.error(`Failed to start metrics for server ${serverId}:`, error)
  }
}

// 更新全局指标历史（用于趋势图）
function updateMetricsHistory() {
  const metrics = Object.values(serverMetrics.value)
  if (metrics.length > 0) {
    const avgCpu = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length
    const avgMemory = metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length

    metricsHistory.value.push({
      time: new Date(),
      cpu: avgCpu,
      memory: avgMemory
    })

    // 只保留最近30个数据点
    if (metricsHistory.value.length > 30) {
      metricsHistory.value.shift()
    }
  }
}

// 停止服务器的指标流
function stopMetricsStream(serverId: string) {
  if (metricsCleanupFns.value[serverId]) {
    metricsCleanupFns.value[serverId]()
    delete metricsCleanupFns.value[serverId]
  }
  delete serverMetrics.value[serverId]
  delete serverDiskInfo.value[serverId]
  delete loadHistory.value[serverId]
}

// 检查指标并生成告警
function checkAndGenerateAlerts(server: any, metrics: ServerMetric) {
  // CPU 告警
  if (metrics.cpu > 85 && !alerts.value.find(a => a.server === server.name && a.message.includes('CPU'))) {
    alerts.value.unshift({
      id: Date.now().toString(),
      level: metrics.cpu > 90 ? 'critical' : 'warning',
      message: `${server.name} CPU 使用率达到 ${metrics.cpu.toFixed(1)}%`,
      server: server.name,
      time: new Date()
    })
  }

  // 内存告警
  if (metrics.memory > 85 && !alerts.value.find(a => a.server === server.name && a.message.includes('内存'))) {
    alerts.value.unshift({
      id: Date.now().toString(),
      level: metrics.memory > 90 ? 'critical' : 'warning',
      message: `${server.name} 内存使用率达到 ${metrics.memory.toFixed(1)}%`,
      server: server.name,
      time: new Date()
    })
  }

  // 限制告警数量
  if (alerts.value.length > 10) {
    alerts.value = alerts.value.slice(0, 10)
  }
}

function getProgressColor(percentage: number): string {
  if (percentage < 60) return '#22c55e'
  if (percentage < 80) return '#f59e0b'
  return '#ef4444'
}

function getHeatmapClass(load: number): string {
  if (load < 20) return 'level-1'
  if (load < 40) return 'level-2'
  if (load < 60) return 'level-3'
  if (load < 80) return 'level-4'
  return 'level-5'
}

function getAlertTagType(level: string) {
  if (level === 'critical') return 'danger'
  if (level === 'warning') return 'warning'
  return 'info'
}

function getAlertLevelText(level: string) {
  if (level === 'critical') return '严重'
  if (level === 'warning') return '警告'
  return '信息'
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return date.toLocaleDateString('zh-CN')
}

async function addServer() {
  if (!newServer.value.name || !newServer.value.host || !newServer.value.token) {
    ElMessage.warning('请填写必要信息')
    return
  }
  adding.value = true
  try {
    const id = serverStore.addServer({ ...newServer.value })
    await serverStore.connectServer(id)
    // 启动指标流
    await startMetricsStream(id)
    // 重新加载统计
    loadContainerAndServiceStats()
    ElMessage.success('服务器添加成功')
    showAddServer.value = false
    newServer.value = { name: '', host: '', port: 9527, token: '', group: '默认', useTls: false }
  } catch (error) {
    ElMessage.error(`连接失败: ${(error as Error).message}`)
  } finally {
    adding.value = false
  }
}

function goToServer(server: any) {
  if (server.status === 'connected') {
    serverStore.setCurrentServer(server.id)
    router.push(`/server/${server.id}`)
  }
}

async function handleServerAction(action: string, server: any) {
  switch (action) {
    case 'connect':
      try {
        await serverStore.connectServer(server.id)
        // 启动指标流
        await startMetricsStream(server.id)
        // 重新加载统计
        loadContainerAndServiceStats()
        ElMessage.success('连接成功')
        // 添加活动记录
        recentActivities.value.unshift({
          id: Date.now().toString(),
          type: 'connect',
          message: `连接到 ${server.name}`,
          time: new Date()
        })
      } catch (error) {
        ElMessage.error(`连接失败: ${(error as Error).message}`)
      }
      break
    case 'disconnect':
      // 停止指标流
      stopMetricsStream(server.id)
      await serverStore.disconnectServer(server.id)
      // 重新加载统计
      loadContainerAndServiceStats()
      ElMessage.info('已断开连接')
      recentActivities.value.unshift({
        id: Date.now().toString(),
        type: 'connect',
        message: `断开 ${server.name} 连接`,
        time: new Date()
      })
      break
    case 'delete':
      ElMessageBox.confirm('确定要删除这个服务器吗？', '确认删除', { type: 'warning' }).then(() => {
        stopMetricsStream(server.id)
        serverStore.removeServer(server.id)
        ElMessage.success('已删除')
      }).catch(() => {})
      break
  }
}

function clearAlerts() {
  alerts.value = []
  ElMessage.success('告警已清除')
}

onMounted(() => {
  initServerMetrics()
  // 加载容器和服务统计（如果有连接的服务器）
  loadContainerAndServiceStats()
})

onUnmounted(() => {
  // 清理所有指标流监听器
  Object.keys(metricsCleanupFns.value).forEach(serverId => {
    if (metricsCleanupFns.value[serverId]) {
      metricsCleanupFns.value[serverId]()
    }
  })
  metricsCleanupFns.value = {}

  if (metricsInterval) {
    clearInterval(metricsInterval)
  }
})

// 加载容器和服务统计
async function loadContainerAndServiceStats() {
  const connectedServers = serverStore.connectedServers
  let containers = 0
  let running = 0
  let stopped = 0
  let services = 0
  let activeServices = 0

  for (const server of connectedServers) {
    try {
      // 获取容器统计
      const containerResult = await window.electronAPI.container.list(server.id, true)
      if (containerResult.containers) {
        containers += containerResult.containers.length
        containerResult.containers.forEach((c: any) => {
          if (c.state === 'running') running++
          else stopped++
        })
      }
    } catch (e) {
      // 忽略错误，使用默认值
    }

    try {
      // 获取服务统计
      const serviceResult = await window.electronAPI.service.list(server.id)
      if (serviceResult.services) {
        services += serviceResult.services.length
        serviceResult.services.forEach((s: any) => {
          if (s.status === 'running' || s.status === 'active') activeServices++
        })
      }
    } catch (e) {
      // 忽略错误，使用默认值
    }
  }

  totalContainers.value = containers
  runningContainers.value = running
  stoppedContainers.value = stopped
  totalServices.value = services
  runningServices.value = activeServices
}
</script>

<style lang="scss" scoped>
.dashboard { max-width: 1400px; margin: 0 auto; }

.dashboard-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 2px; }
  .subtitle { color: var(--text-secondary); font-size: 12px; }
}

.stats-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px;
}

.stat-card {
  background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
  padding: 14px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s;
  &:hover { border-color: var(--primary-color); }
  &.has-alerts { border-color: var(--el-color-danger); }
  .stat-icon {
    width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    &.servers { background-color: rgba(99, 102, 241, 0.1); color: #6366f1; }
    &.connected { background-color: rgba(34, 197, 94, 0.1); color: #22c55e; }
    &.containers { background-color: rgba(59, 130, 246, 0.1); color: #3b82f6; }
    &.services { background-color: rgba(168, 85, 247, 0.1); color: #a855f7; }
    &.alerts { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; }
  }
  .stat-info {
    .stat-value { font-size: 20px; font-weight: 600; }
    .stat-label { font-size: 11px; color: var(--text-secondary); }
  }
}

.dashboard-content { display: flex; gap: 16px; }
.main-content { flex: 1; min-width: 0; }
.sidebar-content { width: 280px; flex-shrink: 0; }

.section {
  margin-bottom: 16px;
  .section-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
    h2, h3 { font-size: 14px; font-weight: 600; margin: 0; }
  }
}

.quick-actions-section {
  .quick-actions-grid {
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;
  }
  .quick-action {
    display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px;
    background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
    cursor: pointer; transition: all 0.2s;
    &:hover { border-color: var(--primary-color); background: var(--bg-tertiary); }
    span { font-size: 11px; color: var(--text-secondary); }
  }
}

.server-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }

.server-card {
  background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
  padding: 12px; cursor: pointer; transition: all 0.2s;
  &:hover { border-color: var(--primary-color); transform: translateY(-1px); }
  &.connected { border-left: 3px solid var(--success-color); }
  &.error { border-left: 3px solid var(--danger-color); }
  .server-header {
    display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
    .server-status-indicator {
      width: 8px; height: 8px; border-radius: 50%; background-color: var(--text-secondary);
      &.connected { background-color: var(--success-color); }
      &.connecting { background-color: var(--warning-color); animation: pulse 1.5s infinite; }
      &.error { background-color: var(--danger-color); }
    }
    .server-name { flex: 1; font-weight: 600; font-size: 13px; }
  }
  .server-info {
    margin-bottom: 10px;
    .info-item { display: flex; justify-content: space-between; font-size: 11px; .label { color: var(--text-secondary); } }
  }
  .server-metrics {
    margin-bottom: 10px;
    .metric {
      display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
      .metric-label { width: 28px; font-size: 11px; color: var(--text-secondary); }
      .el-progress { flex: 1; }
      .metric-value { width: 40px; text-align: right; font-size: 11px; font-family: monospace; }
    }
  }
  .server-status-text { font-size: 11px; text-align: right; }
}

.alerts-section {
  background: var(--bg-secondary); border-radius: 12px; padding: 16px;
  .alerts-list { display: flex; flex-direction: column; gap: 12px; }
  .alert-item {
    display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 8px; background: var(--bg-tertiary);
    &.critical { color: var(--el-color-danger); }
    &.warning { color: var(--el-color-warning); }
    &.info { color: var(--el-color-info); }
    .alert-content { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .alert-message { font-size: 13px; color: var(--text-color); }
    .alert-time { font-size: 11px; color: var(--text-secondary); }
  }
  .no-alerts {
    display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; color: var(--el-color-success);
    span { font-size: 13px; color: var(--text-secondary); }
  }
}

.activity-section {
  background: var(--bg-secondary); border-radius: 12px; padding: 16px;
  .activity-list { display: flex; flex-direction: column; gap: 12px; }
  .activity-item {
    display: flex; align-items: flex-start; gap: 10px;
    .activity-icon {
      width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px;
      &.connect { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
      &.container { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
      &.command { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
      &.file { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
    }
    .activity-content { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .activity-message { font-size: 13px; }
    .activity-time { font-size: 11px; color: var(--text-secondary); }
  }
}

.alerts-dialog {
  .alert-detail-item {
    padding: 12px; border-radius: 8px; margin-bottom: 12px; background: var(--bg-secondary);
    &:last-child { margin-bottom: 0; }
    .alert-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .alert-server { flex: 1; font-weight: 500; }
    .alert-time { font-size: 12px; color: var(--text-secondary); }
    .alert-message { margin: 0; font-size: 14px; }
  }
}

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.health-overview {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 12px;
  margin-bottom: 16px;
}

.health-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  .health-score {
    display: flex;
    align-items: center;
    gap: 12px;

    .score-circle {
      position: relative;
      width: 60px;
      height: 60px;

      svg {
        width: 100%;
        height: 100%;
      }

      .score-value {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 18px;
        font-weight: 700;
      }
    }

    &.healthy { color: #22c55e; }
    &.warning { color: #f59e0b; }
    &.critical { color: #ef4444; }

    .health-label {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .label-text {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .status-text {
        font-size: 14px;
        font-weight: 600;

        &.healthy { color: #22c55e; }
        &.warning { color: #f59e0b; }
        &.critical { color: #ef4444; }
      }
    }
  }

  .health-metrics {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .health-metric {
      display: flex;
      align-items: center;
      gap: 10px;

      .metric-name {
        width: 60px;
        font-size: 11px;
        color: var(--text-secondary);
      }

      .el-progress {
        flex: 1;
      }

      .metric-value {
        width: 45px;
        text-align: right;
        font-size: 11px;
        font-family: monospace;
      }
    }
  }

  .network-overview {
    display: flex;
    gap: 16px;
    padding-top: 10px;
    border-top: 1px solid var(--border-color);

    .network-stat {
      display: flex;
      align-items: center;
      gap: 6px;

      .arrow {
        font-size: 14px;
        font-weight: bold;

        &.up { color: #22c55e; }
        &.down { color: #3b82f6; }
      }

      .net-value {
        font-family: monospace;
        font-size: 12px;
      }
    }
  }
}

.trend-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 14px;

  .trend-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
    }

    .trend-period {
      font-size: 11px;
      color: var(--text-secondary);
    }
  }

  .trend-chart {
    .chart-legend {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--text-secondary);

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        &.cpu .dot { background: #6366f1; }
        &.memory .dot { background: #22c55e; }
      }
    }

    .chart-area {
      position: relative;
      height: 100px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      overflow: hidden;

      .chart-grid {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 8px 0;

        .grid-line {
          height: 1px;
          background: var(--border-color);
          opacity: 0.5;
        }
      }

      .chart-svg {
        position: absolute;
        inset: 8px;
        width: calc(100% - 16px);
        height: calc(100% - 16px);

        .chart-line {
          stroke-linejoin: round;
          stroke-linecap: round;
        }
      }
    }

    .chart-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 10px;
      color: var(--text-secondary);
    }
  }
}

// 统计卡片细分样式
.stat-breakdown {
  display: flex;
  gap: 6px;
  margin-top: 2px;
  font-size: 10px;

  .running {
    color: #22c55e;
  }

  .stopped {
    color: #ef4444;
  }
}

// 扩展统计区域
.extended-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

// 通用卡片头部
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }

  .card-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
  }
}

// 热力图卡片
.heatmap-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;

  .heatmap-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .heatmap-row {
    display: flex;
    align-items: center;
    gap: 12px;

    .heatmap-label {
      width: 100px;
      font-size: 12px;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .heatmap-cells {
      display: flex;
      gap: 2px;
      flex: 1;
    }

    .heatmap-cell {
      flex: 1;
      height: 20px;
      border-radius: 2px;
      cursor: pointer;
      transition: transform 0.2s;

      &:hover {
        transform: scaleY(1.2);
      }

      &.level-1 { background: #22c55e; }
      &.level-2 { background: #84cc16; }
      &.level-3 { background: #eab308; }
      &.level-4 { background: #f97316; }
      &.level-5 { background: #ef4444; }
    }
  }

  .heatmap-legend {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 11px;
    color: var(--text-secondary);

    .legend-gradient {
      width: 100px;
      height: 8px;
      border-radius: 4px;
      background: linear-gradient(to right, #22c55e, #84cc16, #eab308, #f97316, #ef4444);
    }
  }
}

// 资源消耗排行卡片
.top-consumers-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;

  .consumers-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .consumer-item {
    display: flex;
    align-items: center;
    gap: 12px;

    .consumer-rank {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;

      &.top {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
      }
    }

    .consumer-info {
      display: flex;
      flex-direction: column;
      min-width: 100px;

      .consumer-name {
        font-size: 13px;
        font-weight: 500;
      }

      .consumer-type {
        font-size: 11px;
        color: var(--text-secondary);
      }
    }

    .consumer-bar {
      flex: 1;
    }

    .consumer-value {
      width: 50px;
      text-align: right;
      font-size: 13px;
      font-family: monospace;
    }
  }
}

// 磁盘使用概览卡片
.disk-overview-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;

  .disk-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .disk-item {
    .disk-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;

      .disk-name {
        font-size: 13px;
        font-weight: 500;
      }

      .disk-server {
        font-size: 11px;
        color: var(--text-secondary);
      }
    }

    .disk-bar {
      .disk-text {
        font-size: 11px;
        color: var(--text-secondary);
      }
    }
  }
}
</style>
