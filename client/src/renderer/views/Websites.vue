<template>
  <div class="websites">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1>网站管理</h1>
        <p class="subtitle">站点配置与项目部署</p>
      </div>
      <div class="header-actions">
        <el-select v-if="hasMultipleServers" v-model="selectedServer" placeholder="选择服务器" size="small">
          <el-option v-for="s in connectedServers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button @click="refresh" :loading="loading" size="small">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
        <el-dropdown @command="handleAddCommand">
          <el-button type="primary" size="small">
            <el-icon><Plus /></el-icon>添加<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="static">静态站点</el-dropdown-item>
              <el-dropdown-item command="project">项目部署</el-dropdown-item>
              <el-dropdown-item command="proxy">反向代理</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 环境提示栏 -->
    <div v-if="selectedServer && envChecked && missingEnvCount > 0" class="env-warning-bar">
      <div class="warning-content">
        <el-icon class="warning-icon"><Warning /></el-icon>
        <span>检测到缺少 {{ missingEnvCount }} 个必要依赖 ({{ missingEnvNames }})，部署可能失败</span>
      </div>
      <el-button type="warning" size="small" @click="goToEnvPage">
        前往环境管理
      </el-button>
    </div>

    <div v-if="!selectedServer" class="empty-state">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <template v-if="selectedServer">
      <!-- 标签页 -->
      <el-tabs v-model="activeTab" class="main-tabs">
        <el-tab-pane name="sites">
          <template #label>
            <span class="tab-label">站点列表 <el-badge :value="sites.length" :max="99" type="info" /></span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="projects">
          <template #label>
            <span class="tab-label">项目部署 <el-badge :value="projects.length" :max="99" type="info" /></span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <!-- 站点列表 -->
      <div v-show="activeTab === 'sites'" class="tab-content">
        <el-table :data="sites" v-loading="loading" size="small" class="data-table">
          <el-table-column prop="name" label="站点名称" min-width="140">
            <template #default="{ row }">
              <div class="cell-name">
                <span class="status-dot" :class="row.status"></span>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="domain" label="域名" min-width="180">
            <template #default="{ row }">
              <a :href="(row.ssl ? 'https://' : 'http://') + row.domain" target="_blank" class="domain-link">
                <el-icon v-if="row.ssl"><Lock /></el-icon>
                {{ row.domain }}
              </a>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="getTypeTag(row.type)">{{ getTypeLabel(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="path" label="目录" min-width="160">
            <template #default="{ row }">
              <code class="mono">{{ row.path }}</code>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button @click="openSite(row)">打开</el-button>
                <el-button @click="editSite(row)">设置</el-button>
                <el-button v-if="row.status === 'running'" type="warning" @click="toggleSite(row, 'stop')">停止</el-button>
                <el-button v-else type="success" @click="toggleSite(row, 'start')">启动</el-button>
                <el-button type="danger" @click="deleteSite(row)">删除</el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 项目部署 -->
      <div v-show="activeTab === 'projects'" class="tab-content">
        <div v-if="projects.length === 0" class="empty-projects">
          <el-empty description="暂无部署项目">
            <el-button type="primary" size="small" @click="handleAddCommand('project')">创建项目部署</el-button>
          </el-empty>
        </div>
        <div v-else class="projects-grid">
          <div v-for="project in projects" :key="project.id" class="project-card">
            <div class="project-header">
              <div class="project-icon" :style="{ background: getProjectColor(project.type) }">
                <TechIcon :name="project.type" />
              </div>
              <div class="project-info">
                <div class="project-name">{{ project.name }}</div>
                <div class="project-domain">{{ project.domain }}</div>
              </div>
              <el-tag :type="getProjectStatusType(project.status)" size="small">{{ getProjectStatusLabel(project.status) }}</el-tag>
            </div>
            <div class="project-meta">
              <div class="meta-item"><span class="meta-label">目录:</span> <code>{{ project.path }}</code></div>
              <div class="meta-item"><span class="meta-label">端口:</span> {{ project.port || '-' }}</div>
              <div class="meta-item" v-if="project.remark"><span class="meta-label">备注:</span> {{ project.remark }}</div>
              <div class="meta-item" v-if="project.lastDeploy"><span class="meta-label">上次部署:</span> {{ formatTime(project.lastDeploy) }}</div>
            </div>
            <div class="project-actions">
              <el-button size="small" type="primary" @click="deployProject(project)" :loading="project.deploying">
                {{ project.deploying ? '部署中' : '部署' }}
              </el-button>
              <el-button size="small" @click="viewProjectLogs(project)">日志</el-button>
              <el-button size="small" @click="editProject(project)">设置</el-button>
              <el-button size="small" v-if="project.status === 'running'" type="warning" @click="stopProject(project)">停止</el-button>
              <el-button size="small" v-else type="success" @click="startProject(project)">启动</el-button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 添加静态站点对话框 -->
    <el-dialog v-model="showAddStatic" title="添加静态站点" width="520px" class="site-dialog" destroy-on-close>
      <el-form :model="newSite" label-width="80px" size="default" class="site-form">
        <el-form-item label="站点名称" required>
          <el-input v-model="newSite.name" placeholder="my-website" />
        </el-form-item>
        <el-form-item label="域名" required>
          <el-input v-model="newSite.domain" placeholder="example.com" />
        </el-form-item>
        <el-form-item label="根目录" required>
          <el-input v-model="newSite.path" placeholder="/var/www/html" />
        </el-form-item>
        <el-form-item label="启用 SSL">
          <el-switch v-model="newSite.ssl" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddStatic = false">取消</el-button>
        <el-button type="primary" @click="createStaticSite" :loading="creating">创建站点</el-button>
      </template>
    </el-dialog>

    <!-- 添加反向代理对话框 -->
    <el-dialog v-model="showAddProxy" title="添加反向代理" width="520px" class="site-dialog" destroy-on-close>
      <el-form :model="newProxy" label-width="80px" size="default" class="site-form">
        <el-form-item label="站点名称" required>
          <el-input v-model="newProxy.name" placeholder="my-api" />
        </el-form-item>
        <el-form-item label="域名" required>
          <el-input v-model="newProxy.domain" placeholder="api.example.com" />
        </el-form-item>
        <el-form-item label="代理地址" required>
          <el-input v-model="newProxy.upstream" placeholder="http://127.0.0.1:3000" />
        </el-form-item>
        <el-form-item label="WebSocket">
          <el-switch v-model="newProxy.websocket" />
        </el-form-item>
        <el-form-item label="启用 SSL">
          <el-switch v-model="newProxy.ssl" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddProxy = false">取消</el-button>
        <el-button type="primary" @click="createProxySite" :loading="creating">创建代理</el-button>
      </template>
    </el-dialog>

    <!-- 项目部署向导 - 重新设计的4步流程 -->
    <el-dialog v-model="showAddProject" title="" width="900px" class="deploy-wizard-dialog" :show-close="false" destroy-on-close>
      <div class="wizard-container">
        <!-- 顶部标题栏 -->
        <div class="wizard-header">
          <div class="wizard-title">
            <el-icon class="title-icon"><Promotion /></el-icon>
            <span>项目部署</span>
          </div>
          <el-button class="close-btn" text circle @click="showAddProject = false">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        
        <!-- 步骤指示器 - 4步 -->
        <div class="wizard-steps">
          <div 
            v-for="(step, index) in deploySteps" 
            :key="step.key"
            class="wizard-step"
            :class="{ 
              active: deployStep === step.key, 
              completed: index < deployStepIndex,
              clickable: index <= deployStepIndex
            }"
            @click="index <= deployStepIndex && (deployStep = step.key)"
          >
            <div class="step-indicator">
              <el-icon v-if="index < deployStepIndex"><Check /></el-icon>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <div class="step-info">
              <div class="step-title">{{ step.title }}</div>
            </div>
          </div>
        </div>

        <!-- 步骤内容 -->
        <div class="wizard-content">
          <!-- 步骤1: 基本信息 -->
          <div v-show="deployStep === 'basic'" class="step-panel">
            <div class="panel-section">
              <div class="section-title">
                <el-icon><Edit /></el-icon>
                <span>基本信息</span>
              </div>
              <el-form :model="newProject" label-position="top" class="wizard-form">
                <el-form-item label="项目名称" required>
                  <el-input v-model="newProject.name" placeholder="my-app" maxlength="32" show-word-limit />
                  <div class="form-tip">用于标识项目，建议使用英文和短横线，如 my-blog</div>
                </el-form-item>
                <el-form-item label="备注说明">
                  <el-input v-model="newProject.remark" placeholder="项目的简要描述（可选）" maxlength="100" show-word-limit />
                </el-form-item>
              </el-form>
            </div>
          </div>

          <!-- 步骤2: 项目代码 -->
          <div v-show="deployStep === 'code'" class="step-panel">
            <!-- 代码来源 -->
            <div class="panel-section">
              <div class="section-title">
                <el-icon><Folder /></el-icon>
                <span>代码来源</span>
              </div>
              
              <div class="source-tabs">
                <div 
                  class="source-tab" 
                  :class="{ active: codeSource === 'server' }"
                  @click="codeSource = 'server'"
                >
                  <el-icon><Monitor /></el-icon>
                  <span>服务器目录</span>
                </div>
                <div 
                  class="source-tab" 
                  :class="{ active: codeSource === 'upload' }"
                  @click="codeSource = 'upload'"
                >
                  <el-icon><Upload /></el-icon>
                  <span>上传代码</span>
                </div>
              </div>

              <!-- 服务器目录选择 -->
              <div v-if="codeSource === 'server'" class="source-content">
                <div class="path-input-group">
                  <el-input v-model="newProject.path" placeholder="/var/www/my-app">
                    <template #prefix><el-icon><Folder /></el-icon></template>
                  </el-input>
                  <el-button type="primary" @click="showProjectPathBrowser = true">
                    <el-icon><FolderOpened /></el-icon>浏览
                  </el-button>
                </div>
                <div class="form-tip">选择服务器上已有的项目目录</div>
              </div>

              <!-- 上传代码 -->
              <div v-else class="source-content">
                <div class="upload-zone" v-if="!selectedLocalPath" @click="selectFolder">
                  <el-icon class="upload-icon"><UploadFilled /></el-icon>
                  <div class="upload-text">点击选择本地项目文件夹</div>
                </div>
                <div class="upload-selected" v-else>
                  <div class="selected-info">
                    <el-icon><Folder /></el-icon>
                    <span>{{ selectedLocalPath }}</span>
                    <el-button text type="primary" size="small" @click="selectFolder">重新选择</el-button>
                  </div>
                  <div class="file-preview" v-if="uploadFiles.length">
                    <div class="preview-title">文件预览 ({{ uploadFiles.length }} 个文件)</div>
                    <div class="preview-list">
                      <div v-for="f in uploadFiles.slice(0, 6)" :key="f.path" class="preview-item">
                        <el-icon v-if="f.isDir" class="folder"><Folder /></el-icon>
                        <el-icon v-else><Document /></el-icon>
                        <span>{{ f.name }}</span>
                      </div>
                      <div v-if="uploadFiles.length > 6" class="preview-more">还有 {{ uploadFiles.length - 6 }} 个...</div>
                    </div>
                  </div>
                  <el-form-item label="上传到服务器目录" style="margin-top: 16px;">
                    <el-input v-model="newProject.path" :placeholder="'/var/www/' + (newProject.name || 'my-app')" />
                  </el-form-item>
                </div>
              </div>
            </div>

            <!-- 项目类型选择 -->
            <div class="panel-section" style="margin-top: 24px;">
              <div class="section-title">
                <el-icon><Box /></el-icon>
                <span>项目类型</span>
                <el-tag v-if="detectedType" type="success" size="small" style="margin-left: 8px;">已自动检测</el-tag>
              </div>
              
              <div class="type-grid">
                <div 
                  v-for="pt in projectTypes" 
                  :key="pt.value"
                  class="type-item"
                  :class="{ active: newProject.type === pt.value }"
                  @click="selectProjectType(pt.value)"
                >
                  <div class="type-icon" :style="{ background: pt.color }">
                    <TechIcon :name="pt.value" />
                  </div>
                  <div class="type-name">{{ pt.label }}</div>
                </div>
              </div>
            </div>

            <!-- 运行端口 -->
            <div class="panel-section" style="margin-top: 24px;" v-if="needsPort">
              <div class="section-title">
                <el-icon><Connection /></el-icon>
                <span>运行端口</span>
              </div>
              <el-input-number v-model="newProject.port" :min="1024" :max="65535" style="width: 200px;" controls-position="right" />
              <span class="port-hint">应用监听的端口，Nginx 会将请求转发到此端口</span>
            </div>
          </div>

          <!-- 步骤3: 域名设置 (包含SSL) -->
          <div v-show="deployStep === 'domain'" class="step-panel">
            <!-- 服务器信息 -->
            <div class="server-info-bar">
              <div class="info-item">
                <span class="info-label">服务器 IP:</span>
                <code>{{ serverPublicIP || '获取中...' }}</code>
                <el-button text size="small" @click="copyToClipboard(serverPublicIP)">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </div>
            </div>

            <!-- 访问方式 -->
            <div class="panel-section">
              <div class="section-title">
                <el-icon><Link /></el-icon>
                <span>访问方式</span>
              </div>
              
              <el-radio-group v-model="newProject.domainType" class="access-radio-group">
                <el-radio value="ip" class="access-radio">
                  <div class="radio-content">
                    <div class="radio-title">IP 直接访问</div>
                    <div class="radio-desc">通过 http://{{ serverPublicIP }}:{{ newProject.port || 80 }} 访问</div>
                  </div>
                </el-radio>
                <el-radio value="domain" class="access-radio">
                  <div class="radio-content">
                    <div class="radio-title">域名访问</div>
                    <div class="radio-desc">需要先将域名 DNS 解析到服务器 IP</div>
                  </div>
                </el-radio>
              </el-radio-group>

              <!-- 域名输入 -->
              <div v-if="newProject.domainType === 'domain'" class="domain-input-section">
                <el-input v-model="newProject.domain" placeholder="app.example.com" size="large">
                  <template #prepend>http(s)://</template>
                </el-input>
                
                <!-- DNS 配置提示 -->
                <div class="dns-hint">
                  <el-icon><InfoFilled /></el-icon>
                  <span>请在域名服务商添加 A 记录: {{ getDomainPrefix(newProject.domain) || '主机记录' }} → {{ serverPublicIP }}</span>
                </div>
              </div>
            </div>

            <!-- SSL 证书 -->
            <div class="panel-section" style="margin-top: 24px;">
              <div class="section-title">
                <el-icon><Lock /></el-icon>
                <span>SSL 证书</span>
              </div>
              
              <div class="ssl-options">
                <div 
                  class="ssl-option" 
                  :class="{ active: !newProject.ssl }"
                  @click="newProject.ssl = false"
                >
                  <el-icon><Unlock /></el-icon>
                  <div class="ssl-text">
                    <div class="ssl-title">HTTP</div>
                    <div class="ssl-desc">不启用加密</div>
                  </div>
                </div>
                <div 
                  class="ssl-option" 
                  :class="{ active: newProject.ssl }"
                  @click="newProject.ssl = true"
                >
                  <el-icon><Lock /></el-icon>
                  <div class="ssl-text">
                    <div class="ssl-title">HTTPS</div>
                    <div class="ssl-desc">Let's Encrypt 免费证书</div>
                  </div>
                </div>
              </div>
              
              <el-alert v-if="newProject.ssl" type="info" :closable="false" style="margin-top: 12px;">
                SSL 证书将在部署后自动申请，需确保域名已正确解析且 80 端口可访问
              </el-alert>
            </div>
          </div>

          <!-- 步骤4: 部署设置 -->
          <div v-show="deployStep === 'deploy'" class="step-panel">
            <!-- 部署模板 -->
            <div class="panel-section">
              <div class="section-title">
                <el-icon><Files /></el-icon>
                <span>部署模板</span>
                <el-tag v-if="matchedTemplate" type="success" size="small" style="margin-left: 8px;">已自动匹配</el-tag>
              </div>
              
              <div class="template-grid">
                <div 
                  v-for="tpl in deployTemplates" 
                  :key="tpl.id"
                  class="template-card"
                  :class="{ active: selectedTemplate === tpl.id }"
                  @click="applyTemplate(tpl.id)"
                >
                  <div class="template-icon">{{ tpl.icon }}</div>
                  <div class="template-info">
                    <div class="template-name">{{ tpl.name }}</div>
                    <div class="template-desc">{{ tpl.desc }}</div>
                  </div>
                  <el-icon v-if="selectedTemplate === tpl.id" class="template-check"><CircleCheck /></el-icon>
                </div>
              </div>
            </div>

            <!-- 构建命令 -->
            <div class="panel-section" style="margin-top: 24px;">
              <div class="section-title">
                <el-icon><Cpu /></el-icon>
                <span>构建命令</span>
                <span class="section-hint">（可选步骤失败不会中断部署）</span>
              </div>
              
              <div class="build-commands">
                <div v-for="(cmd, index) in newProject.buildSteps" :key="index" class="command-row">
                  <span class="cmd-num">{{ index + 1 }}</span>
                  <el-input v-model="cmd.command" placeholder="npm install" class="cmd-input" />
                  <el-checkbox v-model="cmd.optional" class="cmd-optional">可选</el-checkbox>
                  <el-button text type="danger" @click="removeBuildStep(index)" :disabled="newProject.buildSteps.length <= 1">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <el-button text type="primary" @click="addBuildStep" class="add-cmd-btn">
                  <el-icon><Plus /></el-icon>添加命令
                </el-button>
              </div>
            </div>

            <!-- 启动命令 -->
            <div class="panel-section" style="margin-top: 24px;" v-if="needsPort">
              <div class="section-title">
                <el-icon><VideoPlay /></el-icon>
                <span>启动命令</span>
              </div>
              <el-input v-model="newProject.startCommand" :placeholder="getDefaultStartCommand(newProject.type)" />
              
              <!-- 进程管理器 -->
              <div class="pm-row" style="margin-top: 12px;">
                <span class="pm-label">进程管理:</span>
                <el-radio-group v-model="newProject.processManager" size="small">
                  <el-radio-button value="systemd">Systemd</el-radio-button>
                  <el-radio-button value="pm2">PM2</el-radio-button>
                </el-radio-group>
              </div>
            </div>

            <!-- 环境变量 -->
            <div class="panel-section" style="margin-top: 24px;">
              <div class="section-title">
                <el-icon><Setting /></el-icon>
                <span>环境变量</span>
                <span class="section-hint">（可选）</span>
              </div>
              
              <div class="env-vars" v-if="newProject.envVars.length">
                <div v-for="(env, index) in newProject.envVars" :key="index" class="env-row">
                  <el-input v-model="env.key" placeholder="KEY" class="env-key" />
                  <span class="env-eq">=</span>
                  <el-input v-model="env.value" placeholder="value" class="env-value" :type="isSecretKey(env.key) ? 'password' : 'text'" show-password />
                  <el-button text type="danger" @click="removeEnvVar(index)"><el-icon><Delete /></el-icon></el-button>
                </div>
              </div>
              <el-button text type="primary" @click="addEnvVar" class="add-cmd-btn">
                <el-icon><Plus /></el-icon>添加变量
              </el-button>
            </div>

            <!-- 部署预览 -->
            <div class="deploy-summary">
              <div class="summary-title">部署预览</div>
              <div class="summary-content">
                <div class="summary-item"><span>项目:</span> {{ newProject.name }}</div>
                <div class="summary-item"><span>类型:</span> {{ getProjectTypeLabel(newProject.type) }}</div>
                <div class="summary-item"><span>目录:</span> <code>{{ newProject.path }}</code></div>
                <div class="summary-item"><span>访问:</span> {{ newProject.ssl ? 'https://' : 'http://' }}{{ newProject.domainType === 'ip' ? serverPublicIP + ':' + newProject.port : newProject.domain }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <div class="wizard-footer">
          <el-button @click="showAddProject = false">取消</el-button>
          <div class="footer-right">
            <el-button v-if="deployStepIndex > 0" @click="prevDeployStep">
              <el-icon><ArrowLeft /></el-icon>上一步
            </el-button>
            <el-button v-if="deployStepIndex < deploySteps.length - 1" type="primary" @click="nextDeployStep">
              下一步<el-icon><ArrowRight /></el-icon>
            </el-button>
            <el-button v-else type="primary" @click="createProject" :loading="creating">
              <el-icon><Check /></el-icon>创建并部署
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 部署日志对话框 -->
    <el-dialog v-model="showDeployLog" :title="`部署日志 - ${currentProject?.name}`" width="800px" top="5vh" class="log-dialog" destroy-on-close>
      <div class="log-container">
        <div class="log-toolbar">
          <el-button-group size="small">
            <el-button @click="scrollLogToTop"><el-icon><Top /></el-icon></el-button>
            <el-button @click="scrollLogToBottom"><el-icon><Bottom /></el-icon></el-button>
          </el-button-group>
          <el-button size="small" @click="copyLog"><el-icon><CopyDocument /></el-icon>复制</el-button>
        </div>
        <div class="log-content" ref="logContainer">
          <pre>{{ deployLog }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="showDeployLog = false">关闭</el-button>
        <el-button type="primary" @click="loadProjectLogs(currentProject!)" :loading="loadingLogs">刷新</el-button>
      </template>
    </el-dialog>

    <!-- 站点设置对话框 -->
    <el-dialog v-model="showSiteSettings" :title="`站点设置 - ${currentSite?.name}`" width="560px" class="site-dialog" destroy-on-close>
      <el-form :model="currentSite" label-width="80px" v-if="currentSite" class="site-form">
        <el-form-item label="域名">
          <el-input v-model="currentSite.domain" />
        </el-form-item>
        <el-form-item label="根目录">
          <el-input v-model="currentSite.path" />
        </el-form-item>
        <el-form-item label="启用 SSL">
          <el-switch v-model="currentSite.ssl" />
        </el-form-item>
        <el-form-item label="伪静态">
          <div class="rewrite-presets">
            <el-button size="small" @click="applyRewrite('vue')">Vue/React</el-button>
            <el-button size="small" @click="applyRewrite('laravel')">Laravel</el-button>
            <el-button size="small" @click="applyRewrite('wordpress')">WordPress</el-button>
          </div>
          <el-input type="textarea" v-model="currentSite.rewrite" :rows="5" class="code-textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSiteSettings = false">取消</el-button>
        <el-button type="primary" @click="saveSiteSettings" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 项目设置对话框 - 完整版 -->
    <el-dialog v-model="showProjectSettings" :title="`项目设置 - ${currentProject?.name}`" width="800px" top="5vh" class="project-settings-dialog" destroy-on-close>
      <div class="settings-container" v-if="currentProject">
        <!-- 设置标签页 -->
        <el-tabs v-model="settingsTab" class="settings-tabs">
          <el-tab-pane label="基本信息" name="basic">
            <div class="settings-section">
              <div class="section-title">
                <el-icon><Edit /></el-icon>
                <span>基本信息</span>
              </div>
              <el-form :model="currentProject" label-position="top" class="settings-form">
                <el-form-item label="项目名称">
                  <el-input v-model="currentProject.name" disabled />
                  <div class="form-tip">项目名称创建后不可修改</div>
                </el-form-item>
                <el-form-item label="备注说明">
                  <el-input v-model="currentProject.remark" placeholder="项目的简要描述（可选）" maxlength="100" show-word-limit />
                </el-form-item>
                <el-form-item label="项目类型">
                  <div class="type-grid compact">
                    <div 
                      v-for="pt in projectTypes" 
                      :key="pt.value"
                      class="type-item"
                      :class="{ active: currentProject.type === pt.value }"
                      @click="currentProject.type = pt.value"
                    >
                      <div class="type-icon" :style="{ background: pt.color }">
                        <TechIcon :name="pt.value" />
                      </div>
                      <div class="type-name">{{ pt.label }}</div>
                    </div>
                  </div>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>

          <el-tab-pane label="项目代码" name="code">
            <div class="settings-section">
              <div class="section-title">
                <el-icon><Folder /></el-icon>
                <span>项目目录</span>
              </div>
              <div class="path-input-group">
                <el-input v-model="currentProject.path" placeholder="/var/www/my-app">
                  <template #prefix><el-icon><Folder /></el-icon></template>
                </el-input>
                <el-button type="primary" @click="browseProjectSettingsPath">
                  <el-icon><FolderOpened /></el-icon>浏览
                </el-button>
              </div>
            </div>

            <div class="settings-section" style="margin-top: 24px;" v-if="needsPortForProject(currentProject.type)">
              <div class="section-title">
                <el-icon><Connection /></el-icon>
                <span>运行端口</span>
              </div>
              <el-input-number v-model="currentProject.port" :min="1024" :max="65535" style="width: 200px;" controls-position="right" />
              <span class="port-hint">应用监听的端口，Nginx 会将请求转发到此端口</span>
            </div>

            <div class="settings-section" style="margin-top: 24px;" v-if="currentProject.type === 'static-build'">
              <div class="section-title">
                <el-icon><FolderOpened /></el-icon>
                <span>输出目录</span>
              </div>
              <el-input v-model="currentProject.outputDir" placeholder="dist" />
              <div class="form-tip">构建后的静态文件目录，如 dist、build、public 等</div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="域名设置" name="domain">
            <div class="settings-section">
              <div class="section-title">
                <el-icon><Link /></el-icon>
                <span>访问方式</span>
              </div>
              
              <el-radio-group v-model="currentProject.domainType" class="access-radio-group">
                <el-radio value="ip" class="access-radio">
                  <div class="radio-content">
                    <div class="radio-title">IP 直接访问</div>
                    <div class="radio-desc">通过 http://{{ serverPublicIP }}:{{ currentProject.port || 80 }} 访问</div>
                  </div>
                </el-radio>
                <el-radio value="domain" class="access-radio">
                  <div class="radio-content">
                    <div class="radio-title">域名访问</div>
                    <div class="radio-desc">需要先将域名 DNS 解析到服务器 IP</div>
                  </div>
                </el-radio>
              </el-radio-group>

              <!-- 域名输入 -->
              <div v-if="currentProject.domainType === 'domain'" class="domain-input-section">
                <el-input v-model="currentProject.domain" placeholder="app.example.com" size="large">
                  <template #prepend>http(s)://</template>
                </el-input>
                
                <div class="dns-hint">
                  <el-icon><InfoFilled /></el-icon>
                  <span>请在域名服务商添加 A 记录: {{ getDomainPrefix(currentProject.domain) || '主机记录' }} → {{ serverPublicIP }}</span>
                </div>
              </div>
            </div>

            <!-- SSL 证书 -->
            <div class="settings-section" style="margin-top: 24px;">
              <div class="section-title">
                <el-icon><Lock /></el-icon>
                <span>SSL 证书</span>
              </div>
              
              <div class="ssl-options">
                <div 
                  class="ssl-option" 
                  :class="{ active: !currentProject.ssl }"
                  @click="currentProject.ssl = false"
                >
                  <el-icon><Unlock /></el-icon>
                  <div class="ssl-text">
                    <div class="ssl-title">HTTP</div>
                    <div class="ssl-desc">不启用加密</div>
                  </div>
                </div>
                <div 
                  class="ssl-option" 
                  :class="{ active: currentProject.ssl, disabled: currentProject.domainType === 'ip' }"
                  @click="currentProject.domainType === 'domain' && (currentProject.ssl = true)"
                >
                  <el-icon><Lock /></el-icon>
                  <div class="ssl-text">
                    <div class="ssl-title">HTTPS</div>
                    <div class="ssl-desc">Let's Encrypt 免费证书</div>
                  </div>
                </div>
              </div>
              
              <el-alert v-if="currentProject.ssl && currentProject.domainType === 'domain'" type="info" :closable="false" style="margin-top: 12px;">
                保存后点击"申请证书"按钮来申请 SSL 证书
              </el-alert>
              <el-alert v-if="currentProject.domainType === 'ip'" type="warning" :closable="false" style="margin-top: 12px;">
                IP 访问模式不支持 SSL 证书，请切换到域名访问模式
              </el-alert>
            </div>
          </el-tab-pane>

          <el-tab-pane label="部署设置" name="deploy">
            <!-- 构建命令 -->
            <div class="settings-section">
              <div class="section-title">
                <el-icon><Cpu /></el-icon>
                <span>构建命令</span>
                <span class="section-hint">（可选步骤失败不会中断部署）</span>
              </div>
              
              <div class="build-commands">
                <div v-for="(cmd, index) in currentProject.buildSteps" :key="index" class="command-row">
                  <span class="cmd-num">{{ index + 1 }}</span>
                  <el-input v-model="cmd.command" placeholder="npm install" class="cmd-input" />
                  <el-checkbox v-model="cmd.optional" class="cmd-optional">可选</el-checkbox>
                  <el-button text type="danger" @click="currentProject.buildSteps.splice(index, 1)" :disabled="currentProject.buildSteps.length <= 1">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <el-button text type="primary" @click="currentProject.buildSteps.push({ command: '', optional: false })" class="add-cmd-btn">
                  <el-icon><Plus /></el-icon>添加命令
                </el-button>
              </div>
            </div>

            <!-- 启动命令 -->
            <div class="settings-section" style="margin-top: 24px;" v-if="needsPortForProject(currentProject.type)">
              <div class="section-title">
                <el-icon><VideoPlay /></el-icon>
                <span>启动命令</span>
              </div>
              <el-input v-model="currentProject.startCommand" :placeholder="getDefaultStartCommand(currentProject.type)" />
              
              <!-- 进程管理器 -->
              <div class="pm-row" style="margin-top: 12px;">
                <span class="pm-label">进程管理:</span>
                <el-radio-group v-model="currentProject.processManager" size="small">
                  <el-radio-button value="systemd">Systemd</el-radio-button>
                  <el-radio-button value="pm2">PM2</el-radio-button>
                </el-radio-group>
              </div>
            </div>

            <!-- 环境变量 -->
            <div class="settings-section" style="margin-top: 24px;">
              <div class="section-title">
                <el-icon><Setting /></el-icon>
                <span>环境变量</span>
                <span class="section-hint">（可选）</span>
              </div>
              
              <div class="env-vars" v-if="currentProject.envVars.length">
                <div v-for="(env, index) in currentProject.envVars" :key="index" class="env-row">
                  <el-input v-model="env.key" placeholder="KEY" class="env-key" />
                  <span class="env-eq">=</span>
                  <el-input v-model="env.value" placeholder="value" class="env-value" :type="isSecretKey(env.key) ? 'password' : 'text'" show-password />
                  <el-button text type="danger" @click="currentProject.envVars.splice(index, 1)"><el-icon><Delete /></el-icon></el-button>
                </div>
              </div>
              <el-button text type="primary" @click="currentProject.envVars.push({ key: '', value: '' })" class="add-cmd-btn">
                <el-icon><Plus /></el-icon>添加变量
              </el-button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <div class="dialog-footer-split">
          <div class="footer-left">
            <el-button type="danger" @click="deleteProject">删除项目</el-button>
            <el-button v-if="currentProject?.ssl && currentProject?.domainType === 'domain'" type="warning" @click="requestSSLCertificate" :loading="requestingSSL">
              <el-icon><Lock /></el-icon>申请证书
            </el-button>
            <el-button @click="updateNginxConfig" :loading="updatingNginx">
              <el-icon><Refresh /></el-icon>更新 Nginx
            </el-button>
          </div>
          <div>
            <el-button @click="showProjectSettings = false">取消</el-button>
            <el-button type="primary" @click="saveProjectSettings" :loading="saving">保存设置</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 目录浏览器 -->
    <el-dialog v-model="showProjectPathBrowser" title="选择目录" width="500px" class="browser-dialog" destroy-on-close>
      <div class="path-browser">
        <div class="browser-breadcrumb">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item @click="browseProjectPath('/')" class="clickable">
              <el-icon><HomeFilled /></el-icon>
            </el-breadcrumb-item>
            <el-breadcrumb-item v-for="(part, index) in projectBrowserPathParts" :key="index" @click="browseProjectPathIndex(index)" class="clickable">
              {{ part }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="browser-list" v-loading="projectBrowserLoading">
          <div class="browser-item parent" @click="browseProjectPathParent" v-if="projectBrowserPath !== '/'">
            <el-icon><ArrowLeft /></el-icon><span>..</span>
          </div>
          <div v-for="dir in projectBrowserDirs" :key="dir.path" class="browser-item" @click="browseProjectPath(dir.path)" @dblclick="selectProjectPath(dir.path)">
            <el-icon class="folder-icon"><Folder /></el-icon><span>{{ dir.name }}</span>
          </div>
          <div v-if="projectBrowserDirs.length === 0 && !projectBrowserLoading" class="browser-empty">此目录下没有子文件夹</div>
        </div>
        <div class="browser-selected"><span>当前:</span> <code>{{ projectBrowserPath }}</code></div>
      </div>
      <template #footer>
        <el-button @click="showProjectPathBrowser = false">取消</el-button>
        <el-button type="primary" @click="selectProjectPath(projectBrowserPath)">选择</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Plus, Refresh, Lock, Delete, ArrowDown, Check, Promotion, CopyDocument, 
  InfoFilled, Unlock, ArrowLeft, ArrowRight, FolderOpened, Folder, Document, 
  HomeFilled, Top, Bottom, Edit, Link, Close, Setting, Upload, UploadFilled,
  VideoPlay, CircleCheck, Cpu, Box, Connection, Files, Warning, Monitor
} from '@element-plus/icons-vue'
import TechIcon from '@/components/icons/TechIcons.vue'

// 类型定义
interface Site {
  id: string; name: string; domain: string; path: string; type: string; status: string; ssl: boolean; rewrite?: string
}

interface BuildStep {
  command: string; optional?: boolean
}

interface EnvVar {
  key: string; value: string
}

interface Project {
  id: string; name: string; type: string; domain: string; domainType?: string; path: string; port: number; status: string; ssl: boolean
  buildSteps: BuildStep[]; startCommand: string; outputDir?: string; envVars: EnvVar[]; processManager?: string
  lastDeploy?: number; deploying?: boolean; remark?: string
}

// Store
const serverStore = useServerStore()
const selectedServer = ref<string | null>(null)
const activeTab = ref('sites')
const loading = ref(false)
const creating = ref(false)
const saving = ref(false)
const loadingLogs = ref(false)
const settingsTab = ref('basic')
const requestingSSL = ref(false)
const updatingNginx = ref(false)

// 简化的环境检查 - 只检查关键依赖
const envChecking = ref(false)
const envChecked = ref(false)
const router = useRouter()

// 关键依赖列表
const criticalEnvs = [
  { name: 'nginx', label: 'Nginx', checkCmd: 'which nginx' },
  { name: 'nodejs', label: 'Node.js', checkCmd: 'which node' },
  { name: 'pm2', label: 'PM2', checkCmd: 'which pm2' }
]

const envStatus = ref<{ name: string; label: string; installed: boolean }[]>([])
const missingEnvCount = computed(() => envStatus.value.filter(e => !e.installed).length)
const missingEnvNames = computed(() => envStatus.value.filter(e => !e.installed).map(e => e.label).join(', '))

function goToEnvPage() {
  router.push('/environment')
}

// 数据
const sites = ref<Site[]>([])
const projects = ref<Project[]>([])

// 对话框
const showAddStatic = ref(false)
const showAddProxy = ref(false)
const showAddProject = ref(false)
const showDeployLog = ref(false)
const showSiteSettings = ref(false)
const showProjectSettings = ref(false)
const currentSite = ref<Site | null>(null)
const currentProject = ref<Project | null>(null)
const deployLog = ref('')
const logContainer = ref<HTMLElement | null>(null)

// 表单
const newSite = ref({ name: '', domain: '', path: '/var/www', ssl: false })
const newProxy = ref({ name: '', domain: '', upstream: 'http://127.0.0.1:3000', websocket: false, ssl: false })
const newProject = ref<{
  name: string; type: string; domain: string; domainType: string; path: string; port: number; ssl: boolean
  buildSteps: BuildStep[]; startCommand: string; outputDir: string; envVars: EnvVar[]; processManager: string; remark: string
}>({
  name: '', type: 'nodejs', domain: '', domainType: 'domain', path: '', port: 3000, ssl: false,
  buildSteps: [{ command: 'npm install', optional: false }],
  startCommand: 'npm start', outputDir: 'dist', envVars: [], processManager: 'pm2', remark: ''
})

// 代码来源
const codeSource = ref<'server' | 'upload'>('server')
const selectedLocalPath = ref('')
const uploadFiles = ref<{ name: string; path: string; size: number; isDir: boolean }[]>([])
const detectedType = ref('')

// 部署模板
const selectedTemplate = ref('')
const matchedTemplate = ref('')

// 项目类型
const projectTypes = [
  { value: 'nodejs', label: 'Node.js', color: '#68a063' },
  { value: 'static-build', label: '静态构建', color: '#42b883' },
  { value: 'python', label: 'Python', color: '#3776ab' },
  { value: 'go', label: 'Go', color: '#00add8' },
  { value: 'java', label: 'Java', color: '#f89820' },
  { value: 'php', label: 'PHP', color: '#777bb4' }
]

// 部署模板
const deployTemplates = [
  { id: 'express', name: 'Express/Koa', desc: 'Node.js Web 框架', icon: '🚀', type: 'nodejs', steps: [{ command: 'npm install', optional: false }], start: 'npm start' },
  { id: 'nextjs', name: 'Next.js', desc: 'React 全栈框架', icon: '▲', type: 'static-build', steps: [{ command: 'npm install', optional: false }, { command: 'npm run build', optional: true }], start: '' },
  { id: 'vue', name: 'Vue/Vite', desc: '前端构建项目', icon: '💚', type: 'static-build', steps: [{ command: 'npm install', optional: false }, { command: 'npm run build', optional: true }], start: '' },
  { id: 'flask', name: 'Flask/FastAPI', desc: 'Python Web 框架', icon: '🐍', type: 'python', steps: [{ command: 'pip install -r requirements.txt', optional: false }], start: 'python app.py' },
  { id: 'springboot', name: 'Spring Boot', desc: 'Java 企业框架', icon: '☕', type: 'java', steps: [{ command: 'mvn package -DskipTests', optional: false }], start: 'java -jar target/*.jar' },
  { id: 'static', name: '纯静态', desc: '无需构建', icon: '📄', type: 'static-build', steps: [], start: '' },
  { id: 'custom', name: '自定义', desc: '手动配置', icon: '⚙️', type: 'nodejs', steps: [{ command: '', optional: false }], start: '' }
]

// 4步流程
const deployStep = ref('basic')
const deploySteps = [
  { key: 'basic', title: '基本信息' },
  { key: 'code', title: '项目代码' },
  { key: 'domain', title: '域名设置' },
  { key: 'deploy', title: '部署设置' }
]
const deployStepIndex = computed(() => deploySteps.findIndex(s => s.key === deployStep.value))

// 是否需要端口
const needsPort = computed(() => !['php', 'static-build'].includes(newProject.value.type))

// 目录浏览器
const showProjectPathBrowser = ref(false)
const projectBrowserPath = ref('/var/www')
const projectBrowserDirs = ref<{ name: string; path: string; isDir: boolean }[]>([])
const projectBrowserLoading = ref(false)
const projectBrowserPathParts = computed(() => {
  if (!projectBrowserPath.value || projectBrowserPath.value === '/') return []
  return projectBrowserPath.value.split('/').filter(Boolean)
})

// 服务器 IP
const serverPublicIP = ref('')
const serverLocalIP = ref('')

const connectedServers = computed(() => serverStore.connectedServers)
const hasMultipleServers = computed(() => serverStore.hasMultipleServers)

// 监听
watch(selectedServer, (val) => { if (val) { loadData(); checkEnvironment() } })

onMounted(() => {
  if (connectedServers.value.length > 0) {
    selectedServer.value = serverStore.currentServerId || connectedServers.value[0].id
  }
  loadProjectsFromStorage()
})

function loadProjectsFromStorage() {
  const saved = localStorage.getItem('serverhub_projects')
  if (saved) { try { projects.value = JSON.parse(saved) } catch { projects.value = [] } }
}

// 环境检查 - 简化版，只检查关键依赖
async function checkEnvironment() {
  if (!selectedServer.value) return
  envChecking.value = true
  envChecked.value = false
  
  // 初始化环境状态
  envStatus.value = criticalEnvs.map(e => ({ name: e.name, label: e.label, installed: false }))
  
  try {
    for (const env of envStatus.value) {
      const criticalEnv = criticalEnvs.find(e => e.name === env.name)
      if (!criticalEnv) continue
      
      try {
        const checkResult = await window.electronAPI.server.executeCommand(
          selectedServer.value, 'bash', ['-c', criticalEnv.checkCmd]
        )
        env.installed = checkResult.exit_code === 0 && (checkResult.stdout || '').trim() !== ''
      } catch {
        env.installed = false
      }
    }
    envChecked.value = true
  } catch (e) {
    ElMessage.error('环境检查失败: ' + (e as Error).message)
  } finally {
    envChecking.value = false
  }
}

function saveProjectsToStorage() {
  localStorage.setItem('serverhub_projects', JSON.stringify(projects.value))
}

async function loadData() { await loadSites() }

async function loadSites() {
  if (!selectedServer.value) return
  loading.value = true
  try {
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'ls -1 /etc/nginx/sites-enabled/ 2>/dev/null || ls -1 /etc/nginx/conf.d/*.conf 2>/dev/null']
    )
    const stdout = result.stdout || ''
    const files = stdout.trim().split('\n').filter(f => f && !f.includes('default'))
    sites.value = files.map((f, i) => ({
      id: `site_${i}`, name: f.replace('.conf', '').replace(/^.*\//, ''),
      domain: f.replace('.conf', '').replace(/^.*\//, ''),
      path: '/var/www/' + f.replace('.conf', '').replace(/^.*\//, ''),
      type: 'static', status: 'running', ssl: false
    }))
  } catch { sites.value = [] }
  finally { loading.value = false }
}

function refresh() { loadData() }

function handleAddCommand(cmd: string) {
  if (cmd === 'static') showAddStatic.value = true
  else if (cmd === 'proxy') showAddProxy.value = true
  else if (cmd === 'project') { resetNewProject(); showAddProject.value = true }
}

function resetNewProject() {
  newProject.value = {
    name: '', type: 'nodejs', domain: '', domainType: 'domain', path: '', port: 3000, ssl: false,
    buildSteps: [{ command: 'npm install', optional: false }],
    startCommand: 'npm start', outputDir: 'dist', envVars: [], processManager: 'pm2', remark: ''
  }
  deployStep.value = 'basic'
  codeSource.value = 'server'
  selectedLocalPath.value = ''
  uploadFiles.value = []
  detectedType.value = ''
  selectedTemplate.value = ''
  matchedTemplate.value = ''
  fetchServerIP()
}

function selectProjectType(type: string) {
  newProject.value.type = type
  const defaults: Record<string, { port: number; processManager: string }> = {
    nodejs: { port: 3000, processManager: 'pm2' },
    python: { port: 5000, processManager: 'systemd' },
    go: { port: 8080, processManager: 'systemd' },
    java: { port: 8080, processManager: 'systemd' },
    php: { port: 0, processManager: 'systemd' },
    'static-build': { port: 0, processManager: 'systemd' }
  }
  const d = defaults[type] || defaults.nodejs
  newProject.value.port = d.port
  newProject.value.processManager = d.processManager
  // 自动匹配模板
  autoMatchTemplate()
}

function autoMatchTemplate() {
  const type = newProject.value.type
  const tpl = deployTemplates.find(t => t.type === type && t.id !== 'custom')
  if (tpl) {
    applyTemplate(tpl.id)
    matchedTemplate.value = tpl.id
  }
}

function applyTemplate(id: string) {
  selectedTemplate.value = id
  const tpl = deployTemplates.find(t => t.id === id)
  if (tpl) {
    if (tpl.steps.length > 0) {
      newProject.value.buildSteps = tpl.steps.map(s => ({ ...s }))
    }
    if (tpl.start) {
      newProject.value.startCommand = tpl.start
    }
    if (tpl.type) {
      newProject.value.type = tpl.type
    }
  }
}

// 服务器 IP
async function fetchServerIP() {
  if (!selectedServer.value) return
  try {
    const pubResult = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'curl -fsSL --connect-timeout 3 ifconfig.me 2>/dev/null || curl -fsSL --connect-timeout 3 ipinfo.io/ip 2>/dev/null']
    )
    serverPublicIP.value = (pubResult.stdout || '').trim()
    const localResult = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', "hostname -I 2>/dev/null | awk '{print $1}'"]
    )
    serverLocalIP.value = (localResult.stdout || '').trim()
  } catch { serverPublicIP.value = '获取失败' }
}

function copyToClipboard(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}

function getDomainPrefix(domain: string): string {
  if (!domain) return ''
  const parts = domain.split('.')
  return parts.length > 2 ? parts[0] : '@'
}

// 步骤导航
function prevDeployStep() {
  const idx = deployStepIndex.value
  if (idx > 0) deployStep.value = deploySteps[idx - 1].key
}

function nextDeployStep() {
  if (deployStep.value === 'basic') {
    if (!newProject.value.name) { ElMessage.warning('请输入项目名称'); return }
  } else if (deployStep.value === 'code') {
    if (!newProject.value.path) {
      newProject.value.path = '/var/www/' + newProject.value.name
    }
    // 自动匹配模板
    if (!selectedTemplate.value) autoMatchTemplate()
  } else if (deployStep.value === 'domain') {
    if (newProject.value.domainType === 'domain' && !newProject.value.domain) {
      ElMessage.warning('请输入域名'); return
    }
    if (newProject.value.domainType === 'ip') {
      newProject.value.domain = serverPublicIP.value
    }
  }
  const idx = deployStepIndex.value
  if (idx < deploySteps.length - 1) deployStep.value = deploySteps[idx + 1].key
}

// 文件夹选择
async function selectFolder() {
  try {
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory'], title: '选择项目文件夹'
    })
    if (result.canceled || !result.filePaths.length) return
    selectedLocalPath.value = result.filePaths[0]
    await scanFolder(selectedLocalPath.value)
    await detectProjectType(selectedLocalPath.value)
  } catch (e) { ElMessage.error('选择失败: ' + (e as Error).message) }
}

