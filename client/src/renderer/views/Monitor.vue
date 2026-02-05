<template>
  <div class="monitor-page">
    <div class="page-header">
      <div class="header-left">
        <h1>监控中心</h1>
        <p class="subtitle">实时资源监控与统计</p>
      </div>
      <div class="header-actions">
        <el-select v-if="hasMultipleServers" v-model="selectedServer" placeholder="选择服务器" size="small" clearable>
          <el-option label="全部服务器" value="" />
          <el-option v-for="s in connectedServers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button @click="refresh" :loading="loading" size="small">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <div v-if="connectedServers.length === 0" class="empty-state">
      <el-empty description="暂无已连接的服务器" />
    </div>

    <template v-else>
      <!-- 概览卡片 -->
      <div class="overview-cards">
        <div class="ov-card">
          <div class="ov-icon cpu"><el-icon :size="20"><Cpu /></el-icon></div>
          <div class="ov-info">
            <div class="ov-value">{{ avgCpu.toFixed(1) }}%</div>
            <div class="ov-label">平均 CPU</div>
          </div>
          <div class="ov-chart">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none">
              <polyline :points="cpuChartPoints" fill="none" stroke="#6366f1" stroke-width="2" />
            </svg>
          </div>
        </div>
        <div class="ov-card">
          <div class="ov-icon memory"><el-icon :size="20"><Coin /></el-icon></div>
          <div class="ov-info">
            <div class="ov-value">{{ avgMemory.toFixed(1) }}%</div>
            <div class="ov-label">平均内存</div>
          </div>
          <div class="ov-chart">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none">
              <polyline :points="memoryChartPoints" fill="none" stroke="#22c55e" stroke-width="2" />
            </svg>
          </div>
        </div>
        <div class="ov-card">
          <div class="ov-icon disk"><el-icon :size="20"><Box /></el-icon></div>
          <div class="ov-info">
            <div class="ov-value">{{ avgDisk.toFixed(1) }}%</div>
            <div class="ov-label">平均磁盘</div>
          </div>
        </div>
        <div class="ov-card">
          <div class="ov-icon network"><el-icon :size="20"><Connection /></el-icon></div>
          <div class="ov-info">
            <div class="ov-value">{{ formatBytes(totalNetworkIn) }}/s</div>
            <div class="ov-label">网络入站</div>
          </div>
        </div>
      </div>

      <!-- CPU 和内存趋势图 -->
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">CPU 使用率趋势</span>
            <span class="chart-value">{{ avgCpu.toFixed(1) }}%</span>
          </div>
          <div class="chart-body">
            <svg viewBox="0 0 300 80" preserveAspectRatio="none" class="trend-chart">
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#6366f1" stop-opacity="0.3"/>
                  <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <path :d="cpuAreaPath" fill="url(#cpuGrad)" />
              <polyline :points="cpuTrendPoints" fill="none" stroke="#6366f1" stroke-width="2" />
            </svg>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">内存使用率趋势</span>
            <span class="chart-value">{{ avgMemory.toFixed(1) }}%</span>
          </div>
          <div class="chart-body">
            <svg viewBox="0 0 300 80" preserveAspectRatio="none" class="trend-chart">
              <defs>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#22c55e" stop-opacity="0.3"/>
                  <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <path :d="memoryAreaPath" fill="url(#memGrad)" />
              <polyline :points="memoryTrendPoints" fill="none" stroke="#22c55e" stroke-width="2" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 服务器详情 -->
      <div class="servers-detail">
        <div class="section-header">
          <h2>服务器资源详情</h2>
        </div>
        <div class="server-cards">
          <div v-for="server in displayServers" :key="server.id" class="srv-card">
            <div class="srv-header">
              <span class="srv-dot"></span>
              <span class="srv-name">{{ server.name }}</span>
              <span class="srv-host">{{ server.host }}</span>
            </div>
            <div class="srv-metrics">
              <div class="srv-metric">
                <div class="sm-header">
                  <span>CPU</span>
                  <span>{{ (metrics[server.id]?.cpu || 0).toFixed(1) }}%</span>
                </div>
                <el-progress :percentage="metrics[server.id]?.cpu || 0" :stroke-width="6" :show-text="false" :color="getColor(metrics[server.id]?.cpu || 0)" />
              </div>
              <div class="srv-metric">
                <div class="sm-header">
                  <span>内存</span>
                  <span>{{ (metrics[server.id]?.memory || 0).toFixed(1) }}%</span>
                </div>
                <el-progress :percentage="metrics[server.id]?.memory || 0" :stroke-width="6" :show-text="false" :color="getColor(metrics[server.id]?.memory || 0)" />
              </div>
              <div class="srv-metric">
                <div class="sm-header">
                  <span>磁盘</span>
                  <span>{{ (metrics[server.id]?.disk || 0).toFixed(1) }}%</span>
                </div>
                <el-progress :percentage="metrics[server.id]?.disk || 0" :stroke-width="6" :show-text="false" :color="getColor(metrics[server.id]?.disk || 0)" />
              </div>
            </div>
            <div class="srv-network" v-if="metrics[server.id]?.networkIn !== undefined">
              <div class="net-item">
                <el-icon><Download /></el-icon>
                <span>{{ formatBytes(metrics[server.id]?.networkIn || 0) }}/s</span>
              </div>
              <div class="net-item">
                <el-icon><Upload /></el-icon>
                <span>{{ formatBytes(metrics[server.id]?.networkOut || 0) }}/s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useServerStore } from '@/stores/server'
