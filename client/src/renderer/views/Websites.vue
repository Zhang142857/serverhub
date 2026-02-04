<template>
  <div class="websites">
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

    <div v-if="!selectedServer" class="empty-state">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <template v-else>
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
              <div class="meta-item"><span class="meta-label">端口:</span> {{ project.port }}</div>
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
    <el-dialog v-model="showAddStatic" title="添加静态站点" width="500px" class="dark-dialog">
      <el-form :model="newSite" label-width="80px" size="small">
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
        <el-button size="small" @click="showAddStatic = false">取消</el-button>
        <el-button type="primary" size="small" @click="createStaticSite" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 添加反向代理对话框 -->
    <el-dialog v-model="showAddProxy" title="添加反向代理" width="500px" class="dark-dialog">
      <el-form :model="newProxy" label-width="80px" size="small">
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
        <el-button size="small" @click="showAddProxy = false">取消</el-button>
        <el-button type="primary" size="small" @click="createProxySite" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 项目部署对话框 - 多页面布局 -->
    <el-dialog v-model="showAddProject" title="" width="900px" class="dark-dialog deploy-dialog" :show-close="true">
      <div class="deploy-layout">
        <!-- 左侧导航 -->
        <div class="deploy-sidebar">
          <div class="sidebar-header">
            <el-icon class="header-icon"><Promotion /></el-icon>
            <span>项目部署</span>
          </div>
          <div class="sidebar-nav">
            <div 
              v-for="(item, index) in deploySteps" 
              :key="item.key"
              class="nav-item"
              :class="{ active: deployStep === item.key, completed: index < deployStepIndex }"
              @click="deployStep = item.key"
            >
              <div class="nav-icon">
                <el-icon v-if="index < deployStepIndex"><Check /></el-icon>
                <span v-else>{{ index + 1 }}</span>
              </div>
              <div class="nav-text">
                <div class="nav-title">{{ item.title }}</div>
                <div class="nav-desc">{{ item.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧内容 -->
        <div class="deploy-content">
          <!-- 步骤1: 基本信息 -->
          <div v-show="deployStep === 'basic'" class="step-content">
            <div class="step-header">
              <h3>基本信息</h3>
              <p>设置项目名称和类型</p>
            </div>
            <el-form :model="newProject" label-position="top" size="default">
              <el-form-item label="项目名称" required>
                <el-input v-model="newProject.name" placeholder="my-app" />
                <div class="form-tip">用于标识项目，建议使用英文和短横线</div>
              </el-form-item>
              <el-form-item label="项目类型" required>
                <el-select v-model="newProject.type" style="width: 100%" @change="onProjectTypeChange">
                  <el-option value="nodejs" label="Node.js (Express/Koa/NestJS)" />
                  <el-option value="python" label="Python (Flask/Django/FastAPI)" />
                  <el-option value="go" label="Go (Gin/Echo/Fiber)" />
                  <el-option value="java" label="Java (Spring Boot)" />
                  <el-option value="php" label="PHP (Laravel/ThinkPHP)" />
                  <el-option value="static-build" label="静态构建 (Vue/React/Next.js)" />
                </el-select>
              </el-form-item>
              <el-form-item label="项目目录" required>
                <el-input v-model="newProject.path" placeholder="/var/www/my-app" />
                <div class="form-tip">项目代码存放的服务器目录</div>
              </el-form-item>
              <el-form-item label="运行端口" v-if="!['php', 'static-build'].includes(newProject.type)">
                <el-input-number v-model="newProject.port" :min="1024" :max="65535" style="width: 100%" />
                <div class="form-tip">应用监听的端口，Nginx 会将请求转发到此端口</div>
              </el-form-item>
            </el-form>
          </div>

          <!-- 步骤2: 域名设置 -->
          <div v-show="deployStep === 'domain'" class="step-content">
            <div class="step-header">
              <h3>域名设置</h3>
              <p>配置访问域名，让用户可以通过域名访问你的应用</p>
            </div>

            <!-- 服务器 IP 信息卡片 -->
            <div class="server-ip-card">
              <div class="ip-header">
                <el-icon><Monitor /></el-icon>
                <span>服务器信息</span>
              </div>
              <div class="ip-content">
                <div class="ip-item">
                  <span class="ip-label">公网 IP</span>
                  <code class="ip-value">{{ serverPublicIP || '获取中...' }}</code>
                  <el-button text size="small" @click="copyIP(serverPublicIP)">
                    <el-icon><CopyDocument /></el-icon>
                  </el-button>
                </div>
                <div class="ip-item" v-if="serverLocalIP">
                  <span class="ip-label">内网 IP</span>
                  <code class="ip-value">{{ serverLocalIP }}</code>
                </div>
              </div>
            </div>

            <el-form :model="newProject" label-position="top" size="default">
              <el-form-item label="访问方式">
                <el-radio-group v-model="newProject.domainType" class="domain-type-group">
                  <el-radio value="ip" class="domain-radio">
                    <div class="radio-content">
                      <div class="radio-title">使用 IP 访问</div>
                      <div class="radio-desc">直接通过服务器 IP 访问，无需域名</div>
                    </div>
                  </el-radio>
                  <el-radio value="domain" class="domain-radio">
                    <div class="radio-content">
                      <div class="radio-title">使用域名访问</div>
                      <div class="radio-desc">需要先将域名解析到服务器 IP</div>
                    </div>
                  </el-radio>
                </el-radio-group>
              </el-form-item>

              <template v-if="newProject.domainType === 'ip'">
                <el-form-item label="访问地址">
                  <el-input :model-value="`${serverPublicIP}:${newProject.port || 80}`" disabled>
                    <template #prepend>http://</template>
                  </el-input>
                  <div class="form-tip">部署完成后，可通过此地址访问应用</div>
                </el-form-item>
              </template>

              <template v-else>
                <el-form-item label="域名" required>
                  <el-input v-model="newProject.domain" placeholder="app.example.com">
                    <template #prepend>http(s)://</template>
                  </el-input>
                </el-form-item>

                <!-- 域名配置指引 -->
                <div class="domain-guide">
                  <div class="guide-header">
                    <el-icon><InfoFilled /></el-icon>
                    <span>域名配置指引</span>
                  </div>
                  <div class="guide-steps">
                    <div class="guide-step">
                      <div class="step-num">1</div>
                      <div class="step-text">
                        <div class="step-title">登录域名服务商</div>
                        <div class="step-desc">如阿里云、腾讯云、Cloudflare 等</div>
                      </div>
                    </div>
                    <div class="guide-step">
                      <div class="step-num">2</div>
                      <div class="step-text">
                        <div class="step-title">添加 DNS 解析记录</div>
                        <div class="step-desc">
                          类型: <code>A</code>，主机记录: <code>{{ getDomainPrefix(newProject.domain) || 'app' }}</code>，记录值: <code>{{ serverPublicIP }}</code>
                        </div>
                      </div>
                    </div>
                    <div class="guide-step">
                      <div class="step-num">3</div>
                      <div class="step-text">
                        <div class="step-title">等待生效</div>
                        <div class="step-desc">DNS 解析通常需要几分钟到几小时生效</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </el-form>
          </div>

          <!-- 步骤3: 部署设置 -->
          <div v-show="deployStep === 'deploy'" class="step-content">
            <div class="step-header">
              <h3>部署设置</h3>
              <p>配置构建和启动流程</p>
            </div>
            <el-form :model="newProject" label-position="top" size="default">
              <el-form-item label="构建步骤">
                <div class="workflow-steps">
                  <div v-for="(step, index) in newProject.buildSteps" :key="index" class="workflow-step">
                    <div class="step-number">{{ index + 1 }}</div>
                    <el-input v-model="step.command" placeholder="npm install" />
                    <el-button text type="danger" @click="removeBuildStep(index)" :disabled="newProject.buildSteps.length <= 1">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                  <el-button class="add-step-btn" @click="addBuildStep">
                    <el-icon><Plus /></el-icon> 添加构建步骤
                  </el-button>
                </div>
                <div class="form-tip">按顺序执行的构建命令，如安装依赖、编译代码等</div>
              </el-form-item>

              <el-form-item label="启动命令" v-if="!['php', 'static-build'].includes(newProject.type)">
                <el-input v-model="newProject.startCommand" :placeholder="getDefaultStartCommand(newProject.type)" />
                <div class="form-tip">应用启动命令，将作为 systemd 服务运行</div>
              </el-form-item>

              <el-form-item label="输出目录" v-if="newProject.type === 'static-build'">
                <el-input v-model="newProject.outputDir" placeholder="dist" />
                <div class="form-tip">构建产物目录，Nginx 将直接托管此目录</div>
              </el-form-item>

              <el-form-item label="环境变量">
                <div class="env-vars">
                  <div v-for="(env, index) in newProject.envVars" :key="index" class="env-var-row">
                    <el-input v-model="env.key" placeholder="变量名" style="width: 140px" />
                    <span class="env-eq">=</span>
                    <el-input v-model="env.value" placeholder="变量值" style="flex: 1" :type="env.key.toLowerCase().includes('secret') || env.key.toLowerCase().includes('password') ? 'password' : 'text'" show-password />
                    <el-button text type="danger" @click="removeEnvVar(index)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                  <el-button class="add-step-btn" @click="addEnvVar">
                    <el-icon><Plus /></el-icon> 添加环境变量
                  </el-button>
                </div>
              </el-form-item>
            </el-form>
          </div>

          <!-- 步骤4: SSL 设置 -->
          <div v-show="deployStep === 'ssl'" class="step-content">
            <div class="step-header">
              <h3>SSL 证书</h3>
              <p>启用 HTTPS 加密访问</p>
            </div>
            <el-form :model="newProject" label-position="top" size="default">
              <el-form-item>
                <div class="ssl-option-cards">
                  <div 
                    class="ssl-card" 
                    :class="{ active: !newProject.ssl }"
                    @click="newProject.ssl = false"
                  >
                    <el-icon class="ssl-icon"><Unlock /></el-icon>
                    <div class="ssl-title">HTTP</div>
                    <div class="ssl-desc">不启用 SSL，使用 HTTP 访问</div>
                  </div>
                  <div 
                    class="ssl-card" 
                    :class="{ active: newProject.ssl }"
                    @click="newProject.ssl = true"
                  >
                    <el-icon class="ssl-icon"><Lock /></el-icon>
                    <div class="ssl-title">HTTPS</div>
                    <div class="ssl-desc">启用 SSL，使用 Let's Encrypt 免费证书</div>
                  </div>
                </div>
              </el-form-item>

              <template v-if="newProject.ssl">
                <el-alert type="info" :closable="false" show-icon>
                  <template #title>
                    <span>SSL 证书将在项目创建后自动申请</span>
                  </template>
                  <template #default>
                    <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                      使用 Let's Encrypt 免费证书，需要确保：<br>
                      1. 域名已正确解析到服务器 IP<br>
                      2. 服务器 80 端口可被外网访问
                    </div>
                  </template>
                </el-alert>
              </template>
            </el-form>
          </div>

          <!-- 底部操作栏 -->
          <div class="deploy-footer">
            <el-button @click="showAddProject = false">取消</el-button>
            <div class="footer-right">
              <el-button v-if="deployStepIndex > 0" @click="prevDeployStep">
                <el-icon><ArrowLeft /></el-icon> 上一步
              </el-button>
              <el-button v-if="deployStepIndex < deploySteps.length - 1" type="primary" @click="nextDeployStep">
                下一步 <el-icon><ArrowRight /></el-icon>
              </el-button>
              <el-button v-else type="primary" @click="createProject" :loading="creating">
                <el-icon><Check /></el-icon> 创建项目
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 部署日志对话框 -->
    <el-dialog v-model="showDeployLog" :title="`部署日志 - ${currentProject?.name}`" width="80%" top="5vh" class="dark-dialog">
      <div class="deploy-log">
        <pre ref="logPre">{{ deployLog }}</pre>
      </div>
      <template #footer>
        <el-button size="small" @click="showDeployLog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 站点设置对话框 -->
    <el-dialog v-model="showSiteSettings" :title="`站点设置 - ${currentSite?.name}`" width="600px" class="dark-dialog">
      <el-form :model="currentSite" label-width="100px" size="small" v-if="currentSite">
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
          <el-input type="textarea" v-model="currentSite.rewrite" :rows="6" class="code-input" placeholder="location / { try_files $uri $uri/ /index.html; }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showSiteSettings = false">取消</el-button>
        <el-button type="primary" size="small" @click="saveSiteSettings" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 项目设置对话框 -->
    <el-dialog v-model="showProjectSettings" :title="`项目设置 - ${currentProject?.name}`" width="600px" class="dark-dialog">
      <el-form :model="currentProject" label-width="100px" size="small" v-if="currentProject">
        <el-form-item label="域名">
          <el-input v-model="currentProject.domain" />
        </el-form-item>
        <el-form-item label="项目目录">
          <el-input v-model="currentProject.path" />
        </el-form-item>
        <el-form-item label="运行端口" v-if="!['php', 'static-build'].includes(currentProject.type)">
          <el-input-number v-model="currentProject.port" :min="1024" :max="65535" />
        </el-form-item>
        <el-form-item label="构建步骤">
          <div class="workflow-steps">
            <div v-for="(step, index) in currentProject.buildSteps" :key="index" class="workflow-step">
              <el-input v-model="step.command" style="flex: 1" />
              <el-button text type="danger" @click="currentProject.buildSteps.splice(index, 1)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button text type="primary" @click="currentProject.buildSteps.push({ command: '' })">
              <el-icon><Plus /></el-icon> 添加步骤
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="启动命令" v-if="!['php', 'static-build'].includes(currentProject.type)">
          <el-input v-model="currentProject.startCommand" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showProjectSettings = false">取消</el-button>
        <el-button type="danger" size="small" @click="deleteProject">删除项目</el-button>
        <el-button type="primary" size="small" @click="saveProjectSettings" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Lock, Delete, ArrowDown, Check, Promotion, Monitor, CopyDocument, InfoFilled, Unlock, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import TechIcon from '@/components/icons/TechIcons.vue'

interface Site {
  id: string
  name: string
  domain: string
  path: string
  type: string
  status: string
  ssl: boolean
  rewrite?: string
}

interface BuildStep {
  command: string
}

interface EnvVar {
  key: string
  value: string
}

interface Project {
  id: string
  name: string
  type: string
  domain: string
  path: string
  port: number
  status: string
  ssl: boolean
  buildSteps: BuildStep[]
  startCommand: string
  outputDir?: string
  envVars: EnvVar[]
  lastDeploy?: number
  deploying?: boolean
}

const serverStore = useServerStore()
const selectedServer = ref<string | null>(null)
const activeTab = ref('sites')
const loading = ref(false)
const creating = ref(false)
const saving = ref(false)

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
const logPre = ref<HTMLPreElement | null>(null)

// 表单
const newSite = ref({ name: '', domain: '', path: '/var/www', ssl: false })
const newProxy = ref({ name: '', domain: '', upstream: 'http://127.0.0.1:3000', websocket: false, ssl: false })
const newProject = ref<{
  name: string; type: string; domain: string; domainType: string; path: string; port: number; ssl: boolean;
  buildSteps: BuildStep[]; startCommand: string; outputDir: string; envVars: EnvVar[]
}>({
  name: '', type: 'nodejs', domain: '', domainType: 'domain', path: '/var/www', port: 3000, ssl: false,
  buildSteps: [{ command: 'npm install' }, { command: 'npm run build' }],
  startCommand: 'npm start', outputDir: 'dist', envVars: []
})

// 部署步骤导航
const deployStep = ref('basic')
const deploySteps = [
  { key: 'basic', title: '基本信息', desc: '项目名称和类型' },
  { key: 'domain', title: '域名设置', desc: '配置访问地址' },
  { key: 'deploy', title: '部署设置', desc: '构建和启动流程' },
  { key: 'ssl', title: 'SSL 证书', desc: 'HTTPS 加密' }
]
const deployStepIndex = computed(() => deploySteps.findIndex(s => s.key === deployStep.value))

// 服务器 IP
const serverPublicIP = ref('')
const serverLocalIP = ref('')

const connectedServers = computed(() => serverStore.connectedServers)
const hasMultipleServers = computed(() => serverStore.hasMultipleServers)

watch(selectedServer, (val) => {
  if (val) loadData()
})

onMounted(() => {
  if (connectedServers.value.length > 0) {
    selectedServer.value = serverStore.currentServerId || connectedServers.value[0].id
  }
  loadProjectsFromStorage()
})

function loadProjectsFromStorage() {
  const saved = localStorage.getItem('serverhub_projects')
  if (saved) {
    projects.value = JSON.parse(saved)
  }
}

function saveProjectsToStorage() {
  localStorage.setItem('serverhub_projects', JSON.stringify(projects.value))
}

async function loadData() {
  await loadSites()
}

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
      id: `site_${i}`,
      name: f.replace('.conf', '').replace(/^.*\//, ''),
      domain: f.replace('.conf', '').replace(/^.*\//, ''),
      path: '/var/www/' + f.replace('.conf', '').replace(/^.*\//, ''),
      type: 'static',
      status: 'running',
      ssl: false
    }))
  } catch { sites.value = [] }
  finally { loading.value = false }
}

