<template>
  <div class="cloud-page">
    <div class="page-header animate-fade-in">
      <h1>云服务集成</h1>
      <p class="subtitle">通过插件扩展云服务管理能力</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card animate-slide-up" :style="{ animationDelay: '0.1s' }">
        <div class="stat-icon installed"><el-icon><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <span class="stat-value">{{ installedCloudPlugins.length }}</span>
          <span class="stat-label">已安装</span>
        </div>
      </div>
      <div class="stat-card animate-slide-up" :style="{ animationDelay: '0.15s' }">
        <div class="stat-icon connected"><el-icon><Link /></el-icon></div>
        <div class="stat-info">
          <span class="stat-value">{{ connectedCount }}</span>
          <span class="stat-label">已连接</span>
        </div>
      </div>
      <div class="stat-card animate-slide-up" :style="{ animationDelay: '0.2s' }">
        <div class="stat-icon available"><el-icon><Cloudy /></el-icon></div>
        <div class="stat-info">
          <span class="stat-value">{{ cloudProviders.length }}</span>
          <span class="stat-label">可用服务</span>
        </div>
      </div>
    </div>

    <!-- 已安装的云服务插件 -->
    <div v-if="installedCloudPlugins.length > 0" class="section animate-fade-in" :style="{ animationDelay: '0.25s' }">
      <h2>已安装的云服务</h2>
      <div class="installed-plugins">
        <el-card
          v-for="(plugin, index) in installedCloudPlugins"
          :key="plugin.id"
          class="plugin-card installed animate-scale-in"
          :style="{ animationDelay: `${0.3 + index * 0.05}s` }"
          @click="openCloudService(plugin)"
        >
          <div class="card-header">
            <span class="plugin-emoji">{{ plugin.icon }}</span>
            <div class="plugin-title">
              <h3>{{ plugin.name }}</h3>
              <el-tag :type="plugin.connected ? 'success' : 'info'" size="small">
                {{ plugin.connected ? '已连接' : '未配置' }}
              </el-tag>
            </div>
            <el-dropdown @command="handlePluginAction($event, plugin)" trigger="click">
              <el-button text @click.stop>
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="open">打开</el-dropdown-item>
                  <el-dropdown-item command="config">配置</el-dropdown-item>
                  <el-dropdown-item command="disable" divided>禁用</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <p class="plugin-desc">{{ plugin.description }}</p>
          <div class="quick-actions" v-if="plugin.quickActions">
            <el-button
              v-for="action in plugin.quickActions"
              :key="action.name"
              size="small"
              @click.stop="executeQuickAction(plugin, action)"
            >
              {{ action.name }}
            </el-button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 可用的云服务插件 -->
    <div class="section animate-fade-in" :style="{ animationDelay: '0.35s' }">
      <h2>{{ installedCloudPlugins.length > 0 ? '添加更多云服务' : '选择云服务' }}</h2>
      <p class="section-desc">安装云服务插件以管理您的云资源</p>
      <div class="provider-grid">
        <el-card
          v-for="(provider, index) in availableProviders"
          :key="provider.id"
          class="provider-card animate-slide-up"
          :class="{ 'coming-soon': !provider.pluginAvailable }"
          :style="{ animationDelay: `${0.4 + index * 0.05}s` }"
        >
          <div class="provider-icon">{{ provider.icon }}</div>
          <div class="provider-info">
            <h3>{{ provider.name }}</h3>
            <p>{{ provider.description }}</p>
            <div class="provider-features">
              <el-tag v-for="feature in provider.features.slice(0, 3)" :key="feature" size="small" type="info">
                {{ feature }}
              </el-tag>
            </div>
          </div>
          <el-button
            v-if="provider.pluginAvailable"
            type="primary"
            size="small"
            @click="installCloudPlugin(provider)"
            :loading="installingPlugins.has(provider.pluginId)"
          >
            安装插件
          </el-button>
          <el-tag v-else type="info" size="small">即将推出</el-tag>
        </el-card>
      </div>
    </div>

    <!-- 快速配置（向后兼容） -->
    <div class="section legacy-section animate-fade-in" :style="{ animationDelay: '0.5s' }">
      <div class="section-header">
        <h2>快速配置</h2>
        <el-tag type="warning" size="small">传统模式</el-tag>
      </div>
      <p class="section-desc">直接配置云服务 API（不使用插件）</p>
      <div class="legacy-providers">
        <div
          v-for="(provider, index) in legacyProviders"
          :key="provider.id"
          class="legacy-item animate-scale-in"
          :style="{ animationDelay: `${0.55 + index * 0.03}s` }"
          @click="configureLegacy(provider)"
        >
          <span class="legacy-icon">{{ provider.icon }}</span>
          <span class="legacy-name">{{ provider.name }}</span>
          <el-tag v-if="provider.connected" type="success" size="small">已连接</el-tag>
          <el-icon class="arrow"><ArrowRight /></el-icon>
        </div>
      </div>
    </div>

    <!-- 配置对话框 -->
    <el-dialog v-model="showConfigDialog" :title="`连接 ${currentProvider?.name || ''}`" width="500px">
      <el-form v-if="currentProvider" label-width="120px">
        <el-form-item
          v-for="field in configFields[currentProvider.id] || []"
          :key="field.label"
          :label="field.label"
        >
          <el-input
            v-model="configForm[field.label]"
            :type="field.type"
            :placeholder="field.placeholder"
            :show-password="field.type === 'password'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">连接</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Link, Cloudy, MoreFilled, CircleCheck, ArrowRight } from '@element-plus/icons-vue'
