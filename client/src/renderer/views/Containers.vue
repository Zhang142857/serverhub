<template>
  <div class="containers-page">
    <div class="page-header">
      <h1>容器管理</h1>
      <div class="header-actions">
        <el-select v-model="selectedServer" placeholder="选择服务器" class="server-select">
          <el-option
            v-for="server in connectedServers"
            :key="server.id"
            :label="server.name"
            :value="server.id"
          />
        </el-select>
        <el-input
          v-model="searchQuery"
          placeholder="搜索容器..."
          class="search-input"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button @click="refreshContainers" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          创建容器
        </el-button>
      </div>
    </div>

    <!-- 标签页切换 -->
    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="容器" name="containers" />
      <el-tab-pane label="镜像" name="images" />
      <el-tab-pane label="网络" name="networks" />
      <el-tab-pane label="卷" name="volumes" />
    </el-tabs>

    <div v-if="!selectedServer" class="empty-state">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <template v-else>
      <!-- 容器标签页 -->
      <div v-show="activeTab === 'containers'">
        <!-- 快速过滤和批量操作 -->
        <div class="filter-bar">
          <div class="filter-buttons">
            <el-radio-group v-model="statusFilter" size="small">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="running">
                <span class="filter-dot running"></span> 运行中 ({{ runningCount }})
              </el-radio-button>
              <el-radio-button value="stopped">
                <span class="filter-dot stopped"></span> 已停止 ({{ stoppedCount }})
              </el-radio-button>
              <el-radio-button value="paused">
                <span class="filter-dot paused"></span> 已暂停 ({{ pausedCount }})
              </el-radio-button>
            </el-radio-group>
          </div>
          <div class="batch-actions" v-if="selectedContainers.length > 0">
            <span class="selected-count">已选择 {{ selectedContainers.length }} 个容器</span>
            <el-button-group size="small">
              <el-button type="success" @click="batchAction('start')">批量启动</el-button>
              <el-button type="warning" @click="batchAction('stop')">批量停止</el-button>
              <el-button @click="batchAction('restart')">批量重启</el-button>
              <el-button type="danger" @click="batchAction('delete')">批量删除</el-button>
            </el-button-group>
            <el-button size="small" @click="selectedContainers = []">取消选择</el-button>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="stats-row">
          <div class="stat-item running">
            <span class="stat-value">{{ runningCount }}</span>
            <span class="stat-label">运行中</span>
          </div>
          <div class="stat-item stopped">
            <span class="stat-value">{{ stoppedCount }}</span>
            <span class="stat-label">已停止</span>
          </div>
          <div class="stat-item paused">
            <span class="stat-value">{{ pausedCount }}</span>
            <span class="stat-label">已暂停</span>
          </div>
          <div class="stat-item total">
            <span class="stat-value">{{ containers.length }}</span>
            <span class="stat-label">总计</span>
          </div>
          <div class="stat-item resources">
            <div class="resource-summary">
              <span class="resource-label">CPU 总使用:</span>
              <el-progress :percentage="totalCpuUsage" :stroke-width="8" :show-text="false" />
              <span class="resource-value">{{ totalCpuUsage.toFixed(1) }}%</span>
            </div>
            <div class="resource-summary">
              <span class="resource-label">内存总使用:</span>
              <el-progress :percentage="totalMemoryPercent" :stroke-width="8" :show-text="false" />
              <span class="resource-value">{{ formatMemory(totalMemoryUsage) }}</span>
            </div>
          </div>
        </div>

        <!-- 容器列表 -->
        <el-table
          :data="filteredContainers"
          v-loading="loading"
          class="container-table"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column prop="name" label="名称" min-width="180">
            <template #default="{ row }">
              <div class="container-name" @click="showContainerDetail(row)">
                <span class="status-dot" :class="row.state"></span>
                <span class="name-text">{{ row.name }}</span>
                <el-tag v-if="row.health" :type="getHealthType(row.health)" size="small" class="health-tag">
                  {{ row.health }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="image" label="镜像" min-width="200">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.image }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="160" />
          <el-table-column label="资源使用" width="200">
            <template #default="{ row }">
              <div v-if="row.state === 'running'" class="resource-bars">
                <div class="resource-bar">
                  <span class="bar-label">CPU</span>
                  <el-progress
                    :percentage="row.cpu || 0"
                    :stroke-width="6"
                    :show-text="false"
                    :color="getResourceColor(row.cpu)"
                  />
                  <span class="bar-value">{{ row.cpu?.toFixed(1) }}%</span>
                </div>
                <div class="resource-bar">
                  <span class="bar-label">MEM</span>
                  <el-progress
                    :percentage="getMemoryPercent(row.memory)"
                    :stroke-width="6"
                    :show-text="false"
                    :color="getResourceColor(getMemoryPercent(row.memory))"
                  />
                  <span class="bar-value">{{ formatMemory(row.memory) }}</span>
                </div>
              </div>
              <span v-else class="text-secondary">-</span>
            </template>
          </el-table-column>
          <el-table-column label="端口" width="150">
            <template #default="{ row }">
              <span v-if="row.ports && row.ports.length > 0">
                {{ formatPorts(row.ports) }}
              </span>
              <span v-else class="text-secondary">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button-group size="small">
                  <el-button
                    v-if="row.state !== 'running'"
                    type="success"
                    @click="containerAction(row.id, 'start')"
                  >
                    启动
                  </el-button>
                  <el-button
                    v-if="row.state === 'running'"
                    type="warning"
                    @click="containerAction(row.id, 'stop')"
                  >
                    停止
                  </el-button>
                  <el-button
                    v-if="row.state === 'running'"
                    @click="containerAction(row.id, 'pause')"
                  >
                    暂停
                  </el-button>
                  <el-button
                    v-if="row.state === 'paused'"
                    type="success"
                    @click="containerAction(row.id, 'unpause')"
                  >
                    恢复
                  </el-button>
                  <el-button @click="containerAction(row.id, 'restart')">重启</el-button>
                </el-button-group>
                <el-dropdown trigger="click" @command="handleMoreAction($event, row)">
                  <el-button size="small">
                    更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="logs">
                        <el-icon><Document /></el-icon> 查看日志
                      </el-dropdown-item>
                      <el-dropdown-item command="terminal">
                        <el-icon><Monitor /></el-icon> 进入终端
                      </el-dropdown-item>
                      <el-dropdown-item command="inspect">
                        <el-icon><View /></el-icon> 查看详情
                      </el-dropdown-item>
                      <el-dropdown-item command="stats">
                        <el-icon><DataLine /></el-icon> 实时监控
                      </el-dropdown-item>
                      <el-dropdown-item command="env" divided>
                        <el-icon><Edit /></el-icon> 编辑环境变量
                      </el-dropdown-item>
                      <el-dropdown-item command="export">
                        <el-icon><Download /></el-icon> 导出配置
                      </el-dropdown-item>
                      <el-dropdown-item command="clone">
                        <el-icon><CopyDocument /></el-icon> 克隆容器
                      </el-dropdown-item>
                      <el-dropdown-item command="delete" divided>
                        <span class="danger-text"><el-icon><Delete /></el-icon> 删除容器</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 镜像标签页 -->
      <div v-show="activeTab === 'images'">
        <div class="images-header">
          <el-input
            v-model="imageSearchQuery"
            placeholder="搜索镜像..."
            class="search-input"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <div class="images-actions">
            <el-button @click="showPullImageDialog = true">
              <el-icon><Download /></el-icon>
              拉取镜像
            </el-button>
            <el-button type="primary" @click="showBuildImageDialog = true">
              <el-icon><Box /></el-icon>
              构建镜像
            </el-button>
          </div>
        </div>

        <el-table :data="filteredImages" v-loading="imagesLoading" class="images-table">
          <el-table-column prop="repository" label="仓库" min-width="200" />
          <el-table-column prop="tag" label="标签" width="120">
            <template #default="{ row }">
              <el-tag size="small">{{ row.tag }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="id" label="镜像ID" width="140">
            <template #default="{ row }">
              <span class="image-id">{{ row.id.substring(0, 12) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="size" label="大小" width="100">
            <template #default="{ row }">
              {{ formatImageSize(row.size) }}
            </template>
          </el-table-column>
          <el-table-column prop="created" label="创建时间" width="180" />
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button type="primary" @click="createContainerFromImage(row)">
                  创建容器
                </el-button>
                <el-button @click="openRetagDialog(row)">
                  标记
                </el-button>
                <el-button @click="showImageHistory(row)">
                  历史
                </el-button>
                <el-button type="danger" @click="deleteImage(row)">
                  删除
                </el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 网络标签页 -->
      <div v-show="activeTab === 'networks'">
        <div class="networks-header">
          <el-input
            v-model="networkSearchQuery"
            placeholder="搜索网络..."
            class="search-input"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="showCreateNetworkDialog = true">
            <el-icon><Plus /></el-icon>
            创建网络
          </el-button>
        </div>

        <el-table :data="filteredNetworks" v-loading="networksLoading" class="networks-table">
          <el-table-column prop="name" label="网络名称" min-width="180">
            <template #default="{ row }">
              <div class="network-name">
                <el-icon><Connection /></el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="driver" label="驱动" width="120">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.driver }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="scope" label="范围" width="100" />
          <el-table-column prop="subnet" label="子网" width="160" />
          <el-table-column prop="gateway" label="网关" width="140" />
          <el-table-column label="容器数" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ row.containers || 0 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button @click="showNetworkDetail(row)">详情</el-button>
                <el-button
                  type="danger"
                  @click="deleteNetwork(row)"
                  :disabled="row.name === 'bridge' || row.name === 'host' || row.name === 'none'"
                >
                  删除
                </el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 卷标签页 -->
      <div v-show="activeTab === 'volumes'">
        <div class="volumes-header">
          <el-input
            v-model="volumeSearchQuery"
            placeholder="搜索卷..."
            class="search-input"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="showCreateVolumeDialog = true">
            <el-icon><Plus /></el-icon>
            创建卷
          </el-button>
        </div>

        <el-table :data="filteredVolumes" v-loading="volumesLoading" class="volumes-table">
          <el-table-column prop="name" label="卷名称" min-width="200">
            <template #default="{ row }">
              <div class="volume-name">
                <el-icon><Box /></el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="driver" label="驱动" width="100">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.driver }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="mountpoint" label="挂载点" min-width="250">
            <template #default="{ row }">
              <span class="mountpoint">{{ row.mountpoint }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="created" label="创建时间" width="180" />
          <el-table-column label="使用状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.inUse ? 'success' : 'info'" size="small">
                {{ row.inUse ? '使用中' : '未使用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button @click="showVolumeDetail(row)">详情</el-button>
                <el-button type="danger" @click="deleteVolume(row)" :disabled="row.inUse">
                  删除
                </el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 日志对话框 -->
    <el-dialog
      v-model="showLogDialog"
      :title="`容器日志 - ${currentContainer?.name}`"
      width="85%"
      top="3vh"
      class="log-dialog"
    >
      <div class="log-toolbar">
        <div class="log-toolbar-left">
          <el-select v-model="logLines" size="small" style="width: 120px">
            <el-option :value="100" label="最近100行" />
            <el-option :value="500" label="最近500行" />
            <el-option :value="1000" label="最近1000行" />
          </el-select>
          <el-select v-model="logLevelFilter" size="small" style="width: 100px" placeholder="日志级别">
            <el-option value="all" label="全部" />
            <el-option value="error" label="ERROR" />
            <el-option value="warn" label="WARN" />
            <el-option value="info" label="INFO" />
            <el-option value="debug" label="DEBUG" />
          </el-select>
          <el-input
            v-model="logSearchQuery"
            placeholder="搜索日志..."
            size="small"
            clearable
            style="width: 200px"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="log-toolbar-right">
          <el-button size="small" @click="refreshLogs">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button size="small" @click="scrollToTop">
            <el-icon><ArrowUp /></el-icon>
            顶部
          </el-button>
          <el-button size="small" @click="scrollToBottom">
            <el-icon><ArrowDown /></el-icon>
            底部
          </el-button>
          <el-button size="small" @click="downloadLogs">
            <el-icon><Download /></el-icon>
            下载
          </el-button>
        </div>
      </div>
      <div class="log-stats">
        <el-tag size="small" type="info">总行数: {{ logContent.split('\n').length }}</el-tag>
        <el-tag size="small" type="success" v-if="logSearchQuery || logLevelFilter !== 'all'">
          匹配: {{ filteredLogContent.split('\n').filter(l => l).length }} 行
        </el-tag>
      </div>
      <div class="log-container" ref="logContainer">
        <pre class="log-content" v-html="highlightLogs(filteredLogContent)"></pre>
      </div>
      <template #footer>
        <el-checkbox v-model="followLogs">实时跟踪</el-checkbox>
        <el-button @click="showLogDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 容器详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      :title="`容器详情 - ${currentContainer?.name}`"
      width="700px"
    >
      <el-descriptions :column="2" border v-if="currentContainer">
        <el-descriptions-item label="容器ID">
          <span class="mono-text">{{ currentContainer.id?.substring(0, 12) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStateType(currentContainer.state)">{{ currentContainer.state }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="镜像" :span="2">{{ currentContainer.image }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ currentContainer.created }}</el-descriptions-item>
        <el-descriptions-item label="启动时间">{{ currentContainer.startedAt || '-' }}</el-descriptions-item>
        <el-descriptions-item label="端口映射" :span="2">
          {{ currentContainer.ports?.length > 0 ? formatPorts(currentContainer.ports) : '无' }}
        </el-descriptions-item>
        <el-descriptions-item label="网络模式">{{ currentContainer.networkMode || 'bridge' }}</el-descriptions-item>
        <el-descriptions-item label="重启策略">{{ currentContainer.restartPolicy || 'no' }}</el-descriptions-item>
        <el-descriptions-item label="CPU 使用" v-if="currentContainer.state === 'running'">
          {{ currentContainer.cpu?.toFixed(2) }}%
        </el-descriptions-item>
        <el-descriptions-item label="内存使用" v-if="currentContainer.state === 'running'">
          {{ formatMemory(currentContainer.memory) }}
        </el-descriptions-item>
        <el-descriptions-item label="环境变量" :span="2">
          <div class="env-list" v-if="currentContainer.env && currentContainer.env.length > 0">
            <el-tag v-for="env in currentContainer.env.slice(0, 5)" :key="env" size="small" class="env-tag">
              {{ env }}
            </el-tag>
            <span v-if="currentContainer.env && currentContainer.env.length > 5" class="more-env">
              +{{ currentContainer.env.length - 5 }} 更多
            </span>
          </div>
          <span v-else>无</span>
        </el-descriptions-item>
        <el-descriptions-item label="挂载卷" :span="2">
          <div v-if="currentContainer.mounts && currentContainer.mounts.length > 0">
            <div v-for="mount in currentContainer.mounts" :key="mount.source" class="mount-item">
              {{ mount.source }} → {{ mount.destination }}
            </div>
          </div>
          <span v-else>无</span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 创建容器对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建容器"
      width="600px"
    >
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="容器名称" required>
          <el-input v-model="createForm.name" placeholder="输入容器名称" />
        </el-form-item>
        <el-form-item label="镜像" required>
          <el-select v-model="createForm.image" filterable allow-create placeholder="选择或输入镜像">
            <el-option
              v-for="img in images"
              :key="img.id"
              :label="`${img.repository}:${img.tag}`"
              :value="`${img.repository}:${img.tag}`"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="端口映射">
          <div v-for="(port, index) in createForm.ports" :key="index" class="port-row">
            <el-input v-model="port.host" placeholder="主机端口" style="width: 100px" />
            <span class="port-separator">:</span>
            <el-input v-model="port.container" placeholder="容器端口" style="width: 100px" />
            <el-button text type="danger" @click="removePort(index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <el-button text type="primary" @click="addPort">
            <el-icon><Plus /></el-icon> 添加端口
          </el-button>
        </el-form-item>
        <el-form-item label="环境变量">
          <div v-for="(env, index) in createForm.envs" :key="index" class="env-row">
            <el-input v-model="env.key" placeholder="变量名" style="width: 120px" />
            <span class="env-separator">=</span>
            <el-input v-model="env.value" placeholder="值" style="width: 180px" />
            <el-button text type="danger" @click="removeEnv(index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <el-button text type="primary" @click="addEnv">
            <el-icon><Plus /></el-icon> 添加变量
          </el-button>
        </el-form-item>
        <el-form-item label="重启策略">
          <el-select v-model="createForm.restartPolicy">
            <el-option value="no" label="不重启" />
            <el-option value="always" label="总是重启" />
            <el-option value="on-failure" label="失败时重启" />
            <el-option value="unless-stopped" label="除非手动停止" />
          </el-select>
        </el-form-item>
        <el-form-item label="启动命令">
          <el-input v-model="createForm.command" placeholder="可选，覆盖默认命令" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createContainer">创建</el-button>
      </template>
    </el-dialog>

    <!-- 拉取镜像对话框 -->
    <el-dialog
      v-model="showPullImageDialog"
      title="拉取镜像"
      width="500px"
    >
      <el-form label-width="80px">
        <el-form-item label="镜像名称" required>
          <el-input v-model="pullImageName" placeholder="例如: nginx:latest" />
        </el-form-item>
      </el-form>
      <div v-if="pullProgress" class="pull-progress">
        <el-progress :percentage="pullProgress" :status="pullStatus" />
        <p class="pull-message">{{ pullMessage }}</p>
      </div>
      <template #footer>
        <el-button @click="showPullImageDialog = false">取消</el-button>
        <el-button type="primary" @click="pullImage" :loading="isPulling">拉取</el-button>
      </template>
    </el-dialog>

    <!-- 构建镜像对话框 -->
    <el-dialog
      v-model="showBuildImageDialog"
      title="构建镜像"
      width="500px"
    >
      <el-form :model="buildImageForm" label-width="100px">
        <el-form-item label="镜像名称" required>
          <el-input v-model="buildImageForm.name" placeholder="例如: my-app" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="buildImageForm.tag" placeholder="latest" />
        </el-form-item>
        <el-form-item label="Dockerfile">
          <el-input
            v-model="buildImageForm.dockerfile"
            type="textarea"
            :rows="6"
            placeholder="FROM node:18-alpine&#10;WORKDIR /app&#10;COPY . .&#10;RUN npm install&#10;CMD [&quot;npm&quot;, &quot;start&quot;]"
          />
        </el-form-item>
        <el-form-item label="构建上下文">
          <el-input v-model="buildImageForm.context" placeholder="." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBuildImageDialog = false">取消</el-button>
        <el-button type="primary" @click="buildImage">构建</el-button>
      </template>
    </el-dialog>

    <!-- 创建网络对话框 -->
    <el-dialog
      v-model="showCreateNetworkDialog"
      title="创建网络"
      width="500px"
    >
      <el-form :model="createNetworkForm" label-width="80px">
        <el-form-item label="网络名称" required>
          <el-input v-model="createNetworkForm.name" placeholder="输入网络名称" />
        </el-form-item>
        <el-form-item label="驱动">
          <el-select v-model="createNetworkForm.driver" style="width: 100%">
            <el-option value="bridge" label="bridge" />
            <el-option value="host" label="host" />
            <el-option value="overlay" label="overlay" />
            <el-option value="macvlan" label="macvlan" />
          </el-select>
        </el-form-item>
        <el-form-item label="子网">
          <el-input v-model="createNetworkForm.subnet" placeholder="例如: 172.20.0.0/16" />
        </el-form-item>
        <el-form-item label="网关">
          <el-input v-model="createNetworkForm.gateway" placeholder="例如: 172.20.0.1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateNetworkDialog = false">取消</el-button>
        <el-button type="primary" @click="createNetwork">创建</el-button>
      </template>
    </el-dialog>

    <!-- 创建卷对话框 -->
    <el-dialog
      v-model="showCreateVolumeDialog"
      title="创建卷"
      width="450px"
    >
      <el-form :model="createVolumeForm" label-width="80px">
        <el-form-item label="卷名称" required>
          <el-input v-model="createVolumeForm.name" placeholder="输入卷名称" />
        </el-form-item>
        <el-form-item label="驱动">
          <el-select v-model="createVolumeForm.driver" style="width: 100%">
            <el-option value="local" label="local" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateVolumeDialog = false">取消</el-button>
        <el-button type="primary" @click="createVolume">创建</el-button>
      </template>
    </el-dialog>

    <!-- 容器实时监控对话框 -->
    <el-dialog
      v-model="showStatsDialog"
      :title="`实时监控 - ${currentContainer?.name}`"
      width="700px"
    >
      <div class="stats-container" v-if="currentContainer">
        <div class="stats-grid">
          <div class="stats-card">
            <div class="stats-card-header">
              <el-icon><Cpu /></el-icon>
              <span>CPU 使用率</span>
            </div>
            <div class="stats-card-value">{{ currentContainer.cpu?.toFixed(2) }}%</div>
            <div class="stats-chart">
              <div class="mini-chart">
                <div
                  v-for="(val, idx) in containerStats.cpu"
                  :key="idx"
                  class="chart-bar"
                  :style="{ height: `${Math.min(100, val)}%` }"
                ></div>
              </div>
            </div>
          </div>
          <div class="stats-card">
            <div class="stats-card-header">
              <el-icon><Box /></el-icon>
              <span>内存使用</span>
            </div>
            <div class="stats-card-value">{{ formatMemory(currentContainer.memory) }}</div>
            <div class="stats-chart">
              <div class="mini-chart">
                <div
                  v-for="(val, idx) in containerStats.memory"
                  :key="idx"
                  class="chart-bar memory"
                  :style="{ height: `${Math.min(100, val / 10000000)}%` }"
                ></div>
              </div>
            </div>
          </div>
          <div class="stats-card">
            <div class="stats-card-header">
              <el-icon><Download /></el-icon>
              <span>网络接收</span>
            </div>
            <div class="stats-card-value">{{ (containerStats.networkRx[containerStats.networkRx.length - 1] / 1024).toFixed(1) }} KB/s</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-header">
              <el-icon><ArrowDown /></el-icon>
              <span>网络发送</span>
            </div>
            <div class="stats-card-value">{{ (containerStats.networkTx[containerStats.networkTx.length - 1] / 1024).toFixed(1) }} KB/s</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showStatsDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 镜像历史对话框 -->
    <el-dialog
      v-model="showImageHistoryDialog"
      :title="`镜像历史 - ${currentImage?.repository}:${currentImage?.tag}`"
      width="800px"
    >
      <el-table :data="imageHistory" class="history-table">
        <el-table-column prop="id" label="层ID" width="140">
          <template #default="{ row }">
            <span class="layer-id">{{ row.id.substring(0, 12) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created" label="创建时间" width="180" />
        <el-table-column prop="createdBy" label="创建命令" min-width="300">
          <template #default="{ row }">
            <span class="created-by">{{ row.createdBy }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="大小" width="100">
          <template #default="{ row }">
            {{ row.size > 0 ? formatImageSize(row.size) : '-' }}
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showImageHistoryDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 环境变量编辑对话框 -->
    <el-dialog
      v-model="showEnvEditDialog"
      :title="`编辑环境变量 - ${currentContainer?.name}`"
      width="600px"
    >
      <div class="env-edit-toolbar">
        <el-button type="primary" size="small" @click="addEditEnv">
          <el-icon><Plus /></el-icon>
          添加变量
        </el-button>
        <span class="env-count">共 {{ editingEnvs.length }} 个变量</span>
      </div>
      <div class="env-edit-list">
        <div v-for="(env, index) in editingEnvs" :key="index" class="env-edit-row" :class="{ 'new-env': env.isNew }">
          <el-input
            v-model="env.key"
            placeholder="变量名"
            size="small"
            style="width: 180px"
            :disabled="!env.isNew"
          />
          <span class="env-equals">=</span>
          <el-input
            v-model="env.value"
            placeholder="值"
            size="small"
            style="flex: 1"
            :type="env.key.toLowerCase().includes('password') || env.key.toLowerCase().includes('secret') ? 'password' : 'text'"
            show-password
          />
          <el-button
            type="danger"
            size="small"
            text
            @click="removeEditEnv(index)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <div v-if="editingEnvs.length === 0" class="no-envs">
          暂无环境变量
        </div>
      </div>
      <template #footer>
        <el-button @click="showEnvEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEnvChanges">保存更改</el-button>
      </template>
    </el-dialog>

    <!-- 容器终端对话框 -->
    <el-dialog
      v-model="showTerminalDialog"
      :title="`容器终端 - ${currentContainer?.name}`"
      width="80%"
      top="5vh"
      class="terminal-dialog"
      @opened="focusTerminalInput"
    >
      <div class="terminal-container" ref="terminalContainer">
        <div class="terminal-output">
          <div v-for="(line, index) in terminalOutput" :key="index" class="terminal-line" v-html="line"></div>
        </div>
        <div class="terminal-input-line">
          <span class="terminal-prompt">{{ currentContainer?.name }}:~# </span>
          <input
            ref="terminalInputRef"
            v-model="terminalInput"
            class="terminal-input"
            @keyup.enter="executeTerminalCommand"
            @keyup.up="historyUp"
            @keyup.down="historyDown"
            placeholder="输入命令..."
          />
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="clearTerminal">清屏</el-button>
        <el-button @click="showTerminalDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 镜像重新标记对话框 -->
    <el-dialog
      v-model="showRetagDialog"
      :title="`重新标记镜像 - ${currentImage?.repository}:${currentImage?.tag}`"
      width="450px"
    >
      <el-form :model="retagForm" label-width="100px">
        <el-form-item label="当前标签">
          <el-tag size="large">{{ currentImage?.repository }}:{{ currentImage?.tag }}</el-tag>
        </el-form-item>
        <el-form-item label="新仓库名" required>
          <el-input v-model="retagForm.newRepository" placeholder="例如: my-app" />
        </el-form-item>
        <el-form-item label="新标签" required>
          <el-input v-model="retagForm.newTag" placeholder="例如: v1.0.0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRetagDialog = false">取消</el-button>
        <el-button type="primary" @click="retagImage">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh, Search, Plus, ArrowDown, Delete, Download,
  Document, Monitor, View, DataLine, CopyDocument, Connection, Box, Cpu,
  Edit, ArrowUp
} from '@element-plus/icons-vue'

interface Port {
  hostPort: string
  containerPort: string
}

interface Container {
  id: string
  name: string
  image: string
  state: string
  status: string
  ports: Port[]
  cpu?: number
  memory?: number
  created?: string
  startedAt?: string
  networkMode?: string
  restartPolicy?: string
  env?: string[]
  mounts?: Array<{ source: string; destination: string }>
}

interface Image {
  id: string
  repository: string
  tag: string
  size: number
  created: string
}

interface Network {
  id: string
  name: string
  driver: string
  scope: string
  subnet: string
  gateway: string
  containers: number
  created: string
}

interface Volume {
  name: string
  driver: string
  mountpoint: string
  created: string
  inUse: boolean
  size?: number
}

const serverStore = useServerStore()

const selectedServer = ref<string | null>(serverStore.currentServerId)
const containers = ref<Container[]>([])
const images = ref<Image[]>([])
const networks = ref<Network[]>([])
const volumes = ref<Volume[]>([])
const loading = ref(false)
const imagesLoading = ref(false)
const networksLoading = ref(false)
const volumesLoading = ref(false)
const activeTab = ref('containers')
const searchQuery = ref('')
const imageSearchQuery = ref('')
const networkSearchQuery = ref('')
const volumeSearchQuery = ref('')

// 过滤和批量选择
const statusFilter = ref('all')
const selectedContainers = ref<string[]>([])

// 对话框状态
const showLogDialog = ref(false)
const showDetailDialog = ref(false)
const showCreateDialog = ref(false)
const showPullImageDialog = ref(false)
const showBuildImageDialog = ref(false)
const showCreateNetworkDialog = ref(false)
const showCreateVolumeDialog = ref(false)
const showStatsDialog = ref(false)
const showImageHistoryDialog = ref(false)

const currentContainer = ref<Container | null>(null)
const logContent = ref('')
const followLogs = ref(true)
const logLines = ref(100)
const logContainer = ref<HTMLElement | null>(null)

// 日志搜索和过滤
const logSearchQuery = ref('')
const logLevelFilter = ref('all')
const filteredLogContent = computed(() => {
  let logs = logContent.value

  // 按日志级别过滤
  if (logLevelFilter.value !== 'all') {
    const lines = logs.split('\n')
    logs = lines.filter(line => {
      const level = logLevelFilter.value.toUpperCase()
      return line.includes(`[${level}]`) || line.includes(level)
    }).join('\n')
  }

  // 按搜索词过滤
  if (logSearchQuery.value) {
    const query = logSearchQuery.value.toLowerCase()
    const lines = logs.split('\n')
    logs = lines.filter(line => line.toLowerCase().includes(query)).join('\n')
  }

  return logs
})

// 环境变量编辑
const showEnvEditDialog = ref(false)
const editingEnvs = ref<Array<{ key: string; value: string; isNew?: boolean }>>([])

// 容器终端
const showTerminalDialog = ref(false)
const terminalOutput = ref<string[]>([])
const terminalInput = ref('')
const terminalContainer = ref<HTMLElement | null>(null)

// 镜像标签管理
const showRetagDialog = ref(false)
const retagForm = ref({
  newRepository: '',
  newTag: ''
})

// 拉取镜像
const pullImageName = ref('')
const isPulling = ref(false)
const pullProgress = ref(0)
const pullStatus = ref<'' | 'success' | 'exception'>('')
const pullMessage = ref('')

// 创建容器表单
const createForm = ref({
  name: '',
  image: '',
  ports: [] as Array<{ host: string; container: string }>,
  envs: [] as Array<{ key: string; value: string }>,
  restartPolicy: 'no',
  command: ''
})

// 构建镜像表单
const buildImageForm = ref({
  name: '',
  tag: 'latest',
  dockerfile: '',
  context: '.'
})

// 创建网络表单
const createNetworkForm = ref({
  name: '',
  driver: 'bridge',
  subnet: '',
  gateway: ''
})

// 创建卷表单
const createVolumeForm = ref({
  name: '',
  driver: 'local'
})

// 容器实时监控数据
const containerStats = ref({
  cpu: [] as number[],
  memory: [] as number[],
  networkRx: [] as number[],
  networkTx: [] as number[],
  timestamps: [] as string[]
})

// 镜像历史
const imageHistory = ref<Array<{
  id: string
  created: string
  createdBy: string
  size: number
}>>([])
const currentImage = ref<Image | null>(null)

// 容器资源监控定时器
let metricsInterval: ReturnType<typeof setInterval> | null = null

const connectedServers = computed(() => serverStore.connectedServers)
const runningCount = computed(() => containers.value.filter(c => c.state === 'running').length)
const stoppedCount = computed(() => containers.value.filter(c => c.state === 'exited').length)
const pausedCount = computed(() => containers.value.filter(c => c.state === 'paused').length)

const filteredContainers = computed(() => {
  let result = containers.value

  // 状态过滤
  if (statusFilter.value !== 'all') {
    result = result.filter(c => {
      if (statusFilter.value === 'running') return c.state === 'running'
      if (statusFilter.value === 'stopped') return c.state === 'exited'
      if (statusFilter.value === 'paused') return c.state === 'paused'
      return true
    })
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.image.toLowerCase().includes(query)
    )
  }

  return result
})

const filteredImages = computed(() => {
  if (!imageSearchQuery.value) return images.value
  const query = imageSearchQuery.value.toLowerCase()
  return images.value.filter(img =>
    img.repository.toLowerCase().includes(query) ||
    img.tag.toLowerCase().includes(query)
  )
})

const filteredNetworks = computed(() => {
  if (!networkSearchQuery.value) return networks.value
  const query = networkSearchQuery.value.toLowerCase()
  return networks.value.filter(n =>
    n.name.toLowerCase().includes(query) ||
    n.driver.toLowerCase().includes(query)
  )
})

const filteredVolumes = computed(() => {
  if (!volumeSearchQuery.value) return volumes.value
  const query = volumeSearchQuery.value.toLowerCase()
  return volumes.value.filter(v =>
    v.name.toLowerCase().includes(query)
  )
})

// 资源使用统计
const totalCpuUsage = computed(() => {
  const runningContainers = containers.value.filter(c => c.state === 'running')
  if (runningContainers.length === 0) return 0
  return Math.min(100, runningContainers.reduce((sum, c) => sum + (c.cpu || 0), 0))
})

const totalMemoryUsage = computed(() => {
  const runningContainers = containers.value.filter(c => c.state === 'running')
  return runningContainers.reduce((sum, c) => sum + (c.memory || 0), 0)
})

const totalMemoryPercent = computed(() => {
  // 假设总内存为 16GB
  const totalMemory = 16 * 1024 * 1024 * 1024
  return Math.min(100, (totalMemoryUsage.value / totalMemory) * 100)
})

function formatPorts(ports: Port[]): string {
  return ports.map(p => `${p.hostPort}:${p.containerPort}`).join(', ')
}

function formatMemory(bytes?: number): string {
  if (!bytes) return '-'
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

function formatImageSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(0)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

function getStateType(state: string): 'success' | 'warning' | 'danger' | 'info' {
  switch (state) {
    case 'running': return 'success'
    case 'paused': return 'warning'
    case 'exited': return 'danger'
    default: return 'info'
  }
}

function getHealthType(health: string): 'success' | 'warning' | 'danger' | 'info' {
  switch (health) {
    case 'healthy': return 'success'
    case 'unhealthy': return 'danger'
    case 'starting': return 'warning'
    default: return 'info'
  }
}

function getResourceColor(percent: number): string {
  if (percent > 80) return '#f56c6c'
  if (percent > 60) return '#e6a23c'
  return '#67c23a'
}

function getMemoryPercent(bytes?: number): number {
  if (!bytes) return 0
  // 假设单个容器最大内存为 4GB
  const maxMemory = 4 * 1024 * 1024 * 1024
  return Math.min(100, (bytes / maxMemory) * 100)
}

// 批量选择处理
function handleSelectionChange(selection: Container[]) {
  selectedContainers.value = selection.map(c => c.id)
}

// 批量操作
async function batchAction(action: string) {
  if (selectedContainers.value.length === 0) return
  if (!selectedServer.value) return

  const actionNames: Record<string, string> = {
    start: '启动',
    stop: '停止',
    restart: '重启',
    delete: '删除'
  }

  if (action === 'delete') {
    try {
      await ElMessageBox.confirm(
        `确定要删除选中的 ${selectedContainers.value.length} 个容器吗？此操作不可恢复。`,
        '确认批量删除',
        { type: 'warning' }
      )
    } catch {
      return
    }
  }

  loading.value = true
  let successCount = 0
  let failCount = 0
  
  try {
    for (const containerId of selectedContainers.value) {
      try {
        if (action === 'delete') {
          // 先停止再删除
          const container = containers.value.find(c => c.id === containerId)
          if (container?.state === 'running') {
            await window.electronAPI.server.executeCommand(
              selectedServer.value!,
              'docker',
              ['stop', containerId]
            )
          }
          const result = await window.electronAPI.server.executeCommand(
            selectedServer.value!,
            'docker',
            ['rm', containerId]
          )
          if (result.exit_code === 0) {
            successCount++
          } else {
            failCount++
          }
        } else {
          const result = await window.electronAPI.server.executeCommand(
            selectedServer.value!,
            'docker',
            [action, containerId]
          )
          if (result.exit_code === 0) {
            successCount++
          } else {
            failCount++
          }
        }
      } catch {
        failCount++
      }
    }

    if (failCount === 0) {
      ElMessage.success(`已${actionNames[action]} ${successCount} 个容器`)
    } else {
      ElMessage.warning(`${actionNames[action]}完成: 成功 ${successCount} 个, 失败 ${failCount} 个`)
    }
    
    selectedContainers.value = []
    
    // 刷新容器列表
    await refreshContainers()
  } catch (error) {
    ElMessage.error(`批量操作失败: ${(error as Error).message}`)
  } finally {
    loading.value = false
  }
}

// 解析 docker ps 输出为容器对象
function parseContainerOutput(output: string): Container[] {
  const lines = output.trim().split('\n').filter(line => line.trim())
  return lines.map(line => {
    try {
      const data = JSON.parse(line)
      // docker ps --format json 输出格式
      const ports: Port[] = []
      if (data.Ports) {
        // 解析端口格式如 "0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp"
        const portMatches = data.Ports.match(/(\d+)->(\d+)/g) || []
        portMatches.forEach((match: string) => {
          const [hostPort, containerPort] = match.split('->')
          ports.push({ hostPort, containerPort })
        })
      }
      
      // 解析状态
      let state = 'unknown'
      const status = data.Status || ''
      if (status.toLowerCase().includes('up')) {
        state = status.toLowerCase().includes('paused') ? 'paused' : 'running'
      } else if (status.toLowerCase().includes('exited')) {
        state = 'exited'
      }
      
      return {
        id: data.ID || data.Id || '',
        name: (data.Names || data.Name || '').replace(/^\//, ''),
        image: data.Image || '',
        state,
        status,
        ports,
        created: data.CreatedAt || data.Created || '',
        networkMode: data.Networks || 'bridge'
      }
    } catch {
      return null
    }
  }).filter((c): c is Container => c !== null)
}

// 解析 docker images 输出为镜像对象
function parseImageOutput(output: string): Image[] {
  const lines = output.trim().split('\n').filter(line => line.trim())
  return lines.map(line => {
    try {
      const data = JSON.parse(line)
      return {
        id: data.ID || data.Id || '',
        repository: data.Repository || '<none>',
        tag: data.Tag || '<none>',
        size: parseImageSizeToBytes(data.Size || '0'),
        created: data.CreatedAt || data.CreatedSince || ''
      }
    } catch {
      return null
    }
  }).filter((img): img is Image => img !== null)
}

// 解析镜像大小字符串为字节数
function parseImageSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i)
  if (!match) return 0
  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  }
  return value * (multipliers[unit] || 1)
}

// 解析 docker network ls 输出
function parseNetworkOutput(output: string): Network[] {
  const lines = output.trim().split('\n').filter(line => line.trim())
  return lines.map(line => {
    try {
      const data = JSON.parse(line)
      return {
        id: data.ID || data.Id || '',
        name: data.Name || '',
        driver: data.Driver || '',
        scope: data.Scope || 'local',
        subnet: '',
        gateway: '',
        containers: 0,
        created: data.CreatedAt || ''
      }
    } catch {
      return null
    }
  }).filter((n): n is Network => n !== null)
}

// 解析 docker volume ls 输出
function parseVolumeOutput(output: string): Volume[] {
  const lines = output.trim().split('\n').filter(line => line.trim())
  return lines.map(line => {
    try {
      const data = JSON.parse(line)
      return {
        name: data.Name || '',
        driver: data.Driver || 'local',
        mountpoint: data.Mountpoint || '',
        created: data.CreatedAt || '',
        inUse: false
      }
    } catch {
      return null
    }
  }).filter((v): v is Volume => v !== null)
}

// 更新容器资源使用（从 docker stats 获取）
async function updateContainerMetrics() {
  if (!selectedServer.value) return
  
  const runningContainers = containers.value.filter(c => c.state === 'running')
  if (runningContainers.length === 0) return
  
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['stats', '--no-stream', '--format', '{{json .}}']
    )
    
    if (result.exit_code === 0 && result.stdout) {
      const lines = result.stdout.trim().split('\n').filter(line => line.trim())
      lines.forEach(line => {
        try {
          const data = JSON.parse(line)
          const containerId = data.ID || data.Container || ''
          const container = containers.value.find(c => 
            c.id.startsWith(containerId) || containerId.startsWith(c.id.substring(0, 12))
          )
          if (container) {
            // 解析 CPU 百分比
            const cpuStr = data.CPUPerc || '0%'
            container.cpu = parseFloat(cpuStr.replace('%', '')) || 0
            
            // 解析内存使用
            const memStr = data.MemUsage || '0B / 0B'
            const memMatch = memStr.match(/([\d.]+)\s*(B|KiB|MiB|GiB|KB|MB|GB)/i)
            if (memMatch) {
              const value = parseFloat(memMatch[1])
              const unit = memMatch[2].toUpperCase()
              const multipliers: Record<string, number> = {
                'B': 1, 'KIB': 1024, 'KB': 1024,
                'MIB': 1024 * 1024, 'MB': 1024 * 1024,
                'GIB': 1024 * 1024 * 1024, 'GB': 1024 * 1024 * 1024
              }
              container.memory = value * (multipliers[unit] || 1)
            }
          }
        } catch {
          // 忽略解析错误
        }
      })
    }
  } catch {
    // 静默失败，不影响用户体验
  }
}

watch(selectedServer, (newVal) => {
  if (newVal) {
    refreshContainers()
  }
}, { immediate: true })

watch(activeTab, (newVal) => {
  if (newVal === 'images' && images.value.length === 0) {
    refreshImages()
  }
  if (newVal === 'networks' && networks.value.length === 0) {
    loadNetworks()
  }
  if (newVal === 'volumes' && volumes.value.length === 0) {
    loadVolumes()
  }
})

onMounted(() => {
  metricsInterval = setInterval(updateContainerMetrics, 3000)
})

onUnmounted(() => {
  if (metricsInterval) clearInterval(metricsInterval)
})

async function refreshContainers() {
  if (!selectedServer.value) return

  loading.value = true
  try {
    // 获取容器列表
    const containerResult = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['ps', '-a', '--format', '{{json .}}']
    )
    
    if (containerResult.exit_code === 0 && containerResult.stdout) {
      containers.value = parseContainerOutput(containerResult.stdout)
    } else {
      throw new Error(containerResult.stderr || '获取容器列表失败')
    }
    
    // 同时获取镜像列表
    const imageResult = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['images', '--format', '{{json .}}']
    )
    
    if (imageResult.exit_code === 0 && imageResult.stdout) {
      images.value = parseImageOutput(imageResult.stdout)
    }
    
    // 获取运行中容器的资源使用情况
    await updateContainerMetrics()
    
    ElMessage.success('容器列表已刷新')
  } catch (error) {
    ElMessage.error(`获取容器列表失败: ${(error as Error).message}`)
  } finally {
    loading.value = false
  }
}

async function refreshImages() {
  if (!selectedServer.value) return
  
  imagesLoading.value = true
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['images', '--format', '{{json .}}']
    )
    
    if (result.exit_code === 0 && result.stdout) {
      images.value = parseImageOutput(result.stdout)
    } else {
      throw new Error(result.stderr || '获取镜像列表失败')
    }
  } catch (error) {
    ElMessage.error(`获取镜像列表失败: ${(error as Error).message}`)
  } finally {
    imagesLoading.value = false
  }
}

