<template>
  <div class="ai-page">
    <!-- 左侧对话列表 -->
    <div class="conversations-panel">
      <div class="panel-header">
        <h3>对话</h3>
        <el-button type="primary" size="small" @click="createNewConversation"><el-icon><Plus /></el-icon></el-button>
      </div>
      <div class="conversation-list">
        <TransitionGroup name="conv-list">
          <div v-for="conv in aiStore.conversations" :key="conv.id" class="conversation-item"
            :class="{ active: aiStore.currentConversationId === conv.id }"
            @click="aiStore.switchConversation(conv.id)">
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
          <div class="ai-badge">{{ currentAgent?.icon || 'AI' }}</div>
          <span class="title">{{ currentAgent?.name || 'Runixo 助手' }}</span>
        </div>
        <div class="header-right">
          <!-- Agent 选择器 -->
          <el-select v-model="selectedAgentId" placeholder="选择智能体" size="small" style="width: 130px">
            <el-option v-for="agent in agents" :key="agent.id" :label="`${agent.icon} ${agent.name}`" :value="agent.id" />
          </el-select>
          <el-select v-model="selectedServer" placeholder="选择服务器" size="small" clearable style="width: 150px">
            <el-option v-for="server in connectedServers" :key="server.id" :label="server.name" :value="server.id" />
          </el-select>
          <el-button text size="small" @click="showDebugDialog = true" title="调试">
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
      </div>

      <div class="messages-container" ref="messagesRef">
        <!-- 欢迎页 -->
        <div v-if="aiStore.messages.length === 0" class="welcome">
          <div class="welcome-logo">
            <svg viewBox="0 0 48 48" fill="none" width="56" height="56">
              <rect x="4" y="8" width="40" height="32" rx="8" fill="url(#wg)" />
              <circle cx="18" cy="22" r="3" fill="#fff" opacity="0.9" /><circle cx="30" cy="22" r="3" fill="#fff" opacity="0.9" />
              <path d="M18 32c0-4 3-7 6-7s6 3 6 7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
              <defs><linearGradient id="wg" x1="4" y1="8" x2="44" y2="40"><stop stop-color="#10b981" /><stop offset="1" stop-color="#06b6d4" /></linearGradient></defs>
            </svg>
          </div>
          <h2>你好，我是 Runixo AI 助手</h2>
          <p class="welcome-desc">选择服务器后，我可以直接操作和诊断</p>
          <div class="quick-actions">
            <div v-for="action in quickActions.slice(0, 4)" :key="action.title" class="action-card" @click="sendQuickAction(action.prompt)">
              <el-icon class="action-icon"><component :is="action.icon" /></el-icon>
              <div>
                <div class="action-title">{{ action.title }}</div>
                <div class="action-desc">{{ action.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 消息列表 -->
        <template v-else>
          <ChatMessage v-for="msg in aiStore.messages" :key="msg.id" :message="msg" @regenerate="regenerateMessage(msg.id)" />
        </template>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <div class="input-card">
          <el-input v-model="inputMessage" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }"
            :placeholder="inputPlaceholder" @keydown="handleKeydown" :disabled="aiStore.isProcessing" resize="none" />
          <div class="input-toolbar">
            <div class="toolbar-left">
              <span v-if="selectedServer" class="server-badge">
                <el-icon><Monitor /></el-icon> {{ getServerName(selectedServer) }}
              </span>
              <span v-else-if="false" class="server-badge warn">
                <el-icon><Warning /></el-icon> 请选择服务器
              </span>
            </div>
            <div class="toolbar-right">
              <span class="hint">Ctrl+Enter 发送</span>
              <el-button v-if="aiStore.isProcessing" type="danger" :icon="Close" circle size="small" @click="stopGeneration" title="停止生成" />
              <el-button v-else type="primary" :icon="Promotion" circle size="small"
                :disabled="!inputMessage.trim()" @click="sendMessage" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧工具面板 -->
    <div class="tools-panel" v-if="selectedServer">
      <div class="panel-header"><h3>可用工具</h3></div>
      <div class="tools-list">
        <div v-for="(tools, category) in aiStore.toolsByCategory" :key="category" class="tool-category">
          <div class="category-title">{{ categoryNames[category] || category }}</div>
          <div v-for="tool in tools" :key="tool.name" class="tool-item" :class="{ dangerous: tool.dangerous }">
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
          <el-empty v-if="aiStore.recentExecutions.length === 0" description="暂无记录" :image-size="40" />
        </div>
      </div>
    </div>
    <!-- 调试对话框 -->
    <el-dialog v-model="showDebugDialog" title="调试" width="400px" append-to-body>
      <div style="margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px">命令授权策略</div>
        <el-radio-group v-model="commandPolicy" @change="onPolicyChange">
          <el-radio value="auto-all">全部自动通过</el-radio>
          <el-radio value="auto-safe">危险命令需审查</el-radio>
          <el-radio value="auto-file">仅文件操作自动通过</el-radio>
          <el-radio value="manual-all">全部需要审查</el-radio>
        </el-radio-group>
      </div>
      <el-divider />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useServerStore } from '@/stores/server'
