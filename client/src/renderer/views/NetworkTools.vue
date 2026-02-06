<template>
  <div class="network-tools-page">
    <div class="page-header animate-fade-in">
      <div class="header-left">
        <h1>网络工具</h1>
        <p class="subtitle">网络诊断和测试工具</p>
      </div>
      <div class="header-right">
        <el-select v-model="selectedServer" placeholder="选择服务器" size="default" style="width: 180px">
          <el-option v-for="server in connectedServers" :key="server.id" :label="server.name" :value="server.id" />
        </el-select>
      </div>
    </div>

    <el-alert v-if="!selectedServer" title="请先选择一个已连接的服务器" type="warning" show-icon :closable="false" class="server-alert" />

    <div v-else class="tools-container">
      <!-- 工具选项卡 -->
      <el-tabs v-model="activeTab" class="tools-tabs animate-slide-up">
        <!-- Ping 测试 -->
        <el-tab-pane label="Ping 测试" name="ping">
          <div class="tool-card">
            <div class="tool-form">
              <el-input v-model="pingForm.host" placeholder="输入 IP 或域名" class="host-input" @keyup.enter="runPing">
                <template #prepend>目标主机</template>
              </el-input>
              <el-input-number v-model="pingForm.count" :min="1" :max="10" placeholder="次数" style="width: 120px" />
              <el-button type="primary" @click="runPing" :loading="pingLoading" :disabled="!pingForm.host">
                <el-icon><Position /></el-icon> 开始 Ping
              </el-button>
            </div>
            <div v-if="pingResult" class="tool-result animate-fade-in">
              <div class="result-header" :class="pingResult.reachable ? 'success' : 'error'">
                <el-icon v-if="pingResult.reachable"><CircleCheck /></el-icon>
                <el-icon v-else><CircleClose /></el-icon>
                <span>{{ pingResult.host }} {{ pingResult.reachable ? '可达' : '不可达' }}</span>
              </div>
              <div v-if="pingResult.reachable" class="result-stats">
                <div class="stat-item">
                  <span class="stat-label">发送</span>
                  <span class="stat-value">{{ pingResult.transmitted }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">接收</span>
                  <span class="stat-value">{{ pingResult.received }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">丢包率</span>
                  <span class="stat-value" :class="{ warning: pingResult.lossPercent > 0 }">{{ pingResult.lossPercent }}%</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">最小延迟</span>
                  <span class="stat-value">{{ pingResult.minRtt?.toFixed(2) || '-' }} ms</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">平均延迟</span>
                  <span class="stat-value highlight">{{ pingResult.avgRtt?.toFixed(2) || '-' }} ms</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">最大延迟</span>
                  <span class="stat-value">{{ pingResult.maxRtt?.toFixed(2) || '-' }} ms</span>
                </div>
              </div>
              <el-collapse v-if="pingResult.rawOutput" class="raw-output">
                <el-collapse-item title="原始输出">
                  <pre>{{ pingResult.rawOutput }}</pre>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </el-tab-pane>

        <!-- 端口扫描 -->
        <el-tab-pane label="端口扫描" name="port">
          <div class="tool-card">
            <div class="tool-form">
              <el-input v-model="portForm.host" placeholder="输入 IP 或域名" class="host-input">
                <template #prepend>目标主机</template>
              </el-input>
              <el-input v-model="portForm.ports" placeholder="如: 80,443 或 1-100" style="width: 200px">
                <template #prepend>端口</template>
              </el-input>
              <el-button type="primary" @click="runPortScan" :loading="portLoading" :disabled="!portForm.host || !portForm.ports">
                <el-icon><Search /></el-icon> 扫描
              </el-button>
            </div>
            <div class="quick-ports">
              <span>常用端口：</span>
              <el-tag v-for="preset in portPresets" :key="preset.label" @click="portForm.ports = preset.ports" class="port-tag">
                {{ preset.label }}
              </el-tag>
            </div>
            <div v-if="portResult" class="tool-result animate-fade-in">
              <div class="result-header">
                <span>扫描完成：{{ portResult.openCount }} 个端口开放</span>
              </div>
              <div v-if="portResult.openPorts?.length > 0" class="port-list">
                <div v-for="port in portResult.openPorts" :key="port.port" class="port-item open">
                  <el-icon><Unlock /></el-icon>
                  <span class="port-num">{{ port.port }}</span>
                  <span class="port-service">{{ port.service }}</span>
                </div>
              </div>
              <el-empty v-else description="未发现开放端口" :image-size="60" />
            </div>
          </div>
        </el-tab-pane>

        <!-- DNS 查询 -->
        <el-tab-pane label="DNS 查询" name="dns">
          <div class="tool-card">
            <div class="tool-form">
              <el-input v-model="dnsForm.domain" placeholder="输入域名" class="host-input" @keyup.enter="runDnsLookup">
                <template #prepend>域名</template>
              </el-input>
              <el-select v-model="dnsForm.type" style="width: 120px">
                <el-option v-for="t in dnsTypes" :key="t" :label="t" :value="t" />
              </el-select>
              <el-input v-model="dnsForm.server" placeholder="可选 DNS 服务器" style="width: 180px" clearable />
              <el-button type="primary" @click="runDnsLookup" :loading="dnsLoading" :disabled="!dnsForm.domain">
                <el-icon><Search /></el-icon> 查询
              </el-button>
            </div>
            <div v-if="dnsResult" class="tool-result animate-fade-in">
              <div class="result-header">
                <span>{{ dnsResult.domain }} 的 {{ dnsResult.type }} 记录</span>
              </div>
              <div v-if="dnsResult.records?.length > 0" class="dns-records">
                <div v-for="(record, index) in dnsResult.records" :key="index" class="dns-record">
                  <el-icon><Document /></el-icon>
                  <span>{{ record }}</span>
                  <el-button text size="small" @click="copyToClipboard(record)">
                    <el-icon><CopyDocument /></el-icon>
                  </el-button>
                </div>
              </div>
              <el-empty v-else description="未找到记录" :image-size="60" />
            </div>
          </div>
        </el-tab-pane>

        <!-- 路由追踪 -->
        <el-tab-pane label="路由追踪" name="traceroute">
          <div class="tool-card">
            <div class="tool-form">
              <el-input v-model="traceForm.host" placeholder="输入 IP 或域名" class="host-input" @keyup.enter="runTraceroute">
                <template #prepend>目标主机</template>
              </el-input>
              <el-input-number v-model="traceForm.maxHops" :min="5" :max="30" placeholder="最大跳数" style="width: 140px" />
              <el-button type="primary" @click="runTraceroute" :loading="traceLoading" :disabled="!traceForm.host">
                <el-icon><Position /></el-icon> 追踪
              </el-button>
            </div>
            <div v-if="traceResult" class="tool-result animate-fade-in">
              <div class="result-header">
                <span>到 {{ traceResult.host }} 的路由（{{ traceResult.totalHops }} 跳）</span>
              </div>
              <div class="trace-hops">
                <div v-for="hop in traceResult.hops" :key="hop.hop" class="trace-hop">
                  <span class="hop-num">{{ hop.hop }}</span>
                  <span class="hop-host">{{ hop.host }}</span>
                  <span class="hop-ip">{{ hop.ip }}</span>
                  <span class="hop-rtt">{{ hop.rtt }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 网络连接 -->
        <el-tab-pane label="网络连接" name="netstat">
          <div class="tool-card">
            <div class="tool-form">
              <el-select v-model="netstatForm.type" style="width: 150px">
                <el-option label="所有连接" value="all" />
                <el-option label="TCP 连接" value="tcp" />
                <el-option label="UDP 连接" value="udp" />
                <el-option label="监听端口" value="listening" />
              </el-select>
              <el-button type="primary" @click="runNetstat" :loading="netstatLoading">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
            </div>
            <div v-if="netstatResult" class="tool-result animate-fade-in">
              <div class="result-header">
                <span>共 {{ netstatResult.totalConnections }} 个连接</span>
              </div>
              <div class="netstat-stats">
                <div v-for="(count, state) in netstatResult.stats" :key="state" class="netstat-item" v-show="count > 0">
                  <span class="state-name">{{ state }}</span>
                  <span class="state-count">{{ count }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useServerStore } from '@/stores/server'
import { ElMessage } from 'element-plus'
import {
  Position, Search, Refresh, CircleCheck, CircleClose,
  Unlock, Document, CopyDocument
} from '@element-plus/icons-vue'

const serverStore = useServerStore()
const selectedServer = ref<string | null>(serverStore.currentServerId)
const activeTab = ref('ping')

const connectedServers = computed(() => serverStore.connectedServers)

// Ping
const pingForm = ref({ host: '', count: 4 })
const pingLoading = ref(false)
const pingResult = ref<any>(null)

// Port Scan
const portForm = ref({ host: '', ports: '22,80,443,3306,6379,8080' })
const portLoading = ref(false)
const portResult = ref<any>(null)
const portPresets = [
  { label: 'Web', ports: '80,443,8080,8443' },
  { label: '数据库', ports: '3306,5432,27017,6379' },
  { label: 'SSH/FTP', ports: '21,22,23' },
  { label: '常用', ports: '22,80,443,3306,6379,8080' },
  { label: '1-100', ports: '1-100' }
]

// DNS
const dnsForm = ref({ domain: '', type: 'A', server: '' })
const dnsLoading = ref(false)
const dnsResult = ref<any>(null)
const dnsTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA']

// Traceroute
const traceForm = ref({ host: '', maxHops: 20 })
const traceLoading = ref(false)
const traceResult = ref<any>(null)

// Netstat
const netstatForm = ref({ type: 'all' })
const netstatLoading = ref(false)
const netstatResult = ref<any>(null)

async function runPing() {
  if (!selectedServer.value || !pingForm.value.host) return
  pingLoading.value = true
  pingResult.value = null
  try {
    const result = await window.electronAPI.ai.executeTool('ping', {
      host: pingForm.value.host,
      count: pingForm.value.count
    }, selectedServer.value)
    if (result.success) {
      pingResult.value = result.data
    } else {
      ElMessage.error(result.error || 'Ping 失败')
    }
  } catch (e) {
    ElMessage.error('执行失败: ' + (e as Error).message)
  } finally {
    pingLoading.value = false
  }
}

async function runPortScan() {
  if (!selectedServer.value || !portForm.value.host || !portForm.value.ports) return
  portLoading.value = true
  portResult.value = null
  try {
    const result = await window.electronAPI.ai.executeTool('port_scan', {
      host: portForm.value.host,
      ports: portForm.value.ports
    }, selectedServer.value)
    if (result.success) {
      portResult.value = result.data
    } else {
      ElMessage.error(result.error || '端口扫描失败')
    }
  } catch (e) {
    ElMessage.error('执行失败: ' + (e as Error).message)
  } finally {
    portLoading.value = false
  }
}

async function runDnsLookup() {
  if (!selectedServer.value || !dnsForm.value.domain) return
  dnsLoading.value = true
  dnsResult.value = null
  try {
    const result = await window.electronAPI.ai.executeTool('dns_lookup', {
      domain: dnsForm.value.domain,
      type: dnsForm.value.type,
      server: dnsForm.value.server || undefined
    }, selectedServer.value)
    if (result.success) {
      dnsResult.value = result.data
    } else {
      ElMessage.error(result.error || 'DNS 查询失败')
    }
  } catch (e) {
    ElMessage.error('执行失败: ' + (e as Error).message)
  } finally {
    dnsLoading.value = false
  }
}

async function runTraceroute() {
  if (!selectedServer.value || !traceForm.value.host) return
  traceLoading.value = true
  traceResult.value = null
  try {
    const result = await window.electronAPI.ai.executeTool('traceroute', {
      host: traceForm.value.host,
      maxHops: traceForm.value.maxHops
    }, selectedServer.value)
    if (result.success) {
      traceResult.value = result.data
    } else {
      ElMessage.error(result.error || '路由追踪失败')
    }
  } catch (e) {
    ElMessage.error('执行失败: ' + (e as Error).message)
  } finally {
    traceLoading.value = false
  }
}

async function runNetstat() {
  if (!selectedServer.value) return
  netstatLoading.value = true
  netstatResult.value = null
  try {
    const result = await window.electronAPI.ai.executeTool('netstat', {
      type: netstatForm.value.type
    }, selectedServer.value)
    if (result.success) {
      netstatResult.value = result.data
    } else {
      ElMessage.error(result.error || '获取网络连接失败')
    }
  } catch (e) {
    ElMessage.error('执行失败: ' + (e as Error).message)
  } finally {
    netstatLoading.value = false
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制到剪贴板')
}

onMounted(() => {
  if (connectedServers.value.length > 0 && !selectedServer.value) {
    selectedServer.value = connectedServers.value[0].id
  }
})
</script>

<style lang="scss" scoped>
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in { animation: fadeIn 0.4s ease-out both; }
.animate-slide-up { animation: slideUp 0.5s ease-out both; }

.network-tools-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h1 { font-size: 24px; font-weight: 600; margin: 0; }
  .subtitle { color: var(--text-secondary); font-size: 14px; margin: 4px 0 0; }
}

.server-alert { margin-bottom: 20px; }

.tools-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 20px;
  }
  
  :deep(.el-tabs__item) {
    font-size: 15px;
  }
}

.tool-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
}