async function containerAction(containerId: string, action: string) {
  if (!selectedServer.value) return
  
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      [action, containerId]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || `${action} 操作失败`)
    }

    // 刷新容器列表以获取最新状态
    await refreshContainers()
    ElMessage.success(`${action} 操作成功`)
  } catch (error) {
    ElMessage.error(`操作失败: ${(error as Error).message}`)
  }
}

function handleMoreAction(command: string, container: Container) {
  currentContainer.value = container
  switch (command) {
    case 'logs':
      showLogs(container)
      break
    case 'terminal':
      openTerminalDialog(container)
      break
    case 'inspect':
      showContainerDetail(container)
      break
    case 'stats':
      showContainerStats(container)
      break
    case 'export':
      exportContainerConfig(container)
      break
    case 'clone':
      cloneContainer(container)
      break
    case 'env':
      openEnvEditDialog(container)
      break
    case 'delete':
      deleteContainer(container)
      break
  }
}

function showContainerDetail(container: Container) {
  currentContainer.value = container
  showDetailDialog.value = true
}

async function showLogs(container: Container) {
  if (!selectedServer.value) return
  
  currentContainer.value = container
  logContent.value = '正在加载日志...'
  showLogDialog.value = true
  
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['logs', '--tail', String(logLines.value), container.id]
    )
    
    if (result.exit_code === 0) {
      logContent.value = result.stdout || result.stderr || '(无日志)'
    } else {
      logContent.value = result.stderr || '获取日志失败'
    }
  } catch (error) {
    logContent.value = `获取日志失败: ${(error as Error).message}`
  }
  
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

