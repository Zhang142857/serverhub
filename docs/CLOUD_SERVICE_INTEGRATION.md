# 云服务页面融合方案

> 将云服务管理统一到插件系统，提供一致的用户体验

---

## 🎯 融合目标

1. **统一入口** - Cloud.vue作为所有云服务的统一入口
2. **插件化架构** - 每个云服务提供商作为独立插件
3. **向后兼容** - 保留传统配置模式，平滑迁移
4. **一致体验** - 统一的UI/UX和操作流程
5. **资源聚合** - 跨云服务的资源统一管理

---

## 🏗️ 架构设计

### 当前架构

```
Cloud.vue (入口页面)
├── Cloudflare.vue (独立页面)
├── AWS.vue (独立页面)
├── Aliyun.vue (独立页面)
├── TencentCloud.vue (独立页面)
└── DigitalOcean.vue (独立页面)

问题：
- 各云服务页面独立，代码重复
- 没有统一的云服务接口
- 难以扩展新的云服务
- 配置管理分散
```

### 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud.vue (统一入口)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  云服务发现和展示                                      │   │
│  │  - 自动发现已安装的云服务插件                          │   │
│  │  - 统一的配置入口                                     │   │
│  │  - 资源使用统计                                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  CloudServicePlugin (基类)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  统一的云服务接口                                      │   │
│  │  - authenticate()                                    │   │
│  │  - getResources()                                    │   │
│  │  - createResource()                                  │   │
│  │  - deleteResource()                                  │   │
│  │  - getQuota()                                        │   │
│  │  - getBilling()                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Cloudflare  │      │     AWS      │      │   Aliyun     │
│   Plugin     │      │   Plugin     │      │   Plugin     │
└──────────────┘      └──────────────┘      └──────────────┘
```

---

## 📝 CloudServicePlugin基类

### 接口定义

```typescript
import { Plugin, PluginContext } from '@serverhub/plugin-sdk'

/**
 * 云资源类型
 */
export enum CloudResourceType {
  COMPUTE = 'compute',        // 计算实例
  STORAGE = 'storage',        // 存储
  DATABASE = 'database',      // 数据库
  NETWORK = 'network',        // 网络
  CDN = 'cdn',               // CDN
  DNS = 'dns',               // DNS
  SECURITY = 'security',      // 安全
  MONITORING = 'monitoring'   // 监控
}

/**
 * 云资源
 */
export interface CloudResource {
  id: string
  name: string
  type: CloudResourceType
  status: 'running' | 'stopped' | 'pending' | 'error'
  region?: string
  createdAt: Date
  metadata: Record<string, any>
}

/**
 * 认证凭据
 */
export interface CloudCredentials {
  [key: string]: string
}

/**
 * 配额信息
 */
export interface QuotaInfo {
  used: number
  total: number
  unit: string
  percentage: number
}

/**
 * 计费信息
 */
export interface BillingInfo {
  currentMonth: number
  lastMonth: number
  currency: string
  breakdown: Array<{
    service: string
    cost: number
  }>
}

/**
 * 云服务插件基类
 */
export abstract class CloudServicePlugin extends Plugin {
  protected credentials: CloudCredentials | null = null

  constructor(context: PluginContext) {
    super(context)
  }

  /**
   * 认证 - 验证凭据是否有效
   */
  abstract authenticate(credentials: CloudCredentials): Promise<boolean>

  /**
   * 检查是否已认证
   */
  abstract isAuthenticated(): boolean

  /**
   * 获取资源列表
   */
  abstract getResources(type?: CloudResourceType): Promise<CloudResource[]>

  /**
   * 创建资源
   */
  abstract createResource(
    type: CloudResourceType,
    config: any
  ): Promise<CloudResource>

  /**
   * 删除资源
   */
  abstract deleteResource(id: string): Promise<void>

  /**
   * 获取资源详情
   */
  abstract getResourceDetail(id: string): Promise<CloudResource>

  /**
   * 获取配额信息
   */
  abstract getQuota(): Promise<Record<string, QuotaInfo>>

