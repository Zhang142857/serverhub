/**
 * AI 状态管理 - 重构版
 * 集成对话持久化、Token 统计、搜索等功能
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { conversationStorage } from '../../services/conversation-storage'
import type { Conversation, Message, ConversationIndex } from '../../types/conversation'

export const useAIStore = defineStore('ai', () => {
  // ==================== 状态 ====================
  const conversations = ref<ConversationIndex[]>([])
  const currentConversationId = ref<string | null>(null)
  const currentConversation = ref<Conversation | null>(null)
  const isProcessing = ref(false)
  const streamingContent = ref('')
  const isInitialized = ref(false)

  // ==================== 计算属性 ====================
  const messages = computed(() => currentConversation.value?.messages || [])
  
  const totalTokens = computed(() => 
    currentConversation.value?.tokenUsage.total || 0
  )

  // ==================== 初始化 ====================
  async function init() {
    if (isInitialized.value) return
    
    try {
      await conversationStorage.init()
      conversations.value = await conversationStorage.getIndex()
      
      // 加载最后一个对话
      if (conversations.value.length > 0) {
        await loadConversation(conversations.value[0].id)
      }
      
      isInitialized.value = true
    } catch (error) {
      console.error('Failed to initialize AI store:', error)
    }
  }

  // ==================== 对话管理 ====================
  async function createConversation(options?: { agentId?: string; serverId?: string }) {
    const now = Date.now()
    const conversation: Conversation = {
      id: `conv_${now}`,
      title: '新对话',
      agentId: options?.agentId,
      serverId: options?.serverId,
      messages: [],
      createdAt: now,
      updatedAt: now,
      tokenUsage: { prompt: 0, completion: 0, total: 0 }
    }

    await conversationStorage.saveConversation(conversation)
    conversations.value = await conversationStorage.getIndex()
    currentConversationId.value = conversation.id
    currentConversation.value = conversation
  }

  async function loadConversation(id: string) {
    const conv = await conversationStorage.loadConversation(id)
    if (conv) {
      currentConversationId.value = id
      currentConversation.value = conv
    }
  }

  async function deleteConversation(id: string) {
    await conversationStorage.deleteConversation(id)
    conversations.value = await conversationStorage.getIndex()
    
    if (currentConversationId.value === id) {
      if (conversations.value.length > 0) {
        await loadConversation(conversations.value[0].id)
      } else {
        currentConversationId.value = null
        currentConversation.value = null
      }
    }
  }

  async function updateConversationTitle(id: string, title: string) {
    const conv = await conversationStorage.loadConversation(id)
    if (conv) {
      conv.title = title
      conv.updatedAt = Date.now()
      await conversationStorage.saveConversation(conv)
      conversations.value = await conversationStorage.getIndex()
      
      if (currentConversationId.value === id) {
        currentConversation.value = conv
      }
    }
  }

  // ==================== 消息管理 ====================
  async function addMessage(message: Omit<Message, 'id' | 'timestamp'>) {
    if (!currentConversation.value) {
      await createConversation()
    }

    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    currentConversation.value!.messages.push(newMessage)
    currentConversation.value!.updatedAt = Date.now()

    // 更新 token 统计
    if (newMessage.tokens) {
      currentConversation.value!.tokenUsage.prompt += newMessage.tokens.prompt
      currentConversation.value!.tokenUsage.completion += newMessage.tokens.completion
      currentConversation.value!.tokenUsage.total += newMessage.tokens.total
    }

    // 自动生成标题（第一条用户消息）
    if (currentConversation.value!.messages.length === 1 && message.role === 'user') {
      const title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
      currentConversation.value!.title = title
    }

    await conversationStorage.saveConversation(currentConversation.value!)
    conversations.value = await conversationStorage.getIndex()
  }

  async function updateMessage(messageId: string, updates: Partial<Message>) {
    if (!currentConversation.value) return

    const index = currentConversation.value.messages.findIndex(m => m.id === messageId)
    if (index >= 0) {
      currentConversation.value.messages[index] = {
        ...currentConversation.value.messages[index],
        ...updates
      }
      currentConversation.value.updatedAt = Date.now()
      await conversationStorage.saveConversation(currentConversation.value)
    }
  }

  async function deleteMessage(messageId: string) {
    if (!currentConversation.value) return

    currentConversation.value.messages = currentConversation.value.messages.filter(
      m => m.id !== messageId
    )
    currentConversation.value.updatedAt = Date.now()
    await conversationStorage.saveConversation(currentConversation.value)
  }

  // ==================== AI 交互 ====================
  async function sendMessage(content: string, context?: { serverId?: string; agentId?: string }) {
    isProcessing.value = true
    streamingContent.value = ''

    try {
      // 添加用户消息
      await addMessage({
        role: 'user',
        content
      })

      // 创建 AI 消息占位符
      const aiMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await addMessage({
        role: 'assistant',
        content: ''
      })

      // 调用 AI API（流式）
      let fullContent = ''
      const unsubscribe = window.electronAPI.ai.onStream((chunk: string) => {
        fullContent += chunk
        streamingContent.value = fullContent
        
        // 实时更新消息
        if (currentConversation.value) {
          const msgIndex = currentConversation.value.messages.findIndex(m => m.id === aiMessageId)
          if (msgIndex >= 0) {
            currentConversation.value.messages[msgIndex].content = fullContent
          }
        }
      })

      await window.electronAPI.ai.chat(content, {
        serverId: context?.serverId || currentConversation.value?.serverId,
        conversationHistory: messages.value.slice(-10).map(m => ({
          role: m.role,
          content: m.content
        }))
      })

      unsubscribe()

      // 保存最终消息
      await updateMessage(aiMessageId, { content: fullContent })

    } catch (error) {
      console.error('Failed to send message:', error)
      await addMessage({
        role: 'system',
        content: `错误: ${error instanceof Error ? error.message : '未知错误'}`
      })
    } finally {
      isProcessing.value = false
      streamingContent.value = ''
    }
  }

  function stopGeneration() {
    // TODO: 实现停止生成
    isProcessing.value = false
  }

  // ==================== 导出/导入 ====================
  async function exportConversations(ids: string[]) {
    return await conversationStorage.exportConversations(ids)
  }

  async function importConversations(data: any) {
    await conversationStorage.importConversations(data)
    conversations.value = await conversationStorage.getIndex()
  }

  // ==================== 搜索 ====================
  async function searchConversations(query: string) {
    const { searchService } = await import('../../services/search-service')
    return await searchService.search(query)
  }

  // ==================== 返回 ====================
  return {
    // 状态
    conversations,
    currentConversationId,
    currentConversation,
    messages,
    isProcessing,
    streamingContent,
    totalTokens,

    // 方法
    init,
    createConversation,
    loadConversation,
    deleteConversation,
    updateConversationTitle,
    addMessage,
    updateMessage,
    deleteMessage,
    sendMessage,
    stopGeneration,
    exportConversations,
    importConversations,
    searchConversations
  }
})
