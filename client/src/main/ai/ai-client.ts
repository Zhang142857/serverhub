/**
 * 统一 AI 请求模块
 * 支持多种 API 类型，同类型多种请求方式自动 fallback
 *
 * OpenAI 兼容: Chat Completions SDK → Responses SDK → 原始 axios SSE
 * Anthropic:   AI SDK
 * Google:      AI SDK
 */

import { streamText, stepCountIs } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import axios from 'axios'

export interface ClientConfig {
  provider: string
  apiKey?: string
  baseUrl: string   // 不含 /v1
  model: string
}

export interface StreamDelta {
  type: 'content' | 'thinking' | 'tool-call' | 'tool-result' | 'done' | 'error'
  content?: string
  toolName?: string
  args?: Record<string, unknown>
  result?: unknown
}

export interface StreamOptions {
  messages: Array<{ role: string; content: string }>
  tools?: Record<string, any>
  onDelta: (delta: StreamDelta) => void
}

// 策略缓存：记住每个 baseUrl 哪种方式能用，带 TTL
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟
const strategyCache = new Map<string, { strategy: string; ts: number }>()

export function clearStrategyCache(): void {
  strategyCache.clear()
  console.log('[AIClient] Strategy cache cleared')
}

/**
 * 统一流式请求入口
 */
export async function streamChat(config: ClientConfig, options: StreamOptions): Promise<void> {
  const type = getApiType(config.provider)

  if (type === 'anthropic') {
    return sdkStream(config, options, () => {
      const p = createAnthropic({ apiKey: config.apiKey || '' })
      return p(config.model)
    })
  }

  if (type === 'google') {
    return sdkStream(config, options, () => {
      const p = createGoogleGenerativeAI({ apiKey: config.apiKey || '' })
      return p(config.model)
    })
  }

  // OpenAI 兼容：多策略 fallback
  return openaiCompatibleStream(config, options)
}

function getApiType(provider: string): 'openai' | 'anthropic' | 'google' {
  if (provider === 'claude') return 'anthropic'
  if (provider === 'gemini') return 'google'
  return 'openai'
}

// ==================== OpenAI 兼容多策略 ====================

type Strategy = { name: string; fn: () => Promise<void> }

async function openaiCompatibleStream(config: ClientConfig, options: StreamOptions): Promise<void> {
  const baseURL = config.baseUrl + '/v1'
  const apiKey = config.apiKey || 'ollama'

  const strategies: Strategy[] = [
    {
      name: 'sdk-chat',
      fn: () => {
        const p = createOpenAI({ baseURL, apiKey })
        return sdkStream(config, options, () => p.chat(config.model))
      }
    },
    {
      name: 'sdk-responses',
      fn: () => {
        const p = createOpenAI({ baseURL, apiKey })
        return sdkStream(config, options, () => p(config.model))
      }
    },
    {
      name: 'raw-sse',
      fn: () => rawSSEStream(config, options)
    }
  ]

  // 优先用缓存的策略
  const entry = strategyCache.get(config.baseUrl)
  const cached = entry && (Date.now() - entry.ts < CACHE_TTL) ? entry.strategy : null
  if (cached) {
    const idx = strategies.findIndex(s => s.name === cached)
    if (idx > 0) {
      const [s] = strategies.splice(idx, 1)
      strategies.unshift(s)
    }
  }

  let lastError: any
  for (const strategy of strategies) {
    try {
      await strategy.fn()
      strategyCache.set(config.baseUrl, { strategy: strategy.name, ts: Date.now() })
      return
    } catch (error: any) {
      lastError = error
      const code = error?.statusCode ?? error?.response?.status ?? 0
      // 只在 404/405/501（端点不存在）时 fallback，其他错误直接抛
      if (code !== 404 && code !== 405 && code !== 501) throw error
      console.log(`[AIClient] ${strategy.name} failed (${code}), trying next...`)
    }
  }
  throw lastError
}

// ==================== AI SDK 通用流式 ====================

// <think>/<thinking> 标签解析器（跨 chunk 状态）
class ThinkTagParser {
  private inThink = false
  private buffer = ''

