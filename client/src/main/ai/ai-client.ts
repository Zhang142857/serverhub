/**
 * AI 客户端 - 纯 HTTP SSE 实现
 * 支持：流式输出、连续工具调用、思考过程、中断控制
 * 不依赖任何 AI SDK
 */

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
  toolCallId?: string
  args?: Record<string, unknown>
  result?: unknown
}

export interface ToolDef {
  name: string
  description: string
  parameters: object
}

export interface StreamOptions {
  messages: Array<{ role: string; content: string | any; tool_call_id?: string; tool_calls?: any[] }>
  tools?: ToolDef[]
  onDelta: (delta: StreamDelta) => void
  /** 工具执行器：收到 tool_call 后由外部执行，返回结果 */
  executeTool?: (name: string, args: Record<string, unknown>) => Promise<any>
  signal?: AbortSignal
}

// ==================== 全局中断控制 ====================
let currentAbort: AbortController | null = null

export function stopCurrentStream(): void {
  if (currentAbort) {
    currentAbort.abort()
    currentAbort = null
    console.log('[AIClient] Stream aborted by user')
  }
}

// ==================== <think> 标签解析器 ====================
class ThinkTagParser {
  private inThink = false
  private buffer = ''

  parse(text: string, onDelta: StreamOptions['onDelta']): void {
    this.buffer += text
    while (this.buffer.length > 0) {
      if (!this.inThink) {
        const match = this.buffer.match(/<think(?:ing)?>/)
        if (!match) {
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
        if (match.index! > 0) onDelta({ type: 'content', content: this.buffer.slice(0, match.index!) })
        this.inThink = true
        this.buffer = this.buffer.slice(match.index! + match[0].length)
      } else {
        const match = this.buffer.match(/<\/think(?:ing)?>/)
        if (!match) {
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
        if (match.index! > 0) onDelta({ type: 'thinking', content: this.buffer.slice(0, match.index!) })
        this.inThink = false
        this.buffer = this.buffer.slice(match.index! + match[0].length)
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

// ==================== 核心：流式请求 + 连续工具调用 ====================

const MAX_TOOL_ROUNDS = 15

export async function streamChat(config: ClientConfig, options: StreamOptions): Promise<void> {
  const abort = new AbortController()
  currentAbort = abort
  // 外部 signal 联动
  if (options.signal) {
    options.signal.addEventListener('abort', () => abort.abort())
  }

  const url = `${config.baseUrl}/v1/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey || 'ollama'}`,
  }

  // 构建 OpenAI tools 格式
  const toolsDef = options.tools?.length ? options.tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters }
  })) : undefined

  // 对话消息（会在工具调用循环中追加）
  const messages = [...options.messages]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (abort.signal.aborted) break

    const body: any = { model: config.model, messages, stream: true }
    if (toolsDef) body.tools = toolsDef

    console.log(`[AIClient] Round ${round}, messages: ${messages.length}, model: ${config.model}`)

    let resp: Response
    try {
      resp = await fetch(url, {
        method: 'POST', headers, body: JSON.stringify(body), signal: abort.signal
      })
    } catch (e: any) {
      if (e.name === 'AbortError') return
      throw e
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText)
      throw new Error(`API ${resp.status}: ${errText}`)
    }

    // 解析 SSE 流
    const { hasToolCalls, toolCalls } = await parseSSEStream(
      resp.body!, options.onDelta, abort.signal
    )

    // 没有工具调用 → AI 生成了最终回复，结束
    if (!hasToolCalls) break

    // 有工具调用 → 执行工具，把结果加入 messages，继续下一轮
    if (!options.executeTool) break

    // 构建 assistant message（含 tool_calls）
    messages.push({
      role: 'assistant',
      content: null as any,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.args) }
      }))
    })

    // 逐个执行工具
    for (const tc of toolCalls) {
      if (abort.signal.aborted) break

      options.onDelta({ type: 'tool-call', toolName: tc.name, toolCallId: tc.id, args: tc.args })

      let result: any
      try {
        result = await options.executeTool(tc.name, tc.args)
      } catch (e: any) {
        result = { success: false, error: e.message }
      }

      options.onDelta({ type: 'tool-result', toolName: tc.name, toolCallId: tc.id, result })

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: typeof result === 'string' ? result : JSON.stringify(result)
      })
    }
  }

  currentAbort = null
}

// ==================== SSE 流解析 ====================

interface ParsedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onDelta: StreamOptions['onDelta'],
  signal: AbortSignal
): Promise<{ hasToolCalls: boolean; toolCalls: ParsedToolCall[] }> {
  const parser = new ThinkTagParser()
  let hasReasoning = false

  // 增量 tool_calls 累积器（按 index）
  const toolCallAccum = new Map<number, { id: string; name: string; argsStr: string }>()

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留最后不完整的行

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        if (trimmed === 'data: [DONE]') continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json.choices?.[0]?.delta
          if (!delta) continue

          // reasoning_content（DeepSeek / 硅基流动）
          if (delta.reasoning_content) {
            hasReasoning = true
            onDelta({ type: 'thinking', content: delta.reasoning_content })
          }

          // content
          if (delta.content) {
            if (hasReasoning) {
              onDelta({ type: 'content', content: delta.content })
            } else {
              parser.parse(delta.content, onDelta)
            }
          }

          // 增量 tool_calls 累积
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCallAccum.has(idx)) {
                toolCallAccum.set(idx, {
                  id: tc.id || `call_${Date.now()}_${idx}`,
                  name: tc.function?.name || '',
                  argsStr: ''
                })
              }
              const acc = toolCallAccum.get(idx)!
              if (tc.id) acc.id = tc.id
              if (tc.function?.name) acc.name = tc.function.name
              if (tc.function?.arguments) acc.argsStr += tc.function.arguments
            }
          }
        } catch { /* 忽略解析错误 */ }
      }
    }
  } finally {
    reader.releaseLock()
  }

  parser.flush(onDelta)

  // 解析累积的 tool_calls
  const toolCalls: ParsedToolCall[] = []
  for (const [, acc] of toolCallAccum) {
    if (!acc.name) continue
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(acc.argsStr || '{}') } catch {}
    toolCalls.push({ id: acc.id, name: acc.name, args })
  }

  return { hasToolCalls: toolCalls.length > 0, toolCalls }
}