import { usePluginStore } from '@/stores/plugin'

interface QuickAction {
  name: string
  action: string
  route?: string
}

interface CloudPlugin {
  id: string
  name: string
  description: string
  icon: string
  connected: boolean
  quickActions?: QuickAction[]
}

interface CloudProvider {
  id: string
  name: string
  description: string
  icon: string
  features: string[]
  pluginId?: string
  pluginAvailable: boolean
}

interface LegacyProvider {
  id: string
  name: string
  icon: string
  connected: boolean
}

const router = useRouter()
const pluginStore = usePluginStore()

const showConfigDialog = ref(false)
const currentProvider = ref<LegacyProvider | null>(null)
const configForm = ref<Record<string, string>>({})
const installingPlugins = ref<Set<string>>(new Set())

// 云服务提供商列表
const cloudProviders = ref<CloudProvider[]>([
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'DNS、CDN、WAF、SSL证书、Tunnel 管理',
    icon: '☁️',
    features: ['DNS管理', 'CDN加速', 'WAF防护', 'SSL证书', '安全防护'],
    pluginId: 'cloudflare',
    pluginAvailable: true
  },
  {
    id: 'aws',
    name: 'Amazon Web Services',
    description: 'EC2、S3、Route53、CloudWatch 管理',
    icon: '🔶',
    features: ['EC2实例', 'S3存储', 'Route53', 'CloudWatch'],
    pluginId: 'aws',
    pluginAvailable: false
  },
  {
    id: 'aliyun',
    name: '阿里云',
    description: 'ECS、OSS、DNS、CDN 管理',
    icon: '🟠',
    features: ['ECS实例', 'OSS存储', 'DNS解析', 'CDN加速'],
    pluginId: 'aliyun',
    pluginAvailable: false
  },
  {
    id: 'tencent',
    name: '腾讯云',
    description: 'CVM、COS、DNS 管理',
    icon: '🔵',
    features: ['CVM实例', 'COS存储', 'DNS解析'],
    pluginId: 'tencent',
    pluginAvailable: false
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    description: 'Droplet、Spaces 管理',
    icon: '🌊',
    features: ['Droplets', 'Spaces存储', 'Kubernetes'],
    pluginId: 'digitalocean',
    pluginAvailable: false
  }
])

// 传统配置字段
const configFields: Record<string, { label: string; type: string; placeholder: string }[]> = {
  cloudflare: [
    { label: 'API Token', type: 'password', placeholder: '输入 Cloudflare API Token' },
    { label: 'Account ID', type: 'text', placeholder: '输入 Account ID (可选)' }
  ],
  aws: [
    { label: 'Access Key ID', type: 'text', placeholder: '输入 AWS Access Key ID' },
    { label: 'Secret Access Key', type: 'password', placeholder: '输入 AWS Secret Access Key' },
    { label: 'Region', type: 'text', placeholder: '如 us-east-1' }
  ],
  aliyun: [
    { label: 'Access Key ID', type: 'text', placeholder: '输入阿里云 AccessKey ID' },
    { label: 'Access Key Secret', type: 'password', placeholder: '输入阿里云 AccessKey Secret' }
  ],
  tencent: [
    { label: 'Secret ID', type: 'text', placeholder: '输入腾讯云 SecretId' },
    { label: 'Secret Key', type: 'password', placeholder: '输入腾讯云 SecretKey' }
  ],
  digitalocean: [
    { label: 'API Token', type: 'password', placeholder: '输入 DigitalOcean API Token' }
  ]
}