async function scanFolder(folderPath: string) {
  try {
    const files = await window.electronAPI.fs.scanDirectory(folderPath, {
      ignore: ['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next', '.nuxt', 'target', 'vendor']
    })
    uploadFiles.value = files
  } catch {
    uploadFiles.value = [{ name: folderPath.split(/[/\\]/).pop() || 'project', path: folderPath, size: 0, isDir: true }]
  }
}

async function detectProjectType(folderPath: string) {
  try {
    // 检测 package.json
    try {
      const pkgContent = await window.electronAPI.fs.readFile(folderPath + '/package.json')
      if (pkgContent) {
        const pkgStr = typeof pkgContent === 'string' ? pkgContent : pkgContent.toString()
        const pkg = JSON.parse(pkgStr)
        if (pkg.name && !newProject.value.name) {
          newProject.value.name = pkg.name
          newProject.value.path = '/var/www/' + pkg.name
        }
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        const scripts = Object.keys(pkg.scripts || {})
        
        // 检测框架类型
        if (deps.next) { detectedType.value = 'nextjs'; applyTemplate('nextjs') }
        else if (deps.vue || deps.vite) { detectedType.value = 'vue'; applyTemplate('vue') }
        else if (deps.express || deps.koa || deps.fastify) { detectedType.value = 'express'; applyTemplate('express') }
        else { detectedType.value = 'nodejs'; selectProjectType('nodejs') }
        
        // 根据 scripts 设置构建步骤
        const buildSteps: BuildStep[] = [{ command: 'npm install', optional: false }]
        if (scripts.includes('build')) {
          buildSteps.push({ command: 'npm run build', optional: true })
        }
        newProject.value.buildSteps = buildSteps
        return
      }
    } catch {}
    
    // 检测 requirements.txt
    try {
      await window.electronAPI.fs.readFile(folderPath + '/requirements.txt')
      detectedType.value = 'python'
      selectProjectType('python')
      applyTemplate('flask')
      return
    } catch {}
    
    // 检测 go.mod
    try {
      await window.electronAPI.fs.readFile(folderPath + '/go.mod')
      detectedType.value = 'go'
      selectProjectType('go')
      return
    } catch {}
    
    // 检测 pom.xml
    try {
      await window.electronAPI.fs.readFile(folderPath + '/pom.xml')
      detectedType.value = 'java'
      selectProjectType('java')
      applyTemplate('springboot')
      return
    } catch {}
  } catch {}
}

