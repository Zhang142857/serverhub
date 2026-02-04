<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <h1>仪表盘</h1>
        <p class="subtitle">服务器状态概览</p>
      </div>
      <div class="header-right">
        <el-button type="primary" size="small" @click="showAddServer = true">
          <el-icon><Plus /></el-icon>添加服务器
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" @click="$router.push('/servers')">
        <div class="stat-icon servers"><el-icon :size="22"><Monitor /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ servers.length }}</div>
          <div class="stat-label">服务器</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon connected"><el-icon :size="22"><Connection /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ connectedCount }}</div>
          <div class="stat-label">已连接</div>
        </div>
      </div>
      <div class="stat-card" @click="$router.push('/docker')">
        <div class="stat-icon containers"><el-icon :size="22"><Box /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ containerStats.total }}</div>
          <div class="stat-label">容器</div>
        </div>
      </div>
      <div class="stat-card" @click="$router.push('/services')">
        <div class="stat-icon services"><el-icon :size="22"><Setting /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ serviceStats.running }}/{{ serviceStats.total }}</div>
          <div class="stat-label">服务</div>
        </div>
      </div>
      <div class="stat-card" @click="$router.push('/monitor')">
        <div class="stat-icon monitor"><el-icon :size="22"><DataLine /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value">{{ Math.round(avgCpu) }}%</div>
          <div class="stat-label">CPU</div>
        </div>
      </div>
    </div>

    <!-- 系统健康 -->
    <div class="health-row" v-if="connectedCount > 0">
      <div class="health-card">
        <div class="health-score" :class="healthStatus">
          <div class="score-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="6" opacity="0.15" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="6"
                :stroke-dasharray="`${healthScore * 2.64} 264`" stroke-linecap="round" transform="rotate(-90 50 50)" />
            </svg>
            <span class="score-num">{{ healthScore }}</span>
          </div>
          <div class="health-text">
            <span class="health-label">系统健康</span>
            <span class="health-status" :class="healthStatus">{{ healthStatusText }}</span>
          </div>
        </div>
        <div class="health-metrics">
          <div class="hm-item">
            <span class="hm-label">CPU</span>
            <el-progress :percentage="Math.round(avgCpu)" :stroke-width="6" :show-text="false" :color="getColor(avgCpu)" />
            <span class="hm-value">{{ avgCpu.toFixed(0) }}%</span>
          </div>
          <div class="hm-item">
            <span class="hm-label">内存</span>
            <el-progress :percentage="Math.round(avgMemory)" :stroke-width="6" :show-text="false" :color="getColor(avgMemory)" />
            <span class="hm-value">{{ avgMemory.toFixed(0) }}%</span>
          </div>
          <div class="hm-item">
            <span class="hm-label">磁盘</span>
            <el-progress :percentage="Math.round(avgDisk)" :stroke-width="6" :show-text="false" :color="getColor(avgDisk)" />
            <span class="hm-value">{{ avgDisk.toFixed(0) }}%</span>
          </div>
        </div>
      </div>
      <div class="quick-links">
        <div class="ql-item" @click="$router.push('/monitor')">
          <el-icon :size="20"><DataLine /></el-icon>
          <span>监控中心</span>
        </div>
        <div class="ql-item" @click="$router.push('/terminal')">
          <el-icon :size="20"><Monitor /></el-icon>
          <span>终端</span>
        </div>
        <div class="ql-item" @click="$router.push('/files')">
          <el-icon :size="20"><Folder /></el-icon>
          <span>文件</span>
        </div>
        <div class="ql-item" @click="$router.push('/docker')">
          <el-icon :size="20"><Box /></el-icon>
          <span>Docker</span>
        </div>
        <div class="ql-item" @click="$router.push('/websites')">
          <el-icon :size="20"><Link /></el-icon>
          <span>网站</span>
        </div>
        <div class="ql-item" @click="$router.push('/ai')">
          <el-icon :size="20"><ChatDotRound /></el-icon>
          <span>AI</span>
        </div>
      </div>
    </div>

    <!-- 服务器列表 -->
    <div class="servers-section">
      <div class="section-header">
        <h2>服务器</h2>
        <el-button text size="small" @click="$router.push('/servers')">查看全部</el-button>
      </div>
      <div class="server-grid" v-if="servers.length > 0">
        <div v-for="server in servers.slice(0, 6)" :key="server.id" class="server-card" :class="server.status" @click="goToServer(server)">
          <div class="sc-header">
            <span class="sc-dot" :class="server.status"></span>
            <span class="sc-name">{{ server.name }}</span>
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
          <div class="sc-host">{{ server.host }}:{{ server.port }}</div>
          <div class="sc-metrics" v-if="server.status === 'connected' && metrics[server.id]">
            <div class="scm-item">
              <span>CPU</span>
              <el-progress :percentage="metrics[server.id].cpu" :stroke-width="4" :show-text="false" :color="getColor(metrics[server.id].cpu)" />
              <span>{{ metrics[server.id].cpu.toFixed(0) }}%</span>
            </div>
            <div class="scm-item">
              <span>内存</span>
              <el-progress :percentage="metrics[server.id].memory" :stroke-width="4" :show-text="false" :color="getColor(metrics[server.id].memory)" />
              <span>{{ metrics[server.id].memory.toFixed(0) }}%</span>
            </div>
          </div>
          <div class="sc-status">
            <span v-if="server.status === 'connected'" class="st-ok">已连接</span>
            <span v-else-if="server.status === 'connecting'" class="st-ing">连接中</span>
            <span v-else class="st-off">未连接</span>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无服务器">
        <el-button type="primary" size="small" @click="showAddServer = true">添加服务器</el-button>
      </el-empty>
    </div>

    <!-- 添加服务器对话框 -->
    <el-dialog v-model="showAddServer" title="添加服务器" width="450px" class="dark-dialog">
      <el-form :model="newServer" label-width="70px" size="small">
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
        <el-form-item label="TLS">
          <el-switch v-model="newServer.useTls" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showAddServer = false">取消</el-button>
        <el-button type="primary" size="small" @click="addServer" :loading="adding">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Monitor, Connection, Box, Setting, Plus, MoreFilled, Folder, ChatDotRound, DataLine, Link } from '@element-plus/icons-vue'

