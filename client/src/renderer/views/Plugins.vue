<template>
  <div class="plugins-page">
    <div class="page-header">
      <div class="header-left">
        <h1>插件市场</h1>
        <p class="subtitle">扩展 ServerHub 的功能</p>
      </div>
      <div class="header-right">
        <el-input
          v-model="searchQuery"
          placeholder="搜索插件..."
          class="search-input"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="sortBy" style="width: 140px">
          <el-option label="最热门" value="downloads" />
          <el-option label="最高评分" value="rating" />
          <el-option label="最新更新" value="updated" />
          <el-option label="名称" value="name" />
        </el-select>
        <el-button @click="checkAllUpdates" :loading="checkingUpdates">
          <el-icon><Refresh /></el-icon>
          检查更新
        </el-button>
      </div>
    </div>

    <!-- 更新提示 -->
    <el-alert
      v-if="updatesAvailable.length > 0"
      :title="`${updatesAvailable.length} 个插件有可用更新`"
      type="warning"
      show-icon
      :closable="false"
      class="update-alert"
    >
      <template #default>
        <div class="update-list">
          <span v-for="plugin in updatesAvailable" :key="plugin.id" class="update-item">
            {{ plugin.name }} ({{ plugin.version }} → {{ plugin.latestVersion }})
          </span>
          <el-button type="primary" size="small" @click="updateAllPlugins" :loading="updatingAll">
            全部更新
          </el-button>
        </div>
      </template>
    </el-alert>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value">{{ installedPlugins.length }}</span>
        <span class="stat-label">已安装</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ plugins.length }}</span>
        <span class="stat-label">可用插件</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ officialCount }}</span>
        <span class="stat-label">官方插件</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ updatesAvailable.length }}</span>
        <span class="stat-label">待更新</span>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="category-filter">
      <el-radio-group v-model="selectedCategory" size="small">
        <el-radio-button label="">全部</el-radio-button>
        <el-radio-button
          v-for="cat in categories"
          :key="cat.id"
          :label="cat.id"
        >
          {{ cat.icon }} {{ cat.name }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="全部插件" name="all">
        <div class="plugin-grid">
          <el-card
            v-for="plugin in filteredPlugins"
            :key="plugin.id"
            class="plugin-card"
            @click="showPluginDetail(plugin)"
          >
            <div class="plugin-header">
              <div class="plugin-icon">{{ plugin.icon }}</div>
              <div class="plugin-info">
                <h3>{{ plugin.name }}</h3>
                <span class="plugin-author">by {{ plugin.author }}</span>
              </div>
              <el-tag v-if="plugin.official" type="primary" size="small">官方</el-tag>
              <el-tag v-if="plugin.installed" type="success" size="small">已安装</el-tag>
              <el-tag v-if="plugin.hasUpdate" type="warning" size="small">有更新</el-tag>
            </div>
            <p class="plugin-desc">{{ plugin.description }}</p>
            <div class="plugin-rating">
              <div class="stars">
                <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(plugin.rating) }">★</span>
              </div>
              <span class="rating-value">{{ plugin.rating.toFixed(1) }}</span>
              <span class="rating-count">({{ plugin.ratingCount }})</span>
            </div>
            <div class="plugin-tags">
              <el-tag
                v-for="tag in plugin.tags"
                :key="tag"
                size="small"
                type="info"
              >
                {{ tag }}
              </el-tag>
            </div>
            <div class="plugin-footer">
              <div class="plugin-stats">
                <span>📥 {{ formatNumber(plugin.downloads) }}</span>
                <span>v{{ plugin.version }}</span>
              </div>
              <el-button
                v-if="!plugin.installed"
                type="primary"
                size="small"
                @click.stop="installPlugin(plugin)"
                :loading="plugin.installing"
              >
                安装
              </el-button>
              <el-button-group v-else size="small">
                <el-button
                  v-if="plugin.hasUpdate"
                  type="warning"
                  @click.stop="updatePlugin(plugin)"
                  :loading="plugin.updating"
                >
                  更新
                </el-button>
                <el-button @click.stop="uninstallPlugin(plugin)">
                  卸载
                </el-button>
              </el-button-group>
            </div>
          </el-card>
        </div>
        <el-empty v-if="filteredPlugins.length === 0" description="没有找到匹配的插件" />
      </el-tab-pane>

      <el-tab-pane label="已安装" name="installed">
        <div class="plugin-grid">
          <el-card
            v-for="plugin in installedPlugins"
            :key="plugin.id"
            class="plugin-card installed"
            @click="showPluginDetail(plugin)"
          >
            <div class="plugin-header">
              <div class="plugin-icon">{{ plugin.icon }}</div>
              <div class="plugin-info">
                <h3>{{ plugin.name }}</h3>
                <span class="plugin-version">v{{ plugin.version }}</span>
                <el-tag v-if="plugin.hasUpdate" type="warning" size="small" style="margin-left: 8px">
                  新版本 {{ plugin.latestVersion }}
                </el-tag>
              </div>
              <el-switch
                v-model="plugin.enabled"
                size="small"
                @click.stop
                @change="togglePlugin(plugin)"
              />
            </div>
            <p class="plugin-desc">{{ plugin.description }}</p>
            <div class="plugin-footer">
              <el-button size="small" @click.stop="configurePlugin(plugin)">
                <el-icon><Setting /></el-icon>
                配置
              </el-button>
              <el-button
                v-if="plugin.hasUpdate"
                size="small"
                type="warning"
                @click.stop="updatePlugin(plugin)"
                :loading="plugin.updating"
              >
                更新
              </el-button>
              <el-button size="small" type="danger" @click.stop="uninstallPlugin(plugin)">
                卸载
              </el-button>
            </div>
          </el-card>
        </div>
        <el-empty v-if="installedPlugins.length === 0" description="暂无已安装的插件" />
      </el-tab-pane>
    </el-tabs>

    <!-- 插件详情对话框 -->
    <el-dialog v-model="showDetailDialog" :title="currentPlugin?.name" width="700px">
      <div v-if="currentPlugin" class="plugin-detail">
        <div class="detail-header">
          <div class="plugin-icon large">{{ currentPlugin.icon }}</div>
          <div class="detail-info">
            <h2>{{ currentPlugin.name }}</h2>
            <p class="author">by {{ currentPlugin.author }}</p>
            <div class="detail-tags">
              <el-tag v-if="currentPlugin.official" type="primary" size="small">官方</el-tag>
              <el-tag v-if="currentPlugin.installed" type="success" size="small">已安装</el-tag>
              <el-tag size="small">v{{ currentPlugin.version }}</el-tag>
              <el-tag v-if="currentPlugin.hasUpdate" type="warning" size="small">
                新版本 {{ currentPlugin.latestVersion }}
              </el-tag>
            </div>
          </div>
        </div>

        <div class="detail-stats">
          <div class="stat">
            <div class="rating-display">
              <span class="rating-big">{{ currentPlugin.rating.toFixed(1) }}</span>
              <div class="stars">
                <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(currentPlugin.rating) }">★</span>
              </div>
            </div>
            <span class="label">{{ currentPlugin.ratingCount }} 评分</span>
          </div>
          <div class="stat">
            <span class="value">{{ formatNumber(currentPlugin.downloads) }}</span>
            <span class="label">📥 下载</span>
          </div>
          <div class="stat">
            <span class="value">{{ currentPlugin.version }}</span>
            <span class="label">📦 版本</span>
          </div>
          <div class="stat">
            <span class="value">{{ currentPlugin.updatedAt }}</span>
            <span class="label">🕐 更新</span>
          </div>
        </div>

        <el-tabs v-model="detailTab">
          <el-tab-pane label="描述" name="description">
            <div class="detail-section">
              <h3>描述</h3>
              <p>{{ currentPlugin.description }}</p>
            </div>

            <div class="detail-section">
              <h3>功能特性</h3>
              <ul>
                <li v-for="(feature, index) in currentPlugin.features" :key="index">
                  {{ feature }}
                </li>
              </ul>
            </div>

            <div class="detail-section" v-if="currentPlugin.dependencies && currentPlugin.dependencies.length > 0">
              <h3>依赖插件</h3>
              <div class="dependency-list">
                <el-tag v-for="dep in currentPlugin.dependencies" :key="dep" size="small">
                  {{ dep }}
                </el-tag>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="更新日志" name="changelog">
            <div class="changelog">
              <div v-for="(log, index) in currentPlugin.changelog" :key="index" class="changelog-item">
                <div class="changelog-header">
                  <span class="version">v{{ log.version }}</span>
                  <span class="date">{{ log.date }}</span>
                </div>
                <ul>
                  <li v-for="(change, i) in log.changes" :key="i">{{ change }}</li>
                </ul>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="评价" name="reviews">
            <div class="reviews-section">
              <div class="rating-summary">
                <div class="rating-big-display">
                  <span class="rating-number">{{ currentPlugin.rating.toFixed(1) }}</span>
                  <div class="stars large">
                    <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(currentPlugin.rating) }">★</span>
                  </div>
                  <span class="rating-count">{{ currentPlugin.ratingCount }} 个评分</span>
                </div>
                <div class="rating-bars">
                  <div v-for="i in 5" :key="i" class="rating-bar">
                    <span class="bar-label">{{ 6 - i }} ★</span>
                    <el-progress
                      :percentage="getRatingPercentage(6 - i)"
                      :show-text="false"
                      :stroke-width="8"
                    />
                    <span class="bar-count">{{ getRatingCount(6 - i) }}</span>
                  </div>
                </div>
              </div>

              <div class="user-rating" v-if="currentPlugin.installed">
                <h4>您的评分</h4>
                <div class="rate-stars">
                  <span
                    v-for="i in 5"
                    :key="i"
                    class="star clickable"
                    :class="{ filled: i <= userRating }"
                    @click="setUserRating(i)"
                  >★</span>
                </div>
                <el-input
                  v-model="userReview"
                  type="textarea"
                  :rows="3"
                  placeholder="写下您的评价..."
                  style="margin-top: 12px"
                />
                <el-button type="primary" size="small" style="margin-top: 8px" @click="submitReview">
                  提交评价
                </el-button>
              </div>

              <div class="reviews-list">
                <div v-for="review in currentPlugin.reviews" :key="review.id" class="review-item">
                  <div class="review-header">
                    <span class="reviewer">{{ review.user }}</span>
                    <div class="review-rating">
                      <span v-for="i in 5" :key="i" class="star small" :class="{ filled: i <= review.rating }">★</span>
                    </div>
                    <span class="review-date">{{ review.date }}</span>
                  </div>
                  <p class="review-content">{{ review.content }}</p>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button
          v-if="currentPlugin && currentPlugin.hasUpdate"
          type="warning"
          @click="updatePlugin(currentPlugin); showDetailDialog = false"
        >
          更新到 {{ currentPlugin.latestVersion }}
        </el-button>
        <el-button
          v-if="currentPlugin && !currentPlugin.installed"
          type="primary"
          @click="installPlugin(currentPlugin); showDetailDialog = false"
        >
          安装插件
        </el-button>
        <el-button
          v-else-if="currentPlugin"
          type="danger"
          @click="uninstallPlugin(currentPlugin); showDetailDialog = false"
        >
          卸载插件
        </el-button>
      </template>
    </el-dialog>

    <!-- 插件配置对话框 -->
    <el-dialog v-model="showConfigDialog" :title="`配置 - ${configPlugin?.name}`" width="500px">
      <div v-if="configPlugin" class="plugin-config">
        <el-form label-width="120px">
          <el-form-item v-for="(config, key) in configPlugin.config" :key="key" :label="config.label">
            <el-switch v-if="config.type === 'boolean'" :model-value="config.value as boolean" @update:model-value="config.value = $event" />
            <el-input v-else-if="config.type === 'string'" :model-value="config.value as string" @update:model-value="config.value = $event" />
            <el-input-number v-else-if="config.type === 'number'" :model-value="config.value as number" @update:model-value="config.value = $event ?? 0" />
            <el-select v-else-if="config.type === 'select'" :model-value="config.value" @update:model-value="config.value = $event">
              <el-option v-for="opt in config.options" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <span class="config-hint" v-if="config.hint">{{ config.hint }}</span>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" @click="savePluginConfig">保存配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Setting, Refresh } from '@element-plus/icons-vue'
