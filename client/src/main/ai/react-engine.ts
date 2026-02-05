/**
 * ReAct 引擎
 * 实现 Think → Act → Observe 循环
 * 支持多轮工具调用和任务规划
 */

import { EventEmitter } from 'events'
import { ToolRegistry, ToolResult, ToolContext, ToolExecutor } from './tools/registry'

// ReAct 步骤类型
export type ReActStepType = 'think' | 'act' | 'observe' | 'answer'

// ReAct 步骤
export interface ReActStep {
  type: ReActStepType
  content: string
  timestamp: Date
  toolCall?: {
    name: string
    arguments: Record<string, unknown>
  }
  toolResult?: ToolResult
}

// 任务计划
export interface TaskPlan {
  goal: string
  steps: TaskStep[]
  currentStep: number
  status: 'planning' | 'executing' | 'completed' | 'failed'
}

// 任务步骤
export interface TaskStep {
  id: number
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  toolCalls?: string[]
  result?: string
}

// ReAct 配置
export interface ReActConfig {
  maxIterations: number
  enablePlanning: boolean
  requireConfirmation: boolean
  streamOutput: boolean
}

// ReAct 上下文
export interface ReActContext {
  serverId: string
  executor: ToolExecutor
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  systemPrompt?: string
}

// AI 提供者接口
export interface AIProvider {
  chat(
    messages: Array<{ role: string; content: string }>,
    options?: {
      tools?: Array<{
        type: 'function'
        function: { name: string; description: string; parameters: Record<string, unknown> }
      }>
      stream?: boolean
    }
  ): Promise<AIResponse>
}

// AI 响应
export interface AIResponse {
  content: string
  toolCalls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
  finishReason?: string
}

/**
 * ReAct 引擎
 */
export class ReActEngine extends EventEmitter {
  private toolRegistry: ToolRegistry
  private config: ReActConfig
  private aiProvider: AIProvider | null = null

  constructor(toolRegistry: ToolRegistry, config?: Partial<ReActConfig>) {
    super()
    this.toolRegistry = toolRegistry
    this.config = {
      maxIterations: 10,
      enablePlanning: true,
      requireConfirmation: true,
      streamOutput: true,
      ...config
    }
  }

  /**
   * 设置 AI 提供者
   */
  setAIProvider(provider: AIProvider): void {
    this.aiProvider = provider
  }

  /**
   * 执行 ReAct 循环
   */
  async execute(
    userMessage: string,
    context: ReActContext,
    onStep?: (step: ReActStep) => void
  ): Promise<{
    response: string
    steps: ReActStep[]
    plan?: TaskPlan
  }> {
    if (!this.aiProvider) {
      throw new Error('AI provider not set')
    }

    const steps: ReActStep[] = []
    let plan: TaskPlan | undefined
    let iteration = 0
    let finalResponse = ''

    // 构建系统提示
    const systemPrompt = this.buildSystemPrompt(context)

    // 构建消息历史
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...context.history,
      { role: 'user', content: userMessage }
    ]

    // 如果启用规划，先生成任务计划
    if (this.config.enablePlanning) {
      plan = await this.generatePlan(userMessage, messages)
      if (plan) {
        this.emit('plan:generated', plan)
        onStep?.({
          type: 'think',
          content: `任务规划:\n${plan.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}`,
          timestamp: new Date()
        })
      }
    }

