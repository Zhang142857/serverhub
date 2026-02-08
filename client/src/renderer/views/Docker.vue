<template>
  <div class="docker-page">
    <div class="page-header">
      <div class="header-left">
        <h1>Docker 管理</h1>
        <p class="subtitle">容器、镜像、网络和卷管理</p>
      </div>
      <div class="header-actions">
        <el-select v-if="hasMultipleServers" v-model="selectedServer" placeholder="选择服务器" size="small">
          <el-option v-for="s in connectedServers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button @click="refresh" :loading="loading" size="small">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <div v-if="!selectedServer" class="empty-state">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <div v-else-if="!dockerInstalled" class="empty-state">
      <el-empty description="Docker 未安装">
        <el-button type="primary" size="small" @click="goToEnvironment">前往安装</el-button>
      </el-empty>
    </div>

    <template v-else>
      <!-- 标签页 -->
      <el-tabs v-model="activeTab" class="docker-tabs">
        <el-tab-pane name="containers">
          <template #label>
            <span class="tab-label">容器 <el-badge :value="containers.length" :max="99" type="info" /></span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="images">
          <template #label>
            <span class="tab-label">镜像 <el-badge :value="images.length" :max="99" type="info" /></span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="networks">
          <template #label>
            <span class="tab-label">网络 <el-badge :value="networks.length" :max="99" type="info" /></span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="volumes">
          <template #label>
            <span class="tab-label">卷 <el-badge :value="volumes.length" :max="99" type="info" /></span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="compose">
          <template #label>
            <span class="tab-label">Compose <el-badge :value="composeProjects.length" :max="99" type="info" /></span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="settings">
          <template #label>
            <span class="tab-label"><el-icon><Setting /></el-icon> 设置</span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <!-- 容器标签页 -->
      <div v-show="activeTab === 'containers'" class="tab-content">
        <div class="toolbar">
          <el-input v-model="containerSearch" placeholder="搜索容器..." size="small" clearable style="width: 200px">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-radio-group v-model="containerFilter" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="running">运行中</el-radio-button>
            <el-radio-button value="stopped">已停止</el-radio-button>
          </el-radio-group>
          <el-button type="primary" size="small" @click="showCreateContainer = true">创建容器</el-button>
        </div>

        <el-table :data="filteredContainers" v-loading="loading" size="small" class="data-table">
          <el-table-column prop="name" label="名称" min-width="150">
            <template #default="{ row }">
              <div class="cell-name">
                <span class="status-dot" :class="row.state"></span>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="image" label="镜像" min-width="180">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.image }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="140" />
          <el-table-column label="端口" width="120">
            <template #default="{ row }">
              <span v-if="row.ports">{{ formatPorts(row.ports) }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button v-if="row.state !== 'running'" type="success" @click="containerAction(row.id, 'start')">启动</el-button>
                <el-button v-if="row.state === 'running'" type="warning" @click="containerAction(row.id, 'stop')">停止</el-button>
                <el-button @click="containerAction(row.id, 'restart')">重启</el-button>
                <el-button @click="showLogs(row)">日志</el-button>
                <el-button type="danger" @click="deleteContainer(row)">删除</el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 镜像标签页 -->
      <div v-show="activeTab === 'images'" class="tab-content">
        <div class="toolbar">
          <el-input v-model="imageSearch" placeholder="搜索镜像..." size="small" clearable style="width: 200px">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button size="small" @click="showPullImage = true">拉取镜像</el-button>
        </div>

        <el-table :data="filteredImages" v-loading="loading" size="small" class="data-table">
          <el-table-column prop="repository" label="仓库" min-width="200" />
          <el-table-column prop="tag" label="标签" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ row.tag }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="id" label="ID" width="120">
            <template #default="{ row }">
              <code class="mono">{{ row.id?.substring(0, 12) }}</code>
            </template>
          </el-table-column>
          <el-table-column prop="size" label="大小" width="100">
            <template #default="{ row }">{{ formatSize(row.size) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button type="primary" @click="createFromImage(row)">创建容器</el-button>
                <el-button type="danger" @click="deleteImage(row)">删除</el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 网络标签页 -->
      <div v-show="activeTab === 'networks'" class="tab-content">
        <div class="toolbar">
          <el-input v-model="networkSearch" placeholder="搜索网络..." size="small" clearable style="width: 200px">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" size="small" @click="showCreateNetwork = true">创建网络</el-button>
        </div>

        <el-table :data="filteredNetworks" v-loading="loading" size="small" class="data-table">
          <el-table-column prop="name" label="名称" min-width="150" />
          <el-table-column prop="driver" label="驱动" width="100">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.driver }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="scope" label="范围" width="100" />
          <el-table-column prop="subnet" label="子网" width="150" />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="deleteNetwork(row)" 
                :disabled="['bridge', 'host', 'none'].includes(row.name)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 卷标签页 -->
      <div v-show="activeTab === 'volumes'" class="tab-content">
        <div class="toolbar">
          <el-input v-model="volumeSearch" placeholder="搜索卷..." size="small" clearable style="width: 200px">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" size="small" @click="showCreateVolume = true">创建卷</el-button>
        </div>

        <el-table :data="filteredVolumes" v-loading="loading" size="small" class="data-table">
          <el-table-column prop="name" label="名称" min-width="200" />
          <el-table-column prop="driver" label="驱动" width="100">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.driver }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="mountpoint" label="挂载点" min-width="250">
            <template #default="{ row }">
              <code class="mono">{{ row.mountpoint }}</code>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="deleteVolume(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Compose 标签页 -->
      <div v-show="activeTab === 'compose'" class="tab-content">
        <div class="toolbar">
          <el-input v-model="composeSearch" placeholder="搜索项目..." size="small" clearable style="width: 200px">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>

        <el-table :data="filteredComposeProjects" v-loading="loading" size="small" class="data-table">
          <el-table-column prop="name" label="项目名称" min-width="150" />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="getComposeStatusType(row.status)" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="config_files" label="配置文件" min-width="200" show-overflow-tooltip />
          <el-table-column label="服务数" width="80">
            <template #default="{ row }">{{ row.services?.length || 0 }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button type="success" @click="composeAction(row, 'up')">启动</el-button>
                <el-button @click="composeAction(row, 'restart')">重启</el-button>
                <el-button type="danger" @click="composeAction(row, 'down')">停止</el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 设置标签页 -->
      <div v-show="activeTab === 'settings'" class="tab-content">
        <div class="settings-section">
          <h3>网络代理设置</h3>
          <p class="section-desc">配置 Docker 操作的网络代理方式</p>
          
          <el-form :model="dockerProxy" label-width="120px" size="small" class="proxy-form">
            <el-form-item label="代理模式">
              <el-radio-group v-model="dockerProxy.mode">
                <el-radio value="none">不使用代理</el-radio>
                <el-radio value="http">HTTP/HTTPS 代理</el-radio>
                <el-radio value="server">服务端代理</el-radio>
              </el-radio-group>
            </el-form-item>
            
            <template v-if="dockerProxy.mode === 'http'">
              <el-form-item label="HTTP 代理">
                <el-input v-model="dockerProxy.httpProxy" placeholder="http://proxy.example.com:8080" />
              </el-form-item>
              <el-form-item label="HTTPS 代理">
                <el-input v-model="dockerProxy.httpsProxy" placeholder="http://proxy.example.com:8080" />
              </el-form-item>
              <el-form-item label="不代理地址">
                <el-input v-model="dockerProxy.noProxy" placeholder="localhost,127.0.0.1" />
              </el-form-item>
            </template>
            
            <template v-if="dockerProxy.mode === 'server'">
              <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
                <template #title>
                  服务端代理模式：所有 Docker Hub 搜索请求将通过服务端 Agent 转发，适用于客户端无法直接访问 Docker Hub 的情况。
                </template>
              </el-alert>
            </template>
            
            <el-form-item>
              <el-button type="primary" @click="saveDockerProxy" :loading="savingProxy">保存代理设置</el-button>
              <el-button @click="loadDockerProxy">重新加载</el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="settings-section">
          <h3>镜像源设置</h3>
          <p class="section-desc">配置 Docker 镜像源地址，用于加速镜像拉取（仅加速拉取，不支持搜索）</p>
          
          <el-form :model="dockerMirror" label-width="120px" size="small" class="mirror-form">
            <el-form-item label="启用镜像源">
              <el-switch v-model="dockerMirror.enabled" />
            </el-form-item>
            <el-form-item label="镜像源地址" v-if="dockerMirror.enabled">
              <el-input v-model="dockerMirror.mirrors" type="textarea" :rows="3" placeholder="https://mirror.ccs.tencentyun.com&#10;https://registry.docker-cn.com" />
              <div class="form-tip">每行一个地址，按优先级从高到低排列</div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveDockerMirror" :loading="savingMirror">保存镜像源设置</el-button>
            </el-form-item>
          </el-form>

          <div class="mirror-presets">
            <span class="preset-label">快速设置：</span>
            <el-button size="small" text type="primary" @click="setMirrorPreset('tencent')">腾讯云</el-button>
            <el-button size="small" text type="primary" @click="setMirrorPreset('aliyun')">阿里云</el-button>
            <el-button size="small" text type="primary" @click="setMirrorPreset('ustc')">中科大</el-button>
          </div>
        </div>

        <div class="settings-section">
          <h3>Docker 信息</h3>
          <div class="docker-info" v-if="dockerInfo">
            <div class="info-row"><span class="label">Docker 版本</span><span class="value">{{ dockerInfo.version }}</span></div>
            <div class="info-row"><span class="label">存储驱动</span><span class="value">{{ dockerInfo.storageDriver }}</span></div>
            <div class="info-row"><span class="label">容器数量</span><span class="value">{{ dockerInfo.containers }}</span></div>
            <div class="info-row"><span class="label">镜像数量</span><span class="value">{{ dockerInfo.images }}</span></div>
            <div class="info-row"><span class="label">数据目录</span><span class="value">{{ dockerInfo.dataRoot }}</span></div>
          </div>
          <el-button size="small" @click="loadDockerInfo" :loading="loadingInfo" style="margin-top: 12px;">刷新信息</el-button>
        </div>
      </div>
    </template>

    <!-- 日志对话框 -->
    <el-dialog v-model="showLogDialog" :title="`容器日志 - ${currentContainer?.name}`" width="80%" top="5vh" class="dark-dialog">
      <div class="log-container">
        <pre ref="logPre">{{ logContent }}</pre>
      </div>
      <template #footer>
        <el-button size="small" @click="refreshLogs">刷新</el-button>
        <el-button size="small" @click="showLogDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 创建容器对话框 -->
    <el-dialog v-model="showCreateContainer" title="创建容器" width="500px" class="dark-dialog">
      <el-form :model="newContainer" label-width="80px" size="small">
        <el-form-item label="名称" required>
          <el-input v-model="newContainer.name" placeholder="容器名称" />
        </el-form-item>
        <el-form-item label="镜像" required>
          <el-select v-model="newContainer.image" filterable allow-create placeholder="选择或输入镜像" style="width: 100%">
            <el-option v-for="img in images" :key="img.id" :label="`${img.repository}:${img.tag}`" :value="`${img.repository}:${img.tag}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="端口映射">
          <el-input v-model="newContainer.ports" placeholder="8080:80, 3000:3000" />
        </el-form-item>
        <el-form-item label="环境变量">
          <el-input v-model="newContainer.env" placeholder="KEY=value, KEY2=value2" />
        </el-form-item>
        <el-form-item label="重启策略">
          <el-select v-model="newContainer.restart" style="width: 100%">
            <el-option value="no" label="不重启" />
            <el-option value="always" label="总是重启" />
            <el-option value="on-failure" label="失败时重启" />
            <el-option value="unless-stopped" label="除非手动停止" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showCreateContainer = false">取消</el-button>
        <el-button type="primary" size="small" @click="createContainer" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 拉取镜像对话框 - 集成 Docker Hub 搜索 -->
    <el-dialog v-model="showPullImage" title="拉取镜像" width="700px" class="dark-dialog pull-dialog">
      <div class="pull-search">
        <div class="search-row">
          <el-input 
            v-model="pullSearchQuery" 
            placeholder="搜索镜像，如 nginx、mysql、redis..." 
            size="default"
            clearable
            @input="debouncedSearch"
            @keyup.enter="searchForPull"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button @click="searchForPull" :loading="pullSearching" style="margin-left: 8px;">搜索</el-button>
        </div>
        <div class="search-tip">
          <el-icon><InfoFilled /></el-icon>
          <span v-if="dockerProxy.mode === 'server'">使用服务端代理搜索 Docker Hub</span>
          <span v-else-if="dockerProxy.mode === 'http'">使用 HTTP 代理搜索 Docker Hub</span>
          <span v-else>搜索本地镜像库（50+ 常用镜像），在线搜索可能需要代理</span>
        </div>
      </div>

      <!-- 搜索结果 -->
      <div class="pull-results" v-if="pullSearchResults.length > 0">
        <div class="results-header">搜索结果</div>
        <div class="results-list">
          <div 
            v-for="item in pullSearchResults" 
            :key="item.repo_name || item.name" 
            class="result-item"
            :class="{ selected: selectedPullImage?.repo_name === item.repo_name || selectedPullImage?.name === item.name }"
            @click="selectPullImage(item)"
          >
            <div class="result-icon">
              <el-icon v-if="item.is_official" color="#3b82f6"><CircleCheck /></el-icon>
              <span v-else>🐳</span>
            </div>
            <div class="result-info">
              <div class="result-name">
                {{ item.repo_name || item.name }}
                <el-tag v-if="item.is_official" size="small" type="primary">官方</el-tag>
              </div>
              <div class="result-desc">{{ item.short_description || item.description || '暂无描述' }}</div>
              <div class="result-stats">
                <span>⭐ {{ formatStars(item.star_count) }}</span>
                <span v-if="item.pull_count">⬇️ {{ formatPullCount(item.pull_count) }}</span>
              </div>
            </div>
            <el-icon class="result-check" v-if="selectedPullImage?.repo_name === item.repo_name || selectedPullImage?.name === item.name"><Select /></el-icon>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!pullSearching && pullSearchQuery" class="pull-empty">
        <el-empty description="未找到相关镜像，请尝试其他关键词" :image-size="80" />
      </div>

      <!-- 初始状态 - 显示热门镜像 -->
      <div v-else-if="!pullSearching && !pullSearchQuery" class="pull-popular">
        <div class="results-header">热门镜像</div>
        <div class="results-list">
          <div 
            v-for="item in popularPullImages" 
            :key="item.name" 
            class="result-item"
            :class="{ selected: selectedPullImage?.name === item.name }"
            @click="selectPullImage(item)"
          >
            <div class="result-icon">{{ item.icon }}</div>
            <div class="result-info">
              <div class="result-name">{{ item.name }}</div>
              <div class="result-desc">{{ item.description }}</div>
            </div>
            <el-icon class="result-check" v-if="selectedPullImage?.name === item.name"><Select /></el-icon>
          </div>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="pullSearching" class="pull-loading">
        <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        <span>搜索中...</span>
      </div>

      <!-- 已选择的镜像 -->
      <div v-if="selectedPullImage" class="selected-image">
        <div class="selected-header">已选择镜像</div>
        <div class="selected-content">
          <div class="selected-name">{{ selectedPullImage.name }}</div>
          <el-select v-model="selectedPullTag" size="small" style="width: 120px;">
            <el-option value="latest" label="latest" />
            <el-option v-for="tag in commonTags" :key="tag" :value="tag" :label="tag" />
          </el-select>
        </div>
      </div>

      <!-- 拉取输出 -->
      <div v-if="pullOutput" class="pull-output">
        <div class="output-header">拉取日志</div>
        <pre>{{ pullOutput }}</pre>
      </div>

      <template #footer>
        <el-button size="small" @click="closePullDialog">取消</el-button>
        <el-button 
          type="primary" 
          size="small" 
          @click="pullSelectedImage" 
          :loading="pulling"
          :disabled="!selectedPullImage"
        >
          拉取镜像
        </el-button>
      </template>
    </el-dialog>

    <!-- 创建网络对话框 -->
    <el-dialog v-model="showCreateNetwork" title="创建网络" width="400px" class="dark-dialog">
      <el-form :model="newNetwork" label-width="80px" size="small">
        <el-form-item label="名称" required>
          <el-input v-model="newNetwork.name" placeholder="网络名称" />
        </el-form-item>
        <el-form-item label="驱动">
          <el-select v-model="newNetwork.driver" style="width: 100%">
            <el-option value="bridge" label="bridge" />
            <el-option value="overlay" label="overlay" />
          </el-select>
        </el-form-item>
        <el-form-item label="子网">
          <el-input v-model="newNetwork.subnet" placeholder="172.20.0.0/16" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showCreateNetwork = false">取消</el-button>
        <el-button type="primary" size="small" @click="createNetwork">创建</el-button>
      </template>
    </el-dialog>

    <!-- 创建卷对话框 -->
    <el-dialog v-model="showCreateVolume" title="创建卷" width="400px" class="dark-dialog">
      <el-form :model="newVolume" label-width="80px" size="small">
        <el-form-item label="名称" required>
          <el-input v-model="newVolume.name" placeholder="卷名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showCreateVolume = false">取消</el-button>
        <el-button type="primary" size="small" @click="createVolume">创建</el-button>
      </template>
    </el-dialog>

    <!-- 一键部署对话框 -->
    <el-dialog v-model="showDeploy" :title="`部署 ${deployApp?.name || ''}`" width="500px" class="dark-dialog">
      <el-form :model="deployConfig" label-width="100px" size="small">
        <el-form-item label="容器名称" required>
          <el-input v-model="deployConfig.name" :placeholder="deployApp?.defaultName || 'my-app'" />
        </el-form-item>
        <el-form-item label="镜像版本">
          <el-select v-model="deployConfig.tag" style="width: 100%">
            <el-option value="latest" label="latest (最新)" />
            <el-option v-for="tag in deployApp?.tags || []" :key="tag" :value="tag" :label="tag" />
          </el-select>
        </el-form-item>
        <el-form-item v-for="port in deployApp?.ports || []" :key="port.container" :label="`端口 ${port.container}`">
          <el-input v-model="deployConfig.ports[port.container]" :placeholder="String(port.host)">
            <template #prepend>主机端口</template>
          </el-input>
        </el-form-item>
        <el-form-item v-for="env in deployApp?.envs || []" :key="env.name" :label="env.label">
          <el-input v-model="deployConfig.envs[env.name]" :placeholder="env.default" :type="env.secret ? 'password' : 'text'" />
        </el-form-item>
        <el-form-item v-for="vol in deployApp?.volumes || []" :key="vol.container" :label="vol.label">
          <el-input v-model="deployConfig.volumes[vol.container]" :placeholder="vol.host" />
        </el-form-item>
        <el-form-item label="自动重启">
          <el-switch v-model="deployConfig.restart" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showDeploy = false">取消</el-button>
        <el-button type="primary" size="small" @click="executeDeploy" :loading="deploying">部署</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search, CircleCheck, Setting, Select, Loading, InfoFilled } from '@element-plus/icons-vue'