import { usePluginStore, type PluginInfo, type MarketPlugin } from '@/stores/plugin'

const pluginStore = usePluginStore()

const searchQuery = ref('')
const activeTab = ref('all')
const selectedCategory = ref('')
const sortBy = ref('downloads')
const showDetailDialog = ref(false)
const showConfigDialog = ref(false)
const currentPlugin = ref<MarketPlugin | null>(null)
const configPlugin = ref<PluginInfo | null>(null)
const detailTab = ref('description')
const checkingUpdates = ref(false)
const updatingAll = ref(false)
const userRating = ref(0)
const userReview = ref('')
const installingPlugins = ref<Set<string>>(new Set())

const categories = [
  { id: 'security', name: '安全', icon: '🛡️' },
  { id: 'database', name: '数据库', icon: '🗄️' },
  { id: 'web', name: 'Web服务', icon: '🌐' },
  { id: 'monitor', name: '监控', icon: '📊' },
  { id: 'game', name: '游戏', icon: '🎮' },
  { id: 'tools', name: '工具', icon: '🔧' }
]

// 合并已安装插件和市场插件
const allPlugins = computed(() => {
  const installed = pluginStore.plugins
  const market = pluginStore.marketPlugins

  return market.map(mp => {
    const installedPlugin = installed.find(ip => ip.id === mp.id)
    return {
      ...mp,
      installed: !!installedPlugin,
      enabled: installedPlugin?.status === 'enabled',
      installedVersion: installedPlugin?.version,
      hasUpdate: installedPlugin ? installedPlugin.version !== mp.version : false,
      installing: installingPlugins.value.has(mp.id)
    }
  })
})