  parse(text: string, onDelta: StreamOptions['onDelta']): void {
    this.buffer += text
    while (this.buffer.length > 0) {
      if (!this.inThink) {
        // 检查多种思考开始标签
        const match = this.buffer.match(/<think(?:ing)?>/)
        if (!match) {
          // 可能标签还没收完，保留末尾 <... 部分
          const partial = this.buffer.lastIndexOf('<')
          if (partial >= 0 && partial > this.buffer.length - 12) {
            if (partial > 0) onDelta({ type: 'content', content: this.buffer.slice(0, partial) })
            this.buffer = this.buffer.slice(partial)
          } else {
            onDelta({ type: 'content', content: this.buffer })
            this.buffer = ''
          }
          return
        }
        const idx = match.index!
        if (idx > 0) onDelta({ type: 'content', content: this.buffer.slice(0, idx) })
        this.inThink = true
        this.buffer = this.buffer.slice(idx + match[0].length)
      } else {
        const match = this.buffer.match(/<\/think(?:ing)?>/)
        if (!match) {
          // 保留末尾可能的 </... 部分
          const partial = this.buffer.lastIndexOf('<')
          if (partial >= 0 && partial > this.buffer.length - 14) {
            if (partial > 0) onDelta({ type: 'thinking', content: this.buffer.slice(0, partial) })
            this.buffer = this.buffer.slice(partial)
          } else {
            onDelta({ type: 'thinking', content: this.buffer })
            this.buffer = ''
          }
          return
        }
        const idx = match.index!
        if (idx > 0) onDelta({ type: 'thinking', content: this.buffer.slice(0, idx) })
        this.inThink = false
        this.buffer = this.buffer.slice(idx + match[0].length)
      }
    }
  }

  flush(onDelta: StreamOptions['onDelta']): void {
    if (this.buffer) {
      onDelta({ type: this.inThink ? 'thinking' : 'content', content: this.buffer })
      this.buffer = ''
    }
  }
}

async function sdkStream(
  config: ClientConfig,
  options: StreamOptions,
  createModel: () => any
): Promise<void> {
  const model = createModel()
  const result = streamText({
    model,
    messages: options.messages as any,
    tools: options.tools,
    stopWhen: options.tools ? stepCountIs(10) : undefined,
  })

  const parser = new ThinkTagParser()
  let hasReasoning = false

  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'text-delta': {
        const text = (part as any).textDelta ?? ''
        if (hasReasoning) {
          // 模型原生支持 reasoning，text 就是纯文本
          options.onDelta({ type: 'content', content: text })
        } else {
          // 可能含 <think>/<thinking> 标签，需要解析
          parser.parse(text, options.onDelta)
        }
        break
      }
      case 'reasoning':
      case 'reasoning-delta':
        hasReasoning = true
        options.onDelta({ type: 'thinking', content: (part as any).textDelta ?? (part as any).text ?? '' })
        break
      case 'tool-call':
        parser.flush(options.onDelta)
        options.onDelta({ type: 'tool-call', toolName: (part as any).toolName, args: (part as any).args ?? (part as any).input })
        break
      case 'tool-result':
        options.onDelta({ type: 'tool-result', toolName: (part as any).toolName, result: (part as any).result ?? (part as any).output })
        break
      case 'error':
        options.onDelta({ type: 'error', content: String((part as any).error) })
        break
    }
  }
  parser.flush(options.onDelta)
}

// ==================== 原始 axios SSE（最大兼容性） ====================

async function rawSSEStream(config: ClientConfig, options: StreamOptions): Promise<void> {
  const url = `${config.baseUrl}/v1/chat/completions`

  const body: any = {
    model: config.model,
    messages: options.messages,
    stream: true,
  }

  // 工具定义转 OpenAI 格式
  if (options.tools) {
    body.tools = Object.entries(options.tools).map(([name, t]: [string, any]) => ({
      type: 'function',
      function: { name, description: t.description, parameters: t.parameters?.jsonSchema ?? t.parameters ?? {} }
    }))
  }

  const resp = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey || 'ollama'}`,
    },
    responseType: 'stream',
    timeout: 120000,
  })

  const parser = new ThinkTagParser()
  let hasReasoning = false

  for await (const chunk of resp.data) {
    const lines = chunk.toString().split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      try {
        const json = JSON.parse(line.slice(6))
        const delta = json.choices?.[0]?.delta
        if (!delta) continue

        // reasoning_content (DeepSeek-R1 / 部分服务商)
        if (delta.reasoning_content) {
          hasReasoning = true
          options.onDelta({ type: 'thinking', content: delta.reasoning_content })
        }

        // content（可能含 <think>/<thinking> 标签）
        if (delta.content) {
          if (hasReasoning) {
            options.onDelta({ type: 'content', content: delta.content })
          } else {
            parser.parse(delta.content, options.onDelta)
          }
        }

        // tool_calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.function?.name) {
              try {
                const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
                options.onDelta({ type: 'tool-call', toolName: tc.function.name, args })
              } catch {}
            }
          }
        }
      } catch {}
    }
  }
  parser.flush(options.onDelta)
}
