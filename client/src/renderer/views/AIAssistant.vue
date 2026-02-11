<template>
  <div class="ai-page">
    <!-- 左侧对话列表 -->
    <div class="conversations-panel">
      <div class="panel-header">
        <h3>对话历史</h3>
        <el-button type="primary" size="small" @click="createNew">
          <el-icon><Plus /></el-icon>
        </el-button>
      </div>
      
      <div class="conversation-list">
        <div
          v-for="conv in aiStore.conversations"
          :key="conv.id"
          class="conversation-item"
          :class="{ active: aiStore.currentConversationId === conv.id }"
          @click="aiStore.loadConversation(conv.id)"
        >
          <div class="conv-icon">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <div class="conv-info">
            <div class="conv-title">{{ conv.title }}</div>
            <div class="conv-time">{{ formatDate(conv.updatedAt) }}</div>
          </div>
          <el-button
            class="conv-delete"
            text
            size="small"
            @click.stop="deleteConv(conv.id)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        
        <el-empty
          v-if="aiStore.conversations.length === 0"
          description="暂无对话"
          :image-size="60"
        />
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="chat-panel">
      <!-- 顶部工具栏 -->
      <div class="chat-header">
        <div class="header-left">
          <div class="ai-badge">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <span class="title">{{ aiStore.currentConversation?.title || 'Runixo AI 助手' }}</span>
        </div>
        <div class="header-right">
          <el-select v-model="selectedServer" placeholder="选择服务器" size="small" clearable style="width: 180px">
            <el-option
              v-for="server in connectedServers"
              :key="server.id"
              :label="server.name"
              :value="server.id"
            />
          </el-select>
          
          <el-dropdown>
            <el-button text size="small">
              <el-icon><More /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="showSearchDialog = true">
                  <el-icon><Search /></el-icon> 搜索对话
                </el-dropdown-item>
                <el-dropdown-item divided @click="exportConv">导出对话</el-dropdown-item>
                <el-dropdown-item @click="importConv">导入对话</el-dropdown-item>
                <el-dropdown-item divided @click="clearConv">清空对话</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 消息列表 -->
      <div class="messages-container" ref="messagesRef">
        <!-- 欢迎页 -->
        <div v-if="aiStore.messages.length === 0" class="welcome">
          <div class="welcome-logo">
            <svg viewBox="0 0 48 48" fill="none" width="56" height="56">
              <rect x="4" y="8" width="40" height="32" rx="8" fill="url(#wg)" />
              <circle cx="18" cy="22" r="3" fill="#fff" opacity="0.9" />
              <circle cx="30" cy="22" r="3" fill="#fff" opacity="0.9" />
              <path d="M18 32c0-4 3-7 6-7s6 3 6 7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
              <defs>
                <linearGradient id="wg" x1="4" y1="8" x2="44" y2="40">
                  <stop stop-color="#2563EB" />
                  <stop offset="1" stop-color="#1D4ED8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2>你好，我是 Runixo AI 助手</h2>
          <p class="welcome-desc">我可以帮你管理服务器、部署应用、诊断问题</p>
          
          <div class="quick-actions">
            <div
              v-for="action in quickActions"
              :key="action.title"
              class="action-card"
              @click="sendQuick(action.prompt)"
            >
              <div class="action-icon">
                <el-icon><component :is="action.icon" /></el-icon>
              </div>
              <div>
                <div class="action-title">{{ action.title }}</div>
                <div class="action-desc">{{ action.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 消息列表 -->
        <template v-else>
          <ChatMessage
            v-for="msg in aiStore.messages"
            :key="msg.id"
            :message="msg"
            @regenerate="regenerate(msg.id)"
            @delete="deleteMsg"
          />
          
          <!-- 流式输出中 -->
          <div v-if="aiStore.isProcessing && aiStore.streamingContent" class="chat-message assistant">
            <div class="message-avatar">
              <el-icon><ChatDotRound /></el-icon>
            </div>
            <div class="message-content">
              <div class="message-bubble">
                <div class="markdown-body" v-html="renderMarkdown(aiStore.streamingContent)"></div>
                <div class="typing-indicator">
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <div class="input-card">
          <el-input
            ref="inputRef"
            v-model="inputMessage"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 6 }"
            placeholder="输入消息... (Ctrl+Enter 发送)"
            @keydown.enter.ctrl="handleKeydown"
            :disabled="aiStore.isProcessing"
            resize="none"
          />
          
          <div class="input-toolbar">
            <div class="toolbar-left">
              <FileUpload ref="fileUploadRef" @files-selected="handleFilesSelected" />
              
              <span v-if="selectedServer" class="server-badge">
                <el-icon><Monitor /></el-icon>
                {{ getServerName(selectedServer) }}
              </span>
              <span v-if="aiStore.totalTokens > 0" class="server-badge">
                <el-icon><Coin /></el-icon>
                {{ aiStore.totalTokens }} tokens
              </span>
            </div>
            
            <div class="toolbar-right">
              <span class="hint">Ctrl+Enter 发送</span>
              <el-button
                v-if="aiStore.isProcessing"
                type="danger"
                size="small"
                circle
                @click="aiStore.stopGeneration()"
              >
                <el-icon><Close /></el-icon>
              </el-button>
              <el-button
                v-else
                type="primary"
                size="small"
                :disabled="!inputMessage.trim()"
                @click="send"
              >
                <el-icon><Promotion /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 搜索对话框 -->
    <el-dialog v-model="showSearchDialog" title="搜索对话" width="600px">
      <el-input
        v-model="searchQuery"
        placeholder="输入关键词搜索..."
        @input="performSearch"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      
      <div v-loading="isSearching" class="search-results" style="margin-top: 16px; max-height: 400px; overflow-y: auto;">
        <div
          v-for="result in searchResults"
          :key="result.messageId"
          class="search-result-item"
          @click="jumpToMessage(result)"
        >
          <div class="result-context">{{ result.context }}</div>
          <div class="result-meta">
            <span>相关度: {{ result.score.toFixed(0) }}</span>
          </div>
        </div>
        
        <el-empty
          v-if="searchResults.length === 0 && searchQuery"
          description="未找到相关内容"
          :image-size="60"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Monitor,
  ChatDotRound,
  Plus,
  Delete,
  Coin,
  Close,
  Promotion,
  Operation,
  Warning,
  Search
} from '@element-plus/icons-vue'
import { useAIStore } from '../stores/ai'
import { useServerStore } from '../stores/server'
import ChatMessage from '../components/ai/ChatMessage.vue'
import FileUpload from '../components/ai/FileUpload.vue'
import { useAIHotkeys } from '../composables/useAIHotkeys'
import MarkdownIt from 'markdown-it'
import type { Options } from 'markdown-it'
import hljs from 'highlight.js'