const officialCount = computed(() => pluginStore.marketPlugins.filter(p => p.official).length)

const updatesAvailable = computed(() =>
  allPlugins.value.filter(p => p.installed && p.hasUpdate)
)

const filteredPlugins = computed(() => {
  let result = allPlugins.value

  if (selectedCategory.value) {
    result = result.filter(p => p.category === selectedCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.tags.some(t => t.toLowerCase().includes(query))
    )
  }

  result = [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'downloads': return b.downloads - a.downloads
      case 'rating': return b.rating - a.rating
      case 'updated': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'name': return a.name.localeCompare(b.name)
      default: return 0
    }
  })

  return result
})

const installedPlugins = computed(() => allPlugins.value.filter(p => p.installed))

function formatNumber(num: number): string {
  return num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num.toString()
}

function showPluginDetail(plugin: MarketPlugin) {
  currentPlugin.value = plugin
  detailTab.value = 'description'
  userRating.value = 0
  userReview.value = ''
  showDetailDialog.value = true
}

async function installPlugin(plugin: MarketPlugin & { installing?: boolean }) {
  installingPlugins.value.add(plugin.id)
  try {
    await pluginStore.installPlugin(plugin.id)
    ElMessage.success(`${plugin.name} 安装成功`)
  } catch (e) {
    ElMessage.error(`安装失败: ${(e as Error).message}`)
  } finally {
    installingPlugins.value.delete(plugin.id)
  }
}