  /**
   * 获取计费信息
   */
  abstract getBilling(): Promise<BillingInfo>

  /**
   * 获取支持的资源类型
   */
  abstract getSupportedResourceTypes(): CloudResourceType[]

  /**
   * 获取区域列表
   */
  abstract getRegions(): Promise<Array<{ id: string; name: string }>>

  /**
   * 加载凭据
   */
  protected async loadCredentials(): Promise<void> {
    const stored = await this.context.secureStorage.get('credentials')
    if (stored) {
      this.credentials = JSON.parse(stored)
    }
  }

  /**
   * 保存凭据
   */
  protected async saveCredentials(credentials: CloudCredentials): Promise<void> {
    await this.context.secureStorage.set('credentials', JSON.stringify(credentials))
    this.credentials = credentials
  }

  /**
   * 清除凭据
   */
  protected async clearCredentials(): Promise<void> {
    await this.context.secureStorage.delete('credentials')
    this.credentials = null
  }

  /**
   * 注册云服务特有的Agent工具
   */
  protected registerCloudTools(): void {
    // 子类实现具体的工具注册
  }

  async onLoad(): Promise<void> {
    await this.loadCredentials()
    this.registerCloudTools()
    
    // 注册通用菜单
    this.registerMenu({
      id: `${this.context.pluginId}-menu`,
      label: this.context.metadata.name,
      icon: this.context.metadata.icon || 'Cloudy',
      route: `/plugin/${this.context.pluginId}`,
      position: 'sidebar',
      order: 100
    })
  }
}
```

---

## 🔌 Cloudflare插件改造示例

### 插件主文件

```typescript
import { CloudServicePlugin, CloudResource, CloudResourceType } from '@serverhub/cloud-plugin-base'

export default class CloudflarePlugin extends CloudServicePlugin {
  private apiToken: string | null = null
  private accountId: string | null = null

  async authenticate(credentials: { apiToken: string; accountId?: string }): Promise<boolean> {
    try {
      // 验证API Token
      const response = await this.context.http.get(
        'https://api.cloudflare.com/client/v4/user/tokens/verify',
        {
          headers: {
            'Authorization': `Bearer ${credentials.apiToken}`
          }
        }
      )

      if (response.data.success) {
        await this.saveCredentials(credentials)
        this.apiToken = credentials.apiToken
        this.accountId = credentials.accountId || null
        return true
      }

      return false
    } catch (error) {
      this.context.logger.error('认证失败', error)
      return false
    }
  }

  isAuthenticated(): boolean {
    return !!this.apiToken
  }

  async getResources(type?: CloudResourceType): Promise<CloudResource[]> {
    if (!this.isAuthenticated()) {
      throw new Error('未认证')
    }

    const resources: CloudResource[] = []

    // 获取DNS Zone
    if (!type || type === CloudResourceType.DNS) {
      const zones = await this.listZones()
      resources.push(...zones.map(zone => ({
        id: zone.id,
        name: zone.name,
        type: CloudResourceType.DNS,
        status: zone.status === 'active' ? 'running' : 'pending',
        createdAt: new Date(zone.created_on),
        metadata: {
          nameServers: zone.name_servers,
          plan: zone.plan.name
        }
      })))
    }

    // 获取CDN配置
    if (!type || type === CloudResourceType.CDN) {
      // 实现CDN资源获取
    }

    return resources
  }

  async createResource(type: CloudResourceType, config: any): Promise<CloudResource> {
    if (!this.isAuthenticated()) {
      throw new Error('未认证')
    }

    switch (type) {
      case CloudResourceType.DNS:
        return await this.createDNSZone(config)
      default:
        throw new Error(`不支持的资源类型: ${type}`)
    }
  }

  async deleteResource(id: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('未认证')
    }

    await this.context.http.delete(
      `https://api.cloudflare.com/client/v4/zones/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      }
    )
  }

  async getResourceDetail(id: string): Promise<CloudResource> {
    const response = await this.context.http.get(
      `https://api.cloudflare.com/client/v4/zones/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      }
    )

