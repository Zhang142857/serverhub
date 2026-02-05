/**
 * AI 网关
 * 统一管理 AI 提供者和工具调用
 */

import axios, { AxiosInstance } from 'axios'
import { EventEmitter } from 'events'
import { ToolRegistry, toolRegistry, ToolExecutor, ToolContext } from './tools/registry'
import { systemTools } from './tools/system'
import { dockerTools } from './tools/docker'
import { fileTools } from './tools/file'
import { ReActEngine, createReActEngine, ReActStep, TaskPlan, AIProvider, AIResponse } from './react-engine'

// AI 配置
export interface AIConfig {
  provider: 'openai' | 'claude' | 'ollama' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
}

// 聊天消息
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

// 工具调用
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

// AI 上下文
export interface AIContext {
  serverId?: string
  history?: ChatMessage[]
  systemPrompt?: string
  agentMode?: boolean
}

// Agent 执行结果
export interface AgentResult {
  response: string
  steps: ReActStep[]
  plan?: TaskPlan
  toolCalls: Array<{
    name: string
    arguments: Record<string, unknown>
    result: unknown
    success: boolean
  }>
}

/**
 * AI 网关类
 */
export class AIGateway extends EventEmitter implements AIProvider {
  private config: AIConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3'
  }

  private httpClient: AxiosInstance
  private toolRegistry: ToolRegistry
  private reactEngine: ReActEngine
  private toolExecutor: ToolExecutor | null = null
  private maxToolCalls: number = 10

  private systemPrompt: string = `你是 ServerHub AI 助手，一个专业的服务器运维助手。你可以帮助用户：
- 执行服务器命令
- 管理 Docker 容器和镜像
- 分析系统日志和性能指标
- 诊断服务器问题
- 生成配置文件
- 提供运维建议

请用简洁专业的语言回答用户问题。`

  constructor() {
    super()
    this.httpClient = axios.create({
      timeout: 120000
    })

    // 使用全局工具注册中心
    this.toolRegistry = toolRegistry

    // 注册默认工具
    this.registerDefaultTools()

    // 创建 ReAct 引擎
    this.reactEngine = createReActEngine(this.toolRegistry, {
      maxIterations: 10,
      enablePlanning: true,
      requireConfirmation: true,
      streamOutput: true
    })

    // 设置 AI 提供者
    this.reactEngine.setAIProvider(this)

    // 转发 ReAct 引擎事件
    this.setupReActEvents()
  }

  /**
   * 设置 ReAct 引擎事件转发
   */
  private setupReActEvents(): void {
    this.reactEngine.on('step:think', (step) => this.emit('agent:think', step))
    this.reactEngine.on('step:act', (step) => this.emit('agent:act', step))
    this.reactEngine.on('step:observe', (step) => this.emit('agent:observe', step))
    this.reactEngine.on('step:answer', (step) => this.emit('agent:answer', step))
    this.reactEngine.on('plan:generated', (plan) => this.emit('agent:plan', plan))
    this.reactEngine.on('plan:updated', (plan) => this.emit('agent:plan_update', plan))
    this.reactEngine.on('confirmation:required', (data) => this.emit('agent:confirm', data))
    this.reactEngine.on('tool:progress', (data) => this.emit('tool:progress', data))
  }

  /**
   * 注册默认工具
   */
  private registerDefaultTools(): void {
    // 注册系统工具
    this.toolRegistry.registerAll(systemTools)

    // 注册 Docker 工具
    this.toolRegistry.registerAll(dockerTools)

    // 注册文件工具
    this.toolRegistry.registerAll(fileTools)

    console.log(`[AIGateway] Registered ${this.toolRegistry.size} tools`)
  }

  /**
   * 设置工具执行器（由 IPC 处理器注入）
   */
  setToolExecutor(executor: ToolExecutor): void {
    this.toolExecutor = executor
  }

  /**
   * 设置 AI 提供者
   */
  setProvider(provider: string, config: Partial<AIConfig>): boolean {
    this.config = {
      ...this.config,
      provider: provider as AIConfig['provider'],
      ...config
    }
    return true
  }

  /**
   * 获取配置
   */
  getConfig(): AIConfig {
    return { ...this.config }
  }

  /**
   * 获取可用的 AI 提供者列表
   */
  getProviders(): Array<{ id: string; name: string; description: string }> {
    return [
      { id: 'ollama', name: 'Ollama', description: '本地运行的开源大语言模型' },
      { id: 'openai', name: 'OpenAI', description: 'GPT-4 等 OpenAI 模型' },
      { id: 'claude', name: 'Claude', description: 'Anthropic Claude 模型' },
      { id: 'custom', name: '自定义', description: '自定义 API 端点' }
    ]
  }

  /**
   * 获取工具注册中心
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry
  }

  /**
   * 获取所有可用工具
   */
  getAvailableTools(): Array<{
    name: string
    displayName: string
    description: string
    category: string
    dangerous: boolean
  }> {
    return this.toolRegistry.getAll().map(tool => ({
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category,
      dangerous: tool.dangerous || false
    }))
  }

  /**
   * 普通聊天（非 Agent 模式）
   */
  async chat(
    message: string,
    context?: AIContext,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    // 如果是 Agent 模式，使用 ReAct 引擎
    if (context?.agentMode && context?.serverId && this.toolExecutor) {
      const result = await this.executeAgent(message, context, onStream)
      return result.response
    }

    // 普通聊天模式
    const messages: ChatMessage[] = [
      { role: 'system', content: context?.systemPrompt || this.systemPrompt },
      ...(context?.history || []),
      { role: 'user', content: message }
    ]

    switch (this.config.provider) {
      case 'ollama':
        return this.chatWithOllama(messages, context, onStream)
      case 'openai':
        return this.chatWithOpenAI(messages, context, onStream)
      case 'claude':
        return this.chatWithClaude(messages, context, onStream)
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`)
    }
  }

  /**
   * 实现 AIProvider 接口的 chat 方法
   */
  async chatWithTools(
    messages: Array<{ role: string; content: string }>,
    options?: {
      tools?: Array<{
        type: 'function'
        function: { name: string; description: string; parameters: Record<string, unknown> }
      }>
      stream?: boolean
    }
  ): Promise<AIResponse> {
    const chatMessages = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }))

    switch (this.config.provider) {
      case 'openai':
        return this.chatWithOpenAITools(chatMessages, options)
      case 'claude':
        return this.chatWithClaudeTools(chatMessages, options)
      case 'ollama':
        return this.chatWithOllamaTools(chatMessages, options)
      default:
        // 默认返回纯文本响应
        const response = await this.chat(messages[messages.length - 1].content)
        return { content: response }
    }
  }

  /**
   * Agent 模式执行
   */
  async executeAgent(
    message: string,
    context: AIContext,
    onStream?: (chunk: string) => void
  ): Promise<AgentResult> {
    if (!context.serverId) {
      throw new Error('Agent mode requires serverId')
    }

    if (!this.toolExecutor) {
      throw new Error('Tool executor not set')
    }

    const toolCalls: AgentResult['toolCalls'] = []

    // 监听工具执行事件
    const onToolExecute = (step: ReActStep) => {
      if (step.toolCall && step.toolResult) {
        toolCalls.push({
          name: step.toolCall.name,
          arguments: step.toolCall.arguments,
          result: step.toolResult.data,
          success: step.toolResult.success
        })
      }
    }

    this.reactEngine.on('step:observe', onToolExecute)

    try {
      const result = await this.reactEngine.execute(
        message,
        {
          serverId: context.serverId,
          executor: this.toolExecutor,
          history: (context.history || []).map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content
          })),
          systemPrompt: context.systemPrompt
        },
        (step) => {
          // 流式输出
          if (onStream && step.type === 'answer') {
            onStream(step.content)
          }
          // 发出步骤事件
          this.emit('agent:step', step)
        }
      )

      return {
        response: result.response,
        steps: result.steps,
        plan: result.plan,
        toolCalls
      }
    } finally {
      this.reactEngine.off('step:observe', onToolExecute)
    }
  }

  /**
   * OpenAI 带工具调用
   */
  private async chatWithOpenAITools(
    messages: ChatMessage[],
    options?: {
      tools?: Array<{
        type: 'function'
        function: { name: string; description: string; parameters: Record<string, unknown> }
      }>
      stream?: boolean
    }
  ): Promise<AIResponse> {
    const url = `${this.config.baseUrl || 'https://api.openai.com'}/v1/chat/completions`

    const response = await this.httpClient.post(url, {
      model: this.config.model || 'gpt-4',
      messages,
      stream: false,
      tools: options?.tools,
      tool_choice: options?.tools?.length ? 'auto' : undefined
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    const assistantMessage = response.data.choices?.[0]?.message
    return {
      content: assistantMessage?.content || '',
      toolCalls: assistantMessage?.tool_calls,
      finishReason: response.data.choices?.[0]?.finish_reason
    }
  }

  /**
   * Claude 带工具调用
   */
  private async chatWithClaudeTools(
    messages: ChatMessage[],
    options?: {
      tools?: Array<{
        type: 'function'
        function: { name: string; description: string; parameters: Record<string, unknown> }
      }>
      stream?: boolean
    }
  ): Promise<AIResponse> {
    const url = `${this.config.baseUrl || 'https://api.anthropic.com'}/v1/messages`

    // 转换工具格式为 Claude 格式
    const tools = options?.tools?.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters
    }))

    // 分离系统消息
    const systemMessage = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const response = await this.httpClient.post(url, {
      model: this.config.model || 'claude-3-opus-20240229',
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content
      })),
      tools
    }, {
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    })

    // 转换 Claude 响应格式
    const content = response.data.content || []
    const textContent = content.find((c: { type: string }) => c.type === 'text')
    const toolUseContent = content.filter((c: { type: string }) => c.type === 'tool_use')

    const toolCalls = toolUseContent.map((t: { id: string; name: string; input: unknown }, i: number) => ({
      id: t.id || `call_${i}`,
      type: 'function' as const,
      function: {
        name: t.name,
        arguments: JSON.stringify(t.input)
      }
    }))

    return {
      content: textContent?.text || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: response.data.stop_reason
    }
  }

  /**
   * Ollama 带工具调用
   */
  private async chatWithOllamaTools(
    messages: ChatMessage[],
    options?: {
      tools?: Array<{
        type: 'function'
        function: { name: string; description: string; parameters: Record<string, unknown> }
      }>
      stream?: boolean
    }
  ): Promise<AIResponse> {
    const url = `${this.config.baseUrl}/api/chat`

    const response = await this.httpClient.post(url, {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role === 'tool' ? 'assistant' : m.role,
        content: m.content
      })),
      tools: options?.tools,
      stream: false
    })

    return {
      content: response.data.message?.content || '',
      toolCalls: response.data.message?.tool_calls,
      finishReason: response.data.done ? 'stop' : undefined
    }
  }

  /**
   * Ollama 聊天
   */
  private async chatWithOllama(
    messages: ChatMessage[],
    _context?: AIContext,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    const url = `${this.config.baseUrl}/api/chat`

    if (onStream) {
      const response = await this.httpClient.post(url, {
        model: this.config.model,
        messages: messages.map(m => ({
          role: m.role === 'tool' ? 'assistant' : m.role,
          content: m.content
        })),
        stream: true
      }, {
        responseType: 'stream'
      })

      let fullResponse = ''

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter((line: string) => line.trim())
          for (const line of lines) {
            try {
              const json = JSON.parse(line)
              if (json.message?.content) {
                fullResponse += json.message.content
                onStream(json.message.content)
              }
              if (json.done) {
                resolve(fullResponse)
              }
            } catch {
              // 忽略解析错误
            }
          }
        })
        response.data.on('error', reject)
      })
    } else {
      const response = await this.httpClient.post(url, {
        model: this.config.model,
        messages: messages.map(m => ({
          role: m.role === 'tool' ? 'assistant' : m.role,
          content: m.content
        })),
        stream: false
      })
      return response.data.message?.content || ''
    }
  }

  /**
   * OpenAI 聊天
   */
  private async chatWithOpenAI(
    messages: ChatMessage[],
    context?: AIContext,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    const url = `${this.config.baseUrl || 'https://api.openai.com'}/v1/chat/completions`
    const tools = context?.agentMode ? this.toolRegistry.getToolDefinitions() : undefined

    let currentMessages = [...messages]
    let toolCallCount = 0

    while (toolCallCount < this.maxToolCalls) {
      const response = await this.httpClient.post(url, {
        model: this.config.model || 'gpt-4',
        messages: currentMessages,
        stream: false,
        tools: tools,
        tool_choice: tools?.length ? 'auto' : undefined
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      const assistantMessage = response.data.choices?.[0]?.message
      if (!assistantMessage) {
        throw new Error('No response from OpenAI')
      }

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && context?.serverId && this.toolExecutor) {
        currentMessages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: assistantMessage.tool_calls
        })

        for (const toolCall of assistantMessage.tool_calls) {
          this.emit('tool_call', {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          })

          const toolContext: ToolContext = {
            serverId: context.serverId,
            executor: this.toolExecutor
          }

          let params: Record<string, unknown>
          try {
            params = JSON.parse(toolCall.function.arguments)
          } catch {
            params = {}
          }

          const result = await this.toolRegistry.execute(toolCall.function.name, params, toolContext)

          this.emit('tool_result', {
            name: toolCall.function.name,
            result
          })

          currentMessages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id
          })
        }

        toolCallCount++
      } else {
        const finalContent = assistantMessage.content || ''
        if (onStream && finalContent) {
          onStream(finalContent)
        }
        return finalContent
      }
    }

    return '抱歉，操作过于复杂，请尝试简化您的请求。'
  }

  /**
   * Claude 聊天
   */
  private async chatWithClaude(
    messages: ChatMessage[],
    _context?: AIContext,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    const url = `${this.config.baseUrl || 'https://api.anthropic.com'}/v1/messages`

    const systemMessage = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const response = await this.httpClient.post(url, {
      model: this.config.model || 'claude-3-opus-20240229',
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content
      })),
      stream: !!onStream
    }, {
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      responseType: onStream ? 'stream' : 'json'
    })

    if (onStream) {
      let fullResponse = ''

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter((line: string) => line.startsWith('data: '))
          for (const line of lines) {
            try {
              const json = JSON.parse(line.slice(6))
              if (json.type === 'content_block_delta') {
                const text = json.delta?.text
                if (text) {
                  fullResponse += text
                  onStream(text)
                }
              }
              if (json.type === 'message_stop') {
                resolve(fullResponse)
              }
            } catch {
              // 忽略解析错误
            }
          }
        })
        response.data.on('error', reject)
      })
    } else {
      return response.data.content?.[0]?.text || ''
    }
  }
}

// 导出单例
export const aiGateway = new AIGateway()
