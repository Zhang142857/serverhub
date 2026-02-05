<template>
  <div class="ssl-page">
    <div class="page-header">
      <div class="header-left">
        <h1>SSL 证书管理</h1>
        <p class="subtitle">管理服务器上的 SSL/TLS 证书</p>
      </div>
      <div class="header-actions">
        <el-select v-if="hasMultipleServers" v-model="selectedServer" placeholder="选择服务器" size="small">
          <el-option v-for="s in connectedServers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button @click="loadCertificates" :loading="loading" size="small">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
        <el-button type="primary" @click="showRequestDialog = true" size="small">
          <el-icon><Plus /></el-icon>申请证书
        </el-button>
      </div>
    </div>

    <div v-if="!selectedServer" class="empty-state">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <div v-else-if="!certbotInstalled" class="empty-state">
      <el-empty description="Certbot 未安装">
        <el-button type="primary" @click="installCertbot" :loading="installing">安装 Certbot</el-button>
      </el-empty>
    </div>

    <template v-else>
      <!-- 证书概览 -->
      <div class="overview-cards">
        <div class="ov-card">
          <div class="ov-icon total"><el-icon :size="20"><Lock /></el-icon></div>
          <div class="ov-info">
            <div class="ov-value">{{ certificates.length }}</div>
            <div class="ov-label">证书总数</div>
          </div>
        </div>
        <div class="ov-card">
          <div class="ov-icon valid"><el-icon :size="20"><CircleCheck /></el-icon></div>
          <div class="ov-info">
            <div class="ov-value">{{ validCount }}</div>
            <div class="ov-label">有效证书</div>
          </div>
        </div>
        <div class="ov-card">
          <div class="ov-icon expiring"><el-icon :size="20"><Warning /></el-icon></div>
          <div class="ov-info">
            <div class="ov-value">{{ expiringCount }}</div>
            <div class="ov-label">即将过期</div>
          </div>
        </div>
        <div class="ov-card">
          <div class="ov-icon expired"><el-icon :size="20"><CircleClose /></el-icon></div>
          <div class="ov-info">
            <div class="ov-value">{{ expiredCount }}</div>
            <div class="ov-label">已过期</div>
          </div>
        </div>
      </div>

      <!-- 证书列表 -->
      <div class="cert-section">
        <div class="section-header">
          <h2>证书列表</h2>
          <el-input v-model="searchText" placeholder="搜索域名..." clearable style="width: 200px" size="small">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>

        <el-table :data="filteredCertificates" v-loading="loading" class="cert-table">
          <el-table-column label="域名" min-width="200">
            <template #default="{ row }">
              <div class="domain-cell">
                <el-icon class="lock-icon" :class="getStatusClass(row)"><Lock /></el-icon>
                <div class="domain-info">
                  <div class="domain-name">{{ row.domain }}</div>
                  <div class="domain-sans" v-if="row.sans && row.sans.length > 1">
                    +{{ row.sans.length - 1 }} 个域名
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row)" size="small">{{ getStatusLabel(row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="颁发机构" width="150">
            <template #default="{ row }">
              <span class="issuer">{{ row.issuer || "Let's Encrypt" }}</span>
            </template>
          </el-table-column>
          <el-table-column label="到期时间" width="180">
            <template #default="{ row }">
              <div class="expiry-cell">
                <span>{{ formatDate(row.expiry) }}</span>
                <span class="days-left" :class="getStatusClass(row)">
                  {{ getDaysLeft(row) }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button @click="viewCertificate(row)">详情</el-button>
                <el-button type="primary" @click="renewCertificate(row)" :loading="row.renewing">续期</el-button>
                <el-button type="danger" @click="revokeCertificate(row)">吊销</el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 自动续期设置 -->
      <div class="auto-renew-section">
        <div class="section-header">
          <h2>自动续期</h2>
        </div>
        <div class="auto-renew-card">
          <div class="renew-info">
            <el-icon :size="24"><Timer /></el-icon>
            <div class="renew-text">
              <div class="renew-title">Certbot 自动续期</div>
              <div class="renew-desc">系统会自动在证书到期前 30 天续期</div>
            </div>
          </div>
          <div class="renew-status">
            <el-tag :type="autoRenewEnabled ? 'success' : 'info'" size="small">
              {{ autoRenewEnabled ? '已启用' : '未启用' }}
            </el-tag>
            <el-button v-if="!autoRenewEnabled" type="primary" size="small" @click="enableAutoRenew">
              启用自动续期
            </el-button>
            <el-button v-else size="small" @click="testAutoRenew" :loading="testingRenew">
              测试续期
            </el-button>
          </div>
        </div>
      </div>
    </template>

    <!-- 申请证书对话框 -->
    <el-dialog v-model="showRequestDialog" title="申请 SSL 证书" width="550px" class="ssl-dialog">
      <el-form :model="requestForm" label-position="top" class="request-form">
        <el-form-item label="域名" required>
          <el-input v-model="requestForm.domain" placeholder="example.com 或 *.example.com">
            <template #prefix><el-icon><Link /></el-icon></template>
          </el-input>
          <div class="form-tip">支持单域名、多域名和通配符域名</div>
        </el-form-item>

        <el-form-item label="额外域名（可选）">
          <div class="extra-domains">
            <div v-for="(_, i) in requestForm.extraDomains" :key="i" class="extra-domain-row">
              <el-input v-model="requestForm.extraDomains[i]" placeholder="www.example.com" />
              <el-button text type="danger" @click="requestForm.extraDomains.splice(i, 1)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button text type="primary" @click="requestForm.extraDomains.push('')">
              <el-icon><Plus /></el-icon>添加域名
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="验证方式">
          <el-radio-group v-model="requestForm.challengeType">
            <el-radio value="http">HTTP 验证（推荐）</el-radio>
            <el-radio value="dns">DNS 验证（支持通配符）</el-radio>
          </el-radio-group>
          <div class="form-tip" v-if="requestForm.challengeType === 'http'">
            需要确保域名已解析到此服务器，且 80 端口可访问
          </div>
          <div class="form-tip" v-else>
            需要手动添加 DNS TXT 记录，适用于通配符证书
          </div>
        </el-form-item>

        <el-form-item label="邮箱（可选）">
          <el-input v-model="requestForm.email" placeholder="admin@example.com">
            <template #prefix><el-icon><Message /></el-icon></template>
          </el-input>
          <div class="form-tip">用于接收证书到期提醒</div>
        </el-form-item>

        <el-form-item label="Web 服务器">
          <el-radio-group v-model="requestForm.webserver">
            <el-radio value="nginx">Nginx（自动配置）</el-radio>
            <el-radio value="standalone">独立模式</el-radio>
            <el-radio value="webroot">Webroot 模式</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="requestForm.webserver === 'webroot'" label="Web 根目录">
          <el-input v-model="requestForm.webroot" placeholder="/var/www/html" />
        </el-form-item>
      </el-form>

      <div v-if="requestLog" class="request-log">
        <div class="log-header">申请日志</div>
        <pre>{{ requestLog }}</pre>
      </div>

      <template #footer>
        <el-button @click="showRequestDialog = false">取消</el-button>
        <el-button type="primary" @click="requestCertificate" :loading="requesting">
          <el-icon><Lock /></el-icon>申请证书
        </el-button>
      </template>
    </el-dialog>

    <!-- 证书详情对话框 -->
    <el-dialog v-model="showDetailDialog" :title="`证书详情 - ${currentCert?.domain}`" width="600px" class="ssl-dialog">
      <el-descriptions :column="1" border v-if="currentCert">
        <el-descriptions-item label="主域名">{{ currentCert.domain }}</el-descriptions-item>
        <el-descriptions-item label="备用域名" v-if="currentCert.sans?.length">
          <el-tag v-for="san in currentCert.sans" :key="san" size="small" style="margin-right: 4px;">{{ san }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="颁发机构">{{ currentCert.issuer || "Let's Encrypt" }}</el-descriptions-item>
        <el-descriptions-item label="颁发时间">{{ formatDate(currentCert.issued) }}</el-descriptions-item>
        <el-descriptions-item label="到期时间">
          {{ formatDate(currentCert.expiry) }}
          <el-tag :type="getStatusType(currentCert)" size="small" style="margin-left: 8px;">
            {{ getDaysLeft(currentCert) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="证书路径">
          <code>{{ currentCert.certPath }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="私钥路径">
          <code>{{ currentCert.keyPath }}</code>
        </el-descriptions-item>
      </el-descriptions>

      <div class="cert-paths" v-if="currentCert">
        <div class="paths-title">Nginx 配置示例</div>
        <pre class="nginx-config">ssl_certificate {{ currentCert.certPath }};
ssl_certificate_key {{ currentCert.keyPath }};</pre>
        <el-button size="small" @click="copyNginxConfig">
          <el-icon><CopyDocument /></el-icon>复制配置
        </el-button>
      </div>

      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button type="primary" @click="renewCertificate(currentCert!)" :loading="currentCert?.renewing">
          续期证书
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Refresh, Plus, Lock, CircleCheck, Warning, CircleClose, Search, 
  Timer, Link, Message, Delete, CopyDocument
} from '@element-plus/icons-vue'

interface Certificate {
  domain: string
  sans?: string[]
  issuer?: string
  issued?: number
  expiry: number
  certPath: string
  keyPath: string
  renewing?: boolean
}

const serverStore = useServerStore()
const selectedServer = ref<string | null>(null)
const loading = ref(false)
const installing = ref(false)
const requesting = ref(false)
const testingRenew = ref(false)
const certbotInstalled = ref(false)
const autoRenewEnabled = ref(false)
const certificates = ref<Certificate[]>([])
const searchText = ref('')

const showRequestDialog = ref(false)
const showDetailDialog = ref(false)
const currentCert = ref<Certificate | null>(null)
const requestLog = ref('')

const requestForm = ref({
  domain: '',
  extraDomains: [] as string[],
  challengeType: 'http',
  email: '',
  webserver: 'nginx',
  webroot: '/var/www/html'
})

const connectedServers = computed(() => serverStore.connectedServers)
const hasMultipleServers = computed(() => serverStore.hasMultipleServers)

const filteredCertificates = computed(() => {
  if (!searchText.value) return certificates.value
  const search = searchText.value.toLowerCase()
  return certificates.value.filter(c => 
    c.domain.toLowerCase().includes(search) ||
    c.sans?.some(s => s.toLowerCase().includes(search))
  )
})

const validCount = computed(() => certificates.value.filter(c => getDaysLeftNum(c) > 30).length)
const expiringCount = computed(() => certificates.value.filter(c => {
  const days = getDaysLeftNum(c)
  return days > 0 && days <= 30
}).length)
const expiredCount = computed(() => certificates.value.filter(c => getDaysLeftNum(c) <= 0).length)

watch(selectedServer, (val) => {
  if (val) checkCertbotAndLoad()
})

onMounted(() => {
  if (connectedServers.value.length > 0) {
    selectedServer.value = serverStore.currentServerId || connectedServers.value[0].id
  }
})

async function checkCertbotAndLoad() {
  if (!selectedServer.value) return
  loading.value = true
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'which certbot']
    )
    certbotInstalled.value = result.exit_code === 0
    if (certbotInstalled.value) {
      await loadCertificates()
      await checkAutoRenew()
    }
  } catch {
    certbotInstalled.value = false
  } finally {
    loading.value = false
  }
}

async function installCertbot() {
  if (!selectedServer.value) return
  installing.value = true
  try {
    ElMessage.info('正在安装 Certbot...')
    await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 
      'sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx']
    )
    certbotInstalled.value = true
    ElMessage.success('Certbot 安装成功')
    await loadCertificates()
  } catch (e) {
    ElMessage.error('安装失败: ' + (e as Error).message)
  } finally {
    installing.value = false
  }
}

