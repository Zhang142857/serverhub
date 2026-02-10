<template>
  <div class="chat-message" :class="message.role" :data-message-id="message.id">
    <div class="message-avatar">
      <span v-if="message.role === 'user'">U</span>
      <el-icon v-else-if="message.role === 'assistant'"><ChatDotRound /></el-icon>
      <el-icon v-else><InfoFilled /></el-icon>
    </div>
    
    <div class="message-content">
      <div class="message-bubble">
        <div v-if="message.role === 'assistant'" class="markdown-body" v-html="renderedContent"></div>
        <div v-else>{{ message.content }}</div>
        
        <!-- Token 统计 -->
        <div v-if="message.tokens" class="message-tokens">
          <el-icon><Coin /></el-icon>
          {{ message.tokens.total }} tokens
        </div>
      </div>
      
      <div class="message-time">{{ formatTime(message.timestamp) }}</div>
      
      <!-- 操作按钮 -->
      <div class="message-actions">
        <el-button text size="small" @click="copyContent" title="复制">
          <el-icon><DocumentCopy /></el-icon>
        </el-button>
        <el-button v-if="message.role === 'assistant'" text size="small" @click="$emit('regenerate')" title="重新生成">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button text size="small" @click="$emit('delete', message.id)" title="删除">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, InfoFilled, DocumentCopy, Refresh, Delete, Coin } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import type { Message } from '../../../types/conversation'

const props = defineProps<{
  message: Message
}>()

defineEmits<{
  regenerate: []
  delete: [id: string]
}>()

// Markdown 渲染器
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  }
})

const renderedContent = computed(() => {
  return md.render(props.message.content)
})

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<style scoped>
.message-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.chat-message:hover .message-actions {
  opacity: 1;
}

.message-tokens {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--ai-text-muted);
  margin-top: 8px;
  padding: 4px 8px;
  background: var(--ai-bg-tertiary);
  border-radius: 4px;
}

/* Markdown 样式 */
.markdown-body {
  line-height: 1.6;
}

.markdown-body :deep(pre) {
  background: var(--ai-bg-primary);
  border: 1px solid var(--ai-border);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  margin: 12px 0;
}

.markdown-body :deep(code) {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
}

.markdown-body :deep(p code) {
  background: var(--ai-bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--ai-primary);
  padding-left: 12px;
  margin: 12px 0;
  color: var(--ai-text-secondary);
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--ai-border);
  padding: 8px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--ai-bg-tertiary);
  font-weight: 600;
}
</style>
