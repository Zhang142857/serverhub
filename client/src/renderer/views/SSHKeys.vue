<template>
  <div class="ssh-keys-page">
    <div class="page-header">
      <div class="header-left">
        <h1>SSH 密钥管理</h1>
        <p class="subtitle">管理 SSH 密钥、授权密钥和已知主机</p>
      </div>
      <div class="header-right">
        <el-select v-model="selectedServer" placeholder="选择服务器" @change="loadData">
          <el-option v-for="s in servers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button @click="loadData" :loading="loading" :disabled="!selectedServer">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <!-- 未选择服务器提示 -->
    <el-alert v-if="!selectedServer" title="请先选择服务器" type="info" show-icon :closable="false" class="server-alert">
      <template #default>从右上角下拉菜单选择要管理的服务器。</template>
    </el-alert>

    <el-tabs v-model="activeTab" v-else>
      <!-- SSH 密钥对 -->
      <el-tab-pane label="密钥对" name="keys">
        <div class="tab-header">
          <span class="tab-desc">管理服务器上的 SSH 密钥对</span>
          <el-button type="primary" @click="showGenerateDialog">
            <el-icon><Plus /></el-icon>生成新密钥
          </el-button>
        </div>

        <el-table :data="sshKeys" v-loading="loading" stripe>
          <el-table-column prop="name" label="名称" min-width="200">
            <template #default="{ row }">
              <div class="key-name">
                <el-icon><Key /></el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="bits" label="位数" width="80" />
          <el-table-column prop="fingerprint" label="指纹" min-width="300">
            <template #default="{ row }">
              <code class="fingerprint">{{ row.fingerprint }}</code>
            </template>
          </el-table-column>
          <el-table-column prop="created" label="创建时间" width="180">
            <template #default="{ row }">{{ formatDate(row.created) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" @click="viewPublicKey(row)">查看公钥</el-button>
              <el-button text size="small" @click="copyPublicKey(row)">复制</el-button>
              <el-button text size="small" type="danger" @click="deleteKey(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="sshKeys.length === 0 && !loading" description="暂无 SSH 密钥" />
      </el-tab-pane>

      <!-- 授权密钥 -->
      <el-tab-pane label="授权密钥" name="authorized">
        <div class="tab-header">
          <span class="tab-desc">管理 ~/.ssh/authorized_keys 中的授权密钥</span>
          <el-button type="primary" @click="showAddAuthorizedDialog">
            <el-icon><Plus /></el-icon>添加授权密钥
          </el-button>
        </div>

        <el-table :data="authorizedKeys" v-loading="loading" stripe>
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="comment" label="备注" min-width="200" />
          <el-table-column prop="key" label="公钥" min-width="400">
            <template #default="{ row }">
              <code class="key-preview">{{ truncateKey(row.key) }}</code>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" @click="viewFullKey(row)">查看</el-button>
              <el-button text size="small" type="danger" @click="removeAuthorizedKey(row)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="authorizedKeys.length === 0 && !loading" description="暂无授权密钥" />
      </el-tab-pane>

      <!-- 已知主机 -->
      <el-tab-pane label="已知主机" name="known_hosts">
        <div class="tab-header">
          <span class="tab-desc">管理 ~/.ssh/known_hosts 中的已知主机</span>
          <el-button type="primary" @click="showAddKnownHostDialog">
            <el-icon><Plus /></el-icon>添加主机
          </el-button>
        </div>

        <el-table :data="knownHosts" v-loading="loading" stripe>
          <el-table-column prop="host" label="主机" min-width="200" />
          <el-table-column prop="type" label="密钥类型" width="150">
            <template #default="{ row }">
              <el-tag size="small">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="fingerprint" label="指纹" min-width="300">
            <template #default="{ row }">
              <code class="fingerprint">{{ row.fingerprint }}</code>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" type="danger" @click="removeKnownHost(row)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="knownHosts.length === 0 && !loading" description="暂无已知主机" />
      </el-tab-pane>

      <!-- SSH 配置 -->
      <el-tab-pane label="SSH 配置" name="config">
        <div class="tab-header">
          <span class="tab-desc">编辑 ~/.ssh/config 文件</span>
          <div class="tab-actions">
            <el-button @click="loadSshConfig" :loading="loading">
              <el-icon><Refresh /></el-icon>重新加载
            </el-button>
            <el-button type="primary" @click="saveSshConfig" :loading="saving">
              <el-icon><Check /></el-icon>保存配置
            </el-button>
          </div>
        </div>

        <div class="config-editor">
          <el-input
            v-model="sshConfig"
            type="textarea"
            :rows="20"
            placeholder="# SSH 配置文件