const router = useRouter()
const serverStore = useServerStore()

const showAddServer = ref(false)
const adding = ref(false)
const newServer = ref({ name: '', host: '', port: 9527, token: '', useTls: false })

const metrics = ref<Record<string, { cpu: number; memory: number; disk: number }>>({})
const containerStats = ref({ total: 0, running: 0 })
const serviceStats = ref({ total: 0, running: 0 })
const cleanupFns = ref<Record<string, () => void>>({})

const servers = computed(() => serverStore.servers)
const connectedCount = computed(() => serverStore.connectedServers.length)

const avgCpu = computed(() => {
  const vals = Object.values(metrics.value)
  return vals.length ? vals.reduce((s, m) => s + m.cpu, 0) / vals.length : 0
})

const avgMemory = computed(() => {
  const vals = Object.values(metrics.value)
  return vals.length ? vals.reduce((s, m) => s + m.memory, 0) / vals.length : 0
})

const avgDisk = computed(() => {
  const vals = Object.values(metrics.value)
  return vals.length ? vals.reduce((s, m) => s + m.disk, 0) / vals.length : 0
})

const healthScore = computed(() => {
  if (!connectedCount.value) return 0
  const cpuScore = Math.max(0, 100 - avgCpu.value)
  const memScore = Math.max(0, 100 - avgMemory.value)
  const diskScore = Math.max(0, 100 - avgDisk.value)
  return Math.round((cpuScore + memScore + diskScore) / 3)
})

const healthStatus = computed(() => {
  if (healthScore.value >= 70) return 'healthy'
  if (healthScore.value >= 50) return 'warning'
  return 'critical'
})

