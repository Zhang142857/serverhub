<template>
  <div class="ai-page">
    <!-- 左侧对话列表 -->
    <div class="conversations-panel">
      <div class="panel-header">
        <h3>对话</h3>
        <el-button type="primary" size="small" @click="createNewConversation">
          <el-icon><Plus /></el-icon>
        </el-button>
      </div>
      <div class="conversation-list">
        <TransitionGroup name="conv-list">
          <div
            v-for="conv in aiStore.conversations"
            :key="conv.id"
            class="conversation-item"
            :class="{ active: aiStore.currentConversationId === conv.id }"
            @click="aiStore.switchConversation(conv.id)"
          >
            <div class="conv-icon">
              <el-icon v-if="conv.agentMode"><Operation /></el-icon>
              <el-icon v-else><ChatDotRound /></el-icon>
            </div>
            <div class="conv-info">
              <div class="conv-title">{{ conv.title }}</div>
              <div class="conv-time">{{ formatDate(conv.updatedAt) }}</div>
            </div>
            <el-button class="conv-delete" text size="small" @click.stop="aiStore.deleteConversation(conv.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </TransitionGroup>
        <el-empty v-if="aiStore.conversations.length === 0" description="暂无对话" :image-size="60" />
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="chat-panel">
      <div class="chat-header">
        <div class="header-left">
          <el-icon class="ai-icon"><Magic /></el-icon>
          <span class="title">AI 助手</span>
          <el-tag v-if="aiStore.agentMode" type="warning" size="small">Agent 模式</el-tag>
        </div>
        <div class="header-right">
          <el-select v-model="selectedServer" placeholder="选择服务器" size="small" clearable style="width: 160px">
            <el-option v-for="server in connectedServers" :key="server.id" :label="server.name" :value="server.id" />
          </el-select>
          <el-switch v-model="agentModeEnabled" active-text="Agent" inactive-text="Chat" size="small" style="margin-left: 12px" />
        </div>
      </div>

      <div class="messages-container" ref="messagesRef">
        <div v-if="aiStore.messages.length === 0" class="welcome">
          <div class="welcome-icon">
            <svg viewBox="0 0 64 64" fill="none" width="80" height="80">
              <rect x="8" y="12" width="48" height="40" rx="6" fill="url(#grad1)" />
              <circle cx="24" cy="30" r="4" fill="#fff" /><circle cx="40" cy="30" r="4" fill="#fff" />
              <path d="M24 42c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="#fff" stroke-width="3" stroke-linecap="round" />
              <defs><linearGradient id="grad1" x1="8" y1="12" x2="56" y2="52"><stop stop-color="#6366f1" /><stop offset="1" stop-color="#8b5cf6" /></linearGradient></defs>
            </svg>
          </div>
          <h2>你好，我是 ServerHub AI 助手</h2>
          <p v-if="agentModeEnabled">Agent 模式已启用，我可以直接操作服务器执行任务</p>
          <p v-else>我可以帮助你解答服务器管理相关问题</p>
          <div class="quick-actions">
            <div v-for="action in quickActions" :key="action.title" class="action-card" @click="sendQuickAction(action.prompt)">
              <el-icon><component :is="action.icon" /></el-icon>
              <div class="action-info">
                <div class="action-title">{{ action.title }}</div>
                <div class="action-desc">{{ action.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <template v-else>
          <ChatMessage
            v-for="msg in aiStore.messages"
            :key="msg.id"
            :message="msg"
            @regenerate="regenerateMessage(msg.id)"
          />
          <div v-if="aiStore.isProcessing" class="message assistant thinking">
            <div class="message-avatar"><el-icon class="spin"><Loading /></el-icon></div>
            <div class="message-body">
              <div class="thinking-text">{{ aiStore.processingStatus }}</div>
            </div>
          </div>
          <div v-if="aiStore.streamingContent" class="message assistant streaming">
            <div class="message-avatar"><el-icon><MagicStick /></el-icon></div>
            <div class="message-body">
              <div class="message-content" v-html="renderMarkdown(aiStore.streamingContent)"></div>
            </div>
          </div>
        </template>
      </div>

      <!-- 任务计划展示 -->
      <div v-if="aiStore.currentPlan" class="current-plan">
        <TaskPlan :plan="aiStore.currentPlan" />
      </div>

      <div class="input-area">
        <div class="input-wrapper">
          <el-input v-model="inputMessage" type="textarea" :rows="2" :placeholder="inputPlaceholder" @keydown="handleKeydown" :disabled="aiStore.isProcessing" />
          <el-button type="primary" :disabled="!inputMessage.trim() || aiStore.isProcessing" @click="sendMessage">
            <el-icon><Promotion /></el-icon>
          </el-button>
        </div>
        <div class="input-hint">
          <span v-if="agentModeEnabled && selectedServer"><el-icon><Monitor /></el-icon> 已连接: {{ getServerName(selectedServer) }}</span>
          <span v-else-if="agentModeEnabled"><el-icon><Warning /></el-icon> 请先选择服务器</span>
          <span>Ctrl + Enter 发送</span>
        </div>
      </div>
    </div>

    <!-- 右侧工具面板 -->
    <div class="tools-panel" v-if="agentModeEnabled">
      <div class="panel-header"><h3>可用工具</h3></div>
      <div class="tools-list">
        <div v-for="(tools, category) in aiStore.toolsByCategory" :key="category" class="tool-category">
          <div class="category-title">{{ categoryNames[category] || category }}</div>
          <div v-for="tool in tools" :key="tool.name" class="tool-item" :class="{ disabled: !selectedServer, dangerous: tool.dangerous }">
            <el-icon><component :is="getToolIcon(tool.name)" /></el-icon>
            <div class="tool-info">
              <div class="tool-name">{{ tool.displayName }}</div>
              <div class="tool-desc">{{ tool.description }}</div>
            </div>
            <el-tag v-if="tool.dangerous" type="warning" size="small">危险</el-tag>
          </div>
        </div>
      </div>
      <div class="panel-section">
        <h4>执行历史</h4>
        <div class="execution-history">
          <div v-for="exec in aiStore.recentExecutions.slice(0, 10)" :key="exec.id" class="history-item" :class="{ success: exec.success, error: !exec.success }">
            <el-icon><component :is="exec.success ? CircleCheck : CircleClose" /></el-icon>
            <span class="history-tool">{{ exec.displayName || exec.name }}</span>
            <span class="history-time">{{ formatTime(exec.timestamp) }}</span>
          </div>
          <el-empty v-if="aiStore.recentExecutions.length === 0" description="暂无执行记录" :image-size="40" />
        </div>
      </div>
    </div>

    <!-- 危险操作确认对话框 -->
    <el-dialog v-model="showConfirmDialog" title="确认执行危险操作" width="500px" :close-on-click-modal="false">
      <div class="confirm-content">
        <el-alert type="warning" :closable="false" show-icon>
          <template #title>此操作可能会影响服务器运行</template>
        </el-alert>
        <div class="confirm-detail">
          <p><strong>工具:</strong> {{ pendingConfirm?.tool }}</p>
          <p><strong>描述:</strong> {{ pendingConfirm?.description }}</p>
          <pre v-if="pendingConfirm?.arguments">{{ JSON.stringify(pendingConfirm.arguments, null, 2) }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="handleConfirm(false)">取消</el-button>
        <el-button type="danger" @click="handleConfirm(true)">确认执行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useServerStore } from '@/stores/server'
import { useAIStore } from '@/stores/ai'
import { ElMessage } from 'element-plus'
import ChatMessage from '@/components/ai/ChatMessage.vue'
import TaskPlan from '@/components/ai/TaskPlan.vue'
import {
  Plus, Delete, ChatDotRound, Operation, MagicStick, Promotion, Monitor, Warning,
  Loading, Box, Document, Setting, Cpu, FolderOpened, CircleCheck, CircleClose,
  Upload, Search, Shield, Connection
} from '@element-plus/icons-vue'

const serverStore = useServerStore()
const aiStore = useAIStore()

const selectedServer = ref<string | null>(serverStore.currentServerId)
const agentModeEnabled = ref(true)
const inputMessage = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const showConfirmDialog = ref(false)
const pendingConfirm = ref<{ tool: string; arguments: Record<string, unknown>; description: string } | null>(null)

const connectedServers = computed(() => serverStore.connectedServers)
const inputPlaceholder = computed(() => agentModeEnabled.value ? '输入任务，AI 将自动执行...' : '输入消息...')

const categoryNames: Record<string, string> = { system: '系统', docker: 'Docker', file: '文件', network: '网络', database: '数据库', plugin: '插件', deployment: '部署', monitoring: '监控诊断' }

const quickActions = [
  { icon: Cpu, title: '一键部署', desc: '快速部署常用应用', prompt: '帮我部署一个应用，先告诉我支持哪些应用' },
  { icon: Monitor, title: '系统诊断', desc: '智能分析系统健康状态', prompt: '对当前服务器进行全面的系统诊断' },
  { icon: Box, title: '容器管理', desc: '列出并管理 Docker 容器', prompt: '列出所有 Docker 容器的状态' },
  { icon: Document, title: '日志分析', desc: '智能分析系统日志', prompt: '分析 /var/log/syslog 的最近日志，找出错误和警告' },
  { icon: Setting, title: '安全扫描', desc: '检查服务器安全配置', prompt: '对服务器进行安全扫描，检查潜在风险' },
  { icon: FolderOpened, title: '文件操作', desc: '浏览和管理文件', prompt: '列出 /var/log 目录下的文件' },
]

const toolIconMap: Record<string, unknown> = {
  get_system_info: Monitor, execute_command: Monitor, list_services: Setting, service_action: Setting,
  list_processes: Cpu, kill_process: Cpu, list_containers: Box, container_action: Box,
  list_directory: FolderOpened, read_file: Document, write_file: Document,
  // 部署工具
  deploy_application: Upload, create_nginx_config: Setting, list_deployable_apps: Box,
  // 监控诊断工具
  diagnose_system: Monitor, analyze_logs: Search, security_scan: Shield, check_port: Connection
}

function getToolIcon(name: string) { return toolIconMap[name] || Monitor }
function getServerName(id: string) { return connectedServers.value.find(s => s.id === id)?.name || id }
function formatTime(date: Date) { return new Date(date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
function formatDate(date: Date) {
  const d = new Date(date), now = new Date(), diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

function renderMarkdown(content: string): string {
  if (!content) return ''
  return content
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function createNewConversation() {
  aiStore.createConversation(agentModeEnabled.value, selectedServer.value || undefined)
}

async function sendMessage() {
  const content = inputMessage.value.trim()
  if (!content || aiStore.isProcessing) return

  aiStore.addUserMessage(content)
  inputMessage.value = ''
  scrollToBottom()

  if (agentModeEnabled.value && selectedServer.value) {
    await processAgentMessage(content)
  } else {
    await processChatMessage(content)
  }
}

async function processAgentMessage(userMessage: string) {
  aiStore.startProcessing('分析任务...')
  try {
    const result = await window.electronAPI.ai.executeAgent(userMessage, {
      serverId: selectedServer.value,
      agentMode: true,
      history: aiStore.messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    })

    if (result.plan) aiStore.setPlan(result.plan)

    const toolCalls = result.toolCalls?.map((tc: any) => ({
      ...tc, id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      displayName: tc.name, timestamp: new Date(), expanded: false
    })) || []

    toolCalls.forEach((tc: any) => aiStore.addExecutionRecord(tc))

    aiStore.addAssistantMessage(result.response, { toolCalls, steps: result.steps, plan: result.plan })
  } catch (e) {
    aiStore.addAssistantMessage(`抱歉，处理请求时出错：${(e as Error).message}`)
  } finally {
    aiStore.endProcessing()
    scrollToBottom()
  }
}

async function processChatMessage(userMessage: string) {
  aiStore.startProcessing('思考中...')
  try {
    const response = await window.electronAPI.ai.chat(userMessage, {
      systemPrompt: '你是 ServerHub AI 助手，帮助用户解答服务器管理相关问题。'
    })
    aiStore.addAssistantMessage(response)
  } catch (e) {
    aiStore.addAssistantMessage(`抱歉，出错了：${(e as Error).message}`)
  } finally {
    aiStore.endProcessing()
    scrollToBottom()
  }
}

function sendQuickAction(prompt: string) { inputMessage.value = prompt; sendMessage() }

function regenerateMessage(messageId: string) {
  const messages = aiStore.messages
  const index = messages.findIndex(m => m.id === messageId)
  if (index > 0) {
    const userMsg = messages[index - 1]
    if (userMsg.role === 'user') {
      inputMessage.value = userMsg.content
      sendMessage()
    }
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); sendMessage() }
}

function handleConfirm(confirmed: boolean) {
  aiStore.confirmOperation(confirmed)
  showConfirmDialog.value = false
  pendingConfirm.value = null
}

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}

watch(() => serverStore.currentServerId, (id) => { if (id) selectedServer.value = id })
watch(agentModeEnabled, (mode) => aiStore.setAgentMode(mode))
watch(selectedServer, (id) => aiStore.setServerId(id || undefined))
watch(() => aiStore.pendingConfirmation, (confirm) => {
  if (confirm) { pendingConfirm.value = confirm; showConfirmDialog.value = true }
})

onMounted(async () => {
  aiStore.initialize()
  try {
    const tools = await window.electronAPI.ai.getAvailableTools()
    aiStore.setAvailableTools(tools)
  } catch (e) { console.error('Failed to load tools:', e) }
})
</script>

<style lang="scss" scoped>
.ai-page {
  display: flex;
  height: 100%;
  background-color: var(--bg-color);
}

.conversations-panel {
  width: 260px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  
  .panel-header {
    padding: var(--space-4);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    
    h3 {
      margin: 0;
      font-size: var(--text-base);
      font-weight: 600;
    }
  }
  
  .conversation-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2);
  }
  
  .conversation-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    
    &:hover {
      background-color: var(--bg-tertiary);
    }
    
    &.active {
      background-color: var(--primary-color);
      color: #fff;
      
      .conv-time, .conv-delete {
        color: rgba(255, 255, 255, 0.7);
      }
    }
    
    .conv-icon {
      font-size: var(--text-lg);
    }
    
    .conv-info {
      flex: 1;
      min-width: 0;
    }
    
    .conv-title {
      font-size: var(--text-sm);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .conv-time {
      font-size: var(--text-xs);
      color: var(--text-muted);
      margin-top: 2px;
    }
    
    .conv-delete {
      opacity: 0;
      transition: opacity var(--transition-fast);
    }
    
    &:hover .conv-delete {
      opacity: 1;
    }
  }
}

.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  
  .chat-header {
    padding: var(--space-3) var(--space-5);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    
    .header-left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      
      .ai-icon {
        font-size: var(--text-2xl);
        color: var(--primary-color);
      }
      
      .title {
        font-size: var(--text-lg);
        font-weight: 600;
      }
    }
    
    .header-right {
      display: flex;
      align-items: center;
    }
  }
  
  .messages-container {
    flex: 1;
    overflow-y: auto;
  }
  
  .current-plan {
    padding: 0 var(--space-5) var(--space-3);
  }
}

