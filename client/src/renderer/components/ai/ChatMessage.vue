<template>
  <div class="chat-message" :class="[message.role, { streaming: message.isStreaming }]">
    <div class="message-avatar">
      <div v-if="message.role === 'user'" class="avatar user-avatar"><el-icon><User /></el-icon></div>
      <div v-else class="avatar ai-avatar"><el-icon><MagicStick /></el-icon></div>
    </div>

    <div class="message-body">
      <div class="message-header">
        <span class="role-name">{{ message.role === 'user' ? '你' : 'AI 助手' }}</span>
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
      </div>

      <!-- 按 parts 顺序渲染（新消息） -->
      <template v-if="message.parts?.length">
        <template v-for="(part, i) in message.parts" :key="i">
          <!-- 思考过程 -->
          <div v-if="part.type === 'thinking'" class="thinking-block" :class="{ collapsed: !thinkingExpanded }">
            <div class="thinking-header" @click="thinkingExpanded = !thinkingExpanded">
              <el-icon class="thinking-icon"><Loading v-if="message.isStreaming && isLastPart(i)" /><Sunny v-else /></el-icon>
              <span>{{ message.isStreaming && isLastPart(i) ? '思考中...' : '思考过程' }}</span>
              <span class="thinking-toggle">{{ thinkingExpanded ? '收起' : '展开' }}</span>
            </div>
            <div v-show="thinkingExpanded" class="thinking-content">{{ part.content }}</div>
          </div>

          <!-- 文本内容 -->
          <div v-else-if="part.type === 'text'" class="message-content" v-html="renderMarkdown(part.content || '')"></div>

          <!-- 工具调用（内联） -->
          <div v-else-if="part.type === 'tool-call'" class="inline-tool-call" :class="part.status">
            <div class="tool-header" @click="togglePartExpand(i)">
              <el-icon class="tool-icon"><Loading v-if="part.status === 'calling'" /><CircleCheck v-else-if="part.status === 'done'" /><CircleClose v-else /></el-icon>
              <span class="tool-name">{{ part.toolName }}</span>
              <span class="tool-status">{{ part.status === 'calling' ? '执行中...' : part.status === 'done' ? '完成' : '失败' }}</span>
              <el-icon class="expand-icon"><ArrowDown v-if="!expandedParts[i]" /><ArrowUp v-else /></el-icon>
            </div>
            <div v-if="expandedParts[i]" class="tool-detail">
              <div v-if="part.args" class="tool-section">
                <span class="section-label">参数</span>
                <pre>{{ JSON.stringify(part.args, null, 2) }}</pre>
              </div>
              <div v-if="part.result" class="tool-section">
                <span class="section-label">结果</span>
                <pre>{{ typeof part.result === 'string' ? part.result : JSON.stringify(part.result, null, 2) }}</pre>
              </div>
            </div>
          </div>

          <!-- 工具授权确认 -->
          <div v-else-if="part.type === 'tool-confirm'" class="inline-tool-call confirm">
            <div class="tool-header">
              <el-icon class="tool-icon"><Warning v-if="part.status === 'calling'" /><CircleCheck v-else-if="part.status === 'done'" /><CircleClose v-else /></el-icon>
              <span class="tool-name">{{ part.toolName }}</span>
              <span class="tool-status">{{ part.status === 'calling' ? '等待授权' : part.status === 'done' ? '已批准' : '已拒绝' }}</span>
            </div>
            <div v-if="part.args" class="tool-detail" style="display:block">
              <div class="tool-section"><span class="section-label">参数</span><pre>{{ JSON.stringify(part.args, null, 2) }}</pre></div>
            </div>
            <div v-if="part.status === 'calling'" class="confirm-actions">
              <el-button type="primary" size="small" @click="aiStore.confirmTool(part.confirmId!, true)">批准执行</el-button>
              <el-button type="danger" size="small" @click="aiStore.confirmTool(part.confirmId!, false)">拒绝</el-button>
            </div>
          </div>
        </template>
      </template>

      <!-- 兼容旧消息（无 parts） -->
      <template v-else>
        <div v-if="message.thinking" class="thinking-block" :class="{ collapsed: !thinkingExpanded }">
          <div class="thinking-header" @click="thinkingExpanded = !thinkingExpanded">
            <el-icon><Sunny /></el-icon>
            <span>思考过程</span>
            <span class="thinking-toggle">{{ thinkingExpanded ? '收起' : '展开' }}</span>
          </div>
          <div v-show="thinkingExpanded" class="thinking-content">{{ message.thinking }}</div>
        </div>
        <div v-if="message.content" class="message-content" v-html="renderMarkdown(message.content)"></div>
      </template>

      <!-- 流式光标 -->
      <span v-if="message.isStreaming" class="streaming-cursor">▋</span>

      <!-- 操作按钮 -->
      <div class="message-actions" v-if="message.role === 'assistant' && !message.isStreaming">
        <el-tooltip content="复制" placement="top"><el-button text size="small" @click="copyContent"><el-icon><CopyDocument /></el-icon></el-button></el-tooltip>
        <el-tooltip content="重新生成" placement="top"><el-button text size="small" @click="$emit('regenerate')"><el-icon><Refresh /></el-icon></el-button></el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { User, MagicStick, CopyDocument, Refresh, Loading, Sunny, CircleCheck, CircleClose, ArrowDown, ArrowUp, Warning } from '@element-plus/icons-vue'
