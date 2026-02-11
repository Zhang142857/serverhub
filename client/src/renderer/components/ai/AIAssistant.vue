<template>
  <Teleport to="body">
    <Transition name="slide">
      <div v-if="visible" class="ai-assistant">
        <div class="ai-header">
          <div class="ai-title">
            <div class="ai-logo">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/>
              </svg>
            </div>
            <span>AI 助手</span>
            <el-tag size="small" type="success">在线</el-tag>
          </div>
          <div class="header-actions">
            <el-tooltip content="清空对话" placement="bottom">
              <el-button text circle @click="clearMessages" :disabled="messages.length === 0">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="关闭 (Esc)" placement="bottom">
              <el-button text circle @click="close">
                <el-icon><Close /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>

        <!-- 欢迎界面 -->
        <div v-if="messages.length === 0" class="ai-welcome">
          <div class="welcome-icon">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="8" width="40" height="32" rx="4" fill="url(#ai-grad)" />
              <circle cx="16" cy="22" r="3" fill="#fff" />
              <circle cx="32" cy="22" r="3" fill="#fff" />
              <path d="M16 32c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#fff" stroke-width="2" stroke-linecap="round" />
              <defs>
                <linearGradient id="ai-grad" x1="4" y1="8" x2="44" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#6366f1" />
                  <stop offset="1" stop-color="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h3>你好，我是 Runixo AI 助手</h3>
          <p>我可以帮助你管理服务器、分析日志、生成配置文件等。试试下面的快捷指令开始吧！</p>
          <div class="capability-cards">
            <div class="capability-card" v-for="cap in capabilities" :key="cap.title" @click="useSuggestion(cap.prompt)">
              <div class="cap-icon">
                <component :is="cap.icon" />
              </div>
              <div class="cap-info">
                <div class="cap-title">{{ cap.title }}</div>
                <div class="cap-desc">{{ cap.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 消息列表 -->
        <div v-else class="ai-messages" ref="messagesContainer">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="message"
            :class="msg.role"
          >
            <div class="message-avatar">
              <el-icon v-if="msg.role === 'assistant'"><Robot /></el-icon>
              <el-icon v-else><User /></el-icon>
            </div>
            <div class="message-content">
              <div class="message-text" v-html="formatMessage(msg.content)"></div>
              <div class="message-footer">
                <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
                <el-button v-if="msg.role === 'assistant'" text size="small" @click="copyMessage(msg.content)">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </div>
            </div>
          </div>

          <div v-if="isLoading" class="message assistant">
            <div class="message-avatar">
              <el-icon class="animate-spin"><Loading /></el-icon>
            </div>
            <div class="message-content">
              <div class="message-text typing">{{ streamingContent || '思考中...' }}</div>
            </div>
          </div>
        </div>

        <div class="ai-input">
          <el-input
            v-model="inputMessage"
            type="textarea"
            :rows="2"
            placeholder="输入消息，例如：帮我重启所有nginx容器 (Ctrl+K 打开/关闭)"
            resize="none"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <el-button
            type="primary"
            :disabled="!inputMessage.trim() || isLoading"
            @click="sendMessage"
          >
            <el-icon><Promotion /></el-icon>
          </el-button>
        </div>

        <div class="ai-suggestions">
          <span class="suggestion-label">快捷指令：</span>
          <div class="suggestion-tags">
            <el-tag
              v-for="suggestion in suggestions"
              :key="suggestion"
              class="suggestion-tag"
              @click="useSuggestion(suggestion)"
            >
              {{ suggestion }}
            </el-tag>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Close,
  User,
  Promotion,
  Loading,
  Delete,
  CopyDocument,
  Monitor,
  Box,
  Document,
  Setting,
  Lock,
  TrendCharts
} from '@element-plus/icons-vue'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Capability {
  icon: any
  title: string
  desc: string
  prompt: string
}

const visible = ref(false)
const inputMessage = ref('')
const messages = ref<Message[]>([])
const isLoading = ref(false)
const streamingContent = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

const suggestions = [
  '查看系统状态',
  '列出所有容器',
  '分析错误日志',
  '生成nginx配置',
  '检查磁盘空间',
  '查看网络连接'
]

const capabilities: Capability[] = [
  { icon: Monitor, title: '系统监控', desc: '查看 CPU、内存、磁盘使用情况', prompt: '查看当前服务器的系统状态' },
  { icon: Box, title: '容器管理', desc: '管理 Docker 容器和镜像', prompt: '列出所有运行中的容器' },
  { icon: Document, title: '日志分析', desc: '分析系统和应用日志', prompt: '分析最近的错误日志' },
  { icon: Setting, title: '配置生成', desc: '生成 Nginx、Docker 等配置', prompt: '帮我生成一个 nginx 反向代理配置' },
  { icon: Lock, title: '安全检查', desc: '检查系统安全配置', prompt: '检查服务器的安全配置' },
  { icon: TrendCharts, title: '性能优化', desc: '分析和优化系统性能', prompt: '分析系统性能并给出优化建议' }
]

// 自定义 Robot 图标组件
const Robot = {
  template: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/></svg>`
}

function open() {
  visible.value = true
}

function close() {
  visible.value = false
}

function toggle() {
  visible.value = !visible.value
}

async function clearMessages() {
  if (messages.value.length === 0) return
  try {
    await ElMessageBox.confirm('确定要清空所有对话记录吗？', '确认', { type: 'warning' })
    messages.value = []
    ElMessage.success('对话已清空')
  } catch {
    // 用户取消
  }
}

function copyMessage(content: string) {
  navigator.clipboard.writeText(content).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
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
  streamingContent.value = ''

  await scrollToBottom()

  try {
    // 模拟 AI 响应（实际项目中会调用真实 API）
    const response = await simulateAIResponse(content)

    // 添加助手消息
    messages.value.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    })
  } catch (error) {
    messages.value.push({
      role: 'assistant',
      content: `抱歉，发生了错误：${(error as Error).message}`,
      timestamp: new Date()
    })
  } finally {
    isLoading.value = false
    streamingContent.value = ''
    await scrollToBottom()
  }
}

// 模拟 AI 响应
async function simulateAIResponse(query: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1000))

  const lowerQuery = query.toLowerCase()

  if (lowerQuery.includes('系统状态') || lowerQuery.includes('系统信息')) {
    return `## 系统状态概览

**CPU 使用率**: 45.2%
**内存使用**: 6.8 GB / 16 GB (42.5%)
**磁盘使用**: 128 GB / 500 GB (25.6%)
**系统负载**: 1.25, 1.18, 1.05

### 进程统计
- 运行中进程: 156
- 僵尸进程: 0
- 线程总数: 892

系统运行正常，资源使用率处于健康水平。`
  }

  if (lowerQuery.includes('容器') || lowerQuery.includes('docker')) {
    return `## 容器列表

| 容器名称 | 状态 | CPU | 内存 |
|---------|------|-----|------|
| nginx-proxy | 运行中 | 0.5% | 128MB |
| mysql-db | 运行中 | 2.1% | 512MB |
| redis-cache | 运行中 | 0.2% | 64MB |
| app-backend | 运行中 | 5.3% | 256MB |

共 **4** 个容器运行中，**0** 个已停止。

需要我对某个容器执行操作吗？`
  }

  if (lowerQuery.includes('日志') || lowerQuery.includes('错误')) {
    return `## 日志分析结果

### 最近 1 小时错误统计
- **ERROR**: 3 条
- **WARNING**: 12 条
- **INFO**: 1,256 条

### 主要错误
1. \`[nginx] upstream timed out\` - 2 次
2. \`[mysql] Too many connections\` - 1 次

### 建议
- 检查上游服务响应时间
- 考虑增加 MySQL 最大连接数配置

需要我查看详细的错误日志吗？`
  }

  if (lowerQuery.includes('nginx') && lowerQuery.includes('配置')) {
    return `## Nginx 反向代理配置

\`\`\`nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

这是一个基础的反向代理配置，将请求转发到本地 3000 端口。需要我根据你的具体需求调整吗？`
  }

  if (lowerQuery.includes('磁盘') || lowerQuery.includes('空间')) {
    return `## 磁盘空间使用情况

| 挂载点 | 总容量 | 已用 | 可用 | 使用率 |
|-------|-------|------|------|--------|
| / | 500GB | 128GB | 372GB | 25.6% |
| /home | 1TB | 456GB | 544GB | 45.6% |
| /var | 200GB | 89GB | 111GB | 44.5% |

### 大文件分析
- \`/var/log/syslog\`: 2.3GB
- \`/home/backup/db-2024.tar.gz\`: 15GB

磁盘空间充足，无需立即清理。`
  }

  if (lowerQuery.includes('安全') || lowerQuery.includes('检查')) {
    return `## 安全检查报告

### ✅ 通过项目
- SSH 密钥认证已启用
- 防火墙已启用
- 系统已更新到最新版本

### ⚠️ 警告项目
- 发现 3 个端口对外开放 (22, 80, 443)
- 有 2 个用户超过 90 天未修改密码

### ❌ 需要关注
- root 用户允许 SSH 登录（建议禁用）

### 建议操作
1. 禁用 root SSH 登录
2. 更新过期用户密码
3. 检查开放端口是否必要`
  }

  return `我理解你的问题是关于 "${query}"。

作为 Runixo AI 助手，我可以帮助你：
- 查看和分析系统状态
- 管理 Docker 容器
- 分析日志和排查问题
- 生成各种配置文件
- 执行安全检查

请告诉我更具体的需求，我会尽力帮助你！`
}