const aiStore = useAIStore()
const serverStore = useServerStore()

const inputMessage = ref('')
const selectedServer = ref<string | null>(null)
const messagesRef = ref<HTMLElement>()
const inputRef = ref<any>()
const fileUploadRef = ref<any>()
const attachedFiles = ref<File[]>([])
const showSearchDialog = ref(false)
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)

useAIHotkeys({
  send: () => send(),
  newConversation: () => createNew(),
  clearInput: () => { inputMessage.value = ''; attachedFiles.value = [] },
  focusInput: () => inputRef.value?.focus(),
  deleteConversation: () => aiStore.currentConversationId && deleteConv(aiStore.currentConversationId),
  exportConversation: () => exportConv()
})

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch {}
    }
    return md.utils.escapeHtml(str)
  }
} as Options)

const connectedServers = computed(() => {
  return serverStore.servers.filter((s: any) => s.status === 'connected')
})

const quickActions = [
  { title: '系统状态', desc: '查看服务器运行状态', prompt: '帮我查看服务器的系统状态', icon: Monitor },
  { title: '性能分析', desc: '分析 CPU 和内存使用', prompt: '分析服务器的性能瓶颈', icon: Operation },
  { title: '日志诊断', desc: '检查系统日志', prompt: '帮我检查最近的系统日志', icon: Search },
  { title: '安全检查', desc: '扫描安全风险', prompt: '进行安全检查和漏洞扫描', icon: Warning }
]