async function uninstallPlugin(plugin: MarketPlugin & { installed?: boolean }) {
  try {
    await pluginStore.uninstallPlugin(plugin.id)
    ElMessage.info(`${plugin.name} 已卸载`)
  } catch (e) {
    ElMessage.error(`卸载失败: ${(e as Error).message}`)
  }
}

async function updatePlugin(plugin: MarketPlugin) {
  try {
    await pluginStore.uninstallPlugin(plugin.id)
    await pluginStore.installPlugin(plugin.id)
    ElMessage.success(`${plugin.name} 已更新到 v${plugin.version}`)
  } catch (e) {
    ElMessage.error(`更新失败: ${(e as Error).message}`)
  }
}

async function togglePlugin(plugin: MarketPlugin & { enabled?: boolean }) {
  try {
    if (plugin.enabled) {
      await pluginStore.disablePlugin(plugin.id)
      ElMessage.success(`${plugin.name} 已禁用`)
    } else {
      await pluginStore.enablePlugin(plugin.id)
      ElMessage.success(`${plugin.name} 已启用`)
    }
  } catch (e) {
    ElMessage.error(`操作失败: ${(e as Error).message}`)
  }
}

async function configurePlugin(plugin: MarketPlugin & { installed?: boolean }) {
  const installedPlugin = pluginStore.getPlugin(plugin.id)
  if (!installedPlugin) {
    ElMessage.info(`${plugin.name} 暂无可配置项`)
    return
  }
  configPlugin.value = installedPlugin
  showConfigDialog.value = true
}