# 示例:
# Host myserver
#   HostName 192.168.1.100
#   User root
#   Port 22
#   IdentityFile ~/.ssh/id_rsa"
            class="config-textarea"
          />
        </div>

        <div class="config-help">
          <h4>常用配置示例</h4>
          <div class="help-examples">
            <el-card class="example-card" shadow="hover" @click="insertExample('basic')">
              <template #header>基本配置</template>
              <pre>Host myserver
  HostName 192.168.1.100
  User root
  Port 22</pre>
            </el-card>
            <el-card class="example-card" shadow="hover" @click="insertExample('key')">
              <template #header>指定密钥</template>
              <pre>Host github.com
  IdentityFile ~/.ssh/github_key
  IdentitiesOnly yes</pre>
            </el-card>
            <el-card class="example-card" shadow="hover" @click="insertExample('proxy')">
              <template #header>跳板机</template>
              <pre>Host internal
  HostName 10.0.0.5
  ProxyJump bastion
  User admin</pre>
            </el-card>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 生成密钥对话框 -->
    <el-dialog v-model="generateDialogVisible" title="生成 SSH 密钥" width="500px">
      <el-form :model="generateForm" label-width="100px">
        <el-form-item label="密钥名称">
          <el-input v-model="generateForm.name" placeholder="如: id_rsa, github_key" />
        </el-form-item>
        <el-form-item label="密钥类型">
          <el-select v-model="generateForm.type">
            <el-option label="RSA (兼容性好)" value="rsa" />
            <el-option label="ED25519 (推荐)" value="ed25519" />
            <el-option label="ECDSA" value="ecdsa" />
          </el-select>
        </el-form-item>
        <el-form-item label="密钥位数" v-if="generateForm.type === 'rsa'">
          <el-select v-model="generateForm.bits">
            <el-option label="2048 位" :value="2048" />
            <el-option label="4096 位 (推荐)" :value="4096" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="generateForm.comment" placeholder="可选，用于标识密钥" />
        </el-form-item>
        <el-form-item label="密码短语">
          <el-input v-model="generateForm.passphrase" type="password" placeholder="可选，用于加密私钥" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="generateKey" :loading="saving">生成</el-button>
      </template>
    </el-dialog>

    <!-- 添加授权密钥对话框 -->
    <el-dialog v-model="addAuthorizedDialogVisible" title="添加授权密钥" width="600px">
      <el-form :model="authorizedForm" label-width="80px">
        <el-form-item label="公钥">
          <el-input
            v-model="authorizedForm.key"
            type="textarea"
            :rows="5"
            placeholder="粘贴公钥内容，格式如: ssh-rsa AAAA... user@host"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addAuthorizedDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addAuthorizedKey" :loading="saving">添加</el-button>
      </template>
    </el-dialog>

    <!-- 添加已知主机对话框 -->
    <el-dialog v-model="addKnownHostDialogVisible" title="添加已知主机" width="500px">
      <el-form :model="knownHostForm" label-width="80px">
        <el-form-item label="主机">
          <el-input v-model="knownHostForm.host" placeholder="主机名或 IP 地址" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="knownHostForm.port" :min="1" :max="65535" />
        </el-form-item>
      </el-form>
      <el-alert type="info" :closable="false">
        添加后将自动扫描主机公钥并添加到 known_hosts
      </el-alert>
      <template #footer>
        <el-button @click="addKnownHostDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addKnownHost" :loading="saving">扫描并添加</el-button>
      </template>
    </el-dialog>

    <!-- 查看公钥对话框 -->
    <el-dialog v-model="viewKeyDialogVisible" title="公钥内容" width="700px">
      <el-input v-model="viewingKey" type="textarea" :rows="8" readonly />
      <template #footer>
        <el-button @click="viewKeyDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="copyViewingKey">复制到剪贴板</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus, Key, Check } from '@element-plus/icons-vue'
