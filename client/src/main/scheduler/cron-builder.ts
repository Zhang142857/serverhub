/**
 * Cron表达式工具类
 */

import { CronParts } from '../../types/scheduler'

/**
 * Cron表达式构建器
 */
export class CronBuilder {
  private parts: CronParts = {
    minute: '*',
    hour: '*',
    dayOfMonth: '*',
    month: '*',
    dayOfWeek: '*'
  }

  /**
   * 设置分钟
   */
  minute(value: string | number): this {
    this.parts.minute = String(value)
    return this
  }

  /**
   * 设置小时
   */
  hour(value: string | number): this {
    this.parts.hour = String(value)
    return this
  }

  /**
   * 设置日期
   */
  dayOfMonth(value: string | number): this {
    this.parts.dayOfMonth = String(value)
    return this
  }

  /**
   * 设置月份
   */
  month(value: string | number): this {
    this.parts.month = String(value)
    return this
  }

  /**
   * 设置星期
   */
  dayOfWeek(value: string | number): this {
    this.parts.dayOfWeek = String(value)
    return this
  }

  /**
   * 每分钟
   */
  everyMinute(): this {
    this.parts.minute = '*'
    return this
  }

  /**
   * 每小时
   */
  everyHour(): this {
    this.parts.minute = '0'
    this.parts.hour = '*'
    return this
  }

  /**
   * 每天
   */
  daily(hour: number = 0, minute: number = 0): this {
    this.parts.minute = String(minute)
    this.parts.hour = String(hour)
    this.parts.dayOfMonth = '*'
    return this
  }

  /**
   * 每周
   */
  weekly(dayOfWeek: number = 0, hour: number = 0, minute: number = 0): this {
    this.parts.minute = String(minute)
    this.parts.hour = String(hour)
    this.parts.dayOfWeek = String(dayOfWeek)
    return this
  }

  /**
   * 每月
   */
  monthly(dayOfMonth: number = 1, hour: number = 0, minute: number = 0): this {
    this.parts.minute = String(minute)
    this.parts.hour = String(hour)
    this.parts.dayOfMonth = String(dayOfMonth)
    return this
  }

  /**
   * 构建Cron表达式
   */
  build(): string {
    return `${this.parts.minute} ${this.parts.hour} ${this.parts.dayOfMonth} ${this.parts.month} ${this.parts.dayOfWeek}`
  }

  /**
   * 从Cron表达式解析
   */
  static parse(cron: string): CronParts {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression')
    }

    return {
      minute: parts[0],
      hour: parts[1],
      dayOfMonth: parts[2],
      month: parts[3],
      dayOfWeek: parts[4]
    }
  }

  /**
   * 验证Cron表达式
   */
  static validate(cron: string): boolean {
    try {
      const parts = cron.trim().split(/\s+/)
      if (parts.length !== 5) return false

      // 简单验证每个部分
      const validators = [
        (v: string) => this.validatePart(v, 0, 59),  // minute
        (v: string) => this.validatePart(v, 0, 23),  // hour
        (v: string) => this.validatePart(v, 1, 31),  // day
        (v: string) => this.validatePart(v, 1, 12),  // month
        (v: string) => this.validatePart(v, 0, 6)    // weekday
      ]

      return parts.every((part, index) => validators[index](part))
    } catch {
      return false
    }
  }

  /**
   * 验证单个部分
   */
  private static validatePart(part: string, min: number, max: number): boolean {
    if (part === '*') return true
    if (part.includes('/')) {
      const [range, step] = part.split('/')
      return this.validatePart(range, min, max) && !isNaN(Number(step))
    }
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      return start >= min && end <= max && start <= end
    }
    if (part.includes(',')) {
      return part.split(',').every(p => this.validatePart(p, min, max))
    }
    const num = Number(part)
    return !isNaN(num) && num >= min && num <= max
  }

  /**
   * 获取下次执行时间
   */
  static getNextRun(cron: string, from: Date = new Date()): Date {
    // 简化实现，实际应该使用cron-parser库
    const parts = this.parse(cron)
    const next = new Date(from)

    // 这里只是示例，实际需要完整的cron解析逻辑
    if (parts.minute !== '*') {
      next.setMinutes(Number(parts.minute))
    }
    if (parts.hour !== '*') {
      next.setHours(Number(parts.hour))
    }

    // 如果时间已过，加一天
    if (next <= from) {
      next.setDate(next.getDate() + 1)
    }

    return next
  }

  /**
   * 获取人类可读的描述
   */
  static describe(cron: string): string {
    try {
      const parts = this.parse(cron)

      // 每分钟
      if (parts.minute === '*' && parts.hour === '*') {
        return '每分钟'
      }

      // 每小时
      if (parts.minute !== '*' && parts.hour === '*') {
        return `每小时的第 ${parts.minute} 分钟`
      }

      // 每天
      if (parts.dayOfMonth === '*' && parts.dayOfWeek === '*') {
        return `每天 ${parts.hour}:${parts.minute.padStart(2, '0')}`
      }

      // 每周
      if (parts.dayOfWeek !== '*') {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        return `每${days[Number(parts.dayOfWeek)]} ${parts.hour}:${parts.minute.padStart(2, '0')}`
      }

      // 每月
      if (parts.dayOfMonth !== '*') {
        return `每月 ${parts.dayOfMonth} 日 ${parts.hour}:${parts.minute.padStart(2, '0')}`
      }

      return cron
    } catch {
      return cron
    }
  }
}

/**
 * 预设的Cron表达式
 */
export const CRON_PRESETS = {
  EVERY_MINUTE: '* * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_2_HOURS: '0 */2 * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  EVERY_12_HOURS: '0 */12 * * *',
  DAILY_MIDNIGHT: '0 0 * * *',
  DAILY_NOON: '0 12 * * *',
  WEEKLY_SUNDAY: '0 0 * * 0',
  WEEKLY_MONDAY: '0 0 * * 1',
  MONTHLY_FIRST: '0 0 1 * *',
  YEARLY: '0 0 1 1 *'
}

/**
 * 预设描述
 */
export const CRON_PRESET_DESCRIPTIONS: Record<string, string> = {
  [CRON_PRESETS.EVERY_MINUTE]: '每分钟',
  [CRON_PRESETS.EVERY_5_MINUTES]: '每5分钟',
  [CRON_PRESETS.EVERY_15_MINUTES]: '每15分钟',
  [CRON_PRESETS.EVERY_30_MINUTES]: '每30分钟',
  [CRON_PRESETS.EVERY_HOUR]: '每小时',
  [CRON_PRESETS.EVERY_2_HOURS]: '每2小时',
  [CRON_PRESETS.EVERY_6_HOURS]: '每6小时',
  [CRON_PRESETS.EVERY_12_HOURS]: '每12小时',
  [CRON_PRESETS.DAILY_MIDNIGHT]: '每天凌晨',
  [CRON_PRESETS.DAILY_NOON]: '每天中午',
  [CRON_PRESETS.WEEKLY_SUNDAY]: '每周日',
  [CRON_PRESETS.WEEKLY_MONDAY]: '每周一',
  [CRON_PRESETS.MONTHLY_FIRST]: '每月1号',
  [CRON_PRESETS.YEARLY]: '每年1月1日'
}
