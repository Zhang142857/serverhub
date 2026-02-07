<template>
  <div class="app-store-page">
    <div class="page-header">
      <h1>应用商店</h1>
      <p class="subtitle">一键部署常用应用</p>
    </div>

    <!-- 搜索和筛选 -->
    <div class="search-bar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索应用..."
        clearable
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      
      <el-select v-model="selectedCategory" placeholder="分类" @change="filterApps">
        <el-option label="全部" value="" />
        <el-option label="Web应用" value="web" />
        <el-option label="数据库" value="database" />
        <el-option label="缓存" value="cache" />
        <el-option label="消息队列" value="mq" />
        <el-option label="监控" value="monitoring" />
        <el-option label="DevOps" value="devops" />
        <el-option label="存储" value="storage" />
        <el-option label="网络工具" value="network" />
        <el-option label="安全工具" value="security" />
      </el-select>
      
      <el-select v-model="sortBy" placeholder="排序">
        <el-option label="最热门" value="downloads" />
        <el-option label="评分最高" value="rating" />
        <el-option label="名称" value="name" />
      </el-select>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon available">
            <el-icon><Box /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ availableApps.length }}</div>
            <div class="stat-label">可用应用</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon installed">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ installedApps.length }}</div>
            <div class="stat-label">已安装</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon running">
            <el-icon><VideoPlay /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ runningApps }}</div>
            <div class="stat-label">运行中</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab">
      <!-- 应用商店 -->
      <el-tab-pane label="应用商店" name="store">
        <div class="app-grid">
          <el-card
            v-for="app in filteredApps"
            :key="app.id"
            class="app-card"
            @click="showAppDetail(app)"
          >
            <div class="app-icon">{{ app.icon }}</div>
            <h3 class="app-name">{{ app.displayName }}</h3>
            <p class="app-desc">{{ app.description }}</p>
            
            <div class="app-meta">
              <el-tag size="small">{{ getCategoryLabel(app.category) }}</el-tag>
              <span class="app-version">v{{ app.version }}</span>
            </div>

            <div class="app-stats">
              <span class="stat-item">
                <el-icon><Download /></el-icon>
                {{ formatNumber(app.downloads) }}
              </span>
              <el-rate v-model="app.rating" disabled size="small" />
            </div>

            <el-button
              type="primary"
              class="install-btn"
              @click.stop="showDeployDialog(app)"
            >
              <el-icon><Plus /></el-icon>
              一键部署
            </el-button>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- 已安装应用 -->
      <el-tab-pane label="已安装" name="installed">
        <el-table :data="installedApps" stripe>
          <el-table-column prop="displayName" label="应用名称" min-width="150" />
          <el-table-column prop="name" label="实例名称" min-width="150" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="访问地址" min-width="200">
            <template #default="{ row }">
              <el-link v-if="row.accessUrl" :href="row.accessUrl" target="_blank" type="primary">
                {{ row.accessUrl }}
              </el-link>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="安装时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.installedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'stopped'"
                text
                size="small"
                type="success"
                @click="startApp(row)"
              >
                启动
              </el-button>
              <el-button
                v-if="row.status === 'running'"
                text
                size="small"
                type="warning"
                @click="stopApp(row)"
              >
                停止
              </el-button>
              <el-button text size="small" @click="viewLogs(row)">
                日志
              </el-button>
              <el-button text size="small" type="danger" @click="uninstallApp(row)">
                卸载
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 部署对话框 -->
    <el-dialog
      v-model="showDeployForm"
      :title="`部署 ${selectedApp?.displayName}`"
      width="600px"
      @close="resetDeployForm"
    >
      <el-form
        v-if="selectedApp"
        :model="deployForm"
        label-width="120px"
        ref="deployFormRef"
      >
        <el-form-item label="实例名称" required>
          <el-input
            v-model="deployForm.name"
            placeholder="例如: my-wordpress"
          />
        </el-form-item>

        <el-form-item label="服务器" required>
          <el-select v-model="deployForm.serverId" placeholder="选择服务器">
            <el-option
              v-for="server in servers"
              :key="server.id"
              :label="server.name"
              :value="server.id"
            />
          </el-select>
        </el-form-item>

        <el-divider>应用配置</el-divider>

        <el-form-item
          v-for="field in selectedApp.configForm"
          :key="field.name"
          :label="field.label"
          :required="field.required"
        >
          <el-input
            v-if="field.type === 'text' || field.type === 'password'"
            v-model="deployForm.config[field.name]"
            :type="field.type"
            :placeholder="field.placeholder || field.description"
          />
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="deployForm.config[field.name]"
            :min="field.validation?.min"
            :max="field.validation?.max"
          />
          <el-select
            v-else-if="field.type === 'select'"
            v-model="deployForm.config[field.name]"
            :placeholder="field.placeholder"
          >
            <el-option
              v-for="option in field.options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-switch
            v-else-if="field.type === 'boolean'"
            v-model="deployForm.config[field.name]"
          />
          <div v-if="field.description" class="field-desc">
            {{ field.description }}
          </div>
        </el-form-item>

        <el-form-item label="自动启动">
          <el-switch v-model="deployForm.autoStart" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showDeployForm = false">取消</el-button>
        <el-button type="primary" @click="deployApp" :loading="deploying">
          开始部署
        </el-button>
      </template>
    </el-dialog>

    <!-- 应用详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      :title="selectedApp?.displayName"
      width="800px"
    >
      <div v-if="selectedApp" class="app-detail">
        <div class="detail-header">
          <div class="app-icon-large">{{ selectedApp.icon }}</div>
          <div class="detail-info">
            <h2>{{ selectedApp.displayName }}</h2>
            <p>{{ selectedApp.description }}</p>
            <div class="detail-meta">
              <el-tag>{{ getCategoryLabel(selectedApp.category) }}</el-tag>
              <span>版本: {{ selectedApp.version }}</span>
              <span>作者: {{ selectedApp.author }}</span>
            </div>
          </div>
        </div>

        <el-divider />

        <div class="detail-section">
          <h3>标签</h3>
          <el-tag
            v-for="tag in selectedApp.tags"
            :key="tag"
            style="margin-right: 8px"
          >
            {{ tag }}
          </el-tag>
        </div>

        <div v-if="selectedApp.requirements" class="detail-section">
          <h3>系统要求</h3>
          <ul>
            <li v-if="selectedApp.requirements.memory">
              内存: {{ selectedApp.requirements.memory }}MB
            </li>
            <li v-if="selectedApp.requirements.cpu">
              CPU: {{ selectedApp.requirements.cpu }}核
            </li>
            <li v-if="selectedApp.requirements.disk">
              磁盘: {{ selectedApp.requirements.disk }}MB
            </li>
          </ul>
        </div>

        <div class="detail-section">
          <h3>统计信息</h3>
          <p>下载次数: {{ formatNumber(selectedApp.downloads) }}</p>
          <p>
            评分:
            <el-rate v-model="selectedApp.rating" disabled />
          </p>
        </div>

        <div v-if="selectedApp.homepage || selectedApp.documentation" class="detail-section">
          <h3>相关链接</h3>
          <el-link
            v-if="selectedApp.homepage"
            :href="selectedApp.homepage"
            target="_blank"
            type="primary"
          >
            官方网站
          </el-link>
          <el-link
            v-if="selectedApp.documentation"
            :href="selectedApp.documentation"
            target="_blank"
            type="primary"
            style="margin-left: 16px"
          >
            文档
          </el-link>
        </div>
      </div>

      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button type="primary" @click="showDeployDialog(selectedApp!)">
          部署此应用
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Box,
  CircleCheck,
  VideoPlay,
  Download,
  Plus
} from '@element-plus/icons-vue'
import type { AppTemplate, AppInstance } from '@/types/app-store'