function refresh() { loadData() }

function handleAddCommand(cmd: string) {
  if (cmd === 'static') showAddStatic.value = true
  else if (cmd === 'proxy') showAddProxy.value = true
  else if (cmd === 'project') {
    resetNewProject()
    showAddProject.value = true
  }
}

function resetNewProject() {
  newProject.value = {
    name: '', type: 'nodejs', domain: '', domainType: 'domain', path: '/var/www', port: 3000, ssl: false,
    buildSteps: [{ command: 'npm install' }, { command: 'npm run build' }],
    startCommand: 'npm start', outputDir: 'dist', envVars: []
  }
  deployStep.value = 'basic'
  fetchServerIP()
}

async function fetchServerIP() {
  if (!selectedServer.value) return
  try {
    // 获取公网 IP
    const pubResult = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', 'curl -fsSL --connect-timeout 3 ifconfig.me 2>/dev/null || curl -fsSL --connect-timeout 3 ipinfo.io/ip 2>/dev/null']
    )
    serverPublicIP.value = (pubResult.stdout || '').trim()
    
    // 获取内网 IP
    const localResult = await window.electronAPI.server.executeCommand(
      selectedServer.value, 'bash', ['-c', "hostname -I 2>/dev/null | awk '{print $1}'"]
    )
    serverLocalIP.value = (localResult.stdout || '').trim()
  } catch {
    serverPublicIP.value = '获取失败'
  }
}