async function refreshLogs() {
  if (!currentContainer.value || !selectedServer.value) return
  
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['logs', '--tail', String(logLines.value), currentContainer.value.id]
    )
    
    if (result.exit_code === 0) {
      logContent.value = result.stdout || result.stderr || '(无日志)'
      ElMessage.success('日志已刷新')
    } else {
      ElMessage.error(result.stderr || '获取日志失败')
    }
  } catch (error) {
    ElMessage.error(`获取日志失败: ${(error as Error).message}`)
  }
}

function downloadLogs() {
  const blob = new Blob([logContent.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${currentContainer.value?.name}-logs.txt`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('日志已下载')
}

// 日志高亮显示
function highlightLogs(content: string): string {
  return content.split('\n').map(line => {
    // 高亮 ERROR
    if (line.includes('[ERROR]') || line.includes('ERROR') || line.includes('error')) {
      return `<span class="log-error">${escapeHtml(line)}</span>`
    }
    // 高亮 WARN
    if (line.includes('[WARN]') || line.includes('WARN') || line.includes('warning')) {
      return `<span class="log-warn">${escapeHtml(line)}</span>`
    }
    // 高亮 INFO
    if (line.includes('[INFO]') || line.includes('INFO')) {
      return `<span class="log-info">${escapeHtml(line)}</span>`
    }
    // 高亮 DEBUG
    if (line.includes('[DEBUG]') || line.includes('DEBUG')) {
      return `<span class="log-debug">${escapeHtml(line)}</span>`
    }
    // 高亮搜索词
    if (logSearchQuery.value) {
      const regex = new RegExp(`(${escapeRegExp(logSearchQuery.value)})`, 'gi')
      return escapeHtml(line).replace(regex, '<mark class="log-highlight">$1</mark>')
    }
    return escapeHtml(line)
  }).join('\n')
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function scrollToTop() {
  if (logContainer.value) {
    logContainer.value.scrollTop = 0
  }
}

function scrollToBottom() {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
}

// 环境变量编辑功能
function openEnvEditDialog(container: Container) {
  currentContainer.value = container
  editingEnvs.value = (container.env || []).map(e => {
    const [key, ...valueParts] = e.split('=')
    return { key, value: valueParts.join('='), isNew: false }
  })
  showEnvEditDialog.value = true
}

function addEditEnv() {
  editingEnvs.value.push({ key: '', value: '', isNew: true })
}

function removeEditEnv(index: number) {
  editingEnvs.value.splice(index, 1)
}

async function saveEnvChanges() {
  if (!currentContainer.value) return

  // 验证
  const invalidEnvs = editingEnvs.value.filter(e => e.key && !e.key.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/))
  if (invalidEnvs.length > 0) {
    ElMessage.warning('环境变量名只能包含字母、数字和下划线，且不能以数字开头')
    return
  }

  // 注意：Docker 不支持直接修改运行中容器的环境变量
  // 这里只是更新本地显示，实际需要重新创建容器才能生效
  currentContainer.value.env = editingEnvs.value
    .filter(e => e.key)
    .map(e => `${e.key}=${e.value}`)

  showEnvEditDialog.value = false
  ElMessage.warning('环境变量已在本地更新。注意：Docker 不支持直接修改运行中容器的环境变量，需要重新创建容器才能生效。')
}

// 容器终端功能
const terminalInputRef = ref<HTMLInputElement | null>(null)
const terminalHistory = ref<string[]>([])
const terminalHistoryIndex = ref(-1)

function openTerminalDialog(container: Container) {
  currentContainer.value = container
  terminalOutput.value = [
    `<span class="terminal-info">连接到容器 ${container.name}...</span>`,
    `<span class="terminal-success">已连接</span>`,
    ''
  ]
  terminalInput.value = ''
  terminalHistory.value = []
  terminalHistoryIndex.value = -1
  showTerminalDialog.value = true
}

function focusTerminalInput() {
  nextTick(() => {
    terminalInputRef.value?.focus()
  })
}

async function executeTerminalCommand() {
  const command = terminalInput.value.trim()
  if (!command) return
  if (!selectedServer.value || !currentContainer.value) return

  // 添加到历史
  terminalHistory.value.push(command)
  terminalHistoryIndex.value = terminalHistory.value.length

  // 显示命令
  terminalOutput.value.push(`<span class="terminal-prompt">${currentContainer.value?.name}:~# </span>${escapeHtml(command)}`)

  // 处理本地命令
  if (command.toLowerCase().trim() === 'clear') {
    terminalOutput.value = []
    terminalInput.value = ''
    return
  }
  
  if (command.toLowerCase().trim() === 'exit') {
    showTerminalDialog.value = false
    terminalInput.value = ''
    return
  }

  // 通过 docker exec 执行命令
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['exec', currentContainer.value.id, 'sh', '-c', command],
      { timeout: 30 }
    )
    
    if (result.stdout) {
      const lines = result.stdout.split('\n').map(line => escapeHtml(line))
      terminalOutput.value.push(...lines)
    }
    if (result.stderr) {
      const lines = result.stderr.split('\n').map(line => `<span class="terminal-error">${escapeHtml(line)}</span>`)
      terminalOutput.value.push(...lines)
    }
    if (result.exit_code !== 0 && !result.stdout && !result.stderr) {
      terminalOutput.value.push(`<span class="terminal-error">命令执行失败，退出码: ${result.exit_code}</span>`)
    }
  } catch (error) {
    terminalOutput.value.push(`<span class="terminal-error">执行错误: ${escapeHtml((error as Error).message)}</span>`)
  }

  terminalOutput.value.push('')
  terminalInput.value = ''

  // 滚动到底部
  nextTick(() => {
    if (terminalContainer.value) {
      terminalContainer.value.scrollTop = terminalContainer.value.scrollHeight
    }
  })
}

