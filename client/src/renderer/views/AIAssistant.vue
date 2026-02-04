<template>
  <div class="ai-assistant-page">
    <div class="chat-container">
      <!-- 聊天头部 -->
      <div class="chat-header">
        <div class="header-left">
          <el-icon class="ai-icon"><ChatDotRound /></el-icon>
          <h2>AI 助手</h2>
          <el-tag size="small" type="info" class="token-badge">
            <el-icon><Coin /></el-icon>
            {{ sessionTokens.toLocaleString() }} tokens
          </el-tag>
        </div>
        <div class="header-right">
          <el-select
            v-model="selectedModel"
            placeholder="选择模型"
            class="model-select"
            size="small"
          >
            <el-option
              v-for="model in availableModels"
              :key="model.value"
              :label="model.label"
              :value="model.value"
            >
              <div class="model-option">
                <span class="model-name">{{ model.label }}</span>
                <span class="model-desc">{{ model.description }}</span>
              </div>
            </el-option>
          </el-select>
          <el-select
            v-model="selectedServer"
            placeholder="选择服务器上下文"
            clearable
            class="server-select"
          >
            <el-option
              v-for="server in connectedServers"
              :key="server.id"
              :label="server.name"
              :value="server.id"
            />
          </el-select>
          <el-tooltip content="命令面板 (Ctrl+Shift+P)">
            <el-button @click="showCommandPalette = true" size="small">
              <el-icon><Search /></el-icon>
            </el-button>
          </el-tooltip>
          <el-dropdown trigger="click" @command="handleExport">
            <el-button size="small">
              <el-icon><Download /></el-icon>
              导出
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="markdown">导出为 Markdown</el-dropdown-item>
                <el-dropdown-item command="json">导出为 JSON</el-dropdown-item>
                <el-dropdown-item command="txt">导出为纯文本</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button @click="clearHistory" :disabled="messages.length === 0" size="small">
            <el-icon><Delete /></el-icon>
            清空
          </el-button>
        </div>
      </div>

      <!-- 聊天消息区域 -->
      <div class="chat-messages" ref="messagesContainer">
        <div v-if="messages.length === 0" class="welcome-message">
          <div class="welcome-icon">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="8" width="40" height="32" rx="4" fill="url(#ai-gradient)" />
              <circle cx="16" cy="22" r="3" fill="#fff" />
              <circle cx="32" cy="22" r="3" fill="#fff" />
              <path d="M16 32c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#fff" stroke-width="2" stroke-linecap="round" />
              <defs>
                <linearGradient id="ai-gradient" x1="4" y1="8" x2="44" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#6366f1" />
                  <stop offset="1" stop-color="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h3>你好，我是 ServerHub AI 助手</h3>
          <p>我可以帮助你管理服务器、执行命令、分析日志、诊断问题等。</p>
          <div class="quick-actions">
            <el-button
              v-for="action in quickActions"
              :key="action.text"
              @click="sendQuickAction(action.prompt)"
              size="small"
            >
              {{ action.text }}
            </el-button>
          </div>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="['message', msg.role]"
        >
          <div class="message-avatar">
            <el-icon v-if="msg.role === 'user'"><User /></el-icon>
            <el-icon v-else><ChatDotRound /></el-icon>
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="role-name">{{ msg.role === 'user' ? '你' : 'AI 助手' }}</span>
              <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
              <span v-if="msg.tokens" class="message-tokens">
                <el-icon><Coin /></el-icon>
                {{ msg.tokens }}
              </span>
              <div class="message-actions">
                <el-button
                  v-if="msg.role === 'assistant'"
                  text
                  size="small"
                  @click="copyMessage(msg.content)"
                  class="action-btn"
                >
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
                <el-button
                  v-if="msg.role === 'assistant'"
                  text
                  size="small"
                  @click="regenerateResponse(index)"
                  class="action-btn"
                >
                  <el-icon><Refresh /></el-icon>
                </el-button>
                <el-button
                  v-if="msg.role === 'assistant'"
                  text
                  size="small"
                  :class="{ 'feedback-active': msg.feedback === 'positive' }"
                  @click="setMessageFeedback(msg, 'positive')"
                  class="action-btn"
                >
                  <el-icon><CircleCheck /></el-icon>
                </el-button>
                <el-button
                  v-if="msg.role === 'assistant'"
                  text
                  size="small"
                  :class="{ 'feedback-active negative': msg.feedback === 'negative' }"
                  @click="setMessageFeedback(msg, 'negative')"
                  class="action-btn"
                >
                  <el-icon><CircleClose /></el-icon>
                </el-button>
              </div>
            </div>
            <div class="message-text" v-html="renderMarkdown(msg.content)"></div>

            <!-- 命令执行区域 -->
            <div v-if="msg.commands && msg.commands.length > 0" class="command-blocks">
              <div v-for="(cmd, cmdIndex) in msg.commands" :key="cmdIndex" class="command-block">
                <div class="command-header">
                  <el-icon><Monitor /></el-icon>
                  <span class="command-label">建议执行的命令</span>
                  <el-tag v-if="cmd.executed" type="success" size="small">已执行</el-tag>
                </div>
                <pre class="command-code">{{ cmd.command }}</pre>
                <div class="command-actions" v-if="!cmd.executed">
                  <el-button type="primary" size="small" @click="executeCommand(msg, cmdIndex)">
                    <el-icon><VideoPlay /></el-icon>
                    执行
                  </el-button>
                  <el-button size="small" @click="copyCommand(cmd.command)">
                    <el-icon><CopyDocument /></el-icon>
                    复制
                  </el-button>
                </div>
                <div v-if="cmd.result" class="command-result">
                  <div class="result-header">
                    <span>执行结果</span>
                    <el-tag :type="cmd.success ? 'success' : 'danger'" size="small">
                      {{ cmd.success ? '成功' : '失败' }}
                    </el-tag>
                  </div>
                  <pre class="result-output">{{ cmd.result }}</pre>
                </div>
              </div>
            </div>

            <!-- 工具调用展示 -->
            <div v-if="msg.toolCalls && msg.toolCalls.length > 0" class="tool-calls">
              <div
                v-for="(tool, toolIndex) in msg.toolCalls"
                :key="toolIndex"
                class="tool-call"
              >
                <div class="tool-header" @click="tool.expanded = !tool.expanded">
                  <el-icon><Operation /></el-icon>
                  <span class="tool-name">{{ tool.name }}</span>
                  <el-tag size="small" :type="tool.success ? 'success' : 'danger'">
                    {{ tool.success ? '成功' : '失败' }}
                  </el-tag>
                  <el-icon class="expand-icon">
                    <ArrowDown v-if="!tool.expanded" />
                    <ArrowUp v-else />
                  </el-icon>
                </div>
                <div v-if="tool.expanded" class="tool-details">
                  <div class="tool-section">
                    <span class="section-label">参数:</span>
                    <pre>{{ formatJson(tool.arguments) }}</pre>
                  </div>
                  <div class="tool-section">
                    <span class="section-label">结果:</span>
                    <pre>{{ formatJson(tool.result) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 正在输入指示器 -->
        <div v-if="isTyping" class="message assistant typing">
          <div class="message-avatar">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        <!-- 流式响应 -->
        <div v-if="streamingContent" class="message assistant streaming">
          <div class="message-avatar">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="role-name">AI 助手</span>
              <el-tag size="small" type="info">正在生成...</el-tag>
            </div>
            <div class="message-text" v-html="renderMarkdown(streamingContent)"></div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input">
        <el-input
          v-model="inputMessage"
          type="textarea"
          :rows="2"
          placeholder="输入消息... (Ctrl+Enter 发送)"
          @keydown="handleKeydown"
          :disabled="isLoading"
        />
        <el-button
          type="primary"
          @click="sendMessage"
          :loading="isLoading"
          :disabled="!inputMessage.trim()"
        >
          <el-icon><Promotion /></el-icon>
          发送
        </el-button>
      </div>
    </div>

    <!-- 侧边栏 -->
    <div class="sidebar">
      <!-- 对话历史 -->
      <div class="sidebar-section">
        <div class="section-header">
          <h3>对话历史</h3>
          <el-button text size="small" @click="saveCurrentConversation" :disabled="messages.length === 0">
            <el-icon><Plus /></el-icon>
            保存
          </el-button>
        </div>
        <el-input
          v-model="conversationSearchQuery"
          placeholder="搜索对话..."
          size="small"
          clearable
          class="conversation-search"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <div class="conversation-list">
          <div
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="conversation-item"
            :class="{ active: currentConversationId === conv.id }"
            @click="loadConversation(conv.id)"
          >
            <div class="conv-info">
              <div class="conv-title-row">
                <el-icon
                  v-if="conv.starred"
                  class="star-icon"
                  @click.stop="toggleStarConversation(conv)"
                >
                  <StarFilled />
                </el-icon>
                <el-icon
                  v-else
                  class="star-icon unstarred"
                  @click.stop="toggleStarConversation(conv)"
                >
                  <Star />
                </el-icon>
                <span class="conv-title">{{ conv.title }}</span>
              </div>
              <span class="conv-date">{{ formatDate(conv.updatedAt) }}</span>
            </div>
            <el-button
              text
              size="small"
              class="conv-delete"
              @click.stop="deleteConversation(conv.id)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <div v-if="filteredConversations.length === 0" class="no-conversations">
            <span>{{ conversationSearchQuery ? '未找到匹配的对话' : '暂无保存的对话' }}</span>
          </div>
        </div>
      </div>

      <!-- 提示词模板 -->
      <div class="sidebar-section">
        <h3>提示词模板</h3>
        <div class="template-categories">
          <el-tag
            v-for="cat in promptTemplateCategories"
            :key="cat.id"
            :type="selectedTemplateCategory === cat.id ? 'primary' : 'info'"
            :effect="selectedTemplateCategory === cat.id ? 'dark' : 'plain'"
            class="category-tag"
            @click="selectedTemplateCategory = cat.id"
          >
            {{ cat.name }}
          </el-tag>
        </div>
        <div class="template-list">
          <div
            v-for="template in filteredTemplates"
            :key="template.id"
            class="template-item"
            @click="sendQuickAction(template.prompt)"
          >
            <div class="template-info">
              <span class="template-name">{{ template.name }}</span>
              <span class="template-desc">{{ template.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷命令 -->
      <div class="sidebar-section">
        <h3>快捷命令</h3>
        <div class="command-list">
          <div
            v-for="cmd in commands"
            :key="cmd.name"
            class="command-item"
            @click="sendQuickAction(cmd.prompt)"
          >
            <el-icon><component :is="cmd.icon" /></el-icon>
            <div class="command-info">
              <span class="command-name">{{ cmd.name }}</span>
              <span class="command-desc">{{ cmd.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 当前上下文 -->
      <div class="sidebar-section">
        <h3>当前上下文</h3>
        <div v-if="selectedServer" class="context-info">
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="服务器">
              {{ getServerName(selectedServer) }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag type="success" size="small">已连接</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="模型">
              {{ availableModels.find(m => m.value === selectedModel)?.label }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
        <div v-else class="no-context">
          <el-empty description="未选择服务器" :image-size="60" />
          <p class="hint">选择服务器后，AI 可以直接操作该服务器</p>
        </div>
      </div>

      <!-- AI 能力 -->
      <div class="sidebar-section">
        <h3>AI 能力</h3>
        <div class="capabilities">
          <el-tag v-for="cap in capabilities" :key="cap" size="small">{{ cap }}</el-tag>
        </div>
      </div>
    </div>

    <!-- 命令执行确认对话框 -->
    <el-dialog v-model="showCommandConfirm" title="确认执行命令" width="500px">
      <div class="confirm-dialog">
        <el-alert type="warning" :closable="false" show-icon>
          <template #title>
            即将在服务器上执行以下命令，请确认操作安全
          </template>
        </el-alert>
        <div class="confirm-command">
          <pre>{{ pendingCommand?.command }}</pre>
        </div>
        <div class="confirm-server" v-if="selectedServer">
          <span>目标服务器：</span>
          <el-tag>{{ getServerName(selectedServer) }}</el-tag>
        </div>
      </div>
      <template #footer>
        <el-button @click="showCommandConfirm = false">取消</el-button>
        <el-button type="primary" @click="confirmExecuteCommand">
          确认执行
        </el-button>
      </template>
    </el-dialog>

    <!-- 保存对话对话框 -->
    <el-dialog v-model="showSaveDialog" title="保存对话" width="400px">
      <el-form>
        <el-form-item label="对话标题">
          <el-input v-model="saveTitle" placeholder="输入对话标题" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSaveDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmSaveConversation">保存</el-button>
      </template>
    </el-dialog>

    <!-- 命令面板 -->
    <el-dialog
      v-model="showCommandPalette"
      :show-close="false"
      width="500px"
      class="command-palette-dialog"
    >
      <div class="command-palette">
        <div class="palette-header">
          <el-input
            v-model="paletteSearchQuery"
            placeholder="搜索命令或模板..."
            size="large"
            clearable
            @keydown.enter="paletteCommands[0] && executePaletteCommand(paletteCommands[0])"
            @keydown.esc="showCommandPalette = false"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="palette-commands">
          <div
            v-for="(cmd, index) in paletteCommands"
            :key="cmd.id"
            class="palette-command"
            :class="{ first: index === 0 }"
            @click="executePaletteCommand(cmd)"
          >
            <div class="cmd-info">
              <span class="cmd-name">{{ cmd.name }}</span>
              <span class="cmd-desc">{{ cmd.description }}</span>
            </div>
            <el-tag v-if="index === 0" size="small" type="info">Enter</el-tag>
          </div>
          <div v-if="paletteCommands.length === 0" class="no-commands">
            <span>未找到匹配的命令</span>
          </div>
        </div>
        <div class="palette-footer">
          <span><kbd>↑↓</kbd> 导航</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useServerStore } from '@/stores/server'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound,
  Delete,
  User,
  Promotion,
  Operation,
  ArrowDown,
  ArrowUp,
  Monitor,
  Box,
  Document,
  DataAnalysis,
  Setting,
  Cpu,
  Download,
  CopyDocument,
  Plus,
  VideoPlay,
  Search,
  Star,
  StarFilled,
  CircleCheck,
  CircleClose,
  Refresh,
  Coin
} from '@element-plus/icons-vue'

interface CommandInfo {
  command: string
  executed: boolean
  result?: string
  success?: boolean
}

interface ToolCallInfo {
  name: string
  arguments: string
  result: string
  success: boolean
  expanded: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolCalls?: ToolCallInfo[]
  commands?: CommandInfo[]
  feedback?: 'positive' | 'negative' | null
  tokens?: number
}

interface SavedConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  starred?: boolean
}

interface PromptTemplate {
  id: string
  name: string
  description: string
  prompt: string
  category: string
  icon: any
}

const serverStore = useServerStore()
const selectedServer = ref<string | null>(serverStore.currentServerId)
const messages = ref<ChatMessage[]>([])
const inputMessage = ref('')
const isLoading = ref(false)
const isTyping = ref(false)
const streamingContent = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

// 对话历史管理
const savedConversations = ref<SavedConversation[]>([])
const currentConversationId = ref<string | null>(null)
const showSaveDialog = ref(false)
const saveTitle = ref('')

// 命令执行确认
const showCommandConfirm = ref(false)
const pendingCommand = ref<{ message: ChatMessage; index: number; command: string } | null>(null)

// 命令面板
const showCommandPalette = ref(false)
const paletteSearchQuery = ref('')

// 对话搜索
const conversationSearchQuery = ref('')

// 模型选择
const selectedModel = ref('auto')
const availableModels = [
  { value: 'auto', label: '自动选择', description: '根据任务自动选择最佳模型' },
  { value: 'ollama', label: 'Ollama (本地)', description: '本地运行，隐私安全' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'OpenAI 最新模型' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Anthropic 高性能模型' }
]

// Token 统计
const totalTokensUsed = ref(0)
const sessionTokens = ref(0)

const connectedServers = computed(() => serverStore.connectedServers)

// 过滤后的对话列表
const filteredConversations = computed(() => {
  if (!conversationSearchQuery.value) {
    return savedConversations.value
  }
  const query = conversationSearchQuery.value.toLowerCase()
  return savedConversations.value.filter(c =>
    c.title.toLowerCase().includes(query) ||
    c.messages.some(m => m.content.toLowerCase().includes(query))
  )
})

// 当前分类的模板
const filteredTemplates = computed(() => {
  return promptTemplates.value.filter(t => t.category === selectedTemplateCategory.value)
})

// 命令面板过滤
const paletteCommands = computed(() => {
  const allCommands = [
    { id: 'new-chat', name: '新建对话', description: '开始一个新的对话', action: () => clearHistory() },
    { id: 'save-chat', name: '保存对话', description: '保存当前对话', action: () => saveCurrentConversation() },
    { id: 'export-md', name: '导出为 Markdown', description: '将对话导出为 Markdown 文件', action: () => handleExport('markdown') },
    { id: 'export-json', name: '导出为 JSON', description: '将对话导出为 JSON 文件', action: () => handleExport('json') },
    { id: 'clear-history', name: '清空对话', description: '清空当前对话历史', action: () => clearHistory() },
    ...promptTemplates.value.map(t => ({
      id: `template-${t.id}`,
      name: t.name,
      description: t.description,
      action: () => { sendQuickAction(t.prompt); showCommandPalette.value = false }
    }))
  ]

  if (!paletteSearchQuery.value) {
    return allCommands.slice(0, 10)
  }

  const query = paletteSearchQuery.value.toLowerCase()
  return allCommands.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.description.toLowerCase().includes(query)
  ).slice(0, 10)
})

// 快捷操作
const quickActions = [
  { text: '查看系统状态', prompt: '帮我查看当前服务器的系统状态' },
  { text: '列出容器', prompt: '列出所有 Docker 容器' },
  { text: '检查磁盘空间', prompt: '检查磁盘空间使用情况' },
  { text: '查看最近日志', prompt: '查看系统最近的错误日志' }
]

// 快捷命令
const commands = [
  { name: '系统诊断', description: '全面检查系统健康状态', icon: Monitor, prompt: '请对当前服务器进行全面的系统诊断，包括 CPU、内存、磁盘、网络等' },
  { name: '容器管理', description: '查看和管理 Docker 容器', icon: Box, prompt: '列出所有 Docker 容器，并告诉我它们的状态' },
  { name: '日志分析', description: '分析系统和应用日志', icon: Document, prompt: '分析最近的系统日志，找出可能的问题' },
  { name: '性能优化', description: '获取性能优化建议', icon: DataAnalysis, prompt: '分析当前服务器的性能瓶颈，并给出优化建议' },
  { name: '安全检查', description: '检查系统安全配置', icon: Setting, prompt: '检查当前服务器的安全配置，包括开放端口、防火墙规则等' },
  { name: '进程分析', description: '分析高资源占用进程', icon: Cpu, prompt: '列出占用 CPU 和内存最高的进程，并分析是否正常' }
]

// 提示词模板分类
const promptTemplateCategories = [
  { id: 'system', name: '系统运维', icon: Monitor },
  { id: 'docker', name: '容器管理', icon: Box },
  { id: 'security', name: '安全检查', icon: Setting },
  { id: 'database', name: '数据库', icon: DataAnalysis },
  { id: 'network', name: '网络诊断', icon: Cpu },
  { id: 'custom', name: '自定义', icon: Star }
]

const promptTemplates = ref<PromptTemplate[]>([
  // 系统运维
  { id: '1', name: '系统健康检查', description: '全面检查系统状态', prompt: '请对服务器进行全面的健康检查，包括 CPU、内存、磁盘、网络、进程等，并给出优化建议', category: 'system', icon: Monitor },
  { id: '2', name: '磁盘空间清理', description: '分析并清理磁盘空间', prompt: '分析磁盘空间使用情况，找出占用空间最大的目录和文件，并给出清理建议', category: 'system', icon: Monitor },
  { id: '3', name: '系统日志分析', description: '分析系统错误日志', prompt: '分析最近24小时的系统日志，找出错误和警告信息，并解释可能的原因', category: 'system', icon: Monitor },
  { id: '4', name: '服务状态检查', description: '检查关键服务运行状态', prompt: '检查所有关键系统服务的运行状态，列出已停止或异常的服务', category: 'system', icon: Monitor },

  // 容器管理
  { id: '5', name: '容器状态概览', description: '查看所有容器状态', prompt: '列出所有 Docker 容器的状态，包括运行中、已停止、资源使用情况', category: 'docker', icon: Box },
  { id: '6', name: '容器日志分析', description: '分析容器错误日志', prompt: '分析指定容器的日志，找出错误和异常信息', category: 'docker', icon: Box },
  { id: '7', name: '镜像清理建议', description: '清理无用的 Docker 镜像', prompt: '分析 Docker 镜像使用情况，找出可以清理的无用镜像和悬空镜像', category: 'docker', icon: Box },
  { id: '8', name: 'Docker Compose 部署', description: '帮助编写 Compose 文件', prompt: '帮我编写一个 Docker Compose 文件，用于部署', category: 'docker', icon: Box },

  // 安全检查
  { id: '9', name: '端口安全扫描', description: '检查开放端口', prompt: '扫描服务器开放的端口，分析是否存在安全风险', category: 'security', icon: Setting },
  { id: '10', name: '防火墙规则检查', description: '检查防火墙配置', prompt: '检查当前防火墙规则配置，分析是否存在安全漏洞', category: 'security', icon: Setting },
  { id: '11', name: 'SSH 安全配置', description: '检查 SSH 安全设置', prompt: '检查 SSH 服务的安全配置，包括密钥认证、端口、登录限制等', category: 'security', icon: Setting },
  { id: '12', name: '用户权限审计', description: '审计用户权限', prompt: '审计系统用户和权限配置，找出潜在的安全风险', category: 'security', icon: Setting },

  // 数据库
  { id: '13', name: 'MySQL 性能分析', description: '分析 MySQL 性能', prompt: '分析 MySQL 数据库的性能状态，包括连接数、慢查询、缓存命中率等', category: 'database', icon: DataAnalysis },
  { id: '14', name: 'Redis 状态检查', description: '检查 Redis 状态', prompt: '检查 Redis 服务的运行状态，包括内存使用、连接数、键数量等', category: 'database', icon: DataAnalysis },
  { id: '15', name: '数据库备份检查', description: '检查备份状态', prompt: '检查数据库备份的状态和完整性，确认最近的备份是否成功', category: 'database', icon: DataAnalysis },

  // 网络诊断
  { id: '16', name: '网络连通性测试', description: '测试网络连接', prompt: '测试服务器的网络连通性，包括 DNS 解析、外网访问、内网通信等', category: 'network', icon: Cpu },
  { id: '17', name: '带宽使用分析', description: '分析网络带宽', prompt: '分析服务器的网络带宽使用情况，找出占用带宽最高的进程', category: 'network', icon: Cpu },
  { id: '18', name: 'Nginx 配置检查', description: '检查 Nginx 配置', prompt: '检查 Nginx 配置文件的正确性，分析是否存在配置问题', category: 'network', icon: Cpu }
])

const selectedTemplateCategory = ref('system')

// AI 能力列表
const capabilities = [
  '执行命令',
  '容器管理',
  '文件操作',
  '日志分析',
  '故障诊断',
  '配置生成',
  '性能分析'
]

// 流式响应清理函数
let cleanupStream: (() => void) | null = null

onMounted(() => {
  // 监听流式响应
  cleanupStream = window.electronAPI.ai.onStream((chunk: string) => {
    streamingContent.value += chunk
    scrollToBottom()
  })

  // 加载历史消息和保存的对话
  loadHistory()
  loadSavedConversations()
  loadTokenStats()

  // 监听键盘快捷键
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  if (cleanupStream) {
    cleanupStream()
  }
  document.removeEventListener('keydown', handleGlobalKeydown)
})

// 全局键盘快捷键
function handleGlobalKeydown(e: KeyboardEvent) {
  // Ctrl+Shift+P 打开命令面板
  if (e.ctrlKey && e.shiftKey && e.key === 'P') {
    e.preventDefault()
    showCommandPalette.value = !showCommandPalette.value
    paletteSearchQuery.value = ''
  }
  // Escape 关闭命令面板
  if (e.key === 'Escape' && showCommandPalette.value) {
    showCommandPalette.value = false
  }
}

// 执行命令面板命令
function executePaletteCommand(command: { action: () => void }) {
  command.action()
  showCommandPalette.value = false
  paletteSearchQuery.value = ''
}

// Token 统计
function loadTokenStats() {
  const saved = localStorage.getItem('serverhub_ai_tokens')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      totalTokensUsed.value = parsed.total || 0
    } catch {
      // 忽略
    }
  }
}

function saveTokenStats() {
  localStorage.setItem('serverhub_ai_tokens', JSON.stringify({
    total: totalTokensUsed.value,
    lastUpdated: new Date().toISOString()
  }))
}

function updateTokenUsage(tokens: number) {
  sessionTokens.value += tokens
  totalTokensUsed.value += tokens
  saveTokenStats()
}

// 消息反馈
function setMessageFeedback(msg: ChatMessage, feedback: 'positive' | 'negative') {
  if (msg.feedback === feedback) {
    msg.feedback = null
  } else {
    msg.feedback = feedback
  }
  saveHistory()
  ElMessage.success(feedback === 'positive' ? '感谢您的反馈！' : '我们会继续改进')
}

// 收藏对话
function toggleStarConversation(conv: SavedConversation) {
  conv.starred = !conv.starred
  saveSavedConversations()
}

// 重新生成响应
async function regenerateResponse(msgIndex: number) {
  if (msgIndex < 1) return

  // 找到对应的用户消息
  const userMsg = messages.value[msgIndex - 1]
  if (userMsg.role !== 'user') return

  // 删除当前的 AI 响应
  messages.value.splice(msgIndex, 1)

  // 重新发送
  inputMessage.value = userMsg.content
  messages.value.pop() // 移除用户消息，sendMessage 会重新添加
  await sendMessage()
}

function loadHistory() {
  const saved = localStorage.getItem('serverhub_ai_history')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      messages.value = parsed.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }))
    } catch {
      // 忽略解析错误
    }
  }
}