const healthStatusText = computed(() => {
  if (healthStatus.value === 'healthy') return '良好'
  if (healthStatus.value === 'warning') return '警告'
  return '异常'
})

function getColor(v: number): string {
  if (v < 60) return '#22c55e'
  if (v < 80) return '#f59e0b'
  return '#ef4444'
}

onMounted(async () => {
  // 并行初始化，不阻塞
  initMetrics()
  loadStats()
})

onUnmounted(() => {
  Object.values(cleanupFns.value).forEach(fn => fn())
  cleanupFns.value = {}
})

async function initMetrics() {
  for (const server of serverStore.connectedServers) {
    startMetrics(server.id)
  }
}

async function startMetrics(serverId: string) {
  try {
    // 先获取系统信息设置初始值
    const info = await window.electronAPI.server.getSystemInfo(serverId)
    if (info) {
      const cpu = info.cpu?.usage ?? info.cpu?.usedPercent ?? 0
      const mem = info.memory?.usedPercent ?? info.memory?.used_percent ?? 0
      const disk = info.disks?.length ? info.disks.reduce((s: number, d: any) => s + (d.used_percent || d.usedPercent || 0), 0) / info.disks.length : 0
      metrics.value[serverId] = { cpu, memory: mem, disk }
    }

    // 启动指标流
    await window.electronAPI.server.startMetrics(serverId, 2)
    const cleanup = window.electronAPI.server.onMetrics(serverId, (m) => {
      const cpu = m.cpu_usage ?? 0
      const mem = m.memory_usage ?? 0
      const disk = metrics.value[serverId]?.disk ?? 0
      metrics.value[serverId] = { cpu, memory: mem, disk }
    })
    cleanupFns.value[serverId] = cleanup
  } catch (e) {
    console.error('Metrics error:', e)
  }
}

async function loadStats() {
  // 异步加载，不阻塞
  let containers = 0, running = 0, services = 0, activeServices = 0
  
  const promises = serverStore.connectedServers.map(async (server) => {
    try {
      const cr = await window.electronAPI.container.list(server.id, true)
      if (cr.containers) {
        containers += cr.containers.length
        cr.containers.forEach((c: any) => { if (c.state === 'running') running++ })
      }
    } catch {}
    try {
      const sr = await window.electronAPI.service.list(server.id)
      if (sr.services) {
        services += sr.services.length
        sr.services.forEach((s: any) => { if (s.status === 'running' || s.status === 'active') activeServices++ })
      }
    } catch {}
  })
  
  await Promise.all(promises)
  containerStats.value = { total: containers, running }
  serviceStats.value = { total: services, running: activeServices }
}

function goToServer(server: any) {
  if (server.status === 'connected') {
    serverStore.setCurrentServer(server.id)
    router.push(`/server/${server.id}`)
  }
}

