// 对话搜索服务
import type { Conversation, SearchResult } from '../types/conversation'
import { conversationStorage } from './conversation-storage'

class SearchService {
  // 搜索对话
  async search(query: string, limit = 20): Promise<SearchResult[]> {
    if (!query.trim()) return []
    
    const index = await conversationStorage.getIndex()
    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()
    
    for (const convIndex of index) {
      const conv = await conversationStorage.loadConversation(convIndex.id)
      if (!conv) continue
      
      for (const message of conv.messages) {
        const content = message.content.toLowerCase()
        const matchIndex = content.indexOf(lowerQuery)
        
        if (matchIndex >= 0) {
          // 计算相关性分数
          const score = this.calculateScore(message.content, query)
          
          // 提取上下文
          const contextStart = Math.max(0, matchIndex - 50)
          const contextEnd = Math.min(content.length, matchIndex + query.length + 50)
          const context = message.content.slice(contextStart, contextEnd)
          
          results.push({
            conversationId: conv.id,
            messageId: message.id,
            content: message.content,
            score,
            context: (contextStart > 0 ? '...' : '') + context + (contextEnd < content.length ? '...' : '')
          })
        }
      }
    }
    
    // 按分数排序并限制结果数量
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
  
  // 计算相关性分数
  private calculateScore(content: string, query: string): number {
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    
    let score = 0
    
    // 完全匹配加分
    if (lowerContent === lowerQuery) score += 100
    
    // 包含查询词加分
    const occurrences = (lowerContent.match(new RegExp(lowerQuery, 'g')) || []).length
    score += occurrences * 10
    
    // 查询词在开头加分
    if (lowerContent.startsWith(lowerQuery)) score += 20
    
    // 内容越短，相关性越高
    score += Math.max(0, 50 - content.length / 10)
    
    return score
  }
}

export const searchService = new SearchService()