.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-10);
  
  .welcome-icon {
    margin-bottom: var(--space-5);
  }
  
  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-2xl);
    font-weight: 600;
  }
  
  p {
    margin: 0 0 var(--space-8);
    color: var(--text-secondary);
  }
  
  .quick-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
    max-width: 700px;
  }
  
  .action-card {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    
    &:hover {
      border-color: var(--primary-color);
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    
    .el-icon {
      font-size: var(--text-2xl);
      color: var(--primary-color);
    }
    
    .action-title {
      font-weight: 600;
      font-size: var(--text-base);
      margin-bottom: var(--space-1);
    }
    
    .action-desc {
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }
  }
}

.message {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  
  &.thinking, &.streaming {
    background-color: var(--bg-tertiary);
  }
  
  .message-avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary-gradient);
    color: #fff;
    font-size: var(--text-lg);
  }
  
  .message-body {
    flex: 1;
  }
  
  .thinking-text {
    color: var(--text-secondary);
    font-size: var(--text-base);
  }
  
  .spin {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.input-area {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  
  .input-wrapper {
    display: flex;
    gap: var(--space-3);
    
    .el-input {
      flex: 1;
    }
    
    .el-button {
      height: auto;
      padding: var(--space-3) var(--space-5);
    }
  }
  
  .input-hint {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-muted);
    
    .el-icon {
      margin-right: var(--space-1);
    }
  }
}