interface Container {
  id: string
  name: string
  image: string
  state: string
  status: string
  ports?: string
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
  subnet?: string
}

interface Volume {
  name: string
  driver: string
  mountpoint: string
}

interface ComposeProject {
  name: string
  status: string
  config_files: string
  services: any[]
}

const router = useRouter()
const serverStore = useServerStore()
const selectedServer = ref<string | null>(null)
const activeTab = ref('containers')
const loading = ref(false)
const dockerInstalled = ref(false)

// 数据
const containers = ref<Container[]>([])
const images = ref<Image[]>([])
const networks = ref<Network[]>([])
const volumes = ref<Volume[]>([])
const composeProjects = ref<ComposeProject[]>([])

// 搜索
const containerSearch = ref('')
const containerFilter = ref('all')
const imageSearch = ref('')
const networkSearch = ref('')
const volumeSearch = ref('')
const composeSearch = ref('')

// 对话框
const showLogDialog = ref(false)
const showCreateContainer = ref(false)
const showPullImage = ref(false)
const showCreateNetwork = ref(false)
const showCreateVolume = ref(false)
const currentContainer = ref<Container | null>(null)
const logContent = ref('')
const logPre = ref<HTMLPreElement | null>(null)

// 表单
const newContainer = ref({ name: '', image: '', ports: '', env: '', restart: 'no' })
const newNetwork = ref({ name: '', driver: 'bridge', subnet: '' })
const newVolume = ref({ name: '' })
const pullImageName = ref('')
const pullOutput = ref('')
const pulling = ref(false)