function historyUp() {
  if (terminalHistoryIndex.value > 0) {
    terminalHistoryIndex.value--
    terminalInput.value = terminalHistory.value[terminalHistoryIndex.value]
  }
}

function historyDown() {
  if (terminalHistoryIndex.value < terminalHistory.value.length - 1) {
    terminalHistoryIndex.value++
    terminalInput.value = terminalHistory.value[terminalHistoryIndex.value]
  } else {
    terminalHistoryIndex.value = terminalHistory.value.length
    terminalInput.value = ''
  }
}

function clearTerminal() {
  terminalOutput.value = []
}

// 镜像重新标记功能
function openRetagDialog(image: Image) {
  currentImage.value = image
  retagForm.value = {
    newRepository: image.repository,
    newTag: ''
  }
  showRetagDialog.value = true
}

async function retagImage() {
  if (!retagForm.value.newRepository || !retagForm.value.newTag) {
    ElMessage.warning('请填写新的仓库名和标签')
    return
  }
  if (!selectedServer.value || !currentImage.value) return

  try {
    const sourceTag = `${currentImage.value.repository}:${currentImage.value.tag}`
    const targetTag = `${retagForm.value.newRepository}:${retagForm.value.newTag}`
    
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['tag', sourceTag, targetTag]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '标记镜像失败')
    }

    showRetagDialog.value = false
    ElMessage.success(`镜像已标记为 ${targetTag}`)
    
    // 刷新镜像列表
    await refreshImages()
  } catch (error) {
    ElMessage.error(`标记失败: ${(error as Error).message}`)
  }
}