import { useAIStore } from '@/stores/ai'
import { ElMessage } from 'element-plus'
import ChatMessage from '@/components/ai/ChatMessage.vue'
import {
  Plus, Delete, ChatDotRound, Operation, Promotion, Monitor, Warning,
  Loading, Box, Document, Setting, Cpu, FolderOpened, CircleCheck, CircleClose,
  Upload, Search, Connection, Close
} from '@element-plus/icons-vue'

const serverStore = useServerStore()
const aiStore = useAIStore()

const selectedServer = ref<string | null>(serverStore.currentServerId)
const inputMessage = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const showDebugDialog = ref(false)
const commandPolicy = ref('auto-safe')
const selectedAgentId = ref('general')
const agents = ref<Array<{ id: string; name: string; icon: string; description: string }>>([])
let cleanupStreamListener: (() => void) | null = null

const connectedServers = computed(() => serverStore.connectedServers)
const currentAgent = computed(() => agents.value.find(a => a.id === selectedAgentId.value))
const inputPlaceholder = computed(() => {
  const agentHint = currentAgent.value ? `[${currentAgent.value.name}] ` : ''
  return selectedServer.value ? `${agentHint}输入任务，AI 将自动执行...` : `${agentHint}输入消息...`
})

const categoryNames: Record<string, string> = { system: '系统', docker: 'Docker', file: '文件', network: '网络', database: '数据库', plugin: '插件', deployment: '部署', monitoring: '监控诊断' }

const quickActions = [
  { icon: Cpu, title: '系统诊断', desc: '全面分析系统健康状态', prompt: '对当前服务器进行全面的系统诊断' },
  { icon: Box, title: '容器管理', desc: '查看 Docker 容器状态', prompt: '列出所有 Docker 容器的状态' },
  { icon: Document, title: '日志分析', desc: '智能分析系统日志', prompt: '分析 /var/log/syslog 的最近日志' },
  { icon: Setting, title: '安全扫描', desc: '检查服务器安全配置', prompt: '对服务器进行安全扫描' },
]

const toolIconMap: Record<string, unknown> = {
  get_system_info: Monitor, execute_command: Monitor, list_services: Setting, service_action: Setting,
  list_processes: Cpu, kill_process: Cpu, list_containers: Box, container_action: Box,
  list_directory: FolderOpened, read_file: Document, write_file: Document,
  deploy_application: Upload, list_deployable_apps: Box,
  diagnose_system: Monitor, analyze_logs: Search, check_port: Connection
}