async function loadCertificates() {
  if (!selectedServer.value) return
  loading.value = true
  try {
    // 获取证书列表
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'sudo certbot certificates 2>/dev/null']
    )
    
    certificates.value = parseCertbotOutput(result.stdout || '')
  } catch (e) {
    console.error('Load certificates error:', e)
  } finally {
    loading.value = false
  }
}

function parseCertbotOutput(output: string): Certificate[] {
  const certs: Certificate[] = []
  const blocks = output.split('Certificate Name:').slice(1)
  
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const cert: Certificate = {
      domain: lines[0]?.trim() || '',
      sans: [],
      expiry: 0,
      certPath: '',
      keyPath: ''
    }
    
    for (const line of lines) {
      if (line.includes('Domains:')) {
        cert.sans = line.split('Domains:')[1]?.trim().split(/\s+/) || []
      }
      if (line.includes('Expiry Date:')) {
        const dateStr = line.split('Expiry Date:')[1]?.trim().split(' ')[0]
        if (dateStr) {
          cert.expiry = new Date(dateStr).getTime()
        }
      }
      if (line.includes('Certificate Path:')) {
        cert.certPath = line.split('Certificate Path:')[1]?.trim() || ''
      }
      if (line.includes('Private Key Path:')) {
        cert.keyPath = line.split('Private Key Path:')[1]?.trim() || ''
      }
    }
    
    if (cert.domain) {
      certs.push(cert)
    }
  }
  
  return certs
}