async function savePluginConfig() {
  if (configPlugin.value) {
    try {
      await pluginStore.setPluginConfig(configPlugin.value.id, configPlugin.value.config || {})
      ElMessage.success(`${configPlugin.value.name} 配置已保存`)
      showConfigDialog.value = false
    } catch (e) {
      ElMessage.error(`保存失败: ${(e as Error).message}`)
    }
  }
}

function checkAllUpdates() {
  checkingUpdates.value = true
  setTimeout(() => {
    checkingUpdates.value = false
    const updateCount = updatesAvailable.value.length
    if (updateCount > 0) {
      ElMessage.warning(`发现 ${updateCount} 个插件有可用更新`)
    } else {
      ElMessage.success('所有插件都是最新版本')
    }
  }, 1500)
}

async function updateAllPlugins() {
  updatingAll.value = true
  try {
    for (const plugin of updatesAvailable.value) {
      await updatePlugin(plugin)
    }
    ElMessage.success('所有插件已更新')
  } catch (e) {
    ElMessage.error(`更新失败: ${(e as Error).message}`)
  } finally {
    updatingAll.value = false
  }
}

function getRatingPercentage(stars: number): number {
  if (!currentPlugin.value || currentPlugin.value.ratingCount === 0) return 0
  // 模拟评分分布
  const distributions = [60, 25, 10, 3, 2]
  return distributions[5 - stars] || 0
}

function getRatingCount(stars: number): number {
  if (!currentPlugin.value) return 0
  const total = currentPlugin.value.ratingCount
  return Math.round(total * (getRatingPercentage(stars) / 100))
}

function setUserRating(rating: number) {
  userRating.value = rating
}

function submitReview() {
  if (userRating.value === 0) {
    ElMessage.warning('请先选择评分')
    return
  }
  if (!userReview.value.trim()) {
    ElMessage.warning('请输入评价内容')
    return
  }
  ElMessage.success('评价已提交')
  userRating.value = 0
  userReview.value = ''
}

onMounted(async () => {
  await pluginStore.initialize()
  await pluginStore.loadMarketPlugins()
})
</script>

<style lang="scss" scoped>
.plugins-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-left {
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
    }
  }

  .header-right {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .search-input {
    width: 240px;
  }
}

.update-alert {
  margin-bottom: 16px;

  .update-list {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 8px;

    .update-item {
      font-size: 13px;
    }
  }
}

.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 24px;
    background: var(--bg-secondary);
    border-radius: 8px;
    min-width: 100px;

    .stat-value {
      font-size: 24px;
      font-weight: 600;
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-secondary);
    }
  }
}

.category-filter {
  margin-bottom: 16px;
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.plugin-card {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary);
  }

  &.installed {
    border-color: var(--el-color-success-light-5);
  }

  .plugin-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .plugin-icon {
      font-size: 32px;

      &.large {
        font-size: 48px;
      }
    }

    .plugin-info {
      flex: 1;

      h3 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 2px;
      }

      .plugin-author,
      .plugin-version {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }
  }

  .plugin-desc {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .plugin-rating {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    .stars {
      display: flex;
      gap: 2px;
    }

    .star {
      color: #ddd;
      font-size: 14px;

      &.filled {
        color: #f5a623;
      }
    }

    .rating-value {
      font-weight: 600;
      font-size: 14px;
    }

    .rating-count {
      font-size: 12px;
      color: var(--text-secondary);
    }
  }

  .plugin-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .plugin-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .plugin-stats {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: var(--text-secondary);
    }
  }
}