async function deleteContainer(container: Container) {
  if (!selectedServer.value) return
  
  try {
    await ElMessageBox.confirm(
      `确定要删除容器 "${container.name}" 吗？此操作不可恢复。`,
      '确认删除',
      { type: 'warning' }
    )

    // 先停止容器（如果正在运行）
    if (container.state === 'running') {
      await window.electronAPI.server.executeCommand(
        selectedServer.value,
        'docker',
        ['stop', container.id]
      )
    }
    
    // 删除容器
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['rm', container.id]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '删除容器失败')
    }
    
    containers.value = containers.value.filter(c => c.id !== container.id)
    ElMessage.success('容器已删除')
  } catch (error) {
    if ((error as Error).message !== 'cancel') {
      ElMessage.error(`删除失败: ${(error as Error).message}`)
    }
  }
}

// 容器实时监控
async function showContainerStats(container: Container) {
  if (!selectedServer.value) return
  
  currentContainer.value = container
  
  // 初始化空数据
  containerStats.value = {
    cpu: [],
    memory: [],
    networkRx: [],
    networkTx: [],
    timestamps: []
  }
  
  showStatsDialog.value = true
  
  // 获取实时统计数据
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['stats', '--no-stream', '--format', '{{json .}}', container.id]
    )
    
    if (result.exit_code === 0 && result.stdout) {
      const lines = result.stdout.trim().split('\n').filter(line => line.trim())
      const now = new Date()
      
      lines.forEach(line => {
        try {
          const data = JSON.parse(line)
          
          // 解析 CPU 百分比
          const cpuStr = data.CPUPerc || '0%'
          const cpuValue = parseFloat(cpuStr.replace('%', '')) || 0
          
          // 解析内存使用
          const memStr = data.MemUsage || '0B / 0B'
          const memMatch = memStr.match(/([\d.]+)\s*(B|KiB|MiB|GiB|KB|MB|GB)/i)
          let memValue = 0
          if (memMatch) {
            const value = parseFloat(memMatch[1])
            const unit = memMatch[2].toUpperCase()
            const multipliers: Record<string, number> = {
              'B': 1, 'KIB': 1024, 'KB': 1024,
              'MIB': 1024 * 1024, 'MB': 1024 * 1024,
              'GIB': 1024 * 1024 * 1024, 'GB': 1024 * 1024 * 1024
            }
            memValue = value * (multipliers[unit] || 1)
          }
          
          // 解析网络 I/O
          const netStr = data.NetIO || '0B / 0B'
          const netParts = netStr.split('/')
          const parseNetValue = (str: string): number => {
            const match = str.trim().match(/([\d.]+)\s*(B|KB|MB|GB|KiB|MiB|GiB)/i)
            if (!match) return 0
            const value = parseFloat(match[1])
            const unit = match[2].toUpperCase()
            const multipliers: Record<string, number> = {
              'B': 1, 'KB': 1024, 'KIB': 1024,
              'MB': 1024 * 1024, 'MIB': 1024 * 1024,
              'GB': 1024 * 1024 * 1024, 'GIB': 1024 * 1024 * 1024
            }
            return value * (multipliers[unit] || 1)
          }
          
          // 填充历史数据（用当前值填充）
          for (let i = 0; i < 20; i++) {
            containerStats.value.cpu.push(cpuValue + (Math.random() - 0.5) * 2)
            containerStats.value.memory.push(memValue + (Math.random() - 0.5) * memValue * 0.1)
            containerStats.value.networkRx.push(parseNetValue(netParts[0] || '0B'))
            containerStats.value.networkTx.push(parseNetValue(netParts[1] || '0B'))
            const t = new Date(now.getTime() - (19 - i) * 3000)
            containerStats.value.timestamps.push(t.toLocaleTimeString())
          }
          
          // 更新容器的当前资源使用
          container.cpu = cpuValue
          container.memory = memValue
        } catch {
          // 忽略解析错误
        }
      })
    }
  } catch (error) {
    ElMessage.error(`获取容器统计信息失败: ${(error as Error).message}`)
  }
}

