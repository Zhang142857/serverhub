<template>
  <div class="environment">
    <div class="page-header">
      <h1>环境管理</h1>
      <p class="subtitle">一键安装运行环境</p>
    </div>

    <div v-if="!serverStore.currentServer" class="no-server">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <template v-else>
      <!-- 已安装环境 -->
      <div class="section">
        <h2>已安装环境</h2>
        <div class="env-grid" v-loading="checking">
          <div v-for="env in installedEnvs" :key="env.name" class="env-card installed">
            <div class="env-icon" :style="{ background: env.color }">
              <TechIcon :name="env.iconName" />
            </div>
            <div class="env-info">
              <div class="env-name">{{ env.name }}</div>
              <div class="env-version">{{ env.version }}</div>
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
        <h2>可安装环境</h2>
        <div class="env-grid">
          <div v-for="env in availableEnvs" :key="env.name" class="env-card">
            <div class="env-icon" :style="{ background: env.color }">
              <TechIcon :name="env.iconName" />
            </div>
            <div class="env-info">
              <div class="env-name">{{ env.name }}</div>
              <div class="env-desc">{{ env.description }}</div>
            </div>
            <div class="env-actions">
              <el-button size="small" type="primary" @click="installEnv(env)" :loading="env.installing">
                {{ env.installing ? '安装中' : '安装' }}
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 安装日志对话框 -->
    <el-dialog v-model="showInstallLog" title="安装日志" width="700px" class="dark-dialog">
      <div class="install-log">
        <pre ref="logPre">{{ installLog }}</pre>
      </div>
      <template #footer>
        <el-button size="small" @click="showInstallLog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 环境详情对话框 -->
    <el-dialog v-model="showEnvDetail" :title="currentEnv?.name + ' 详情'" width="500px" class="dark-dialog">
      <el-descriptions :column="1" border v-if="currentEnv">
        <el-descriptions-item label="名称">{{ currentEnv.name }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ currentEnv.version }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ currentEnv.description }}</el-descriptions-item>
        <el-descriptions-item label="检查命令">
          <code>{{ currentEnv.checkCmd }}</code>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button size="small" @click="showEnvDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import TechIcon from '@/components/icons/TechIcons.vue'

interface EnvItem {
  name: string
  iconName: string
  color: string
  description: string
  version?: string
  installCmd: string
  checkCmd: string
  installing?: boolean
}

const serverStore = useServerStore()
const showInstallLog = ref(false)
const showEnvDetail = ref(false)
const installLog = ref('')
const logPre = ref<HTMLPreElement | null>(null)
const installedEnvs = ref<EnvItem[]>([])
const currentEnv = ref<EnvItem | null>(null)
const checking = ref(false)

const availableEnvs = ref<EnvItem[]>([
  {
    name: 'Node.js',
    iconName: 'nodejs',
    color: '#68a063',
    description: 'JavaScript 运行时',
    installCmd: 'curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh && sudo bash /tmp/nodesource_setup.sh && sudo apt-get install -y nodejs',
    checkCmd: 'node --version'
  },
  {
    name: 'Python',
    iconName: 'python',
    color: '#3776ab',
    description: 'Python 解释器',
    installCmd: 'sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv',
    checkCmd: 'python3 --version'
  },
  {
    name: 'Docker',
    iconName: 'docker',
    color: '#2496ed',
    description: '容器运行时',
    installCmd: 'curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sudo sh /tmp/get-docker.sh',
    checkCmd: 'docker --version'
  },
  {
    name: 'Nginx',
    iconName: 'nginx',
    color: '#009639',
    description: 'Web 服务器',
    installCmd: 'sudo apt-get update && sudo apt-get install -y nginx',
    checkCmd: 'nginx -v 2>&1'
  },
  {
    name: 'MySQL',
    iconName: 'mysql',
    color: '#4479a1',
    description: '关系型数据库',
    installCmd: 'sudo apt-get update && sudo apt-get install -y mysql-server',
    checkCmd: 'mysql --version'
  },
  {
    name: 'Redis',
    iconName: 'redis',
    color: '#dc382d',
    description: '内存数据库',
    installCmd: 'sudo apt-get update && sudo apt-get install -y redis-server',
    checkCmd: 'redis-server --version'
  },
  {
    name: 'PostgreSQL',
    iconName: 'postgresql',
    color: '#336791',
    description: '关系型数据库',
    installCmd: 'sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib',
    checkCmd: 'psql --version'
  },
  {
    name: 'Go',
    iconName: 'go',
    color: '#00add8',
    description: 'Go 语言环境',
    installCmd: 'sudo apt-get update && sudo apt-get install -y golang-go',
    checkCmd: 'go version'
  },
  {
    name: 'Java',
    iconName: 'java',
    color: '#f89820',
    description: 'Java 运行环境',
    installCmd: 'sudo apt-get update && sudo apt-get install -y default-jdk',
    checkCmd: 'java --version 2>&1'
  },
  {
    name: 'PHP',
    iconName: 'php',
    color: '#777bb4',
    description: 'PHP 解释器',
    installCmd: 'sudo apt-get update && sudo apt-get install -y php php-fpm php-mysql php-curl php-gd php-mbstring',
    checkCmd: 'php --version'
  },
  {
    name: 'MongoDB',
    iconName: 'mongodb',
    color: '#47a248',
    description: 'NoSQL 数据库',
    installCmd: 'sudo apt-get update && sudo apt-get install -y mongodb',
    checkCmd: 'mongod --version 2>&1'
  },
  {
    name: 'Git',
    iconName: 'git',
    color: '#f05032',
    description: '版本控制',
    installCmd: 'sudo apt-get update && sudo apt-get install -y git',
    checkCmd: 'git --version'
  }
])

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

  for (const env of availableEnvs.value) {
    try {
      const result = await window.electronAPI.server.executeCommand(
        server.id,
        'bash',
        ['-c', env.checkCmd]
      )
      if (result.exit_code === 0) {
        const stdout = result.stdout || ''
        const version = stdout.trim().split('\n')[0]
        installedEnvs.value.push({ ...env, version })
      }
    } catch (e) {
      // 未安装，忽略
    }
  }

  checking.value = false
}