// 已安装的云服务插件
const installedCloudPlugins = computed<CloudPlugin[]>(() => {
  const cloudPluginIds = cloudProviders.value.map(p => p.pluginId).filter(Boolean)
  return pluginStore.enabledPlugins
    .filter(p => cloudPluginIds.includes(p.id))
    .map(p => {
      const provider = cloudProviders.value.find(cp => cp.pluginId === p.id)
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        icon: p.icon || provider?.icon || '☁️',
        connected: checkPluginConnected(p.id),
        quickActions: getQuickActions(p.id)
      }
    })
})

// 可用的云服务提供商（未安装插件的）
const availableProviders = computed(() => {
  const installedIds = installedCloudPlugins.value.map(p => p.id)
  return cloudProviders.value.filter(p => !installedIds.includes(p.pluginId || ''))
})

// 传统模式提供商
const legacyProviders = computed<LegacyProvider[]>(() => {
  return cloudProviders.value.map(p => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    connected: checkLegacyConnected(p.id)
  }))
})

const connectedCount = computed(() => {
  return installedCloudPlugins.value.filter(p => p.connected).length +
    legacyProviders.value.filter(p => p.connected).length
})

function checkPluginConnected(pluginId: string): boolean {
  // 检查插件是否已配置（通过安全存储）
  // 这里简化处理，实际应该异步检查
  return false
}

function checkLegacyConnected(providerId: string): boolean {
  const saved = localStorage.getItem('serverhub_cloud_providers')
  if (saved) {
    try {
      const configs = JSON.parse(saved)
      return !!configs[providerId]
    } catch { /* ignore */ }
  }
  return false
}

function getQuickActions(pluginId: string): QuickAction[] {
  const actionsMap: Record<string, QuickAction[]> = {
    cloudflare: [
      { name: 'DNS 管理', action: 'dns', route: '/cloud/cloudflare?tab=dns' },
      { name: '安全设置', action: 'security', route: '/cloud/cloudflare?tab=security' },
      { name: '清除缓存', action: 'purge' }
    ]
  }
  return actionsMap[pluginId] || []
}

function openCloudService(plugin: CloudPlugin) {
  if (plugin.id === 'cloudflare') {
    router.push('/cloud/cloudflare')
  } else {
    router.push(`/plugin/${plugin.id}`)
  }
}

function handlePluginAction(action: string, plugin: CloudPlugin) {
  switch (action) {
    case 'open':
      openCloudService(plugin)
      break
    case 'config':
      router.push(`/plugin/${plugin.id}?config=true`)
      break
    case 'disable':
      disablePlugin(plugin)
      break
  }
}

async function disablePlugin(plugin: CloudPlugin) {
  await ElMessageBox.confirm(`确定要禁用 ${plugin.name} 插件吗？`, '确认')
  try {
    await pluginStore.disablePlugin(plugin.id)
    ElMessage.success(`${plugin.name} 已禁用`)
  } catch (e) {
    ElMessage.error('禁用失败: ' + (e as Error).message)
  }
}

function executeQuickAction(plugin: CloudPlugin, action: QuickAction) {
  if (action.route) {
    router.push(action.route)
  } else if (action.action === 'purge') {
    ElMessage.info('请在插件页面中清除缓存')
    openCloudService(plugin)
  }
}

async function installCloudPlugin(provider: CloudProvider) {
  if (!provider.pluginId) return

  installingPlugins.value.add(provider.pluginId)
  try {
    await pluginStore.installPlugin(provider.pluginId)
    await pluginStore.enablePlugin(provider.pluginId)
    ElMessage.success(`${provider.name} 插件安装成功`)
  } catch (e) {
    ElMessage.error('安装失败: ' + (e as Error).message)
  } finally {
    installingPlugins.value.delete(provider.pluginId)
  }
}

function configureLegacy(provider: LegacyProvider) {
  currentProvider.value = provider
  configForm.value = {}
  showConfigDialog.value = true
}

