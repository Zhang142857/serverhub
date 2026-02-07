/**
 * AI 网关 - 基于 Vercel AI SDK
 * 统一管理 AI 提供者、流式输出、工具调用
 */

import { streamText, tool, jsonSchema, stepCountIs } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { EventEmitter } from 'events'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { ToolRegistry, toolRegistry, ToolExecutor } from './tools/registry'
import { systemTools } from './tools/system'
import { dockerTools } from './tools/docker'
import { fileTools } from './tools/file'
import { deploymentTools } from './tools/deployment'
import { monitoringTools } from './tools/monitoring'
import { networkTools } from './tools/network'
import { backupTools } from './tools/backup'
import { taskTools } from './tools/task'

// AI 配置
export interface AIConfig {
  provider: 'openai' | 'claude' | 'ollama' | 'deepseek' | 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
}

// 聊天消息
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

// AI 上下文
export interface AIContext {
  serverId?: string
  history?: ChatMessage[]
  systemPrompt?: string
  agentMode?: boolean
}

// 流式 delta 事件
export interface StreamDelta {
  type: 'content' | 'thinking' | 'tool-call' | 'tool-result' | 'done' | 'error'
  content?: string
  toolName?: string
  args?: Record<string, unknown>
  result?: unknown
}

/**
 * AI 网关类
 */