function copyIP(ip: string) {
  if (!ip) return
  navigator.clipboard.writeText(ip)
  ElMessage.success('已复制到剪贴板')
}

function getDomainPrefix(domain: string): string {
  if (!domain) return ''
  const parts = domain.split('.')
  if (parts.length > 2) return parts[0]
  return '@'
}

function prevDeployStep() {
  const idx = deployStepIndex.value
  if (idx > 0) deployStep.value = deploySteps[idx - 1].key
}

function nextDeployStep() {
  // 验证当前步骤
  if (deployStep.value === 'basic') {
    if (!newProject.value.name) {
      ElMessage.warning('请输入项目名称')
      return
    }
  } else if (deployStep.value === 'domain') {
    if (newProject.value.domainType === 'domain' && !newProject.value.domain) {
      ElMessage.warning('请输入域名')
      return
    }
    // 如果使用 IP 访问，设置域名为 IP
    if (newProject.value.domainType === 'ip') {
      newProject.value.domain = serverPublicIP.value
    }
  }
  
  const idx = deployStepIndex.value
  if (idx < deploySteps.length - 1) deployStep.value = deploySteps[idx + 1].key
}

function onProjectTypeChange(type: string) {
  const defaults: Record<string, { buildSteps: BuildStep[]; startCommand: string; port: number }> = {
    nodejs: { buildSteps: [{ command: 'npm install' }, { command: 'npm run build' }], startCommand: 'npm start', port: 3000 },
    python: { buildSteps: [{ command: 'pip install -r requirements.txt' }], startCommand: 'python app.py', port: 5000 },
    go: { buildSteps: [{ command: 'go build -o app' }], startCommand: './app', port: 8080 },
    java: { buildSteps: [{ command: 'mvn package' }], startCommand: 'java -jar target/*.jar', port: 8080 },
    php: { buildSteps: [{ command: 'composer install' }], startCommand: '', port: 0 },
    'static-build': { buildSteps: [{ command: 'npm install' }, { command: 'npm run build' }], startCommand: '', port: 0 }
  }
  const d = defaults[type] || defaults.nodejs
  newProject.value.buildSteps = d.buildSteps
  newProject.value.startCommand = d.startCommand
  newProject.value.port = d.port
}

