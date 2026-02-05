import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TaskStep {
  cmd: string
  desc: string
  status: 'pending' | 'running' | 'success' | 'failed'
  output: string
}

export interface Task {
  id: string
  name: string
  type: 'env-install' | 'deploy' | 'command'
  status: 'running' | 'success' | 'failed' | 'cancelled'
  progress: number // 0-100
  steps: TaskStep[]
  currentStep: number
  log: string
  startTime: number
  endTime?: number
  serverId: string
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const showTaskPanel = ref(false)
  const selectedTaskId = ref<string | null>(null)

  // 正在运行的任务
  const runningTasks = computed(() => tasks.value.filter(t => t.status === 'running'))
  const hasRunningTasks = computed(() => runningTasks.value.length > 0)
  
  // 当前选中的任务
  const selectedTask = computed(() => {
    if (!selectedTaskId.value) return runningTasks.value[0] || tasks.value[0]
    return tasks.value.find(t => t.id === selectedTaskId.value)
  })

  // 创建任务
  function createTask(name: string, type: Task['type'], serverId: string, steps: { cmd: string; desc: string }[]): Task {
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      type,
      status: 'running',
      progress: 0,
      steps: steps.map(s => ({ ...s, status: 'pending', output: '' })),
      currentStep: 0,
      log: `🚀 开始执行: ${name}\n${'─'.repeat(50)}\n\n`,
      startTime: Date.now(),
      serverId
    }
    tasks.value.unshift(task)
    selectedTaskId.value = task.id
    showTaskPanel.value = true
    return task
  }

  // 更新任务日志
  function appendLog(taskId: string, text: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.log += text
    }
  }

  // 更新步骤状态
  function updateStep(taskId: string, stepIndex: number, status: TaskStep['status'], output?: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task && task.steps[stepIndex]) {
      task.steps[stepIndex].status = status
      if (output) {
        task.steps[stepIndex].output = output
      }
      task.currentStep = stepIndex
      task.progress = Math.round(((stepIndex + (status === 'success' || status === 'failed' ? 1 : 0.5)) / task.steps.length) * 100)
    }
  }

  // 完成任务
  function completeTask(taskId: string, success: boolean) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.status = success ? 'success' : 'failed'
      task.progress = 100
      task.endTime = Date.now()
      task.log += `\n${'─'.repeat(50)}\n`
      task.log += success ? '✅ 任务完成\n' : '❌ 任务失败\n'
    }
  }

  // 取消任务
  function cancelTask(taskId: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task && task.status === 'running') {
      task.status = 'cancelled'
      task.endTime = Date.now()
      task.log += '\n⚠️ 任务已取消\n'
    }
  }

  // 清除已完成的任务
  function clearCompletedTasks() {
    tasks.value = tasks.value.filter(t => t.status === 'running')
  }

  // 删除任务
  function removeTask(taskId: string) {
    const index = tasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      tasks.value.splice(index, 1)
      if (selectedTaskId.value === taskId) {
        selectedTaskId.value = tasks.value[0]?.id || null
      }
    }
  }

  // 切换面板显示
  function togglePanel() {
    showTaskPanel.value = !showTaskPanel.value
  }

  return {
    tasks,
    showTaskPanel,
    selectedTaskId,
    runningTasks,
    hasRunningTasks,
    selectedTask,
    createTask,
    appendLog,
    updateStep,
    completeTask,
    cancelTask,
    clearCompletedTasks,
    removeTask,
    togglePanel
  }
})
