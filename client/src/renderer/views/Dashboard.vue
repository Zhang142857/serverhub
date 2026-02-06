<template>
  <div class="dashboard">
    <div class="dashboard-header animate-fade-in">
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
      <div class="stat-card animate-slide-up" :style="{ animationDelay: '0.1s' }" @click="$router.push('/servers')">
        <div class="stat-icon servers"><el-icon :size="22"><Monitor /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value"><AnimatedNumber :value="servers.length" /></div>
          <div class="stat-label">服务器</div>
        </div>
      </div>
      <div class="stat-card animate-slide-up" :style="{ animationDelay: '0.15s' }">
        <div class="stat-icon connected"><el-icon :size="22"><Connection /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value"><AnimatedNumber :value="connectedCount" /></div>
          <div class="stat-label">已连接</div>
        </div>
      </div>
      <div class="stat-card animate-slide-up" :style="{ animationDelay: '0.2s' }" @click="$router.push('/docker')">
        <div class="stat-icon containers"><el-icon :size="22"><Box /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value"><AnimatedNumber :value="containerStats.total" /></div>
          <div class="stat-label">容器</div>
        </div>
      </div>
      <div class="stat-card animate-slide-up" :style="{ animationDelay: '0.25s' }" @click="$router.push('/services')">
        <div class="stat-icon services"><el-icon :size="22"><Setting /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value"><AnimatedNumber :value="serviceStats.running" />/<AnimatedNumber :value="serviceStats.total" /></div>
          <div class="stat-label">服务</div>
        </div>
      </div>
      <div class="stat-card animate-slide-up" :style="{ animationDelay: '0.3s' }" @click="$router.push('/monitor')">
        <div class="stat-icon monitor"><el-icon :size="22"><DataLine /></el-icon></div>
        <div class="stat-info">
          <div class="stat-value"><AnimatedNumber :value="Math.round(avgCpu)" />%</div>
          <div class="stat-label">CPU</div>
        </div>
      </div>
    </div>

    <!-- 系统健康 -->
    <div class="health-row animate-fade-in" :style="{ animationDelay: '0.35s' }" v-if="connectedCount > 0">
      <div class="health-card">
        <div class="health-score" :class="healthStatus">
          <div class="score-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="6" opacity="0.15" />
              <circle 
                class="score-progress" 
                cx="50" cy="50" r="42" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="6"
                :stroke-dasharray="`${animatedHealthScore * 2.64} 264`" 
                stroke-linecap="round" 
                transform="rotate(-90 50 50)" 
              />
            </svg>
            <span class="score-num"><AnimatedNumber :value="healthScore" /></span>
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
        <div class="ql-item" v-for="(link, index) in quickLinks" :key="link.path" 
             :style="{ animationDelay: `${0.4 + index * 0.05}s` }"
             class="animate-scale-in"
             @click="$router.push(link.path)">
          <el-icon :size="20"><component :is="link.icon" /></el-icon>
          <span>{{ link.label }}</span>
        </div>
      </div>
    </div>

    <!-- 服务器列表 -->
    <div class="servers-section animate-fade-in" :style="{ animationDelay: '0.5s' }">
      <div class="section-header">
        <h2>服务器</h2>
        <el-button text size="small" @click="$router.push('/servers')">查看全部</el-button>
      </div>
      <div class="server-grid" v-if="servers.length > 0">
        <TransitionGroup name="server-list">
          <div v-for="(server, index) in servers.slice(0, 6)" :key="server.id" 
               class="server-card" :class="server.status" 
               :style="{ animationDelay: `${0.55 + index * 0.08}s` }"
               @click="goToServer(server)">
            <div class="sc-header">
              <span class="sc-dot" :class="[server.status, { pulse: server.status === 'connected' }]"></span>
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
              <span v-else-if="server.status === 'connecting'" class="st-ing">
                <el-icon class="is-loading"><Loading /></el-icon> 连接中
              </span>
              <span v-else class="st-off">未连接</span>
            </div>
          </div>
        </TransitionGroup>
      </div>
      <el-empty v-else description="暂无服务器" class="animate-fade-in">
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
import { ref, computed, onMounted, onUnmounted, watch, h, defineComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Monitor, Connection, Box, Setting, Plus, MoreFilled, Folder, ChatDotRound, DataLine, Link, Coin, Document, Bell, Loading } from '@element-plus/icons-vue'