    const zone = response.data.result
    return {
      id: zone.id,
      name: zone.name,
      type: CloudResourceType.DNS,
      status: zone.status === 'active' ? 'running' : 'pending',
      createdAt: new Date(zone.created_on),
      metadata: zone
    }
  }

  async getQuota(): Promise<Record<string, QuotaInfo>> {
    // Cloudflare大部分功能无配额限制
    return {
      zones: {
        used: (await this.listZones()).length,
        total: -1, // 无限制
        unit: '个',
        percentage: 0
      }
    }
  }

  async getBilling(): Promise<BillingInfo> {
    // 需要Cloudflare账户API权限
    // 这里返回模拟数据
    return {
      currentMonth: 0,
      lastMonth: 0,
      currency: 'USD',
      breakdown: []
    }
  }

  getSupportedResourceTypes(): CloudResourceType[] {
    return [
      CloudResourceType.DNS,
      CloudResourceType.CDN,
      CloudResourceType.SECURITY
    ]
  }

  async getRegions(): Promise<Array<{ id: string; name: string }>> {
    // Cloudflare是全球CDN，没有区域概念
    return [
      { id: 'global', name: '全球' }
    ]
  }

  protected registerCloudTools(): void {
    // 注册Cloudflare特有的Agent工具
    this.registerAgentTool({
      name: 'cloudflare_list_zones',
      displayName: '列出Cloudflare域名',
      description: '获取Cloudflare账户下的所有域名',
      category: 'cloudflare',
      dangerous: false,
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: 'listZones'
    })

    this.registerAgentTool({
      name: 'cloudflare_purge_cache',
      displayName: '清除Cloudflare缓存',
      description: '清除指定域名的CDN缓存',
      category: 'cloudflare',
      dangerous: true,
      parameters: {
        type: 'object',
        properties: {
          zoneId: {
            type: 'string',
            description: '域名Zone ID'
          },
          purgeEverything: {
            type: 'boolean',
            description: '是否清除所有缓存'
          }
        },
        required: ['zoneId']
      },
      handler: 'purgeCache'
    })
  }

  // ========== 私有方法 ==========

  private async listZones(): Promise<any[]> {
    const response = await this.context.http.get(
      'https://api.cloudflare.com/client/v4/zones',
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      }
    )

    return response.data.result
  }

  private async createDNSZone(config: { name: string }): Promise<CloudResource> {
    const response = await this.context.http.post(
      'https://api.cloudflare.com/client/v4/zones',
      {
        name: config.name,
        account: this.accountId ? { id: this.accountId } : undefined
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      }
    )

    const zone = response.data.result
    return {
      id: zone.id,
      name: zone.name,
      type: CloudResourceType.DNS,
      status: 'pending',
      createdAt: new Date(zone.created_on),
      metadata: zone
    }
  }

  async purgeCache(params: { zoneId: string; purgeEverything?: boolean }): Promise<any> {
    const response = await this.context.http.post(
      `https://api.cloudflare.com/client/v4/zones/${params.zoneId}/purge_cache`,
      {
        purge_everything: params.purgeEverything || false
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      }
    )

    return response.data
  }
}
```

---

## 🎨 Cloud.vue升级

### 增强的Cloud.vue

```vue
<template>
  <div class="cloud-page">
    <div class="page-header animate-fade-in">
      <h1>云服务集成</h1>
      <p class="subtitle">统一管理多云资源</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card" v-for="stat in stats" :key="stat.label">
        <div class="stat-icon" :class="stat.type">
          <el-icon><component :is="stat.icon" /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>

    <!-- 已安装的云服务插件 -->
    <div v-if="installedCloudPlugins.length > 0" class="section">
      <div class="section-header">
        <h2>已安装的云服务</h2>
        <el-button @click="showResourceAggregation = true">
          <el-icon><Grid /></el-icon>资源聚合视图
        </el-button>
      </div>
      
      <div class="cloud-plugins-grid">
        <el-card
          v-for="plugin in installedCloudPlugins"
          :key="plugin.id"
          class="cloud-plugin-card"
          @click="openCloudPlugin(plugin)"
        >
          <div class="plugin-header">
            <span class="plugin-icon">{{ plugin.icon }}</span>
            <div class="plugin-info">
              <h3>{{ plugin.name }}</h3>
              <el-tag :type="plugin.authenticated ? 'success' : 'warning'" size="small">
                {{ plugin.authenticated ? '已连接' : '未配置' }}
              </el-tag>
            </div>
            <el-dropdown @command="handlePluginAction($event, plugin)">
              <el-button text circle>
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="open">打开</el-dropdown-item>
                  <el-dropdown-item command="config">配置</el-dropdown-item>
                  <el-dropdown-item command="refresh">刷新</el-dropdown-item>
                  <el-dropdown-item command="disable" divided>禁用</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <div class="plugin-stats" v-if="plugin.authenticated">
            <div class="stat-item" v-for="stat in plugin.stats" :key="stat.label">
              <span class="stat-label">{{ stat.label }}</span>
              <span class="stat-value">{{ stat.value }}</span>
            </div>
          </div>

          <div class="plugin-actions">
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
    <div class="section">
      <h2>添加云服务</h2>
      <p class="section-desc">从插件市场安装更多云服务提供商</p>
      
      <div class="available-plugins-grid">
        <el-card
          v-for="provider in availableProviders"
          :key="provider.id"
          class="provider-card"
        >
          <div class="provider-icon">{{ provider.icon }}</div>
          <h3>{{ provider.name }}</h3>
          <p>{{ provider.description }}</p>
          <div class="provider-features">
            <el-tag
              v-for="feature in provider.features.slice(0, 3)"
              :key="feature"
              size="small"
            >
              {{ feature }}
            </el-tag>
          </div>
          <el-button
            type="primary"
            @click="installPlugin(provider)"
            :loading="installing.has(provider.pluginId)"
          >
            安装插件
          </el-button>
        </el-card>
      </div>
    </div>

    <!-- 资源聚合视图对话框 -->
    <el-dialog
      v-model="showResourceAggregation"
      title="跨云资源聚合"
      width="80%"
      :fullscreen="isFullscreen"
    >
      <div class="resource-aggregation">
        <el-tabs v-model="activeResourceType">
          <el-tab-pane
            v-for="type in resourceTypes"
            :key="type.value"
            :label="type.label"
            :name="type.value"
          >
            <el-table :data="getResourcesByType(type.value)" stripe>
              <el-table-column prop="provider" label="云服务商" width="120">
                <template #default="{ row }">
                  <el-tag>{{ row.provider }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="资源名称" min-width="200" />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="getStatusType(row.status)">
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="region" label="区域" width="120" />
              <el-table-column prop="createdAt" label="创建时间" width="180">
                <template #default="{ row }">
                  {{ formatDate(row.createdAt) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button text size="small" @click="viewResource(row)">
                    查看
                  </el-button>
                  <el-button text size="small" type="danger" @click="deleteResource(row)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { usePluginStore } from '@/stores/plugin'
import type { CloudResource, CloudResourceType } from '@serverhub/cloud-plugin-base'

const router = useRouter()
const pluginStore = usePluginStore()

const showResourceAggregation = ref(false)
const isFullscreen = ref(false)
const activeResourceType = ref<CloudResourceType>('compute')
const installing = ref<Set<string>>(new Set())
const aggregatedResources = ref<CloudResource[]>([])

// 资源类型
const resourceTypes = [
  { label: '计算实例', value: 'compute' },
  { label: '存储', value: 'storage' },
  { label: '数据库', value: 'database' },
  { label: 'CDN', value: 'cdn' },
  { label: 'DNS', value: 'dns' }
]

// 统计数据
const stats = computed(() => [
  {
    label: '已安装',
    value: installedCloudPlugins.value.length,
    icon: 'CircleCheck',
    type: 'success'
  },
  {
    label: '已连接',
    value: installedCloudPlugins.value.filter(p => p.authenticated).length,
    icon: 'Link',
    type: 'primary'
  },
  {
    label: '总资源',
    value: aggregatedResources.value.length,
    icon: 'Box',
    type: 'warning'
  }
])

// 已安装的云服务插件
const installedCloudPlugins = computed(() => {
  return pluginStore.enabledPlugins
    .filter(p => p.category === 'cloud-service')
    .map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      authenticated: checkAuthenticated(p.id),
      stats: getPluginStats(p.id),
      quickActions: getQuickActions(p.id)
    }))
})