import { Refresh, Cpu, Coin, Box, Connection, Download, Upload } from '@element-plus/icons-vue'

const serverStore = useServerStore()
const loading = ref(false)
const selectedServer = ref('')

const metrics = ref<Record<string, { cpu: number; memory: number; disk: number; networkIn: number; networkOut: number }>>({})
const lastNetworkBytes = ref<Record<string, { bytesIn: number; bytesOut: number; timestamp: number }>>({})
const cpuHistory = ref<number[]>([])
const memoryHistory = ref<number[]>([])
const cleanupFns = ref<Record<string, () => void>>({})

const connectedServers = computed(() => serverStore.connectedServers)
const hasMultipleServers = computed(() => serverStore.hasMultipleServers)

// 自动选择服务器的函数
function autoSelectServer() {
  if (connectedServers.value.length > 0 && !selectedServer.value) {
    // 优先选择当前服务器，否则选第一个
    if (serverStore.currentServerId && connectedServers.value.find(s => s.id === serverStore.currentServerId)) {
      selectedServer.value = serverStore.currentServerId
    } else {
      selectedServer.value = connectedServers.value[0].id
    }
  }
}

// 监听已连接服务器变化，当有新服务器连接时自动选择
watch(connectedServers, (newServers) => {
  if (newServers.length > 0 && !selectedServer.value) {
    autoSelectServer()
  }
}, { immediate: true, deep: true })

// 监听 currentServerId 变化
watch(() => serverStore.currentServerId, (newId) => {
  if (newId && connectedServers.value.find(s => s.id === newId)) {
    selectedServer.value = newId
  }
}, { immediate: true })

const displayServers = computed(() => {
  if (selectedServer.value) {
    return connectedServers.value.filter(s => s.id === selectedServer.value)
  }
  return connectedServers.value
})

const avgCpu = computed(() => {
  const servers = displayServers.value
  if (!servers.length) return 0
  return servers.reduce((s, srv) => s + (metrics.value[srv.id]?.cpu || 0), 0) / servers.length
})

const avgMemory = computed(() => {
  const servers = displayServers.value
  if (!servers.length) return 0
  return servers.reduce((s, srv) => s + (metrics.value[srv.id]?.memory || 0), 0) / servers.length
})

const avgDisk = computed(() => {
  const servers = displayServers.value
  if (!servers.length) return 0
  return servers.reduce((s, srv) => s + (metrics.value[srv.id]?.disk || 0), 0) / servers.length
})

const totalNetworkIn = computed(() => {
  const servers = displayServers.value
  return servers.reduce((s, srv) => s + (metrics.value[srv.id]?.networkIn || 0), 0)
})

// 迷你图表点
const cpuChartPoints = computed(() => {
  const data = cpuHistory.value.slice(-20)
  if (data.length < 2) return '0,30 100,30'
  const step = 100 / (data.length - 1)
  return data.map((v, i) => `${i * step},${30 - v * 0.3}`).join(' ')
})