.tool-form {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;

  .host-input {
    flex: 1;
    min-width: 250px;
  }
}

.quick-ports {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  
  span { color: var(--text-secondary); font-size: 13px; }
  
  .port-tag {
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background: var(--primary-color);
      color: #fff;
      border-color: var(--primary-color);
    }
  }
}

.tool-result {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  
  &.success { color: var(--success-color); }
  &.error { color: var(--danger-color); }
  
  .el-icon { font-size: 20px; }
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  
  .stat-item {
    background: var(--bg-tertiary);
    padding: 16px;
    border-radius: 8px;
    text-align: center;
    transition: transform 0.2s;
    
    &:hover { transform: translateY(-2px); }
    
    .stat-label {
      display: block;
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
    
    .stat-value {
      font-size: 20px;
      font-weight: 600;
      
      &.highlight { color: var(--primary-color); }
      &.warning { color: var(--warning-color); }
    }
  }
}

.raw-output {
  margin-top: 16px;
  
  pre {
    background: var(--bg-tertiary);
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.port-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  
  .port-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    transition: all 0.2s;
    
    &:hover { transform: translateX(4px); }
    
    &.open {
      border-left: 3px solid var(--success-color);
      
      .el-icon { color: var(--success-color); }
    }
    
    .port-num {
      font-weight: 600;
      font-size: 16px;
    }
    
    .port-service {
      color: var(--text-secondary);
      font-size: 13px;
    }
  }
}

.dns-records {
  .dns-record {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    margin-bottom: 8px;
    transition: all 0.2s;
    
    &:hover { background: var(--bg-color); }
    
    .el-icon { color: var(--primary-color); }
    
    span { flex: 1; font-family: monospace; }
  }
}

.trace-hops {
  .trace-hop {
    display: grid;
    grid-template-columns: 40px 1fr 150px 100px;
    gap: 12px;
    padding: 10px 16px;
    background: var(--bg-tertiary);
    border-radius: 6px;
    margin-bottom: 6px;
    font-size: 13px;
    transition: all 0.2s;
    
    &:hover { background: var(--bg-color); }
    
    .hop-num {
      font-weight: 600;
      color: var(--primary-color);
    }
    
    .hop-host { font-weight: 500; }
    .hop-ip { color: var(--text-secondary); font-family: monospace; }
    .hop-rtt { text-align: right; color: var(--success-color); }
  }
}

.netstat-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  
  .netstat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    
    .state-name {
      font-size: 13px;
      color: var(--text-secondary);
    }
    
    .state-count {
      font-size: 18px;
      font-weight: 600;
      color: var(--primary-color);
    }
  }
}
</style>
