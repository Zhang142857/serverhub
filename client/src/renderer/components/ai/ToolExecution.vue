<template>
  <div
    class="tool-execution"
    :class="{
      expanded: expanded,
      success: toolCall.success,
      error: !toolCall.success,
      dangerous: isDangerous
    }"
  >
    <!-- 工具头部 -->
    <div class="tool-header" @click="$emit('toggle')">
      <div class="tool-info">
        <el-icon class="tool-icon">
          <component :is="toolIcon" />
        </el-icon>
        <span class="tool-name">{{ toolCall.displayName || toolCall.name }}</span>
        <el-tag
          :type="toolCall.success ? 'success' : 'danger'"
          size="small"
          effect="plain"
        >
          {{ toolCall.success ? '成功' : '失败' }}
        </el-tag>
        <el-tag v-if="isDangerous" type="warning" size="small" effect="plain">
          危险操作
        </el-tag>
      </div>
      <div class="tool-meta">
        <span v-if="toolCall.duration" class="duration">
          {{ formatDuration(toolCall.duration) }}
        </span>
        <el-icon class="expand-icon">
          <ArrowDown v-if="!expanded" />
          <ArrowUp v-else />
        </el-icon>
      </div>
    </div>

    <!-- 工具详情 -->
    <div v-if="expanded" class="tool-detail">
      <!-- 参数 -->
      <div class="detail-section">
        <div class="detail-label">
          <el-icon><Setting /></el-icon>
          参数
        </div>
        <pre class="detail-content">{{ formatJson(toolCall.arguments) }}</pre>
      </div>

      <!-- 结果 -->
      <div class="detail-section">
        <div class="detail-label">
          <el-icon><Document /></el-icon>
          结果
        </div>
        <pre class="detail-content" :class="{ error: !toolCall.success }">{{ formatResult(toolCall.result) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  Setting,
  Document,
  Monitor,
  Box,
  FolderOpened,
  Terminal,
  Connection,
  Cpu,
  Warning
} from '@element-plus/icons-vue'
import type { ToolCallRecord } from '@/stores/ai'

interface Props {
  toolCall: ToolCallRecord
  expanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  expanded: false
})

defineEmits<{
  toggle: []
}>()

// 危险工具列表
const dangerousTools = [
  'execute_command',
  'write_file',
  'delete_file',
  'container_action',
  'service_action',
  'kill_process',
  'remove_image',
  'chmod',
  'move_file',
  'copy_file',
  'exec_container'
]

// 是否是危险操作
const isDangerous = computed(() => {
  return dangerousTools.includes(props.toolCall.name)
})

// 工具图标映射
const toolIconMap: Record<string, unknown> = {
  // 系统工具
  get_system_info: Monitor,
  execute_command: Terminal,
  list_services: Setting,
  service_action: Setting,
  list_processes: Cpu,
  kill_process: Cpu,
  get_system_logs: Document,
  get_disk_usage: Monitor,
  // Docker 工具
  list_containers: Box,
  container_action: Box,
  container_logs: Box,
  list_images: Box,
  pull_image: Box,
  remove_image: Box,
  list_networks: Connection,
  list_volumes: Box,
  exec_container: Terminal,
  container_stats: Box,
  // 文件工具
  list_directory: FolderOpened,
  read_file: Document,
  write_file: Document,
  delete_file: FolderOpened,
  search_files: FolderOpened,
  grep_files: Document,
  file_info: Document,
  copy_file: FolderOpened,
  move_file: FolderOpened,
  create_directory: FolderOpened,
  chmod: FolderOpened
}

// 获取工具图标
const toolIcon = computed(() => {
  return toolIconMap[props.toolCall.name] || Terminal
})

// 格式化 JSON
function formatJson(obj: unknown): string {
  try {
    if (typeof obj === 'string') {
      return obj
    }
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

// 格式化结果
function formatResult(result: unknown): string {
  if (result === null || result === undefined) {
    return '(无结果)'
  }

  try {
    if (typeof result === 'string') {
      // 如果是长字符串，截断显示
      if (result.length > 2000) {
        return result.substring(0, 2000) + '\n... (内容已截断)'
      }
      return result
    }
    const json = JSON.stringify(result, null, 2)
    if (json.length > 2000) {
      return json.substring(0, 2000) + '\n... (内容已截断)'
    }
    return json
  } catch {
    return String(result)
  }
}

// 格式化持续时间
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<style lang="scss" scoped>
.tool-execution {
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  overflow: hidden;
  transition: all 0.2s;

  &.success {
    border-left: 3px solid var(--success-color);
  }

  &.error {
    border-left: 3px solid var(--danger-color);
  }

  &.dangerous {
    .tool-icon {
      color: var(--warning-color);
    }
  }

  &.expanded {
    .tool-header {
      border-bottom: 1px solid var(--border-color);
    }
  }
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--bg-tertiary);
  }
}

.tool-info {
  display: flex;
  align-items: center;
  gap: 8px;

  .tool-icon {
    font-size: 16px;
    color: var(--primary-color);
  }

  .tool-name {
    font-weight: 500;
    font-size: 13px;
    color: var(--text-primary);
  }
}

.tool-meta {
  display: flex;
  align-items: center;
  gap: 8px;

  .duration {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .expand-icon {
    font-size: 14px;
    color: var(--text-secondary);
    transition: transform 0.2s;
  }
}

.tool-detail {
  padding: 12px;
  background-color: var(--bg-tertiary);
}

.detail-section {
  &:not(:last-child) {
    margin-bottom: 12px;
  }

  .detail-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;

    .el-icon {
      font-size: 14px;
    }
  }

  .detail-content {
    background-color: var(--bg-secondary);
    border-radius: 6px;
    padding: 10px;
    margin: 0;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-primary);
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;

    &.error {
      color: var(--danger-color);
    }
  }
}
</style>