// 拉取镜像搜索相关
const pullSearchQuery = ref('')
const pullSearchResults = ref<any[]>([])
const pullSearching = ref(false)
const selectedPullImage = ref<any>(null)
const selectedPullTag = ref('latest')
const commonTags = ['latest', 'alpine', 'slim', 'stable', 'lts']
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// 热门镜像列表（用于拉取对话框初始显示）
const popularPullImages = [
  { name: 'nginx', icon: '🌐', description: '高性能 Web 服务器和反向代理' },
  { name: 'mysql', icon: '🐬', description: '流行的关系型数据库' },
  { name: 'redis', icon: '🔴', description: '高性能键值存储数据库' },
  { name: 'postgres', icon: '🐘', description: '强大的开源关系型数据库' },
  { name: 'mongo', icon: '🍃', description: 'NoSQL 文档数据库' },
  { name: 'node', icon: '💚', description: 'Node.js 运行环境' },
  { name: 'python', icon: '🐍', description: 'Python 运行环境' },
  { name: 'ubuntu', icon: '🐧', description: 'Ubuntu Linux 基础镜像' },
  { name: 'alpine', icon: '🏔️', description: '轻量级 Linux 基础镜像 (5MB)' },
  { name: 'ollama/ollama', icon: '🤖', description: 'Ollama 本地大模型运行' },
  { name: 'portainer/portainer-ce', icon: '🐳', description: 'Docker 可视化管理' },
  { name: 'jenkins/jenkins', icon: '🔧', description: 'Jenkins CI/CD 服务器' },
]
const creating = ref(false)

// Docker Hub 搜索
const hubSearch = ref('')
const hubSearching = ref(false)
const hubSearchResults = ref<any[]>([])

// 一键部署
const showDeploy = ref(false)
const deploying = ref(false)
const deployApp = ref<any>(null)
const deployConfig = ref<any>({ name: '', tag: 'latest', ports: {}, envs: {}, volumes: {}, restart: true })

// Docker 代理设置
const dockerProxy = ref({ mode: 'none' as 'none' | 'http' | 'server', httpProxy: '', httpsProxy: '', noProxy: 'localhost,127.0.0.1' })
const dockerMirror = ref({ enabled: false, mirrors: '' })
const savingProxy = ref(false)
const savingMirror = ref(false)
const loadingInfo = ref(false)
const dockerInfo = ref<any>(null)

// 从 localStorage 加载设置
function loadDockerSettings() {
  try {
    const proxyStr = localStorage.getItem('docker_proxy_settings')
    if (proxyStr) {
      const saved = JSON.parse(proxyStr)
      // 兼容旧格式（enabled 字段）
      if (saved.enabled !== undefined && saved.mode === undefined) {
        saved.mode = saved.enabled ? 'http' : 'none'
        delete saved.enabled
      }
      dockerProxy.value = { ...dockerProxy.value, ...saved }
    }
    const mirrorStr = localStorage.getItem('docker_mirror_settings')
    if (mirrorStr) {
      dockerMirror.value = JSON.parse(mirrorStr)
    }
  } catch (e) {
    console.error('Failed to load docker settings:', e)
  }
}

// 保存设置到 localStorage
function saveDockerSettingsToLocal() {
  try {
    localStorage.setItem('docker_proxy_settings', JSON.stringify(dockerProxy.value))
    localStorage.setItem('docker_mirror_settings', JSON.stringify(dockerMirror.value))
  } catch (e) {
    console.error('Failed to save docker settings:', e)
  }
}

// Docker Hub 热门镜像
const hubTrending = ref<any[]>([])
const loadingTrending = ref(false)