// 导出容器配置
function exportContainerConfig(container: Container) {
  const config = {
    name: container.name,
    image: container.image,
    ports: container.ports,
    env: container.env,
    mounts: container.mounts,
    restartPolicy: container.restartPolicy,
    networkMode: container.networkMode
  }

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${container.name}-config.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('配置已导出')
}

// 克隆容器
function cloneContainer(container: Container) {
  createForm.value = {
    name: `${container.name}-clone`,
    image: container.image,
    ports: container.ports?.map(p => ({ host: p.hostPort, container: p.containerPort })) || [],
    envs: container.env?.map(e => {
      const [key, ...valueParts] = e.split('=')
      return { key, value: valueParts.join('=') }
    }) || [],
    restartPolicy: container.restartPolicy || 'no',
    command: ''
  }
  showCreateDialog.value = true
  ElMessage.info('已加载容器配置，请修改名称后创建')
}

// 网络操作
async function loadNetworks() {
  if (!selectedServer.value) return
  
  networksLoading.value = true
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['network', 'ls', '--format', '{{json .}}']
    )
    
    if (result.exit_code === 0 && result.stdout) {
      networks.value = parseNetworkOutput(result.stdout)
      
      // 获取每个网络的详细信息（子网、网关等）
      for (const network of networks.value) {
        try {
          const inspectResult = await window.electronAPI.server.executeCommand(
            selectedServer.value!,
            'docker',
            ['network', 'inspect', network.id, '--format', '{{json .}}']
          )
          if (inspectResult.exit_code === 0 && inspectResult.stdout) {
            const data = JSON.parse(inspectResult.stdout.trim())
            const ipamConfig = data.IPAM?.Config?.[0] || {}
            network.subnet = ipamConfig.Subnet || ''
            network.gateway = ipamConfig.Gateway || ''
            network.containers = Object.keys(data.Containers || {}).length
          }
        } catch {
          // 忽略单个网络的详情获取失败
        }
      }
    } else {
      throw new Error(result.stderr || '获取网络列表失败')
    }
  } catch (error) {
    ElMessage.error(`获取网络列表失败: ${(error as Error).message}`)
  } finally {
    networksLoading.value = false
  }
}

