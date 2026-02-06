/**
 * 增强的工具注册中心
 * 支持插件工具注册、智能搜索、使用统计等
 */

import { EventEmitter } from 'events'
import { ToolDefinition, ToolContext, ToolResult } from './registry'

/**
 * 工具使用统计
 */
export interface ToolUsageStats {
  callCount: number
  successCount: number
  failureCount: number
  avgExecutionTime: number
  lastUsed?: Date
}

/**
 * 搜索上下文
 */
export interface SearchContext {
  category?: string
  query?: string
  limit?: number
}

/**
 * 推荐上下文
 */
export interface RecommendContext {
  taskType?: string
  recentTools?: string[]
  limit?: number
}

/**
 * 增强的工具注册中心
 */
export class EnhancedToolRegistry extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map()
  private categories: Map<string, Set<string>> = new Map()
  private pluginTools: Map<string, Set<string>> = new Map()
  private usageStats: Map<string, ToolUsageStats> = new Map()

  constructor() {
    super()
    // 初始化默认分类
    const defaultCategories = [
      'system',
      'docker',
      'file',
      'network',
      'database',
      'plugin',
      'deployment',
      'monitoring',
      'cloud',
      'security'
    ]
    defaultCategories.forEach(cat => this.categories.set(cat, new Set()))
  }

  /**
   * 注册工具（支持插件注册）
   */
  register(tool: ToolDefinition, pluginId?: string): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Tool ${tool.name} already registered, overwriting...`)
    }

    this.tools.set(tool.name, tool)

    // 分类索引
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set())
    }
    this.categories.get(tool.category)!.add(tool.name)

    // 插件工具索引
    if (pluginId) {
      if (!this.pluginTools.has(pluginId)) {
        this.pluginTools.set(pluginId, new Set())
      }
      this.pluginTools.get(pluginId)!.add(tool.name)
    }

    // 初始化使用统计
    if (!this.usageStats.has(tool.name)) {
      this.usageStats.set(tool.name, {
        callCount: 0,
        successCount: 0,
        failureCount: 0,
        avgExecutionTime: 0
      })
    }

    this.emit('tool:registered', { tool, pluginId })
    console.log(`[ToolRegistry] Registered tool: ${tool.name}${pluginId ? ` (plugin: ${pluginId})` : ''}`)
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: ToolDefinition[], pluginId?: string): void {
    tools.forEach(tool => this.register(tool, pluginId))
  }

  /**
   * 注销工具
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name)
    if (!tool) return false

    this.tools.delete(name)
    this.categories.get(tool.category)?.delete(name)
    this.usageStats.delete(name)

    // 从插件工具索引中移除
    for (const [pluginId, toolSet] of this.pluginTools.entries()) {
      if (toolSet.has(name)) {
        toolSet.delete(name)
        if (toolSet.size === 0) {
          this.pluginTools.delete(pluginId)
        }
      }
    }

    this.emit('tool:unregistered', name)
    console.log(`[ToolRegistry] Unregistered tool: ${name}`)
    return true
  }

  /**
   * 卸载插件的所有工具
   */
  unregisterPluginTools(pluginId: string): void {
    const toolNames = this.pluginTools.get(pluginId)
    if (!toolNames) return

    console.log(`[ToolRegistry] Unregistering ${toolNames.size} tools from plugin: ${pluginId}`)

    for (const toolName of toolNames) {
      this.unregister(toolName)
    }

    this.pluginTools.delete(pluginId)
  }

  /**
   * 获取工具
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * 获取所有工具
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /**
   * 按分类获取工具
   */
  getByCategory(category: string): ToolDefinition[] {
    const toolNames = this.categories.get(category)
    if (!toolNames) return []
    return Array.from(toolNames)
      .map(name => this.tools.get(name)!)
      .filter(Boolean)
  }

  /**
   * 获取插件的工具
   */
  getPluginTools(pluginId: string): ToolDefinition[] {
    const toolNames = this.pluginTools.get(pluginId)
    if (!toolNames) return []
    return Array.from(toolNames)
      .map(name => this.tools.get(name)!)
      .filter(Boolean)
  }

  /**
   * 智能搜索工具
   */
  searchTools(context: SearchContext): ToolDefinition[] {
    const { query, category, limit = 10 } = context
    const results: Array<{ tool: ToolDefinition; score: number }> = []

    for (const tool of this.tools.values()) {
      let score = 0

      // 分类匹配
      if (category && tool.category === category) {
        score += 10
      }

      // 查询匹配
      if (query) {
        const lowerQuery = query.toLowerCase()
        
        // 名称匹配
        if (tool.name.toLowerCase().includes(lowerQuery)) {
          score += 10
        }
        
        // 显示名称匹配
        if (tool.displayName.toLowerCase().includes(lowerQuery)) {
          score += 8
        }
        
        // 描述匹配
        if (tool.description.toLowerCase().includes(lowerQuery)) {
          score += 5
        }
      }

      // 使用频率加权
      const stats = this.usageStats.get(tool.name)
      if (stats && stats.callCount > 0) {
        score += Math.log(stats.callCount + 1) * 0.5
        
        // 成功率加权
        const successRate = stats.successCount / stats.callCount
        score += successRate * 2
      }

      if (score > 0 || !query) {
        results.push({ tool, score })
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score)

    return results.slice(0, limit).map(r => r.tool)
  }

  /**
   * 推荐工具
   */
  recommendTools(context: RecommendContext): ToolDefinition[] {
    const { taskType, recentTools = [], limit = 10 } = context
    const recommendations: Array<{ tool: ToolDefinition; relevance: number }> = []

    for (const tool of this.tools.values()) {
      let relevance = 0

      // 基于任务类型
      if (taskType && tool.category === taskType) {
        relevance += 5
      }

      // 基于最近使用
      if (recentTools.includes(tool.name)) {
        relevance += 3
      }

      // 基于成功率
      const stats = this.usageStats.get(tool.name)
      if (stats && stats.callCount > 0) {
        const successRate = stats.successCount / stats.callCount
        relevance += successRate * 2
        
        // 使用频率
        relevance += Math.log(stats.callCount + 1) * 0.3
      }

      if (relevance > 0) {
        recommendations.push({ tool, relevance })
      }
    }

    recommendations.sort((a, b) => b.relevance - a.relevance)

    return recommendations.slice(0, limit).map(r => r.tool)
  }

  /**
   * 执行工具
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` }
    }

    const startTime = Date.now()

    // 发出执行前事件
    this.emit('tool:before_execute', { name, params, dangerous: tool.dangerous })

    try {
      const result = await tool.execute(params, context)
      const executionTime = Date.now() - startTime

      // 记录使用统计
      this.recordUsage(name, result.success, executionTime)

      // 发出执行后事件
      this.emit('tool:after_execute', { name, params, result, executionTime })

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorResult: ToolResult = {
        success: false,
        error: (error as Error).message
      }

      // 记录失败统计
      this.recordUsage(name, false, executionTime)

      this.emit('tool:error', { name, params, error })

      return errorResult
    }
  }

  /**
   * 记录工具使用
   */
  private recordUsage(toolName: string, success: boolean, executionTime: number): void {
    const stats = this.usageStats.get(toolName)
    if (!stats) return

    stats.callCount++
    if (success) {
      stats.successCount++
    } else {
      stats.failureCount++
    }

    // 更新平均执行时间
    stats.avgExecutionTime =
      (stats.avgExecutionTime * (stats.callCount - 1) + executionTime) / stats.callCount

    stats.lastUsed = new Date()
  }

  /**
   * 获取工具使用统计
   */
  getUsageStats(toolName: string): ToolUsageStats | undefined {
    return this.usageStats.get(toolName)
  }

  /**
   * 获取所有工具统计
   */
  getAllUsageStats(): Map<string, ToolUsageStats> {
    return new Map(this.usageStats)
  }

  /**
   * 获取最常用的工具
   */
  getMostUsedTools(limit: number = 10): Array<{ tool: ToolDefinition; stats: ToolUsageStats }> {
    const results: Array<{ tool: ToolDefinition; stats: ToolUsageStats }> = []

    for (const [name, stats] of this.usageStats.entries()) {
      const tool = this.tools.get(name)
      if (tool && stats.callCount > 0) {
        results.push({ tool, stats })
      }
    }

    results.sort((a, b) => b.stats.callCount - a.stats.callCount)

    return results.slice(0, limit)
  }

  /**
   * 获取工具定义（用于 AI 调用）
   */
  getToolDefinitions(): Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, unknown>
    }
  }> {
    return this.getAll().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
  }

  /**
   * 获取危险工具列表
   */
  getDangerousTools(): ToolDefinition[] {
    return this.getAll().filter(tool => tool.dangerous)
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 获取工具数量
   */
  get size(): number {
    return this.tools.size
  }

  /**
   * 获取分类列表
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys())
  }

  /**
   * 获取插件列表
   */
  getPlugins(): string[] {
    return Array.from(this.pluginTools.keys())
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear()
    this.categories.forEach(set => set.clear())
    this.pluginTools.clear()
    this.usageStats.clear()
    this.emit('tools:cleared')
  }
}

// 全局增强工具注册中心实例
export const enhancedToolRegistry = new EnhancedToolRegistry()