    // ReAct 循环
    while (iteration < this.config.maxIterations) {
      iteration++

      // Think: 让 AI 思考下一步
      const thinkStep: ReActStep = {
        type: 'think',
        content: `正在分析任务... (迭代 ${iteration}/${this.config.maxIterations})`,
        timestamp: new Date()
      }
      steps.push(thinkStep)
      onStep?.(thinkStep)
      this.emit('step:think', thinkStep)

      // 调用 AI
      const response = await this.aiProvider.chat(messages, {
        tools: this.toolRegistry.getToolDefinitions(),
        stream: this.config.streamOutput
      })

      // 检查是否有工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Act: 执行工具调用
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name
          let toolArgs: Record<string, unknown>

          try {
            toolArgs = JSON.parse(toolCall.function.arguments)
          } catch {
            toolArgs = {}
          }

          // 检查是否是危险操作
          const tool = this.toolRegistry.get(toolName)
          if (tool?.dangerous && this.config.requireConfirmation) {
            this.emit('confirmation:required', {
              tool: toolName,
              arguments: toolArgs,
              description: tool.description
            })
            // 等待确认（在实际实现中，这里需要等待用户确认）
          }

          const actStep: ReActStep = {
            type: 'act',
            content: `执行工具: ${toolName}`,
            timestamp: new Date(),
            toolCall: {
              name: toolName,
              arguments: toolArgs
            }
          }
          steps.push(actStep)
          onStep?.(actStep)
          this.emit('step:act', actStep)

          // 执行工具
          const toolContext: ToolContext = {
            serverId: context.serverId,
            executor: context.executor,
            onProgress: (msg) => this.emit('tool:progress', { tool: toolName, message: msg })
          }

          const result = await this.toolRegistry.execute(toolName, toolArgs, toolContext)

          // Observe: 观察结果
          const observeStep: ReActStep = {
            type: 'observe',
            content: result.success
              ? `工具执行成功: ${result.message || JSON.stringify(result.data).substring(0, 500)}`
              : `工具执行失败: ${result.error}`,
            timestamp: new Date(),
            toolResult: result
          }
          steps.push(observeStep)
          onStep?.(observeStep)
          this.emit('step:observe', observeStep)

          // 更新任务计划状态
          if (plan && plan.currentStep < plan.steps.length) {
            const currentPlanStep = plan.steps[plan.currentStep]
            if (result.success) {
              currentPlanStep.status = 'completed'
              currentPlanStep.result = result.message || 'Success'
              plan.currentStep++
            } else {
              currentPlanStep.status = 'failed'
              currentPlanStep.result = result.error
            }
            this.emit('plan:updated', plan)
          }

          // 将工具结果添加到消息历史
          messages.push({
            role: 'assistant',
            content: response.content || `调用工具 ${toolName}`
          })
          messages.push({
            role: 'user',
            content: `工具 ${toolName} 执行结果:\n${JSON.stringify(result, null, 2)}`
          })
        }
      } else {
        // 没有工具调用，AI 给出最终回答
        finalResponse = response.content

        const answerStep: ReActStep = {
          type: 'answer',
          content: finalResponse,
          timestamp: new Date()
        }
        steps.push(answerStep)
        onStep?.(answerStep)
        this.emit('step:answer', answerStep)

        // 更新计划状态
        if (plan) {
          plan.status = 'completed'
          this.emit('plan:completed', plan)
        }

        break
      }
    }

    // 如果达到最大迭代次数但没有最终回答
    if (!finalResponse) {
      finalResponse = '抱歉，任务过于复杂，无法在限定步骤内完成。请尝试简化您的请求。'
      if (plan) {
        plan.status = 'failed'
      }
    }

    return {
      response: finalResponse,
      steps,
      plan
    }
  }

  /**
   * 生成任务计划
   */
  private async generatePlan(
    userMessage: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<TaskPlan | undefined> {
    if (!this.aiProvider) return undefined

    const planningPrompt = `分析用户请求，生成一个简洁的任务计划。

用户请求: ${userMessage}

请以 JSON 格式返回任务计划:
{
  "goal": "任务目标",
  "steps": [
    {"description": "步骤描述", "toolCalls": ["可能用到的工具名称"]}
  ]
}

只返回 JSON，不要其他内容。如果任务很简单不需要计划，返回 null。`

    try {
      const response = await this.aiProvider.chat([
        ...messages.slice(0, 1), // 只保留系统提示
        { role: 'user', content: planningPrompt }
      ])

      const content = response.content.trim()
      if (content === 'null' || !content) {
        return undefined
      }

      // 尝试解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const planData = JSON.parse(jsonMatch[0])
        return {
          goal: planData.goal,
          steps: planData.steps.map((s: { description: string; toolCalls?: string[] }, i: number) => ({
            id: i + 1,
            description: s.description,
            status: 'pending' as const,
            toolCalls: s.toolCalls
          })),
          currentStep: 0,
          status: 'executing'
        }
      }
    } catch (error) {
      console.error('Failed to generate plan:', error)
    }

    return undefined
  }

  /**
   * 构建系统提示
   */
  private buildSystemPrompt(context: ReActContext): string {
    const tools = this.toolRegistry.getAll()
    const toolDescriptions = tools
      .map(t => `- ${t.name}: ${t.description}${t.dangerous ? ' [危险操作]' : ''}`)
      .join('\n')

    return context.systemPrompt || `你是 ServerHub AI 助手，一个专业的服务器运维助手。你运行在 Agent 模式下，可以直接操作服务器执行任务。

## 可用工具
${toolDescriptions}

## 工作模式
你采用 ReAct (Reasoning + Acting) 模式工作：
1. **Think**: 分析用户需求，思考解决方案
2. **Act**: 调用合适的工具执行操作
3. **Observe**: 观察工具执行结果
4. **Repeat**: 根据结果决定下一步行动，直到任务完成

## 规则
1. 每次只执行一个工具调用，观察结果后再决定下一步
2. 危险操作（标记为 [危险操作] 的工具）执行前会请求用户确认
3. 如果工具执行失败，分析原因并尝试其他方法
4. 任务完成后，用简洁的中文总结执行结果
5. 如果无法完成任务，诚实告知用户原因

## 当前服务器
服务器 ID: ${context.serverId}

请根据用户的请求，使用合适的工具完成任务。`
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ReActConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取配置
   */
  getConfig(): ReActConfig {
    return { ...this.config }
  }
}

// 导出单例
export const createReActEngine = (toolRegistry: ToolRegistry, config?: Partial<ReActConfig>): ReActEngine => {
  return new ReActEngine(toolRegistry, config)
}