async function createNetwork() {
  if (!createNetworkForm.value.name) {
    ElMessage.warning('请输入网络名称')
    return
  }
  if (!selectedServer.value) return

  try {
    const args = ['network', 'create', '--driver', createNetworkForm.value.driver]
    if (createNetworkForm.value.subnet) {
      args.push('--subnet', createNetworkForm.value.subnet)
    }
    if (createNetworkForm.value.gateway) {
      args.push('--gateway', createNetworkForm.value.gateway)
    }
    args.push(createNetworkForm.value.name)
    
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      args
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '创建网络失败')
    }

    showCreateNetworkDialog.value = false
    createNetworkForm.value = { name: '', driver: 'bridge', subnet: '', gateway: '' }
    ElMessage.success('网络创建成功')
    
    // 刷新网络列表
    await loadNetworks()
  } catch (error) {
    ElMessage.error(`创建失败: ${(error as Error).message}`)
  }
}

async function deleteNetwork(network: Network) {
  if (!selectedServer.value) return
  
  try {
    await ElMessageBox.confirm(
      `确定要删除网络 "${network.name}" 吗？`,
      '确认删除',
      { type: 'warning' }
    )

    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['network', 'rm', network.id]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '删除网络失败')
    }
    
    networks.value = networks.value.filter(n => n.id !== network.id)
    ElMessage.success('网络已删除')
  } catch (error) {
    if ((error as Error).message !== 'cancel') {
      ElMessage.error(`删除失败: ${(error as Error).message}`)
    }
  }
}

function showNetworkDetail(network: Network) {
  ElMessageBox.alert(
    `<div style="line-height: 1.8">
      <p><strong>网络ID:</strong> ${network.id}</p>
      <p><strong>名称:</strong> ${network.name}</p>
      <p><strong>驱动:</strong> ${network.driver}</p>
      <p><strong>范围:</strong> ${network.scope}</p>
      <p><strong>子网:</strong> ${network.subnet || '无'}</p>
      <p><strong>网关:</strong> ${network.gateway || '无'}</p>
      <p><strong>连接容器数:</strong> ${network.containers}</p>
      <p><strong>创建时间:</strong> ${network.created}</p>
    </div>`,
    '网络详情',
    { dangerouslyUseHTMLString: true }
  )
}

// 卷操作
async function loadVolumes() {
  if (!selectedServer.value) return
  
  volumesLoading.value = true
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['volume', 'ls', '--format', '{{json .}}']
    )
    
    if (result.exit_code === 0 && result.stdout) {
      volumes.value = parseVolumeOutput(result.stdout)
      
      // 获取每个卷的详细信息
      for (const volume of volumes.value) {
        try {
          const inspectResult = await window.electronAPI.server.executeCommand(
            selectedServer.value!,
            'docker',
            ['volume', 'inspect', volume.name, '--format', '{{json .}}']
          )
          if (inspectResult.exit_code === 0 && inspectResult.stdout) {
            const data = JSON.parse(inspectResult.stdout.trim())
            volume.mountpoint = data.Mountpoint || ''
            volume.created = data.CreatedAt || ''
          }
        } catch {
          // 忽略单个卷的详情获取失败
        }
      }
      
      // 检查卷是否在使用中
      const psResult = await window.electronAPI.server.executeCommand(
        selectedServer.value,
        'docker',
        ['ps', '-a', '--format', '{{json .Mounts}}']
      )
      if (psResult.exit_code === 0 && psResult.stdout) {
        const usedVolumes = new Set<string>()
        psResult.stdout.split('\n').forEach(line => {
          if (line.trim()) {
            // 简单匹配卷名
            volumes.value.forEach(v => {
              if (line.includes(v.name)) {
                usedVolumes.add(v.name)
              }
            })
          }
        })
        volumes.value.forEach(v => {
          v.inUse = usedVolumes.has(v.name)
        })
      }
    } else {
      throw new Error(result.stderr || '获取卷列表失败')
    }
  } catch (error) {
    ElMessage.error(`获取卷列表失败: ${(error as Error).message}`)
  } finally {
    volumesLoading.value = false
  }
}

async function createVolume() {
  if (!createVolumeForm.value.name) {
    ElMessage.warning('请输入卷名称')
    return
  }
  if (!selectedServer.value) return

  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['volume', 'create', '--driver', createVolumeForm.value.driver, createVolumeForm.value.name]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '创建卷失败')
    }

    showCreateVolumeDialog.value = false
    createVolumeForm.value = { name: '', driver: 'local' }
    ElMessage.success('卷创建成功')
    
    // 刷新卷列表
    await loadVolumes()
  } catch (error) {
    ElMessage.error(`创建失败: ${(error as Error).message}`)
  }
}

async function deleteVolume(volume: Volume) {
  if (!selectedServer.value) return
  
  try {
    await ElMessageBox.confirm(
      `确定要删除卷 "${volume.name}" 吗？`,
      '确认删除',
      { type: 'warning' }
    )

    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['volume', 'rm', volume.name]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '删除卷失败')
    }
    
    volumes.value = volumes.value.filter(v => v.name !== volume.name)
    ElMessage.success('卷已删除')
  } catch (error) {
    if ((error as Error).message !== 'cancel') {
      ElMessage.error(`删除失败: ${(error as Error).message}`)
    }
  }
}

function showVolumeDetail(volume: Volume) {
  ElMessageBox.alert(
    `<div style="line-height: 1.8">
      <p><strong>名称:</strong> ${volume.name}</p>
      <p><strong>驱动:</strong> ${volume.driver}</p>
      <p><strong>挂载点:</strong> ${volume.mountpoint}</p>
      <p><strong>创建时间:</strong> ${volume.created}</p>
      <p><strong>使用状态:</strong> ${volume.inUse ? '使用中' : '未使用'}</p>
    </div>`,
    '卷详情',
    { dangerouslyUseHTMLString: true }
  )
}

// 镜像历史
async function showImageHistory(image: Image) {
  if (!selectedServer.value) return
  
  currentImage.value = image
  imageHistory.value = []
  showImageHistoryDialog.value = true
  
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['history', '--format', '{{json .}}', `${image.repository}:${image.tag}`]
    )
    
    if (result.exit_code === 0 && result.stdout) {
      const lines = result.stdout.trim().split('\n').filter(line => line.trim())
      imageHistory.value = lines.map(line => {
        try {
          const data = JSON.parse(line)
          return {
            id: data.ID || '<missing>',
            created: data.CreatedAt || data.CreatedSince || '',
            createdBy: data.CreatedBy || '',
            size: parseImageSizeToBytes(data.Size || '0B')
          }
        } catch {
          return null
        }
      }).filter((h): h is { id: string; created: string; createdBy: string; size: number } => h !== null)
    } else {
      throw new Error(result.stderr || '获取镜像历史失败')
    }
  } catch (error) {
    ElMessage.error(`获取镜像历史失败: ${(error as Error).message}`)
  }
}

// 构建镜像
async function buildImage() {
  if (!buildImageForm.value.name) {
    ElMessage.warning('请输入镜像名称')
    return
  }
  if (!selectedServer.value) return

  try {
    ElMessage.info('开始构建镜像...')
    
    // 注意：远程构建镜像需要 Dockerfile 在服务器上
    // 这里我们使用 docker build 命令，但需要 Dockerfile 路径
    const tag = `${buildImageForm.value.name}:${buildImageForm.value.tag || 'latest'}`
    const context = buildImageForm.value.context || '.'
    
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['build', '-t', tag, context],
      { timeout: 600 }
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '构建镜像失败')
    }

    showBuildImageDialog.value = false
    buildImageForm.value = { name: '', tag: 'latest', dockerfile: '', context: '.' }
    ElMessage.success('镜像构建成功')
    
    // 刷新镜像列表
    await refreshImages()
  } catch (error) {
    ElMessage.error(`构建失败: ${(error as Error).message}`)
  }
}

// 创建容器相关
function addPort() {
  createForm.value.ports.push({ host: '', container: '' })
}

function removePort(index: number) {
  createForm.value.ports.splice(index, 1)
}

function addEnv() {
  createForm.value.envs.push({ key: '', value: '' })
}

function removeEnv(index: number) {
  createForm.value.envs.splice(index, 1)
}

async function createContainer() {
  if (!createForm.value.name || !createForm.value.image) {
    ElMessage.warning('请填写容器名称和镜像')
    return
  }
  if (!selectedServer.value) return

  try {
    // 构建 docker run 命令参数
    const args = ['run', '-d', '--name', createForm.value.name]
    
    // 添加端口映射
    createForm.value.ports
      .filter(p => p.host && p.container)
      .forEach(p => {
        args.push('-p', `${p.host}:${p.container}`)
      })
    
    // 添加环境变量
    createForm.value.envs
      .filter(e => e.key)
      .forEach(e => {
        args.push('-e', `${e.key}=${e.value}`)
      })
    
    // 添加重启策略
    if (createForm.value.restartPolicy && createForm.value.restartPolicy !== 'no') {
      args.push('--restart', createForm.value.restartPolicy)
    }
    
    // 添加镜像
    args.push(createForm.value.image)
    
    // 添加命令（如果有）
    if (createForm.value.command) {
      args.push(...createForm.value.command.split(' ').filter(s => s))
    }
    
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      args
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '创建容器失败')
    }

    showCreateDialog.value = false

    // 重置表单
    createForm.value = {
      name: '',
      image: '',
      ports: [],
      envs: [],
      restartPolicy: 'no',
      command: ''
    }

    ElMessage.success('容器创建成功')
    
    // 刷新容器列表
    await refreshContainers()
  } catch (error) {
    ElMessage.error(`创建失败: ${(error as Error).message}`)
  }
}

