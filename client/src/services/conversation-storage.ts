// 对话存储服务（基于 Electron 文件系统）
import type { Conversation, ConversationIndex, ExportData } from '../types/conversation'

const STORAGE_DIR = 'conversations'
const INDEX_FILE = 'index.json'

class ConversationStorage {
  private dataPath: string = ''

  async init() {
    // 获取 userData 路径
    this.dataPath = await window.electronAPI.app.getPath('userData')
    const storageDir = `${this.dataPath}/${STORAGE_DIR}`
    
    // 确保目录存在
    await window.electronAPI.fsLocal.ensureDir(storageDir)
  }

  // 获取索引
  async getIndex(): Promise<ConversationIndex[]> {
    const indexPath = `${this.dataPath}/${STORAGE_DIR}/${INDEX_FILE}`
    try {
      const data = await window.electronAPI.fsLocal.readFile(indexPath)
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  // 保存索引
  async saveIndex(index: ConversationIndex[]) {
    const indexPath = `${this.dataPath}/${STORAGE_DIR}/${INDEX_FILE}`
    await window.electronAPI.fsLocal.writeFile(indexPath, JSON.stringify(index, null, 2))
  }

  // 加载对话
  async loadConversation(id: string): Promise<Conversation | null> {
    const filePath = `${this.dataPath}/${STORAGE_DIR}/${id}.json`
    try {
      const raw = await window.electronAPI.fsLocal.readFile(filePath)
      // 尝试解密（兼容旧明文数据）
      let data = raw
      if (!raw.trim().startsWith('{')) {
        try {
          const decrypted = await window.electronAPI.secure.getCredential(`conv_${id}`)
          if (decrypted) data = decrypted
        } catch { /* 降级为明文 */ }
      }
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  // 保存对话（加密存储）
  async saveConversation(conversation: Conversation) {
    const filePath = `${this.dataPath}/${STORAGE_DIR}/${conversation.id}.json`
    const jsonData = JSON.stringify(conversation, null, 2)

    // 尝试加密存储
    try {
      const isAvailable = await window.electronAPI.secure.isEncryptionAvailable()
      if (isAvailable) {
        await window.electronAPI.secure.setCredential(`conv_${conversation.id}`, jsonData)
        // 文件中存储占位符，实际数据在 secureStorage
        await window.electronAPI.fsLocal.writeFile(filePath, `{"encrypted":true,"id":"${conversation.id}"}`)
      } else {
        await window.electronAPI.fsLocal.writeFile(filePath, jsonData)
      }
    } catch {
      // 降级为明文
      await window.electronAPI.fsLocal.writeFile(filePath, jsonData)
    }
    
    // 更新索引
    const index = await this.getIndex()
    const existingIndex = index.findIndex(i => i.id === conversation.id)
    const newIndex: ConversationIndex = {
      id: conversation.id,
      title: conversation.title,
      agentId: conversation.agentId,
      serverId: conversation.serverId,
      messageCount: conversation.messages.length,
      lastMessage: conversation.messages[conversation.messages.length - 1]?.content.slice(0, 100),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    }
    
    if (existingIndex >= 0) {
      index[existingIndex] = newIndex
    } else {
      index.unshift(newIndex)
    }
    
    await this.saveIndex(index)
  }

  // 删除对话
  async deleteConversation(id: string) {
    const filePath = `${this.dataPath}/${STORAGE_DIR}/${id}.json`
    await window.electronAPI.fsLocal.deleteFile(filePath)
    
    const index = await this.getIndex()
    const newIndex = index.filter(i => i.id !== id)
    await this.saveIndex(newIndex)
  }

  // 导出对话
  async exportConversations(ids: string[]): Promise<ExportData> {
    const conversations: Conversation[] = []
    for (const id of ids) {
      const conv = await this.loadConversation(id)
      if (conv) conversations.push(conv)
    }
    
    return {
      version: '1.0',
      exportedAt: Date.now(),
      conversations
    }
  }

  // 导入对话
  async importConversations(data: ExportData) {
    for (const conv of data.conversations) {
      await this.saveConversation(conv)
    }
  }
}

export const conversationStorage = new ConversationStorage()