function getDefaultStartCommand(type: string): string {
  const cmds: Record<string, string> = {
    nodejs: 'npm start', python: 'python app.py', go: './app', java: 'java -jar target/*.jar'
  }
  return cmds[type] || ''
}

function addBuildStep() { newProject.value.buildSteps.push({ command: '' }) }
function removeBuildStep(index: number) { newProject.value.buildSteps.splice(index, 1) }
function addEnvVar() { newProject.value.envVars.push({ key: '', value: '' }) }
function removeEnvVar(index: number) { newProject.value.envVars.splice(index, 1) }

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
  if (!selectedServer.value || !newProject.value.name || !newProject.value.domain) {
    ElMessage.warning('请填写完整信息'); return
  }
  creating.value = true
  try {
    // 创建项目目录
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo mkdir -p ${newProject.value.path}`])
    
    // 生成 Nginx 配置
    const config = generateProjectConfig(newProject.value)
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `echo '${config.replace(/'/g, "'\\''")}' | sudo tee /etc/nginx/sites-available/${newProject.value.name}`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo ln -sf /etc/nginx/sites-available/${newProject.value.name} /etc/nginx/sites-enabled/`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo nginx -t && sudo systemctl reload nginx'])
    
    // 保存项目配置
    const project: Project = {
      id: `project_${Date.now()}`,
      name: newProject.value.name,
      type: newProject.value.type,
      domain: newProject.value.domain,
      path: newProject.value.path,
      port: newProject.value.port,
      status: 'stopped',
      ssl: newProject.value.ssl,
      buildSteps: [...newProject.value.buildSteps],
      startCommand: newProject.value.startCommand,
      outputDir: newProject.value.outputDir,
      envVars: [...newProject.value.envVars]
    }
    projects.value.push(project)
    saveProjectsToStorage()
    
    ElMessage.success('项目创建成功')
    showAddProject.value = false
    activeTab.value = 'projects'
  } catch (e) { ElMessage.error('创建失败: ' + (e as Error).message) }
  finally { creating.value = false }
}