// 目录浏览器
async function browseProjectPath(path: string) {
  if (!selectedServer.value) return
  projectBrowserLoading.value = true
  projectBrowserPath.value = path
  try {
    const result = await window.electronAPI.file.list(selectedServer.value, path)
    projectBrowserDirs.value = result.files
      .filter((f: any) => f.is_dir)
      .map((f: any) => ({ name: f.name, path: f.path, isDir: true }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
  } catch { projectBrowserDirs.value = [] }
  finally { projectBrowserLoading.value = false }
}

function browseProjectPathParent() {
  if (projectBrowserPath.value === '/') return
  const parts = projectBrowserPath.value.split('/').filter(Boolean)
  parts.pop()
  browseProjectPath('/' + parts.join('/'))
}

function browseProjectPathIndex(index: number) {
  const parts = projectBrowserPath.value.split('/').filter(Boolean)
  browseProjectPath('/' + parts.slice(0, index + 1).join('/'))
}

function selectProjectPath(path: string) {
  newProject.value.path = path
  showProjectPathBrowser.value = false
}

watch(showProjectPathBrowser, (val) => {
  if (val) browseProjectPath(newProject.value.path || '/var/www')
})

// 构建步骤
function addBuildStep() { newProject.value.buildSteps.push({ command: '', optional: false }) }
function removeBuildStep(index: number) { newProject.value.buildSteps.splice(index, 1) }
function addEnvVar() { newProject.value.envVars.push({ key: '', value: '' }) }
function removeEnvVar(index: number) { newProject.value.envVars.splice(index, 1) }

function isSecretKey(key: string): boolean {
  const patterns = ['secret', 'password', 'token', 'key', 'api_key']
  return patterns.some(p => key.toLowerCase().includes(p))
}

function getDefaultStartCommand(type: string): string {
  const cmds: Record<string, string> = { nodejs: 'npm start', python: 'python app.py', go: './app', java: 'java -jar target/*.jar' }
  return cmds[type] || ''
}

function getProjectTypeLabel(type: string): string {
  const pt = projectTypes.find(p => p.value === type)
  return pt ? pt.label : type
}

// 创建站点
async function createStaticSite() {
  if (!selectedServer.value || !newSite.value.name || !newSite.value.domain) {
    ElMessage.warning('请填写完整信息'); return
  }
  creating.value = true
  try {
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo mkdir -p ${newSite.value.path}`])
    const config = generateStaticConfig(newSite.value)
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `echo '${config.replace(/'/g, "'\\''")}' | sudo tee /etc/nginx/sites-available/${newSite.value.name}`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo ln -sf /etc/nginx/sites-available/${newSite.value.name} /etc/nginx/sites-enabled/`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo nginx -t && sudo systemctl reload nginx'])
    ElMessage.success('站点创建成功')
    showAddStatic.value = false
    newSite.value = { name: '', domain: '', path: '/var/www', ssl: false }
    loadSites()
  } catch (e) { ElMessage.error('创建失败: ' + (e as Error).message) }
  finally { creating.value = false }
}