async function handleServerAction(action: string, server: any) {
  if (action === 'connect') {
    try {
      await serverStore.connectServer(server.id)
      ElMessage.success('连接成功')
      startMetrics(server.id)
    } catch (e) {
      ElMessage.error('连接失败: ' + (e as Error).message)
    }
  } else if (action === 'disconnect') {
    await serverStore.disconnectServer(server.id)
    if (cleanupFns.value[server.id]) {
      cleanupFns.value[server.id]()
      delete cleanupFns.value[server.id]
    }
    delete metrics.value[server.id]
    ElMessage.success('已断开')
  } else if (action === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除服务器 ${server.name}？`, '确认', { type: 'warning' })
      serverStore.removeServer(server.id)
      ElMessage.success('已删除')
    } catch {}
  }
}

async function addServer() {
  if (!newServer.value.name || !newServer.value.host || !newServer.value.token) {
    ElMessage.warning('请填写必要信息')
    return
  }
  adding.value = true
  try {
    const id = serverStore.addServer({
      name: newServer.value.name,
      host: newServer.value.host,
      port: newServer.value.port,
      token: newServer.value.token,
      useTls: newServer.value.useTls
    })
    await serverStore.connectServer(id)
    ElMessage.success('服务器添加成功')
    showAddServer.value = false
    newServer.value = { name: '', host: '', port: 9527, token: '', useTls: false }
    startMetrics(id)
  } catch (e) {
    ElMessage.error('连接失败: ' + (e as Error).message)
  } finally {
    adding.value = false
  }
}
</script>

<style lang="scss" scoped>
.dashboard { max-width: 1200px; margin: 0 auto; }

.dashboard-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 2px; }
  .subtitle { color: var(--text-secondary); font-size: 12px; }
}

.stats-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px;
}

.stat-card {
  background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
  padding: 14px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: border-color 0.2s;
  &:hover { border-color: var(--primary-color); }

  .stat-icon {
    width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    &.servers { background: rgba(99, 102, 241, 0.15); color: #6366f1; }
    &.connected { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    &.containers { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    &.services { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    &.monitor { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
  }

  .stat-value { font-size: 20px; font-weight: 600; }
  .stat-label { font-size: 12px; color: var(--text-secondary); }
}

.health-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
}

.health-card {
  background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
  padding: 16px; display: flex; gap: 20px;

  .health-score {
    display: flex; align-items: center; gap: 12px;
    &.healthy { color: #22c55e; }
    &.warning { color: #f59e0b; }
    &.critical { color: #ef4444; }

    .score-ring {
      width: 70px; height: 70px; position: relative;
      svg { width: 100%; height: 100%; }
      .score-num {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        font-size: 20px; font-weight: 600;
      }
    }

    .health-label { font-size: 13px; color: var(--text-secondary); }
    .health-status { font-size: 14px; font-weight: 500; display: block; margin-top: 2px; }
  }

  .health-metrics {
    flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 8px;

    .hm-item {
      display: flex; align-items: center; gap: 8px;
      .hm-label { width: 32px; font-size: 12px; color: var(--text-secondary); }
      .el-progress { flex: 1; }
      .hm-value { width: 36px; font-size: 12px; text-align: right; }
    }
  }
}

.quick-links {
  background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
  padding: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;

  .ql-item {
    display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px;
    border-radius: 6px; cursor: pointer; transition: background 0.2s;
    &:hover { background: var(--bg-tertiary); }
    span { font-size: 12px; color: var(--text-secondary); }
  }
}

.servers-section {
  .section-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
    h2 { font-size: 15px; font-weight: 600; }
  }
}

.server-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
}

.server-card {
  background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
  padding: 14px; cursor: pointer; transition: border-color 0.2s;
  &:hover { border-color: var(--primary-color); }
  &.connected { border-left: 3px solid #22c55e; }
  &.error { border-left: 3px solid #ef4444; }

  .sc-header {
    display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
    .sc-dot {
      width: 8px; height: 8px; border-radius: 50%;
      &.connected { background: #22c55e; }
      &.connecting { background: #f59e0b; }
      &.disconnected, &.error { background: #6b7280; }
    }
    .sc-name { flex: 1; font-weight: 500; font-size: 14px; }
  }

  .sc-host { font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; }

  .sc-metrics {
    .scm-item {
      display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
      span:first-child { width: 28px; font-size: 11px; color: var(--text-secondary); }
      .el-progress { flex: 1; }
      span:last-child { width: 30px; font-size: 11px; text-align: right; }
    }
  }

  .sc-status {
    margin-top: 8px; font-size: 12px;
    .st-ok { color: #22c55e; }
    .st-ing { color: #f59e0b; }
    .st-off { color: var(--text-secondary); }
  }
}

:deep(.dark-dialog) {
  .el-dialog { background: var(--bg-secondary) !important; }
  .el-dialog__header { background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
  .el-dialog__body { background: var(--bg-secondary); }
  .el-dialog__footer { background: var(--bg-secondary); border-top: 1px solid var(--border-color); }
}
</style>