async function deployProject(project: Project) {
  if (!selectedServer.value) return
  project.deploying = true
  deployLog.value = `开始部署 ${project.name}...\n\n`
  showDeployLog.value = true
  currentProject.value = project

  try {
    // 执行构建步骤
    for (const step of project.buildSteps) {
      if (!step.command.trim()) continue
      deployLog.value += `> ${step.command}\n`
      await nextTick()
      if (logPre.value) logPre.value.scrollTop = logPre.value.scrollHeight

      const envStr = project.envVars.map(e => `${e.key}=${e.value}`).join(' ')
      const cmd = envStr ? `cd ${project.path} && ${envStr} ${step.command}` : `cd ${project.path} && ${step.command}`
      const result = await window.electronAPI.server.executeCommand(selectedServer.value!, 'bash', ['-c', cmd])
      
      deployLog.value += (result.stdout || '') + '\n'
      if (result.stderr) deployLog.value += result.stderr + '\n'
      
      if (result.exit_code !== 0) {
        deployLog.value += `\n✗ 步骤失败 (退出码: ${result.exit_code})\n`
        ElMessage.error('部署失败')
        project.deploying = false
        return
      }
    }

    // 启动服务（非静态项目）
    if (!['php', 'static-build'].includes(project.type) && project.startCommand) {
      deployLog.value += `\n> 启动服务: ${project.startCommand}\n`
      
      // 先停止旧进程
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
        `pkill -f "node.*${project.path}" || true`])
      
      // 使用 systemd 或 pm2 启动
      const serviceName = `serverhub-${project.name}`
      const envStr = project.envVars.map(e => `Environment="${e.key}=${e.value}"`).join('\n')
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
      
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
        `echo '${serviceContent.replace(/'/g, "'\\''")}' | sudo tee /etc/systemd/system/${serviceName}.service`])
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
        `sudo systemctl daemon-reload && sudo systemctl enable ${serviceName} && sudo systemctl restart ${serviceName}`])
      
      deployLog.value += `服务已启动: ${serviceName}\n`
      project.status = 'running'
    } else if (project.type === 'static-build') {
      // 静态构建项目，复制到 Nginx 目录
      const outputPath = `${project.path}/${project.outputDir || 'dist'}`
      deployLog.value += `\n> 部署静态文件: ${outputPath}\n`
      project.status = 'running'
    }

    project.lastDeploy = Date.now()
    saveProjectsToStorage()
    deployLog.value += '\n✓ 部署成功！\n'
    ElMessage.success('部署成功')
  } catch (e) {
    deployLog.value += `\n错误: ${(e as Error).message}\n`
    ElMessage.error('部署失败')
  } finally {
    project.deploying = false
  }
}