async function createProxySite() {
  if (!selectedServer.value || !newProxy.value.name || !newProxy.value.domain) {
    ElMessage.warning('请填写完整信息'); return
  }
  creating.value = true
  try {
    const config = generateProxyConfig(newProxy.value)
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `echo '${config.replace(/'/g, "'\\''")}' | sudo tee /etc/nginx/sites-available/${newProxy.value.name}`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo ln -sf /etc/nginx/sites-available/${newProxy.value.name} /etc/nginx/sites-enabled/`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo nginx -t && sudo systemctl reload nginx'])
    ElMessage.success('反向代理创建成功')
    showAddProxy.value = false
    newProxy.value = { name: '', domain: '', upstream: 'http://127.0.0.1:3000', websocket: false, ssl: false }
    loadSites()
  } catch (e) { ElMessage.error('创建失败: ' + (e as Error).message) }
  finally { creating.value = false }
}

async function createProject() {
  if (!selectedServer.value || !newProject.value.name) {
    ElMessage.warning('请填写项目名称'); return
  }
  
  // 如果是 IP 访问方式，自动设置 domain
  if (newProject.value.domainType === 'ip') {
    newProject.value.domain = serverPublicIP.value || 'localhost'
  }
  
  if (!newProject.value.path) {
    newProject.value.path = '/var/www/' + newProject.value.name
  }
  
  creating.value = true
  try {
    // 创建目录
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo mkdir -p ${newProject.value.path}`])
    
    // 如果选择了上传代码，先上传
    if (codeSource.value === 'upload' && selectedLocalPath.value) {
      ElMessage.info('正在打包并上传代码...')
      try {
        // 打包本地目录为 tar.gz
        const tarBuffer = await window.electronAPI.fs.packDirectory(selectedLocalPath.value, {
          ignore: ['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next', '.nuxt', 'target', 'vendor']
        })
        
        // 上传并解压到服务器
        const uploadResult = await window.electronAPI.file.uploadStream(
          selectedServer.value,
          tarBuffer,
          `${newProject.value.path}/upload.tar.gz`,
          {
            createDirs: true,
            isTarGz: true,
            extractTo: newProject.value.path
          }
        )
        
        if (!uploadResult.success) {
          throw new Error(uploadResult.message)
        }
        
        ElMessage.success('代码上传完成')
      } catch (e) {
        ElMessage.error('代码上传失败: ' + (e as Error).message)
        creating.value = false
        return
      }
    }
    
    // 生成 Nginx 配置
    const config = generateProjectConfig({
      ...newProject.value,
      domainType: newProject.value.domainType
    })
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `echo '${config.replace(/'/g, "'\\''")}' | sudo tee /etc/nginx/sites-available/${newProject.value.name}`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo ln -sf /etc/nginx/sites-available/${newProject.value.name} /etc/nginx/sites-enabled/`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo nginx -t && sudo systemctl reload nginx'])
    
    const project: Project = {
      id: `project_${Date.now()}`, name: newProject.value.name, type: newProject.value.type,
      domain: newProject.value.domainType === 'ip' ? `${serverPublicIP.value}:${newProject.value.port}` : newProject.value.domain,
      domainType: newProject.value.domainType,
      path: newProject.value.path, port: newProject.value.port,
      status: 'stopped', ssl: newProject.value.ssl, buildSteps: [...newProject.value.buildSteps],
      startCommand: newProject.value.startCommand, outputDir: newProject.value.outputDir,
      envVars: [...newProject.value.envVars], processManager: newProject.value.processManager,
      remark: newProject.value.remark
    }
    projects.value.push(project)
    saveProjectsToStorage()
    ElMessage.success('项目创建成功')
    showAddProject.value = false
    activeTab.value = 'projects'
    
    // 重置上传状态
    codeSource.value = 'server'
    selectedLocalPath.value = ''
    uploadFiles.value = []
  } catch (e) { ElMessage.error('创建失败: ' + (e as Error).message) }
  finally { creating.value = false }
}

// 部署项目 - 关键修复：可选步骤失败不中断
async function deployProject(project: Project) {
  if (!selectedServer.value) return
  project.deploying = true
  deployLog.value = `🚀 开始部署 ${project.name}...\n\n`
  showDeployLog.value = true
  currentProject.value = project

  try {
    for (const step of project.buildSteps) {
      const cmd = step.command?.trim()
      if (!cmd) continue
      
      deployLog.value += `📦 ${cmd}\n`
      await nextTick()
      scrollLogToBottom()

      const envStr = project.envVars.map(e => `${e.key}=${e.value}`).join(' ')
      const fullCmd = envStr ? `cd ${project.path} && ${envStr} ${cmd}` : `cd ${project.path} && ${cmd}`
      
      try {
        const result = await window.electronAPI.server.executeCommand(selectedServer.value!, 'bash', ['-c', fullCmd])
        if (result.stdout) deployLog.value += result.stdout + '\n'
        if (result.stderr) deployLog.value += result.stderr + '\n'
        
        if (result.exit_code !== 0) {
          if (step.optional) {
            deployLog.value += `⚠️ 可选步骤失败，跳过继续...\n\n`
          } else {
            deployLog.value += `\n❌ 必需步骤失败 (退出码: ${result.exit_code})\n`
            ElMessage.error('部署失败')
            project.deploying = false
            return
          }
        } else {
          deployLog.value += `✅ 完成\n\n`
        }
      } catch (e) {
        if (step.optional) {
          deployLog.value += `⚠️ 可选步骤出错，跳过: ${(e as Error).message}\n\n`
        } else {
          throw e
        }
      }
    }

    // 启动服务
    if (needsPortForType(project.type) && project.startCommand) {
      deployLog.value += `\n🔧 配置服务...\n`
      const pm = project.processManager || 'systemd'
      if (pm === 'pm2') await startWithPM2(project)
      else await startWithSystemd(project)
      project.status = 'running'
    } else if (project.type === 'static-build') {
      deployLog.value += `\n📁 静态文件已部署\n`
      project.status = 'running'
    }

    project.lastDeploy = Date.now()
    saveProjectsToStorage()
    deployLog.value += '\n✅ 部署成功！\n'
    ElMessage.success('部署成功')
  } catch (e) {
    deployLog.value += `\n❌ 错误: ${(e as Error).message}\n`
    ElMessage.error('部署失败')
  } finally {
    project.deploying = false
  }
}

function needsPortForType(type: string): boolean {
  return !['php', 'static-build'].includes(type)
}

async function startWithSystemd(project: Project) {
  const serviceName = `serverhub-${project.name}`
  // 自动添加 PORT 环境变量
  const envVars = [...project.envVars]
  if (project.port && !envVars.some(e => e.key === 'PORT')) {
    envVars.push({ key: 'PORT', value: String(project.port) })
  }
  const envStr = envVars.map(e => `Environment="${e.key}=${e.value}"`).join('\n')
  const serviceContent = `[Unit]