function useSuggestion(suggestion: string) {
  inputMessage.value = suggestion
  sendMessage()
}

function formatMessage(content: string): string {
  // 增强的 Markdown 转换
  const escaped = escapeHtml(content)
  return escaped
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // 表格
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim())
      if (cells.every(c => c.trim().match(/^-+$/))) {
        return '<tr class="table-divider"></tr>'
      }
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
    })
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 粗体
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // 标题
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    // 列表
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // 换行
    .replace(/\n/g, '<br>')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 快捷键
function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    toggle()
  }
  if (e.key === 'Escape' && visible.value) {
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

defineExpose({ open, close, toggle })
</script>

<style lang="scss" scoped>
.ai-assistant {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 450px;
  background-color: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
}

.ai-header {
  height: var(--header-height);
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);

  .ai-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .ai-logo {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }
}

.ai-welcome {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  .welcome-icon {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
    
    svg {
      width: 100%;
      height: 100%;
    }
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  p {
    color: var(--text-secondary);
    font-size: 14px;
    margin-bottom: 24px;
    max-width: 320px;
  }

  .capability-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .capability-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background-color: var(--bg-tertiary);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;

    &:hover {
      background-color: var(--primary-color);
      color: white;

      .cap-desc {
        color: rgba(255, 255, 255, 0.8);
      }
    }

    .cap-icon {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      color: var(--primary-color);
      
      :deep(svg) {
        width: 100%;
        height: 100%;
      }
    }

    .cap-info {
      flex: 1;

      .cap-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 2px;
      }

      .cap-desc {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }
  }
}