async function startProject(project: Project) {
  if (!selectedServer.value) return
  try {
    const serviceName = `serverhub-${project.name}`
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo systemctl start ${serviceName}`])
    project.status = 'running'
    saveProjectsToStorage()
    ElMessage.success('项目已启动')
  } catch (e) { ElMessage.error('启动失败') }
}

async function stopProject(project: Project) {
  if (!selectedServer.value) return
  try {
    const serviceName = `serverhub-${project.name}`
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo systemctl stop ${serviceName}`])
    project.status = 'stopped'
    saveProjectsToStorage()
    ElMessage.success('项目已停止')
  } catch (e) { ElMessage.error('停止失败') }
}

function viewProjectLogs(project: Project) {
  currentProject.value = project
  deployLog.value = '加载日志中...'
  showDeployLog.value = true
  loadProjectLogs(project)
}

async function loadProjectLogs(project: Project) {
  if (!selectedServer.value) return
  try {
    const serviceName = `serverhub-${project.name}`
    const result = await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo journalctl -u ${serviceName} -n 100 --no-pager`])
    deployLog.value = result.stdout || '无日志'
  } catch { deployLog.value = '获取日志失败' }
}

function editProject(project: Project) {
  currentProject.value = { ...project, buildSteps: [...project.buildSteps], envVars: [...project.envVars] }
  showProjectSettings.value = true
}

async function saveProjectSettings() {
  if (!currentProject.value) return
  saving.value = true
  try {
    const index = projects.value.findIndex(p => p.id === currentProject.value!.id)
    if (index !== -1) {
      projects.value[index] = { ...currentProject.value }
      saveProjectsToStorage()
    }
    ElMessage.success('设置已保存')
    showProjectSettings.value = false
  } finally { saving.value = false }
}

async function deleteProject() {
  if (!currentProject.value || !selectedServer.value) return
  try {
    await ElMessageBox.confirm(`确定删除项目 ${currentProject.value.name}？`, '确认删除', { type: 'warning' })
  } catch { return }
  
  try {
    const serviceName = `serverhub-${currentProject.value.name}`
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo systemctl stop ${serviceName} || true; sudo systemctl disable ${serviceName} || true; sudo rm -f /etc/systemd/system/${serviceName}.service`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo rm -f /etc/nginx/sites-enabled/${currentProject.value.name} /etc/nginx/sites-available/${currentProject.value.name}`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx'])
    
    projects.value = projects.value.filter(p => p.id !== currentProject.value!.id)
    saveProjectsToStorage()
    showProjectSettings.value = false
    ElMessage.success('项目已删除')
  } catch (e) { ElMessage.error('删除失败') }
}

function editSite(site: Site) {
  currentSite.value = { ...site }
  showSiteSettings.value = true
}

async function saveSiteSettings() {
  if (!currentSite.value || !selectedServer.value) return
  saving.value = true
  try {
    ElMessage.success('设置已保存')
    showSiteSettings.value = false
    loadSites()
  } finally { saving.value = false }
}

function openSite(site: Site) {
  const url = site.ssl ? `https://${site.domain}` : `http://${site.domain}`
  window.electronAPI.shell.openExternal(url)
}

async function toggleSite(site: Site, action: 'start' | 'stop') {
  if (!selectedServer.value) return
  try {
    if (action === 'stop') {
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo rm -f /etc/nginx/sites-enabled/${site.name}`])
    } else {
      await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', `sudo ln -sf /etc/nginx/sites-available/${site.name} /etc/nginx/sites-enabled/`])
    }
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx'])
    ElMessage.success(action === 'stop' ? '站点已停止' : '站点已启动')
    loadSites()
  } catch { ElMessage.error('操作失败') }
}

async function deleteSite(site: Site) {
  try { await ElMessageBox.confirm(`确定删除站点 ${site.name}？`, '确认删除', { type: 'warning' }) }
  catch { return }
  if (!selectedServer.value) return
  try {
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 
      `sudo rm -f /etc/nginx/sites-enabled/${site.name} /etc/nginx/sites-available/${site.name}`])
    await window.electronAPI.server.executeCommand(selectedServer.value, 'bash', ['-c', 'sudo systemctl reload nginx'])
    ElMessage.success('站点已删除')
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

// 配置生成
function generateStaticConfig(site: { name: string; domain: string; path: string; ssl: boolean }): string {
  return `server {
    listen 80;
    server_name ${site.domain};
    root ${site.path};
    index index.html index.htm;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    location ~ /\\. { deny all; }
}`
}

function generateProxyConfig(proxy: { name: string; domain: string; upstream: string; websocket: boolean; ssl: boolean }): string {
  return `server {
    listen 80;
    server_name ${proxy.domain};
    
    location / {
        proxy_pass ${proxy.upstream};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        ${proxy.websocket ? `proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";` : ''}
    }
}`
}

function generateProjectConfig(project: { name: string; domain: string; path: string; port: number; type: string; outputDir?: string }): string {
  if (project.type === 'static-build') {
    return `server {
    listen 80;
    server_name ${project.domain};
    root ${project.path}/${project.outputDir || 'dist'};
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~ /\\. { deny all; }
}`
  }
  if (project.type === 'php') {
    return `server {
    listen 80;
    server_name ${project.domain};
    root ${project.path}/public;
    index index.php index.html;
    
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location ~ \\.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    location ~ /\\. { deny all; }
}`
  }
  return `server {
    listen 80;
    server_name ${project.domain};
    
    location / {
        proxy_pass http://127.0.0.1:${project.port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}`
}

// 辅助函数
function getTypeTag(type: string): 'success' | 'warning' | 'info' | 'danger' | undefined {
  const map: Record<string, 'success' | 'warning' | 'info' | 'danger' | undefined> = {
    static: undefined, php: 'warning', node: 'success', python: 'info', java: 'danger', proxy: undefined
  }
  return map[type]
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = { static: '静态', php: 'PHP', node: 'Node', python: 'Python', java: 'Java', proxy: '代理' }
  return labels[type] || type
}

function getProjectColor(type: string): string {
  const colors: Record<string, string> = {
    nodejs: '#68a063', python: '#3776ab', go: '#00add8', java: '#f89820', php: '#777bb4', 'static-build': '#42b883'
  }
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
.websites {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;

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

.empty-state { padding: 60px 0; }

.main-tabs { margin-bottom: 16px; }
.tab-label { display: flex; align-items: center; gap: 6px; }

.tab-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.data-table {
  .cell-name {
    display: flex;
    align-items: center;
    gap: 8px;

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      &.running { background: #22c55e; }
      &.stopped { background: #ef4444; }
    }
  }

  .domain-link {
    color: var(--primary-color);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 4px;
    &:hover { text-decoration: underline; }
  }

  .mono {
    font-family: 'Consolas', monospace;
    font-size: 12px;
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
  }
}

.empty-projects { padding: 40px 0; }

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.project-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;

  .project-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .project-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      :deep(svg) { width: 24px; height: 24px; }
    }

    .project-info {
      flex: 1;
      .project-name { font-weight: 600; font-size: 14px; }
      .project-domain { font-size: 12px; color: var(--text-secondary); }
    }
  }

  .project-meta {
    margin-bottom: 12px;
    .meta-item {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 4px;
      .meta-label { color: var(--text-color); }
      code { background: var(--bg-secondary); padding: 1px 4px; border-radius: 3px; font-size: 11px; }
    }
  }

  .project-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.workflow-steps {
  .workflow-step {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
}

.env-vars {
  .env-var-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
    .env-eq { color: var(--text-secondary); }
  }
}

.rewrite-presets {
  margin-bottom: 8px;
  display: flex;
  gap: 8px;
}

.code-input {
  :deep(.el-textarea__inner) {
    font-family: 'Consolas', monospace;
    font-size: 12px;
    background: var(--bg-tertiary);
  }
}

.deploy-log {
  background: #1a1a1a;
  border-radius: 6px;
  padding: 12px;
  max-height: 500px;
  overflow: auto;

  pre {
    margin: 0;
    font-size: 12px;
    color: #d4d4d4;
    white-space: pre-wrap;
    word-break: break-all;
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

// 部署对话框样式
:deep(.deploy-dialog) {
  .el-dialog__header { display: none; }
  .el-dialog__body { padding: 0; }
}

.deploy-layout {
  display: flex;
  min-height: 550px;
}

.deploy-sidebar {
  width: 240px;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;

  .sidebar-header {
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);

    .header-icon {
      font-size: 20px;
      color: var(--primary-color);
    }
  }

  .sidebar-nav {
    padding: 12px;
  }

  .nav-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 4px;

    &:hover {
      background: var(--bg-secondary);
    }

    &.active {
      background: var(--primary-color);
      .nav-title { color: #fff; }
      .nav-desc { color: rgba(255,255,255,0.7); }
      .nav-icon { background: rgba(255,255,255,0.2); color: #fff; }
    }

    &.completed .nav-icon {
      background: #22c55e;
      color: #fff;
    }

    .nav-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .nav-text {
      flex: 1;
      min-width: 0;
    }

    .nav-title {
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 2px;
    }

    .nav-desc {
      font-size: 11px;
      color: var(--text-secondary);
    }
  }
}

.deploy-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.step-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;

  .step-header {
    margin-bottom: 24px;
    h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    p {
      color: var(--text-secondary);
      font-size: 13px;
    }
  }

  .form-tip {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }
}

.server-ip-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 20px;

  .ip-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    font-size: 13px;
  }

  .ip-content {
    padding: 12px 16px;
  }

  .ip-item {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    &:last-child { margin-bottom: 0; }

    .ip-label {
      font-size: 12px;
      color: var(--text-secondary);
      width: 60px;
    }

    .ip-value {
      font-family: 'Consolas', monospace;
      font-size: 14px;
      background: var(--bg-secondary);
      padding: 4px 10px;
      border-radius: 4px;
      color: var(--primary-color);
    }
  }
}

.domain-type-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;

  .domain-radio {
    margin-right: 0;
    padding: 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    height: auto;
    transition: all 0.2s;

    &.is-checked {
      border-color: var(--primary-color);
      background: rgba(99, 102, 241, 0.1);
    }

    .radio-content {
      .radio-title {
        font-weight: 500;
        margin-bottom: 4px;
      }
      .radio-desc {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }
  }
}

.domain-guide {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-top: 16px;

  .guide-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    font-size: 13px;
    color: var(--primary-color);
  }

  .guide-steps {
    padding: 16px;
  }

  .guide-step {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    &:last-child { margin-bottom: 0; }

    .step-num {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--primary-color);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step-title {
      font-weight: 500;
      font-size: 13px;
      margin-bottom: 4px;
    }

    .step-desc {
      font-size: 12px;
      color: var(--text-secondary);
      code {
        background: var(--bg-secondary);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Consolas', monospace;
        color: var(--primary-color);
      }
    }
  }
}

.workflow-steps {
  .workflow-step {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;

    .step-number {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: var(--text-secondary);
      flex-shrink: 0;
    }
  }

  .add-step-btn {
    margin-top: 8px;
  }
}

.ssl-option-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;

  .ssl-card {
    padding: 24px;
    border: 2px solid var(--border-color);
    border-radius: 12px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: var(--primary-color);
    }

    &.active {
      border-color: var(--primary-color);
      background: rgba(99, 102, 241, 0.1);
    }

    .ssl-icon {
      font-size: 32px;
      margin-bottom: 12px;
      color: var(--text-secondary);
    }

    &.active .ssl-icon {
      color: var(--primary-color);
    }

    .ssl-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .ssl-desc {
      font-size: 12px;
      color: var(--text-secondary);
    }
  }
}

.deploy-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);

  .footer-right {
    display: flex;
    gap: 8px;
  }
}
</style>