Description=${project.name}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${project.path}
ExecStart=/bin/bash -c '${project.startCommand}'
Restart=on-failure
${envStr}

[Install]
WantedBy=multi-user.target`
  
  deployLog.value += `📌 创建 Systemd 服务 (端口: ${project.port})\n`
  await window.electronAPI.server.executeCommand(selectedServer.value!, 'bash', ['-c', 
    `echo '${serviceContent.replace(/'/g, "'\\''")}' | sudo tee /etc/systemd/system/${serviceName}.service`])
  await window.electronAPI.server.executeCommand(selectedServer.value!, 'bash', ['-c', 
    `sudo systemctl daemon-reload && sudo systemctl enable ${serviceName} && sudo systemctl restart ${serviceName}`])
  deployLog.value += `✅ Systemd 服务已启动\n`
}

async function startWithPM2(project: Project) {
  await window.electronAPI.server.executeCommand(selectedServer.value!, 'bash', ['-c', `pm2 delete ${project.name} 2>/dev/null || true`])
  
  // 构建环境变量 - 自动添加 PORT
  const envVars = [...project.envVars]
  if (project.port && !envVars.some(e => e.key === 'PORT')) {
    envVars.push({ key: 'PORT', value: String(project.port) })
  }
  const envStr = envVars.map(e => `${e.key}="${e.value}"`).join(' ')
  const startCmd = project.startCommand?.trim() || 'npm start'
  
  // 根据启动命令类型选择正确的 PM2 启动方式
  let pm2Cmd: string
  if (startCmd.startsWith('npm ')) {
    // npm start / npm run xxx -> pm2 start npm --name xxx -- start / run xxx
    const npmArgs = startCmd.replace(/^npm\s+/, '')
    pm2Cmd = `pm2 start npm --name "${project.name}" -- ${npmArgs}`
  } else if (startCmd.startsWith('node ')) {
    // node app.js -> pm2 start app.js --name xxx
    const script = startCmd.replace(/^node\s+/, '')
    pm2Cmd = `pm2 start ${script} --name "${project.name}"`
  } else if (startCmd.startsWith('python ') || startCmd.startsWith('python3 ')) {
    // python app.py -> pm2 start app.py --interpreter python3 --name xxx
    const script = startCmd.replace(/^python3?\s+/, '')
    pm2Cmd = `pm2 start ${script} --interpreter python3 --name "${project.name}"`
  } else {
    // 其他命令使用 ecosystem 文件方式
    const ecosystemContent = `module.exports = { apps: [{ name: "${project.name}", script: "/bin/bash", args: ["-c", "${startCmd.replace(/"/g, '\\"')}"], cwd: "${project.path}" }] }`
    await window.electronAPI.server.executeCommand(selectedServer.value!, 'bash', ['-c', 
      `echo '${ecosystemContent}' > ${project.path}/ecosystem.config.js`])
    pm2Cmd = `pm2 start ${project.path}/ecosystem.config.js`
  }
  
  // 始终带上环境变量（包含 PORT）
  const fullCmd = `cd ${project.path} && ${envStr} ${pm2Cmd}`
  
  deployLog.value += `📌 启动命令: ${fullCmd}\n`
  const result = await window.electronAPI.server.executeCommand(selectedServer.value!, 'bash', ['-c', fullCmd])
  if (result.stdout) deployLog.value += result.stdout + '\n'
  if (result.stderr) deployLog.value += result.stderr + '\n'
  
  await window.electronAPI.server.executeCommand(selectedServer.value!, 'bash', ['-c', 'pm2 save'])
  deployLog.value += `✅ PM2 进程已启动 (端口: ${project.port})\n`
}