.tools-panel {
  width: 280px;
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  
  .panel-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-color);
    
    h3 {
      margin: 0;
      font-size: var(--text-base);
      font-weight: 600;
    }
  }
  
  .tools-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-3);
  }
  
  .tool-category {
    margin-bottom: var(--space-4);
    
    .category-title {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: var(--space-2);
      padding: 0 var(--space-2);
    }
  }
  
  .tool-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-1);
    transition: background-color var(--transition-fast);
    
    &:hover {
      background-color: var(--bg-tertiary);
    }
    
    &.disabled {
      opacity: 0.5;
    }
    
    &.dangerous .el-icon {
      color: var(--warning-color);
    }
    
    .el-icon {
      font-size: var(--text-lg);
      color: var(--primary-color);
      margin-top: 2px;
    }
    
    .tool-info {
      flex: 1;
      min-width: 0;
    }
    
    .tool-name {
      font-size: var(--text-sm);
      font-weight: 500;
    }
    
    .tool-desc {
      font-size: var(--text-xs);
      color: var(--text-muted);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  
  .panel-section {
    padding: var(--space-4);
    border-top: 1px solid var(--border-color);
    
    h4 {
      margin: 0 0 var(--space-3);
      font-size: var(--text-sm);
      font-weight: 600;
    }
  }
  
  .execution-history {
    max-height: 200px;
    overflow-y: auto;
  }
  
  .history-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    
    &.success .el-icon {
      color: var(--success-color);
    }
    
    &.error .el-icon {
      color: var(--danger-color);
    }
    
    .history-tool {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .history-time {
      color: var(--text-muted);
      font-size: var(--text-xs);
    }
  }
}

.confirm-content {
  .el-alert {
    margin-bottom: var(--space-4);
  }
  
  .confirm-detail {
    p {
      margin: var(--space-2) 0;
    }
    
    pre {
      background: var(--bg-tertiary);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      overflow-x: auto;
    }
  }
}
</style>