import { useServerStore } from '../stores/server'

interface SSHKey {
  name: string
  type: string
  bits: number
  fingerprint: string
  publicKey: string
  created: string
}

interface AuthorizedKey {
  id: string
  type: string
  key: string
  comment: string
}

interface KnownHost {
  id: string
  host: string
  type: string
  fingerprint: string
}

const serverStore = useServerStore()

const loading = ref(false)
const saving = ref(false)
const activeTab = ref('keys')
const selectedServer = ref('')

// 数据
const sshKeys = ref<SSHKey[]>([])
const authorizedKeys = ref<AuthorizedKey[]>([])
const knownHosts = ref<KnownHost[]>([])
const sshConfig = ref('')

// 服务器列表
const servers = ref<Array<{ id: string; name: string }>>([])

// 对话框
const generateDialogVisible = ref(false)
const addAuthorizedDialogVisible = ref(false)
const addKnownHostDialogVisible = ref(false)
const viewKeyDialogVisible = ref(false)
const viewingKey = ref('')

// 表单
const generateForm = ref({
  name: 'id_ed25519',
  type: 'ed25519',
  bits: 4096,
  comment: '',
  passphrase: ''
})

const authorizedForm = ref({
  key: ''
})

const knownHostForm = ref({
  host: '',
  port: 22
})

onMounted(() => {
  // 加载服务器列表
  servers.value = serverStore.servers.map(s => ({ id: s.id, name: s.name }))
  if (servers.value.length > 0) {
    selectedServer.value = servers.value[0].id
    loadData()
  }
})

async function loadData() {
  if (!selectedServer.value) return
  loading.value = true
  try {
    // 加载 SSH 密钥对
    await loadSSHKeys()
    // 加载授权密钥
    await loadAuthorizedKeys()
    // 加载已知主机
    await loadKnownHosts()
    // 加载 SSH 配置
    await loadSshConfigFile()
  } catch (error) {
    console.error('加载 SSH 数据失败:', error)
    ElMessage.error('加载 SSH 数据失败')
  } finally {
    loading.value = false
  }
}