// 项目控制
async function startProject(project: Project) {
  if (!selectedServer.value) return
  try {
    const pm = project.processManager || 'systemd'
    if (pm === 'pm2') await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `pm2 start ${project.name}`])
    else await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo systemctl start serverhub-${project.name}`])
    project.status = 'running'
    saveProjectsToStorage()
    ElMessage.success('已启动')
  } catch { ElMessage.error('启动失败') }
}

async function stopProject(project: Project) {
  if (!selectedServer.value) return
  try {
    const pm = project.processManager || 'systemd'
    if (pm === 'pm2') await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `pm2 stop ${project.name}`])
    else await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo systemctl stop serverhub-${project.name}`])
    project.status = 'stopped'
    saveProjectsToStorage()
    ElMessage.success('已停止')
  } catch { ElMessage.error('停止失败') }
}

function viewProjectLogs(project: Project) {
  currentProject.value = project
  deployLog.value = '加载中...'
  showDeployLog.value = true
  loadProjectLogs(project)
}

async function loadProjectLogs(project: Project) {
  if (!selectedServer.value) return
  loadingLogs.value = true
  try {
    const pm = project.processManager || 'systemd'
    const cmd = pm === 'pm2' 
      ? `pm2 logs ${project.name} --lines 100 --nostream 2>/dev/null || echo "无日志"`
      : `sudo journalctl -u serverhub-${project.name} -n 100 --no-pager 2>/dev/null || echo "无日志"`
    const result = await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', cmd])
    deployLog.value = result.stdout || '无日志'
  } catch { deployLog.value = '获取失败' }
  finally { loadingLogs.value = false }
}

function editProject(project: Project) {
  currentProject.value = { 
    ...project, 
    buildSteps: [...project.buildSteps], 
    envVars: [...project.envVars],
    domainType: project.domainType || (project.domain?.includes(':') ? 'ip' : 'domain')
  }
  settingsTab.value = 'basic'
  showProjectSettings.value = true
}

async function saveProjectSettings() {
  if (!currentProject.value) return
  saving.value = true
  try {
    const index = projects.value.findIndex(p => p.id === currentProject.value!.id)
    if (index !== -1) { 
      // 更新域名显示
      if (currentProject.value.domainType === 'ip') {
        currentProject.value.domain = `${serverPublicIP.value}:${currentProject.value.port}`
      }
      projects.value[index] = { ...currentProject.value }
      saveProjectsToStorage() 
    }
    ElMessage.success('已保存')
    showProjectSettings.value = false
  } finally { saving.value = false }
}