import { useAIStore, type Message } from '@/stores/ai'

const aiStore = useAIStore()
const props = defineProps<{ message: Message }>()
defineEmits<{ regenerate: [] }>()

const thinkingExpanded = ref(false)
const expandedParts = reactive<Record<number, boolean>>({})

function isLastPart(index: number): boolean {
  return index === (props.message.parts?.length || 0) - 1
}

function togglePartExpand(index: number) {
  expandedParts[index] = !expandedParts[index]
}

function renderMarkdown(content: string): string {
  if (!content) return ''
  return content
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<div class="code-block"><div class="code-header"><span>${lang || 'code'}</span><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent);this.textContent='已复制';setTimeout(()=>this.textContent='复制',1500)">复制</button></div><pre><code class="lang-${lang}">${code.replace(/</g, '&lt;')}</code></pre></div>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n/g, '<br>')
}

function formatTime(date: Date): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function copyContent() {
  navigator.clipboard.writeText(props.message.content)
  ElMessage.success('已复制')
}
</script>

<style lang="scss" scoped>
.chat-message {
  display: flex; gap: 14px; padding: 20px 24px;
  transition: background-color 0.2s ease;
  animation: messageSlideIn 0.3s ease-out;
  &:hover { background-color: rgba(255,255,255,0.02); }
  &:hover .message-actions { opacity: 1; }
  &.streaming { .message-body { position: relative; } }
}

