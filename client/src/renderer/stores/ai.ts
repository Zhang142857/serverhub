/**
 * AI 状态管理
 * 管理对话、工具执行历史、任务规划等状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 工具调用记录
export interface ToolCallRecord {
  id: string
  name: string
  displayName: string
  arguments: Record<string, unknown>
  result: unknown
  success: boolean
  timestamp: Date
  duration?: number
  expanded?: boolean
}

// ReAct 步骤
export interface ReActStep {
  type: 'think' | 'act' | 'observe' | 'answer'
  content: string
  thinking?: string
  timestamp: Date
  toolCall?: {
    name: string
    arguments: Record<string, unknown>
  }
  toolResult?: {
    success: boolean
    data?: unknown
    error?: string
  }
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

// 消息部分（内联渲染）
export interface MessagePart {
  type: 'text' | 'thinking' | 'tool-call' | 'tool-confirm'
  content?: string
  toolName?: string
  args?: Record<string, unknown>
  result?: unknown
  status?: 'calling' | 'done' | 'error'
  confirmId?: string
}

// 消息类型
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  parts: MessagePart[]
  timestamp: Date
  toolCalls?: ToolCallRecord[]
  steps?: ReActStep[]
  plan?: TaskPlan
  isStreaming?: boolean
}

// 对话类型
export interface Conversation {
  id: string
  title: string
  messages: Message[]
  agentMode: boolean
  serverId?: string
  createdAt: Date
  updatedAt: Date
}

// 可用工具
export interface AvailableTool {
  name: string
  displayName: string
  description: string
  category: string
  dangerous: boolean
}

// AI 配置
export interface AISettings {
  provider: 'ollama' | 'openai' | 'claude' | 'deepseek' | 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
  enablePlanning: boolean
  requireConfirmation: boolean
  maxIterations: number
}

export const useAIStore = defineStore('ai', () => {
  // 状态
  const conversations = ref<Conversation[]>([])
  const currentConversationId = ref<string | null>(null)
  const isProcessing = ref(false)
  const processingStatus = ref('')
  const streamingContent = ref('')
  const currentPlan = ref<TaskPlan | null>(null)
  const currentSteps = ref<ReActStep[]>([])
  const executionHistory = ref<ToolCallRecord[]>([])
  const availableTools = ref<AvailableTool[]>([])
  const pendingConfirmation = ref<{
    tool: string
    arguments: Record<string, unknown>
    description: string
    resolve: (confirmed: boolean) => void
  } | null>(null)

  // AI 设置
  const settings = ref<AISettings>({
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
    enablePlanning: true,
    requireConfirmation: true,
    maxIterations: 10
  })

  // 计算属性
  const currentConversation = computed(() =>
    conversations.value.find(c => c.id === currentConversationId.value)
  )

  const messages = computed(() =>
    currentConversation.value?.messages || []
  )

  const agentMode = computed(() =>
    currentConversation.value?.agentMode ?? true
  )

  const hasConversations = computed(() =>
    conversations.value.length > 0
  )

  const recentExecutions = computed(() =>
    executionHistory.value.slice(0, 20)
  )

  const toolsByCategory = computed(() => {
    const grouped: Record<string, AvailableTool[]> = {}
    for (const tool of availableTools.value) {
      if (!grouped[tool.category]) {
        grouped[tool.category] = []
      }
      grouped[tool.category].push(tool)
    }
    return grouped
  })

  // 生成唯一 ID
  function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 创建新对话
  function createConversation(agentMode: boolean = true, serverId?: string): string {
    const id = generateId()
    const conversation: Conversation = {
      id,
      title: '新对话',
      messages: [],
      agentMode,
      serverId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    conversations.value.unshift(conversation)
    currentConversationId.value = id
    currentPlan.value = null
    currentSteps.value = []
    saveToStorage()
    return id
  }

  // 切换对话
  function switchConversation(id: string): void {
    const conversation = conversations.value.find(c => c.id === id)
    if (conversation) {
      currentConversationId.value = id
      currentPlan.value = null
      currentSteps.value = []
    }
  }

  // 删除对话
  function deleteConversation(id: string): void {
    const index = conversations.value.findIndex(c => c.id === id)
    if (index !== -1) {
      conversations.value.splice(index, 1)
      if (currentConversationId.value === id) {
        currentConversationId.value = conversations.value[0]?.id || null
      }
      saveToStorage()
    }
  }

  // 更新对话标题
  function updateConversationTitle(id: string, title: string): void {
    const conversation = conversations.value.find(c => c.id === id)
    if (conversation) {
      conversation.title = title
      saveToStorage()
    }
  }

  // 设置 Agent 模式
  function setAgentMode(mode: boolean): void {
    if (currentConversation.value) {
      currentConversation.value.agentMode = mode
      saveToStorage()
    }
  }

  // 设置服务器 ID
  function setServerId(serverId: string | undefined): void {
    if (currentConversation.value) {
      currentConversation.value.serverId = serverId
      saveToStorage()
    }
  }

  // 添加用户消息
  function addUserMessage(content: string): Message {
    if (!currentConversation.value) {
      createConversation()
    }

    const message: Message = {
      id: generateId(),
      role: 'user',
      content,
      parts: [],
      timestamp: new Date()
    }

    currentConversation.value!.messages.push(message)
    currentConversation.value!.updatedAt = new Date()

    // 自动生成标题
    if (currentConversation.value!.messages.length === 1) {
      const title = content.substring(0, 30) + (content.length > 30 ? '...' : '')
      currentConversation.value!.title = title
    }

    saveToStorage()
    return message
  }

  // 添加助手消息
  function addAssistantMessage(
    content: string,
    options?: {
      toolCalls?: ToolCallRecord[]
      steps?: ReActStep[]
      plan?: TaskPlan
    }
  ): Message {
    if (!currentConversation.value) return {} as Message

    const message: Message = {
      id: generateId(),
      role: 'assistant',
      content,
      parts: [],
      timestamp: new Date(),
      toolCalls: options?.toolCalls,
      steps: options?.steps,
      plan: options?.plan
    }

    currentConversation.value.messages.push(message)
    currentConversation.value.updatedAt = new Date()
    saveToStorage()
    return message
  }

  // 更新最后一条助手消息
  function updateLastAssistantMessage(
    content: string,
    options?: {
      toolCalls?: ToolCallRecord[]
      steps?: ReActStep[]
      plan?: TaskPlan
      isStreaming?: boolean
    }
  ): void {
    if (!currentConversation.value) return

    const messages = currentConversation.value.messages
    const lastMessage = messages[messages.length - 1]

    if (lastMessage && lastMessage.role === 'assistant') {
      lastMessage.content = content
      if (options?.toolCalls) lastMessage.toolCalls = options.toolCalls
      if (options?.steps) lastMessage.steps = options.steps
      if (options?.plan) lastMessage.plan = options.plan
      if (options?.isStreaming !== undefined) lastMessage.isStreaming = options.isStreaming
    }
  }

  // 开始处理
  function startProcessing(status: string = '处理中...'): void {
    isProcessing.value = true
    processingStatus.value = status
    streamingContent.value = ''
    currentSteps.value = []
  }

  // 更新处理状态
  function updateProcessingStatus(status: string): void {
    processingStatus.value = status
  }

  // 添加流式内容
  function appendStreamingContent(chunk: string): void {
    streamingContent.value += chunk
  }

  // 结束处理
  function endProcessing(): void {
    isProcessing.value = false
    processingStatus.value = ''
    streamingContent.value = ''
  }

  // 创建流式助手消息（空消息，后续追加内容）
  function createStreamingMessage(): Message {
    if (!currentConversation.value) createConversation()
    const message: Message = {
      id: generateId(), role: 'assistant', content: '',
      parts: [], timestamp: new Date(), isStreaming: true
    }
    currentConversation.value!.messages.push(message)
    return message
  }

  // 追加流式内容到最后一条消息
  function appendToLastMessage(delta: { type: string; content?: string; toolName?: string; args?: any; result?: any }): void {
    console.log('[AI Store] appendToLastMessage:', JSON.stringify(delta, null, 2))
    if (!currentConversation.value) return
    const msgs = currentConversation.value.messages
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'assistant') return

    if (!last.parts) last.parts = []
    const parts = last.parts
    const lastPart = parts[parts.length - 1]

    switch (delta.type) {
      case 'content': {
        console.log('[AI Store] content delta, lastPart:', lastPart?.type, 'content:', delta.content)
        if (lastPart?.type === 'text') {
          lastPart.content = (lastPart.content || '') + (delta.content || '')
        } else {
          parts.push({ type: 'text', content: delta.content || '' })
        }
        last.content += delta.content || ''
        break
      }
      case 'thinking': {
        if (lastPart?.type === 'thinking') {
          lastPart.content = (lastPart.content || '') + (delta.content || '')
        } else {
          parts.push({ type: 'thinking', content: delta.content || '' })
        }
        last.thinking = (last.thinking || '') + (delta.content || '')
        break
      }
      case 'tool-call': {
        parts.push({ type: 'tool-call', toolName: delta.toolName, args: delta.args, status: 'calling' })
        break
      }
      case 'tool-result': {
        for (let i = parts.length - 1; i >= 0; i--) {
          if (parts[i].type === 'tool-call' && parts[i].toolName === delta.toolName && parts[i].status === 'calling') {
            parts[i].result = delta.result
            parts[i].status = 'done'
            break
          }
        }
        break
      }
      case 'tool-confirm': {
        parts.push({ type: 'tool-confirm', toolName: delta.toolName, args: delta.args, confirmId: delta.confirmId, status: 'calling' })
        break
      }
      case 'error': {
        const errMsg = delta.content || '请求失败'
        parts.push({ type: 'text', content: errMsg })
        last.content += errMsg
        break
      }
    }
  }

  // 结束流式消息
  function finalizeStreamingMessage(): void {
    if (!currentConversation.value) return
    const msgs = currentConversation.value.messages
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') {
      last.isStreaming = false
      if (!last.thinking) delete last.thinking
    }
    saveToStorage()
  }

  // 添加 ReAct 步骤
  function confirmTool(confirmId: string, approved: boolean): void {
    if (!currentConversation.value) return
    const msgs = currentConversation.value.messages
    for (const msg of msgs) {
      if (!msg.parts) continue
      for (const part of msg.parts) {
        if (part.type === 'tool-confirm' && part.confirmId === confirmId) {
          part.status = approved ? 'done' : 'error'
          window.electronAPI.ai.confirmTool(confirmId, approved)
          return
        }
      }
    }
  }

  function addStep(step: ReActStep): void {
    currentSteps.value.push(step)
  }

  // 设置任务计划
  function setPlan(plan: TaskPlan | null): void {
    currentPlan.value = plan
  }

  // 更新任务计划
  function updatePlan(plan: TaskPlan): void {
    currentPlan.value = plan
  }

  // 添加工具执行记录
  function addExecutionRecord(record: Omit<ToolCallRecord, 'id' | 'timestamp'>): void {
    const fullRecord: ToolCallRecord = {
      ...record,
      id: generateId(),
      timestamp: new Date()
    }
    executionHistory.value.unshift(fullRecord)

    // 限制历史记录数量
    if (executionHistory.value.length > 100) {
      executionHistory.value = executionHistory.value.slice(0, 100)
    }

    saveExecutionHistory()
  }

  // 设置可用工具
  function setAvailableTools(tools: AvailableTool[]): void {
    availableTools.value = tools
  }

  // 请求确认
  function requestConfirmation(
    tool: string,
    args: Record<string, unknown>,
    description: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      pendingConfirmation.value = {
        tool,
        arguments: args,
        description,
        resolve
      }
    })
  }

  // 确认操作
  function confirmOperation(confirmed: boolean): void {
    if (pendingConfirmation.value) {
      pendingConfirmation.value.resolve(confirmed)
      pendingConfirmation.value = null
    }
  }

  // 更新设置
  function updateSettings(newSettings: Partial<AISettings>): void {
    settings.value = { ...settings.value, ...newSettings }
    saveSettings()
  }

  // 清空当前对话
  function clearCurrentConversation(): void {
    if (currentConversation.value) {
      currentConversation.value.messages = []
      currentConversation.value.updatedAt = new Date()
      currentPlan.value = null
      currentSteps.value = []
      saveToStorage()
    }
  }

  // 保存到本地存储
  function saveToStorage(): void {
    try {
      const data = conversations.value.map(c => ({
        ...c,
        messages: c.messages.map(m => ({
          ...m,
          timestamp: m.timestamp.toISOString()
        })),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
      }))
      localStorage.setItem('runixo_ai_conversations', JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save conversations:', e)
    }
  }

  // 从本地存储加载
  function loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('runixo_ai_conversations')
      if (saved) {
        const data = JSON.parse(saved)
        conversations.value = data.map((c: Record<string, unknown>) => ({
          ...c,
          messages: (c.messages as Record<string, unknown>[]).map((m: Record<string, unknown>) => ({
            ...m,
            timestamp: new Date(m.timestamp as string),
            parts: (m as any).parts || []
          })),
          createdAt: new Date(c.createdAt as string),
          updatedAt: new Date(c.updatedAt as string)
        }))

        // 自动选择最近的对话
        if (conversations.value.length > 0 && !currentConversationId.value) {
          currentConversationId.value = conversations.value[0].id
        }
      }
    } catch (e) {
      console.error('Failed to load conversations:', e)
    }
  }

  // 保存执行历史
  function saveExecutionHistory(): void {
    try {
      const data = executionHistory.value.map(r => ({
        ...r,
        timestamp: r.timestamp.toISOString()
      }))
      localStorage.setItem('runixo_ai_execution_history', JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save execution history:', e)
    }
  }

  // 加载执行历史
  function loadExecutionHistory(): void {
    try {
      const saved = localStorage.getItem('runixo_ai_execution_history')
      if (saved) {
        const data = JSON.parse(saved)
        executionHistory.value = data.map((r: Record<string, unknown>) => ({
          ...r,
          timestamp: new Date(r.timestamp as string)
        }))
      }
    } catch (e) {
      console.error('Failed to load execution history:', e)
    }
  }

  // 保存设置
  function saveSettings(): void {
    try {
      localStorage.setItem('runixo_ai_settings', JSON.stringify(settings.value))
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  // 加载设置
  function loadSettings(): void {
    try {
      const saved = localStorage.getItem('runixo_ai_settings')
      if (saved) {
        settings.value = { ...settings.value, ...JSON.parse(saved) }
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  // 初始化
  function initialize(): void {
    loadFromStorage()
    loadExecutionHistory()
    loadSettings()
  }

  return {
    // 状态
    conversations,
    currentConversationId,
    isProcessing,
    processingStatus,
    streamingContent,
    currentPlan,
    currentSteps,
    executionHistory,
    availableTools,
    pendingConfirmation,
    settings,

    // 计算属性
    currentConversation,
    messages,
    agentMode,
    hasConversations,
    recentExecutions,
    toolsByCategory,

    // 方法
    createConversation,
    switchConversation,
    deleteConversation,
    updateConversationTitle,
    setAgentMode,
    setServerId,
    addUserMessage,
    addAssistantMessage,
    updateLastAssistantMessage,
    startProcessing,
    updateProcessingStatus,
    appendStreamingContent,
    endProcessing,
    createStreamingMessage,
    appendToLastMessage,
    finalizeStreamingMessage,
    confirmTool,
    addStep,
    setPlan,
    updatePlan,
    addExecutionRecord,
    setAvailableTools,
    requestConfirmation,
    confirmOperation,
    updateSettings,
    clearCurrentConversation,
    initialize
  }
})