// 更新 Nginx 配置
async function updateNginxConfig() {
  if (!currentProject.value || !selectedServer.value) return
  updatingNginx.value = true
  try {
    const config = generateProjectConfig({
      ...currentProject.value,
      domainType: currentProject.value.domainType
    })
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `echo '${config.replace(/'/g, "'\\''")}' | sudo tee /etc/nginx/sites-available/${currentProject.value.name}`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo ln -sf /etc/nginx/sites-available/${currentProject.value.name} /etc/nginx/sites-enabled/`])
    const testResult = await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo nginx -t'])
    if (testResult.exit_code !== 0) {
      throw new Error('Nginx 配置测试失败: ' + (testResult.stderr || testResult.stdout))
    }
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx'])
    ElMessage.success('Nginx 配置已更新')
  } catch (e) {
    ElMessage.error('更新失败: ' + (e as Error).message)
  } finally {
    updatingNginx.value = false
  }
}

// 申请 SSL 证书
async function requestSSLCertificate() {
  if (!currentProject.value || !selectedServer.value) return
  if (!currentProject.value.domain || currentProject.value.domainType === 'ip') {
    ElMessage.warning('请先配置域名')
    return
  }
  
  requestingSSL.value = true
  try {
    // 检查 certbot 是否安装
    const checkResult = await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'which certbot'])
    if (checkResult.exit_code !== 0) {
      // 安装 certbot
      ElMessage.info('正在安装 Certbot...')
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
        'sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx'])
    }
    
    // 申请证书
    ElMessage.info('正在申请 SSL 证书...')
    const domain = currentProject.value.domain
    const certResult = await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo certbot --nginx -d ${domain} --non-interactive --agree-tos --register-unsafely-without-email --redirect`])
    
    if (certResult.exit_code === 0) {
      ElMessage.success('SSL 证书申请成功！')
      currentProject.value.ssl = true
      // 保存更新
      const index = projects.value.findIndex(p => p.id === currentProject.value!.id)
      if (index !== -1) {
        projects.value[index].ssl = true
        saveProjectsToStorage()
      }
    } else {
      // 显示详细错误
      const errorMsg = certResult.stderr || certResult.stdout || '未知错误'
      if (errorMsg.includes('DNS problem') || errorMsg.includes('NXDOMAIN')) {
        ElMessage.error('SSL 申请失败: 域名 DNS 未正确解析到此服务器')
      } else if (errorMsg.includes('Connection refused') || errorMsg.includes('port 80')) {
        ElMessage.error('SSL 申请失败: 80 端口无法访问，请检查防火墙设置')
      } else if (errorMsg.includes('too many certificates')) {
        ElMessage.error('SSL 申请失败: 该域名申请次数过多，请稍后再试')
      } else {
        ElMessage.error('SSL 申请失败: ' + errorMsg.substring(0, 200))
      }
    }
  } catch (e) {
    ElMessage.error('SSL 申请失败: ' + (e as Error).message)
  } finally {
    requestingSSL.value = false
  }
}

// 浏览项目设置中的目录
async function browseProjectSettingsPath() {
  if (!selectedServer.value || !currentProject.value) return
  projectBrowserPath.value = currentProject.value.path || '/var/www'
  await browseProjectPath(projectBrowserPath.value)
  showProjectPathBrowser.value = true
}

// 判断项目类型是否需要端口
function needsPortForProject(type: string): boolean {
  return !['php', 'static-build'].includes(type)
}

async function deleteProject() {
  if (!currentProject.value || !selectedServer.value) return
  try { await ElMessageBox.confirm(`确定删除 ${currentProject.value.name}？`, '确认', { type: 'warning' }) } catch { return }
  try {
    const pm = currentProject.value.processManager || 'systemd'
    const name = currentProject.value.name
    if (pm === 'pm2') await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `pm2 delete ${name} 2>/dev/null || true; pm2 save`])
    else await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo systemctl stop serverhub-${name} || true; sudo systemctl disable serverhub-${name} || true; sudo rm -f /etc/systemd/system/serverhub-${name}.service`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo rm -f /etc/nginx/sites-enabled/${name} /etc/nginx/sites-available/${name}`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx'])
    projects.value = projects.value.filter(p => p.id !== currentProject.value!.id)
    saveProjectsToStorage()
    showProjectSettings.value = false
    ElMessage.success('已删除')
  } catch { ElMessage.error('删除失败') }
}

// 站点操作
function editSite(site: Site) { currentSite.value = { ...site }; showSiteSettings.value = true }

async function saveSiteSettings() {
  if (!currentSite.value || !selectedServer.value) return
  saving.value = true
  try { ElMessage.success('已保存'); showSiteSettings.value = false; loadSites() }
  finally { saving.value = false }
}

function openSite(site: Site) {
  window.electronAPI.shell.openExternal(site.ssl ? `https://${site.domain}` : `http://${site.domain}`)
}

async function toggleSite(site: Site, action: 'start' | 'stop') {
  if (!selectedServer.value) return
  try {
    if (action === 'stop') await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo rm -f /etc/nginx/sites-enabled/${site.name}`])
    else await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo ln -sf /etc/nginx/sites-available/${site.name} /etc/nginx/sites-enabled/`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx'])
    ElMessage.success(action === 'stop' ? '已停止' : '已启动')
    loadSites()
  } catch { ElMessage.error('操作失败') }
}

