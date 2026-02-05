<template>
  <div class="plugin-page">
    <div v-if="loading" class="loading-container">
      <el-icon class="loading-icon"><Loading /></el-icon>
      <span>加载插件页面...</span>
    </div>

    <div v-else-if="error" class="error-container">
      <el-icon class="error-icon"><WarningFilled /></el-icon>
      <h3>加载失败</h3>
      <p>{{ error }}</p>
      <el-button type="primary" @click="retry">重试</el-button>
      <el-button @click="goBack">返回</el-button>
    </div>

    <div v-else-if="!plugin" class="not-found-container">
      <el-icon class="not-found-icon"><QuestionFilled /></el-icon>
      <h3>插件未找到</h3>
      <p>插件 "{{ pluginId }}" 未安装或未启用</p>
      <el-button type="primary" @click="goToPlugins">前往插件市场</el-button>
    </div>

    <template v-else>
      <!-- 插件页面头部 -->
      <div class="plugin-header">
        <div class="header-left">
          <el-button text @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <span class="plugin-icon">{{ plugin.icon || '📦' }}</span>
          <div class="plugin-info">
            <h2>{{ plugin.name }}</h2>
            <span class="plugin-version">v{{ plugin.version }}</span>
          </div>
        </div>
        <div class="header-right">
          <el-button size="small" @click="openConfig">
            <el-icon><Setting /></el-icon>
            配置
          </el-button>
          <el-button size="small" type="danger" @click="disablePlugin">
            禁用
          </el-button>
        </div>
      </div>

      <!-- 插件内容区域 -->
      <div class="plugin-content">
        <!-- 这里将渲染插件的 UI 组件 -->
        <component
          v-if="pluginComponent"
          :is="pluginComponent"
          :plugin-id="pluginId"
          :config="pluginConfig"
          :server-id="currentServerId"
        />

        <!-- 默认插件页面 -->
        <div v-else class="default-plugin-page">
          <div class="plugin-description">
            <h3>关于此插件</h3>
            <p>{{ plugin.description }}</p>
          </div>

          <div v-if="plugin.capabilities?.tools?.length" class="plugin-tools">
            <h3>提供的工具</h3>
            <div class="tools-grid">
              <div
                v-for="tool in plugin.capabilities.tools"
                :key="tool.name"
                class="tool-card"
              >
                <div class="tool-name">{{ tool.displayName || tool.name }}</div>
                <div class="tool-desc">{{ tool.description }}</div>
                <el-tag v-if="tool.dangerous" type="warning" size="small">危险操作</el-tag>
              </div>
            </div>
          </div>

          <div class="plugin-actions">
            <h3>快速操作</h3>
            <div class="actions-grid">
              <el-button @click="openConfig">
                <el-icon><Setting /></el-icon>
                插件配置
              </el-button>
              <el-button @click="viewLogs">
                <el-icon><Document /></el-icon>
                查看日志
              </el-button>
              <el-button @click="reloadPlugin">
                <el-icon><Refresh /></el-icon>
                重新加载
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 配置对话框 -->
    <el-dialog v-model="showConfigDialog" :title="`${plugin?.name} 配置`" width="500px">
      <div v-if="plugin" class="config-form">
        <el-form label-width="120px">
          <el-form-item
            v-for="(value, key) in pluginConfig"
            :key="key"
            :label="String(key)"
          >
            <el-switch v-if="typeof value === 'boolean'" v-model="pluginConfig[key]" />
            <el-input-number v-else-if="typeof value === 'number'" v-model="pluginConfig[key]" />
            <el-input v-else v-model="pluginConfig[key]" />
          </el-form-item>
        </el-form>
        <el-empty v-if="Object.keys(pluginConfig).length === 0" description="暂无配置项" />
      </div>
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePluginStore } from '@/stores/plugin'
import { useServerStore } from '@/stores/server'
import { ElMessage } from 'element-plus'
import {
  Loading,
  WarningFilled,
  QuestionFilled,
  ArrowLeft,
  Setting,
  Document,
  Refresh
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const pluginStore = usePluginStore()
const serverStore = useServerStore()

const loading = ref(true)
const error = ref<string | null>(null)
const pluginComponent = ref<unknown>(null)
const pluginConfig = ref<Record<string, unknown>>({})
const showConfigDialog = ref(false)

const pluginId = computed(() => route.params.pluginId as string)
const pageName = computed(() => route.params.page as string || 'index')
const plugin = computed(() => pluginStore.getPlugin(pluginId.value))
const currentServerId = computed(() => serverStore.currentServerId)

async function loadPlugin() {
  loading.value = true
  error.value = null

  try {
    if (!plugin.value) {
      loading.value = false
      return
    }

    // 加载插件配置
    pluginConfig.value = await pluginStore.getPluginConfig(pluginId.value)

    // 尝试加载插件的 UI 组件
    // 实际实现中，这里会从插件目录动态加载组件
    // 目前使用默认页面
    pluginComponent.value = null

  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function retry() {
  loadPlugin()
}

function goBack() {
  router.back()
}

function goToPlugins() {
  router.push('/plugins')
}

function openConfig() {
  showConfigDialog.value = true
}

async function saveConfig() {
  try {
    await pluginStore.setPluginConfig(pluginId.value, pluginConfig.value)
    ElMessage.success('配置已保存')
    showConfigDialog.value = false
  } catch (e) {
    ElMessage.error('保存配置失败: ' + (e as Error).message)
  }
}

async function disablePlugin() {
  try {
    await pluginStore.disablePlugin(pluginId.value)
    ElMessage.success('插件已禁用')
    router.push('/plugins')
  } catch (e) {
    ElMessage.error('禁用插件失败: ' + (e as Error).message)
  }
}

function viewLogs() {
  ElMessage.info('日志功能开发中')
}

async function reloadPlugin() {
  try {
    await pluginStore.disablePlugin(pluginId.value)
    await pluginStore.enablePlugin(pluginId.value)
    ElMessage.success('插件已重新加载')
    loadPlugin()
  } catch (e) {
    ElMessage.error('重新加载失败: ' + (e as Error).message)
  }
}

watch(pluginId, () => {
  loadPlugin()
})

onMounted(() => {
  loadPlugin()
})
</script>

<style lang="scss" scoped>
.plugin-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.loading-container,
.error-container,
.not-found-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;

  .loading-icon {
    font-size: 48px;
    color: var(--primary-color);
    animation: spin 1s linear infinite;
  }

  .error-icon,
  .not-found-icon {
    font-size: 64px;
    color: var(--warning-color);
  }

  h3 {
    margin: 0;
    font-size: 20px;
  }

  p {
    margin: 0;
    color: var(--text-secondary);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .plugin-icon {
      font-size: 32px;
    }

    .plugin-info {
      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .plugin-version {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }
  }

  .header-right {
    display: flex;
    gap: 8px;
  }
}

.plugin-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.default-plugin-page {
  max-width: 800px;
  margin: 0 auto;

  h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .plugin-description {
    margin-bottom: 32px;

    p {
      color: var(--text-secondary);
      line-height: 1.6;
    }
  }

  .plugin-tools {
    margin-bottom: 32px;

    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }

    .tool-card {
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background-color: var(--bg-secondary);

      .tool-name {
        font-weight: 600;
        margin-bottom: 8px;
      }

      .tool-desc {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }
    }
  }

  .plugin-actions {
    .actions-grid {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
  }
}

.config-form {
  max-height: 400px;
  overflow-y: auto;
}
</style>
