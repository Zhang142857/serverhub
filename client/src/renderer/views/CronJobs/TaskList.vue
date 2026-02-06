<template>
  <div class="cron-jobs-page">
    <div class="page-header">
      <h1>计划任务</h1>
      <p class="subtitle">自动化任务调度管理</p>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        创建任务
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon total">
            <el-icon><Clock /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ tasks.length }}</div>
            <div class="stat-label">总任务数</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon enabled">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ enabledTasks }}</div>
            <div class="stat-label">已启用</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon success">
            <el-icon><SuccessFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ successRate }}%</div>
            <div class="stat-label">成功率</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab">
      <!-- 任务列表 -->
      <el-tab-pane label="任务列表" name="tasks">
        <el-table :data="tasks" style="width: 100%">
          <el-table-column prop="name" label="任务名称" width="200" />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ getTypeLabel(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="调度" width="150">
            <template #default="{ row }">
              {{ getScheduleLabel(row.schedule) }}
            </template>
          </el-table-column>
          <el-table-column label="最后执行" width="180">
            <template #default="{ row }">
              {{ row.lastRun ? formatDate(row.lastRun) : '从未' }}
            </template>
          </el-table-column>
          <el-table-column label="下次执行" width="180">
            <template #default="{ row }">
              {{ row.nextRun ? formatDate(row.nextRun) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag
                :type="getStatusType(row.lastStatus)"
                size="small"
              >
                {{ getStatusLabel(row.lastStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" @change="toggleTask(row)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="250" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="runTask(row)">
                <el-icon><VideoPlay /></el-icon>
                立即执行
              </el-button>
              <el-button size="small" @click="editTask(row)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button size="small" type="danger" @click="deleteTask(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 执行历史 -->
      <el-tab-pane label="执行历史" name="history">
        <div class="filter-bar">
          <el-select v-model="filterTask" placeholder="筛选任务" clearable>
            <el-option
              v-for="task in tasks"
              :key="task.id"
              :label="task.name"
              :value="task.id"
            />
          </el-select>
          <el-select v-model="filterStatus" placeholder="筛选状态" clearable>
            <el-option label="全部" value="" />
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failure" />
            <el-option label="运行中" value="running" />
          </el-select>
        </div>

        <el-table :data="filteredHistory" style="width: 100%">
          <el-table-column prop="taskName" label="任务名称" width="200" />
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
          <el-table-column label="触发方式" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="row.triggeredBy === 'manual' ? 'warning' : 'info'">
                {{ row.triggeredBy === 'manual' ? '手动' : '自动' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="退出码" width="80">
            <template #default="{ row }">
              {{ row.exitCode ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="showOutput(row)">
                <el-icon><Document /></el-icon>
                查看输出
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建/编辑任务对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingTask ? '编辑任务' : '创建任务'"
      width="800px"
    >
      <el-form :model="taskForm" label-width="120px">
        <el-form-item label="任务名称">
          <el-input v-model="taskForm.name" placeholder="例如：每日数据库备份" />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="taskForm.description"
            type="textarea"
            placeholder="任务描述"
          />
        </el-form-item>

        <el-form-item label="任务类型">
          <el-select v-model="taskForm.type">
            <el-option label="Shell命令" value="shell" />
            <el-option label="HTTP请求" value="http" />
            <el-option label="备份任务" value="backup" />
            <el-option label="清理任务" value="cleanup" />
            <el-option label="脚本执行" value="script" />
          </el-select>
        </el-form-item>

        <!-- Shell任务配置 -->
        <template v-if="taskForm.type === 'shell'">
          <el-form-item label="命令">
            <el-input v-model="taskForm.config.command" placeholder="ls -la" />
          </el-form-item>
          <el-form-item label="工作目录">
            <el-input v-model="taskForm.config.workdir" placeholder="/home" />
          </el-form-item>
        </template>

        <!-- HTTP任务配置 -->
        <template v-if="taskForm.type === 'http'">
          <el-form-item label="URL">
            <el-input v-model="taskForm.config.url" placeholder="https://api.example.com" />
          </el-form-item>
          <el-form-item label="方法">
            <el-select v-model="taskForm.config.method">
              <el-option label="GET" value="GET" />
              <el-option label="POST" value="POST" />
              <el-option label="PUT" value="PUT" />
              <el-option label="DELETE" value="DELETE" />
            </el-select>
          </el-form-item>
        </template>

        <el-form-item label="调度类型">
          <el-select v-model="taskForm.schedule.type">
            <el-option label="Cron表达式" value="cron" />
            <el-option label="固定间隔" value="interval" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="taskForm.schedule.type === 'cron'" label="Cron表达式">
          <el-input v-model="taskForm.schedule.cron" placeholder="0 2 * * *">
            <template #append>
              <el-button @click="showCronBuilder = true">构建器</el-button>
            </template>
          </el-input>
          <div class="cron-description">
            {{ cronDescription }}
          </div>
        </el-form-item>

        <el-form-item v-if="taskForm.schedule.type === 'interval'" label="间隔(秒)">
          <el-input-number v-model="taskForm.schedule.interval" :min="60" :max="86400" />
        </el-form-item>

        <el-form-item label="通知">
          <el-checkbox v-model="taskForm.notification.onSuccess">成功时通知</el-checkbox>
          <el-checkbox v-model="taskForm.notification.onFailure">失败时通知</el-checkbox>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveTask">保存</el-button>
      </template>
    </el-dialog>

    <!-- 输出对话框 -->
    <el-dialog v-model="showOutputDialog" title="任务输出" width="800px">
      <el-tabs v-model="outputTab">
        <el-tab-pane label="标准输出" name="stdout">
          <div class="output-container">
            {{ currentOutput.stdout || '(无输出)' }}
          </div>
        </el-tab-pane>
        <el-tab-pane label="标准错误" name="stderr">
          <div class="output-container error">
            {{ currentOutput.stderr || '(无错误)' }}
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- Cron构建器对话框 -->
    <el-dialog v-model="showCronBuilder" title="Cron表达式构建器" width="600px">
      <div class="cron-builder">
        <el-form label-width="80px">
          <el-form-item label="分钟">
            <el-input v-model="cronParts.minute" placeholder="0-59 或 *" />
          </el-form-item>
          <el-form-item label="小时">
            <el-input v-model="cronParts.hour" placeholder="0-23 或 *" />
          </el-form-item>
          <el-form-item label="日">
            <el-input v-model="cronParts.dayOfMonth" placeholder="1-31 或 *" />
          </el-form-item>
          <el-form-item label="月">
            <el-input v-model="cronParts.month" placeholder="1-12 或 *" />
          </el-form-item>
          <el-form-item label="星期">
            <el-input v-model="cronParts.dayOfWeek" placeholder="0-6 或 *" />
          </el-form-item>
        </el-form>
        <div class="cron-preview">
          <strong>表达式:</strong> {{ builtCron }}
        </div>
        <div class="cron-presets">
          <el-button size="small" @click="applyCronPreset('0 2 * * *')">每天凌晨2点</el-button>
          <el-button size="small" @click="applyCronPreset('0 */6 * * *')">每6小时</el-button>
          <el-button size="small" @click="applyCronPreset('0 0 * * 0')">每周日午夜</el-button>
          <el-button size="small" @click="applyCronPreset('0 0 1 * *')">每月1号</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="showCronBuilder = false">取消</el-button>
        <el-button type="primary" @click="applyCron">应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Edit,
  Delete,
  VideoPlay,
  Document,
  Clock,
  CircleCheck,
  SuccessFilled
} from '@element-plus/icons-vue'
import type { ScheduledTask, TaskExecutionRecord } from '@/types/scheduler'

const activeTab = ref('tasks')
const showCreateDialog = ref(false)
const showOutputDialog = ref(false)
const showCronBuilder = ref(false)
const editingTask = ref<ScheduledTask | null>(null)
const outputTab = ref('stdout')

// 筛选
const filterTask = ref('')
const filterStatus = ref('')

// 数据
const tasks = ref<ScheduledTask[]>([])
const history = ref<TaskExecutionRecord[]>([])

// 表单
const taskForm = ref({
  name: '',
  description: '',
  type: 'shell',
  config: {
    command: '',
    workdir: '',
    url: '',
    method: 'GET'
  },
  schedule: {
    type: 'cron',
    cron: '0 2 * * *',
    interval: 3600
  },
  notification: {
    onSuccess: false,
    onFailure: true
  }
})

const currentOutput = ref({
  stdout: '',
  stderr: ''
})

const cronParts = ref({
  minute: '0',
  hour: '2',
  dayOfMonth: '*',
  month: '*',
  dayOfWeek: '*'
})

// 计算属性
const enabledTasks = computed(() => tasks.value.filter(t => t.enabled).length)
const successRate = computed(() => {
  const total = tasks.value.reduce((sum, t) => sum + t.totalRuns, 0)
  const success = tasks.value.reduce((sum, t) => sum + t.successRuns, 0)
  return total > 0 ? Math.round((success / total) * 100) : 0
})

const filteredHistory = computed(() => {
  let result = history.value
  if (filterTask.value) {
    result = result.filter(h => h.taskId === filterTask.value)
  }
  if (filterStatus.value) {
    result = result.filter(h => h.status === filterStatus.value)
  }
  return result
})

const builtCron = computed(() => {
  return `${cronParts.value.minute} ${cronParts.value.hour} ${cronParts.value.dayOfMonth} ${cronParts.value.month} ${cronParts.value.dayOfWeek}`
})

const cronDescription = computed(() => {
  // TODO: 解析Cron表达式生成描述
  return '每天凌晨2点执行'
})

// 方法
const saveTask = async () => {
  // TODO: 调用API保存任务
  ElMessage.success('任务已保存')
  showCreateDialog.value = false
}

const editTask = (task: ScheduledTask) => {
  editingTask.value = task
  // TODO: 填充表单
  showCreateDialog.value = true
}

const deleteTask = async (task: ScheduledTask) => {
  await ElMessageBox.confirm('确定要删除此任务吗？', '确认删除', {
    type: 'warning'
  })
  // TODO: 调用API删除
  ElMessage.success('任务已删除')
}

const toggleTask = async (task: ScheduledTask) => {
  // TODO: 调用API切换状态
  ElMessage.success(task.enabled ? '任务已启用' : '任务已禁用')
}

const runTask = async (task: ScheduledTask) => {
  // TODO: 调用API执行任务
  ElMessage.success('任务已启动')
}

const showOutput = (record: TaskExecutionRecord) => {
  currentOutput.value = {
    stdout: record.stdout || '',
    stderr: record.stderr || ''
  }
  showOutputDialog.value = true
}

const applyCronPreset = (cron: string) => {
  const parts = cron.split(' ')
  cronParts.value = {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4]
  }
}

const applyCron = () => {
  taskForm.value.schedule.cron = builtCron.value
  showCronBuilder.value = false
}

// 辅助函数
const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    shell: 'Shell',
    http: 'HTTP',
    backup: '备份',
    cleanup: '清理',
    script: '脚本'
  }
  return labels[type] || type
}

const getScheduleLabel = (schedule: any): string => {
  if (schedule.type === 'cron') {
    return schedule.cron
  } else {
    return `每${schedule.interval}秒`
  }
}

const getStatusType = (status: string): string => {
  switch (status) {
    case 'success':
      return 'success'
    case 'failure':
      return 'danger'
    case 'running':
      return 'warning'
    default:
      return 'info'
  }
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'success':
      return '成功'
    case 'failure':
      return '失败'
    case 'running':
      return '运行中'
    case 'pending':
      return '等待中'
    default:
      return '-'
  }
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
</script>

<style scoped>
.cron-jobs-page {
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

.stat-icon.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-icon.enabled {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-icon.success {
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

.output-container {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 15px;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.output-container.error {
  color: #f87171;
}

.cron-description {
  margin-top: 5px;
  font-size: 12px;
  color: #666;
}

.cron-builder {
  padding: 10px 0;
}

.cron-preview {
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
  margin: 15px 0;
}

.cron-presets {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