// 数字动画组件
const AnimatedNumber = defineComponent({
  props: {
    value: { type: Number, default: 0 },
    duration: { type: Number, default: 500 }
  },
  setup(props) {
    const displayValue = ref(0)
    let animationFrame: number | null = null
    
    const animate = (from: number, to: number) => {
      const startTime = performance.now()
      const diff = to - from
      
      const step = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / props.duration, 1)
        const easeProgress = 1 - Math.pow(1 - progress, 3) // easeOutCubic
        displayValue.value = Math.round(from + diff * easeProgress)
        
        if (progress < 1) {
          animationFrame = requestAnimationFrame(step)
        }
      }
      
      if (animationFrame) cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(step)
    }
    
    watch(() => props.value, (newVal, oldVal) => {
      animate(oldVal || 0, newVal)
    }, { immediate: true })
    
    onUnmounted(() => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
    })
    
    return () => h('span', displayValue.value)
  }
})

const router = useRouter()
const serverStore = useServerStore()

const showAddServer = ref(false)
const adding = ref(false)
const newServer = ref({ name: '', host: '', port: 9527, token: '', useTls: false })

const metrics = ref<Record<string, { cpu: number; memory: number; disk: number }>>({})
const containerStats = ref({ total: 0, running: 0 })
const serviceStats = ref({ total: 0, running: 0 })
const cleanupFns = ref<Record<string, () => void>>({})
const animatedHealthScore = ref(0)

// 快速链接配置
const quickLinks = [
  { path: '/terminal', icon: Monitor, label: '终端' },
  { path: '/files', icon: Folder, label: '文件' },
  { path: '/docker', icon: Box, label: 'Docker' },
  { path: '/database', icon: Coin, label: '数据库' },
  { path: '/websites', icon: Link, label: '网站' },
  { path: '/logs', icon: Document, label: '日志' },
  { path: '/alerts', icon: Bell, label: '告警' },
  { path: '/ai', icon: ChatDotRound, label: 'AI' },
]

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

// 健康评分动画
watch(healthScore, (newVal) => {
  const startVal = animatedHealthScore.value
  const diff = newVal - startVal
  const duration = 800
  const startTime = performance.now()
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeProgress = 1 - Math.pow(1 - progress, 3)
    animatedHealthScore.value = startVal + diff * easeProgress
    
    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }
  
  requestAnimationFrame(animate)
}, { immediate: true })

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
      // 只统计根分区的磁盘占用，忽略 snap/loop 等虚拟挂载
      const rootDisk = info.disks?.find((d: any) => d.mountpoint === '/')
      const disk = rootDisk ? (rootDisk.used_percent || rootDisk.usedPercent || 0) : 0
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
// 动画关键帧
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { 
    opacity: 0; 
    transform: translateY(20px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

@keyframes scaleIn {
  from { 
    opacity: 0; 
    transform: scale(0.9); 
  }
  to { 
    opacity: 1; 
    transform: scale(1); 
  }
}

@keyframes pulse {
  0%, 100% { 
    opacity: 1;
    box-shadow: 0 0 0 0 currentColor;
  }
  50% { 
    opacity: 0.8;
    box-shadow: 0 0 0 4px transparent;
  }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px currentColor; }
  50% { box-shadow: 0 0 15px currentColor; }
}

// 动画类
.animate-fade-in {
  animation: fadeIn 0.5s ease-out both;
}

.animate-slide-up {
  animation: slideUp 0.5s ease-out both;
}

.animate-scale-in {
  animation: scaleIn 0.4s ease-out both;
}

// 列表过渡
.server-list-enter-active,
.server-list-leave-active {
  transition: all 0.4s ease;
}

.server-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.server-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  
  h1 {
    font-size: var(--text-xl);
    font-weight: 600;
    margin-bottom: 2px;
  }
  
  .subtitle {
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 8px 25px -5px rgba(99, 102, 241, 0.25);
    transform: translateY(-4px);
    
    .stat-icon {
      transform: scale(1.1);
    }
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s ease;
    
    &.servers {
      background: var(--primary-light);
      color: var(--primary-color);
    }
    &.connected {
      background: var(--success-light);
      color: var(--success-color);
    }
    &.containers {
      background: var(--info-light);
      color: var(--info-color);
    }
    &.services {
      background: var(--warning-light);
      color: var(--warning-color);
    }
    &.monitor {
      background: rgba(168, 85, 247, 0.15);
      color: #a855f7;
    }
  }

  .stat-value {
    font-size: var(--text-xl);
    font-weight: 600;
  }
  
  .stat-label {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
}

.health-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.health-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  gap: var(--space-5);

  .health-score {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    
    &.healthy { color: var(--success-color); }
    &.warning { color: var(--warning-color); }
    &.critical { color: var(--danger-color); }

    .score-ring {
      width: 72px;
      height: 72px;
      position: relative;
      
      svg {
        width: 100%;
        height: 100%;
      }
      
      .score-progress {
        transition: stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .score-num {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--text-xl);
        font-weight: 600;
      }
    }

    .health-label {
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }
    
    .health-status {
      font-size: var(--text-base);
      font-weight: 500;
      display: block;
      margin-top: 2px;
      
      &.healthy { color: var(--success-color); }
      &.warning { color: var(--warning-color); }
      &.critical { color: var(--danger-color); }
    }
  }

  .health-metrics {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-2);

    .hm-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      
      .hm-label {
        width: 36px;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      
      .el-progress {
        flex: 1;
      }
      
      .hm-value {
        width: 40px;
        font-size: var(--text-sm);
        text-align: right;
      }
    }
  }
}