async function installEnv(env: EnvItem) {
  const server = serverStore.currentServer
  if (!server) {
    ElMessage.warning('请先选择服务器')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定在 ${server.name} 上安装 ${env.name}？`,
      '确认安装',
      { type: 'info' }
    )
  } catch {
    return
  }

  env.installing = true
  installLog.value = `正在安装 ${env.name}...\n\n`
  showInstallLog.value = true

  try {
    const result = await window.electronAPI.server.executeCommand(
      server.id,
      'bash',
      ['-c', env.installCmd],
      { timeout: 600 }  // 10 分钟超时
    )

    installLog.value += result.stdout || ''
    if (result.stderr) {
      installLog.value += '\n' + result.stderr
    }

    // 滚动到底部
    await nextTick()
    if (logPre.value) {
      logPre.value.scrollTop = logPre.value.scrollHeight
    }

    if (result.exit_code === 0) {
      installLog.value += '\n\n✓ 安装成功！'
      ElMessage.success(`${env.name} 安装成功`)
      checkInstalledEnvs()
    } else {
      installLog.value += `\n\n✗ 安装失败 (退出码: ${result.exit_code})`
      ElMessage.error(`${env.name} 安装失败`)
    }
  } catch (e) {
    installLog.value += '\n\n错误: ' + (e as Error).message
    ElMessage.error('安装失败: ' + (e as Error).message)
  } finally {
    env.installing = false
  }
}

async function uninstallEnv(env: EnvItem) {
  try {
    await ElMessageBox.confirm(
      `确定卸载 ${env.name}？这可能会影响依赖它的服务。`,
      '确认卸载',
      { type: 'warning' }
    )
  } catch {
    return
  }

  ElMessage.info('卸载功能开发中')
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
  margin-bottom: 20px;
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

.no-server {
  padding: 60px 0;
}

.section {
  margin-bottom: 24px;
  h2 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text-color);
  }
}

.env-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.env-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-color);
  }

  &.installed {
    background: var(--bg-tertiary);
  }

  .env-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    :deep(svg) {
      width: 24px;
      height: 24px;
    }
  }

  .env-info {
    flex: 1;
    min-width: 0;
  }

  .env-name {
    font-weight: 500;
    font-size: 14px;
    color: var(--text-color);
  }

  .env-desc,
  .env-version {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .env-actions {
    display: flex;
    gap: 4px;
  }
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 30px;
  color: var(--text-secondary);
  font-size: 13px;
}

.install-log {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 12px;
  max-height: 400px;
  overflow: auto;

  pre {
    margin: 0;
    font-size: 12px;
    color: var(--text-color);
    white-space: pre-wrap;
    word-break: break-all;
    font-family: 'Consolas', 'Monaco', monospace;
  }
}

// 深色对话框样式
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
  .el-descriptions {
    --el-descriptions-item-bordered-label-background: var(--bg-tertiary);
  }
  .el-descriptions__label {
    color: var(--text-secondary);
  }
  .el-descriptions__content {
    color: var(--text-color);
  }
  code {
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
}
</style>