// 热门应用配置
const popularApps = [
  {
    name: 'Nginx',
    icon: '🌐',
    description: '高性能 Web 服务器',
    image: 'nginx',
    defaultName: 'nginx',
    tags: ['latest', 'alpine', '1.25', '1.24'],
    ports: [{ container: 80, host: 80 }],
    envs: [],
    volumes: [{ container: '/usr/share/nginx/html', host: '/var/www/html', label: '网站目录' }]
  },
  {
    name: 'MySQL',
    icon: '🐬',
    description: '流行的关系型数据库',
    image: 'mysql',
    defaultName: 'mysql',
    tags: ['latest', '8.0', '5.7'],
    ports: [{ container: 3306, host: 3306 }],
    envs: [{ name: 'MYSQL_ROOT_PASSWORD', label: 'Root密码', default: '', secret: true }],
    volumes: [{ container: '/var/lib/mysql', host: '/data/mysql', label: '数据目录' }]
  },
  {
    name: 'Redis',
    icon: '🔴',
    description: '高性能键值存储',
    image: 'redis',
    defaultName: 'redis',
    tags: ['latest', 'alpine', '7', '6'],
    ports: [{ container: 6379, host: 6379 }],
    envs: [],
    volumes: [{ container: '/data', host: '/data/redis', label: '数据目录' }]
  },
  {
    name: 'PostgreSQL',
    icon: '🐘',
    description: '强大的开源数据库',
    image: 'postgres',
    defaultName: 'postgres',
    tags: ['latest', '16', '15', '14'],
    ports: [{ container: 5432, host: 5432 }],
    envs: [{ name: 'POSTGRES_PASSWORD', label: '密码', default: '', secret: true }],
    volumes: [{ container: '/var/lib/postgresql/data', host: '/data/postgres', label: '数据目录' }]
  },
  {
    name: 'MongoDB',
    icon: '🍃',
    description: 'NoSQL 文档数据库',
    image: 'mongo',
    defaultName: 'mongo',
    tags: ['latest', '7', '6', '5'],
    ports: [{ container: 27017, host: 27017 }],
    envs: [],
    volumes: [{ container: '/data/db', host: '/data/mongo', label: '数据目录' }]
  },
  {
    name: 'WordPress',
    icon: '📝',
    description: '流行的博客/CMS系统',
    image: 'wordpress',
    defaultName: 'wordpress',
    tags: ['latest', 'php8.2', 'php8.1'],
    ports: [{ container: 80, host: 8080 }],
    envs: [
      { name: 'WORDPRESS_DB_HOST', label: '数据库地址', default: 'mysql:3306' },
      { name: 'WORDPRESS_DB_USER', label: '数据库用户', default: 'root' },
      { name: 'WORDPRESS_DB_PASSWORD', label: '数据库密码', default: '', secret: true }
    ],
    volumes: []
  },
  {
    name: 'Portainer',
    icon: '🐳',
    description: 'Docker 可视化管理',
    image: 'portainer/portainer-ce',
    defaultName: 'portainer',
    tags: ['latest', '2.19.4'],
    ports: [{ container: 9000, host: 9000 }],
    envs: [],
    volumes: [{ container: '/var/run/docker.sock', host: '/var/run/docker.sock', label: 'Docker Socket' }]
  },
  {
    name: 'Adminer',
    icon: '📊',
    description: '轻量级数据库管理',
    image: 'adminer',
    defaultName: 'adminer',
    tags: ['latest'],
    ports: [{ container: 8080, host: 8081 }],
    envs: [],
    volumes: []
  }
]

const connectedServers = computed(() => serverStore.connectedServers)
const hasMultipleServers = computed(() => serverStore.hasMultipleServers)

const filteredContainers = computed(() => {
  let list = containers.value
  if (containerFilter.value === 'running') list = list.filter(c => c.state === 'running')
  else if (containerFilter.value === 'stopped') list = list.filter(c => c.state !== 'running')
  if (containerSearch.value) list = list.filter(c => c.name.includes(containerSearch.value) || c.image.includes(containerSearch.value))
  return list
})

const filteredImages = computed(() => {
  if (!imageSearch.value) return images.value
  return images.value.filter(i => i.repository.includes(imageSearch.value) || i.tag.includes(imageSearch.value))
})

const filteredNetworks = computed(() => {
  if (!networkSearch.value) return networks.value
  return networks.value.filter(n => n.name.includes(networkSearch.value))
})

const filteredVolumes = computed(() => {
  if (!volumeSearch.value) return volumes.value
  return volumes.value.filter(v => v.name.includes(volumeSearch.value))
})

const filteredComposeProjects = computed(() => {
  if (!composeSearch.value) return composeProjects.value
  return composeProjects.value.filter(p => p.name.includes(composeSearch.value))
})

watch(selectedServer, (val) => {
  if (val) checkDockerAndLoad()
})

onMounted(() => {
  // 加载本地保存的 Docker 设置
  loadDockerSettings()
  
  if (connectedServers.value.length > 0) {
    selectedServer.value = serverStore.currentServerId || connectedServers.value[0].id
  }
  // 加载 Docker Hub 热门镜像
  loadHubTrending()
})

async function checkDockerAndLoad() {
  if (!selectedServer.value) return
  loading.value = true
  try {
    const result = await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'docker --version'])
    dockerInstalled.value = result.exit_code === 0
    if (dockerInstalled.value) {
      await loadAllData()
    }
  } catch {
    dockerInstalled.value = false
  } finally {
    loading.value = false
  }
}

async function loadAllData() {
  await Promise.all([loadContainers(), loadImages(), loadNetworks(), loadVolumes(), loadComposeProjects()])
}

async function loadContainers() {
  if (!selectedServer.value) return
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}|{{.Ports}}"']
    )
    const stdout = result.stdout || ''
    containers.value = stdout.trim().split('\n').filter(l => l).map(line => {
      const [id, name, image, state, status, ports] = line.split('|')
      return { id, name, image, state, status, ports }
    })
  } catch { containers.value = [] }
}

async function loadImages() {
  if (!selectedServer.value) return
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'docker images --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}"']
    )
    const stdout = result.stdout || ''
    images.value = stdout.trim().split('\n').filter(l => l).map(line => {
      const [id, repository, tag, size, created] = line.split('|')
      return { id, repository, tag, size: parseSize(size), created }
    })
  } catch { images.value = [] }
}

async function loadNetworks() {
  if (!selectedServer.value) return
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'docker network ls --format "{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}"']
    )
    const stdout = result.stdout || ''
    networks.value = stdout.trim().split('\n').filter(l => l).map(line => {
      const [id, name, driver, scope] = line.split('|')
      return { id, name, driver, scope }
    })
  } catch { networks.value = [] }
}

async function loadVolumes() {
  if (!selectedServer.value) return
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'docker volume ls --format "{{.Name}}|{{.Driver}}|{{.Mountpoint}}"']
    )
    const stdout = result.stdout || ''
    volumes.value = stdout.trim().split('\n').filter(l => l).map(line => {
      const [name, driver, mountpoint] = line.split('|')
      return { name, driver, mountpoint }
    })
  } catch { volumes.value = [] }
}

async function loadComposeProjects() {
  if (!selectedServer.value) return
  try {
    const result = await window.electronAPI.compose.list(selectedServer.value)
    composeProjects.value = result.projects || []
  } catch { composeProjects.value = [] }
}

function refresh() {
  checkDockerAndLoad()
}

function goToEnvironment() {
  router.push('/environment')
}

async function containerAction(id: string, action: string) {
  if (!selectedServer.value) return
  try {
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `docker ${action} ${id}`])
    ElMessage.success(`容器${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}成功`)
    loadContainers()
  } catch (e) {
    ElMessage.error('操作失败: ' + (e as Error).message)
  }
}

async function deleteContainer(container: Container) {
  try {
    await ElMessageBox.confirm(`确定删除容器 ${container.name}？`, '确认删除', { type: 'warning' })
  } catch { return }
  if (!selectedServer.value) return
  try {
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `docker rm -f ${container.id}`])
    ElMessage.success('容器已删除')
    loadContainers()
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

async function showLogs(container: Container) {
  currentContainer.value = container
  logContent.value = '加载中...'
  showLogDialog.value = true
  await refreshLogs()
}

async function refreshLogs() {
  if (!selectedServer.value || !currentContainer.value) return
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', `docker logs --tail 200 ${currentContainer.value.id}`]
    )
    logContent.value = result.stdout || result.stderr || '无日志'
  } catch (e) {
    logContent.value = '获取日志失败: ' + (e as Error).message
  }
}