const searchQuery = ref('')
const selectedCategory = ref('')
const sortBy = ref('downloads')
const activeTab = ref('store')
const showDeployForm = ref(false)
const showDetailDialog = ref(false)
const deploying = ref(false)
const selectedApp = ref<AppTemplate | null>(null)
const deployFormRef = ref()

const availableApps = ref<AppTemplate[]>([])
const installedApps = ref<AppInstance[]>([])
const servers = ref<any[]>([])

const deployForm = ref({
  name: '',
  serverId: '',
  config: {} as Record<string, any>,
  autoStart: true
})

const runningApps = computed(() => {
  return installedApps.value.filter(app => app.status === 'running').length
})

const filteredApps = computed(() => {
  let apps = availableApps.value

  // 分类过滤
  if (selectedCategory.value) {
    apps = apps.filter(app => app.category === selectedCategory.value)
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    apps = apps.filter(app =>
      app.name.toLowerCase().includes(query) ||
      app.displayName.toLowerCase().includes(query) ||
      app.description.toLowerCase().includes(query) ||
      app.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }

  // 排序
  apps = [...apps].sort((a, b) => {
    if (sortBy.value === 'downloads') {
      return b.downloads - a.downloads
    } else if (sortBy.value === 'rating') {
      return b.rating - a.rating
    } else {
      return a.displayName.localeCompare(b.displayName)
    }
  })

  return apps
})

onMounted(async () => {
  await loadApps()
  await loadInstalledApps()
  await loadServers()
})

async function loadApps() {
  try {
    // TODO: 从后端加载应用模板
    availableApps.value = []
  } catch (error: any) {
    ElMessage.error('加载应用失败: ' + error.message)
  }
}

async function loadInstalledApps() {
  try {
    // TODO: 从后端加载已安装应用
    installedApps.value = []
  } catch (error: any) {
    ElMessage.error('加载已安装应用失败: ' + error.message)
  }
}

async function loadServers() {
  try {
    // TODO: 从后端加载服务器列表
    servers.value = []
  } catch (error: any) {
    ElMessage.error('加载服务器列表失败: ' + error.message)
  }
}

function showAppDetail(app: AppTemplate) {
  selectedApp.value = app
  showDetailDialog.value = true
}

function showDeployDialog(app: AppTemplate) {
  selectedApp.value = app
  showDetailDialog.value = false
  
  // 初始化配置表单
  deployForm.value.config = {}
  app.configForm.forEach(field => {
    if (field.default !== undefined) {
      deployForm.value.config[field.name] = field.default
    }
  })
  
  showDeployForm.value = true
}

function resetDeployForm() {
  deployForm.value = {
    name: '',
    serverId: '',
    config: {},
    autoStart: true
  }
}

async function deployApp() {
  if (!selectedApp.value) return

  // 验证表单
  if (!deployForm.value.name) {
    ElMessage.warning('请输入实例名称')
    return
  }

  if (!deployForm.value.serverId) {
    ElMessage.warning('请选择服务器')
    return
  }

  deploying.value = true
  try {
    // TODO: 调用部署API
    await new Promise(resolve => setTimeout(resolve, 2000))

    ElMessage.success('应用部署成功')
    showDeployForm.value = false
    await loadInstalledApps()
    activeTab.value = 'installed'
  } catch (error: any) {
    ElMessage.error('部署失败: ' + error.message)
  } finally {
    deploying.value = false
  }
}

async function startApp(app: AppInstance) {
  try {
    // TODO: 调用启动API
    ElMessage.success(`${app.displayName} 启动成功`)
    await loadInstalledApps()
  } catch (error: any) {
    ElMessage.error('启动失败: ' + error.message)
  }
}

async function stopApp(app: AppInstance) {
  try {
    // TODO: 调用停止API
    ElMessage.success(`${app.displayName} 已停止`)
    await loadInstalledApps()
  } catch (error: any) {
    ElMessage.error('停止失败: ' + error.message)
  }
}

async function uninstallApp(app: AppInstance) {
  try {
    await ElMessageBox.confirm(
      `确定要卸载 "${app.displayName}" 吗？此操作不可恢复。`,
      '确认卸载',
      {
        type: 'warning'
      }
    )

    // TODO: 调用卸载API
    ElMessage.success(`${app.displayName} 已卸载`)
    await loadInstalledApps()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('卸载失败: ' + error.message)
    }
  }
}

