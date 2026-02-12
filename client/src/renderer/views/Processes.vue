<template>
  <div class="processes-page">
    <div class="page-header">
      <h1>进程管理</h1>
      <div class="header-actions">
        <el-select v-model="selectedServer" placeholder="选择服务器" class="server-select">
          <el-option
            v-for="server in connectedServers"
            :key="server.id"
            :label="server.name"
            :value="server.id"
          />
        </el-select>
        <el-input
          v-model="searchText"
          placeholder="搜索进程..."
          class="search-input"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filterUser" placeholder="用户" clearable class="filter-select">
          <el-option v-for="user in users" :key="user" :label="user" :value="user" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable class="filter-select">
          <el-option v-for="status in statuses" :key="status" :label="status" :value="status" />
        </el-select>
        <el-button-group>
          <el-button :type="viewMode === 'list' ? 'primary' : 'default'" @click="viewMode = 'list'" size="small">
            列表
          </el-button>
          <el-button :type="viewMode === 'tree' ? 'primary' : 'default'" @click="viewMode = 'tree'" size="small">
            树形
          </el-button>
        </el-button-group>
        <el-switch v-model="autoRefresh" active-text="自动刷新" />
        <el-button @click="loadProcesses" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div v-if="!selectedServer" class="empty-state">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <template v-else>
      <div class="stats-bar">
        <div class="stats-left">
          <el-tag>总进程: {{ processes.length }}</el-tag>
          <el-tag type="success">运行中: {{ runningCount }}</el-tag>
          <el-tag type="warning">睡眠: {{ sleepingCount }}</el-tag>
          <el-tag type="info">CPU: {{ totalCpu.toFixed(1) }}%</el-tag>
          <el-tag type="info">内存: {{ totalMemory.toFixed(1) }}%</el-tag>
        </div>
        <div class="stats-right" v-if="selectedPids.length > 0">
          <span class="selected-count">已选择 {{ selectedPids.length }} 个进程</span>
          <el-popconfirm
            title="确定要终止选中的进程吗？"
            confirm-button-text="终止"
            cancel-button-text="取消"
            @confirm="batchKillProcesses"
          >
            <template #reference>
              <el-button type="danger" size="small">
                <el-icon><Delete /></el-icon>
                批量终止
              </el-button>
            </template>
          </el-popconfirm>
          <el-button size="small" @click="selectedPids = []">取消选择</el-button>
        </div>
      </div>

      <el-table
        :data="viewMode === 'tree' ? flattenedTree : filteredProcesses"
        v-loading="loading"
        class="processes-table"
        :default-sort="{ prop: 'cpu_percent', order: 'descending' }"
        @sort-change="handleSortChange"
        row-key="pid"
      >
        <el-table-column width="50">
          <template #header>
            <el-checkbox
              :model-value="selectedPids.length === filteredProcesses.length && filteredProcesses.length > 0"
              :indeterminate="selectedPids.length > 0 && selectedPids.length < filteredProcesses.length"
              @change="toggleSelectAll"
            />
          </template>
          <template #default="{ row }">
            <el-checkbox
              :model-value="selectedPids.includes(row.pid)"
              @change="toggleSelection(row.pid)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="pid" label="PID" width="80" sortable />
        <el-table-column prop="name" label="进程名" min-width="180" sortable show-overflow-tooltip>
          <template #default="{ row }">
            <div class="process-name" :style="{ paddingLeft: viewMode === 'tree' ? (row.level || 0) * 20 + 'px' : '0' }">
              <el-icon
                v-if="viewMode === 'tree' && row.children && row.children.length > 0"
                class="tree-toggle"
                @click="toggleTreeNode(row)"
              >
                <ArrowDown v-if="row.expanded" />
                <ArrowRight v-else />
              </el-icon>
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="user" label="用户" width="100" sortable>
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.user }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="cpu_percent" label="CPU" width="120" sortable>
          <template #default="{ row }">
            <div class="usage-cell">
              <el-progress
                :percentage="Math.min(row.cpu_percent, 100)"
                :stroke-width="6"
                :show-text="false"
                :color="getUsageColor(row.cpu_percent)"
              />
              <span :class="{ 'high-usage': row.cpu_percent > 50 }">
                {{ row.cpu_percent.toFixed(1) }}%
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="memory_percent" label="内存" width="120" sortable>
          <template #default="{ row }">
            <div class="usage-cell">
              <el-progress
                :percentage="Math.min(row.memory_percent, 100)"
                :stroke-width="6"
                :show-text="false"
                :color="getUsageColor(row.memory_percent)"
              />
              <span :class="{ 'high-usage': row.memory_percent > 50 }">
                {{ row.memory_percent.toFixed(1) }}%
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="RSS" width="90">
          <template #default="{ row }">
            {{ formatMemory(row.memory_rss) }}
          </template>
        </el-table-column>
        <el-table-column prop="cmdline" label="命令行" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" text @click="viewProcessDetail(row)">
              <el-icon><View /></el-icon>
            </el-button>
            <el-popconfirm
              title="确定要终止此进程吗？"
              confirm-button-text="终止"
              cancel-button-text="取消"
              @confirm="killProcess(row)"
            >
              <template #reference>
                <el-button type="danger" size="small" :loading="row.killing">
                  终止
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <!-- 进程详情对话框 -->
    <el-dialog v-model="showDetailDialog" title="进程详情" width="600px">
      <template v-if="currentProcess">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="PID">{{ currentProcess.pid }}</el-descriptions-item>
          <el-descriptions-item label="父进程 PID">{{ currentProcess.ppid }}</el-descriptions-item>
          <el-descriptions-item label="进程名">{{ currentProcess.name }}</el-descriptions-item>
          <el-descriptions-item label="用户">{{ currentProcess.user }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentProcess.status)" size="small">
              {{ currentProcess.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="currentProcess.threads !== undefined" label="线程数">{{ currentProcess.threads }}</el-descriptions-item>
          <el-descriptions-item label="CPU 使用率">
            <span :class="{ 'high-usage': currentProcess.cpu_percent > 50 }">
              {{ currentProcess.cpu_percent.toFixed(2) }}%
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="内存使用率">
            <span :class="{ 'high-usage': currentProcess.memory_percent > 50 }">
              {{ currentProcess.memory_percent.toFixed(2) }}%
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="物理内存 (RSS)">
            {{ formatMemory(currentProcess.memory_rss) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentProcess.memory_vms !== undefined" label="虚拟内存 (VMS)">
            {{ formatMemory(currentProcess.memory_vms) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentProcess.nice !== undefined" label="Nice 值">{{ currentProcess.nice }}</el-descriptions-item>
          <el-descriptions-item label="运行时间">
            {{ formatUptime(currentProcess.create_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="命令行" :span="2">
            <code class="cmdline-code">{{ currentProcess.cmdline }}</code>
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-popconfirm
          title="确定要终止此进程吗？"
          confirm-button-text="终止"
          cancel-button-text="取消"
          @confirm="killProcess(currentProcess!); showDetailDialog = false"
        >
          <template #reference>
            <el-button type="danger">终止进程</el-button>
          </template>
        </el-popconfirm>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useServerStore } from '@/stores/server'
import { ElMessage } from 'element-plus'
import {
  Refresh, Search, View, Delete,
  ArrowDown, ArrowRight
} from '@element-plus/icons-vue'

interface ProcessInfo {
  pid: number
  ppid: number
  name: string
  user: string
  status: string
  cpu_percent: number
  memory_percent: number
  memory_rss: number
  memory_vms?: number
  create_time: number
  cmdline: string
  threads?: number
  nice?: number
  killing?: boolean
  selected?: boolean
  children?: ProcessInfo[]
  expanded?: boolean
}

const serverStore = useServerStore()
const selectedServer = ref<string | null>(serverStore.currentServerId)
const processes = ref<ProcessInfo[]>([])
const loading = ref(false)
const searchText = ref('')
const viewMode = ref<'list' | 'tree'>('list')
const filterUser = ref('')
const filterStatus = ref('')
const autoRefresh = ref(false)
const showDetailDialog = ref(false)
const currentProcess = ref<ProcessInfo | null>(null)
const selectedPids = ref<number[]>([])
let refreshInterval: ReturnType<typeof setInterval> | null = null

const connectedServers = computed(() => serverStore.connectedServers)

const users = computed(() => {
  const userSet = new Set(processes.value.map(p => p.user))
  return Array.from(userSet).sort()
})

const statuses = ['running', 'sleeping', 'stopped', 'zombie']

const filteredProcesses = computed(() => {
  let result = processes.value

  // 搜索过滤
  if (searchText.value) {
    const search = searchText.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.user.toLowerCase().includes(search) ||
      p.cmdline?.toLowerCase().includes(search) ||
      p.pid.toString().includes(search)
    )
  }

  // 用户过滤
  if (filterUser.value) {
    result = result.filter(p => p.user === filterUser.value)
  }

  // 状态过滤
  if (filterStatus.value) {
    result = result.filter(p => p.status.toLowerCase() === filterStatus.value)
  }

  return result
})

// 构建进程树
const processTree = computed(() => {
  const map = new Map<number, ProcessInfo>()
  const roots: ProcessInfo[] = []

  // 先创建所有进程的映射
  filteredProcesses.value.forEach(p => {
    map.set(p.pid, { ...p, children: [], expanded: false })
  })

  // 构建树结构
  map.forEach(p => {
    if (p.ppid === 0 || p.ppid === 1 || !map.has(p.ppid)) {
      roots.push(p)
    } else {
      const parent = map.get(p.ppid)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(p)
      }
    }
  })

  return roots
})

// 展平树结构用于表格显示
const flattenedTree = computed(() => {
  const result: (ProcessInfo & { level: number })[] = []

  function flatten(nodes: ProcessInfo[], level: number) {
    nodes.forEach(node => {
      result.push({ ...node, level })
      if (node.expanded && node.children && node.children.length > 0) {
        flatten(node.children, level + 1)
      }
    })
  }

  flatten(processTree.value, 0)
  return result
})

const runningCount = computed(() => processes.value.filter(p =>
  p.status === 'running' || p.status === 'R'
).length)

const sleepingCount = computed(() => processes.value.filter(p =>
  p.status === 'sleeping' || p.status === 'S' || p.status === 'idle'
).length)

const totalCpu = computed(() => processes.value.reduce((sum, p) => sum + p.cpu_percent, 0))
const totalMemory = computed(() => processes.value.reduce((sum, p) => sum + p.memory_percent, 0))

watch(selectedServer, (newVal) => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
  if (newVal) loadProcesses()
}, { immediate: true })

watch(autoRefresh, (newVal) => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
  if (newVal) {
    refreshInterval = setInterval(loadProcesses, 3000)
  }
})

onMounted(() => {
  if (selectedServer.value) loadProcesses()
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

async function loadProcesses() {
  if (!selectedServer.value) return
  loading.value = true
  try {
    const result = await window.electronAPI.process.list(selectedServer.value)
    processes.value = result.processes.map(p => ({
      ...p,
      killing: false,
      selected: false
    }))
  } catch (error) {
    ElMessage.error(`加载进程列表失败: ${(error as Error).message}`)
  } finally {
    loading.value = false
  }
}

async function killProcess(process: ProcessInfo, signal: number = 15) {
  if (!selectedServer.value) return

  process.killing = true
  try {
    const result = await window.electronAPI.process.kill(selectedServer.value, process.pid, signal)
    if (result.success) {
      ElMessage.success(`进程 ${process.name} (PID: ${process.pid}) 已终止`)
      await loadProcesses()
    } else {
      ElMessage.error(`终止进程失败: ${result.error || '未知错误'}`)
    }
  } catch (error) {
    ElMessage.error(`终止进程失败: ${(error as Error).message}`)
  } finally {
    process.killing = false
  }
}

// 批量终止进程
async function batchKillProcesses() {
  if (selectedPids.value.length === 0 || !selectedServer.value) return

  loading.value = true
  let successCount = 0
  let failCount = 0

  try {
    for (const pid of selectedPids.value) {
      try {
        const result = await window.electronAPI.process.kill(selectedServer.value, pid, 15)
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    if (failCount === 0) {
      ElMessage.success(`已终止 ${successCount} 个进程`)
    } else {
      ElMessage.warning(`成功终止 ${successCount} 个进程，${failCount} 个失败`)
    }
    selectedPids.value = []
    await loadProcesses()
  } catch (error) {
    ElMessage.error(`批量终止失败: ${(error as Error).message}`)
  } finally {
    loading.value = false
  }
}

// 查看进程详情
function viewProcessDetail(process: ProcessInfo) {
  currentProcess.value = process
  showDetailDialog.value = true
}

// 切换进程树节点展开状态
function toggleTreeNode(process: ProcessInfo) {
  const findAndToggle = (nodes: ProcessInfo[]): boolean => {
    for (const node of nodes) {
      if (node.pid === process.pid) {
        node.expanded = !node.expanded
        return true
      }
      if (node.children && findAndToggle(node.children)) {
        return true
      }
    }
    return false
  }
  findAndToggle(processTree.value)
}

// 选择/取消选择进程
function toggleSelection(pid: number) {
  const index = selectedPids.value.indexOf(pid)
  if (index === -1) {
    selectedPids.value.push(pid)
  } else {
    selectedPids.value.splice(index, 1)
  }
}

// 全选/取消全选
function toggleSelectAll() {
  if (selectedPids.value.length === filteredProcesses.value.length) {
    selectedPids.value = []
  } else {
    selectedPids.value = filteredProcesses.value.map(p => p.pid)
  }
}

// 格式化运行时间
function formatUptime(createTime: number): string {
  const diff = Date.now() - createTime
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)

  if (days > 0) return `${days}天${hours}小时`
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

function handleSortChange(_sort: any) {
  // Sort is handled by el-table automatically
}

function getStatusType(status: string): 'success' | 'info' | 'warning' | 'danger' {
  switch (status?.toLowerCase()) {
    case 'running':
    case 'r':
      return 'success'
    case 'sleeping':
    case 's':
    case 'idle':
      return 'info'
    case 'stopped':
    case 't':
      return 'warning'
    case 'zombie':
    case 'z':
      return 'danger'
    default:
      return 'info'
  }
}

function formatMemory(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getUsageColor(percentage: number): string {
  if (percentage < 30) return '#22c55e'
  if (percentage < 60) return '#f59e0b'
  return '#ef4444'
}
</script>

<style lang="scss" scoped>
.processes-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;

  h1 {
    font-size: 24px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;

    .server-select {
      width: 180px;
    }

    .search-input {
      width: 180px;
    }

    .filter-select {
      width: 120px;
    }
  }
}

.stats-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;

  .stats-left {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .stats-right {
    display: flex;
    gap: 12px;
    align-items: center;

    .selected-count {
      font-size: 13px;
      color: var(--text-secondary);
    }
  }
}

.processes-table {
  flex: 1;

  .process-name {
    display: flex;
    align-items: center;
    gap: 4px;

    .tree-toggle {
      cursor: pointer;
      color: var(--text-secondary);
      transition: color 0.2s;

      &:hover {
        color: var(--primary-color);
      }
    }
  }

  .usage-cell {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-progress {
      flex: 1;
      max-width: 60px;
    }
  }

  .high-usage {
    color: var(--el-color-danger);
    font-weight: 600;
  }
}

.empty-state {
  padding: 60px 0;
}

.cmdline-code {
  display: block;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}

:deep(.el-dialog__body) {
  padding-top: 10px;
}

:deep(.el-descriptions__label) {
  width: 120px;
}
</style>
