<template>
  <div class="environment">
    <div class="page-header">
      <div class="header-left">
        <h1>环境管理</h1>
        <p class="subtitle">运行环境安装与管理</p>
      </div>
      <div class="header-actions">
        <el-button @click="checkInstalledEnvs" :loading="checking" size="small">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <div v-if="!serverStore.currentServer" class="no-server">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <template v-else>
      <!-- 已安装环境 -->
      <div class="section">
        <div class="section-header">
          <h2>已安装环境</h2>
          <el-tag type="success" size="small">{{ installedEnvs.length }} 个</el-tag>
        </div>
        <div class="env-grid" v-loading="checking">
          <div v-for="env in installedEnvs" :key="env.name" class="env-card installed">
            <div class="env-icon" :style="{ background: env.color }">
              <TechIcon :name="env.iconName" />
            </div>
            <div class="env-info">
              <div class="env-name">{{ env.name }}</div>
              <div class="env-version">
                <el-icon><CircleCheck /></el-icon>
                {{ env.version }}
              </div>
            </div>
            <div class="env-actions">
              <el-button size="small" text @click="showEnvInfo(env)">详情</el-button>
              <el-button size="small" text type="danger" @click="uninstallEnv(env)">卸载</el-button>
            </div>
          </div>
          <div v-if="installedEnvs.length === 0 && !checking" class="empty-state">
            <span>暂无已安装环境</span>
          </div>
        </div>
      </div>

      <!-- 可安装环境 -->
      <div class="section">
        <div class="section-header">
          <h2>可安装环境</h2>
        </div>
        <div class="env-grid">
          <div v-for="env in notInstalledEnvs" :key="env.name" class="env-card">
            <div class="env-icon" :style="{ background: env.color }">
              <TechIcon :name="env.iconName" />
            </div>
            <div class="env-info">
              <div class="env-name">{{ env.name }}</div>
              <div class="env-desc">{{ env.description }}</div>
            </div>
            <div class="env-actions">
              <el-button size="small" type="primary" @click="openInstallDialog(env)">
                安装
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 安装对话框 -->
    <el-dialog v-model="showInstallDialog" :title="`安装 ${selectedEnv?.name}`" width="500px" class="dark-dialog" destroy-on-close>
      <div class="install-dialog-content" v-if="selectedEnv">
        <div class="env-preview">
          <div class="env-icon large" :style="{ background: selectedEnv.color }">
            <TechIcon :name="selectedEnv.iconName" />
          </div>
          <div class="env-detail">
            <div class="env-name">{{ selectedEnv.name }}</div>
            <div class="env-desc">{{ selectedEnv.description }}</div>
          </div>
        </div>

        <el-form label-position="top" class="install-form">
          <el-form-item label="选择版本" v-if="selectedEnv.versions && selectedEnv.versions.length > 0">
            <el-select v-model="selectedVersion" placeholder="选择版本" style="width: 100%;">
              <el-option 
                v-for="v in selectedEnv.versions" 
                :key="v.value" 
                :label="v.label" 
                :value="v.value"
              >
                <span>{{ v.label }}</span>
                <el-tag v-if="v.recommended" type="success" size="small" style="margin-left: 8px;">推荐</el-tag>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="安装说明">
            <div class="install-info">
              <div class="info-item">
                <el-icon><InfoFilled /></el-icon>
                <span>{{ getInstallInfo(selectedEnv) }}</span>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showInstallDialog = false">取消</el-button>
        <el-button type="primary" @click="installEnv" :loading="installing">
          <el-icon><Download /></el-icon>开始安装
        </el-button>
      </template>
    </el-dialog>

    <!-- 环境详情对话框 -->
    <el-dialog v-model="showEnvDetail" :title="currentEnv?.name + ' 详情'" width="500px" class="dark-dialog" destroy-on-close>
      <el-descriptions :column="1" border v-if="currentEnv">
        <el-descriptions-item label="名称">{{ currentEnv.name }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ currentEnv.version }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ currentEnv.description }}</el-descriptions-item>
        <el-descriptions-item label="检查命令">
          <code>{{ currentEnv.checkCmd }}</code>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="showEnvDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useServerStore } from '@/stores/server'