async function createContainer() {
  if (!selectedServer.value || !newContainer.value.name || !newContainer.value.image) {
    ElMessage.warning('请填写容器名称和镜像')
    return
  }
  creating.value = true
  try {
    let cmd = `docker run -d --name ${newContainer.value.name}`
    if (newContainer.value.ports) {
      newContainer.value.ports.split(',').forEach(p => { cmd += ` -p ${p.trim()}` })
    }
    if (newContainer.value.env) {
      newContainer.value.env.split(',').forEach(e => { cmd += ` -e ${e.trim()}` })
    }
    if (newContainer.value.restart !== 'no') {
      cmd += ` --restart ${newContainer.value.restart}`
    }
    cmd += ` ${newContainer.value.image}`
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', cmd])
    ElMessage.success('容器创建成功')
    showCreateContainer.value = false
    newContainer.value = { name: '', image: '', ports: '', env: '', restart: 'no' }
    loadContainers()
  } catch (e) {
    ElMessage.error('创建失败: ' + (e as Error).message)
  } finally {
    creating.value = false
  }
}

function createFromImage(image: Image) {
  newContainer.value.image = `${image.repository}:${image.tag}`
  showCreateContainer.value = true
}

async function pullImage() {
  if (!selectedServer.value || !pullImageName.value) {
    ElMessage.warning('请输入镜像名称')
    return
  }
  pulling.value = true
  pullOutput.value = '正在拉取...\n'
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', `docker pull ${pullImageName.value}`]
    )
    pullOutput.value += result.stdout || ''
    if (result.exit_code === 0) {
      ElMessage.success('镜像拉取成功')
      loadImages()
    } else {
      pullOutput.value += '\n拉取失败'
    }
  } catch (e) {
    pullOutput.value += '\n错误: ' + (e as Error).message
  } finally {
    pulling.value = false
  }
}

// 拉取镜像对话框相关函数
function debouncedSearch() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    if (pullSearchQuery.value.trim()) {
      searchForPull()
    } else {
      pullSearchResults.value = []
    }
  }, 500)
}

async function searchForPull() {
  if (!pullSearchQuery.value.trim()) return
  pullSearching.value = true
  pullSearchResults.value = []
  
  const query = pullSearchQuery.value.toLowerCase().trim()

  // 在线模式：优先走中心服务器代理
  const _settings = JSON.parse(localStorage.getItem('runixo_settings') || '{}')
  if (_settings.server?.onlineMode && _settings.server?.url) {
    try {
      const resp = await fetch(`${_settings.server.url}/api/v1/docker/search?q=${encodeURIComponent(pullSearchQuery.value)}&page_size=20`)
      if (resp.ok) {
        const data = await resp.json()
        if (data.results?.length > 0) {
          pullSearchResults.value = data.results.map((r: any) => ({
            name: r.name, repo_name: r.name,
            short_description: r.description || '',
            star_count: r.star_count || 0,
            is_official: r.is_official || false,
            pull_count: r.pull_count || 0
          }))
          pullSearching.value = false
          return
        }
      }
    } catch (e) {
      console.error('Central server search error:', e)
    }
  }
  
  // 服务端代理模式：优先使用服务端搜索 Docker Hub
  if (dockerProxy.value.mode === 'server' && selectedServer.value) {
    try {
      const response = await window.electronAPI.docker.searchHub(
        selectedServer.value,
        pullSearchQuery.value,
        20,
        1
      )
      
      if (response.success && response.results?.length > 0) {
        pullSearchResults.value = response.results.map(r => ({
          name: r.name,
          repo_name: r.name,
          short_description: r.description,
          star_count: r.star_count,
          is_official: r.is_official,
          pull_count: r.pull_count
        }))
        pullSearching.value = false
        return
      } else if (response.error) {
        ElMessage.warning('服务端搜索失败: ' + response.error)
      }
    } catch (e) {
      console.error('Server search error:', e)
      ElMessage.warning('服务端搜索出错，使用本地列表')
    }
  }
  
  // 本地镜像列表搜索（作为后备或非服务端代理模式）
  const localResults = getLocalPopularImages().filter(
    img => img.name.toLowerCase().includes(query) || 
           img.short_description.toLowerCase().includes(query)
  )
  
  if (localResults.length > 0) {
    pullSearchResults.value = localResults
    pullSearching.value = false
    return
  }
  
  // 本地没有匹配的，根据代理模式选择搜索方式
  try {
    // HTTP 代理模式
    if (dockerProxy.value.mode === 'http') {
      let proxyConfig: { host: string; port: number; username?: string; password?: string } | undefined
      if (dockerProxy.value.httpProxy) {
        try {
          const proxyUrl = new URL(dockerProxy.value.httpProxy)
          proxyConfig = {
            host: proxyUrl.hostname,
            port: parseInt(proxyUrl.port) || 80,
            username: proxyUrl.username || undefined,
            password: proxyUrl.password || undefined
          }
        } catch (e) {
          console.warn('Invalid proxy URL:', e)
        }
      }

      const response = await window.electronAPI.http.request({
        url: `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(pullSearchQuery.value)}&page_size=10`,
        method: 'GET',
        timeout: 10000,
        proxy: proxyConfig
      })
      
      if (response.success && response.data?.results?.length > 0) {
        pullSearchResults.value = response.data.results
      } else {
        ElMessage.info('未找到匹配镜像，你可以直接从热门列表选择或手动输入镜像名')
      }
    }
    // 无代理模式：直接请求（可能会失败）
    else {
      const response = await window.electronAPI.http.request({
        url: `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(pullSearchQuery.value)}&page_size=10`,
        method: 'GET',
        timeout: 10000
      })
      
      if (response.success && response.data?.results?.length > 0) {
        pullSearchResults.value = response.data.results
      } else {
        ElMessage.info('未找到匹配镜像，建议在设置中启用服务端代理以获得更好的搜索体验')
      }
    }
  } catch (e) {
    console.error('Search error:', e)
    if (dockerProxy.value.mode === 'none') {
      ElMessage.info('在线搜索失败，建议在设置中启用服务端代理')
    } else {
      ElMessage.info('在线搜索失败，请从热门列表选择或直接输入镜像名')
    }
  } finally {
    pullSearching.value = false
  }
}