.quick-links {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);

  .ql-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-2);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    
    &:hover {
      background: var(--bg-tertiary);
      color: var(--primary-color);
      transform: translateY(-2px);
      
      .el-icon {
        transform: scale(1.15);
      }
    }
    
    .el-icon {
      transition: transform 0.3s ease;
    }
    
    span {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      transition: color 0.3s ease;
    }
    
    &:hover span {
      color: var(--primary-color);
    }
  }
}

.servers-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
    
    h2 {
      font-size: var(--text-lg);
      font-weight: 600;
    }
  }
}

.server-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.server-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: slideUp 0.5s ease-out both;
  
  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.2);
    transform: translateY(-3px);
  }
  
  &.connected {
    border-left: 3px solid var(--success-color);
  }
  
  &.error {
    border-left: 3px solid var(--danger-color);
  }

  .sc-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    
    .sc-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      transition: all 0.3s ease;
      
      &.connected {
        background: var(--success-color);
        box-shadow: 0 0 6px var(--success-color);
        
        &.pulse {
          animation: glow 2s ease-in-out infinite;
        }
      }
      &.connecting {
        background: var(--warning-color);
        animation: pulse 1.5s ease-in-out infinite;
      }
      &.disconnected, &.error {
        background: var(--text-muted);
      }
    }
    
    .sc-name {
      flex: 1;
      font-weight: 500;
      font-size: var(--text-base);
    }
  }

  .sc-host {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
  }

  .sc-metrics {
    .scm-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
      
      span:first-child {
        width: 32px;
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      
      .el-progress {
        flex: 1;
      }
      
      span:last-child {
        width: 36px;
        font-size: var(--text-xs);
        text-align: right;
      }
    }
  }

  .sc-status {
    margin-top: var(--space-2);
    font-size: var(--text-sm);
    
    .st-ok {
      color: var(--success-color);
    }
    .st-ing {
      color: var(--warning-color);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      
      .is-loading {
        animation: spin 1s linear infinite;
      }
    }
    .st-off {
      color: var(--text-secondary);
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

:deep(.dark-dialog) {
  .el-dialog {
    background: var(--bg-secondary);
  }
  .el-dialog__header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }
  .el-dialog__body {
    background: var(--bg-secondary);
  }
  .el-dialog__footer {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
  }
}
</style>