function getToolIcon(name: string) { return toolIconMap[name] || Monitor }
function getServerName(id: string) { return connectedServers.value.find(s => s.id === id)?.name || id }
function formatTime(date: Date) { return new Date(date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
function formatDate(date: Date) {
  const d = new Date(date), diff = Date.now() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

async function onPolicyChange(val: string) {
  await window.electronAPI.ai.setCommandPolicy(val)
}

onMounted(async () => {
  commandPolicy.value = await window.electronAPI.ai.getCommandPolicy()
  try { agents.value = await window.electronAPI.agent.list() } catch {}
})

function createNewConversation() { aiStore.createConversation(true, selectedServer.value || undefined) }

async function sendMessage() {
  const content = inputMessage.value.trim()
  if (!content || aiStore.isProcessing) return

  aiStore.addUserMessage(content)
  inputMessage.value = ''
  scrollToBottom()
  await processStreamChat(content)
}

async function processStreamChat(userMessage: string) {
  aiStore.startProcessing('思考中...')
  aiStore.createStreamingMessage()
  scrollToBottom()

  cleanupStreamListener = window.electronAPI.ai.onStreamDelta((delta: any) => {
    aiStore.appendToLastMessage(delta)
    scrollToBottom()
  })

  try {
    await window.electronAPI.ai.streamChat(userMessage, {
      serverId: selectedServer.value || undefined,
      history: aiStore.messages.slice(0, -2).slice(-20).map(m => ({ role: m.role, content: m.content })),
      agentId: selectedAgentId.value || undefined
    })
  } catch (e) {
    const msgs = aiStore.messages
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant' && !last.content) {
      last.content = `抱歉，出错了：${(e as Error).message}`
    }
  } finally {
    cleanupStreamListener?.()
    cleanupStreamListener = null
    aiStore.finalizeStreamingMessage()
    aiStore.endProcessing()
    scrollToBottom()
  }
}

function stopGeneration() {
  window.electronAPI.ai.stopStream()
  cleanupStreamListener?.()
  cleanupStreamListener = null
  aiStore.finalizeStreamingMessage()
  aiStore.endProcessing()
  ElMessage.info('已停止生成')
}

function sendQuickAction(prompt: string) { inputMessage.value = prompt; sendMessage() }

function regenerateMessage(messageId: string) {
  const msgs = aiStore.messages
  const idx = msgs.findIndex(m => m.id === messageId)
  if (idx > 0 && msgs[idx - 1].role === 'user') { inputMessage.value = msgs[idx - 1].content; sendMessage() }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); sendMessage() }
}

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}

watch(() => serverStore.currentServerId, (id) => { if (id) selectedServer.value = id })
watch(selectedServer, (id) => aiStore.setServerId(id || undefined))

onMounted(async () => {
  aiStore.initialize()
  try {
    const tools = await window.electronAPI.ai.getAvailableTools()
    aiStore.setAvailableTools(tools)
  } catch {}
})

onUnmounted(() => { cleanupStreamListener?.() })
</script>

<style lang="scss" scoped>
.ai-page {
  display: flex;
  height: 100%;
  background-color: var(--bg-color);
}