function saveHistory() {
  // 只保存最近 50 条消息
  const toSave = messages.value.slice(-50)
  localStorage.setItem('serverhub_ai_history', JSON.stringify(toSave))
}

function clearHistory() {
  messages.value = []
  currentConversationId.value = null
  localStorage.removeItem('serverhub_ai_history')
  ElMessage.success('对话已清空')
}

// 对话历史管理
function loadSavedConversations() {
  const saved = localStorage.getItem('serverhub_ai_conversations')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      savedConversations.value = parsed.map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        messages: c.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      }))
    } catch {
      // 忽略解析错误
    }
  }
}

function saveSavedConversations() {
  localStorage.setItem('serverhub_ai_conversations', JSON.stringify(savedConversations.value))
}

function saveCurrentConversation() {
  if (messages.value.length === 0) return

  // 自动生成标题
  const firstUserMsg = messages.value.find(m => m.role === 'user')
  saveTitle.value = firstUserMsg?.content.slice(0, 30) || '新对话'
  if (saveTitle.value.length >= 30) saveTitle.value += '...'

  showSaveDialog.value = true
}

function confirmSaveConversation() {
  if (!saveTitle.value.trim()) {
    ElMessage.warning('请输入对话标题')
    return
  }

  const now = new Date()
  const conversation: SavedConversation = {
    id: Date.now().toString(),
    title: saveTitle.value.trim(),
    messages: [...messages.value],
    createdAt: now,
    updatedAt: now
  }

  savedConversations.value.unshift(conversation)
  saveSavedConversations()
  currentConversationId.value = conversation.id

  showSaveDialog.value = false
  saveTitle.value = ''
  ElMessage.success('对话已保存')
}