async function deleteSite(site: Site) {
  try { await ElMessageBox.confirm(`确定删除 ${site.name}？`, '确认', { type: 'warning' }) } catch { return }
  if (!selectedServer.value) return
  try {
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo rm -f /etc/nginx/sites-enabled/${site.name} /etc/nginx/sites-available/${site.name}`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx'])
    ElMessage.success('已删除')
    loadSites()
  } catch { ElMessage.error('删除失败') }
}

function applyRewrite(preset: string) {
  if (!currentSite.value) return
  const presets: Record<string, string> = {
    vue: 'location / { try_files $uri $uri/ /index.html; }',
    laravel: 'location / { try_files $uri $uri/ /index.php?$query_string; }',
    wordpress: 'location / { try_files $uri $uri/ /index.php?$args; }'
  }
  currentSite.value.rewrite = presets[preset] || ''
}

// 日志
function scrollLogToTop() { if (logContainer.value) logContainer.value.scrollTop = 0 }
function scrollLogToBottom() { if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight }
function copyLog() { navigator.clipboard.writeText(deployLog.value); ElMessage.success('已复制') }

// Nginx 配置生成
function generateStaticConfig(site: { name: string; domain: string; path: string; ssl: boolean }): string {
  return `server {
    listen 80;
    server_name ${site.domain};
    root ${site.path};
    index index.html index.htm;
    location / { try_files $uri $uri/ =404; }
    location ~ /\\. { deny all; }
}`
}

function generateProxyConfig(proxy: { name: string; domain: string; upstream: string; websocket: boolean }): string {
  return `server {
    listen 80;
    server_name ${proxy.domain};
    location / {
        proxy_pass ${proxy.upstream};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        ${proxy.websocket ? 'proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";' : ''}
    }
}`
}

function generateProjectConfig(project: { name: string; domain: string; domainType?: string; path: string; port: number; type: string; outputDir?: string; ssl?: boolean }): string {
  // 如果是 IP 访问模式，使用 _ 作为 server_name（匹配所有请求）
  const serverName = project.domainType === 'ip' || !project.domain ? '_' : project.domain
  const useSSL = project.ssl && project.domain && project.domainType !== 'ip'
  
  // HTTP 重定向到 HTTPS
  const httpRedirect = useSSL ? `
server {
    listen 80;
    server_name ${serverName};
    return 301 https://$host$request_uri;
}
` : ''
  
  if (project.type === 'static-build') {
    return `${httpRedirect}server {
    listen ${useSSL ? '443 ssl http2' : (project.domainType === 'ip' ? project.port : '80')};
    server_name ${serverName};${useSSL ? `
    ssl_certificate /etc/letsencrypt/live/${project.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${project.domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;` : ''}
    root ${project.path}/${project.outputDir || 'dist'};
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location ~ /\\. { deny all; }
}`
  }
  if (project.type === 'php') {
    return `${httpRedirect}server {
    listen ${useSSL ? '443 ssl http2' : (project.domainType === 'ip' ? project.port : '80')};
    server_name ${serverName};${useSSL ? `
    ssl_certificate /etc/letsencrypt/live/${project.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${project.domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;` : ''}
    root ${project.path}/public;
    index index.php index.html;
    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \\.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    location ~ /\\. { deny all; }
}`
  }
  // 对于 Node.js/Python/Go 等需要反向代理的项目
  // IP 访问模式下直接监听端口，不需要 Nginx 代理
  if (project.domainType === 'ip') {
    // IP 访问模式：应用直接监听端口，不需要 Nginx 配置
    // 返回一个简单的配置用于健康检查
    return `# IP 访问模式 - 应用直接监听端口 ${project.port}
server {
    listen 80;
    server_name _;
    location /${project.name}-health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}`
  }
  return `${httpRedirect}server {
    listen ${useSSL ? '443 ssl http2' : '80'};
    server_name ${serverName};${useSSL ? `
    ssl_certificate /etc/letsencrypt/live/${project.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${project.domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;` : ''}
    location / {
        proxy_pass http://127.0.0.1:${project.port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}`
}

// 辅助函数
function getTypeTag(type: string): 'success' | 'warning' | 'info' | 'danger' | undefined {
  const map: Record<string, any> = { static: undefined, php: 'warning', node: 'success', python: 'info', java: 'danger', proxy: undefined }
  return map[type]
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = { static: '静态', php: 'PHP', node: 'Node', python: 'Python', java: 'Java', proxy: '代理' }
  return labels[type] || type
}

function getProjectColor(type: string): string {
  const colors: Record<string, string> = { nodejs: '#68a063', python: '#3776ab', go: '#00add8', java: '#f89820', php: '#777bb4', 'static-build': '#42b883' }
  return colors[type] || '#6366f1'
}

function getProjectStatusType(status: string): 'success' | 'danger' | 'info' {
  return status === 'running' ? 'success' : status === 'error' ? 'danger' : 'info'
}

function getProjectStatusLabel(status: string): string {
  const labels: Record<string, string> = { running: '运行中', stopped: '已停止', error: '错误' }
  return labels[status] || status
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style lang="scss" scoped>
.websites { max-width: 1400px; margin: 0 auto; }

.page-header {
  display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;
  .header-left {
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { color: var(--text-secondary); font-size: 13px; }
  }
  .header-actions { display: flex; gap: 10px; align-items: center; }
}

.empty-state { padding: 80px 0; }
.main-tabs { margin-bottom: 16px; }
.tab-label { display: flex; align-items: center; gap: 8px; }

.tab-content {
  background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 10px; padding: 20px;
}

.data-table {
  .cell-name { display: flex; align-items: center; gap: 10px;
    .status-dot { width: 8px; height: 8px; border-radius: 50%;
      &.running { background: #22c55e; box-shadow: 0 0 6px rgba(34, 197, 94, 0.5); }
      &.stopped { background: #ef4444; }
    }
  }
  .domain-link { color: var(--primary-color); text-decoration: none; display: flex; align-items: center; gap: 4px;
    &:hover { text-decoration: underline; }
  }
  .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: var(--bg-tertiary); padding: 3px 8px; border-radius: 4px; }
}

.empty-projects { padding: 60px 0; }

.projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }

.project-card {
  background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px;
  transition: all 0.2s;
  &:hover { border-color: var(--primary-color); }
  .project-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
    .project-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
      :deep(svg) { width: 24px; height: 24px; }
    }
    .project-info { flex: 1;
      .project-name { font-weight: 600; font-size: 14px; }
      .project-domain { font-size: 12px; color: var(--text-secondary); }
    }
  }
  .project-meta { margin-bottom: 12px; padding: 10px; background: var(--bg-secondary); border-radius: 6px;
    .meta-item { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; display: flex; gap: 6px;
      &:last-child { margin-bottom: 0; }
      .meta-label { color: var(--text-color); }
      code { background: var(--bg-tertiary); padding: 1px 4px; border-radius: 3px; font-size: 11px; }
    }
  }
  .project-actions { display: flex; gap: 8px; flex-wrap: wrap; }
}

// 对话框样式
:deep(.site-dialog), :deep(.browser-dialog), :deep(.log-dialog) {
  .el-dialog { background: var(--bg-secondary) !important; border-radius: 12px; }
  .el-dialog__header { background: var(--bg-tertiary); padding: 14px 20px; margin: 0; border-bottom: 1px solid var(--border-color); }
  .el-dialog__body { padding: 20px; }
  .el-dialog__footer { padding: 14px 20px; border-top: 1px solid var(--border-color); background: var(--bg-tertiary); }
}

.site-form { .form-tip { font-size: 12px; color: var(--text-secondary); margin-top: 4px; } }

.dialog-footer-split { display: flex; justify-content: space-between; }

// 部署向导
:deep(.deploy-wizard-dialog) {
  .el-dialog { background: var(--bg-secondary) !important; border-radius: 12px; overflow: hidden; }
  .el-dialog__header { display: none; }
  .el-dialog__body { padding: 0; }
}

.wizard-container { display: flex; flex-direction: column; height: 620px; }

.wizard-header {
  display: flex; justify-content: space-between; align-items: center; padding: 16px 20px;
  background: var(--bg-tertiary); border-bottom: 1px solid var(--border-color);
  .wizard-title { display: flex; align-items: center; gap: 10px; color: var(--text-color); font-size: 16px; font-weight: 600;
    .title-icon { font-size: 20px; color: var(--success-color); }
  }
  .close-btn { color: var(--text-secondary); &:hover { color: var(--text-color); background: var(--bg-secondary); } }
}

.wizard-steps {
  display: flex; padding: 16px 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); gap: 8px;
}

.wizard-step {
  flex: 1; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor: default; transition: all 0.2s;
  &.clickable { cursor: pointer; &:hover { background: var(--bg-tertiary); } }
  &.active { background: var(--bg-tertiary); border: 1px solid var(--success-color);
    .step-title { color: var(--text-color); }
    .step-indicator { background: var(--success-color); color: #fff; }
  }
  &.completed .step-indicator { background: var(--success-color); color: #fff; }
  .step-indicator { width: 28px; height: 28px; border-radius: 50%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; color: var(--text-secondary); border: 1px solid var(--border-color); }
  .step-title { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
}

.wizard-content { flex: 1; overflow-y: auto; padding: 20px; }

.step-panel { min-height: 400px; }

.panel-section {
  .section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; margin-bottom: 14px;
    .el-icon { color: var(--primary-color); }
    .section-hint { font-weight: 400; font-size: 12px; color: var(--text-secondary); }
  }
}

.wizard-form {
  .form-tip { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
}

// 代码来源
.source-tabs {
  display: flex; gap: 10px; margin-bottom: 16px;
  .source-tab {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border: 1px solid var(--border-color);
    border-radius: 8px; cursor: pointer; transition: all 0.2s; background: var(--bg-tertiary);
    &:hover { border-color: var(--text-secondary); }
    &.active { border-color: var(--success-color); background: var(--bg-secondary); }
  }
}

.source-content { min-height: 100px; }

.path-input-group { display: flex; gap: 10px; .el-input { flex: 1; } }

.upload-zone {
  border: 2px dashed var(--border-color); border-radius: 10px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.2s;
  &:hover { border-color: var(--text-secondary); background: var(--bg-tertiary); }
  .upload-icon { font-size: 40px; color: var(--text-secondary); margin-bottom: 10px; }
  .upload-text { font-size: 14px; }
}

.upload-selected {
  .selected-info { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 12px; }
  .file-preview { background: var(--bg-tertiary); border-radius: 8px; padding: 12px;
    .preview-title { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
    .preview-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .preview-item { display: flex; align-items: center; gap: 4px; font-size: 12px; padding: 4px 8px; background: var(--bg-secondary); border-radius: 4px;
      .folder { color: #f0b429; }
    }
    .preview-more { font-size: 12px; color: var(--text-secondary); }
  }
}

// 项目类型
.type-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }

.type-item {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 8px; border: 1px solid var(--border-color);
  border-radius: 10px; cursor: pointer; transition: all 0.2s; background: var(--bg-tertiary);
  &:hover { border-color: var(--text-secondary); }
  &.active { border-color: var(--success-color); background: var(--bg-secondary); }
  .type-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    :deep(svg) { width: 22px; height: 22px; }
  }
  .type-name { font-size: 12px; font-weight: 500; }
}

.port-hint { margin-left: 12px; font-size: 12px; color: var(--text-secondary); }

// 域名设置
.server-info-bar {
  display: flex; align-items: center; gap: 20px; padding: 12px 16px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 20px;
  .info-item { display: flex; align-items: center; gap: 8px; font-size: 13px;
    .info-label { color: var(--text-secondary); }
    code { font-family: 'JetBrains Mono', monospace; color: var(--primary-color); background: var(--bg-secondary); padding: 4px 10px; border-radius: 4px; }
  }
}

.access-radio-group { display: flex; flex-direction: column; gap: 10px; width: 100%; }

.access-radio {
  margin-right: 0 !important; padding: 14px; border: 1px solid var(--border-color); border-radius: 10px; height: auto !important; background: var(--bg-tertiary);
  &.is-checked { border-color: var(--success-color); background: var(--bg-secondary); }
  .radio-content { .radio-title { font-weight: 500; margin-bottom: 2px; } .radio-desc { font-size: 12px; color: var(--text-secondary); } }
}

.domain-input-section { margin-top: 16px; }

.dns-hint {
  display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 10px 14px; background: var(--bg-tertiary);
  border-radius: 6px; font-size: 12px; color: var(--text-secondary); border: 1px solid var(--border-color);
}

// SSL
.ssl-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.ssl-option {
  display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid var(--border-color); border-radius: 10px; cursor: pointer; transition: all 0.2s; background: var(--bg-tertiary);
  &:hover { border-color: var(--text-secondary); }
  &.active { border-color: var(--success-color); background: var(--bg-secondary);
    .el-icon { color: var(--success-color); }
  }
  .el-icon { font-size: 24px; color: var(--text-secondary); }
  .ssl-text { .ssl-title { font-weight: 500; } .ssl-desc { font-size: 12px; color: var(--text-secondary); } }
}

// 部署模板
.template-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }

.template-card {
  display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px;
  cursor: pointer; transition: all 0.2s; position: relative; background: var(--bg-tertiary);
  &:hover { border-color: var(--text-secondary); }
  &.active { border-color: var(--success-color); background: var(--bg-secondary); }
  .template-icon { font-size: 20px; }
  .template-info { flex: 1; min-width: 0;
    .template-name { font-size: 13px; font-weight: 500; }
    .template-desc { font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  }
  .template-check { position: absolute; top: 6px; right: 6px; color: var(--success-color); font-size: 16px; }
}

// 构建命令
.build-commands {
  &.compact .command-row { margin-bottom: 8px; }
  .command-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
    .cmd-num { width: 24px; height: 24px; border-radius: 50%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--text-secondary); flex-shrink: 0; }
    .cmd-input { flex: 1; }
    .cmd-optional { flex-shrink: 0; font-size: 12px; }
  }
  .add-cmd-btn { margin-top: 6px; }
}

// 进程管理
.pm-row { display: flex; align-items: center; gap: 12px;
  .pm-label { font-size: 13px; color: var(--text-secondary); }
}

// 环境变量
.env-vars {
  .env-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
    .env-key { width: 120px; flex-shrink: 0; }
    .env-eq { color: var(--text-secondary); }
    .env-value { flex: 1; }
  }
}

// 部署预览
.deploy-summary {
  margin-top: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 10px; border: 1px solid var(--border-color);
  .summary-title { font-size: 13px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
  .summary-content { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .summary-item { font-size: 12px; display: flex; gap: 8px;
    span:first-child { color: var(--text-secondary); min-width: 40px; }
    code { font-family: 'JetBrains Mono', monospace; background: var(--bg-secondary); padding: 2px 6px; border-radius: 3px; }
  }
}

.wizard-footer {
  display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-top: 1px solid var(--border-color); background: var(--bg-tertiary);
  .footer-right { display: flex; gap: 10px; }
}

// 日志
.log-container {
  .log-toolbar { display: flex; justify-content: space-between; padding: 10px 14px; background: var(--bg-tertiary); border-bottom: 1px solid var(--border-color); }
  .log-content { background: #0d1117; padding: 14px; max-height: 450px; overflow: auto;
    pre { margin: 0; font-size: 12px; color: #c9d1d9; white-space: pre-wrap; word-break: break-all; font-family: 'JetBrains Mono', monospace; line-height: 1.5; }
  }
}

// 目录浏览器
.path-browser {
  .browser-breadcrumb { padding: 10px 14px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 10px;
    .clickable { cursor: pointer; &:hover { color: var(--primary-color); } }
  }
  .browser-list { border: 1px solid var(--border-color); border-radius: 6px; max-height: 280px; overflow-y: auto; min-height: 180px;
    .browser-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s;
      &:hover { background: var(--bg-tertiary); }
      &.parent { color: var(--text-secondary); border-bottom: 1px solid var(--border-color); }
      .folder-icon { color: #f0b429; }
    }
    .browser-empty { padding: 40px; text-align: center; color: var(--text-secondary); }
  }
  .browser-selected { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-tertiary); border-radius: 6px; margin-top: 10px; font-size: 13px;
    code { font-family: 'JetBrains Mono', monospace; color: var(--primary-color); }
  }
}

.rewrite-presets { display: flex; gap: 8px; margin-bottom: 10px; }

.code-textarea {
  :deep(.el-textarea__inner) { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
}

// 环境警告栏
.env-warning-bar {
  display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; margin-bottom: 16px;
  background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px;
  .warning-content { display: flex; align-items: center; gap: 8px;
    .warning-icon { font-size: 18px; color: #f59e0b; }
  }
}

// 项目设置对话框
:deep(.project-settings-dialog) {
  .el-dialog { background: var(--bg-secondary) !important; border-radius: 12px; }
  .el-dialog__header { background: var(--bg-tertiary); padding: 14px 20px; margin: 0; border-bottom: 1px solid var(--border-color); }
  .el-dialog__body { padding: 0; }
  .el-dialog__footer { padding: 14px 20px; border-top: 1px solid var(--border-color); background: var(--bg-tertiary); }
}

.settings-container {
  min-height: 450px;
}

.settings-tabs {
  :deep(.el-tabs__header) {
    margin: 0;
    padding: 0 20px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }
  :deep(.el-tabs__content) {
    padding: 20px;
    max-height: 400px;
    overflow-y: auto;
  }
}

.settings-section {
  margin-bottom: 20px;
  
  .section-title {
    display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; margin-bottom: 14px;
    .el-icon { color: var(--primary-color); }
    .section-hint { font-weight: 400; font-size: 12px; color: var(--text-secondary); }
  }
}

.settings-form {
  .form-tip { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
}

.type-grid.compact {
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  
  .type-item {
    padding: 10px 6px;
    .type-icon { width: 30px; height: 30px; }
    .type-name { font-size: 11px; }
  }
}

.ssl-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  &:hover { border-color: var(--border-color); }
}

.footer-left {
  display: flex;
  gap: 10px;
}
</style>