// ===== 左侧对话列表 =====
.conversations-panel {
  width: 240px;
  border-right: 1px solid var(--border-color);
  display: flex; flex-direction: column;
  background-color: var(--bg-secondary);

  .panel-header {
    padding: 14px 16px;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid var(--border-color);
    h3 { margin: 0; font-size: 14px; font-weight: 600; }
  }

  .conversation-list { flex: 1; overflow-y: auto; padding: 8px; }

  .conversation-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 10px; cursor: pointer;
    transition: all 0.15s; margin-bottom: 2px;
    &:hover { background-color: var(--bg-tertiary); }
    &.active { background: var(--primary-gradient); color: #fff;
      .conv-time, .conv-delete { color: rgba(255,255,255,0.7); }
    }
    .conv-icon { font-size: 16px; }
    .conv-info { flex: 1; min-width: 0; }
    .conv-title { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .conv-time { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .conv-delete { opacity: 0; transition: opacity 0.15s; }
    &:hover .conv-delete { opacity: 1; }
  }
}

// ===== 主聊天区域 =====
.chat-panel {
  flex: 1; display: flex; flex-direction: column; min-width: 0;

  .chat-header {
    padding: 10px 20px;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--bg-secondary);

    .header-left {
      display: flex; align-items: center; gap: 10px;
      .ai-badge {
        width: 28px; height: 28px; border-radius: 8px;
        background: linear-gradient(135deg, #10b981, #06b6d4);
        color: #fff; font-size: 11px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
      }
      .title { font-size: 15px; font-weight: 600; }
    }
    .header-right { display: flex; align-items: center; gap: 12px; }
  }

  .messages-container { flex: 1; overflow-y: auto; }
}

// ===== 欢迎页 =====
.welcome {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; padding: 40px;

  .welcome-logo { margin-bottom: 20px; }
  h2 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
  .welcome-desc { margin: 0 0 32px; color: var(--text-secondary); font-size: 14px; }

  .quick-actions {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 12px; max-width: 520px; width: 100%;
  }

  .action-card {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 16px; border-radius: 12px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    cursor: pointer; transition: all 0.2s;
    &:hover { border-color: var(--primary-color); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    .action-icon { font-size: 22px; color: #10b981; margin-top: 2px; }
    .action-title { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
    .action-desc { font-size: 12px; color: var(--text-secondary); }
  }
}

// ===== 输入区域 =====
.input-area {
  padding: 12px 20px 16px;
  background-color: var(--bg-color);

  .input-card {
    max-width: 800px; margin: 0 auto;
    border: 1px solid var(--border-color); border-radius: 14px;
    background-color: var(--bg-secondary);
    overflow: hidden; transition: border-color 0.3s, box-shadow 0.3s;
    &:focus-within {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
    }

    :deep(.el-textarea__inner) {
      background: transparent !important; border: none !important;
      box-shadow: none !important; padding: 14px 16px 8px;
      font-size: 14px; line-height: 1.5; color: var(--text-color);
      resize: none;
    }
  }

  .input-toolbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 12px 10px;
    .toolbar-left { display: flex; align-items: center; gap: 8px; }
    .toolbar-right { display: flex; align-items: center; gap: 10px; }
    .server-badge {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: #10b981;
      background: rgba(16, 185, 129, 0.1); padding: 3px 10px; border-radius: 20px;
      &.warn { color: var(--warning-color); background: rgba(245, 158, 11, 0.1); }
    }
    .hint { font-size: 11px; color: var(--text-muted); }

    // 停止按钮动画
    :deep(.el-button--danger.is-circle) {
      animation: stopBtnPulse 1.5s ease-in-out infinite;
    }
  }
}

@keyframes stopBtnPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}

// ===== 右侧工具面板 =====
.tools-panel {
  width: 260px;
  border-left: 1px solid var(--border-color);
  display: flex; flex-direction: column;
  background-color: var(--bg-secondary);

  .panel-header {
    padding: 14px 16px; border-bottom: 1px solid var(--border-color);
    h3 { margin: 0; font-size: 14px; font-weight: 600; }
  }

  .tools-list { flex: 1; overflow-y: auto; padding: 8px; }

  .tool-category {
    margin-bottom: 12px;
    .category-title {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; margin-bottom: 6px; padding: 0 8px;
    }
  }

  .tool-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 8px; border-radius: 8px; margin-bottom: 2px;
    transition: background-color 0.15s;
    &:hover { background-color: var(--bg-tertiary); }
    &.disabled { opacity: 0.4; }
    &.dangerous .el-icon { color: var(--warning-color); }
    .el-icon { font-size: 16px; color: #10b981; margin-top: 2px; }
    .tool-info { flex: 1; min-width: 0; }
    .tool-name { font-size: 12px; font-weight: 500; }
    .tool-desc { font-size: 11px; color: var(--text-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  }

  .panel-section {
    padding: 12px 16px; border-top: 1px solid var(--border-color);
    h4 { margin: 0 0 8px; font-size: 12px; font-weight: 600; }
  }

  .execution-history { max-height: 180px; overflow-y: auto; }

  .history-item {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 8px; border-radius: 6px; font-size: 12px;
    &.success .el-icon { color: var(--success-color); }
    &.error .el-icon { color: var(--danger-color); }
    .history-tool { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .history-time { color: var(--text-muted); font-size: 11px; }
  }
}
</style>
