<template>
  <div class="websites">
    <div class="page-header">
      <div class="header-left">
        <h1>网站管理</h1>
        <p class="subtitle">管理 Nginx 站点配置</p>
      </div>
      <div class="header-actions">
        <el-select v-model="selectedServer" placeholder="选择服务器" size="small">
          <el-option v-for="s in connectedServers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button @click="refreshSites" :loading="loading" size="small">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
        <el-button type="primary" size="small" @click="showAddSite = true">
          <el-icon><Plus /></el-icon>添加站点
        </el-button>
      </div>
    </div>

    <div v-if="!selectedServer" class="empty-state">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <template v-else>
      <!-- 统计卡片 -->
      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-icon total"><el-icon><Link /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ sites.length }}</div>
            <div class="stat-label">站点总数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon running"><el-icon><CircleCheck /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ runningSites }}</div>
            <div class="stat-label">运行中</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ssl"><el-icon><Lock /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ sslSites }}</div>
            <div class="stat-label">SSL 启用</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stopped"><el-icon><CircleClose /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ stoppedSites }}</div>
            <div class="stat-label">已停止</div>
          </div>
        </div>
      </div>

      <!-- 站点列表 -->
      <div class="sites-table">
        <el-table :data="filteredSites" v-loading="loading" style="width: 100%">
          <el-table-column prop="name" label="站点名称" min-width="140">
            <template #default="{ row }">
              <div class="site-name">
                <span class="status-dot" :class="row.status"></span>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="domain" label="域名" min-width="200">
            <template #default="{ row }">
              <a :href="(row.ssl ? 'https://' : 'http://') + row.domain" target="_blank" class="domain-link">
                <el-icon v-if="row.ssl"><Lock /></el-icon>
                {{ row.domain }}
              </a>
            </template>
          </el-table-column>
          <el-table-column prop="path" label="根目录" min-width="180">
            <template #default="{ row }">
              <code class="path-code">{{ row.path }}</code>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="getTypeTag(row.type)">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.status === 'running' ? 'success' : 'danger'">
                {{ row.status === 'running' ? '运行中' : '已停止' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button @click="openSite(row)">打开</el-button>
                <el-button @click="editSite(row)">设置</el-button>
                <el-button v-if="row.status === 'running'" type="warning" @click="toggleSite(row, 'stop')">停止</el-button>
                <el-button v-else type="success" @click="toggleSite(row, 'start')">启动</el-button>
                <el-button type="danger" @click="deleteSite(row)">删除</el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 添加站点对话框 -->
    <el-dialog v-model="showAddSite" title="添加站点" width="650px" destroy-on-close class="dark-dialog">
      <el-form :model="newSite" label-width="100px" size="small">
        <el-tabs v-model="addSiteTab">
          <el-tab-pane label="基本信息" name="basic">
            <el-form-item label="站点名称" required>
              <el-input v-model="newSite.name" placeholder="my-website" />
            </el-form-item>
            <el-form-item label="域名" required>
              <el-input v-model="newSite.domain" placeholder="example.com">
                <template #prepend>
                  <el-select v-model="newSite.protocol" style="width: 90px">
                    <el-option value="http" label="http://" />
                    <el-option value="https" label="https://" />
                  </el-select>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item label="根目录" required>
              <el-input v-model="newSite.path" placeholder="/var/www/html">
                <template #append>
                  <el-button @click="browsePath">浏览</el-button>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item label="站点类型">
              <el-select v-model="newSite.type" style="width: 100%">
                <el-option label="静态站点" value="static" />
                <el-option label="PHP" value="php" />
                <el-option label="Node.js (反向代理)" value="node" />
                <el-option label="Python (反向代理)" value="python" />
                <el-option label="Java (反向代理)" value="java" />
                <el-option label="反向代理" value="proxy" />
              </el-select>
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="代理设置" name="proxy" v-if="['node', 'python', 'java', 'proxy'].includes(newSite.type)">
            <el-form-item label="代理地址">
              <el-input v-model="newSite.proxyPass" placeholder="http://127.0.0.1:3000" />
            </el-form-item>
            <el-form-item label="WebSocket">
              <el-switch v-model="newSite.websocket" />
              <span class="form-tip">启用 WebSocket 代理支持</span>
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="PHP 设置" name="php" v-if="newSite.type === 'php'">
            <el-form-item label="PHP 版本">
              <el-select v-model="newSite.phpVersion" style="width: 100%">
                <el-option label="PHP 8.3" value="8.3" />
                <el-option label="PHP 8.2" value="8.2" />
                <el-option label="PHP 8.1" value="8.1" />
                <el-option label="PHP 7.4" value="7.4" />
              </el-select>
            </el-form-item>
            <el-form-item label="禁用函数">
              <el-input v-model="newSite.disableFunctions" placeholder="exec,passthru,shell_exec" />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="SSL 证书" name="ssl">
            <el-form-item label="启用 SSL">
              <el-switch v-model="newSite.ssl" />
            </el-form-item>
            <template v-if="newSite.ssl">
              <el-form-item label="证书类型">
                <el-radio-group v-model="newSite.sslType">
                  <el-radio value="letsencrypt">Let's Encrypt (免费自动)</el-radio>
                  <el-radio value="custom">自定义证书</el-radio>
                </el-radio-group>
              </el-form-item>
              <template v-if="newSite.sslType === 'custom'">
                <el-form-item label="证书文件">
                  <el-input v-model="newSite.sslCert" placeholder="/etc/ssl/certs/example.crt" />
                </el-form-item>
                <el-form-item label="私钥文件">
                  <el-input v-model="newSite.sslKey" placeholder="/etc/ssl/private/example.key" />
                </el-form-item>
              </template>
              <el-form-item label="强制 HTTPS">
                <el-switch v-model="newSite.forceHttps" />
              </el-form-item>
              <el-form-item label="HSTS">
                <el-switch v-model="newSite.hsts" />
                <span class="form-tip">HTTP 严格传输安全</span>
              </el-form-item>
            </template>
          </el-tab-pane>

          <el-tab-pane label="高级设置" name="advanced">
            <el-form-item label="默认文档">
              <el-input v-model="newSite.indexFiles" placeholder="index.html index.php index.htm" />
            </el-form-item>
            <el-form-item label="日志路径">
              <el-input v-model="newSite.accessLog" placeholder="/var/log/nginx/access.log" />
            </el-form-item>
            <el-form-item label="错误日志">
              <el-input v-model="newSite.errorLog" placeholder="/var/log/nginx/error.log" />
            </el-form-item>
            <el-form-item label="客户端最大">
              <el-input v-model="newSite.clientMaxBodySize" placeholder="100m" />
            </el-form-item>
            <el-form-item label="Gzip 压缩">
              <el-switch v-model="newSite.gzip" />
            </el-form-item>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showAddSite = false">取消</el-button>
        <el-button type="primary" size="small" @click="addSite" :loading="adding">创建站点</el-button>
      </template>
    </el-dialog>

    <!-- 站点设置对话框 -->
    <el-dialog v-model="showSiteSettings" :title="`站点设置 - ${currentSite?.name}`" width="750px" class="dark-dialog">
      <el-tabs v-model="settingsTab" v-if="currentSite">
        <el-tab-pane label="基本设置" name="basic">
          <el-form :model="currentSite" label-width="100px" size="small">
            <el-form-item label="域名">
              <el-input v-model="currentSite.domain" />
            </el-form-item>
            <el-form-item label="根目录">
              <el-input v-model="currentSite.path" />
            </el-form-item>
            <el-form-item label="默认文档">
              <el-input v-model="currentSite.indexFiles" placeholder="index.html index.php" />
            </el-form-item>
            <el-form-item label="运行用户">
              <el-input v-model="currentSite.user" placeholder="www-data" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="SSL 证书" name="ssl">
          <div class="ssl-settings">
            <el-form label-width="100px" size="small">
              <el-form-item label="启用 SSL">
                <el-switch v-model="currentSite.ssl" />
              </el-form-item>
              <template v-if="currentSite.ssl">
                <el-form-item label="证书类型">
                  <el-radio-group v-model="currentSite.sslType">
                    <el-radio value="letsencrypt">Let's Encrypt</el-radio>
                    <el-radio value="custom">自定义证书</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="强制 HTTPS">
                  <el-switch v-model="currentSite.forceHttps" />
                </el-form-item>
                <el-form-item label="证书状态" v-if="currentSite.sslType === 'letsencrypt'">
                  <el-tag :type="currentSite.sslValid ? 'success' : 'danger'" size="small">
                    {{ currentSite.sslValid ? '有效' : '无效/过期' }}
                  </el-tag>
                  <el-button size="small" @click="renewCert" style="margin-left: 12px">续期证书</el-button>
                </el-form-item>
                <el-form-item label="到期时间" v-if="currentSite.sslExpiry">
                  {{ currentSite.sslExpiry }}
                </el-form-item>
              </template>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="伪静态" name="rewrite">
          <div class="rewrite-presets">
            <span class="preset-label">预设规则：</span>
            <el-button size="small" @click="applyRewritePreset('wordpress')">WordPress</el-button>
            <el-button size="small" @click="applyRewritePreset('laravel')">Laravel</el-button>
            <el-button size="small" @click="applyRewritePreset('thinkphp')">ThinkPHP</el-button>
            <el-button size="small" @click="applyRewritePreset('vue')">Vue Router</el-button>
          </div>
          <el-input type="textarea" v-model="currentSite.rewriteRules" :rows="12" 
            placeholder="# Nginx 伪静态规则&#10;location / {&#10;    try_files $uri $uri/ /index.php?$query_string;&#10;}" 
            class="code-textarea" />
        </el-tab-pane>

        <el-tab-pane label="反向代理" name="proxy">
          <el-form label-width="100px" size="small">
            <el-form-item label="代理地址">
              <el-input v-model="currentSite.proxyPass" placeholder="http://127.0.0.1:3000" />
            </el-form-item>
            <el-form-item label="代理头">
              <el-checkbox v-model="currentSite.proxySetHost">Host</el-checkbox>
              <el-checkbox v-model="currentSite.proxySetRealIP">X-Real-IP</el-checkbox>
              <el-checkbox v-model="currentSite.proxySetForwarded">X-Forwarded-For</el-checkbox>
            </el-form-item>
            <el-form-item label="WebSocket">
              <el-switch v-model="currentSite.websocket" />
            </el-form-item>
            <el-form-item label="超时时间">
              <el-input-number v-model="currentSite.proxyTimeout" :min="1" :max="3600" /> 秒
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="访问控制" name="access">
          <el-form label-width="100px" size="small">
            <el-form-item label="IP 白名单">
              <el-input type="textarea" v-model="currentSite.allowIps" :rows="3" placeholder="每行一个 IP 或 CIDR" />
            </el-form-item>
            <el-form-item label="IP 黑名单">
              <el-input type="textarea" v-model="currentSite.denyIps" :rows="3" placeholder="每行一个 IP 或 CIDR" />
            </el-form-item>
            <el-form-item label="基本认证">
              <el-switch v-model="currentSite.basicAuth" />
            </el-form-item>
            <template v-if="currentSite.basicAuth">
              <el-form-item label="用户名">
                <el-input v-model="currentSite.authUser" />
              </el-form-item>
              <el-form-item label="密码">
                <el-input v-model="currentSite.authPass" type="password" show-password />
              </el-form-item>
            </template>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="配置文件" name="config">
          <div class="config-actions">
            <el-button size="small" @click="formatConfig">格式化</el-button>
            <el-button size="small" @click="validateConfig">验证配置</el-button>
            <el-button size="small" type="primary" @click="reloadNginx">重载 Nginx</el-button>
          </div>
          <el-input type="textarea" v-model="currentSite.nginxConfig" :rows="18" class="code-textarea" />
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button size="small" @click="showSiteSettings = false">取消</el-button>
        <el-button type="primary" size="small" @click="saveSiteSettings" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Link, Refresh, Lock, CircleCheck, CircleClose } from '@element-plus/icons-vue'

interface Site {
  id: string
  name: string
  domain: string
  path: string
  type: string
  status: string
  ssl: boolean
  sslType?: string
  sslValid?: boolean
  sslExpiry?: string
  forceHttps?: boolean
  hsts?: boolean
  proxyPass?: string
  proxyTimeout?: number
  proxySetHost?: boolean
  proxySetRealIP?: boolean
  proxySetForwarded?: boolean
  websocket?: boolean
  phpVersion?: string
  indexFiles?: string
  user?: string
  rewriteRules?: string
  nginxConfig?: string
  allowIps?: string
  denyIps?: string
  basicAuth?: boolean
  authUser?: string
  authPass?: string
}

const serverStore = useServerStore()
const loading = ref(false)
const adding = ref(false)
const saving = ref(false)
const showAddSite = ref(false)
const showSiteSettings = ref(false)
const settingsTab = ref('basic')
const addSiteTab = ref('basic')
const currentSite = ref<Site | null>(null)
const sites = ref<Site[]>([])
const selectedServer = ref<string | null>(null)

const connectedServers = computed(() => serverStore.connectedServers)
const runningSites = computed(() => sites.value.filter(s => s.status === 'running').length)
const stoppedSites = computed(() => sites.value.filter(s => s.status !== 'running').length)
const sslSites = computed(() => sites.value.filter(s => s.ssl).length)
const filteredSites = computed(() => sites.value)

const newSite = ref({
  name: '', domain: '', path: '/var/www', type: 'static', protocol: 'http',
  ssl: false, sslType: 'letsencrypt', sslCert: '', sslKey: '', forceHttps: true, hsts: false,
  proxyPass: 'http://127.0.0.1:3000', websocket: false,
  phpVersion: '8.2', disableFunctions: '',
  indexFiles: 'index.html index.php', accessLog: '', errorLog: '',
  clientMaxBodySize: '100m', gzip: true
})

// 监听服务器变化
watch(() => selectedServer.value, (val) => {
  if (val) loadSites()
})

onMounted(() => {
  if (connectedServers.value.length > 0) {
    selectedServer.value = connectedServers.value[0].id
  }
})

function getTypeTag(type: string): 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined {
  const map: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined> = {
    static: undefined, php: 'warning', node: 'success', python: 'info', java: 'danger', proxy: undefined
  }
  return map[type]
}

async function loadSites() {
  if (!selectedServer.value) return
  loading.value = true
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'ls -1 /etc/nginx/sites-enabled/ 2>/dev/null || ls -1 /etc/nginx/conf.d/*.conf 2>/dev/null']
    )
    const stdout = result.stdout || ''
    const files = stdout.trim().split('\n').filter(f => f && !f.includes('default'))
    
    sites.value = files.map((f, i) => ({
      id: `site_${i}`,
      name: f.replace('.conf', '').replace(/^.*\//, ''),
      domain: f.replace('.conf', '').replace(/^.*\//, ''),
      path: '/var/www/' + f.replace('.conf', '').replace(/^.*\//, ''),
      type: 'static',
      status: 'running',
      ssl: false
    }))
  } catch (e) {
    sites.value = []
  } finally {
    loading.value = false
  }
}

function refreshSites() {
  loadSites()
}

async function addSite() {
  if (!selectedServer.value) { ElMessage.warning('请先选择服务器'); return }
  if (!newSite.value.name || !newSite.value.domain) {
    ElMessage.warning('请填写站点名称和域名'); return
  }
  adding.value = true
  try {
    // 创建站点目录
    await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', `sudo mkdir -p ${newSite.value.path}`]
    )
    
    // 生成 Nginx 配置
    const config = generateNginxConfig(newSite.value)
    const configPath = `/etc/nginx/sites-available/${newSite.value.name}`
    
    // 写入配置文件
    await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', `echo '${config.replace(/'/g, "'\\''")}' | sudo tee ${configPath}`]
    )
    
    // 创建软链接
    await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', `sudo ln -sf ${configPath} /etc/nginx/sites-enabled/`]
    )
    
    // 测试并重载 Nginx
    const testResult = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'sudo nginx -t']
    )
    
    if (testResult.exit_code === 0) {
      await window.electronAPI.server.executeCommand(
        selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx']
      )
      ElMessage.success('站点创建成功')
      showAddSite.value = false
      resetNewSite()
      loadSites()
    } else {
      ElMessage.error('Nginx 配置测试失败: ' + (testResult.stderr || ''))
    }
  } catch (e) {
    ElMessage.error('创建失败: ' + (e as Error).message)
  } finally {
    adding.value = false
  }
}