import { useTaskStore } from '@/stores/task'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, CircleCheck, InfoFilled, Download } from '@element-plus/icons-vue'
import TechIcon from '@/components/icons/TechIcons.vue'

interface EnvVersion {
  value: string
  label: string
  recommended?: boolean
  installSteps: { cmd: string; desc: string }[]
}

interface EnvItem {
  name: string
  iconName: string
  color: string
  description: string
  version?: string
  versions?: EnvVersion[]
  checkCmd: string
  uninstallSteps?: { cmd: string; desc: string }[]
  installed?: boolean
}

const serverStore = useServerStore()
const taskStore = useTaskStore()

const checking = ref(false)
const installing = ref(false)
const showInstallDialog = ref(false)
const showEnvDetail = ref(false)
const selectedEnv = ref<EnvItem | null>(null)
const selectedVersion = ref('')
const currentEnv = ref<EnvItem | null>(null)
const installedEnvs = ref<EnvItem[]>([])

// 环境定义 - 支持多版本
const envDefinitions = ref<EnvItem[]>([
  {
    name: 'Node.js',
    iconName: 'nodejs',
    color: '#68a063',
    description: 'JavaScript 运行时环境',
    checkCmd: 'node --version 2>/dev/null | tr -d "v"',
    versions: [
      { value: '22', label: 'Node.js 22 (最新)', recommended: false, installSteps: [
        { cmd: 'curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh', desc: '下载安装脚本' },
        { cmd: 'sudo bash /tmp/nodesource_setup.sh', desc: '配置软件源' },
        { cmd: 'sudo apt-get install -y nodejs', desc: '安装 Node.js' }
      ]},
      { value: '20', label: 'Node.js 20 LTS', recommended: true, installSteps: [
        { cmd: 'curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh', desc: '下载安装脚本' },
        { cmd: 'sudo bash /tmp/nodesource_setup.sh', desc: '配置软件源' },
        { cmd: 'sudo apt-get install -y nodejs', desc: '安装 Node.js' }
      ]},
      { value: '18', label: 'Node.js 18 LTS', recommended: false, installSteps: [
        { cmd: 'curl -fsSL https://deb.nodesource.com/setup_18.x -o /tmp/nodesource_setup.sh', desc: '下载安装脚本' },
        { cmd: 'sudo bash /tmp/nodesource_setup.sh', desc: '配置软件源' },
        { cmd: 'sudo apt-get install -y nodejs', desc: '安装 Node.js' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo apt-get remove -y nodejs', desc: '卸载 Node.js' },
      { cmd: 'sudo apt-get autoremove -y', desc: '清理依赖' }
    ]
  },
  {
    name: 'PM2',
    iconName: 'nodejs',
    color: '#2b037a',
    description: 'Node.js 进程管理器',
    checkCmd: 'pm2 -v 2>/dev/null',
    versions: [
      { value: 'latest', label: '最新版本', recommended: true, installSteps: [
        { cmd: 'sudo npm install -g pm2', desc: '全局安装 PM2' },
        { cmd: 'pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true', desc: '配置开机启动' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'pm2 kill 2>/dev/null || true', desc: '停止 PM2' },
      { cmd: 'sudo npm uninstall -g pm2', desc: '卸载 PM2' }
    ]
  },
  {
    name: 'Python',
    iconName: 'python',
    color: '#3776ab',
    description: 'Python 解释器',
    checkCmd: 'python3 --version 2>/dev/null | grep -oP "\\d+\\.\\d+\\.\\d+"',
    versions: [
      { value: '3', label: 'Python 3 (系统默认)', recommended: true, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y python3 python3-pip python3-venv', desc: '安装 Python 3' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo apt-get remove -y python3 python3-pip', desc: '卸载 Python' },
      { cmd: 'sudo apt-get autoremove -y', desc: '清理依赖' }
    ]
  },
  {
    name: 'Nginx',
    iconName: 'nginx',
    color: '#009639',
    description: 'Web 服务器 / 反向代理',
    checkCmd: 'nginx -v 2>&1 | grep -oP "nginx/\\K[0-9.]+"',
    versions: [
      { value: 'stable', label: '稳定版', recommended: true, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y nginx', desc: '安装 Nginx' },
        { cmd: 'sudo systemctl enable nginx', desc: '设置开机启动' },
        { cmd: 'sudo systemctl start nginx', desc: '启动 Nginx' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo systemctl stop nginx', desc: '停止 Nginx' },
      { cmd: 'sudo systemctl disable nginx', desc: '禁用开机启动' },
      { cmd: 'sudo apt-get remove -y nginx nginx-common', desc: '卸载 Nginx' },
      { cmd: 'sudo apt-get autoremove -y', desc: '清理依赖' }
    ]
  },
  {
    name: 'Docker',
    iconName: 'docker',
    color: '#2496ed',
    description: '容器运行时',
    checkCmd: 'docker --version 2>/dev/null | grep -oP "\\d+\\.\\d+\\.\\d+"',
    versions: [
      { value: 'latest', label: '最新版本', recommended: true, installSteps: [
        { cmd: 'curl -fsSL https://get.docker.com -o /tmp/get-docker.sh', desc: '下载安装脚本' },
        { cmd: 'sudo sh /tmp/get-docker.sh', desc: '安装 Docker' },
        { cmd: 'sudo usermod -aG docker $USER', desc: '添加用户到 docker 组' },
        { cmd: 'sudo systemctl enable docker', desc: '设置开机启动' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo systemctl stop docker', desc: '停止 Docker' },
      { cmd: 'sudo apt-get remove -y docker-ce docker-ce-cli containerd.io', desc: '卸载 Docker' },
      { cmd: 'sudo rm -rf /var/lib/docker', desc: '删除数据目录' }
    ]
  },
  {
    name: 'MySQL',
    iconName: 'mysql',
    color: '#4479a1',
    description: '关系型数据库',
    checkCmd: 'mysql --version 2>/dev/null | grep -oP "\\d+\\.\\d+\\.\\d+"',
    versions: [
      { value: '8', label: 'MySQL 8.x', recommended: true, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y mysql-server', desc: '安装 MySQL' },
        { cmd: 'sudo systemctl enable mysql', desc: '设置开机启动' },
        { cmd: 'sudo systemctl start mysql', desc: '启动 MySQL' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo systemctl stop mysql', desc: '停止 MySQL' },
      { cmd: 'sudo apt-get remove -y mysql-server mysql-client', desc: '卸载 MySQL' },
      { cmd: 'sudo apt-get autoremove -y', desc: '清理依赖' }
    ]
  },
  {
    name: 'Redis',
    iconName: 'redis',
    color: '#dc382d',
    description: '内存数据库 / 缓存',
    checkCmd: 'redis-server --version 2>/dev/null | grep -oP "v=\\K[0-9.]+"',
    versions: [
      { value: 'stable', label: '稳定版', recommended: true, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y redis-server', desc: '安装 Redis' },
        { cmd: 'sudo systemctl enable redis-server', desc: '设置开机启动' },
        { cmd: 'sudo systemctl start redis-server', desc: '启动 Redis' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo systemctl stop redis-server', desc: '停止 Redis' },
      { cmd: 'sudo apt-get remove -y redis-server', desc: '卸载 Redis' }
    ]
  },
  {
    name: 'PostgreSQL',
    iconName: 'postgresql',
    color: '#336791',
    description: '关系型数据库',
    checkCmd: 'psql --version 2>/dev/null | grep -oP "\\d+\\.\\d+"',
    versions: [
      { value: 'stable', label: '稳定版', recommended: true, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y postgresql postgresql-contrib', desc: '安装 PostgreSQL' },
        { cmd: 'sudo systemctl enable postgresql', desc: '设置开机启动' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo systemctl stop postgresql', desc: '停止 PostgreSQL' },
      { cmd: 'sudo apt-get remove -y postgresql postgresql-contrib', desc: '卸载 PostgreSQL' }
    ]
  },
  {
    name: 'Git',
    iconName: 'git',
    color: '#f05032',
    description: '版本控制工具',
    checkCmd: 'git --version 2>/dev/null | grep -oP "\\d+\\.\\d+\\.\\d+"',
    versions: [
      { value: 'stable', label: '稳定版', recommended: true, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y git', desc: '安装 Git' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo apt-get remove -y git', desc: '卸载 Git' }
    ]
  },
  {
    name: 'Certbot',
    iconName: 'nodejs',
    color: '#003a70',
    description: 'SSL 证书工具',
    checkCmd: 'certbot --version 2>/dev/null | grep -oP "\\d+\\.\\d+\\.\\d+"',
    versions: [
      { value: 'stable', label: '稳定版', recommended: true, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y certbot python3-certbot-nginx', desc: '安装 Certbot' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo apt-get remove -y certbot python3-certbot-nginx', desc: '卸载 Certbot' }
    ]
  },
  {
    name: 'Go',
    iconName: 'go',
    color: '#00add8',
    description: 'Go 语言环境',
    checkCmd: 'go version 2>/dev/null | grep -oP "go\\K[0-9.]+"',
    versions: [
      { value: 'stable', label: '稳定版', recommended: true, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y golang-go', desc: '安装 Go' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo apt-get remove -y golang-go', desc: '卸载 Go' }
    ]
  },
  {
    name: 'Java',
    iconName: 'java',
    color: '#f89820',
    description: 'Java 运行环境',
    checkCmd: 'java --version 2>&1 | head -1 | grep -oP "\\d+\\.\\d+\\.\\d+" || java -version 2>&1 | head -1 | grep -oP "\\d+\\.\\d+\\.\\d+"',
    versions: [
      { value: '21', label: 'OpenJDK 21', recommended: true, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y openjdk-21-jdk', desc: '安装 OpenJDK 21' }
      ]},
      { value: '17', label: 'OpenJDK 17 LTS', recommended: false, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y openjdk-17-jdk', desc: '安装 OpenJDK 17' }
      ]},
      { value: '11', label: 'OpenJDK 11 LTS', recommended: false, installSteps: [
        { cmd: 'sudo apt-get update', desc: '更新软件源' },
        { cmd: 'sudo apt-get install -y openjdk-11-jdk', desc: '安装 OpenJDK 11' }
      ]}
    ],
    uninstallSteps: [
      { cmd: 'sudo apt-get remove -y openjdk-*-jdk', desc: '卸载 Java' },
      { cmd: 'sudo apt-get autoremove -y', desc: '清理依赖' }
    ]
  }
])

// 未安装的环境
const notInstalledEnvs = computed(() => {
  const installedNames = installedEnvs.value.map(e => e.name)
  return envDefinitions.value.filter(e => !installedNames.includes(e.name))
})

// 监听服务器变化
watch(() => serverStore.currentServer, () => {
  if (serverStore.currentServer) {
    checkInstalledEnvs()
  }
})

async function checkInstalledEnvs() {
  const server = serverStore.currentServer
  if (!server) return

  checking.value = true
  installedEnvs.value = []

  for (const env of envDefinitions.value) {
    try {
      const result = await window.electronAPI.server.executeCommand(
        server.id, 'bash', ['-c', env.checkCmd]
      )
      if (result.exit_code === 0 && (result.stdout || '').trim()) {
        const version = (result.stdout || '').trim().split('\n')[0]
        installedEnvs.value.push({ ...env, version, installed: true })
      }
    } catch {
      // 未安装
    }
  }

  checking.value = false
}

function openInstallDialog(env: EnvItem) {
  selectedEnv.value = env
  // 默认选择推荐版本
  if (env.versions && env.versions.length > 0) {
    const recommended = env.versions.find(v => v.recommended)
    selectedVersion.value = recommended?.value || env.versions[0].value
  }
  showInstallDialog.value = true
}

function getInstallInfo(env: EnvItem): string {
  if (!env.versions) return '将安装默认版本'
  const version = env.versions.find(v => v.value === selectedVersion.value)
  if (!version) return '将安装默认版本'
  return `将执行 ${version.installSteps.length} 个安装步骤`
}

async function installEnv() {
  const server = serverStore.currentServer
  if (!server || !selectedEnv.value) return

  const env = selectedEnv.value
  const version = env.versions?.find(v => v.value === selectedVersion.value)
  if (!version) {
    ElMessage.error('请选择版本')
    return
  }

  showInstallDialog.value = false
  installing.value = true

  // 创建任务
  const task = taskStore.createTask(
    `安装 ${env.name} ${version.label}`,
    'env-install',
    server.id,
    version.installSteps
  )

  try {
    for (let i = 0; i < version.installSteps.length; i++) {
      const step = version.installSteps[i]
      taskStore.updateStep(task.id, i, 'running')
      taskStore.appendLog(task.id, `[${i + 1}/${version.installSteps.length}] ${step.desc}\n`)
      taskStore.appendLog(task.id, `$ ${step.cmd}\n`)

      try {
        const result = await window.electronAPI.server.executeCommand(
          server.id, 'bash', ['-c', step.cmd], { timeout: 300 }
        )

        if (result.stdout) {
          taskStore.appendLog(task.id, result.stdout + '\n')
        }
        if (result.stderr) {
          taskStore.appendLog(task.id, result.stderr + '\n')
        }

        if (result.exit_code === 0) {
          taskStore.updateStep(task.id, i, 'success', result.stdout)
          taskStore.appendLog(task.id, `✓ 完成\n\n`)
        } else {
          taskStore.updateStep(task.id, i, 'failed')
          taskStore.appendLog(task.id, `⚠️ 退出码: ${result.exit_code}\n\n`)
        }
      } catch (e) {
        taskStore.updateStep(task.id, i, 'failed')
        taskStore.appendLog(task.id, `❌ 错误: ${(e as Error).message}\n\n`)
      }
    }

    // 验证安装
    taskStore.appendLog(task.id, `🔍 验证安装...\n`)
    const checkResult = await window.electronAPI.server.executeCommand(
      server.id, 'bash', ['-c', env.checkCmd]
    )

    if (checkResult.exit_code === 0 && (checkResult.stdout || '').trim()) {
      taskStore.completeTask(task.id, true)
      ElMessage.success(`${env.name} 安装成功`)
      checkInstalledEnvs()
    } else {
      taskStore.completeTask(task.id, false)
      ElMessage.error(`${env.name} 安装失败`)
    }
  } catch (e) {
    taskStore.appendLog(task.id, `\n❌ 错误: ${(e as Error).message}\n`)
    taskStore.completeTask(task.id, false)
    ElMessage.error('安装失败')
  } finally {
    installing.value = false
  }
}

async function uninstallEnv(env: EnvItem) {
  const server = serverStore.currentServer
  if (!server) return

  try {
    await ElMessageBox.confirm(
      `确定卸载 ${env.name}？这可能会影响依赖它的服务。`,
      '确认卸载',
      { type: 'warning' }
    )
  } catch {
    return
  }

  const envDef = envDefinitions.value.find(e => e.name === env.name)
  if (!envDef?.uninstallSteps) {
    ElMessage.warning('该环境不支持自动卸载')
    return
  }

  // 创建卸载任务
  const task = taskStore.createTask(
    `卸载 ${env.name}`,
    'env-install',
    server.id,
    envDef.uninstallSteps
  )

  try {
    for (let i = 0; i < envDef.uninstallSteps.length; i++) {
      const step = envDef.uninstallSteps[i]
      taskStore.updateStep(task.id, i, 'running')
      taskStore.appendLog(task.id, `[${i + 1}/${envDef.uninstallSteps.length}] ${step.desc}\n`)
      taskStore.appendLog(task.id, `$ ${step.cmd}\n`)

      try {
        const result = await window.electronAPI.server.executeCommand(
          server.id, 'bash', ['-c', step.cmd], { timeout: 120 }
        )

        if (result.stdout) taskStore.appendLog(task.id, result.stdout + '\n')
        if (result.stderr) taskStore.appendLog(task.id, result.stderr + '\n')

        taskStore.updateStep(task.id, i, result.exit_code === 0 ? 'success' : 'failed')
        taskStore.appendLog(task.id, result.exit_code === 0 ? `✓ 完成\n\n` : `⚠️ 退出码: ${result.exit_code}\n\n`)
      } catch (e) {
        taskStore.updateStep(task.id, i, 'failed')
        taskStore.appendLog(task.id, `❌ 错误: ${(e as Error).message}\n\n`)
      }
    }

    taskStore.completeTask(task.id, true)
    ElMessage.success(`${env.name} 已卸载`)
    checkInstalledEnvs()
  } catch (e) {
    taskStore.completeTask(task.id, false)
    ElMessage.error('卸载失败')
  }
}

function showEnvInfo(env: EnvItem) {
  currentEnv.value = env
  showEnvDetail.value = true
}

onMounted(() => {
  if (serverStore.currentServer) {
    checkInstalledEnvs()
  }
})
</script>

<style lang="scss" scoped>
.environment {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  
  .header-left {
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { color: var(--text-secondary); font-size: 13px; }
  }
}

.no-server {
  padding: 60px 0;
}

.section {
  margin-bottom: 24px;
  
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    
    h2 {
      font-size: 15px;
      font-weight: 600;
      margin: 0;
    }
  }
}

.env-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.env-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  transition: all 0.2s;

  &:hover {
    border-color: var(--text-secondary);
  }

  &.installed {
    background: var(--bg-tertiary);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .env-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.large {
      width: 56px;
      height: 56px;
    }

    :deep(svg) {
      width: 26px;
      height: 26px;
    }
  }

  .env-info {
    flex: 1;
    min-width: 0;
  }

  .env-name {
    font-weight: 600;
    font-size: 14px;
  }

  .env-desc {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .env-version {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #22c55e;
    margin-top: 2px;
    
    .el-icon { font-size: 14px; }
  }

  .env-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 13px;
}

// 安装对话框
.install-dialog-content {
  .env-preview {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--bg-tertiary);
    border-radius: 10px;
    margin-bottom: 20px;
    
    .env-detail {
      .env-name { font-size: 18px; font-weight: 600; }
      .env-desc { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
    }
  }
  
  .install-form {
    .install-info {
      .info-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-secondary);
        
        .el-icon { color: var(--primary-color); }
      }
    }
  }
}

// 深色对话框
:deep(.dark-dialog) {
  .el-dialog {
    background: var(--bg-secondary) !important;
    border-radius: 12px;
  }
  .el-dialog__header {
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    padding: 14px 20px;
    margin: 0;
  }
  .el-dialog__body {
    padding: 20px;
  }
  .el-dialog__footer {
    padding: 14px 20px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-tertiary);
  }
  .el-descriptions {
    --el-descriptions-item-bordered-label-background: var(--bg-tertiary);
  }
  code {
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
}
</style>
