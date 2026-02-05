<template>
  <div class="task-plan" :class="plan.status">
    <!-- 计划头部 -->
    <div class="plan-header">
      <div class="plan-title">
        <el-icon class="plan-icon"><List /></el-icon>
        <span>任务规划</span>
        <el-tag :type="statusType" size="small" effect="plain">
          {{ statusText }}
        </el-tag>
      </div>
      <div class="plan-goal">{{ plan.goal }}</div>
    </div>

    <!-- 步骤列表 -->
    <div class="plan-steps">
      <div
        v-for="(step, index) in plan.steps"
        :key="step.id"
        class="plan-step"
        :class="step.status"
      >
        <!-- 步骤指示器 -->
        <div class="step-indicator">
          <div class="step-line top" v-if="index > 0"></div>
          <div class="step-dot">
            <el-icon v-if="step.status === 'completed'" class="completed">
              <Check />
            </el-icon>
            <el-icon v-else-if="step.status === 'failed'" class="failed">
              <Close />
            </el-icon>
            <el-icon v-else-if="step.status === 'in_progress'" class="in-progress">
              <Loading />
            </el-icon>
            <span v-else class="step-number">{{ index + 1 }}</span>
          </div>
          <div class="step-line bottom" v-if="index < plan.steps.length - 1"></div>
        </div>

        <!-- 步骤内容 -->
        <div class="step-content">
          <div class="step-description">{{ step.description }}</div>
          <div v-if="step.toolCalls && step.toolCalls.length > 0" class="step-tools">
            <el-tag
              v-for="tool in step.toolCalls"
              :key="tool"
              size="small"
              type="info"
              effect="plain"
            >
              {{ tool }}
            </el-tag>
          </div>
          <div v-if="step.result" class="step-result" :class="step.status">
            {{ step.result }}
          </div>
        </div>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="plan-progress">
      <el-progress
        :percentage="progressPercentage"
        :status="progressStatus"
        :stroke-width="6"
        :show-text="false"
      />
      <span class="progress-text">
        {{ completedSteps }} / {{ plan.steps.length }} 步骤完成
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { List, Check, Close, Loading } from '@element-plus/icons-vue'
import type { TaskPlan } from '@/stores/ai'

interface Props {
  plan: TaskPlan
}

const props = defineProps<Props>()

// 状态类型映射
const statusType = computed(() => {
  switch (props.plan.status) {
    case 'planning':
      return 'info'
    case 'executing':
      return 'warning'
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    default:
      return 'info'
  }
})

// 状态文本
const statusText = computed(() => {
  switch (props.plan.status) {
    case 'planning':
      return '规划中'
    case 'executing':
      return '执行中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return props.plan.status
  }
})

// 已完成步骤数
const completedSteps = computed(() => {
  return props.plan.steps.filter(s => s.status === 'completed').length
})

// 进度百分比
const progressPercentage = computed(() => {
  if (props.plan.steps.length === 0) return 0
  return Math.round((completedSteps.value / props.plan.steps.length) * 100)
})

// 进度条状态
const progressStatus = computed(() => {
  if (props.plan.status === 'failed') return 'exception'
  if (props.plan.status === 'completed') return 'success'
  return undefined
})
</script>

<style lang="scss" scoped>
.task-plan {
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  overflow: hidden;

  &.completed {
    border-color: var(--success-color);
  }

  &.failed {
    border-color: var(--danger-color);
  }

  &.executing {
    border-color: var(--warning-color);
  }
}

.plan-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);

  .plan-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;

    .plan-icon {
      font-size: 16px;
      color: var(--primary-color);
    }

    span {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary);
    }
  }

  .plan-goal {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.4;
  }
}

.plan-steps {
  padding: 16px;
}

.plan-step {
  display: flex;
  gap: 12px;

  &:not(:last-child) {
    padding-bottom: 16px;
  }

  &.completed {
    .step-description {
      color: var(--text-secondary);
    }
  }

  &.in_progress {
    .step-description {
      color: var(--primary-color);
      font-weight: 500;
    }
  }

  &.failed {
    .step-description {
      color: var(--danger-color);
    }
  }
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
  flex-shrink: 0;

  .step-line {
    width: 2px;
    flex: 1;
    background-color: var(--border-color);

    &.top {
      margin-bottom: 4px;
    }

    &.bottom {
      margin-top: 4px;
    }
  }

  .step-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: var(--bg-tertiary);
    border: 2px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);

    .el-icon {
      font-size: 14px;

      &.completed {
        color: var(--success-color);
      }

      &.failed {
        color: var(--danger-color);
      }

      &.in-progress {
        color: var(--primary-color);
        animation: spin 1s linear infinite;
      }
    }

    .step-number {
      font-size: 11px;
    }
  }

  .plan-step.completed & .step-dot {
    border-color: var(--success-color);
    background-color: rgba(var(--success-color-rgb), 0.1);
  }

  .plan-step.in_progress & .step-dot {
    border-color: var(--primary-color);
    background-color: rgba(var(--primary-color-rgb), 0.1);
  }

  .plan-step.failed & .step-dot {
    border-color: var(--danger-color);
    background-color: rgba(var(--danger-color-rgb), 0.1);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.step-content {
  flex: 1;
  min-width: 0;
  padding-top: 2px;

  .step-description {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
    margin-bottom: 6px;
  }

  .step-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;

    .el-tag {
      font-size: 11px;
    }
  }

  .step-result {
    font-size: 12px;
    color: var(--text-secondary);
    background-color: var(--bg-tertiary);
    padding: 6px 10px;
    border-radius: 4px;

    &.completed {
      color: var(--success-color);
    }

    &.failed {
      color: var(--danger-color);
    }
  }
}

.plan-progress {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
  display: flex;
  align-items: center;
  gap: 12px;

  .el-progress {
    flex: 1;
  }

  .progress-text {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
  }
}
</style>