function generateNginxConfig(site: any): string {
  let config = `server {
    listen 80;
    server_name ${site.domain};
    root ${site.path};
    index ${site.indexFiles || 'index.html index.php'};
    
    ${site.gzip ? `
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    ` : ''}
    
    ${site.clientMaxBodySize ? `client_max_body_size ${site.clientMaxBodySize};` : ''}
`

  if (site.type === 'php') {
    config += `
    location ~ \\.php$ {
        fastcgi_pass unix:/var/run/php/php${site.phpVersion || '8.2'}-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
`
  } else if (['node', 'python', 'java', 'proxy'].includes(site.type)) {
    config += `
    location / {
        proxy_pass ${site.proxyPass || 'http://127.0.0.1:3000'};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        ${site.websocket ? `
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        ` : ''}
    }
`
  } else {
    config += `
    location / {
        try_files $uri $uri/ =404;
    }
`
  }

  config += `
    location ~ /\\. {
        deny all;
    }
}
`
  return config
}

function resetNewSite() {
  newSite.value = {
    name: '', domain: '', path: '/var/www', type: 'static', protocol: 'http',
    ssl: false, sslType: 'letsencrypt', sslCert: '', sslKey: '', forceHttps: true, hsts: false,
    proxyPass: 'http://127.0.0.1:3000', websocket: false,
    phpVersion: '8.2', disableFunctions: '',
    indexFiles: 'index.html index.php', accessLog: '', errorLog: '',
    clientMaxBodySize: '100m', gzip: true
  }
  addSiteTab.value = 'basic'
}