// 可用的云服务提供商
const availableProviders = computed(() => {
  // 从插件市场获取
  return []
})

async function loadAggregatedResources() {
  aggregatedResources.value = []
  
  for (const plugin of installedCloudPlugins.value) {
    if (!plugin.authenticated) continue
    
    try {
      const resources = await window.electronAPI.plugin.call(
        plugin.id,
        'getResources'
      )
      
      aggregatedResources.value.push(
        ...resources.map(r => ({
          ...r,
          provider: plugin.name
        }))
      )
    } catch (error) {
      console.error(`加载${plugin.name}资源失败:`, error)
    }
  }
}

function getResourcesByType(type: CloudResourceType) {
  return aggregatedResources.value.filter(r => r.type === type)
}

function checkAuthenticated(pluginId: string): boolean {
  // 调用插件的isAuthenticated方法
  return false
}

function getPluginStats(pluginId: string) {
  // 获取插件统计信息
  return []
}

function getQuickActions(pluginId: string) {
  // 获取快捷操作
  return []
}

async function openCloudPlugin(plugin: any) {
  router.push(`/plugin/${plugin.id}`)
}

async function installPlugin(provider: any) {
  installing.value.add(provider.pluginId)
  try {
    await pluginStore.installPlugin(provider.pluginId)
    await pluginStore.enablePlugin(provider.pluginId)
    ElMessage.success(`${provider.name} 安装成功`)
  } catch (error) {
    ElMessage.error('安装失败: ' + (error as Error).message)
  } finally {
    installing.value.delete(provider.pluginId)
  }
}