async function checkAutoRenew() {
  if (!selectedServer.value) return
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'systemctl is-enabled certbot.timer 2>/dev/null || crontab -l 2>/dev/null | grep certbot']
    )
    autoRenewEnabled.value = result.exit_code === 0
  } catch {
    autoRenewEnabled.value = false
  }
}

async function enableAutoRenew() {
  if (!selectedServer.value) return
  try {
    // 尝试启用 systemd timer
    await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 
      'sudo systemctl enable certbot.timer && sudo systemctl start certbot.timer']
    )
    autoRenewEnabled.value = true
    ElMessage.success('自动续期已启用')
  } catch {
    // 如果 systemd timer 不可用，添加 cron job
    try {
      await window.electronAPI.server.executeCommand(
        selectedServer.value, 'bash', ['-c', 
        '(crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet") | crontab -']
      )
      autoRenewEnabled.value = true
      ElMessage.success('自动续期已启用（通过 Cron）')
    } catch (e) {
      ElMessage.error('启用失败: ' + (e as Error).message)
    }
  }
}

async function testAutoRenew() {
  if (!selectedServer.value) return
  testingRenew.value = true
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'sudo certbot renew --dry-run']
    )
    if (result.exit_code === 0) {
      ElMessage.success('续期测试成功')
    } else {
      ElMessage.warning('续期测试有问题: ' + (result.stderr || result.stdout))
    }
  } catch (e) {
    ElMessage.error('测试失败: ' + (e as Error).message)
  } finally {
    testingRenew.value = false
  }
}