// 本地热门镜像列表（覆盖常用镜像，不需要网络）
function getLocalPopularImages() {
  return [
    { name: 'nginx', repo_name: 'nginx', short_description: '高性能 Web 服务器和反向代理', star_count: 19000, is_official: true },
    { name: 'mysql', repo_name: 'mysql', short_description: '流行的关系型数据库', star_count: 15000, is_official: true },
    { name: 'redis', repo_name: 'redis', short_description: '高性能键值存储数据库', star_count: 13000, is_official: true },
    { name: 'postgres', repo_name: 'postgres', short_description: '强大的开源关系型数据库', star_count: 12000, is_official: true },
    { name: 'mongo', repo_name: 'mongo', short_description: 'NoSQL 文档数据库', star_count: 10000, is_official: true },
    { name: 'mariadb', repo_name: 'mariadb', short_description: 'MySQL 兼容的开源数据库', star_count: 5500, is_official: true },
    { name: 'node', repo_name: 'node', short_description: 'Node.js 运行环境', star_count: 13000, is_official: true },
    { name: 'python', repo_name: 'python', short_description: 'Python 运行环境', star_count: 9500, is_official: true },
    { name: 'golang', repo_name: 'golang', short_description: 'Go 语言运行环境', star_count: 4800, is_official: true },
    { name: 'openjdk', repo_name: 'openjdk', short_description: 'Java 运行环境', star_count: 3800, is_official: true },
    { name: 'php', repo_name: 'php', short_description: 'PHP 运行环境', star_count: 7200, is_official: true },
    { name: 'ruby', repo_name: 'ruby', short_description: 'Ruby 运行环境', star_count: 2100, is_official: true },
    { name: 'ubuntu', repo_name: 'ubuntu', short_description: 'Ubuntu Linux 基础镜像', star_count: 16000, is_official: true },
    { name: 'alpine', repo_name: 'alpine', short_description: '轻量级 Linux 基础镜像 (5MB)', star_count: 11000, is_official: true },
    { name: 'debian', repo_name: 'debian', short_description: 'Debian Linux 基础镜像', star_count: 5000, is_official: true },
    { name: 'centos', repo_name: 'centos', short_description: 'CentOS Linux 基础镜像', star_count: 7500, is_official: true },
    { name: 'busybox', repo_name: 'busybox', short_description: '极简 Linux 工具集 (1MB)', star_count: 3200, is_official: true },
    { name: 'httpd', repo_name: 'httpd', short_description: 'Apache HTTP 服务器', star_count: 4500, is_official: true },
    { name: 'tomcat', repo_name: 'tomcat', short_description: 'Apache Tomcat 服务器', star_count: 3600, is_official: true },
    { name: 'jenkins', repo_name: 'jenkins/jenkins', short_description: 'Jenkins CI/CD 服务器', star_count: 6000, is_official: false },
    { name: 'gitlab', repo_name: 'gitlab/gitlab-ce', short_description: 'GitLab 社区版', star_count: 4200, is_official: false },
    { name: 'elasticsearch', repo_name: 'elasticsearch', short_description: 'Elasticsearch 搜索引擎', star_count: 6100, is_official: true },
    { name: 'kibana', repo_name: 'kibana', short_description: 'Kibana 数据可视化', star_count: 2800, is_official: true },
    { name: 'logstash', repo_name: 'logstash', short_description: 'Logstash 日志处理', star_count: 2200, is_official: true },
    { name: 'rabbitmq', repo_name: 'rabbitmq', short_description: 'RabbitMQ 消息队列', star_count: 5000, is_official: true },
    { name: 'kafka', repo_name: 'bitnami/kafka', short_description: 'Apache Kafka 消息队列', star_count: 1800, is_official: false },
    { name: 'zookeeper', repo_name: 'zookeeper', short_description: 'Apache ZooKeeper', star_count: 1500, is_official: true },
    { name: 'memcached', repo_name: 'memcached', short_description: 'Memcached 缓存服务', star_count: 2100, is_official: true },
    { name: 'wordpress', repo_name: 'wordpress', short_description: 'WordPress 博客/CMS', star_count: 4800, is_official: true },
    { name: 'ghost', repo_name: 'ghost', short_description: 'Ghost 博客平台', star_count: 1600, is_official: true },
    { name: 'nextcloud', repo_name: 'nextcloud', short_description: 'Nextcloud 私有云盘', star_count: 2500, is_official: true },
    { name: 'portainer', repo_name: 'portainer/portainer-ce', short_description: 'Docker 可视化管理', star_count: 3200, is_official: false },
    { name: 'traefik', repo_name: 'traefik', short_description: 'Traefik 反向代理/负载均衡', star_count: 2800, is_official: true },
    { name: 'caddy', repo_name: 'caddy', short_description: 'Caddy Web 服务器 (自动 HTTPS)', star_count: 1200, is_official: true },
    { name: 'prometheus', repo_name: 'prom/prometheus', short_description: 'Prometheus 监控系统', star_count: 2600, is_official: false },
    { name: 'grafana', repo_name: 'grafana/grafana', short_description: 'Grafana 数据可视化', star_count: 3100, is_official: false },
    { name: 'influxdb', repo_name: 'influxdb', short_description: 'InfluxDB 时序数据库', star_count: 1800, is_official: true },
    { name: 'adminer', repo_name: 'adminer', short_description: '轻量级数据库管理工具', star_count: 1100, is_official: true },
    { name: 'phpmyadmin', repo_name: 'phpmyadmin', short_description: 'MySQL Web 管理工具', star_count: 1500, is_official: true },
    { name: 'minio', repo_name: 'minio/minio', short_description: 'MinIO 对象存储 (S3 兼容)', star_count: 2400, is_official: false },
    { name: 'registry', repo_name: 'registry', short_description: 'Docker 私有镜像仓库', star_count: 3800, is_official: true },
    { name: 'sonarqube', repo_name: 'sonarqube', short_description: 'SonarQube 代码质量检测', star_count: 1200, is_official: true },
    { name: 'vault', repo_name: 'hashicorp/vault', short_description: 'HashiCorp Vault 密钥管理', star_count: 1100, is_official: false },
    { name: 'consul', repo_name: 'hashicorp/consul', short_description: 'HashiCorp Consul 服务发现', star_count: 1000, is_official: false },
    { name: 'etcd', repo_name: 'quay.io/coreos/etcd', short_description: 'etcd 分布式键值存储', star_count: 900, is_official: false },
    { name: 'ollama', repo_name: 'ollama/ollama', short_description: 'Ollama 本地大模型运行', star_count: 5000, is_official: false },
    { name: 'open-webui', repo_name: 'ghcr.io/open-webui/open-webui', short_description: 'Open WebUI (ChatGPT 风格界面)', star_count: 3000, is_official: false },
    { name: 'code-server', repo_name: 'codercom/code-server', short_description: 'VS Code 网页版', star_count: 2200, is_official: false },
    { name: 'gitea', repo_name: 'gitea/gitea', short_description: 'Gitea 轻量级 Git 服务', star_count: 1800, is_official: false },
    { name: 'drone', repo_name: 'drone/drone', short_description: 'Drone CI/CD 平台', star_count: 1400, is_official: false },
  ]
}

function selectPullImage(item: any) {
  selectedPullImage.value = item
  selectedPullTag.value = 'latest'
}

async function pullSelectedImage() {
  if (!selectedServer.value || !selectedPullImage.value) {
    ElMessage.warning('请先选择一个镜像')
    return
  }
  
  const imageName = selectedPullImage.value.repo_name || selectedPullImage.value.name
  const fullImageName = `${imageName}:${selectedPullTag.value}`
  
  pulling.value = true
  pullOutput.value = `正在拉取 ${fullImageName}...\n`
  
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', `docker pull ${fullImageName}`]
    )
    pullOutput.value += result.stdout || ''
    pullOutput.value += result.stderr || ''
    
    if (result.exit_code === 0) {
      ElMessage.success('镜像拉取成功')
      loadImages()
    } else {
      pullOutput.value += '\n拉取失败'
      ElMessage.error('拉取失败')
    }
  } catch (e) {
    pullOutput.value += '\n错误: ' + (e as Error).message
    ElMessage.error('拉取失败: ' + (e as Error).message)
  } finally {
    pulling.value = false
  }
}

function closePullDialog() {
  showPullImage.value = false
  pullSearchQuery.value = ''
  pullSearchResults.value = []
  selectedPullImage.value = null
  selectedPullTag.value = 'latest'
  pullOutput.value = ''
}

async function deleteImage(image: Image) {
  try {
    await ElMessageBox.confirm(`确定删除镜像 ${image.repository}:${image.tag}？`, '确认删除', { type: 'warning' })
  } catch { return }
  if (!selectedServer.value) return
  try {
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `docker rmi ${image.id}`])
    ElMessage.success('镜像已删除')
    loadImages()
  } catch (e) {
    ElMessage.error('删除失败，可能有容器正在使用此镜像')
  }
}

async function createNetwork() {
  if (!selectedServer.value || !newNetwork.value.name) {
    ElMessage.warning('请输入网络名称')
    return
  }
  try {
    let cmd = `docker network create -d ${newNetwork.value.driver}`
    if (newNetwork.value.subnet) cmd += ` --subnet ${newNetwork.value.subnet}`
    cmd += ` ${newNetwork.value.name}`
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', cmd])
    ElMessage.success('网络创建成功')
    showCreateNetwork.value = false
    newNetwork.value = { name: '', driver: 'bridge', subnet: '' }
    loadNetworks()
  } catch (e) {
    ElMessage.error('创建失败')
  }
}

async function deleteNetwork(network: Network) {
  try {
    await ElMessageBox.confirm(`确定删除网络 ${network.name}？`, '确认删除', { type: 'warning' })
  } catch { return }
  if (!selectedServer.value) return
  try {
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `docker network rm ${network.id}`])
    ElMessage.success('网络已删除')
    loadNetworks()
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