async function loadSSHKeys() {
  try {
    // 列出 ~/.ssh/ 目录下的密钥文件
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', 'ls -la ~/.ssh/*.pub 2>/dev/null || echo ""']
    )
    
    const keys: SSHKey[] = []
    const lines = (result.stdout || '').split('\n').filter((l: string) => l.includes('.pub'))
    
    for (const line of lines) {
      const match = line.match(/(\S+\.pub)$/)
      if (match) {
        const pubFile = match[1]
        const name = pubFile.replace(/\.pub$/, '').split('/').pop() || ''
        
        // 获取公钥内容和指纹
        const keyResult = await window.electronAPI.server.executeCommand(
          selectedServer.value,
          'bash',
          ['-c', `cat ~/.ssh/${name}.pub 2>/dev/null`]
        )
        const publicKey = (keyResult.stdout || '').trim()
        
        // 获取指纹
        const fpResult = await window.electronAPI.server.executeCommand(
          selectedServer.value,
          'bash',
          ['-c', `ssh-keygen -lf ~/.ssh/${name}.pub 2>/dev/null`]
        )
        const fpLine = (fpResult.stdout || '').trim()
        const fpMatch = fpLine.match(/(\d+)\s+(SHA256:\S+)\s+.*\((\w+)\)/)
        
        // 获取文件创建时间
        const statResult = await window.electronAPI.server.executeCommand(
          selectedServer.value,
          'bash',
          ['-c', `stat -c %Y ~/.ssh/${name}.pub 2>/dev/null || stat -f %m ~/.ssh/${name}.pub 2>/dev/null`]
        )
        const timestamp = parseInt((statResult.stdout || '').trim()) || Date.now() / 1000
        
        keys.push({
          name,
          type: fpMatch ? fpMatch[3] : publicKey.split(' ')[0]?.replace('ssh-', '').toUpperCase() || 'UNKNOWN',
          bits: fpMatch ? parseInt(fpMatch[1]) : 0,
          fingerprint: fpMatch ? fpMatch[2] : '',
          publicKey,
          created: new Date(timestamp * 1000).toISOString()
        })
      }
    }
    
    sshKeys.value = keys
  } catch (error) {
    console.error('加载 SSH 密钥失败:', error)
    sshKeys.value = []
  }
}

async function loadAuthorizedKeys() {
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', 'cat ~/.ssh/authorized_keys 2>/dev/null || echo ""']
    )
    
    const keys: AuthorizedKey[] = []
    const lines = (result.stdout || '').split('\n').filter((l: string) => l.trim() && !l.startsWith('#'))
    
    lines.forEach((line: string, index: number) => {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2) {
        keys.push({
          id: `auth_${index}`,
          type: parts[0],
          key: parts[1],
          comment: parts.slice(2).join(' ') || ''
        })
      }
    })
    
    authorizedKeys.value = keys
  } catch (error) {
    console.error('加载授权密钥失败:', error)
    authorizedKeys.value = []
  }
}

async function loadKnownHosts() {
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', 'cat ~/.ssh/known_hosts 2>/dev/null || echo ""']
    )
    
    const hosts: KnownHost[] = []
    const lines = (result.stdout || '').split('\n').filter((l: string) => l.trim() && !l.startsWith('#'))
    
    lines.forEach((line: string, index: number) => {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 3) {
        // 计算指纹
        const keyData = parts[2]
        hosts.push({
          id: `known_${index}`,
          host: parts[0].replace(/,.*$/, ''), // 移除端口等额外信息
          type: parts[1],
          fingerprint: `SHA256:${keyData.substring(0, 43)}...` // 简化显示
        })
      }
    })
    
    knownHosts.value = hosts
  } catch (error) {
    console.error('加载已知主机失败:', error)
    knownHosts.value = []
  }
}

async function loadSshConfigFile() {
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', 'cat ~/.ssh/config 2>/dev/null || echo ""']
    )
    sshConfig.value = result.stdout || ''
  } catch (error) {
    console.error('加载 SSH 配置失败:', error)
    sshConfig.value = ''
  }
}

async function loadSshConfig() {
  if (!selectedServer.value) return
  loading.value = true
  try {
    await loadSshConfigFile()
    ElMessage.success('SSH 配置已重新加载')
  } catch (error) {
    ElMessage.error('加载 SSH 配置失败')
  } finally {
    loading.value = false
  }
}

async function saveSshConfig() {
  if (!selectedServer.value) return
  saving.value = true
  try {
    // 确保 ~/.ssh 目录存在
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', 'mkdir -p ~/.ssh && chmod 700 ~/.ssh']
    )
    
    // 写入配置文件
    const escapedConfig = sshConfig.value.replace(/'/g, "'\\''")
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', `echo '${escapedConfig}' > ~/.ssh/config && chmod 600 ~/.ssh/config`]
    )
    
    ElMessage.success('SSH 配置已保存')
  } catch (error) {
    console.error('保存 SSH 配置失败:', error)
    ElMessage.error('保存 SSH 配置失败')
  } finally {
    saving.value = false
  }
}

function showGenerateDialog() {
  generateForm.value = {
    name: 'id_ed25519',
    type: 'ed25519',
    bits: 4096,
    comment: '',
    passphrase: ''
  }
  generateDialogVisible.value = true
}

async function generateKey() {
  if (!generateForm.value.name) {
    ElMessage.warning('请输入密钥名称')
    return
  }
  if (!selectedServer.value) return
  
  saving.value = true
  try {
    // 确保 ~/.ssh 目录存在
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', 'mkdir -p ~/.ssh && chmod 700 ~/.ssh']
    )
    
    // 构建 ssh-keygen 命令
    const keyPath = `~/.ssh/${generateForm.value.name}`
    const keyType = generateForm.value.type
    const comment = generateForm.value.comment || `${generateForm.value.name}@serverhub`
    const passphrase = generateForm.value.passphrase || ''
    
    let cmd = `ssh-keygen -t ${keyType}`
    if (keyType === 'rsa') {
      cmd += ` -b ${generateForm.value.bits}`
    }
    cmd += ` -f ${keyPath} -C "${comment}" -N "${passphrase}"`
    
    // 如果文件已存在，先删除
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', `rm -f ${keyPath} ${keyPath}.pub 2>/dev/null || true`]
    )
    
    // 生成密钥
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', cmd]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '密钥生成失败')
    }
    
    generateDialogVisible.value = false
    ElMessage.success('SSH 密钥已生成')
    
    // 重新加载密钥列表
    await loadSSHKeys()
  } catch (error: any) {
    console.error('生成密钥失败:', error)
    ElMessage.error(error.message || '生成密钥失败')
  } finally {
    saving.value = false
  }
}

function viewPublicKey(key: SSHKey) {
  viewingKey.value = key.publicKey
  viewKeyDialogVisible.value = true
}

function copyPublicKey(key: SSHKey) {
  navigator.clipboard.writeText(key.publicKey)
  ElMessage.success('公钥已复制到剪贴板')
}

function copyViewingKey() {
  navigator.clipboard.writeText(viewingKey.value)
  ElMessage.success('已复制到剪贴板')
}

async function deleteKey(key: SSHKey) {
  await ElMessageBox.confirm(`确定删除密钥 "${key.name}" 吗？此操作不可恢复。`, '确认删除', { type: 'warning' })
  
  if (!selectedServer.value) return
  
  try {
    // 删除私钥和公钥文件
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', `rm -f ~/.ssh/${key.name} ~/.ssh/${key.name}.pub`]
    )
    
    // 重新加载密钥列表
    await loadSSHKeys()
    ElMessage.success('密钥已删除')
  } catch (error) {
    console.error('删除密钥失败:', error)
    ElMessage.error('删除密钥失败')
  }
}

function showAddAuthorizedDialog() {
  authorizedForm.value = { key: '' }
  addAuthorizedDialogVisible.value = true
}

async function addAuthorizedKey() {
  if (!authorizedForm.value.key.trim()) {
    ElMessage.warning('请输入公钥内容')
    return
  }
  if (!selectedServer.value) return
  
  saving.value = true
  try {
    // 确保 ~/.ssh 目录和 authorized_keys 文件存在
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys']
    )
    
    // 追加公钥到 authorized_keys
    const escapedKey = authorizedForm.value.key.trim().replace(/'/g, "'\\''")
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', `echo '${escapedKey}' >> ~/.ssh/authorized_keys`]
    )
    
    addAuthorizedDialogVisible.value = false
    ElMessage.success('授权密钥已添加')
    
    // 重新加载授权密钥列表
    await loadAuthorizedKeys()
  } catch (error) {
    console.error('添加授权密钥失败:', error)
    ElMessage.error('添加授权密钥失败')
  } finally {
    saving.value = false
  }
}

function viewFullKey(key: AuthorizedKey) {
  viewingKey.value = `${key.type} ${key.key} ${key.comment}`
  viewKeyDialogVisible.value = true
}

async function removeAuthorizedKey(key: AuthorizedKey) {
  await ElMessageBox.confirm('确定移除此授权密钥吗？', '确认移除')
  
  if (!selectedServer.value) return
  
  try {
    // 构建要删除的密钥模式（使用密钥的前50个字符作为匹配）
    const keyPattern = key.key.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    
    // 使用 sed 删除包含该密钥的行
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', `sed -i '/${keyPattern}/d' ~/.ssh/authorized_keys`]
    )
    
    // 重新加载授权密钥列表
    await loadAuthorizedKeys()
    ElMessage.success('授权密钥已移除')
  } catch (error) {
    console.error('移除授权密钥失败:', error)
    ElMessage.error('移除授权密钥失败')
  }
}

function showAddKnownHostDialog() {
  knownHostForm.value = { host: '', port: 22 }
  addKnownHostDialogVisible.value = true
}

async function addKnownHost() {
  if (!knownHostForm.value.host) {
    ElMessage.warning('请输入主机地址')
    return
  }
  if (!selectedServer.value) return
  
  saving.value = true
  try {
    // 确保 ~/.ssh 目录存在
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', 'mkdir -p ~/.ssh && chmod 700 ~/.ssh']
    )
    
    // 使用 ssh-keyscan 扫描主机公钥
    const port = knownHostForm.value.port !== 22 ? `-p ${knownHostForm.value.port}` : ''
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', `ssh-keyscan ${port} ${knownHostForm.value.host} 2>/dev/null`],
      { timeout: 30 }
    )
    
    if (!result.stdout || result.stdout.trim() === '') {
      throw new Error('无法获取主机公钥，请检查主机地址和端口')
    }
    
    // 追加到 known_hosts
    const escapedKeys = result.stdout.trim().replace(/'/g, "'\\''")
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', `echo '${escapedKeys}' >> ~/.ssh/known_hosts`]
    )
    
    addKnownHostDialogVisible.value = false
    ElMessage.success('已知主机已添加')
    
    // 重新加载已知主机列表
    await loadKnownHosts()
  } catch (error: any) {
    console.error('添加已知主机失败:', error)
    ElMessage.error(error.message || '添加已知主机失败')
  } finally {
    saving.value = false
  }
}

async function removeKnownHost(host: KnownHost) {
  await ElMessageBox.confirm(`确定移除主机 "${host.host}" 吗？`, '确认移除')
  
  if (!selectedServer.value) return
  
  try {
    // 使用 ssh-keygen 移除已知主机
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', `ssh-keygen -R ${host.host} 2>/dev/null || sed -i '/${host.host.replace(/\./g, '\\.')}/d' ~/.ssh/known_hosts`]
    )
    
    // 重新加载已知主机列表
    await loadKnownHosts()
    ElMessage.success('已知主机已移除')
  } catch (error) {
    console.error('移除已知主机失败:', error)
    ElMessage.error('移除已知主机失败')
  }
}

function truncateKey(key: string): string {
  if (key.length <= 50) return key
  return key.substring(0, 25) + '...' + key.substring(key.length - 20)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN')
}

function insertExample(type: string) {
  const examples: Record<string, string> = {
    basic: `
Host myserver
  HostName 192.168.1.100
  User root
  Port 22
`,
    key: `
Host github.com
  IdentityFile ~/.ssh/github_key
  IdentitiesOnly yes
`,
    proxy: `
Host internal
  HostName 10.0.0.5
  ProxyJump bastion
  User admin
`
  }
  sshConfig.value += examples[type] || ''
  ElMessage.success('示例已插入')
}
</script>

<style lang="scss" scoped>
.ssh-keys-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  .header-left {
    h1 { font-size: 24px; font-weight: 600; margin: 0; }
    .subtitle { color: var(--text-secondary); font-size: 14px; margin: 4px 0 0; }
  }

  .header-right {
    display: flex;
    gap: 12px;
  }
}

.server-alert {
  margin-bottom: 20px;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .tab-desc {
    color: var(--text-secondary);
    font-size: 14px;
  }

  .tab-actions {
    display: flex;
    gap: 8px;
  }
}

.key-name {
  display: flex;
  align-items: center;
  gap: 8px;

  .el-icon {
    color: var(--el-color-primary);
  }
}

.fingerprint, .key-preview {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

.config-editor {
  margin-bottom: 20px;

  .config-textarea {
    font-family: monospace;
    :deep(textarea) {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.5;
    }
  }
}

.config-help {
  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .help-examples {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
  }

  .example-card {
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    pre {
      margin: 0;
      font-size: 12px;
      white-space: pre-wrap;
      color: var(--text-secondary);
    }
  }
}
</style>
