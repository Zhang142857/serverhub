<template>
  <div class="backup-page">
    <div class="page-header">
      <h1>备份管理</h1>
      <p class="subtitle">自动备份数据到云存储</p>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        创建备份策略
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon strategies">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ strategies.length }}</div>
            <div class="stat-label">备份策略</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon backups">
            <el-icon><FolderOpened /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ totalBackups }}</div>
            <div class="stat-label">备份总数</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon size">
            <el-icon><Coin /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ formatSize(totalSize) }}</div>
            <div class="stat-label">总大小</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab">
      <!-- 备份策略 -->
      <el-tab-pane label="备份策略" name="strategies">
        <el-table :data="strategies" style="width: 100%">
          <el-table-column prop="name" label="策略名称" width="200" />
          <el-table-column label="备份目标" width="300">
            <template #default="{ row }">
              <el-tag
                v-for="(target, index) in row.targets"
                :key="index"
                size="small"
                style="margin-right: 5px"
              >
                {{ getTargetLabel(target) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="调度" width="150">
            <template #default="{ row }">
              {{ getScheduleLabel(row.schedule) }}
            </template>
          </el-table-column>
          <el-table-column label="存储" width="120">
            <template #default="{ row }">
              <el-tag size="small">{{ row.storage.type.toUpperCase() }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最后备份" width="180">
            <template #default="{ row }">
              {{ row.lastBackup ? formatDate(row.lastBackup) : '从未' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" @change="toggleStrategy(row)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="runBackup(row)">
                <el-icon><VideoPlay /></el-icon>
                立即备份
              </el-button>
              <el-button size="small" @click="editStrategy(row)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button size="small" type="danger" @click="deleteStrategy(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 备份记录 -->
      <el-tab-pane label="备份记录" name="records">
        <div class="filter-bar">
          <el-select v-model="filterStrategy" placeholder="筛选策略" clearable>
            <el-option
              v-for="strategy in strategies"
              :key="strategy.id"
              :label="strategy.name"
              :value="strategy.id"
            />
          </el-select>
          <el-select v-model="filterStatus" placeholder="筛选状态" clearable>
            <el-option label="全部" value="" />
            <el-option label="成功" value="completed" />
            <el-option label="失败" value="failed" />
            <el-option label="运行中" value="running" />
          </el-select>
        </div>

        <el-table :data="filteredRecords" style="width: 100%">
          <el-table-column prop="strategyName" label="策略名称" width="180" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag
                :type="getStatusType(row.status)"
                size="small"
              >
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="filename" label="文件名" width="300" />
          <el-table-column label="大小" width="120">
            <template #default="{ row }">
              {{ formatSize(row.size) }}
            </template>
          </el-table-column>
          <el-table-column label="开始时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.startTime) }}
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="100">
            <template #default="{ row }">
              {{ row.duration ? formatDuration(row.duration) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                size="small"
                :disabled="row.status !== 'completed'"
                @click="showRestoreDialog(row)"
              >
                <el-icon><RefreshRight /></el-icon>
                恢复
              </el-button>
              <el-button size="small" @click="showLogs(row)">
                <el-icon><Document /></el-icon>
                日志
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click="deleteRecord(row)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建/编辑备份策略对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingStrategy ? '编辑备份策略' : '创建备份策略'"
      width="800px"
    >
      <el-form :model="strategyForm" label-width="120px">
        <el-form-item label="策略名称">
          <el-input v-model="strategyForm.name" placeholder="例如：每日数据库备份" />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="strategyForm.description"
            type="textarea"
            placeholder="备份策略描述"
          />
        </el-form-item>

        <el-form-item label="备份目标">
          <el-button size="small" @click="addTarget">
            <el-icon><Plus /></el-icon>
            添加目标
          </el-button>
          <div v-for="(target, index) in strategyForm.targets" :key="index" class="target-item">
            <el-select v-model="target.type" placeholder="类型">
              <el-option label="文件/目录" value="files" />
              <el-option label="数据库" value="database" />
              <el-option label="Docker容器" value="docker" />
              <el-option label="配置文件" value="config" />
            </el-select>
            <el-input
              v-if="target.type === 'files'"
              v-model="target.path"
              placeholder="/path/to/backup"
            />
            <el-input
              v-if="target.type === 'database'"
              v-model="target.database"
              placeholder="数据库名称"
            />
            <el-input
              v-if="target.type === 'docker'"
              v-model="target.container"
              placeholder="容器名称"
            />
            <el-button size="small" type="danger" @click="removeTarget(index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="调度类型">
          <el-select v-model="strategyForm.schedule.type">
            <el-option label="手动" value="manual" />
            <el-option label="每日" value="daily" />
            <el-option label="每周" value="weekly" />
            <el-option label="每月" value="monthly" />
            <el-option label="自定义Cron" value="cron" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="strategyForm.schedule.type === 'daily'" label="时间">
          <el-time-picker
            v-model="strategyForm.schedule.time"
            format="HH:mm"
            placeholder="选择时间"
          />
        </el-form-item>

        <el-form-item v-if="strategyForm.schedule.type === 'cron'" label="Cron表达式">
          <el-input v-model="strategyForm.schedule.cron" placeholder="0 2 * * *" />
        </el-form-item>

        <el-form-item label="存储类型">
          <el-select v-model="strategyForm.storage.type">
            <el-option label="本地存储" value="local" />
            <el-option label="阿里云OSS" value="oss" />
            <el-option label="腾讯云COS" value="cos" />
            <el-option label="AWS S3" value="s3" />
          </el-select>
        </el-form-item>

        <el-form-item label="存储路径">
          <el-input v-model="strategyForm.storage.path" placeholder="/backup" />
        </el-form-item>

        <el-form-item label="压缩">
          <el-switch v-model="strategyForm.compression" />
        </el-form-item>

        <el-form-item label="加密">
          <el-switch v-model="strategyForm.encryption.enabled" />
          <el-input
            v-if="strategyForm.encryption.enabled"
            v-model="strategyForm.encryption.password"
            type="password"
            placeholder="加密密码"
            style="margin-top: 10px"
          />
        </el-form-item>

        <el-form-item label="保留策略">
          <el-input-number
            v-model="strategyForm.retention.keepLast"
            :min="1"
            :max="100"
          />
          <span style="margin-left: 10px">保留最近N个备份</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveStrategy">保存</el-button>
      </template>
    </el-dialog>

    <!-- 恢复备份对话框 -->
    <el-dialog v-model="showRestoreDialogVisible" title="恢复备份" width="600px">
      <el-form :model="restoreForm" label-width="120px">
        <el-form-item label="备份文件">
          <el-input :value="restoreForm.backupId" disabled />
        </el-form-item>
        <el-form-item label="目标路径">
          <el-input v-model="restoreForm.targetPath" placeholder="留空使用原路径" />
        </el-form-item>
        <el-form-item label="覆盖已存在">
          <el-switch v-model="restoreForm.overwrite" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showRestoreDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="restoreBackup">恢复</el-button>
      </template>
    </el-dialog>

    <!-- 日志对话框 -->
    <el-dialog v-model="showLogsDialog" title="备份日志" width="800px">
      <div class="logs-container">
        <div v-for="(log, index) in currentLogs" :key="index" class="log-line">
          {{ log }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Edit,
  Delete,
  VideoPlay,
  Document,
  FolderOpened,
  Coin,
  RefreshRight,
  Search
} from '@element-plus/icons-vue'
import type { BackupStrategy, BackupRecord, BackupTarget, RestoreOptions } from '@/types/backup'

const activeTab = ref('strategies')
const showCreateDialog = ref(false)
const showRestoreDialogVisible = ref(false)
const showLogsDialog = ref(false)
const editingStrategy = ref<BackupStrategy | null>(null)
const currentLogs = ref<string[]>([])

// 筛选
const filterStrategy = ref('')
const filterStatus = ref('')

// 数据
const strategies = ref<BackupStrategy[]>([])
const records = ref<BackupRecord[]>([])

// 表单
const strategyForm = ref({
  name: '',
  description: '',
  targets: [] as BackupTarget[],
  schedule: {
    type: 'manual',
    time: '',
    cron: ''
  },
  storage: {
    type: 'local',
    path: '/backup'
  },
  compression: true,
  encryption: {
    enabled: false,
    password: ''
  },
  retention: {
    keepLast: 7
  }
})

const restoreForm = ref<RestoreOptions>({
  backupId: '',
  serverId: '',
  targetPath: '',
  overwrite: false
})

// 计算属性
const totalBackups = computed(() => records.value.length)
const totalSize = computed(() => records.value.reduce((sum, r) => sum + r.size, 0))

const filteredRecords = computed(() => {
  let result = records.value
  if (filterStrategy.value) {
    result = result.filter(r => r.strategyId === filterStrategy.value)
  }
  if (filterStatus.value) {
    result = result.filter(r => r.status === filterStatus.value)
  }
  return result
})

// 方法
const addTarget = () => {
  strategyForm.value.targets.push({
    type: 'files',
    path: ''
  } as BackupTarget)
}

const removeTarget = (index: number) => {
  strategyForm.value.targets.splice(index, 1)
}

const saveStrategy = async () => {
  // TODO: 调用API保存策略
  ElMessage.success('备份策略已保存')
  showCreateDialog.value = false
}

const editStrategy = (strategy: BackupStrategy) => {
  editingStrategy.value = strategy
  // TODO: 填充表单
  showCreateDialog.value = true
}

const deleteStrategy = async (strategy: BackupStrategy) => {
  await ElMessageBox.confirm('确定要删除此备份策略吗？', '确认删除', {
    type: 'warning'
  })
  // TODO: 调用API删除
  ElMessage.success('备份策略已删除')
}

const toggleStrategy = async (strategy: BackupStrategy) => {
  // TODO: 调用API切换状态
  ElMessage.success(strategy.enabled ? '备份策略已启用' : '备份策略已禁用')
}

const runBackup = async (strategy: BackupStrategy) => {
  // TODO: 调用API执行备份
  ElMessage.success('备份任务已启动')
}

const showRestoreDialog = (record: BackupRecord) => {
  restoreForm.value.backupId = record.id
  restoreForm.value.serverId = record.serverId
  showRestoreDialogVisible.value = true
}

const restoreBackup = async () => {
  // TODO: 调用API恢复备份
  ElMessage.success('备份恢复已启动')
  showRestoreDialogVisible.value = false
}

const deleteRecord = async (record: BackupRecord) => {
  await ElMessageBox.confirm('确定要删除此备份记录吗？', '确认删除', {
    type: 'warning'
  })
  // TODO: 调用API删除
  ElMessage.success('备份记录已删除')
}

const showLogs = (record: BackupRecord) => {
  currentLogs.value = record.logs || []
  showLogsDialog.value = true
}

// 辅助函数
const getTargetLabel = (target: BackupTarget): string => {
  switch (target.type) {
    case 'files':
      return `文件: ${target.path}`
    case 'database':
      return `数据库: ${target.database}`
    case 'docker':
      return `容器: ${target.container}`
    case 'config':
      return '配置文件'
    default:
      return target.type
  }
}

const getScheduleLabel = (schedule: any): string => {
  switch (schedule.type) {
    case 'manual':
      return '手动'
    case 'daily':
      return `每日 ${schedule.time}`
    case 'weekly':
      return `每周 ${schedule.dayOfWeek}`
    case 'monthly':
      return `每月 ${schedule.dayOfMonth}日`
    case 'cron':
      return schedule.cron
    default:
      return schedule.type
  }
}

const getStatusType = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    case 'running':
      return 'warning'
    default:
      return 'info'
  }
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'completed':
      return '成功'
    case 'failed':
      return '失败'
    case 'running':
      return '运行中'
    case 'pending':
      return '等待中'
    default:
      return status
  }
}

const formatSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleString('zh-CN')
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

onMounted(() => {
  // TODO: 加载数据
})
</script>

<style scoped>
.backup-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
}

.subtitle {
  color: #666;
  margin: 5px 0 0 0;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  cursor: default;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon.strategies {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-icon.backups {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-icon.size {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.target-item {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  align-items: center;
}

.logs-container {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 15px;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-line {
  margin-bottom: 5px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