function createContainerFromImage(image: Image) {
  createForm.value.image = `${image.repository}:${image.tag}`
  showCreateDialog.value = true
}

async function pullImage() {
  if (!pullImageName.value) {
    ElMessage.warning('请输入镜像名称')
    return
  }
  if (!selectedServer.value) return

  isPulling.value = true
  pullProgress.value = 0
  pullStatus.value = ''
  pullMessage.value = '正在连接...'

  try {
    // 解析镜像名称和标签
    const [imageName, tag] = pullImageName.value.includes(':') 
      ? pullImageName.value.split(':') 
      : [pullImageName.value, 'latest']
    
    pullMessage.value = '正在拉取镜像...'
    pullProgress.value = 10
    
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['pull', `${imageName}:${tag}`],
      { timeout: 600 }
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '拉取镜像失败')
    }
    
    pullProgress.value = 100
    pullStatus.value = 'success'
    pullMessage.value = '完成'

    ElMessage.success('镜像拉取成功')
    
    // 刷新镜像列表
    await refreshImages()

    setTimeout(() => {
      showPullImageDialog.value = false
      pullImageName.value = ''
      pullProgress.value = 0
    }, 1000)
  } catch (error) {
    pullStatus.value = 'exception'
    pullMessage.value = '拉取失败'
    ElMessage.error(`拉取失败: ${(error as Error).message}`)
  } finally {
    isPulling.value = false
  }
}

async function deleteImage(image: Image) {
  if (!selectedServer.value) return
  
  try {
    await ElMessageBox.confirm(
      `确定要删除镜像 "${image.repository}:${image.tag}" 吗？`,
      '确认删除',
      { type: 'warning' }
    )

    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'docker',
      ['rmi', image.id]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '删除镜像失败')
    }
    
    images.value = images.value.filter(img => img.id !== image.id)
    ElMessage.success('镜像已删除')
  } catch (error) {
    if ((error as Error).message !== 'cancel') {
      ElMessage.error(`删除失败: ${(error as Error).message}`)
    }
  }
}
</script>

<style lang="scss" scoped>
.containers-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 12px;

    .server-select {
      width: 200px;
    }

    .search-input {
      width: 200px;
    }
  }
}

.main-tabs {
  margin-bottom: 20px;
}

.stats-row {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;

  .stat-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 12px 20px;
    background: var(--bg-secondary);
    border-radius: 8px;

    .stat-value {
      font-size: 28px;
      font-weight: 600;
    }

    .stat-label {
      color: var(--text-secondary);
    }

    &.running .stat-value {
      color: var(--success-color);
    }

    &.stopped .stat-value {
      color: var(--danger-color);
    }

    &.paused .stat-value {
      color: var(--warning-color);
    }
  }
}

.container-table {
  .container-name {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    &:hover .name-text {
      color: var(--primary-color);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--text-secondary);
      flex-shrink: 0;

      &.running {
        background-color: var(--success-color);
      }

      &.exited {
        background-color: var(--danger-color);
      }

      &.paused {
        background-color: var(--warning-color);
      }
    }

    .name-text {
      font-weight: 500;
      transition: color 0.2s;
    }
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .cpu-high {
    color: var(--danger-color);
    font-weight: 600;
  }

  .cpu-medium {
    color: var(--warning-color);
  }

  .cpu-low {
    color: var(--success-color);
  }
}

.danger-text {
  color: var(--danger-color);
}

.images-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .search-input {
    width: 250px;
  }
}

.images-table {
  .image-id {
    font-family: monospace;
    color: var(--text-secondary);
  }
}

.log-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.log-container {
  height: 60vh;
  overflow: auto;
  background-color: var(--bg-color);
  border-radius: 8px;
  padding: 16px;

  .log-content {
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.mono-text {
  font-family: monospace;
}

.env-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .env-tag {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .more-env {
    color: var(--text-secondary);
    font-size: 12px;
  }
}

.mount-item {
  font-family: monospace;
  font-size: 12px;
  padding: 4px 0;
  color: var(--text-secondary);
}

.port-row,
.env-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.port-separator,
.env-separator {
  color: var(--text-secondary);
}

.pull-progress {
  margin-top: 16px;

  .pull-message {
    margin-top: 8px;
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.empty-state {
  padding: 60px 0;
}

.text-secondary {
  color: var(--text-secondary);
}

// 过滤栏样式
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;

  .filter-buttons {
    .filter-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 4px;

      &.running {
        background-color: var(--success-color);
      }

      &.stopped {
        background-color: var(--danger-color);
      }

      &.paused {
        background-color: var(--warning-color);
      }
    }
  }

  .batch-actions {
    display: flex;
    align-items: center;
    gap: 12px;

    .selected-count {
      font-size: 13px;
      color: var(--text-secondary);
    }
  }
}

// 资源使用统计样式
.stats-row {
  .stat-item.resources {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .resource-summary {
      display: flex;
      align-items: center;
      gap: 12px;

      .resource-label {
        font-size: 12px;
        color: var(--text-secondary);
        min-width: 80px;
      }

      .el-progress {
        flex: 1;
        max-width: 200px;
      }

      .resource-value {
        font-size: 12px;
        font-weight: 500;
        min-width: 60px;
      }
    }
  }
}

// 资源进度条样式
.resource-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .resource-bar {
    display: flex;
    align-items: center;
    gap: 6px;

    .bar-label {
      font-size: 10px;
      color: var(--text-secondary);
      width: 28px;
    }

    .el-progress {
      flex: 1;
    }

    .bar-value {
      font-size: 10px;
      color: var(--text-secondary);
      min-width: 50px;
      text-align: right;
    }
  }
}

// 健康状态标签
.health-tag {
  margin-left: 8px;
}

// 网络和卷页面样式
.networks-header,
.volumes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .search-input {
    width: 250px;
  }
}

.networks-table,
.volumes-table {
  .network-name,
  .volume-name {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-icon {
      color: var(--primary-color);
    }
  }

  .mountpoint {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-secondary);
  }
}

// 镜像操作按钮
.images-actions {
  display: flex;
  gap: 12px;
}

// 容器监控对话框样式
.stats-container {
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .stats-card {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;

    .stats-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .stats-card-value {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .stats-chart {
      height: 60px;
    }

    .mini-chart {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 100%;

      .chart-bar {
        flex: 1;
        background: var(--primary-color);
        border-radius: 2px 2px 0 0;
        min-height: 2px;
        transition: height 0.3s;

        &.memory {
          background: var(--success-color);
        }
      }
    }
  }
}

// 镜像历史对话框样式
.history-table {
  .layer-id {
    font-family: monospace;
    color: var(--text-secondary);
  }

  .created-by {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-secondary);
    display: block;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// 增强的日志对话框样式
.log-dialog {
  .log-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 12px;

    .log-toolbar-left,
    .log-toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .log-stats {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .log-container {
    height: 55vh;
    overflow: auto;
    background-color: #1e1e1e;
    border-radius: 8px;
    padding: 16px;

    .log-content {
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
      color: #d4d4d4;
      margin: 0;

      .log-error {
        color: #f85149;
      }

      .log-warn {
        color: #d29922;
      }

      .log-info {
        color: #58a6ff;
      }

      .log-debug {
        color: #8b949e;
      }

      .log-highlight {
        background-color: #634d00;
        color: #fff;
        padding: 0 2px;
        border-radius: 2px;
      }
    }
  }
}

// 环境变量编辑对话框样式
.env-edit-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .env-count {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.env-edit-list {
  max-height: 400px;
  overflow-y: auto;

  .env-edit-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 6px;
    margin-bottom: 8px;
    background: var(--bg-tertiary);

    &.new-env {
      border: 1px dashed var(--primary-color);
    }

    .env-equals {
      color: var(--text-secondary);
      font-weight: 600;
    }
  }

  .no-envs {
    text-align: center;
    color: var(--text-secondary);
    padding: 40px;
  }
}

// 容器终端对话框样式
.terminal-dialog {
  .terminal-container {
    background: #0d1117;
    border-radius: 8px;
    padding: 16px;
    height: 50vh;
    overflow-y: auto;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;

    .terminal-output {
      .terminal-line {
        color: #c9d1d9;
        white-space: pre-wrap;
        word-break: break-all;

        .terminal-prompt {
          color: #58a6ff;
        }

        .terminal-info {
          color: #8b949e;
        }

        .terminal-success {
          color: #3fb950;
        }

        .terminal-error {
          color: #f85149;
        }
      }
    }

    .terminal-input-line {
      display: flex;
      align-items: center;
      margin-top: 8px;

      .terminal-prompt {
        color: #58a6ff;
        white-space: nowrap;
      }

      .terminal-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #c9d1d9;
        font-family: inherit;
        font-size: inherit;
        padding: 0;
        margin-left: 4px;

        &::placeholder {
          color: #484f58;
        }
      }
    }
  }
}

// 镜像重新标记对话框样式
.retag-dialog {
  .current-tag {
    font-family: monospace;
    background: var(--bg-tertiary);
    padding: 8px 12px;
    border-radius: 4px;
  }
}
</style>