function viewLogs(app: AppInstance) {
  ElMessage.info('查看日志功能开发中')
}

function filterApps() {
  // 触发计算属性重新计算
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    web: 'Web应用',
    database: '数据库',
    cache: '缓存',
    mq: '消息队列',
    monitoring: '监控',
    devops: 'DevOps',
    storage: '存储',
    network: '网络',
    security: '安全',
    other: '其他'
  }
  return labels[category] || category
}

function getStatusType(status: string) {
  const types: Record<string, any> = {
    running: 'success',
    stopped: 'info',
    installing: 'warning',
    error: 'danger'
  }
  return types[status] || 'info'
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    available: '可用',
    installing: '安装中',
    installed: '已安装',
    running: '运行中',
    stopped: '已停止',
    error: '错误'
  }
  return labels[status] || status
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('zh-CN')
}
</script>

<style scoped>
.app-store-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 4px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 14px;
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.search-input {
  flex: 1;
  max-width: 400px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.stat-icon.available {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-icon.installed {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-icon.running {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.app-card {
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
  padding: 24px;
}

.app-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.app-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.app-name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.app-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  min-height: 40px;
}

.app-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.app-version {
  font-size: 12px;
  color: var(--text-tertiary);
}

.app-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.install-btn {
  width: 100%;
}

.field-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.app-detail {
  padding: 16px;
}

.detail-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.app-icon-large {
  font-size: 80px;
}

.detail-info h2 {
  margin: 0 0 8px 0;
}

.detail-meta {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h3 {
  font-size: 16px;
  margin-bottom: 12px;
}

.detail-section ul {
  margin: 0;
  padding-left: 20px;
}

.detail-section li {
  margin-bottom: 8px;
}
</style>
