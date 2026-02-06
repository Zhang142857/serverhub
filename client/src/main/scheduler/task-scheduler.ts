/**
 * 任务调度引擎
 * 负责计划任务的调度和执行
 */

import {
  ScheduledTask,
  TaskExecutionRecord,
  TaskStatus,
  TaskType,
  ScheduleType,
  TaskOperationResult
} from '../../types/scheduler'
import { CronBuilder } from './cron-builder'
import { EventEmitter } from 'events'

/**
 * 任务调度引擎
 */
export class TaskScheduler extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private executionHistory: Map<string, TaskExecutionRecord[]> = new Map()
  private running: boolean = false

  constructor() {
    super()
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (this.running) return
    
    this.running = true
    console.log('[TaskScheduler] Started')
    
    // 调度所有启用的任务
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task)
      }
    }
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (!this.running) return
    
    this.running = false
    console.log('[TaskScheduler] Stopped')
    
    // 清除所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }

  /**
   * 添加任务
   */
  addTask(task: ScheduledTask): TaskOperationResult {
    try {
      // 验证任务
      const validation = this.validateTask(task)
      if (!validation.success) {
        return validation
      }

      // 计算下次执行时间
      task.nextRun = this.calculateNextRun(task)

      this.tasks.set(task.id, task)
      this.executionHistory.set(task.id, [])

      // 如果调度器正在运行且任务已启用，立即调度
      if (this.running && task.enabled) {
        this.scheduleTask(task)
      }

      this.emit('task:added', task)
      console.log(`[TaskScheduler] Added task: ${task.name}`)

      return {
        success: true,
        message: 'Task added successfully',
        data: task
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 更新任务
   */
  updateTask(taskId: string, updates: Partial<ScheduledTask>): TaskOperationResult {
    const task = this.tasks.get(taskId)
    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      }
    }

    // 更新任务
    Object.assign(task, updates)
    task.updatedAt = new Date()

    // 重新计算下次执行时间
    task.nextRun = this.calculateNextRun(task)

    // 重新调度
    this.unscheduleTask(taskId)
    if (this.running && task.enabled) {
      this.scheduleTask(task)
    }

    this.emit('task:updated', task)
    console.log(`[TaskScheduler] Updated task: ${task.name}`)

    return {
      success: true,
      message: 'Task updated successfully',
      data: task
    }
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): TaskOperationResult {
    const task = this.tasks.get(taskId)
    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      }
    }

    // 取消调度
    this.unscheduleTask(taskId)

    // 删除任务和历史
    this.tasks.delete(taskId)
    this.executionHistory.delete(taskId)

    this.emit('task:deleted', taskId)
    console.log(`[TaskScheduler] Deleted task: ${task.name}`)

    return {
      success: true,
      message: 'Task deleted successfully'
    }
  }

  /**
   * 启用任务
   */
  enableTask(taskId: string): TaskOperationResult {
    const task = this.tasks.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    task.enabled = true
    task.updatedAt = new Date()

    if (this.running) {
      this.scheduleTask(task)
    }

    this.emit('task:enabled', task)
    return { success: true, message: 'Task enabled' }
  }

  /**
   * 禁用任务
   */
  disableTask(taskId: string): TaskOperationResult {
    const task = this.tasks.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    task.enabled = false
    task.updatedAt = new Date()

    this.unscheduleTask(taskId)

    this.emit('task:disabled', task)
    return { success: true, message: 'Task disabled' }
  }

  /**
   * 手动执行任务
   */
  async executeTask(taskId: string): Promise<TaskOperationResult> {
    const task = this.tasks.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    console.log(`[TaskScheduler] Manually executing task: ${task.name}`)
    
    const record = await this.runTask(task, 'manual')
    
    return {
      success: record.status === TaskStatus.SUCCESS,
      message: record.status === TaskStatus.SUCCESS ? 'Task executed successfully' : 'Task execution failed',
      error: record.error,
      data: record
    }
  }

  /**
   * 调度任务
   */
  private scheduleTask(task: ScheduledTask): void {
    // 清除现有定时器
    this.unscheduleTask(task.id)

    const delay = this.calculateDelay(task)
    if (delay <= 0) return

    const timer = setTimeout(async () => {
      await this.runTask(task, 'schedule')
      
      // 重新调度
      if (task.enabled && this.running) {
        this.scheduleTask(task)
      }
    }, delay)

    this.timers.set(task.id, timer)
    console.log(`[TaskScheduler] Scheduled task: ${task.name}, next run in ${Math.round(delay / 1000)}s`)
  }

  /**
   * 取消调度
   */
  private unscheduleTask(taskId: string): void {
    const timer = this.timers.get(taskId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(taskId)
    }
  }

  /**
   * 执行任务
   */
  private async runTask(
    task: ScheduledTask,
    triggeredBy: 'schedule' | 'manual'
  ): Promise<TaskExecutionRecord> {
    const record: TaskExecutionRecord = {
      id: this.generateRecordId(),
      taskId: task.id,
      taskName: task.name,
      serverId: task.serverId,
      status: TaskStatus.RUNNING,
      startTime: new Date(),
      triggeredBy
    }

    this.emit('task:start', { task, record })

    try {
      // 根据任务类型执行
      const result = await this.executeTaskByType(task)

      record.status = result.success ? TaskStatus.SUCCESS : TaskStatus.FAILURE
      record.endTime = new Date()
      record.duration = record.endTime.getTime() - record.startTime.getTime()
      record.stdout = result.stdout
      record.stderr = result.stderr
      record.exitCode = result.exitCode
      record.error = result.error

      // 更新任务统计
      task.lastRun = record.startTime
      task.lastStatus = record.status
      task.totalRuns++
      if (record.status === TaskStatus.SUCCESS) {
        task.successRuns++
      } else {
        task.failureRuns++
      }

      // 计算下次执行时间
      task.nextRun = this.calculateNextRun(task)

      // 保存执行记录
      const history = this.executionHistory.get(task.id) || []
      history.unshift(record)
      // 只保留最近100条
      if (history.length > 100) {
        history.length = 100
      }
      this.executionHistory.set(task.id, history)

      this.emit('task:complete', { task, record })

      // 发送通知
      if (task.notification) {
        this.sendNotification(task, record)
      }

    } catch (error: any) {
      record.status = TaskStatus.FAILURE
      record.endTime = new Date()
      record.duration = record.endTime.getTime() - record.startTime.getTime()
      record.error = error.message

      task.lastRun = record.startTime
      task.lastStatus = TaskStatus.FAILURE
      task.totalRuns++
      task.failureRuns++

      this.emit('task:error', { task, record, error })

      if (task.notification?.onFailure) {
        this.sendNotification(task, record)
      }
    }

    return record
  }

  /**
   * 根据类型执行任务
   */
  private async executeTaskByType(task: ScheduledTask): Promise<any> {
    switch (task.type) {
      case TaskType.SHELL:
        return await this.executeShellTask(task)
      case TaskType.HTTP:
        return await this.executeHttpTask(task)
      case TaskType.BACKUP:
        return await this.executeBackupTask(task)
      case TaskType.CLEANUP:
        return await this.executeCleanupTask(task)
      case TaskType.SCRIPT:
        return await this.executeScriptTask(task)
      default:
        throw new Error(`Unsupported task type: ${task.type}`)
    }
  }

  /**
   * 执行Shell任务
   */
  private async executeShellTask(task: ScheduledTask): Promise<any> {
    // TODO: 通过gRPC执行命令
    console.log('[TaskScheduler] Executing shell task:', task.config)
    return {
      success: true,
      stdout: 'Command executed',
      stderr: '',
      exitCode: 0
    }
  }

  /**
   * 执行HTTP任务
   */
  private async executeHttpTask(task: ScheduledTask): Promise<any> {
    // TODO: 发送HTTP请求
    console.log('[TaskScheduler] Executing HTTP task:', task.config)
    return {
      success: true,
      stdout: 'HTTP request sent',
      stderr: '',
      exitCode: 0
    }
  }

  /**
   * 执行备份任务
   */
  private async executeBackupTask(task: ScheduledTask): Promise<any> {
    // TODO: 调用备份引擎
    console.log('[TaskScheduler] Executing backup task:', task.config)
    return {
      success: true,
      stdout: 'Backup completed',
      stderr: '',
      exitCode: 0
    }
  }

  /**
   * 执行清理任务
   */
  private async executeCleanupTask(task: ScheduledTask): Promise<any> {
    // TODO: 执行清理操作
    console.log('[TaskScheduler] Executing cleanup task:', task.config)
    return {
      success: true,
      stdout: 'Cleanup completed',
      stderr: '',
      exitCode: 0
    }
  }

  /**
   * 执行脚本任务
   */
  private async executeScriptTask(task: ScheduledTask): Promise<any> {
    // TODO: 执行脚本
    console.log('[TaskScheduler] Executing script task:', task.config)
    return {
      success: true,
      stdout: 'Script executed',
      stderr: '',
      exitCode: 0
    }
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(task: ScheduledTask): number {
    const now = Date.now()
    const nextRun = task.nextRun?.getTime() || now

    return Math.max(0, nextRun - now)
  }

  /**
   * 计算下次执行时间
   */
  private calculateNextRun(task: ScheduledTask): Date {
    const now = new Date()

    if (task.schedule.type === ScheduleType.CRON) {
      return CronBuilder.getNextRun(task.schedule.cron!, now)
    } else if (task.schedule.type === ScheduleType.INTERVAL) {
      const interval = task.schedule.interval! * 1000
      return new Date(now.getTime() + interval)
    }

    return now
  }

  /**
   * 验证任务
   */
  private validateTask(task: ScheduledTask): TaskOperationResult {
    if (!task.name) {
      return { success: false, error: 'Task name is required' }
    }

    if (!task.serverId) {
      return { success: false, error: 'Server ID is required' }
    }

    if (task.schedule.type === ScheduleType.CRON) {
      if (!task.schedule.cron) {
        return { success: false, error: 'Cron expression is required' }
      }
      if (!CronBuilder.validate(task.schedule.cron)) {
        return { success: false, error: 'Invalid cron expression' }
      }
    } else if (task.schedule.type === ScheduleType.INTERVAL) {
      if (!task.schedule.interval || task.schedule.interval <= 0) {
        return { success: false, error: 'Invalid interval' }
      }
    }

    return { success: true }
  }

  /**
   * 发送通知
   */
  private async sendNotification(
    task: ScheduledTask,
    record: TaskExecutionRecord
  ): Promise<void> {
    if (!task.notification) return

    const shouldNotify = 
      (record.status === TaskStatus.SUCCESS && task.notification.onSuccess) ||
      (record.status === TaskStatus.FAILURE && task.notification.onFailure)

    if (!shouldNotify) return

    const message = record.status === TaskStatus.SUCCESS
      ? `任务 "${task.name}" 执行成功`
      : `任务 "${task.name}" 执行失败: ${record.error}`

    // TODO: 实现通知发送
    console.log('[TaskScheduler] Notification:', message)
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 获取任务执行历史
   */
  getTaskHistory(taskId: string, limit: number = 50): TaskExecutionRecord[] {
    const history = this.executionHistory.get(taskId) || []
    return history.slice(0, limit)
  }

  /**
   * 获取所有执行历史
   */
  getAllHistory(limit: number = 100): TaskExecutionRecord[] {
    const allHistory: TaskExecutionRecord[] = []
    
    for (const history of this.executionHistory.values()) {
      allHistory.push(...history)
    }

    // 按时间排序
    allHistory.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())

    return allHistory.slice(0, limit)
  }

  /**
   * 生成记录ID
   */
  private generateRecordId(): string {
    return `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取调度器状态
   */
  isRunning(): boolean {
    return this.running
  }

  /**
   * 获取任务数量
   */
  get size(): number {
    return this.tasks.size
  }
}

// 全局任务调度器实例
export const taskScheduler = new TaskScheduler()
