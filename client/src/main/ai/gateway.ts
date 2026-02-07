/**
 * AI 网关 - 统一管理 AI 提供者、工具调用
 * 纯 HTTP SSE 实现，不依赖任何 AI SDK
 */

import { EventEmitter } from 'events'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { streamChat as clientStreamChat, stopCurrentStream } from './ai-client'
import type { StreamDelta, ClientConfig, ToolDef } from './ai-client'
import { ToolRegistry, toolRegistry, ToolExecutor } from './tools/registry'
import { systemTools } from './tools/system'
import { dockerTools } from './tools/docker'
import { fileTools } from './tools/file'
import { environmentTools } from './tools/environment'
import { deploymentTools } from './tools/deployment'
import { monitoringTools } from './tools/monitoring'
import { networkTools } from './tools/network'
import { backupTools } from './tools/backup'
import { taskTools } from './tools/task'

export type CommandPolicy = 'auto-all' | 'auto-safe' | 'auto-file' | 'manual-all'

export interface AIConfig {
  provider: 'openai' | 'claude' | 'ollama' | 'deepseek' | 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'siliconflow' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface AIContext {
  serverId?: string
  history?: ChatMessage[]
  systemPrompt?: string
  agentMode?: boolean
}

export type { StreamDelta }

export class AIGateway extends EventEmitter {
  private config: AIConfig = { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'llama3' }
  private configPath: string = ''
  private toolRegistry: ToolRegistry
  private toolExecutor: ToolExecutor | null = null

  private commandPolicy: CommandPolicy = 'auto-safe'
  private pendingConfirms = new Map<string, { resolve: (approved: boolean) => void }>()

  private systemPrompt = `你是 Runixo AI 助手，一个专业的服务器运维助手。你可以帮助用户：
- 执行服务器命令
- 管理 Docker 容器和镜像
- 分析系统日志和性能指标
- 诊断服务器问题
- 生成配置文件
- 提供运维建议

重要规则：
1. 如果有可用的工具，请主动使用工具获取真实数据，而不是猜测
2. 每次调用工具后，必须用自然语言向用户解释工具的执行结果
3. 用简洁专业的语言回答，避免冗长的解释
4. 如果工具执行失败，要说明原因并提供解决建议`

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
    for (const tools of [systemTools, dockerTools, fileTools, environmentTools, deploymentTools, monitoringTools, networkTools, backupTools, taskTools]) {
      this.toolRegistry.registerAll(tools)
    }
    console.log(`[AIGateway] Registered ${this.toolRegistry.size} tools`)
  }

  setToolExecutor(executor: ToolExecutor): void { this.toolExecutor = executor }

  stopStream(): void { stopCurrentStream() }

  getCommandPolicy(): CommandPolicy { return this.commandPolicy }
  setCommandPolicy(policy: CommandPolicy): void { this.commandPolicy = policy }

  confirmTool(confirmId: string, approved: boolean): void {
    const pending = this.pendingConfirms.get(confirmId)
    if (pending) {
      pending.resolve(approved)
      this.pendingConfirms.delete(confirmId)
    }
  }

  private needsConfirmation(def: { category: string; dangerous?: boolean }): boolean {
    switch (this.commandPolicy) {
      case 'auto-all': return false
      case 'auto-safe': return !!def.dangerous
      case 'auto-file': return def.category !== 'file'
      case 'manual-all': return true
    }
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
      { id: 'siliconflow', name: '硅基流动', description: '硅基流动 SiliconFlow' },
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

  // ==================== Base URL ====================

  private getBaseUrl(): string {
    const defaults: Record<string, string> = {
      openai: 'https://api.openai.com',
      deepseek: 'https://api.deepseek.com',
      groq: 'https://api.groq.com/openai',
      mistral: 'https://api.mistral.ai',
      openrouter: 'https://openrouter.ai/api',
      siliconflow: 'https://api.siliconflow.cn',
      ollama: 'http://localhost:11434',
    }
    const url = this.config.baseUrl || defaults[this.config.provider] || 'https://api.openai.com'
    return url.replace(/\/v1\/?$/, '').replace(/\/+$/, '')
  }

  // ==================== 工具定义转换 ====================

  private getToolDefs(): ToolDef[] {
    return this.toolRegistry.getAll().map(def => ({
      name: def.name,
      description: def.description,
      parameters: def.parameters
    }))
  }

  // ==================== 工具执行器 ====================

  private createToolExecutor(serverId: string, onDelta: (delta: StreamDelta) => void) {
    const executor = this.toolExecutor!
    return async (toolName: string, args: Record<string, unknown>): Promise<any> => {
      const def = this.toolRegistry.get(toolName)
      if (!def) return { success: false, error: `未知工具: ${toolName}` }

      // 危险操作需要确认
      if (this.needsConfirmation(def)) {
        const confirmId = `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        onDelta({ type: 'tool-call' as any, toolName, args, confirmId } as any)
        const approved = await new Promise<boolean>(resolve => {
          this.pendingConfirms.set(confirmId, { resolve })
        })
        if (!approved) return { success: false, error: '用户拒绝执行' }
      }

      return await def.execute(args, {
        serverId, executor,
        onProgress: (msg: string) => this.emit('tool:progress', { tool: toolName, message: msg })
      })
    }
  }

  // ==================== 统一流式聊天 ====================

  async streamChat(
    message: string,
    context: AIContext | undefined,
    onDelta: (delta: StreamDelta) => void
  ): Promise<void> {
    const messages = [
      { role: 'system', content: context?.systemPrompt || this.systemPrompt },
      ...(context?.history || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ]

    const clientConfig: ClientConfig = {
      provider: this.config.provider,
      apiKey: this.config.apiKey,
      baseUrl: this.getBaseUrl(),
      model: this.config.model || 'gpt-3.5-turbo',
    }

    const hasServer = !!(context?.serverId && this.toolExecutor)
    const tools = hasServer ? this.getToolDefs() : undefined
    const executeTool = hasServer ? this.createToolExecutor(context!.serverId!, onDelta) : undefined

    console.log('[AIGateway] streamChat:', {
      provider: clientConfig.provider, model: clientConfig.model,
      baseUrl: clientConfig.baseUrl, msgCount: messages.length, hasTools: !!tools
    })

    try {
      await clientStreamChat(clientConfig, { messages, tools, onDelta, executeTool })
      onDelta({ type: 'done' })
    } catch (error: any) {
      if (error.name === 'AbortError') {
        onDelta({ type: 'done' })
        return
      }
      const msg = error?.message || String(error)
      console.error('[AIGateway] streamChat error:', msg)
      onDelta({ type: 'error', content: `请求失败 [${clientConfig.provider}/${clientConfig.model}]: ${msg}` })
      onDelta({ type: 'done' })
    }
  }

  async chat(message: string, context?: AIContext): Promise<string> {
    let result = ''
    await this.streamChat(message, context, (delta) => {
      if (delta.type === 'content') result += delta.content || ''
    })
    return result
  }
}

export const aiGateway = new AIGateway()