function saveConfig() {
  if (!currentProvider.value) return

  const fields = configFields[currentProvider.value.id] || []
  const firstField = fields[0]
  if (firstField && !configForm.value[firstField.label]) {
    ElMessage.warning(`请输入 ${firstField.label}`)
    return
  }

  // 保存配置
  const saved = localStorage.getItem('serverhub_cloud_providers')
  let configs: Record<string, Record<string, string>> = {}
  if (saved) {
    try {
      configs = JSON.parse(saved)
    } catch { /* ignore */ }
  }
  configs[currentProvider.value.id] = { ...configForm.value }
  localStorage.setItem('serverhub_cloud_providers', JSON.stringify(configs))

  showConfigDialog.value = false
  ElMessage.success(`${currentProvider.value.name} 已连接`)

  // 跳转到对应页面
  router.push(`/cloud/${currentProvider.value.id}`)
}

onMounted(() => {
  pluginStore.initialize()
})
</script>

<style lang="scss" scoped>
// 动画关键帧
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { 
    opacity: 0; 
    transform: translateY(20px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

@keyframes scaleIn {
  from { 
    opacity: 0; 
    transform: scale(0.9); 
  }
  to { 
    opacity: 1; 
    transform: scale(1); 
  }
}

// 动画类
.animate-fade-in {
  animation: fadeIn 0.5s ease-out both;
}

.animate-slide-up {
  animation: slideUp 0.5s ease-out both;
}

.animate-scale-in {
  animation: scaleIn 0.4s ease-out both;
}

.cloud-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-6);

  h1 {
    font-size: var(--text-xl);
    font-weight: 600;
    margin-bottom: 4px;
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }
}

.stats-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-6);

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-5);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    min-width: 180px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      border-color: var(--primary-color);
      box-shadow: 0 8px 25px -5px rgba(99, 102, 241, 0.25);
      transform: translateY(-4px);

      .stat-icon {
        transform: scale(1.1);
      }
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      transition: transform 0.3s ease;

      &.installed {
        background: var(--success-light);
        color: var(--success-color);
      }

      &.connected {
        background: var(--primary-light);
        color: var(--primary-color);
      }

      &.available {
        background: var(--warning-light);
        color: var(--warning-color);
      }
    }

    .stat-info {
      display: flex;
      flex-direction: column;

      .stat-value {
        font-size: var(--text-2xl);
        font-weight: 600;
      }

      .stat-label {
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
    }
  }
}

.section {
  margin-bottom: var(--space-8);

  h2 {
    font-size: var(--text-lg);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .section-desc {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    margin-bottom: var(--space-4);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }
}

.installed-plugins {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}

.plugin-card {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--border-color);

  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.2);
    transform: translateY(-3px);
  }

  &.installed {
    border-left: 3px solid var(--success-color);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);

    .plugin-emoji {
      font-size: 32px;
    }

    .plugin-title {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--space-2);

      h3 {
        font-size: var(--text-base);
        font-weight: 600;
        margin: 0;
      }
    }
  }

  .plugin-desc {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.provider-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-6) var(--space-5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--border-color);

  &:hover:not(.coming-soon) {
    border-color: var(--primary-color);
    box-shadow: 0 8px 25px -5px rgba(99, 102, 241, 0.2);
    transform: translateY(-4px);

    .provider-icon {
      transform: scale(1.1);
    }
  }

  &.coming-soon {
    opacity: 0.6;
  }

  .provider-icon {
    font-size: 48px;
    margin-bottom: var(--space-3);
    transition: transform 0.3s ease;
  }

  .provider-info {
    flex: 1;
    margin-bottom: var(--space-4);

    h3 {
      font-size: var(--text-base);
      font-weight: 600;
      margin-bottom: var(--space-2);
    }

    p {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin-bottom: var(--space-3);
    }

    .provider-features {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-1);
    }
  }
}

.legacy-section {
  background: var(--bg-secondary);
  padding: var(--space-5);
  border-radius: var(--radius-xl);
  margin-top: var(--space-10);
  border: 1px solid var(--border-color);
}

.legacy-providers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.legacy-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    transform: translateX(4px);

    .arrow {
      transform: translateX(4px);
      color: var(--primary-color);
    }
  }

  .legacy-icon {
    font-size: 20px;
  }

  .legacy-name {
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .arrow {
    margin-left: auto;
    color: var(--text-secondary);
    transition: all 0.3s ease;
  }
}
</style>
