<template>
  <div class="cloudflare-page">
    <div class="page-header">
      <div class="header-left">
        <el-button text @click="$router.push('/cloud')">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <span class="provider-icon">☁️</span>
        <div>
          <h1>Cloudflare</h1>
          <p class="subtitle">DNS、CDN、SSL 和 Tunnel 管理</p>
        </div>
      </div>
      <div class="header-right">
        <el-button @click="showSettingsDialog" :type="apiConfigured ? '' : 'warning'">
          <el-icon><Setting /></el-icon>{{ apiConfigured ? '设置' : '配置 API' }}
        </el-button>
        <el-select v-model="selectedZone" placeholder="选择域名" @change="loadZoneData" :disabled="!apiConfigured">
          <el-option v-for="zone in zones" :key="zone.id" :label="zone.name" :value="zone.id" />
        </el-select>
        <el-button @click="refreshData" :loading="loading" :disabled="!apiConfigured">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <!-- 未配置 API 提示 -->
    <el-alert v-if="!apiConfigured" title="请先配置 Cloudflare API" type="warning" show-icon :closable="false" class="api-alert">
      <template #default>
        点击右上角"配置 API"按钮，输入您的 Cloudflare API 令牌以开始使用。
        <el-link type="primary" href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">获取 API 令牌</el-link>
      </template>
    </el-alert>

    <el-tabs v-model="activeTab">
      <!-- DNS 管理 -->
      <el-tab-pane label="DNS 记录" name="dns">
        <div class="tab-header">
          <el-input v-model="dnsSearch" placeholder="搜索记录..." class="search-input" clearable>
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" @click="showAddDnsDialog">
            <el-icon><Plus /></el-icon>添加记录
          </el-button>
        </div>
        <el-table :data="filteredDnsRecords" v-loading="loading" stripe>
          <el-table-column prop="type" label="类型" width="80">
            <template #default="{ row }">
              <el-tag size="small" :type="getDnsTypeColor(row.type)">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="200" show-overflow-tooltip />
          <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
          <el-table-column prop="ttl" label="TTL" width="100">
            <template #default="{ row }">{{ row.ttl === 1 ? '自动' : row.ttl + 's' }}</template>
          </el-table-column>
          <el-table-column prop="proxied" label="代理" width="80">
            <template #default="{ row }">
              <el-switch v-model="row.proxied" size="small" @change="updateDnsProxy(row)" :disabled="!canProxy(row.type)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" @click="editDnsRecord(row)">编辑</el-button>
              <el-button text size="small" type="danger" @click="deleteDnsRecord(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- SSL/TLS -->
      <el-tab-pane label="SSL/TLS" name="ssl">
        <div class="ssl-settings">
          <el-card class="setting-card">
            <template #header><span>加密模式</span></template>
            <el-radio-group v-model="sslMode" @change="updateSslMode">
              <el-radio-button label="off">关闭</el-radio-button>
              <el-radio-button label="flexible">灵活</el-radio-button>
              <el-radio-button label="full">完全</el-radio-button>
              <el-radio-button label="strict">完全（严格）</el-radio-button>
            </el-radio-group>
            <div class="mode-desc">
              <p v-if="sslMode === 'off'">不加密访问者与 Cloudflare 之间的流量</p>
              <p v-else-if="sslMode === 'flexible'">加密访问者与 Cloudflare 之间的流量</p>
              <p v-else-if="sslMode === 'full'">端到端加密，使用自签名证书</p>
              <p v-else>端到端加密，需要有效的 SSL 证书</p>
            </div>
          </el-card>
          <el-card class="setting-card">
            <template #header><span>始终使用 HTTPS</span></template>
            <el-switch v-model="alwaysHttps" @change="updateAlwaysHttps" />
            <p class="setting-desc">将所有 HTTP 请求重定向到 HTTPS</p>
          </el-card>
          <el-card class="setting-card">
            <template #header><span>最低 TLS 版本</span></template>
            <el-select v-model="minTlsVersion" @change="updateMinTls">
              <el-option label="TLS 1.0" value="1.0" />
              <el-option label="TLS 1.1" value="1.1" />
              <el-option label="TLS 1.2" value="1.2" />
              <el-option label="TLS 1.3" value="1.3" />
            </el-select>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- 缓存 -->
      <el-tab-pane label="缓存" name="cache">
        <div class="cache-section">
          <el-card class="action-card">
            <template #header><span>清除缓存</span></template>
            <div class="cache-actions">
              <el-button type="danger" @click="purgeAllCache" :loading="purging">清除所有缓存</el-button>
              <el-button @click="showPurgeUrlDialog">按 URL 清除</el-button>
            </div>
            <p class="action-desc">清除缓存后，Cloudflare 将从源服务器重新获取内容</p>
          </el-card>
          <el-card class="setting-card">
            <template #header><span>缓存级别</span></template>
            <el-select v-model="cacheLevel" @change="updateCacheLevel">
              <el-option label="绕过" value="bypass" />
              <el-option label="无查询字符串" value="simplified" />
              <el-option label="忽略查询字符串" value="basic" />
              <el-option label="标准" value="aggressive" />
            </el-select>
          </el-card>
          <el-card class="setting-card">
            <template #header><span>浏览器缓存 TTL</span></template>
            <el-select v-model="browserTtl" @change="updateBrowserTtl">
              <el-option label="遵循源服务器" :value="0" />
              <el-option label="2 小时" :value="7200" />
              <el-option label="1 天" :value="86400" />
              <el-option label="1 周" :value="604800" />
              <el-option label="1 个月" :value="2592000" />
            </el-select>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Tunnel -->
      <el-tab-pane label="Tunnel" name="tunnel">
        <div class="tab-header">
          <el-button type="primary" @click="showCreateTunnelDialog">
            <el-icon><Plus /></el-icon>创建 Tunnel
          </el-button>
        </div>
        <el-table :data="tunnels" v-loading="loading" stripe>
          <el-table-column prop="name" label="名称" min-width="150" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'healthy' ? 'success' : 'danger'" size="small">
                {{ row.status === 'healthy' ? '健康' : '离线' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="connections" label="连接数" width="100" />
          <el-table-column prop="created_at" label="创建时间" width="180">
            <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" @click="showTunnelConfig(row)">配置</el-button>
              <el-button text size="small" type="danger" @click="deleteTunnel(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="tunnels.length === 0 && !loading" description="暂无 Tunnel" />
      </el-tab-pane>
    </el-tabs>

    <!-- DNS 记录对话框 -->
    <el-dialog v-model="dnsDialogVisible" :title="editingDns ? '编辑 DNS 记录' : '添加 DNS 记录'" width="500px">
      <el-form :model="dnsForm" label-width="80px">
        <el-form-item label="类型">
          <el-select v-model="dnsForm.type" :disabled="!!editingDns">
            <el-option v-for="t in dnsTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="dnsForm.name" placeholder="@ 或子域名" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="dnsForm.content" :placeholder="getContentPlaceholder(dnsForm.type)" />
        </el-form-item>
        <el-form-item label="TTL">
          <el-select v-model="dnsForm.ttl">
            <el-option label="自动" :value="1" />
            <el-option label="1 分钟" :value="60" />
            <el-option label="5 分钟" :value="300" />
            <el-option label="1 小时" :value="3600" />
            <el-option label="1 天" :value="86400" />
          </el-select>
        </el-form-item>
        <el-form-item label="代理" v-if="canProxy(dnsForm.type)">
          <el-switch v-model="dnsForm.proxied" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dnsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDnsRecord" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 清除 URL 缓存对话框 -->
    <el-dialog v-model="purgeUrlDialogVisible" title="按 URL 清除缓存" width="500px">
      <el-input v-model="purgeUrls" type="textarea" :rows="5" placeholder="每行一个 URL" />
      <template #footer>
        <el-button @click="purgeUrlDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="purgeByUrls" :loading="purging">清除</el-button>
      </template>
    </el-dialog>

    <!-- 创建 Tunnel 对话框 -->
    <el-dialog v-model="tunnelDialogVisible" title="创建 Tunnel" width="500px">
      <el-form :model="tunnelForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="tunnelForm.name" placeholder="输入 Tunnel 名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tunnelDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createTunnel" :loading="saving">创建</el-button>
      </template>
    </el-dialog>

    <!-- Tunnel 配置对话框 -->
    <el-dialog v-model="tunnelConfigVisible" title="Tunnel 配置" width="600px">
      <div v-if="currentTunnel" class="tunnel-config">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="Tunnel ID">{{ currentTunnel.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ currentTunnel.name }}</el-descriptions-item>
        </el-descriptions>
        <div class="config-section">
          <h4>安装命令</h4>
          <el-input :value="getTunnelInstallCmd()" readonly>
            <template #append>
              <el-button @click="copyToClipboard(getTunnelInstallCmd())">复制</el-button>
            </template>
          </el-input>
        </div>
      </div>
    </el-dialog>

    <!-- API 设置对话框 -->
    <el-dialog v-model="settingsDialogVisible" title="Cloudflare API 设置" width="500px">
      <el-form :model="apiSettings" label-width="100px">
        <el-form-item label="API 令牌">
          <el-input v-model="apiSettings.apiToken" type="password" placeholder="输入 Cloudflare API 令牌" show-password />
        </el-form-item>
        <el-form-item label="账户 ID">
          <el-input v-model="apiSettings.accountId" placeholder="可选，用于 Tunnel 功能" />
        </el-form-item>
        <el-alert type="info" :closable="false" class="api-help">
          <template #title>如何获取 API 令牌</template>
          <ol>
            <li>登录 <el-link type="primary" href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">Cloudflare Dashboard</el-link></li>
            <li>点击 "Create Token"</li>
            <li>选择 "Edit zone DNS" 模板或自定义权限</li>
            <li>复制生成的令牌</li>
          </ol>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="settingsDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="clearApiSettings" v-if="apiConfigured">清除配置</el-button>
        <el-button type="primary" @click="saveApiSettings" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Refresh, Search, Plus, Setting } from '@element-plus/icons-vue'

const route = useRoute()

// Cloudflare API 基础 URL
const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

interface Zone { id: string; name: string; status: string }
interface DnsRecord { id: string; type: string; name: string; content: string; ttl: number; proxied: boolean; priority?: number }
interface Tunnel { id: string; name: string; status: string; connections: number; created_at: string }

const loading = ref(false)
const saving = ref(false)
const purging = ref(false)
const activeTab = ref('dns')
const selectedZone = ref('')
const dnsSearch = ref('')

// 数据
const zones = ref<Zone[]>([])
const dnsRecords = ref<DnsRecord[]>([])
const tunnels = ref<Tunnel[]>([])

// SSL 设置
const sslMode = ref('full')
const alwaysHttps = ref(true)
const minTlsVersion = ref('1.2')

// 缓存设置
const cacheLevel = ref('aggressive')
const browserTtl = ref(0)

// 对话框
const dnsDialogVisible = ref(false)
const purgeUrlDialogVisible = ref(false)
const tunnelDialogVisible = ref(false)
const tunnelConfigVisible = ref(false)
const settingsDialogVisible = ref(false)
const editingDns = ref<DnsRecord | null>(null)
const currentTunnel = ref<Tunnel | null>(null)
const purgeUrls = ref('')

// API 设置
const apiSettings = ref({
  apiToken: '',
  accountId: ''
})

const dnsTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SRV', 'CAA']
const dnsForm = ref({ type: 'A', name: '', content: '', ttl: 1, proxied: true, priority: 10 })
const tunnelForm = ref({ name: '' })

const filteredDnsRecords = computed(() => {
  if (!dnsSearch.value) return dnsRecords.value
  const q = dnsSearch.value.toLowerCase()
  return dnsRecords.value.filter(r =>
    r.name.toLowerCase().includes(q) || r.content.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
  )
})

const apiConfigured = computed(() => {
  return !!apiSettings.value.apiToken
})

// Cloudflare API 请求封装
async function cfRequest<T>(endpoint: string, options: {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: object
} = {}): Promise<{ success: boolean; result?: T; errors?: any[]; messages?: any[] }> {
  if (!apiSettings.value.apiToken) {
    throw new Error('API Token 未配置')
  }

  const response = await window.electronAPI.http.request({
    url: `${CF_API_BASE}${endpoint}`,
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${apiSettings.value.apiToken}`,
      'Content-Type': 'application/json'
    },
    body: options.body,
    timeout: 30000
  })

  if (!response.success) {
    throw new Error(response.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  const data = response.data
  if (!data.success) {
    const errorMsg = data.errors?.map((e: any) => e.message).join(', ') || '请求失败'
    throw new Error(errorMsg)
  }

  return data
}

onMounted(async () => {
  // Handle tab query parameter
  const tab = route.query.tab as string
  if (tab && ['dns', 'ssl', 'cache', 'tunnel'].includes(tab)) {
    activeTab.value = tab
  }
  // 从安全存储加载 API 设置
  await loadApiSettings()
  // 只有配置了 API 才加载数据
  if (apiConfigured.value) {
    loadZones()
  }
})

async function loadApiSettings() {
  try {
    const tokenResult = await window.electronAPI.secure.getCredential('cloudflare_api_token')
    const accountResult = await window.electronAPI.secure.getCredential('cloudflare_account_id')
    
    if (tokenResult.success && tokenResult.value) {
      apiSettings.value.apiToken = tokenResult.value
    }
    if (accountResult.success && accountResult.value) {
      apiSettings.value.accountId = accountResult.value
    }
  } catch (e) {
    console.error('Failed to load API settings:', e)
  }
}

async function loadZones() {
  loading.value = true
  try {
    const response = await cfRequest<Zone[]>('/zones')
    zones.value = response.result || []
    if (zones.value.length > 0) {
      selectedZone.value = zones.value[0].id
      await loadZoneData()
    }
  } catch (error) {
    ElMessage.error(`加载域名列表失败: ${(error as Error).message}`)
  } finally {
    loading.value = false
  }
}

async function loadZoneData() {
  if (!selectedZone.value) return
  loading.value = true
  try {
    await Promise.all([
      loadDnsRecords(),
      loadZoneSettings(),
      loadTunnels()
    ])
  } finally {
    loading.value = false
  }
}

async function loadDnsRecords() {
  try {
    const response = await cfRequest<DnsRecord[]>(`/zones/${selectedZone.value}/dns_records?per_page=100`)
    dnsRecords.value = response.result || []
  } catch (error) {
    ElMessage.error(`加载 DNS 记录失败: ${(error as Error).message}`)
  }
}

async function loadZoneSettings() {
  try {
    // 加载 SSL 设置
    const sslResponse = await cfRequest<{ value: string }>(`/zones/${selectedZone.value}/settings/ssl`)
    sslMode.value = sslResponse.result?.value || 'full'

    // 加载 Always HTTPS 设置
    const httpsResponse = await cfRequest<{ value: string }>(`/zones/${selectedZone.value}/settings/always_use_https`)
    alwaysHttps.value = httpsResponse.result?.value === 'on'

    // 加载最低 TLS 版本
    const tlsResponse = await cfRequest<{ value: string }>(`/zones/${selectedZone.value}/settings/min_tls_version`)
    minTlsVersion.value = tlsResponse.result?.value || '1.2'

    // 加载缓存级别
    const cacheResponse = await cfRequest<{ value: string }>(`/zones/${selectedZone.value}/settings/cache_level`)
    cacheLevel.value = cacheResponse.result?.value || 'aggressive'

    // 加载浏览器缓存 TTL
    const ttlResponse = await cfRequest<{ value: number }>(`/zones/${selectedZone.value}/settings/browser_cache_ttl`)
    browserTtl.value = ttlResponse.result?.value || 0
  } catch (error) {
    console.error('加载区域设置失败:', error)
  }
}

async function loadTunnels() {
  if (!apiSettings.value.accountId) {
    tunnels.value = []
    return
  }
  try {
    const response = await cfRequest<any[]>(`/accounts/${apiSettings.value.accountId}/cfd_tunnel`)
    tunnels.value = (response.result || []).map(t => ({
      id: t.id,
      name: t.name,
      status: t.status === 'healthy' ? 'healthy' : 'inactive',
      connections: t.connections?.length || 0,
      created_at: t.created_at
    }))
  } catch (error) {
    console.error('加载 Tunnel 失败:', error)
    tunnels.value = []
  }
}

function refreshData() { loadZoneData() }

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger' | undefined

function getDnsTypeColor(type: string): TagType {
  const colors: Record<string, TagType> = { A: 'primary', AAAA: 'primary', CNAME: 'success', MX: 'warning', TXT: 'info', NS: undefined, SRV: 'danger' }
  return colors[type] || undefined
}

function canProxy(type: string) { return ['A', 'AAAA', 'CNAME'].includes(type) }

function getContentPlaceholder(type: string) {
  const placeholders: Record<string, string> = {
    A: 'IPv4 地址', AAAA: 'IPv6 地址', CNAME: '目标域名', MX: '邮件服务器', TXT: '文本内容', NS: '名称服务器'
  }
  return placeholders[type] || '内容'
}

function showAddDnsDialog() {
  editingDns.value = null
  dnsForm.value = { type: 'A', name: '', content: '', ttl: 1, proxied: true, priority: 10 }
  dnsDialogVisible.value = true
}

function editDnsRecord(record: DnsRecord) {
  editingDns.value = record
  dnsForm.value = { ...record, priority: record.priority || 10 }
  dnsDialogVisible.value = true
}

async function saveDnsRecord() {
  if (!dnsForm.value.name || !dnsForm.value.content) {
    ElMessage.warning('请填写完整信息')
    return
  }
  saving.value = true
  try {
    const body: any = {
      type: dnsForm.value.type,
      name: dnsForm.value.name,
      content: dnsForm.value.content,
      ttl: dnsForm.value.ttl,
      proxied: canProxy(dnsForm.value.type) ? dnsForm.value.proxied : false
    }
    
    // MX 和 SRV 记录需要 priority
    if (['MX', 'SRV'].includes(dnsForm.value.type)) {
      body.priority = dnsForm.value.priority || 10
    }

    if (editingDns.value) {
      // 更新记录
      await cfRequest(`/zones/${selectedZone.value}/dns_records/${editingDns.value.id}`, {
        method: 'PATCH',
        body
      })
      ElMessage.success('DNS 记录已更新')
    } else {
      // 创建记录
      await cfRequest(`/zones/${selectedZone.value}/dns_records`, {
        method: 'POST',
        body
      })
      ElMessage.success('DNS 记录已添加')
    }
    dnsDialogVisible.value = false
    await loadDnsRecords()
  } catch (error) {
    ElMessage.error(`保存失败: ${(error as Error).message}`)
  } finally {
    saving.value = false
  }
}

async function deleteDnsRecord(record: DnsRecord) {
  await ElMessageBox.confirm(`确定删除 ${record.name} 的 ${record.type} 记录吗？`, '确认删除')
  try {
    await cfRequest(`/zones/${selectedZone.value}/dns_records/${record.id}`, {
      method: 'DELETE'
    })
    ElMessage.success('DNS 记录已删除')
    await loadDnsRecords()
  } catch (error) {
    ElMessage.error(`删除失败: ${(error as Error).message}`)
  }
}

async function updateDnsProxy(record: DnsRecord) {
  try {
    await cfRequest(`/zones/${selectedZone.value}/dns_records/${record.id}`, {
      method: 'PATCH',
      body: { proxied: record.proxied }
    })
    ElMessage.success(`${record.name} 代理状态已${record.proxied ? '开启' : '关闭'}`)
  } catch (error) {
    // 恢复原状态
    record.proxied = !record.proxied
    ElMessage.error(`更新失败: ${(error as Error).message}`)
  }
}

async function updateSslMode() {
  try {
    await cfRequest(`/zones/${selectedZone.value}/settings/ssl`, {
      method: 'PATCH',
      body: { value: sslMode.value }
    })
    ElMessage.success(`SSL 模式已更新为 ${sslMode.value}`)
  } catch (error) {
    ElMessage.error(`更新失败: ${(error as Error).message}`)
  }
}

async function updateAlwaysHttps() {
  try {
    await cfRequest(`/zones/${selectedZone.value}/settings/always_use_https`, {
      method: 'PATCH',
      body: { value: alwaysHttps.value ? 'on' : 'off' }
    })
    ElMessage.success(`始终使用 HTTPS 已${alwaysHttps.value ? '开启' : '关闭'}`)
  } catch (error) {
    ElMessage.error(`更新失败: ${(error as Error).message}`)
  }
}

async function updateMinTls() {
  try {
    await cfRequest(`/zones/${selectedZone.value}/settings/min_tls_version`, {
      method: 'PATCH',
      body: { value: minTlsVersion.value }
    })
    ElMessage.success(`最低 TLS 版本已更新为 ${minTlsVersion.value}`)
  } catch (error) {
    ElMessage.error(`更新失败: ${(error as Error).message}`)
  }
}

async function updateCacheLevel() {
  try {
    await cfRequest(`/zones/${selectedZone.value}/settings/cache_level`, {
      method: 'PATCH',
      body: { value: cacheLevel.value }
    })
    ElMessage.success('缓存级别已更新')
  } catch (error) {
    ElMessage.error(`更新失败: ${(error as Error).message}`)
  }
}

async function updateBrowserTtl() {
  try {
    await cfRequest(`/zones/${selectedZone.value}/settings/browser_cache_ttl`, {
      method: 'PATCH',
      body: { value: browserTtl.value }
    })
    ElMessage.success('浏览器缓存 TTL 已更新')
  } catch (error) {
    ElMessage.error(`更新失败: ${(error as Error).message}`)
  }
}

async function purgeAllCache() {
  await ElMessageBox.confirm('确定清除所有缓存吗？这可能会暂时影响网站性能。', '确认清除')
  purging.value = true
  try {
    await cfRequest(`/zones/${selectedZone.value}/purge_cache`, {
      method: 'POST',
      body: { purge_everything: true }
    })
    ElMessage.success('所有缓存已清除')
  } catch (error) {
    ElMessage.error(`清除失败: ${(error as Error).message}`)
  } finally {
    purging.value = false
  }
}

function showPurgeUrlDialog() {
  purgeUrls.value = ''
  purgeUrlDialogVisible.value = true
}

async function purgeByUrls() {
  if (!purgeUrls.value.trim()) {
    ElMessage.warning('请输入要清除的 URL')
    return
  }
  purging.value = true
  try {
    const files = purgeUrls.value.split('\n').map(u => u.trim()).filter(u => u)
    await cfRequest(`/zones/${selectedZone.value}/purge_cache`, {
      method: 'POST',
      body: { files }
    })
    ElMessage.success('指定 URL 缓存已清除')
    purgeUrlDialogVisible.value = false
  } catch (error) {
    ElMessage.error(`清除失败: ${(error as Error).message}`)
  } finally {
    purging.value = false
  }
}

function showCreateTunnelDialog() {
  if (!apiSettings.value.accountId) {
    ElMessage.warning('请先在设置中配置账户 ID 以使用 Tunnel 功能')
    return
  }
  tunnelForm.value = { name: '' }
  tunnelDialogVisible.value = true
}

async function createTunnel() {
  if (!tunnelForm.value.name) {
    ElMessage.warning('请输入 Tunnel 名称')
    return
  }
  if (!apiSettings.value.accountId) {
    ElMessage.warning('请先配置账户 ID')
    return
  }
  saving.value = true
  try {
    await cfRequest(`/accounts/${apiSettings.value.accountId}/cfd_tunnel`, {
      method: 'POST',
      body: {
        name: tunnelForm.value.name,
        tunnel_secret: btoa(crypto.getRandomValues(new Uint8Array(32)).toString())
      }
    })
    ElMessage.success('Tunnel 已创建')
    tunnelDialogVisible.value = false
    await loadTunnels()
  } catch (error) {
    ElMessage.error(`创建失败: ${(error as Error).message}`)
  } finally {
    saving.value = false
  }
}

function showTunnelConfig(tunnel: Tunnel) {
  currentTunnel.value = tunnel
  tunnelConfigVisible.value = true
}

async function deleteTunnel(tunnel: Tunnel) {
  await ElMessageBox.confirm(`确定删除 Tunnel "${tunnel.name}" 吗？`, '确认删除')
  try {
    await cfRequest(`/accounts/${apiSettings.value.accountId}/cfd_tunnel/${tunnel.id}`, {
      method: 'DELETE'
    })
    ElMessage.success('Tunnel 已删除')
    await loadTunnels()
  } catch (error) {
    ElMessage.error(`删除失败: ${(error as Error).message}`)
  }
}

function getTunnelInstallCmd() {
  return `cloudflared service install ${currentTunnel.value?.id || ''}`
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制到剪贴板')
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN')
}

// API 设置函数
function showSettingsDialog() {
  settingsDialogVisible.value = true
}

async function saveApiSettings() {
  if (!apiSettings.value.apiToken) {
    ElMessage.warning('请输入 API 令牌')
    return
  }
  saving.value = true
  try {
    // 验证 API Token
    const testResponse = await window.electronAPI.http.request({
      url: `${CF_API_BASE}/user/tokens/verify`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiSettings.value.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    })

    if (!testResponse.success || !testResponse.data?.success) {
      throw new Error('API 令牌验证失败，请检查令牌是否正确')
    }

    // 保存到安全存储
    await window.electronAPI.secure.setCredential('cloudflare_api_token', apiSettings.value.apiToken)
    if (apiSettings.value.accountId) {
      await window.electronAPI.secure.setCredential('cloudflare_account_id', apiSettings.value.accountId)
    }
    
    ElMessage.success('API 设置已保存')
    settingsDialogVisible.value = false
    // 重新加载数据
    await loadZones()
  } catch (error) {
    ElMessage.error(`保存失败: ${(error as Error).message}`)
  } finally {
    saving.value = false
  }
}

async function clearApiSettings() {
  try {
    await ElMessageBox.confirm('确定清除 API 配置吗？这将删除所有已保存的凭据。', '确认清除', {
      type: 'warning'
    })
    
    await window.electronAPI.secure.deleteCredential('cloudflare_api_token')
    await window.electronAPI.secure.deleteCredential('cloudflare_account_id')
    
    apiSettings.value = { apiToken: '', accountId: '' }
    zones.value = []
    dnsRecords.value = []
    tunnels.value = []
    selectedZone.value = ''
    settingsDialogVisible.value = false
    ElMessage.success('API 配置已清除')
  } catch {
    // 用户取消
  }
}
</script>

<style lang="scss" scoped>
.cloudflare-page { max-width: 1200px; margin: 0 auto; }

.page-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
  .header-left {
    display: flex; align-items: center; gap: 12px;
    .provider-icon { font-size: 32px; }
    h1 { font-size: 24px; font-weight: 600; margin: 0; }
    .subtitle { color: var(--text-secondary); font-size: 14px; margin: 0; }
  }
  .header-right { display: flex; gap: 12px; align-items: center; }
}

.api-alert { margin-bottom: 20px; }

.api-help { margin-top: 16px; ol { margin: 8px 0 0 16px; padding: 0; li { margin: 4px 0; } } }

.tab-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
  .search-input { width: 300px; }
}

.ssl-settings, .cache-section {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;
}

.setting-card, .action-card {
  .mode-desc, .setting-desc, .action-desc {
    margin-top: 12px; font-size: 13px; color: var(--text-secondary);
  }
  .cache-actions { display: flex; gap: 12px; }
}

.tunnel-config {
  .config-section { margin-top: 20px; h4 { margin-bottom: 8px; font-size: 14px; } }
}
</style>