function loadConversation(id: string) {
  const conversation = savedConversations.value.find(c => c.id === id)
  if (conversation) {
    messages.value = [...conversation.messages]
    currentConversationId.value = id
    saveHistory()
    ElMessage.success('对话已加载')
  }
}

function deleteConversation(id: string) {
  const index = savedConversations.value.findIndex(c => c.id === id)
  if (index !== -1) {
    savedConversations.value.splice(index, 1)
    saveSavedConversations()
    if (currentConversationId.value === id) {
      currentConversationId.value = null
    }
    ElMessage.success('对话已删除')
  }
}

function getServerName(serverId: string): string {
  const server = connectedServers.value.find(s => s.id === serverId)
  return server?.name || serverId
}

async function sendMessage() {
  const content = inputMessage.value.trim()
  if (!content || isLoading.value) return

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content,
    timestamp: new Date()
  })

  inputMessage.value = ''
  isLoading.value = true
  isTyping.value = true
  streamingContent.value = ''

  scrollToBottom()

  try {
    // 构建上下文
    const context = {
      serverId: selectedServer.value || undefined,
      history: messages.value.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }))
    }

    // 调用 AI
    const response = await window.electronAPI.ai.chat(content, context)

    isTyping.value = false

    // 解析响应中的命令
    const commands = extractCommands(streamingContent.value || response)

    // 估算 token 使用量（简单估算：约 4 字符 = 1 token）
    const responseContent = streamingContent.value || response
    const estimatedTokens = Math.ceil((content.length + responseContent.length) / 4)

    // 添加 AI 响应
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: streamingContent.value || response,
      timestamp: new Date(),
      commands: commands.length > 0 ? commands : undefined,
      tokens: estimatedTokens
    }

    messages.value.push(assistantMessage)
    streamingContent.value = ''

    // 更新 token 统计
    updateTokenUsage(estimatedTokens)

    saveHistory()
  } catch (error) {
    isTyping.value = false
    streamingContent.value = ''
    ElMessage.error(`AI 请求失败: ${(error as Error).message}`)

    // 添加错误消息
    messages.value.push({
      role: 'assistant',
      content: `抱歉，发生了错误: ${(error as Error).message}`,
      timestamp: new Date()
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

// 从 AI 响应中提取命令
function extractCommands(content: string): CommandInfo[] {
  const commands: CommandInfo[] = []
  // 匹配 ```bash 或 ```shell 代码块中的命令
  const codeBlockRegex = /```(?:bash|shell|sh)\n([\s\S]*?)```/g
  let match
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const cmd = match[1].trim()
    if (cmd && !cmd.includes('\n\n')) { // 简单命令
      commands.push({
        command: cmd,
        executed: false
      })
    }
  }
  return commands
}

function executeCommand(msg: ChatMessage, cmdIndex: number) {
  if (!msg.commands) return
  const cmd = msg.commands[cmdIndex]

  pendingCommand.value = {
    message: msg,
    index: cmdIndex,
    command: cmd.command
  }
  showCommandConfirm.value = true
}

async function confirmExecuteCommand() {
  if (!pendingCommand.value || !selectedServer.value) {
    ElMessage.warning('请先选择服务器')
    showCommandConfirm.value = false
    return
  }

  const { message, index, command } = pendingCommand.value
  showCommandConfirm.value = false

  if (!message.commands) return

  try {
    // 实际执行命令
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'bash',
      ['-c', command]
    )

    message.commands[index].executed = true
    message.commands[index].success = result.exit_code === 0
    message.commands[index].result = result.stdout || result.stderr || '命令执行完成'

    if (result.exit_code === 0) {
      ElMessage.success('命令执行成功')
    } else {
      ElMessage.warning('命令执行完成，但返回非零退出码')
    }
  } catch (error) {
    message.commands[index].executed = true
    message.commands[index].success = false
    message.commands[index].result = `执行失败: ${(error as Error).message}`

    ElMessage.error('命令执行失败')
  }

  pendingCommand.value = null
}

function copyCommand(command: string) {
  navigator.clipboard.writeText(command)
  ElMessage.success('命令已复制')
}

function copyMessage(content: string) {
  navigator.clipboard.writeText(content)
  ElMessage.success('消息已复制')
}

function sendQuickAction(prompt: string) {
  inputMessage.value = prompt
  sendMessage()
}

function handleKeydown(event: Event | KeyboardEvent) {
  const keyEvent = event as KeyboardEvent
  if (keyEvent.ctrlKey && keyEvent.key === 'Enter') {
    event.preventDefault()
    sendMessage()
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

function renderMarkdown(text: string): string {
  // 增强的 Markdown 渲染，支持语法高亮
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const langClass = lang ? `language-${lang}` : ''
      const langLabel = lang ? `<span class="code-lang">${lang}</span>` : ''
      return `<div class="code-block">${langLabel}<pre><code class="${langClass}">${escapeHtml(code)}</code></pre></div>`
    })
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatJson(str: string): string {
  try {
    const obj = typeof str === 'string' ? JSON.parse(str) : str
    return JSON.stringify(obj, null, 2)
  } catch {
    return str
  }
}

// 导出功能
function handleExport(format: string) {
  if (messages.value.length === 0) {
    ElMessage.warning('没有可导出的对话')
    return
  }

  let content = ''
  let filename = `serverhub-chat-${new Date().toISOString().split('T')[0]}`
  let mimeType = 'text/plain'

  switch (format) {
    case 'markdown':
      content = exportAsMarkdown()
      filename += '.md'
      mimeType = 'text/markdown'
      break
    case 'json':
      content = exportAsJson()
      filename += '.json'
      mimeType = 'application/json'
      break
    case 'txt':
      content = exportAsText()
      filename += '.txt'
      break
  }

  downloadFile(content, filename, mimeType)
  ElMessage.success('对话已导出')
}

function exportAsMarkdown(): string {
  let md = '# ServerHub AI 对话记录\n\n'
  md += `导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`
  md += '---\n\n'

  for (const msg of messages.value) {
    const role = msg.role === 'user' ? '👤 用户' : '🤖 AI 助手'
    const time = formatTime(msg.timestamp)
    md += `### ${role} (${time})\n\n`
    md += `${msg.content}\n\n`
  }

  return md
}

function exportAsJson(): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    messages: messages.value.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString()
    }))
  }, null, 2)
}