onMounted(async () => {
  await pluginStore.initialize()
  await loadAggregatedResources()
})
</script>
```

---

## 📋 迁移计划

### 阶段1：基础架构（1周）

1. **创建CloudServicePlugin基类**
   - 定义统一接口
   - 实现通用功能
   - 编写文档

2. **改造Cloudflare插件**
   - 继承CloudServicePlugin
   - 实现所有接口
   - 测试功能完整性

3. **升级Cloud.vue**
   - 添加资源聚合功能
   - 优化UI/UX
   - 支持插件发现

### 阶段2：其他云服务迁移（2-3周）

1. **AWS插件**
   - EC2、S3、Route53
   - CloudWatch监控

2. **阿里云插件**
   - ECS、OSS、DNS
   - CDN加速

3. **腾讯云插件**
   - CVM、COS、DNS

4. **DigitalOcean插件**
   - Droplets、Spaces

### 阶段3：高级功能（1-2周）

1. **跨云资源管理**
   - 统一资源视图
   - 批量操作
   - 资源迁移

2. **成本优化**
   - 多云成本对比
   - 资源使用分析
   - 优化建议

3. **监控告警**
   - 跨云监控
   - 统一告警
   - 性能分析

---

## ✅ 验收标准

1. **功能完整性**
   - ✅ 所有云服务都已插件化
   - ✅ 统一的认证流程
   - ✅ 资源CRUD操作正常
   - ✅ Agent工具正常工作

2. **用户体验**
   - ✅ 操作流程一致
   - ✅ UI风格统一
   - ✅ 响应速度快
   - ✅ 错误提示清晰

3. **向后兼容**
   - ✅ 旧配置可以迁移
   - ✅ 现有功能不受影响
   - ✅ 传统模式可用

---

**文档版本**: v1.0  
**最后更新**: 2026-02-06
