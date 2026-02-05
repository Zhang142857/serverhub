<template>
  <div class="task-panel-wrapper">
    <!-- 任务按钮 - 固定在右上角 -->
    <div 
      class="task-trigger" 
      :class="{ active: showTaskPanel, 'has-running': hasRunningTasks }"
      @click="togglePanel"
      v-if="tasks.length > 0"
    >
      <el-badge :value="runningTasks.length" :hidden="runningTasks.length === 0" type="danger">
        <el-icon class="trigger-icon"><Monitor /></el-icon>
      </el-badge>
      <span class="trigger-text" v-if="hasRunningTasks">
        {{ runningTasks[0]?.name }}
      </span>
    </div>

    <!-- 任务面板 - 屏幕中央 -->
    <Teleport to="body">
      <Transition name="fade">
        <div class="task-overlay" v-if="showTaskPanel && tasks.length > 0" @click.self="togglePanel">
          <div class="task-panel">
            <div class="panel-header">
              <div class="header-title">
                <el-icon><Monitor /></el-icon>
                <span>任务管理</span>
                <el-tag v-if="hasRunningTasks" type="warning" size="small">{{ runningTasks.length }} 运行中</el-tag>
              </div>
              <div class="header-actions">
                <el-button text size="small" @click="clearCompletedTasks" :disabled="!hasCompletedTasks">
                  清除已完成
                </el-button>
                <el-button text size="small" @click="togglePanel">
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
            </div>

            <div class="panel-body">
              <!-- 任务列表 -->
              <div class="task-list">
                <div 
                  v-for="task in tasks" 
                  :key="task.id" 
                  class="task-item"
                  :class="{ active: selectedTaskId === task.id, [task.status]: true }"
                  @click="selectedTaskId = task.id"
                >
                  <div class="task-icon">
                    <el-icon v-if="task.status === 'running'" class="is-loading"><Loading /></el-icon>
                    <el-icon v-else-if="task.status === 'success'" class="success"><CircleCheck /></el-icon>
                    <el-icon v-else-if="task.status === 'failed'" class="failed"><CircleClose /></el-icon>
                    <el-icon v-else class="cancelled"><Warning /></el-icon>
                  </div>
                  <div class="task-info">
                    <div class="task-name">{{ task.name }}</div>
                    <div class="task-progress" v-if="task.status === 'running'">
                      <el-progress :percentage="task.progress" :show-text="false" :stroke-width="3" />
                    </div>
                    <div class="task-time" v-else>
                      {{ formatDuration(task.endTime! - task.startTime) }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- 日志区域 -->
              <div class="task-log" v-if="selectedTask">
                <div class="log-header">
                  <span>{{ selectedTask.name }}</span>
                  <el-button 
                    v-if="selectedTask.status === 'running'" 
                    text 
                    type="danger" 
                    size="small"
                    @click="cancelTask(selectedTask.id)"
                  >
                    取消
                  </el-button>
                </div>
                <div class="log-content" ref="logContainer">
                  <pre>{{ selectedTask.log }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/task'
import { Monitor, Close, Loading, CircleCheck, CircleClose, Warning } from '@element-plus/icons-vue'

const taskStore = useTaskStore()
const { tasks, showTaskPanel, selectedTaskId, runningTasks, hasRunningTasks, selectedTask } = storeToRefs(taskStore)
const { togglePanel, clearCompletedTasks, cancelTask } = taskStore

const logContainer = ref<HTMLElement | null>(null)

const hasCompletedTasks = computed(() => tasks.value.some(t => t.status !== 'running'))

// 监听日志变化，自动滚动到底部
watch(() => selectedTask.value?.log, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
})

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}
</script>

<style lang="scss" scoped>
.task-panel-wrapper {
  position: fixed;
  top: 60px;
  right: 20px;
  z-index: 2000;
}

.task-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover, &.active {
    border-color: var(--primary-color);
    background: var(--bg-tertiary);
  }
  
  &.has-running {
    border-color: var(--success-color);
    .trigger-icon { color: var(--success-color); }
  }
  
  .trigger-icon {
    font-size: 18px;
    color: var(--text-secondary);
  }
  
  .trigger-text {
    font-size: 12px;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// 遮罩层
.task-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.task-panel {
  width: 700px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  
  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    font-size: 14px;
  }
  
  .header-actions {
    display: flex;
    gap: 4px;
  }
}

.panel-body {
  display: flex;
  flex: 1;
  min-height: 0;
  height: 400px;
}

.task-list {
  width: 200px;
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  flex-shrink: 0;
  background: var(--bg-tertiary);
  
  .task-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    cursor: pointer;
    border-bottom: 1px solid var(--border-color);
    transition: background 0.15s;
    
    &:hover { background: var(--bg-secondary); }
    &.active { 
      background: var(--bg-secondary); 
      border-left: 3px solid var(--primary-color);
      padding-left: 11px;
    }
    
    .task-icon {
      font-size: 16px;
      flex-shrink: 0;
      .is-loading { color: var(--warning-color); }
      .success { color: var(--success-color); }
      .failed { color: var(--danger-color); }
      .cancelled { color: var(--warning-color); }
    }
    
    .task-info {
      flex: 1;
      min-width: 0;
      
      .task-name {
        font-size: 12px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text-color);
      }
      
      .task-progress {
        margin-top: 6px;
      }
      
      .task-time {
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 4px;
      }
    }
  }
}

.task-log {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  
  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-color);
  }
  
  .log-content {
    flex: 1;
    overflow: auto;
    background: #0d1117;
    padding: 14px;
    
    pre {
      margin: 0;
      font-size: 12px;
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      color: #c9d1d9;
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.6;
    }
  }
}

// 动画
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