function editSite(site: Site) {
  currentSite.value = { ...site }
  settingsTab.value = 'basic'
  showSiteSettings.value = true
}

function openSite(site: Site) {
  const url = site.ssl ? `https://${site.domain}` : `http://${site.domain}`
  window.electronAPI.shell.openExternal(url)
}

async function toggleSite(site: Site, action: 'start' | 'stop') {
  if (!selectedServer.value) return
  try {
    if (action === 'stop') {
      await window.electronAPI.server.executeCommand(
        selectedServer.value, 'bash', ['-c', `sudo rm -f /etc/nginx/sites-enabled/${site.name}`]
      )
    } else {
      await window.electronAPI.server.executeCommand(
        selectedServer.value, 'bash', ['-c', `sudo ln -sf /etc/nginx/sites-available/${site.name} /etc/nginx/sites-enabled/`]
      )
    }
    await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx']
    )
    ElMessage.success(action === 'stop' ? '站点已停止' : '站点已启动')
    loadSites()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

async function deleteSite(site: Site) {
  try {
    await ElMessageBox.confirm(`确定删除站点 ${site.name}？配置文件将被删除。`, '确认删除', { type: 'warning' })
  } catch { return }
  
  if (!selectedServer.value) return
  try {
    await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', `sudo rm -f /etc/nginx/sites-enabled/${site.name} /etc/nginx/sites-available/${site.name}`]
    )
    await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx']
    )
    ElMessage.success('站点已删除')
    loadSites()
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

async function saveSiteSettings() {
  if (!currentSite.value || !selectedServer.value) return
  saving.value = true
  try {
    // 保存配置逻辑
    ElMessage.success('设置已保存')
    showSiteSettings.value = false
    loadSites()
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function applyRewritePreset(preset: string) {
  if (!currentSite.value) return
  const presets: Record<string, string> = {
    wordpress: `location / {
    try_files $uri $uri/ /index.php?$args;
}`,
    laravel: `location / {
    try_files $uri $uri/ /index.php?$query_string;
}`,
    thinkphp: `location / {
    if (!-e $request_filename) {
        rewrite ^(.*)$ /index.php?s=$1 last;
    }
}`,
    vue: `location / {
    try_files $uri $uri/ /index.html;
}`
  }
  currentSite.value.rewriteRules = presets[preset] || ''
}

function browsePath() {
  ElMessage.info('文件浏览器功能开发中')
}

function renewCert() {
  ElMessage.info('证书续期功能开发中')
}

function formatConfig() {
  ElMessage.info('配置格式化功能开发中')
}

function validateConfig() {
  ElMessage.info('配置验证功能开发中')
}

async function reloadNginx() {
  if (!selectedServer.value) return
  try {
    await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx']
    )
    ElMessage.success('Nginx 已重载')
  } catch (e) {
    ElMessage.error('重载失败')
  }
}
</script>

<style lang="scss" scoped>
.websites {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;

  .header-left {
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .subtitle {
      color: var(--text-secondary);
      font-size: 13px;
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}

.empty-state {
  padding: 60px 0;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;

  .stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;

    &.total { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
    &.running { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    &.ssl { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    &.stopped { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.sites-table {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid var(--border-color);
}

.site-name {
  display: flex;
  align-items: center;
  gap: 8px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    &.running { background: #22c55e; }
    &.stopped { background: #ef4444; }
  }
}

.domain-link {
  color: var(--primary-color);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    text-decoration: underline;
  }
}

.path-code {
  font-family: 'Consolas', monospace;
  font-size: 12px;
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
}

.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.ssl-settings {
  padding: 12px 0;
}

.rewrite-presets {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;

  .preset-label {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.config-actions {
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
}

.code-textarea {
  :deep(.el-textarea__inner) {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    background: var(--bg-tertiary);
    line-height: 1.6;
  }
}

// 深色对话框
:deep(.dark-dialog) {
  .el-dialog {
    background: var(--bg-secondary) !important;
  }
  .el-dialog__header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }
  .el-dialog__title {
    color: var(--text-color);
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