function exportAsText(): string {
  let text = 'ServerHub AI 对话记录\n'
  text += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`
  text += '='.repeat(50) + '\n\n'

  for (const msg of messages.value) {
    const role = msg.role === 'user' ? '用户' : 'AI 助手'
    const time = formatTime(msg.timestamp)
    text += `[${role}] (${time})\n`
    text += `${msg.content}\n\n`
  }

  return text
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style lang="scss" scoped>
.ai-assistant-page {
  height: 100%;
  display: flex;
  gap: 16px;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
  border-radius: 8px;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-color-overlay);

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .ai-icon {
      font-size: 24px;
      color: var(--el-color-primary);
    }

    h2 {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }

    .token-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
    }
  }

  .header-right {
    display: flex;
    gap: 8px;
    align-items: center;

    .model-select {
      width: 160px;
    }

    .server-select {
      width: 160px;
    }
  }
}

.model-option {
  display: flex;
  flex-direction: column;

  .model-name {
    font-weight: 500;
  }

  .model-desc {
    font-size: 11px;
    color: var(--text-secondary);
  }
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-message {
  text-align: center;
  padding: 60px 20px;

  .welcome-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  h3 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  p {
    color: var(--text-secondary);
    margin-bottom: 24px;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
}

.message {
  display: flex;
  gap: 12px;
  max-width: 85%;

  &.user {
    align-self: flex-end;
    flex-direction: row-reverse;

    .message-content {
      background: var(--el-color-primary);
      color: white;

      .message-header {
        .role-name, .message-time {
          color: rgba(255, 255, 255, 0.8);
        }

        .copy-btn {
          color: rgba(255, 255, 255, 0.8);
        }
      }

      .inline-code {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }
    }
  }

  &.assistant {
    align-self: flex-start;

    .message-content {
      background: var(--bg-color-overlay);
    }
  }

  .message-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .el-icon {
      font-size: 18px;
    }
  }

  .message-content {
    padding: 12px 16px;
    border-radius: 12px;
    min-width: 100px;

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 12px;
      gap: 8px;

      .role-name {
        font-weight: 600;
      }

      .message-time {
        color: var(--text-secondary);
      }

      .message-tokens {
        display: flex;
        align-items: center;
        gap: 2px;
        font-size: 11px;
        color: var(--text-secondary);
      }

      .message-actions {
        display: flex;
        gap: 2px;
        opacity: 0;
        transition: opacity 0.2s;

        .action-btn {
          padding: 4px;

          &.feedback-active {
            color: var(--el-color-success);

            &.negative {
              color: var(--el-color-danger);
            }
          }
        }
      }
    }

    &:hover .message-actions {
      opacity: 1;
    }

    .message-text {
      line-height: 1.6;
      word-break: break-word;

      :deep(.inline-code) {
        background: rgba(0, 0, 0, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Fira Code', monospace;
        font-size: 13px;
      }

      :deep(.code-block) {
        position: relative;
        margin: 12px 0;

        .code-lang {
          position: absolute;
          top: 8px;
          right: 12px;
          font-size: 11px;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        pre {
          background: #1e1e1e;
          padding: 16px;
          padding-top: 32px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 0;

          code {
            font-family: 'Fira Code', monospace;
            font-size: 13px;
            color: #d4d4d4;
            line-height: 1.5;
          }
        }
      }
    }
  }
}

.command-blocks {
  margin-top: 12px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;

  .command-block {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .command-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .command-label {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }

    .command-code {
      background: #1e1e1e;
      color: #4ec9b0;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Fira Code', monospace;
      font-size: 13px;
      margin: 0 0 12px 0;
      overflow-x: auto;
    }

    .command-actions {
      display: flex;
      gap: 8px;
    }

    .command-result {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border-color);

      .result-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 12px;
        color: var(--text-secondary);
      }

      .result-output {
        background: #1e1e1e;
        color: #d4d4d4;
        padding: 12px;
        border-radius: 6px;
        font-family: 'Fira Code', monospace;
        font-size: 12px;
        margin: 0;
        overflow-x: auto;
        max-height: 200px;
        overflow-y: auto;
      }
    }
  }
}

.tool-calls {
  margin-top: 12px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;

  .tool-call {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .tool-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;

      .tool-name {
        font-weight: 500;
        flex: 1;
      }

      .expand-icon {
        transition: transform 0.2s;
      }
    }

    .tool-details {
      padding: 0 12px 12px;

      .tool-section {
        margin-bottom: 8px;

        &:last-child {
          margin-bottom: 0;
        }

        .section-label {
          font-size: 12px;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 4px;
        }

        pre {
          background: rgba(0, 0, 0, 0.2);
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          overflow-x: auto;
          margin: 0;
        }
      }
    }
  }
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;

  span {
    width: 8px;
    height: 8px;
    background: var(--text-secondary);
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out;

    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}

.chat-input {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-color-overlay);

  .el-textarea {
    flex: 1;
  }

  .el-button {
    align-self: flex-end;
  }
}

.sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-shrink: 0;
  overflow-y: auto;
}

.sidebar-section {
  background: var(--bg-color);
  border-radius: 8px;
  padding: 16px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      margin: 0;
    }
  }

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text-secondary);
  }
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;

  .conversation-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--bg-color-overlay);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--el-color-primary-light-9);

      .conv-delete {
        opacity: 1;
      }

      .star-icon.unstarred {
        opacity: 1;
      }
    }

    &.active {
      background: var(--el-color-primary-light-8);
      border-left: 3px solid var(--el-color-primary);
    }

    .conv-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;

      .conv-title-row {
        display: flex;
        align-items: center;
        gap: 4px;

        .star-icon {
          font-size: 12px;
          color: var(--el-color-warning);
          cursor: pointer;

          &.unstarred {
            opacity: 0;
            color: var(--text-secondary);
          }
        }
      }

      .conv-title {
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .conv-date {
        font-size: 11px;
        color: var(--text-secondary);
      }
    }

    .conv-delete {
      opacity: 0;
      transition: opacity 0.2s;
    }
  }

  .no-conversations {
    text-align: center;
    padding: 16px;
    color: var(--text-secondary);
    font-size: 12px;
  }
}

.conversation-search {
  margin-bottom: 12px;
}

// 模板分类
.template-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;

  .category-tag {
    cursor: pointer;
    font-size: 11px;
  }
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;

  .template-item {
    padding: 8px 10px;
    background: var(--bg-color-overlay);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--el-color-primary-light-9);
    }

    .template-info {
      display: flex;
      flex-direction: column;

      .template-name {
        font-size: 13px;
        font-weight: 500;
      }

      .template-desc {
        font-size: 11px;
        color: var(--text-secondary);
      }
    }
  }
}

.command-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-color-overlay);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--el-color-primary-light-9);
  }

  .el-icon {
    font-size: 18px;
    color: var(--el-color-primary);
  }

  .command-info {
    display: flex;
    flex-direction: column;

    .command-name {
      font-weight: 500;
      font-size: 13px;
    }

    .command-desc {
      font-size: 11px;
      color: var(--text-secondary);
    }
  }
}

.context-info {
  .el-descriptions {
    --el-descriptions-item-bordered-label-background: var(--bg-color-overlay);
  }
}

.no-context {
  text-align: center;

  .hint {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 8px;
  }
}

.capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.confirm-dialog {
  .el-alert {
    margin-bottom: 16px;
  }

  .confirm-command {
    pre {
      background: #1e1e1e;
      color: #4ec9b0;
      padding: 16px;
      border-radius: 8px;
      font-family: 'Fira Code', monospace;
      font-size: 13px;
      margin: 0;
      overflow-x: auto;
    }
  }

  .confirm-server {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
}

// 命令面板样式
.command-palette-dialog {
  :deep(.el-dialog__header) {
    display: none;
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.command-palette {
  .palette-header {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);

    .el-input {
      :deep(.el-input__wrapper) {
        box-shadow: none;
        background: transparent;
      }
    }
  }

  .palette-commands {
    max-height: 400px;
    overflow-y: auto;

    .palette-command {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;

      &:hover, &.first {
        background: var(--el-color-primary-light-9);
      }

      .cmd-info {
        display: flex;
        flex-direction: column;

        .cmd-name {
          font-weight: 500;
          font-size: 14px;
        }

        .cmd-desc {
          font-size: 12px;
          color: var(--text-secondary);
        }
      }
    }

    .no-commands {
      padding: 24px;
      text-align: center;
      color: var(--text-secondary);
    }
  }

  .palette-footer {
    display: flex;
    justify-content: center;
    gap: 24px;
    padding: 12px;
    border-top: 1px solid var(--border-color);
    font-size: 12px;
    color: var(--text-secondary);

    kbd {
      background: var(--bg-color-overlay);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      margin-right: 4px;
    }
  }
}
</style>