@keyframes messageSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.avatar {
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.user-avatar { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
.ai-avatar { background: linear-gradient(135deg, #10b981, #06b6d4); color: #fff; }

.message-body { flex: 1; min-width: 0; }

.message-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
  .role-name { font-weight: 600; font-size: 13px; color: var(--text-color); }
  .message-time { font-size: 11px; color: var(--text-muted); }
}

// 思考过程块
.thinking-block {
  margin: 8px 0; border-radius: 10px; overflow: hidden;
  border: 1px solid rgba(245, 158, 11, 0.2);
  background: rgba(245, 158, 11, 0.04);
  transition: all 0.3s ease;

  .thinking-header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; cursor: pointer; font-size: 12px;
    color: #f59e0b; user-select: none;
    transition: background 0.15s;
    &:hover { background: rgba(245, 158, 11, 0.08); }
  }
  .thinking-icon {
    animation: none;
    .streaming & { animation: thinkPulse 1.5s ease-in-out infinite; }
  }
  .thinking-toggle { margin-left: auto; font-size: 11px; opacity: 0.7; }
  .thinking-content {
    padding: 0 14px 12px; font-size: 13px; line-height: 1.7;
    color: rgba(245, 158, 11, 0.7); white-space: pre-wrap; word-break: break-word;
    max-height: 300px; overflow-y: auto;
    animation: thinkExpand 0.25s ease-out;
  }
  &.collapsed .thinking-content { display: none; }
}

@keyframes thinkPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes thinkExpand {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 300px; }
}

// 内联工具调用
.inline-tool-call {
  margin: 10px 0; border-radius: 10px; overflow: hidden;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
  transition: all 0.3s ease;
  animation: toolSlideIn 0.25s ease-out;

  &.calling {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(99, 102, 241, 0.04);
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.1);
  }
  &.done {
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.03);
  }
  &.error {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.03);
  }

  .tool-header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; cursor: pointer; font-size: 13px;
    transition: background 0.15s;
    &:hover { background: rgba(255,255,255,0.03); }
  }
  .tool-icon {
    font-size: 14px; transition: color 0.3s;
    .calling & { color: #6366f1; animation: toolSpin 1s linear infinite; }
    .done & { color: #10b981; }
    .error & { color: #ef4444; }
  }
  .tool-name { font-weight: 500; color: var(--text-color); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .tool-status { margin-left: auto; font-size: 11px; color: var(--text-muted); }
  .expand-icon { font-size: 12px; color: var(--text-muted); transition: transform 0.2s; }

  .tool-detail {
    border-top: 1px solid var(--border-color); padding: 10px 14px;
    animation: toolDetailExpand 0.2s ease-out;
    .tool-section { margin-bottom: 8px; &:last-child { margin-bottom: 0; } }
    .section-label { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    pre {
      margin: 0; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.2);
      font-size: 12px; line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-break: break-all;
      font-family: 'JetBrains Mono', monospace; color: var(--text-secondary);
      max-height: 200px; overflow-y: auto;
    }
  }
}

@keyframes toolSlideIn {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes toolSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes toolDetailExpand {
  from { opacity: 0; }
  to { opacity: 1; }
}

// 消息正文
.message-content {
  font-size: 14px; line-height: 1.75; color: var(--text-color); word-break: break-word;

  :deep(.code-block) {
    margin: 10px 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--border-color);
    .code-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 14px; background: var(--bg-elevated); font-size: 12px; color: var(--text-secondary);
    }
    .copy-btn {
      background: none; border: 1px solid var(--border-color); border-radius: 4px;
      padding: 2px 8px; font-size: 11px; color: var(--text-secondary); cursor: pointer;
      transition: all 0.15s;
      &:hover { color: var(--text-color); border-color: var(--text-muted); }
    }
    pre { margin: 0; padding: 14px; background: rgba(0,0,0,0.2); overflow-x: auto; }
    code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; background: none; padding: 0; }
  }
  :deep(code) {
    background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px;
  }
  :deep(h2), :deep(h3), :deep(h4) { margin: 14px 0 8px; font-weight: 600; }
  :deep(ul) { margin: 8px 0; padding-left: 20px; }
  :deep(li) { margin: 4px 0; }
  :deep(strong) { font-weight: 600; color: var(--text-color); }
}

.streaming-cursor {
  display: inline-block; color: #10b981; font-weight: bold;
  animation: cursorBlink 0.8s ease-in-out infinite;
}
@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.message-actions {
  display: flex; gap: 4px; margin-top: 8px; opacity: 0; transition: opacity 0.2s;
  .el-button { color: var(--text-muted); &:hover { color: var(--primary-color); } }
}
</style>

<style scoped>
.inline-tool-call.confirm {
  border-color: #e6a23c;
  background: rgba(230, 162, 60, 0.05);
}
.confirm-actions {
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  border-top: 1px solid rgba(230, 162, 60, 0.2);
}
</style>