async function createVolume() {
  if (!selectedServer.value || !newVolume.value.name) {
    ElMessage.warning('请输入卷名称')
    return
  }
  try {
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `docker volume create ${newVolume.value.name}`])
    ElMessage.success('卷创建成功')
    showCreateVolume.value = false
    newVolume.value = { name: '' }
    loadVolumes()
  } catch (e) {
    ElMessage.error('创建失败')
  }
}

async function deleteVolume(volume: Volume) {
  try {
    await ElMessageBox.confirm(`确定删除卷 ${volume.name}？`, '确认删除', { type: 'warning' })
  } catch { return }
  if (!selectedServer.value) return
  try {
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `docker volume rm ${volume.name}`])
    ElMessage.success('卷已删除')
    loadVolumes()
  } catch (e) {
    ElMessage.error('删除失败，可能有容器正在使用此卷')
  }
}

async function composeAction(project: ComposeProject, action: 'up' | 'down' | 'restart') {
  if (!selectedServer.value) return
  const actionNames: Record<string, string> = { up: '启动', down: '停止', restart: '重启' }
  try {
    const options = { project_path: project.config_files }
    switch (action) {
      case 'up':
        await window.electronAPI.compose.up(selectedServer.value, { ...options, detach: true })
        break
      case 'down':
        await window.electronAPI.compose.down(selectedServer.value, options)
        break
      case 'restart':
        await window.electronAPI.compose.restart(selectedServer.value, options)
        break
    }
    ElMessage.success(`${actionNames[action]}成功`)
    loadComposeProjects()
  } catch (e) {
    ElMessage.error(`${actionNames[action]}失败: ${(e as Error).message}`)
  }
}

function formatPorts(ports: string): string {
  if (!ports) return '-'
  const parts = ports.split(',').slice(0, 2)
  return parts.map(p => p.split('->')[0]).join(', ') + (ports.split(',').length > 2 ? '...' : '')
}

function formatSize(size: number | string): string {
  if (typeof size === 'string') return size
  if (size < 1024) return size + 'B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + 'KB'
  if (size < 1024 * 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + 'MB'
  return (size / 1024 / 1024 / 1024).toFixed(2) + 'GB'
}

function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i)
  if (!match) return 0
  const num = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  const multipliers: Record<string, number> = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }
  return num * (multipliers[unit] || 1)
}

function getComposeStatusType(status: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status?.includes('running')) return 'success'
  if (status?.includes('exited') || status?.includes('stopped')) return 'danger'
  return 'info'
}

// Docker Hub 搜索
async function searchDockerHub() {
  if (!hubSearch.value.trim()) return
  hubSearching.value = true
  hubSearchResults.value = []
  try {
    // 在线模式：走中心服务器代理
    const _settings = JSON.parse(localStorage.getItem('runixo_settings') || '{}')
    let searchUrl = `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(hubSearch.value)}&page_size=20`
    if (_settings.server?.onlineMode && _settings.server?.url) {
      searchUrl = `${_settings.server.url}/api/v1/docker/search?q=${encodeURIComponent(hubSearch.value)}&page_size=20`
    }
    const response = await fetch(searchUrl)
    const data = await response.json()
    hubSearchResults.value = data.results || []
  } catch (e) {
    ElMessage.error('搜索失败，请检查网络连接')
  } finally {
    hubSearching.value = false
  }
}

function formatStars(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M'
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K'
  return String(count)
}

function formatPullCount(count: number): string {
  if (!count) return '0'
  if (count >= 1000000000) return (count / 1000000000).toFixed(1) + 'B'
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M'
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K'
  return String(count)
}

function quickDeployFromHub(img: any) {
  const app = {
    name: img.name,
    image: 'library/' + img.name,
    defaultName: img.name,
    tags: ['latest'],
    ports: [],
    envs: [],
    volumes: []
  }
  showDeployDialog(app)
}

// 一键部署
function showDeployDialog(app: any) {
  deployApp.value = app
  deployConfig.value = {
    name: app.defaultName,
    tag: 'latest',
    ports: {},
    envs: {},
    volumes: {},
    restart: true
  }
  // 初始化默认值
  app.ports?.forEach((p: any) => { deployConfig.value.ports[p.container] = String(p.host) })
  app.envs?.forEach((e: any) => { deployConfig.value.envs[e.name] = e.default || '' })
  app.volumes?.forEach((v: any) => { deployConfig.value.volumes[v.container] = v.host })
  showDeploy.value = true
}

function quickDeploy(hubImage: any) {
  // 从 Hub 搜索结果快速部署
  const app = {
    name: hubImage.name,
    image: hubImage.name,
    defaultName: hubImage.name.split('/').pop()?.replace(/[^a-z0-9]/gi, '-') || 'app',
    tags: ['latest'],
    ports: [],
    envs: [],
    volumes: []
  }
  showDeployDialog(app)
}

async function executeDeploy() {
  if (!selectedServer.value || !deployApp.value) return
  if (!deployConfig.value.name) {
    ElMessage.warning('请输入容器名称')
    return
  }
  
  deploying.value = true
  try {
    const app = deployApp.value
    const cfg = deployConfig.value
    
    // 构建 docker run 命令
    let cmd = `docker run -d --name ${cfg.name}`
    
    // 端口映射
    Object.entries(cfg.ports).forEach(([container, host]) => {
      if (host) cmd += ` -p ${host}:${container}`
    })
    
    // 环境变量
    Object.entries(cfg.envs).forEach(([name, value]) => {
      if (value) cmd += ` -e ${name}="${value}"`
    })
    
    // 卷挂载
    Object.entries(cfg.volumes).forEach(([container, host]) => {
      if (host) cmd += ` -v ${host}:${container}`
    })
    
    // 重启策略
    if (cfg.restart) cmd += ' --restart unless-stopped'
    
    // 镜像
    cmd += ` ${app.image}:${cfg.tag}`
    
    // 先拉取镜像
    ElMessage.info('正在拉取镜像...')
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `docker pull ${app.image}:${cfg.tag}`])
    
    // 创建容器
    const result = await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', cmd])
    
    if (result.exit_code === 0) {
      ElMessage.success(`${app.name} 部署成功！`)
      showDeploy.value = false
      activeTab.value = 'containers'
      loadContainers()
    } else {
      ElMessage.error('部署失败: ' + (result.stderr || result.stdout))
    }
  } catch (e) {
    ElMessage.error('部署失败: ' + (e as Error).message)
  } finally {
    deploying.value = false
  }
}

async function pullHubImage(imageName: string) {
  pullImageName.value = imageName + ':latest'
  showPullImage.value = true
  await pullImage()
}

// Docker 代理设置函数
async function loadDockerProxy() {
  if (!selectedServer.value) return
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'cat /etc/systemd/system/docker.service.d/http-proxy.conf 2>/dev/null || echo ""']
    )
    const content = result.stdout || ''
    if (content.includes('HTTP_PROXY')) {
      dockerProxy.value.enabled = true
      const httpMatch = content.match(/HTTP_PROXY=([^\s"]+)/)
      const httpsMatch = content.match(/HTTPS_PROXY=([^\s"]+)/)
      const noProxyMatch = content.match(/NO_PROXY=([^\s"]+)/)
      if (httpMatch) dockerProxy.value.httpProxy = httpMatch[1]
      if (httpsMatch) dockerProxy.value.httpsProxy = httpsMatch[1]
      if (noProxyMatch) dockerProxy.value.noProxy = noProxyMatch[1]
    } else {
      dockerProxy.value.enabled = false
    }
  } catch (e) {
    console.error('Load proxy error:', e)
  }
}

async function saveDockerProxy() {
  if (!selectedServer.value) return
  savingProxy.value = true
  try {
    if (dockerProxy.value.enabled) {
      const envLines = []
      if (dockerProxy.value.httpProxy) envLines.push(`Environment="HTTP_PROXY=${dockerProxy.value.httpProxy}"`)
      if (dockerProxy.value.httpsProxy) envLines.push(`Environment="HTTPS_PROXY=${dockerProxy.value.httpsProxy}"`)
      if (dockerProxy.value.noProxy) envLines.push(`Environment="NO_PROXY=${dockerProxy.value.noProxy}"`)
      
      const content = `[Service]\n${envLines.join('\n')}`
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
        `sudo mkdir -p /etc/systemd/system/docker.service.d && echo '${content}' | sudo tee /etc/systemd/system/docker.service.d/http-proxy.conf`
      ])
    } else {
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
        'sudo rm -f /etc/systemd/system/docker.service.d/http-proxy.conf'
      ])
    }
    // 重载 systemd 并重启 docker
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      'sudo systemctl daemon-reload && sudo systemctl restart docker'
    ])
    // 保存到本地存储
    saveDockerSettingsToLocal()
    ElMessage.success('代理设置已保存，Docker 已重启')
  } catch (e) {
    ElMessage.error('保存失败: ' + (e as Error).message)
  } finally {
    savingProxy.value = false
  }
}

async function saveDockerMirror() {
  if (!selectedServer.value) return
  savingMirror.value = true
  try {
    if (dockerMirror.value.enabled && dockerMirror.value.mirrors.trim()) {
      const mirrors = dockerMirror.value.mirrors.trim().split('\n').filter(m => m.trim()).map(m => `"${m.trim()}"`)
      const daemonJson = `{\n  "registry-mirrors": [${mirrors.join(', ')}]\n}`
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
        `echo '${daemonJson}' | sudo tee /etc/docker/daemon.json`
      ])
    } else {
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
        'sudo rm -f /etc/docker/daemon.json'
      ])
    }
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      'sudo systemctl restart docker'
    ])
    // 保存到本地存储
    saveDockerSettingsToLocal()
    ElMessage.success('镜像加速器设置已保存，Docker 已重启')
  } catch (e) {
    ElMessage.error('保存失败: ' + (e as Error).message)
  } finally {
    savingMirror.value = false
  }
}