onMounted(async () => {
  await aiStore.init()
  scrollToBottom()
})

watch(() => aiStore.messages.length, () => {
  nextTick(scrollToBottom)
})

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

async function createNew() {
  await aiStore.createConversation({ serverId: selectedServer.value || undefined })
  inputMessage.value = ''
}

async function send() {
  if (!inputMessage.value.trim() || aiStore.isProcessing) return
  
  const content = inputMessage.value
  const files = attachedFiles.value
  inputMessage.value = ''
  attachedFiles.value = []
  fileUploadRef.value?.clear()
  
  // 如果有文件，读取内容并附加到消息
  let fullContent = content
  if (files.length > 0) {
    fullContent += '\n\n附件：\n'
    for (const file of files) {
      try {
        const text = await file.text()
        fullContent += `\n--- ${file.name} ---\n${text}\n`
      } catch (error) {
        ElMessage.error(`读取文件 ${file.name} 失败`)
      }
    }
  }
  
  await aiStore.sendMessage(fullContent, {
    serverId: selectedServer.value || undefined
  })
}

function handleFilesSelected(files: File[]) {
  attachedFiles.value = files
}

function sendQuick(prompt: string) {
  inputMessage.value = prompt
  send()
}

function handleKeydown(e: Event | KeyboardEvent) {
  if (e instanceof KeyboardEvent && e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault()
    send()
  }
}

async function deleteConv(id: string) {
  try {
    await ElMessageBox.confirm('确定删除这个对话吗？', '提示', {
      type: 'warning'
    })
    await aiStore.deleteConversation(id)
  } catch {}
}

async function deleteMsg(id: string) {
  await aiStore.deleteMessage(id)
}

async function regenerate(_id: string) {
  // TODO: 实现重新生成
  ElMessage.info('功能开发中')
}

async function clearConv() {
  if (!aiStore.currentConversation) return
  
  try {
    await ElMessageBox.confirm('确定清空当前对话吗？', '提示', {
      type: 'warning'
    })
    
    aiStore.currentConversation.messages = []
    await aiStore.init() // 重新加载
  } catch {}
}

async function exportConv() {
  if (!aiStore.currentConversationId) return
  
  const data = await aiStore.exportConversations([aiStore.currentConversationId])
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conversation_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importConv() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await aiStore.importConversations(data)
      ElMessage.success('导入成功')
    } catch (error) {
      ElMessage.error('导入失败：' + error)
    }
  }
  input.click()
}

function getServerName(id: string) {
  return serverStore.servers.find(s => s.id === id)?.name || id
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 86400000) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function renderMarkdown(content: string) {
  return md.render(content)
}

async function performSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  
  isSearching.value = true
  try {
    searchResults.value = await aiStore.searchConversations(searchQuery.value)
  } finally {
    isSearching.value = false
  }
}

async function jumpToMessage(result: any) {
  await aiStore.loadConversation(result.conversationId)
  showSearchDialog.value = false
  
  // 滚动到对应消息
  nextTick(() => {
    const msgElement = document.querySelector(`[data-message-id="${result.messageId}"]`)
    msgElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

</script>


<style scoped>
.search-result-item {
  padding: 12px;
  border: 1px solid var(--ai-border);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: var(--ai-transition);
}

.search-result-item:hover {
  background: var(--ai-bg-secondary);
  border-color: var(--ai-primary);
}

.result-context {
  font-size: 14px;
  color: var(--ai-text-primary);
  margin-bottom: 6px;
  line-height: 1.5;
}

.result-meta {
  font-size: 12px;
  color: var(--ai-text-muted);
}
</style>
