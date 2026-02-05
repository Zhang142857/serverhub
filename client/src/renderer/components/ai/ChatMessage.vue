<template>
  <div class="chat-message" :class="[message.role, { streaming: message.isStreaming }]">
    <!-- 头像 -->
    <div class="message-avatar">
      <el-icon v-if="message.role === 'user'" class="user-icon"><User /></el-icon>
      <el-icon v-else class="ai-icon"><Magic /></el-icon>
    </div>

    <!-- 消息内容 -->
    <div class="message-body">
      <!-- 消息头部 -->
      <div class="message-header">
        <span class="role-name">{{ message.role === 'user' ? '你' : 'AI 助手' }}</span>
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
      </div>

      <!-- 消息正文 -->
      <div class="message-content" v-html="renderedContent"></div>

      <!-- 工具调用展示 -->
      <div v-if="message.toolCalls && message.toolCalls.length > 0" class="tool-calls">
        <ToolExecution
          v-for="(tool, index) in message.toolCalls"
          :key="index"
          :tool-call="tool"
          :expanded="tool.expanded"
          @toggle="toggleToolExpand(index)"
        />
      </div>

      <!-- 任务计划展示 -->
      <TaskPlan
        v-if="message.plan"
        :plan="message.plan"
        class="message-plan"
      />

      <!-- 消息操作 -->
      <div class="message-actions" v-if="message.role === 'assistant' && !message.isStreaming">
        <el-tooltip content="复制" placement="top">
          <el-button text size="small" @click="copyContent">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="重新生成" placement="top">
          <el-button text size="small" @click="$emit('regenerate')">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Magic, CopyDocument, Refresh } from '@element-plus/icons-vue'
import ToolExecution from './ToolExecution.vue'
import TaskPlan from './TaskPlan.vue'
import type { Message, ToolCallRecord, TaskPlan as TaskPlanType } from '@/stores/ai'

interface Props {
  message: Message
}

const props = defineProps<Props>()

defineEmits<{
  regenerate: []
}>()

// 渲染 Markdown 内容
const renderedContent = computed(() => {
  return renderMarkdown(props.message.content)
})

// 简单的 Markdown 渲染
function renderMarkdown(content: string): string {
  if (!content) return ''

  return content
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 粗体
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // 标题
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // 列表
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // 换行
    .replace(/\n/g, '<br>')
}

// 格式化时间
function formatTime(date: Date): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 切换工具展开状态
function toggleToolExpand(index: number): void {
  if (props.message.toolCalls && props.message.toolCalls[index]) {
    props.message.toolCalls[index].expanded = !props.message.toolCalls[index].expanded
  }
}

// 复制内容
function copyContent(): void {
  navigator.clipboard.writeText(props.message.content)
  ElMessage.success('已复制到剪贴板')
}
</script>

<style lang="scss" scoped>
.chat-message {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--bg-tertiary);
  }

  &.user {
    .message-avatar {
      .user-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
      }
    }
  }

  &.assistant {
    .message-avatar {
      .ai-icon {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: #fff;
      }
    }
  }

  &.streaming {
    .message-content::after {
      content: '▋';
      animation: blink 1s infinite;
    }
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.message-avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;

  .el-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;

  .role-name {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
  }

  .message-time {
    font-size: 12px;
    color: var(--text-tertiary);
  }
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  word-break: break-word;

  :deep(pre) {
    background-color: var(--bg-tertiary);
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    overflow-x: auto;

    code {
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      background: none;
      padding: 0;
    }
  }

  :deep(code) {
    background-color: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
  }

  :deep(h2), :deep(h3), :deep(h4) {
    margin: 12px 0 8px;
    font-weight: 600;
  }

  :deep(ul) {
    margin: 8px 0;
    padding-left: 20px;
  }

  :deep(li) {
    margin: 4px 0;
  }

  :deep(strong) {
    font-weight: 600;
  }
}

.tool-calls {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-plan {
  margin-top: 12px;
}

.message-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s;

  .chat-message:hover & {
    opacity: 1;
  }

  .el-button {
    color: var(--text-secondary);

    &:hover {
      color: var(--primary-color);
    }
  }
}
</style>
