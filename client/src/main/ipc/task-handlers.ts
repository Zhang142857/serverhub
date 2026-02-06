/**
 * 计划任务IPC处理器
 */

import { taskScheduler } from '../scheduler/task-scheduler'
import type { ScheduledTask, TaskExecutionRecord } from '../../types/scheduler'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

// 数据存储路径
const getTaskDataPath = () => path.join(app.getPath('userData'), 'task-data.json')

/**
 * 加载任务数据
 */
async function loadTaskData(): Promise<{
  tasks: ScheduledTask[]
  history: TaskExecutionRecord[]
}> {
  try {
    const dataPath = getTaskDataPath()
    const data = await fs.readFile(dataPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return { tasks: [], history: [] }
  }
}

/**
 * 保存任务数据
 */
async function saveTaskData(data: {
  tasks: ScheduledTask[]
  history: TaskExecutionRecord[]
}): Promise<void> {
  const dataPath = getTaskDataPath()
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 设置计划任务的IPC处理器
 */
export function setupTaskHandlers() {
  const { ipcMain } = require('electron')

  // 启动任务调度器
  taskScheduler.start()

  // 监听任务事件并保存
  taskScheduler.on('task:complete', async ({ task, record }) => {
    const data = await loadTaskData()
    
    // 更新任务
    const taskIndex = data.tasks.findIndex(t => t.id === task.id)
    if (taskIndex !== -1) {
      data.tasks[taskIndex] = task
    }
    
    // 添加历史记录
    data.history.unshift(record)
    
    // 只保留最近1000条记录
    if (data.history.length > 1000) {
      data.history = data.history.slice(0, 1000)
    }
    
    await saveTaskData(data)
  })

  // 获取所有任务
  ipcMain.handle('task:getTasks', async () => {
    return taskScheduler.getAllTasks()
  })

  // 创建任务
  ipcMain.handle('task:create', async (_, task: ScheduledTask) => {
    // 生成ID和初始化字段
    task.id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    task.totalRuns = 0
    task.successRuns = 0
    task.failureRuns = 0
    task.createdAt = new Date()
    task.updatedAt = new Date()
    
    const result = taskScheduler.addTask(task)
    
    if (result.success) {
      const data = await loadTaskData()
      data.tasks.push(task)
      await saveTaskData(data)
    }
    
    return result
  })

  // 更新任务
  ipcMain.handle('task:update', async (_, taskId: string, updates: Partial<ScheduledTask>) => {
    const result = taskScheduler.updateTask(taskId, updates)
    
    if (result.success) {
      const data = await loadTaskData()
      const index = data.tasks.findIndex(t => t.id === taskId)
      if (index !== -1) {
        data.tasks[index] = { ...data.tasks[index], ...updates }
        await saveTaskData(data)
      }
    }
    
    return result
  })

  // 删除任务
  ipcMain.handle('task:delete', async (_, taskId: string) => {
    const result = taskScheduler.deleteTask(taskId)
    
    if (result.success) {
      const data = await loadTaskData()
      const index = data.tasks.findIndex(t => t.id === taskId)
      if (index !== -1) {
        data.tasks.splice(index, 1)
        await saveTaskData(data)
      }
    }
    
    return result
  })

  // 启用任务
  ipcMain.handle('task:enable', async (_, taskId: string) => {
    const result = taskScheduler.enableTask(taskId)
    
    if (result.success) {
      const data = await loadTaskData()
      const index = data.tasks.findIndex(t => t.id === taskId)
      if (index !== -1) {
        data.tasks[index].enabled = true
        await saveTaskData(data)
      }
    }
    
    return result
  })

  // 禁用任务
  ipcMain.handle('task:disable', async (_, taskId: string) => {
    const result = taskScheduler.disableTask(taskId)
    
    if (result.success) {
      const data = await loadTaskData()
      const index = data.tasks.findIndex(t => t.id === taskId)
      if (index !== -1) {
        data.tasks[index].enabled = false
        await saveTaskData(data)
      }
    }
    
    return result
  })

  // 手动执行任务
  ipcMain.handle('task:execute', async (_, taskId: string) => {
    return await taskScheduler.executeTask(taskId)
  })

  // 获取任务执行历史
  ipcMain.handle('task:getHistory', async (_, taskId?: string, limit?: number) => {
    if (taskId) {
      return taskScheduler.getTaskHistory(taskId, limit)
    }
    return taskScheduler.getAllHistory(limit)
  })

  // 获取任务统计
  ipcMain.handle('task:getStats', async () => {
    const tasks = taskScheduler.getAllTasks()
    const totalTasks = tasks.length
    const enabledTasks = tasks.filter(t => t.enabled).length
    const totalRuns = tasks.reduce((sum, t) => sum + t.totalRuns, 0)
    const successRuns = tasks.reduce((sum, t) => sum + t.successRuns, 0)
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0
    
    return {
      totalTasks,
      enabledTasks,
      totalRuns,
      successRuns,
      successRate
    }
  })
}

/**
 * 初始化任务调度器
 * 从持久化存储加载任务
 */
export async function initTaskScheduler() {
  const data = await loadTaskData()
  
  // 恢复所有任务
  for (const task of data.tasks) {
    taskScheduler.addTask(task)
  }
  
  console.log(`[TaskScheduler] Loaded ${data.tasks.length} tasks from storage`)
}