.plugin-detail {
  .detail-header {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;

    .plugin-icon.large {
      font-size: 64px;
    }

    .detail-info {
      h2 {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .author {
        color: var(--text-secondary);
        margin-bottom: 8px;
      }

      .detail-tags {
        display: flex;
        gap: 8px;
      }
    }
  }

  .detail-stats {
    display: flex;
    gap: 32px;
    padding: 16px;
    background: var(--bg-color-overlay);
    border-radius: 8px;
    margin-bottom: 24px;

    .stat {
      text-align: center;

      .value {
        display: block;
        font-size: 20px;
        font-weight: 600;
      }

      .label {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .rating-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;

        .rating-big {
          font-size: 24px;
          font-weight: 600;
        }

        .stars {
          display: flex;
          gap: 2px;

          .star {
            color: #ddd;
            font-size: 14px;

            &.filled {
              color: #f5a623;
            }
          }
        }
      }
    }
  }

  .detail-section {
    margin-bottom: 16px;

    h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    p {
      color: var(--text-secondary);
      line-height: 1.6;
    }

    ul {
      margin: 0;
      padding-left: 20px;
      color: var(--text-secondary);

      li {
        margin-bottom: 4px;
      }
    }

    .dependency-list {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  }
}

.changelog {
  .changelog-item {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);

    &:last-child {
      border-bottom: none;
    }

    .changelog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      .version {
        font-weight: 600;
        color: var(--el-color-primary);
      }

      .date {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }

    ul {
      margin: 0;
      padding-left: 20px;
      color: var(--text-secondary);
      font-size: 13px;

      li {
        margin-bottom: 4px;
      }
    }
  }
}

.reviews-section {
  .rating-summary {
    display: flex;
    gap: 32px;
    padding: 16px;
    background: var(--bg-color-overlay);
    border-radius: 8px;
    margin-bottom: 24px;

    .rating-big-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 120px;

      .rating-number {
        font-size: 48px;
        font-weight: 600;
        line-height: 1;
      }

      .stars.large {
        display: flex;
        gap: 4px;
        margin: 8px 0;

        .star {
          font-size: 20px;
          color: #ddd;

          &.filled {
            color: #f5a623;
          }
        }
      }

      .rating-count {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }

    .rating-bars {
      flex: 1;

      .rating-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;

        .bar-label {
          width: 40px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .el-progress {
          flex: 1;
        }

        .bar-count {
          width: 30px;
          font-size: 12px;
          color: var(--text-secondary);
          text-align: right;
        }
      }
    }
  }

  .user-rating {
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    margin-bottom: 24px;

    h4 {
      margin-bottom: 12px;
      font-size: 14px;
      font-weight: 600;
    }

    .rate-stars {
      display: flex;
      gap: 8px;

      .star {
        font-size: 28px;
        color: #ddd;
        cursor: pointer;
        transition: color 0.2s;

        &.filled {
          color: #f5a623;
        }

        &:hover {
          color: #f5a623;
        }
      }
    }
  }

  .reviews-list {
    .review-item {
      padding: 16px 0;
      border-bottom: 1px solid var(--border-color);

      &:last-child {
        border-bottom: none;
      }

      .review-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;

        .reviewer {
          font-weight: 600;
        }

        .review-rating {
          display: flex;
          gap: 2px;

          .star.small {
            font-size: 12px;
            color: #ddd;

            &.filled {
              color: #f5a623;
            }
          }
        }

        .review-date {
          font-size: 12px;
          color: var(--text-secondary);
          margin-left: auto;
        }
      }

      .review-content {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.6;
        margin: 0;
      }
    }
  }
}

.plugin-config {
  .config-hint {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }
}
</style>