async function requestCertificate() {
  if (!selectedServer.value || !requestForm.value.domain) return
  requesting.value = true
  requestLog.value = ''
  
  try {
    const domains = [requestForm.value.domain, ...requestForm.value.extraDomains.filter(d => d)]
    const domainArgs = domains.map(d => `-d ${d}`).join(' ')
    
    let cmd = 'sudo certbot certonly'
    
    if (requestForm.value.webserver === 'nginx') {
      cmd = 'sudo certbot --nginx'
    } else if (requestForm.value.webserver === 'standalone') {
      cmd += ' --standalone'
    } else if (requestForm.value.webserver === 'webroot') {
      cmd += ` --webroot -w ${requestForm.value.webroot}`
    }
    
    cmd += ` ${domainArgs} --non-interactive --agree-tos`
    
    if (requestForm.value.email) {
      cmd += ` --email ${requestForm.value.email}`
    } else {
      cmd += ' --register-unsafely-without-email'
    }
    
    if (requestForm.value.challengeType === 'dns') {
      cmd += ' --preferred-challenges dns'
    }
    
    // 添加 --redirect 自动配置 HTTPS 重定向
    if (requestForm.value.webserver === 'nginx') {
      cmd += ' --redirect'
    }
    
    requestLog.value = `执行命令: ${cmd}\n\n`
    
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', cmd]
    )
    
    requestLog.value += result.stdout || ''
    requestLog.value += result.stderr || ''
    
    if (result.exit_code === 0) {
      ElMessage.success('证书申请成功！')
      await loadCertificates()
      // 不关闭对话框，让用户看到结果
    } else {
      // 解析错误
      const output = (result.stderr || result.stdout || '').toLowerCase()
      if (output.includes('dns problem') || output.includes('nxdomain')) {
        ElMessage.error('申请失败: 域名 DNS 未正确解析到此服务器')
      } else if (output.includes('connection refused') || output.includes('port 80')) {
        ElMessage.error('申请失败: 80 端口无法访问，请检查防火墙')
      } else if (output.includes('too many')) {
        ElMessage.error('申请失败: 申请次数过多，请稍后再试')
      } else {
        ElMessage.error('申请失败，请查看日志')
      }
    }
  } catch (e) {
    requestLog.value += '\n错误: ' + (e as Error).message
    ElMessage.error('申请失败: ' + (e as Error).message)
  } finally {
    requesting.value = false
  }
}

async function renewCertificate(cert: Certificate) {
  if (!selectedServer.value) return
  cert.renewing = true
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', `sudo certbot renew --cert-name ${cert.domain} --force-renewal`]
    )
    if (result.exit_code === 0) {
      ElMessage.success('证书续期成功')
      await loadCertificates()
    } else {
      ElMessage.error('续期失败: ' + (result.stderr || result.stdout))
    }
  } catch (e) {
    ElMessage.error('续期失败: ' + (e as Error).message)
  } finally {
    cert.renewing = false
  }
}