const memoryChartPoints = computed(() => {
  const data = memoryHistory.value.slice(-20)
  if (data.length < 2) return '0,30 100,30'
  const step = 100 / (data.length - 1)
  return data.map((v, i) => `${i * step},${30 - v * 0.3}`).join(' ')
})

// 大趋势图
const cpuTrendPoints = computed(() => {
  const data = cpuHistory.value.slice(-60)
  if (data.length < 2) return '0,80 300,80'
  const step = 300 / (data.length - 1)
  return data.map((v, i) => `${i * step},${80 - v * 0.8}`).join(' ')
})

const cpuAreaPath = computed(() => {
  const data = cpuHistory.value.slice(-60)
  if (data.length < 2) return ''
  const step = 300 / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${80 - v * 0.8}`)
  return `M0,80 L${points.join(' L')} L300,80 Z`
})

const memoryTrendPoints = computed(() => {
  const data = memoryHistory.value.slice(-60)
  if (data.length < 2) return '0,80 300,80'
  const step = 300 / (data.length - 1)
  return data.map((v, i) => `${i * step},${80 - v * 0.8}`).join(' ')
})

const memoryAreaPath = computed(() => {
  const data = memoryHistory.value.slice(-60)
  if (data.length < 2) return ''
  const step = 300 / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${80 - v * 0.8}`)
  return `M0,80 L${points.join(' L')} L300,80 Z`
})