.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  display: flex;
  gap: 12px;

  &.user {
    flex-direction: row-reverse;

    .message-content {
      align-items: flex-end;
    }

    .message-text {
      background-color: var(--primary-color);
      color: white;
    }
  }

  &.assistant {
    .message-text {
      background-color: var(--bg-tertiary);
    }
  }

  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .message-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 85%;
  }

  .message-text {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.6;

    &.typing {
      &::after {
        content: '|';
        animation: blink 1s infinite;
      }
    }

    :deep(h3) {
      font-size: 15px;
      font-weight: 600;
      margin: 12px 0 8px;
      &:first-child { margin-top: 0; }
    }

    :deep(h4) {
      font-size: 14px;
      font-weight: 600;
      margin: 10px 0 6px;
    }

    :deep(code) {
      background-color: rgba(0, 0, 0, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
    }

    :deep(pre) {
      background-color: #1e1e1e;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 8px 0;

      code {
        background: none;
        padding: 0;
        color: #d4d4d4;
      }
    }

    :deep(li) {
      margin: 4px 0;
      padding-left: 8px;
    }

    :deep(strong) {
      font-weight: 600;
    }

    :deep(td) {
      padding: 6px 10px;
      border-bottom: 1px solid var(--border-color);
    }

    :deep(tr:first-child td) {
      font-weight: 600;
      background-color: rgba(0, 0, 0, 0.1);
    }
  }

  .message-footer {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .message-time {
    font-size: 11px;
    color: var(--text-secondary);
  }
}

.ai-input {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 12px;

  :deep(.el-textarea__inner) {
    background-color: var(--bg-tertiary);
    border-color: var(--border-color);
    resize: none;
  }

  .el-button {
    align-self: flex-end;
  }
}

.ai-suggestions {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .suggestion-label {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .suggestion-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .suggestion-tag {
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background-color: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }
  }
}

// 动画
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