async function revokeCertificate(cert: Certificate) {
  if (!selectedServer.value) return
  try {
    await ElMessageBox.confirm(
      `确定要吊销证书 ${cert.domain} 吗？吊销后将无法恢复。`,
      '确认吊销',
      { type: 'warning' }
    )
  } catch { return }
  
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 
      `sudo certbot revoke --cert-name ${cert.domain} --non-interactive && sudo certbot delete --cert-name ${cert.domain} --non-interactive`]
    )
    if (result.exit_code === 0) {
      ElMessage.success('证书已吊销')
      await loadCertificates()
    } else {
      ElMessage.error('吊销失败: ' + (result.stderr || result.stdout))
    }
  } catch (e) {
    ElMessage.error('吊销失败: ' + (e as Error).message)
  }
}

function viewCertificate(cert: Certificate) {
  currentCert.value = cert
  showDetailDialog.value = true
}

function copyNginxConfig() {
  if (!currentCert.value) return
  const config = `ssl_certificate ${currentCert.value.certPath};
ssl_certificate_key ${currentCert.value.keyPath};`
  navigator.clipboard.writeText(config)
  ElMessage.success('已复制')
}

function getDaysLeftNum(cert: Certificate): number {
  return Math.ceil((cert.expiry - Date.now()) / (1000 * 60 * 60 * 24))
}

function getDaysLeft(cert: Certificate): string {
  const days = getDaysLeftNum(cert)
  if (days < 0) return `已过期 ${Math.abs(days)} 天`
  if (days === 0) return '今天过期'
  return `${days} 天后过期`
}

function getStatusClass(cert: Certificate): string {
  const days = getDaysLeftNum(cert)
  if (days <= 0) return 'expired'
  if (days <= 30) return 'expiring'
  return 'valid'
}

function getStatusType(cert: Certificate): 'success' | 'warning' | 'danger' {
  const days = getDaysLeftNum(cert)
  if (days <= 0) return 'danger'
  if (days <= 30) return 'warning'
  return 'success'
}

function getStatusLabel(cert: Certificate): string {
  const days = getDaysLeftNum(cert)
  if (days <= 0) return '已过期'
  if (days <= 30) return '即将过期'
  return '有效'
}

function formatDate(ts?: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  })
}
</script>

<style lang="scss" scoped>
.ssl-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-left {
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { color: var(--text-secondary); font-size: 13px; }
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.ov-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;

  .ov-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;

    &.total { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
    &.valid { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
    &.expiring { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
    &.expired { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
  }

  .ov-info {
    .ov-value { font-size: 24px; font-weight: 600; }
    .ov-label { font-size: 12px; color: var(--text-secondary); }
  }
}

.cert-section, .auto-renew-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h2 { font-size: 16px; font-weight: 600; margin: 0; }
}

.cert-table {
  .domain-cell {
    display: flex;
    align-items: center;
    gap: 10px;

    .lock-icon {
      font-size: 18px;
      &.valid { color: #22c55e; }
      &.expiring { color: #f59e0b; }
      &.expired { color: #ef4444; }
    }

    .domain-name { font-weight: 500; }
    .domain-sans { font-size: 12px; color: var(--text-secondary); }
  }

  .issuer { color: var(--text-secondary); font-size: 13px; }

  .expiry-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .days-left {
      font-size: 12px;
      &.valid { color: #22c55e; }
      &.expiring { color: #f59e0b; }
      &.expired { color: #ef4444; }
    }
  }
}

.auto-renew-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;

  .renew-info {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text-secondary);

    .renew-title { font-weight: 500; color: var(--text-color); }
    .renew-desc { font-size: 13px; }
  }

  .renew-status {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.ssl-dialog {
  .request-form {
    .form-tip {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .extra-domains {
      .extra-domain-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
    }
  }

  .request-log {
    margin-top: 16px;
    background: var(--bg-tertiary);
    border-radius: 6px;
    padding: 12px;

    .log-header {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    pre {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      line-height: 1.5;
      max-height: 200px;
      overflow: auto;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }

  .cert-paths {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);

    .paths-title {
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .nginx-config {
      background: var(--bg-tertiary);
      padding: 12px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      margin-bottom: 8px;
    }
  }
}

@media (max-width: 900px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