function getColor(v: number): string {
  if (v < 60) return '#22c55e'
  if (v < 80) return '#f59e0b'
  return '#ef4444'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes.toFixed(0) + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

onMounted(async () => {
  // 等待一帧确保 store 已初始化
  await new Promise(r => setTimeout(r, 0))
  autoSelectServer()
  initMetrics()
})

onUnmounted(() => {
  Object.values(cleanupFns.value).forEach(fn => fn())
})

async function initMetrics() {
  for (const server of connectedServers.value) {
    await startMetrics(server.id)
  }
}

async function startMetrics(serverId: string) {
  try {
    // 获取初始系统信息
    const info = await window.electronAPI.server.getSystemInfo(serverId)
    if (info) {
      const cpu = info.cpu?.usage ?? info.cpu?.usedPercent ?? 0
      const mem = info.memory?.usedPercent ?? info.memory?.used_percent ?? 0
      // 过滤掉 snap 分区计算磁盘使用率
      let disk = 0
      if (info.disks?.length) {
        const filteredDisks = info.disks.filter((d: any) => {
          const mount = d.mountpoint || ''
          if (mount.startsWith('/snap/')) return false
          if (mount.startsWith('/run/')) return false
          if (d.total && d.total < 100 * 1024 * 1024) return false
          return true
        })
        if (filteredDisks.length > 0) {
          disk = filteredDisks.reduce((s: number, d: any) => s + (d.used_percent || d.usedPercent || 0), 0) / filteredDisks.length
        }
      }
      const netIn = info.network?.bytes_recv ?? info.network?.bytesRecv ?? 0
      const netOut = info.network?.bytes_sent ?? info.network?.bytesSent ?? 0
      metrics.value[serverId] = { cpu, memory: mem, disk, networkIn: netIn, networkOut: netOut }
    }

    // 启动指标流
    await window.electronAPI.server.startMetrics(serverId, 2)
    
    let lastDataTime = Date.now()
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    
    const cleanup = window.electronAPI.server.onMetrics(serverId, (m) => {
      lastDataTime = Date.now()
      
      const cpu = m.cpu_usage ?? 0
      const mem = m.memory_usage ?? 0
      const disk = metrics.value[serverId]?.disk ?? 0
      
      // 从 network_metrics 数组计算网络流量速率
      let totalBytesIn = 0, totalBytesOut = 0
      if (m.network_metrics?.length) {
        m.network_metrics.forEach(n => {
          totalBytesIn += n.bytes_recv || 0
          totalBytesOut += n.bytes_sent || 0
        })
      }
      
      // 计算速率（字节/秒）
      let netInRate = 0, netOutRate = 0
      const lastNet = lastNetworkBytes.value[serverId]
      const now = Date.now()
      if (lastNet && lastNet.timestamp > 0) {
        const timeDiff = (now - lastNet.timestamp) / 1000 // 秒
        if (timeDiff > 0 && timeDiff < 10) { // 合理的时间间隔
          netInRate = Math.max(0, (totalBytesIn - lastNet.bytesIn) / timeDiff)
          netOutRate = Math.max(0, (totalBytesOut - lastNet.bytesOut) / timeDiff)
        }
      }
      
      // 保存当前字节数用于下次计算
      lastNetworkBytes.value[serverId] = { bytesIn: totalBytesIn, bytesOut: totalBytesOut, timestamp: now }
      
      metrics.value[serverId] = { cpu, memory: mem, disk, networkIn: netInRate, networkOut: netOutRate }
      
      // 更新历史数据
      cpuHistory.value.push(avgCpu.value)
      memoryHistory.value.push(avgMemory.value)
      if (cpuHistory.value.length > 120) cpuHistory.value.shift()
      if (memoryHistory.value.length > 120) memoryHistory.value.shift()
    })
    
    // 检测数据流是否中断，如果超过 10 秒没有数据则尝试重连
    const checkConnection = () => {
      if (Date.now() - lastDataTime > 10000) {
        console.log('Metrics stream timeout, reconnecting...')
        cleanup()
        if (cleanupFns.value[serverId]) {
          delete cleanupFns.value[serverId]
        }
        // 延迟重连
        reconnectTimer = setTimeout(() => {
          if (connectedServers.value.find(s => s.id === serverId)) {
            startMetrics(serverId)
          }
        }, 2000)
      } else {
        reconnectTimer = setTimeout(checkConnection, 5000)
      }
    }
    reconnectTimer = setTimeout(checkConnection, 10000)
    
    cleanupFns.value[serverId] = () => {
      cleanup()
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
    }
  } catch (e) {
    console.error('Metrics error:', e)
    // 出错后延迟重试
    setTimeout(() => {
      if (connectedServers.value.find(s => s.id === serverId)) {
        startMetrics(serverId)
      }
    }, 5000)
  }
}

async function refresh() {
  loading.value = true
  try {
    // 清理旧的
    Object.values(cleanupFns.value).forEach(fn => fn())
    cleanupFns.value = {}
    metrics.value = {}
    lastNetworkBytes.value = {}
    cpuHistory.value = []
    memoryHistory.value = []
    // 重新初始化
    await initMetrics()
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.monitor-page { max-width: 1200px; margin: 0 auto; }

.page-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 2px; }
  .subtitle { color: var(--text-secondary); font-size: 12px; }
  .header-actions { display: flex; gap: 8px; }
}

.empty-state {
  display: flex; justify-content: center; align-items: center; min-height: 300px;
}

.overview-cards {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;
}

.ov-card {
  background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
  padding: 14px; display: flex; align-items: center; gap: 12px;

  .ov-icon {
    width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    &.cpu { background: rgba(99, 102, 241, 0.15); color: #6366f1; }
    &.memory { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    &.disk { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    &.network { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
  }

  .ov-info {
    flex: 1;
    .ov-value { font-size: 18px; font-weight: 600; }
    .ov-label { font-size: 12px; color: var(--text-secondary); }
  }

  .ov-chart {
    width: 60px; height: 30px;
    svg { width: 100%; height: 100%; }
  }
}

.charts-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
}

.chart-card {
  background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
  padding: 14px;

  .chart-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
    .chart-title { font-size: 14px; font-weight: 500; }
    .chart-value { font-size: 16px; font-weight: 600; color: var(--primary-color); }
  }

  .chart-body {
    height: 80px;
    .trend-chart { width: 100%; height: 100%; }
  }
}

.servers-detail {
  .section-header {
    margin-bottom: 12px;
    h2 { font-size: 15px; font-weight: 600; }
  }
}

.server-cards {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;
}

.srv-card {
  background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
  padding: 14px;

  .srv-header {
    display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
    .srv-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
    .srv-name { font-weight: 500; flex: 1; }
    .srv-host { font-size: 12px; color: var(--text-secondary); }
  }

  .srv-metrics {
    .srv-metric {
      margin-bottom: 10px;
      .sm-header {
        display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;
        span:first-child { color: var(--text-secondary); }
      }
    }
  }

  .srv-network {
    display: flex; gap: 16px; padding-top: 10px; border-top: 1px solid var(--border-color);
    .net-item {
      display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary);
    }
  }
}
</style>