function setMirrorPreset(preset: string) {
  const presets: Record<string, string> = {
    tencent: 'https://mirror.ccs.tencentyun.com',
    aliyun: 'https://registry.cn-hangzhou.aliyuncs.com',
    ustc: 'https://docker.mirrors.ustc.edu.cn'
  }
  dockerMirror.value.enabled = true
  dockerMirror.value.mirrors = presets[preset] || ''
  // 保存到本地存储
  saveDockerSettingsToLocal()
}

async function loadDockerInfo() {
  if (!selectedServer.value) return
  loadingInfo.value = true
  try {
    const result = await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      'docker info --format "{{.ServerVersion}}|{{.Driver}}|{{.Containers}}|{{.Images}}|{{.DockerRootDir}}"'
    ])
    if (result.stdout) {
      const [version, storageDriver, containers, images, dataRoot] = result.stdout.trim().split('|')
      dockerInfo.value = { version, storageDriver, containers, images, dataRoot }
    }
  } catch (e) {
    console.error('Load docker info error:', e)
  } finally {
    loadingInfo.value = false
  }
}

// 加载 Docker Hub 热门镜像
async function loadHubTrending() {
  loadingTrending.value = true
  try {
    // 获取官方热门镜像
    const response = await fetch('https://hub.docker.com/v2/repositories/library/?page_size=12&ordering=-pull_count')
    const data = await response.json()
    hubTrending.value = data.results || []
  } catch (e) {
    console.error('Load trending error:', e)
  } finally {
    loadingTrending.value = false
  }
}
</script>

<style lang="scss" scoped>
// 动画关键帧
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 3px currentColor; }
  50% { box-shadow: 0 0 8px currentColor; }
}

.docker-page {
  max-width: 1400px;
  margin: 0 auto;
  animation: fadeIn 0.4s ease-out;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  animation: slideUp 0.4s ease-out;

  .header-left {
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { color: var(--text-secondary); font-size: 13px; }
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}

.empty-state {
  padding: 60px 0;
  animation: fadeIn 0.5s ease-out;
}

.docker-tabs {
  margin-bottom: 16px;
  animation: slideUp 0.4s ease-out 0.1s both;

  .tab-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.tab-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  animation: fadeIn 0.3s ease-out;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.data-table {
  :deep(.el-table__row) {
    transition: all 0.2s ease;
    
    &:hover {
      background-color: var(--bg-tertiary) !important;
      transform: scale(1.002);
    }
  }

  .cell-name {
    display: flex;
    align-items: center;
    gap: 8px;

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      transition: all 0.3s ease;
      
      &.running { 
        background: #22c55e; 
        animation: glow 2s ease-in-out infinite;
        color: #22c55e;
      }
      &.exited, &.stopped { background: #ef4444; }
      &.paused { 
        background: #f59e0b; 
        animation: pulse 1.5s ease-in-out infinite;
      }
    }
  }

  .mono {
    font-family: 'Consolas', monospace;
    font-size: 12px;
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .text-muted {
    color: var(--text-secondary);
  }
}

.log-container {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 12px;
  max-height: 500px;
  overflow: auto;

  pre {
    margin: 0;
    font-size: 12px;
    color: var(--text-color);
    white-space: pre-wrap;
    word-break: break-all;
    font-family: 'Consolas', monospace;
  }
}

.pull-output {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 12px;
  margin-top: 12px;
  max-height: 200px;
  overflow: auto;

  pre {
    margin: 0;
    font-size: 12px;
    color: var(--text-color);
    white-space: pre-wrap;
    font-family: 'Consolas', monospace;
  }
}

:deep(.dark-dialog) {
  .el-dialog { background: var(--bg-secondary) !important; }
  .el-dialog__header { background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
  .el-dialog__title { color: var(--text-color); }
  .el-dialog__body { background: var(--bg-secondary); }
  .el-dialog__footer { background: var(--bg-secondary); border-top: 1px solid var(--border-color); }
}

// 应用商店样式
.popular-apps {
  h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: var(--text-color);
  }
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.app-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .app-icon {
    font-size: 32px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .app-info {
    flex: 1;
    min-width: 0;

    .app-name {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .app-desc {
      font-size: 12px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .deploy-btn {
    flex-shrink: 0;
  }
}

.hub-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-results {
  margin-top: 16px;
}

// Docker Hub 热门镜像样式
.hub-trending {
  margin-bottom: 24px;

  h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: var(--text-color);
  }
}

.trending-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.trending-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }

  .trending-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border-radius: 8px;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .default-icon {
      font-size: 24px;
    }
  }

  .trending-info {
    flex: 1;
    min-width: 0;

    .trending-name {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 2px;
    }

    .trending-desc {
      font-size: 11px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }

    .trending-stats {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: var(--text-secondary);
    }
  }
}

// 设置页面样式
.settings-section {
  padding: 20px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin-bottom: 16px;

  h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .section-desc {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }
}

.proxy-form, .mirror-form {
  max-width: 500px;

  .form-tip {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
  }
}

.mirror-presets {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;

  .preset-label {
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.docker-info {
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color);

    &:last-child {
      border-bottom: none;
    }

    .label {
      color: var(--text-secondary);
      font-size: 13px;
    }

    .value {
      font-family: monospace;
      font-size: 13px;
    }
  }
}

// 拉取镜像对话框样式
.pull-dialog {
  :deep(.el-dialog__body) {
    padding: 16px 20px;
    max-height: 70vh;
    overflow-y: auto;
  }
}

.pull-search {
  margin-bottom: 16px;
  
  .search-row {
    display: flex;
    align-items: center;
  }
  
  .search-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-muted);
    
    .el-icon {
      color: var(--warning-color);
    }
  }
}

.pull-results, .pull-popular {
  .results-header {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 280px;
    overflow-y: auto;
  }
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-color);
  }

  &.selected {
    border-color: var(--primary-color);
    background: rgba(99, 102, 241, 0.1);
  }

  .result-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }

  .result-info {
    flex: 1;
    min-width: 0;

    .result-name {
      font-weight: 500;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .result-desc {
      font-size: 12px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    .result-stats {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
  }

  .result-check {
    color: var(--primary-color);
    font-size: 20px;
  }
}

.pull-empty {
  padding: 20px 0;
}

.pull-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--text-secondary);
}

.selected-image {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--primary-color);

  .selected-header {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .selected-content {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .selected-name {
      font-weight: 600;
      font-size: 15px;
    }
  }
}

.pull-output {
  margin-top: 16px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 12px;
  max-height: 150px;
  overflow: auto;

  .output-header {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  pre {
    margin: 0;
    font-size: 12px;
    color: var(--text-color);
    white-space: pre-wrap;
    font-family: 'Consolas', monospace;
  }
}
</style>