export class AIGateway extends EventEmitter {
  private config: AIConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3'
  }

  private configPath: string = ''
  private toolRegistry: ToolRegistry
  private toolExecutor: ToolExecutor | null = null

  private systemPrompt: string = `你是 Runixo AI 助手，一个专业的服务器运维助手。你可以帮助用户：
- 执行服务器命令
- 管理 Docker 容器和镜像
- 分析系统日志和性能指标
- 诊断服务器问题
- 生成配置文件
- 提供运维建议

请用简洁专业的语言回答用户问题。如果有可用的工具，请主动使用工具获取真实数据，而不是猜测。`

  constructor() {
    super()
    try {
      this.configPath = join(app.getPath('userData'), 'ai-config.json')
      const saved = JSON.parse(readFileSync(this.configPath, 'utf-8'))
      if (saved.provider) this.config = { ...this.config, ...saved }
    } catch {}

    this.toolRegistry = toolRegistry
    this.registerDefaultTools()
  }

  private registerDefaultTools(): void {
    this.toolRegistry.registerAll(systemTools)
    this.toolRegistry.registerAll(dockerTools)
    this.toolRegistry.registerAll(fileTools)
    this.toolRegistry.registerAll(deploymentTools)
    this.toolRegistry.registerAll(monitoringTools)
    this.toolRegistry.registerAll(networkTools)
    this.toolRegistry.registerAll(backupTools)
    this.toolRegistry.registerAll(taskTools)
    console.log(`[AIGateway] Registered ${this.toolRegistry.size} tools`)
  }

  setToolExecutor(executor: ToolExecutor): void {
    this.toolExecutor = executor
  }

  setProvider(provider: string, config: Partial<AIConfig>): boolean {
    this.config = { ...this.config, provider: provider as AIConfig['provider'], ...config }
    try { writeFileSync(this.configPath, JSON.stringify(this.config, null, 2)) } catch {}
    return true
  }

  getConfig(): AIConfig { return { ...this.config } }

  getProviders() {
    return [
      { id: 'ollama', name: 'Ollama', description: '本地模型' },
      { id: 'openai', name: 'OpenAI', description: 'GPT 系列' },
      { id: 'claude', name: 'Claude', description: 'Anthropic Claude' },
      { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek 系列' },
      { id: 'gemini', name: 'Gemini', description: 'Google Gemini' },
      { id: 'groq', name: 'Groq', description: 'Groq 推理加速' },
      { id: 'mistral', name: 'Mistral', description: 'Mistral AI' },
      { id: 'openrouter', name: 'OpenRouter', description: '多模型路由' },
      { id: 'custom', name: '自定义', description: 'OpenAI 兼容 API' }
    ]
  }

  getAvailableTools() {
    return this.toolRegistry.getAll().map(t => ({
      name: t.name, displayName: t.displayName,
      description: t.description, category: t.category, dangerous: t.dangerous
    }))
  }

  // ==================== AI SDK Provider 创建 ====================

  private getBaseUrl(): string {
    const defaults: Record<string, string> = {
      openai: 'https://api.openai.com',
      deepseek: 'https://api.deepseek.com',
      groq: 'https://api.groq.com/openai',
      mistral: 'https://api.mistral.ai',
      openrouter: 'https://openrouter.ai/api',
      ollama: 'http://localhost:11434',
    }
    let url = this.config.baseUrl || defaults[this.config.provider] || 'https://api.openai.com'
    url = url.replace(/\/v1\/?$/, '').replace(/\/+$/, '')
    return url
  }

  private createModel() {
    const { provider, apiKey, model } = this.config
    const modelId = model || 'gpt-3.5-turbo'

    switch (provider) {
      case 'claude': {
        const p = createAnthropic({ apiKey: apiKey || '' })
        return p(modelId)
      }
      case 'gemini': {
        const p = createGoogleGenerativeAI({ apiKey: apiKey || '' })
        return p(modelId)
      }
      default: {
        // OpenAI-compatible: openai, deepseek, groq, mistral, openrouter, custom, ollama
        const p = createOpenAI({
          baseURL: this.getBaseUrl() + '/v1',
          apiKey: apiKey || 'ollama',
        })
        return p(modelId)
      }
    }
  }

  // ==================== 工具转换 ====================

  private getAISDKTools(serverId: string) {
    if (!this.toolExecutor) return undefined
    const executor = this.toolExecutor
    const allTools = this.toolRegistry.getAll()
    const sdkTools: Record<string, any> = {}

    for (const def of allTools) {
      sdkTools[def.name] = tool({
        description: def.description,
        inputSchema: jsonSchema(def.parameters as any),
        execute: async (params: any) => {
          try {
            const result = await def.execute(params, {
              serverId,
              executor,
              onProgress: (msg: string) => this.emit('tool:progress', { tool: def.name, message: msg })
            })
            return result
          } catch (error) {
            return { success: false, error: (error as Error).message }
          }
        }
      })
    }
    return sdkTools
  }

  // ==================== 统一流式聊天 ====================

  async streamChat(
    message: string,
    context: AIContext | undefined,
    onDelta: (delta: StreamDelta) => void
  ): Promise<void> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: context?.systemPrompt || this.systemPrompt },
      ...(context?.history || []).map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: message }
    ]

    const model = this.createModel()
    const hasServer = !!(context?.serverId && this.toolExecutor)
    const tools = hasServer ? this.getAISDKTools(context!.serverId!) : undefined

    try {
      console.log('[AIGateway] streamChat:', { provider: this.config.provider, model: this.config.model, baseUrl: this.getBaseUrl(), msgCount: messages.length, hasTools: !!tools })
      const result = streamText({
        model,
        messages,
        tools,
        stopWhen: tools ? stepCountIs(10) : undefined,
      })

      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            onDelta({ type: 'content', content: (part as any).textDelta ?? (part as any).text ?? '' })
            break
          case 'reasoning':
          case 'reasoning-delta':
            onDelta({ type: 'thinking', content: (part as any).textDelta ?? (part as any).text ?? '' })
            break
          case 'tool-call':
            onDelta({
              type: 'tool-call',
              toolName: (part as any).toolName,
              args: (part as any).args ?? (part as any).input
            })
            break
          case 'tool-result':
            onDelta({
              type: 'tool-result',
              toolName: (part as any).toolName,
              result: (part as any).result ?? (part as any).output
            })
            break
          case 'error':
            onDelta({ type: 'error', content: String((part as any).error) })
            break
          case 'finish':
            break // 等循环自然结束
        }
      }
      onDelta({ type: 'done' })
    } catch (error: any) {
      const msg = error?.message || String(error)
      console.error(`[AIGateway] streamChat error:`, msg, error?.cause || '')
      onDelta({ type: 'error', content: `请求失败: ${msg}` })
      onDelta({ type: 'done' })
    }
  }

  // 简单聊天（非流式，兼容旧接口）
  async chat(message: string, context?: AIContext): Promise<string> {
    let result = ''
    await this.streamChat(message, context, (delta) => {
      if (delta.type === 'content') result += delta.content || ''
    })
    return result
  }
}

// 单例
export const aiGateway = new AIGateway()
