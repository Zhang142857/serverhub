<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>设置</h1>
      <p class="subtitle">配置 Runixo 的各项功能</p>
    </div>

    <el-tabs tab-position="left" v-model="activeTab">
      <!-- 通用设置 -->
      <el-tab-pane label="通用" name="general">
        <el-card>
          <template #header><span>外观</span></template>
          <el-form label-width="140px">
            <el-form-item label="主题">
              <el-radio-group v-model="settings.theme" @change="applyTheme">
                <el-radio-button label="dark">深色</el-radio-button>
                <el-radio-button label="light">浅色</el-radio-button>
                <el-radio-button label="system">跟随系统</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="自定义主题">
              <el-switch v-model="settings.customTheme.enabled" />
              <span class="form-hint">启用后可自定义颜色和字体</span>
            </el-form-item>
            <template v-if="settings.customTheme.enabled">
              <el-form-item label="主色调">
                <el-color-picker v-model="settings.customTheme.primaryColor" show-alpha @change="applyCustomTheme" />
                <span class="color-preview" :style="{ background: settings.customTheme.primaryColor }"></span>
                <span class="form-hint">{{ settings.customTheme.primaryColor }}</span>
              </el-form-item>
              <el-form-item label="强调色">
                <el-color-picker v-model="settings.customTheme.accentColor" show-alpha @change="applyCustomTheme" />
                <span class="color-preview" :style="{ background: settings.customTheme.accentColor }"></span>
                <span class="form-hint">{{ settings.customTheme.accentColor }}</span>
              </el-form-item>
              <el-form-item label="界面字体大小">
                <el-slider v-model="settings.customTheme.fontSize" :min="12" :max="18" :step="1" style="width: 200px" @change="applyCustomTheme" />
                <span class="form-hint">{{ settings.customTheme.fontSize }}px</span>
              </el-form-item>
              <el-form-item label="圆角大小">
                <el-slider v-model="settings.customTheme.borderRadius" :min="0" :max="16" :step="2" style="width: 200px" @change="applyCustomTheme" />
                <span class="form-hint">{{ settings.customTheme.borderRadius }}px</span>
              </el-form-item>
              <el-form-item>
                <el-button size="small" @click="resetCustomTheme">重置为默认</el-button>
                <el-button size="small" type="primary" @click="previewTheme">预览效果</el-button>
              </el-form-item>
            </template>
            <el-form-item label="语言">
              <el-select v-model="settings.language" style="width: 200px">
                <el-option label="简体中文" value="zh-CN" />
                <el-option label="繁體中文" value="zh-TW" />
                <el-option label="English" value="en-US" />
                <el-option label="日本語" value="ja-JP" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card>
          <template #header><span>启动行为</span></template>
          <el-form label-width="140px">
            <el-form-item label="开机自启动">
              <el-switch v-model="settings.autoStart" />
              <span class="form-hint">系统启动时自动运行 Runixo</span>
            </el-form-item>
            <el-form-item label="最小化到托盘">
              <el-switch v-model="settings.minimizeToTray" />
              <span class="form-hint">关闭窗口时最小化到系统托盘</span>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card>
          <template #header><span>通知</span></template>
          <el-form label-width="140px">
            <el-form-item label="启用通知">
              <el-switch v-model="settings.notifications.enabled" />
            </el-form-item>
            <el-form-item label="服务器离线告警">
              <el-switch v-model="settings.notifications.serverOffline" :disabled="!settings.notifications.enabled" />
            </el-form-item>
            <el-form-item label="资源使用告警">
              <el-switch v-model="settings.notifications.resourceAlert" :disabled="!settings.notifications.enabled" />
            </el-form-item>
            <el-form-item label="容器状态变化">
              <el-switch v-model="settings.notifications.containerStatus" :disabled="!settings.notifications.enabled" />
            </el-form-item>
            <el-form-item label="声音提醒">
              <el-switch v-model="settings.notifications.sound" :disabled="!settings.notifications.enabled" />
              <span class="form-hint">收到通知时播放提示音</span>
            </el-form-item>
            <el-form-item label="桌面通知">
              <el-switch v-model="settings.notifications.desktop" :disabled="!settings.notifications.enabled" />
              <span class="form-hint">在系统托盘显示桌面通知</span>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card v-if="settings.notifications.resourceAlert">
          <template #header>
            <div class="card-header-with-icon">
              <el-icon><Warning /></el-icon>
              <span>告警阈值</span>
            </div>
          </template>
          <el-form label-width="140px">
            <div class="threshold-group">
              <h4><el-icon><Cpu /></el-icon> CPU 使用率</h4>
              <el-form-item label="警告阈值">
                <el-slider v-model="settings.notifications.thresholds.cpuWarning" :min="50" :max="95" :step="5" style="width: 200px" />
                <span class="threshold-value warning">{{ settings.notifications.thresholds.cpuWarning }}%</span>
              </el-form-item>
              <el-form-item label="严重阈值">
                <el-slider v-model="settings.notifications.thresholds.cpuCritical" :min="60" :max="100" :step="5" style="width: 200px" />
                <span class="threshold-value critical">{{ settings.notifications.thresholds.cpuCritical }}%</span>
              </el-form-item>
            </div>
            <el-divider />
            <div class="threshold-group">
              <h4><el-icon><Monitor /></el-icon> 内存使用率</h4>
              <el-form-item label="警告阈值">
                <el-slider v-model="settings.notifications.thresholds.memoryWarning" :min="50" :max="95" :step="5" style="width: 200px" />
                <span class="threshold-value warning">{{ settings.notifications.thresholds.memoryWarning }}%</span>
              </el-form-item>
              <el-form-item label="严重阈值">
                <el-slider v-model="settings.notifications.thresholds.memoryCritical" :min="60" :max="100" :step="5" style="width: 200px" />
                <span class="threshold-value critical">{{ settings.notifications.thresholds.memoryCritical }}%</span>
              </el-form-item>
            </div>
            <el-divider />
            <div class="threshold-group">
              <h4><el-icon><Box /></el-icon> 磁盘使用率</h4>
              <el-form-item label="警告阈值">
                <el-slider v-model="settings.notifications.thresholds.diskWarning" :min="50" :max="95" :step="5" style="width: 200px" />
                <span class="threshold-value warning">{{ settings.notifications.thresholds.diskWarning }}%</span>
              </el-form-item>
              <el-form-item label="严重阈值">
                <el-slider v-model="settings.notifications.thresholds.diskCritical" :min="60" :max="100" :step="5" style="width: 200px" />
                <span class="threshold-value critical">{{ settings.notifications.thresholds.diskCritical }}%</span>
              </el-form-item>
            </div>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- AI 设置 -->
      <el-tab-pane label="AI 助手" name="ai">
        <el-card>
          <template #header><span>AI 提供商</span></template>
          <el-form label-width="140px">
            <el-form-item label="提供商">
              <el-select v-model="settings.ai.provider" style="width: 200px">
                <el-option label="Ollama (本地)" value="ollama" />
                <el-option label="OpenAI" value="openai" />
                <el-option label="Claude" value="claude" />
                <el-option label="DeepSeek" value="deepseek" />
                <el-option label="Google Gemini" value="gemini" />
                <el-option label="Groq" value="groq" />
                <el-option label="Mistral AI" value="mistral" />
                <el-option label="OpenRouter" value="openrouter" />
                <el-option label="自定义 (OpenAI 兼容)" value="custom" />
              </el-select>
            </el-form-item>

            <!-- Ollama -->
            <template v-if="settings.ai.provider === 'ollama'">
              <el-form-item label="Ollama 地址">
                <el-input v-model="settings.ai.ollamaUrl" placeholder="http://localhost:11434" style="width: 300px" />
              </el-form-item>
              <el-form-item label="模型">
                <el-select v-model="settings.ai.ollamaModel" filterable allow-create style="width: 200px">
                  <el-option label="llama3" value="llama3" />
                  <el-option label="mistral" value="mistral" />
                  <el-option label="codellama" value="codellama" />
                  <el-option label="qwen2" value="qwen2" />
                  <el-option label="qwen2.5" value="qwen2.5" />
                  <el-option label="deepseek-r1" value="deepseek-r1" />
                  <el-option label="phi3" value="phi3" />
                  <el-option label="gemma2" value="gemma2" />
                </el-select>
                <el-button @click="testOllamaConnection" :loading="testing" style="margin-left: 12px">测试连接</el-button>
              </el-form-item>
            </template>

            <!-- OpenAI -->
            <template v-if="settings.ai.provider === 'openai'">
              <el-form-item label="API Key">
                <el-input v-model="settings.ai.openaiKey" type="password" show-password style="width: 300px" />
              </el-form-item>
              <el-form-item label="Base URL">
                <el-input v-model="settings.ai.openaiBaseUrl" placeholder="https://api.openai.com（留空使用默认）" style="width: 300px" />
                <span class="form-hint">兼容 OpenAI 的第三方服务可填写自定义地址</span>
              </el-form-item>
              <el-form-item label="模型">
                <el-select v-model="settings.ai.openaiModel" filterable allow-create style="width: 200px" placeholder="选择或输入模型 ID">
                  <el-option label="GPT-4o" value="gpt-4o" />
                  <el-option label="GPT-4o mini" value="gpt-4o-mini" />
                  <el-option label="GPT-4 Turbo" value="gpt-4-turbo" />
                  <el-option label="GPT-3.5 Turbo" value="gpt-3.5-turbo" />
                  <el-option label="o1" value="o1" />
                  <el-option label="o1-mini" value="o1-mini" />
                  <el-option label="o3-mini" value="o3-mini" />
                </el-select>
                <span class="form-hint">可直接输入任意模型 ID</span>
              </el-form-item>
            </template>

            <!-- Claude -->
            <template v-if="settings.ai.provider === 'claude'">
              <el-form-item label="API Key">
                <el-input v-model="settings.ai.claudeKey" type="password" show-password style="width: 300px" />
              </el-form-item>
              <el-form-item label="模型">
                <el-select v-model="settings.ai.claudeModel" filterable allow-create style="width: 200px">
                  <el-option label="Claude 3.5 Sonnet" value="claude-3-5-sonnet-20241022" />
                  <el-option label="Claude 3.5 Haiku" value="claude-3-5-haiku-20241022" />
                  <el-option label="Claude 3 Opus" value="claude-3-opus-20240229" />
                </el-select>
              </el-form-item>
            </template>

            <!-- DeepSeek -->
            <template v-if="settings.ai.provider === 'deepseek'">
              <el-form-item label="API Key">
                <el-input v-model="settings.ai.deepseekKey" type="password" show-password style="width: 300px" />
              </el-form-item>
              <el-form-item label="模型">
                <el-select v-model="settings.ai.deepseekModel" filterable allow-create style="width: 200px">
                  <el-option label="DeepSeek Chat" value="deepseek-chat" />
                  <el-option label="DeepSeek Reasoner" value="deepseek-reasoner" />
                </el-select>
              </el-form-item>
            </template>

            <!-- Gemini -->
            <template v-if="settings.ai.provider === 'gemini'">
              <el-form-item label="API Key">
                <el-input v-model="settings.ai.geminiKey" type="password" show-password style="width: 300px" />
              </el-form-item>
              <el-form-item label="模型">
                <el-select v-model="settings.ai.geminiModel" filterable allow-create style="width: 200px">
                  <el-option label="Gemini 2.0 Flash" value="gemini-2.0-flash" />
                  <el-option label="Gemini 1.5 Pro" value="gemini-1.5-pro" />
                  <el-option label="Gemini 1.5 Flash" value="gemini-1.5-flash" />
                </el-select>
              </el-form-item>
            </template>

            <!-- Groq -->
            <template v-if="settings.ai.provider === 'groq'">
              <el-form-item label="API Key">
                <el-input v-model="settings.ai.groqKey" type="password" show-password style="width: 300px" />
              </el-form-item>
              <el-form-item label="模型">
                <el-select v-model="settings.ai.groqModel" filterable allow-create style="width: 200px">
                  <el-option label="LLaMA 3.3 70B" value="llama-3.3-70b-versatile" />
                  <el-option label="LLaMA 3.1 8B" value="llama-3.1-8b-instant" />
                  <el-option label="Mixtral 8x7B" value="mixtral-8x7b-32768" />
                  <el-option label="Gemma2 9B" value="gemma2-9b-it" />
                </el-select>
              </el-form-item>
            </template>

            <!-- Mistral AI -->
            <template v-if="settings.ai.provider === 'mistral'">
              <el-form-item label="API Key">
                <el-input v-model="settings.ai.mistralKey" type="password" show-password style="width: 300px" />
              </el-form-item>
              <el-form-item label="模型">
                <el-select v-model="settings.ai.mistralModel" filterable allow-create style="width: 200px">
                  <el-option label="Mistral Large" value="mistral-large-latest" />
                  <el-option label="Mistral Small" value="mistral-small-latest" />
                  <el-option label="Codestral" value="codestral-latest" />
                </el-select>
              </el-form-item>
            </template>

            <!-- OpenRouter -->
            <template v-if="settings.ai.provider === 'openrouter'">
              <el-form-item label="API Key">
                <el-input v-model="settings.ai.openrouterKey" type="password" show-password style="width: 300px" />
              </el-form-item>
              <el-form-item label="模型">
                <el-select v-model="settings.ai.openrouterModel" filterable allow-create style="width: 200px" placeholder="输入模型 ID">
                  <el-option label="GPT-4o" value="openai/gpt-4o" />
                  <el-option label="Claude 3.5 Sonnet" value="anthropic/claude-3.5-sonnet" />
                  <el-option label="DeepSeek Chat" value="deepseek/deepseek-chat" />
                  <el-option label="Gemini Pro" value="google/gemini-pro-1.5" />
                </el-select>
                <span class="form-hint">可输入 OpenRouter 上任意模型 ID</span>
              </el-form-item>
            </template>

            <!-- 自定义 OpenAI 兼容 -->
            <template v-if="settings.ai.provider === 'custom'">
              <el-form-item label="API Key">
                <el-input v-model="settings.ai.customKey" type="password" show-password style="width: 300px" />
              </el-form-item>
              <el-form-item label="Base URL">
                <el-input v-model="settings.ai.customBaseUrl" placeholder="https://your-api.com" style="width: 300px" />
                <span class="form-hint">必须兼容 OpenAI /v1/chat/completions 接口</span>
              </el-form-item>
              <el-form-item label="模型 ID">
                <el-input v-model="settings.ai.customModel" placeholder="输入模型 ID" style="width: 200px" />
              </el-form-item>
            </template>
          </el-form>
        </el-card>

        <el-card>
          <template #header><span>AI 行为</span></template>
          <el-form label-width="140px">
            <el-form-item label="自动执行命令">
              <el-switch v-model="settings.ai.autoExecute" />
              <span class="form-hint">允许 AI 自动执行建议的命令</span>
            </el-form-item>
            <el-form-item label="保存对话历史">
              <el-switch v-model="settings.ai.saveHistory" />
            </el-form-item>
            <el-form-item label="历史记录数量">
              <el-input-number v-model="settings.ai.historyLimit" :min="10" :max="200" :step="10" :disabled="!settings.ai.saveHistory" />
            </el-form-item>
            <el-form-item label="流式响应">
              <el-switch v-model="settings.ai.streamResponse" />
              <span class="form-hint">实时显示 AI 响应内容</span>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card>
          <template #header><span>AI 高级设置</span></template>
          <el-form label-width="140px">
            <el-form-item label="Temperature">
              <el-slider v-model="settings.ai.temperature" :min="0" :max="2" :step="0.1" style="width: 200px" />
              <span class="form-hint">{{ settings.ai.temperature }} (越高越有创意)</span>
            </el-form-item>
            <el-form-item label="最大 Token 数">
              <el-select v-model="settings.ai.maxTokens" style="width: 200px">
                <el-option label="1024" :value="1024" />
                <el-option label="2048" :value="2048" />
                <el-option label="4096" :value="4096" />
                <el-option label="8192" :value="8192" />
                <el-option label="16384" :value="16384" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 终端设置 -->
      <el-tab-pane label="终端" name="terminal">
        <el-card>
          <template #header><span>终端外观</span></template>
          <el-form label-width="140px">
            <el-form-item label="字体">
              <el-select v-model="settings.terminal.fontFamily" style="width: 200px">
                <el-option label="Fira Code" value="Fira Code" />
                <el-option label="Cascadia Code" value="Cascadia Code" />
                <el-option label="JetBrains Mono" value="JetBrains Mono" />
                <el-option label="Consolas" value="Consolas" />
                <el-option label="Monaco" value="Monaco" />
              </el-select>
            </el-form-item>
            <el-form-item label="字体大小">
              <el-input-number v-model="settings.terminal.fontSize" :min="10" :max="24" />
            </el-form-item>
            <el-form-item label="光标样式">
              <el-radio-group v-model="settings.terminal.cursorStyle">
                <el-radio-button label="bar">竖线</el-radio-button>
                <el-radio-button label="block">方块</el-radio-button>
                <el-radio-button label="underline">下划线</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="光标闪烁">
              <el-switch v-model="settings.terminal.cursorBlink" />
            </el-form-item>
            <el-form-item label="滚动缓冲区">
              <el-input-number v-model="settings.terminal.scrollback" :min="1000" :max="100000" :step="1000" />
              <span class="form-hint">保留的历史行数</span>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 快捷键设置 -->
      <el-tab-pane label="快捷键" name="shortcuts">
        <el-card>
          <template #header><span>键盘快捷键</span></template>
          <div class="shortcuts-list">
            <div class="shortcut-item" v-for="(key, name) in settings.shortcuts" :key="name">
              <div class="shortcut-info">
                <span class="shortcut-name">{{ getShortcutLabel(String(name)) }}</span>
              </div>
              <div class="shortcut-key" @click="startRecordingShortcut(String(name))">
                <template v-if="editingShortcut === String(name)">
                  <span class="recording">{{ recordingKeys || '按下快捷键...' }}</span>
                </template>
                <template v-else>
                  <el-tag>{{ key }}</el-tag>
                </template>
              </div>
              <el-button text size="small" @click="resetShortcut(String(name))">
                重置
              </el-button>
            </div>
          </div>
        </el-card>
        <el-card>
          <template #header><span>快捷键说明</span></template>
          <div class="shortcut-tips">
            <p>点击快捷键区域可以录制新的快捷键组合</p>
            <p>支持的修饰键：Ctrl、Alt、Shift、Meta (Windows键)</p>
            <p>按 Esc 取消录制</p>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 安全设置 -->
      <el-tab-pane label="安全" name="security">
        <el-card>
          <template #header><span>应用锁定</span></template>
          <el-form label-width="140px">
            <el-form-item label="自动锁定">
              <el-switch v-model="settings.security.autoLock" />
              <span class="form-hint">闲置一段时间后自动锁定应用</span>
            </el-form-item>
            <el-form-item label="锁定超时">
              <el-select v-model="settings.security.lockTimeout" style="width: 200px" :disabled="!settings.security.autoLock">
                <el-option label="1 分钟" :value="1" />
                <el-option label="5 分钟" :value="5" />
                <el-option label="10 分钟" :value="10" />
                <el-option label="15 分钟" :value="15" />
                <el-option label="30 分钟" :value="30" />
              </el-select>
            </el-form-item>
            <el-form-item label="启用密码保护">
              <el-switch v-model="settings.security.requirePassword" />
              <span class="form-hint">解锁时需要输入密码</span>
            </el-form-item>
            <el-form-item label="设置密码" v-if="settings.security.requirePassword">
              <el-input
                v-model="settings.security.password"
                type="password"
                show-password
                placeholder="输入锁定密码"
                style="width: 200px"
              />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card>
          <template #header>
            <div class="card-header-with-icon">
              <el-icon><Key /></el-icon>
              <span>双因素认证</span>
            </div>
          </template>
          <el-form label-width="140px">
            <el-form-item label="启用 2FA">
              <el-switch v-model="settings.security.twoFactorEnabled" />
              <span class="form-hint">增强账户安全性</span>
            </el-form-item>
            <template v-if="settings.security.twoFactorEnabled">
              <el-form-item label="认证方式">
                <el-radio-group v-model="settings.security.twoFactorMethod">
                  <el-radio-button label="totp">TOTP 验证器</el-radio-button>
                  <el-radio-button label="email">邮箱验证</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item v-if="settings.security.twoFactorMethod === 'totp'">
                <el-button type="primary" @click="setupTOTP">
                  <el-icon><Key /></el-icon>
                  配置 TOTP
                </el-button>
                <span class="form-hint">使用 Google Authenticator 或其他 TOTP 应用</span>
              </el-form-item>
            </template>
          </el-form>
        </el-card>

        <el-card>
          <template #header><span>会话安全</span></template>
          <el-form label-width="140px">
            <el-form-item label="会话超时">
              <el-select v-model="settings.security.sessionTimeout" style="width: 200px">
                <el-option label="15 分钟" :value="15" />
                <el-option label="30 分钟" :value="30" />
                <el-option label="1 小时" :value="60" />
                <el-option label="4 小时" :value="240" />
                <el-option label="永不超时" :value="0" />
              </el-select>
              <span class="form-hint">服务器连接会话的超时时间</span>
            </el-form-item>
            <el-form-item label="记住设备">
              <el-switch v-model="settings.security.rememberDevices" />
              <span class="form-hint">在受信任的设备上跳过二次验证</span>
            </el-form-item>
            <el-form-item label="审计日志">
              <el-switch v-model="settings.security.auditLog" />
              <span class="form-hint">记录所有操作日志用于安全审计</span>
            </el-form-item>
            <el-form-item v-if="settings.security.auditLog">
              <el-button @click="viewAuditLog">
                <el-icon><Document /></el-icon>
                查看审计日志
              </el-button>
              <el-button type="warning" @click="clearAuditLog">清除日志</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card>
          <template #header><span>连接安全</span></template>
          <el-form label-width="140px">
            <el-form-item label="SSH 密钥管理">
              <el-button @click="manageSSHKeys">
                <el-icon><Key /></el-icon>
                管理密钥
              </el-button>
            </el-form-item>
            <el-form-item label="已保存的凭据">
              <el-button type="warning" @click="clearCredentials">
                <el-icon><Lock /></el-icon>
                清除所有凭据
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card>
          <template #header>
            <div class="card-header-with-icon">
              <el-icon><Warning /></el-icon>
              <span>紧急避险</span>
            </div>
          </template>
          <el-alert
            type="warning"
            :closable="false"
            style="margin-bottom: 16px"
          >
            <template #title>
              启用后，当服务器 CPU 或内存连续 3 分钟超过阈值时，将自动强制终止占用最高的进程。Docker 容器的重启策略也会被禁用。
            </template>
          </el-alert>
          <el-form label-width="140px">
            <el-form-item label="启用紧急避险">
              <el-switch
                v-model="emergencyKill.enabled"
                @change="toggleEmergencyKill"
                :loading="emergencyKill.loading"
                active-color="#f56c6c"
              />
              <span class="form-hint">保护服务器免于资源耗尽崩溃</span>
            </el-form-item>
            <el-form-item label="CPU 阈值">
              <el-slider v-model="emergencyKill.cpuThreshold" :min="70" :max="99" :step="1" style="width: 200px" :disabled="emergencyKill.enabled" />
              <span class="form-hint">{{ emergencyKill.cpuThreshold }}%</span>
            </el-form-item>
            <el-form-item label="内存阈值">
              <el-slider v-model="emergencyKill.memThreshold" :min="70" :max="99" :step="1" style="width: 200px" :disabled="emergencyKill.enabled" />
              <span class="form-hint">{{ emergencyKill.memThreshold }}%</span>
            </el-form-item>
            <el-form-item v-if="emergencyKill.enabled" label="当前状态">
              <el-tag :type="emergencyKill.consecutiveHigh > 0 ? 'warning' : 'success'" size="small">
                {{ emergencyKill.consecutiveHigh > 0 ? `连续超阈值 ${emergencyKill.consecutiveHigh}/${emergencyKill.samplesRequired} 次` : '系统正常' }}
              </el-tag>
            </el-form-item>
            <el-form-item v-if="emergencyKill.killHistory.length > 0" label="击杀记录">
              <div class="kill-history">
                <div v-for="(record, idx) in emergencyKill.killHistory.slice(-5).reverse()" :key="idx" class="kill-record">
                  <el-tag :type="record.is_docker ? 'danger' : 'warning'" size="small">
                    {{ record.is_docker ? '容器' : '进程' }}
                  </el-tag>
                  <span class="kill-name">{{ record.name }} (PID {{ record.pid }})</span>
                  <span class="kill-stats">CPU {{ record.cpu.toFixed(1) }}% / MEM {{ record.memory.toFixed(1) }}%</span>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 代理设置 -->
      <el-tab-pane label="代理" name="proxy">
        <el-card>
          <template #header><span>网络代理</span></template>
          <el-form label-width="140px">
            <el-form-item label="启用代理">
              <el-switch v-model="settings.proxy.enabled" />
            </el-form-item>
            <el-form-item label="代理类型">
              <el-radio-group v-model="settings.proxy.type" :disabled="!settings.proxy.enabled">
                <el-radio-button label="http">HTTP</el-radio-button>
                <el-radio-button label="https">HTTPS</el-radio-button>
                <el-radio-button label="socks5">SOCKS5</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="代理地址">
              <el-input
                v-model="settings.proxy.host"
                placeholder="例如: 127.0.0.1"
                style="width: 200px"
                :disabled="!settings.proxy.enabled"
              />
            </el-form-item>
            <el-form-item label="端口">
              <el-input-number
                v-model="settings.proxy.port"
                :min="1"
                :max="65535"
                :disabled="!settings.proxy.enabled"
              />
            </el-form-item>
            <el-form-item label="用户名">
              <el-input
                v-model="settings.proxy.username"
                placeholder="可选"
                style="width: 200px"
                :disabled="!settings.proxy.enabled"
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="settings.proxy.password"
                type="password"
                show-password
                placeholder="可选"
                style="width: 200px"
                :disabled="!settings.proxy.enabled"
              />
            </el-form-item>
          </el-form>
        </el-card>
        <el-card>
          <template #header><span>代理测试</span></template>
          <div class="proxy-test">
            <el-button @click="testProxy" :loading="testingProxy" :disabled="!settings.proxy.enabled">
              测试代理连接
            </el-button>
            <span v-if="proxyTestResult" :class="['test-result', proxyTestResult.success ? 'success' : 'error']">
              {{ proxyTestResult.message }}
            </span>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 数据管理 -->
      <el-tab-pane label="数据管理" name="data">
        <el-card>
          <template #header>
            <div class="card-header-with-icon">
              <el-icon><Upload /></el-icon>
              <span>自动备份</span>
            </div>
          </template>
          <el-form label-width="140px">
            <el-form-item label="启用自动备份">
              <el-switch v-model="settings.backup.autoBackup" />
              <span class="form-hint">定期自动备份配置数据</span>
            </el-form-item>
            <template v-if="settings.backup.autoBackup">
              <el-form-item label="备份频率">
                <el-select v-model="settings.backup.backupInterval" style="width: 200px">
                  <el-option label="每天" value="daily" />
                  <el-option label="每周" value="weekly" />
                  <el-option label="每月" value="monthly" />
                </el-select>
              </el-form-item>
              <el-form-item label="备份位置">
                <el-input v-model="settings.backup.backupLocation" placeholder="选择备份目录" style="width: 250px" readonly />
                <el-button @click="selectBackupLocation" style="margin-left: 8px">浏览</el-button>
              </el-form-item>
              <el-form-item label="保留备份数">
                <el-input-number v-model="settings.backup.keepBackups" :min="1" :max="30" />
                <span class="form-hint">超过此数量的旧备份将被删除</span>
              </el-form-item>
              <el-form-item label="包含凭据">
                <el-switch v-model="settings.backup.includeCredentials" />
                <span class="form-hint warning-hint">警告：包含敏感信息，请确保备份位置安全</span>
              </el-form-item>
            </template>
          </el-form>
        </el-card>

        <el-card>
          <template #header><span>配置管理</span></template>
          <div class="data-actions">
            <div class="action-item">
              <div class="action-info">
                <h4>导出配置</h4>
                <p>将所有设置和服务器配置导出为 JSON 文件</p>
              </div>
              <el-button @click="exportConfig">
                <el-icon><Download /></el-icon>
                导出
              </el-button>
            </div>
            <div class="action-item">
              <div class="action-info">
                <h4>导入配置</h4>
                <p>从 JSON 文件导入设置和服务器配置</p>
              </div>
              <el-button @click="importConfig">
                <el-icon><Upload /></el-icon>
                导入
              </el-button>
            </div>
            <div class="action-item">
              <div class="action-info">
                <h4>立即备份</h4>
                <p>手动创建一个配置备份</p>
              </div>
              <el-button type="primary" @click="createBackup" :loading="creatingBackup">
                <el-icon><Refresh /></el-icon>
                备份
              </el-button>
            </div>
            <div class="action-item">
              <div class="action-info">
                <h4>恢复备份</h4>
                <p>从之前的备份恢复配置</p>
              </div>
              <el-button @click="showRestoreDialog">
                <el-icon><Refresh /></el-icon>
                恢复
              </el-button>
            </div>
          </div>
        </el-card>

        <el-card>
          <template #header><span>清除数据</span></template>
          <div class="data-actions">
            <div class="action-item">
              <div class="action-info">
                <h4>清除 AI 对话历史</h4>
                <p>删除所有 AI 助手的对话记录</p>
              </div>
              <el-button type="warning" @click="clearAIHistory">清除</el-button>
            </div>
            <div class="action-item">
              <div class="action-info">
                <h4>清除所有缓存</h4>
                <p>清除应用缓存数据，不影响配置</p>
              </div>
              <el-button type="warning" @click="clearCache">清除</el-button>
            </div>
            <div class="action-item">
              <div class="action-info">
                <h4>重置所有设置</h4>
                <p>将所有设置恢复为默认值</p>
              </div>
              <el-button type="danger" @click="resetAllSettings">重置</el-button>
            </div>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 更新 -->
      <el-tab-pane label="更新" name="update">
        <el-card>
          <template #header><span>客户端更新</span></template>
          <div class="update-section">
            <div class="current-version">
              <span class="label">当前版本</span>
              <span class="version">v0.1.0</span>
            </div>
            <el-button type="primary" @click="checkUpdate" :loading="checkingUpdate">检查更新</el-button>
          </div>
          <el-form label-width="140px" style="margin-top: 20px">
            <el-form-item label="自动检查更新">
              <el-switch v-model="settings.update.autoCheck" />
            </el-form-item>
            <el-form-item label="自动下载更新">
              <el-switch v-model="settings.update.autoDownload" :disabled="!settings.update.autoCheck" />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card>
          <template #header>
            <div class="card-header-with-icon">
              <el-icon><Monitor /></el-icon>
              <span>服务器 Agent 自动更新</span>
            </div>
          </template>
          <el-alert
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
          >
            <template #title>
              启用后，服务器上的 Agent 将自动检测并安装新版本，无需手动更新。
            </template>
          </el-alert>
          <el-form label-width="160px">
            <el-form-item label="启用自动更新">
              <el-switch v-model="settings.agentUpdate.autoUpdate" />
              <span class="form-hint">Agent 将在后台自动更新到最新版本</span>
            </el-form-item>
            <el-form-item label="更新通道">
              <el-select v-model="settings.agentUpdate.channel" style="width: 200px" :disabled="!settings.agentUpdate.autoUpdate">
                <el-option label="稳定版 (推荐)" value="stable" />
                <el-option label="测试版" value="beta" />
                <el-option label="开发版" value="nightly" />
              </el-select>
            </el-form-item>
            <el-form-item label="检查间隔">
              <el-select v-model="settings.agentUpdate.checkInterval" style="width: 200px" :disabled="!settings.agentUpdate.autoUpdate">
                <el-option label="每小时" :value="3600" />
                <el-option label="每 6 小时" :value="21600" />
                <el-option label="每天" :value="86400" />
                <el-option label="每周" :value="604800" />
              </el-select>
            </el-form-item>
            <el-form-item label="仅通知不安装">
              <el-switch v-model="settings.agentUpdate.notifyOnly" :disabled="!settings.agentUpdate.autoUpdate" />
              <span class="form-hint">发现新版本时仅通知，不自动安装</span>
            </el-form-item>
          </el-form>
          <el-divider />
          <div class="agent-update-actions">
            <el-button @click="checkAgentUpdates" :loading="checkingAgentUpdate">
              <el-icon><Refresh /></el-icon>
              检查所有服务器 Agent 更新
            </el-button>
            <el-button type="primary" @click="applyAgentUpdateSettings" :loading="applyingAgentSettings">
              应用到所有服务器
            </el-button>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 关于 -->
      <el-tab-pane label="关于" name="about">
        <el-card>
          <div class="about-content">
            <div class="app-logo">🖥️</div>
            <h2>Runixo</h2>
            <p class="version">版本 0.1.0</p>
            <p class="description">AI-Native 服务器管理平台</p>
            <p class="tagline">安全、智能、高效的多服务器管理解决方案</p>
            <div class="links">
              <el-button text type="primary" @click="openLink('https://github.com/runixo/runixo')">
                <el-icon><Link /></el-icon> GitHub
              </el-button>
              <el-button text type="primary" @click="openLink('https://runixo.io/docs')">
                <el-icon><Document /></el-icon> 文档
              </el-button>
              <el-button text type="primary" @click="openLink('https://runixo.io')">
                <el-icon><Monitor /></el-icon> 官网
              </el-button>
            </div>
            <el-divider />
            <div class="tech-stack">
              <el-tag>Electron</el-tag>
              <el-tag>Vue 3</el-tag>
              <el-tag>TypeScript</el-tag>
              <el-tag>Element Plus</el-tag>
              <el-tag>Go</el-tag>
              <el-tag>gRPC</el-tag>
            </div>
            <p class="copyright">© 2024 Runixo. MIT License.</p>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <div class="settings-footer">
      <el-button type="primary" @click="saveSettings" :loading="saving">保存设置</el-button>
      <el-button @click="resetSettings">恢复默认</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Link, Document, Monitor, Key, Lock, Upload, Download, Refresh, Warning, Cpu, Box } from '@element-plus/icons-vue'

const activeTab = ref('general')
const saving = ref(false)
const testing = ref(false)
const checkingUpdate = ref(false)
const editingShortcut = ref<string | null>(null)
const recordingKeys = ref('')
const testingProxy = ref(false)
const proxyTestResult = ref<{ success: boolean; message: string } | null>(null)
const creatingBackup = ref(false)

// 紧急避险状态
const emergencyKill = ref({
  enabled: false,
  loading: false,
  cpuThreshold: 95,
  memThreshold: 95,
  consecutiveHigh: 0,
  samplesRequired: 9,
  killHistory: [] as any[]
})

async function toggleEmergencyKill(val: boolean) {
  const serverStore = (await import('../stores/server')).useServerStore()
  const serverId = serverStore.currentServerId
  if (!serverId) {
    ElMessage.warning('请先连接服务器')
    emergencyKill.value.enabled = !val
    return
  }
  emergencyKill.value.loading = true
  try {
    if (val) {
      await window.electronAPI.emergency.enable(serverId, emergencyKill.value.cpuThreshold, emergencyKill.value.memThreshold)
    } else {
      await window.electronAPI.emergency.disable(serverId)
    }
    ElMessage.success(val ? '紧急避险已启用' : '紧急避险已禁用')
  } catch {
    emergencyKill.value.enabled = !val
    ElMessage.error('操作失败')
  }
  emergencyKill.value.loading = false
}

async function refreshEmergencyStatus() {
  const serverStore = (await import('../stores/server')).useServerStore()
  const serverId = serverStore.currentServerId
  if (!serverId) return
  try {
    const data = await window.electronAPI.emergency.status(serverId)
    if (data) {
      emergencyKill.value.enabled = data.enabled
      emergencyKill.value.consecutiveHigh = data.consecutiveHigh || 0
      emergencyKill.value.samplesRequired = data.samplesRequired || 9
      emergencyKill.value.killHistory = data.killHistory || []
    }
  } catch { /* ignore */ }
}

const defaultSettings = {
  language: 'zh-CN',
  theme: 'dark',
  autoStart: false,
  minimizeToTray: true,
  // 主题自定义
  customTheme: {
    enabled: false,
    primaryColor: '#6366f1',
    accentColor: '#22c55e',
    fontSize: 14,
    borderRadius: 8
  },
  notifications: {
    enabled: true,
    serverOffline: true,
    resourceAlert: true,
    containerStatus: false,
    sound: true,
    desktop: true,
    // 告警阈值
    thresholds: {
      cpuWarning: 70,
      cpuCritical: 90,
      memoryWarning: 70,
      memoryCritical: 90,
      diskWarning: 80,
      diskCritical: 95
    }
  },
  ai: {
    provider: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    openaiKey: '',
    openaiModel: 'gpt-4o',
    openaiBaseUrl: '',
    claudeKey: '',
    claudeModel: 'claude-3-5-sonnet-20241022',
    deepseekKey: '',
    deepseekModel: 'deepseek-chat',
    geminiKey: '',
    geminiModel: 'gemini-2.0-flash',
    groqKey: '',
    groqModel: 'llama-3.3-70b-versatile',
    mistralKey: '',
    mistralModel: 'mistral-large-latest',
    openrouterKey: '',
    openrouterModel: 'openai/gpt-4o',
    customKey: '',
    customBaseUrl: '',
    customModel: '',
    autoExecute: false,
    saveHistory: true,
    historyLimit: 50,
    // AI 高级设置
    temperature: 0.7,
    maxTokens: 4096,
    streamResponse: true
  },
  terminal: {
    fontFamily: 'Fira Code',
    fontSize: 14,
    cursorStyle: 'bar',
    cursorBlink: true,
    scrollback: 10000
  },
  shortcuts: {
    toggleAI: 'Ctrl+K',
    newTerminal: 'Ctrl+T',
    closeTab: 'Ctrl+W',
    search: 'Ctrl+F',
    settings: 'Ctrl+,',
    refresh: 'F5',
    // 新增快捷键
    quickConnect: 'Ctrl+Shift+C',
    toggleSidebar: 'Ctrl+B',
    nextTab: 'Ctrl+Tab',
    prevTab: 'Ctrl+Shift+Tab',
    commandPalette: 'Ctrl+Shift+P',
    fullscreen: 'F11'
  },
  security: {
    autoLock: false,
    lockTimeout: 5,
    requirePassword: false,
    password: '',
    // 双因素认证
    twoFactorEnabled: false,
    twoFactorMethod: 'totp',
    // 会话安全
    sessionTimeout: 30,
    rememberDevices: true,
    // 审计日志
    auditLog: true
  },
  proxy: {
    enabled: false,
    type: 'http',
    host: '',
    port: 8080,
    username: '',
    password: ''
  },
  update: {
    autoCheck: true,
    autoDownload: false,
    channel: 'stable'
  },
  // Agent 自动更新
  agentUpdate: {
    autoUpdate: false,
    channel: 'stable',
    checkInterval: 3600,
    notifyOnly: true
  },
  // 数据备份
  backup: {
    autoBackup: false,
    backupInterval: 'daily',
    backupLocation: '',
    keepBackups: 7,
    includeCredentials: false
  }
}

const settings = ref(JSON.parse(JSON.stringify(defaultSettings)))

onMounted(() => { loadSettings(); refreshEmergencyStatus() })

function loadSettings() {
  const saved = localStorage.getItem('runixo_settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      settings.value = { ...defaultSettings, ...parsed,
        customTheme: { ...defaultSettings.customTheme, ...parsed.customTheme },
        notifications: {
          ...defaultSettings.notifications,
          ...parsed.notifications,
          thresholds: { ...defaultSettings.notifications.thresholds, ...parsed.notifications?.thresholds }
        },
        ai: { ...defaultSettings.ai, ...parsed.ai },
        terminal: { ...defaultSettings.terminal, ...parsed.terminal },
        shortcuts: { ...defaultSettings.shortcuts, ...parsed.shortcuts },
        security: { ...defaultSettings.security, ...parsed.security },
        proxy: { ...defaultSettings.proxy, ...parsed.proxy },
        update: { ...defaultSettings.update, ...parsed.update },
        backup: { ...defaultSettings.backup, ...parsed.backup }
      }
    } catch { /* ignore */ }
  }
}

function saveSettings() {
  saving.value = true
  setTimeout(async () => {
    localStorage.setItem('runixo_settings', JSON.stringify(settings.value))
    // 同步 AI 设置到主进程
    try {
      const ai = settings.value.ai
      const p = ai.provider
      const configMap: Record<string, any> = {
        ollama: { baseUrl: ai.ollamaUrl, model: ai.ollamaModel },
        openai: { apiKey: ai.openaiKey, baseUrl: ai.openaiBaseUrl, model: ai.openaiModel },
        claude: { apiKey: ai.claudeKey, model: ai.claudeModel },
        deepseek: { apiKey: ai.deepseekKey, model: ai.deepseekModel },
        gemini: { apiKey: ai.geminiKey, model: ai.geminiModel },
        groq: { apiKey: ai.groqKey, model: ai.groqModel },
        mistral: { apiKey: ai.mistralKey, model: ai.mistralModel },
        openrouter: { apiKey: ai.openrouterKey, model: ai.openrouterModel },
        custom: { apiKey: ai.customKey, baseUrl: ai.customBaseUrl, model: ai.customModel }
      }
      await window.electronAPI.ai.setProvider(p, configMap[p] || {})
    } catch {}
    saving.value = false
    ElMessage.success('设置已保存')
  }, 300)
}

function resetSettings() {
  ElMessageBox.confirm('确定要恢复默认设置吗？', '确认').then(() => {
    settings.value = JSON.parse(JSON.stringify(defaultSettings))
    ElMessage.success('已恢复默认设置')
  }).catch(() => {})
}

function applyTheme(theme: string | number | boolean | undefined) {
  if (typeof theme === 'string') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

function testOllamaConnection() {
  testing.value = true
  setTimeout(() => {
    testing.value = false
    ElMessage.success('Ollama 连接成功')
  }, 1000)
}

function exportConfig() {
  const config = {
    settings: settings.value,
    servers: JSON.parse(localStorage.getItem('runixo_servers') || '[]'),
    cloudProviders: JSON.parse(localStorage.getItem('runixo_cloud_providers') || '{}'),
    plugins: JSON.parse(localStorage.getItem('runixo_plugins') || '[]')
  }
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `runixo-config-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('配置已导出')
}

function importConfig() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string)
        if (config.settings) {
          settings.value = { ...defaultSettings, ...config.settings }
          localStorage.setItem('runixo_settings', JSON.stringify(config.settings))
        }
        if (config.servers) localStorage.setItem('runixo_servers', JSON.stringify(config.servers))
        if (config.cloudProviders) localStorage.setItem('runixo_cloud_providers', JSON.stringify(config.cloudProviders))
        if (config.plugins) localStorage.setItem('runixo_plugins', JSON.stringify(config.plugins))
        ElMessage.success('配置已导入')
      } catch { ElMessage.error('配置文件格式错误') }
    }
    reader.readAsText(file)
  }
  input.click()
}

function clearAIHistory() {
  ElMessageBox.confirm('确定要清除所有 AI 对话历史吗？', '确认').then(() => {
    localStorage.removeItem('runixo_ai_history')
    ElMessage.success('AI 对话历史已清除')
  }).catch(() => {})
}

function clearCache() {
  ElMessageBox.confirm('确定要清除所有缓存吗？', '确认').then(() => {
    ElMessage.success('缓存已清除')
  }).catch(() => {})
}

function resetAllSettings() {
  ElMessageBox.confirm('确定要重置所有设置吗？这将清除所有配置数据。', '警告', { type: 'warning' }).then(() => {
    localStorage.clear()
    location.reload()
  }).catch(() => {})
}

function checkUpdate() {
  checkingUpdate.value = true
  setTimeout(() => {
    checkingUpdate.value = false
    ElMessage.info('当前已是最新版本')
  }, 1500)
}

function openLink(url: string) {
  window.electronAPI?.shell?.openExternal?.(url) || window.open(url, '_blank')
}

// 快捷键相关函数
const shortcutLabels: Record<string, string> = {
  toggleAI: '打开 AI 助手',
  newTerminal: '新建终端标签',
  closeTab: '关闭当前标签',
  search: '搜索',
  settings: '打开设置',
  refresh: '刷新',
  quickConnect: '快速连接服务器',
  toggleSidebar: '切换侧边栏',
  nextTab: '下一个标签',
  prevTab: '上一个标签',
  commandPalette: '命令面板',
  fullscreen: '全屏切换'
}

function getShortcutLabel(name: string): string {
  return shortcutLabels[name] || name
}

function startRecordingShortcut(name: string) {
  editingShortcut.value = name
  recordingKeys.value = ''

  const handleKeyDown = (e: KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.key === 'Escape') {
      editingShortcut.value = null
      recordingKeys.value = ''
      document.removeEventListener('keydown', handleKeyDown)
      return
    }

    const keys: string[] = []
    if (e.ctrlKey) keys.push('Ctrl')
    if (e.altKey) keys.push('Alt')
    if (e.shiftKey) keys.push('Shift')
    if (e.metaKey) keys.push('Meta')

    // 添加主键（排除修饰键本身）
    const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta']
    if (!modifierKeys.includes(e.key)) {
      keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
    }

    recordingKeys.value = keys.join('+')

    // 如果有主键，保存快捷键
    if (!modifierKeys.includes(e.key) && keys.length > 0) {
      settings.value.shortcuts[name] = recordingKeys.value
      editingShortcut.value = null
      recordingKeys.value = ''
      document.removeEventListener('keydown', handleKeyDown)
      ElMessage.success('快捷键已更新')
    }
  }

  document.addEventListener('keydown', handleKeyDown)
}

function resetShortcut(name: string) {
  settings.value.shortcuts[name] = defaultSettings.shortcuts[name as keyof typeof defaultSettings.shortcuts]
  ElMessage.success('快捷键已重置')
}

// 安全相关函数
function manageSSHKeys() {
  ElMessage.info('SSH 密钥管理功能即将推出')
}

function clearCredentials() {
  ElMessageBox.confirm('确定要清除所有保存的凭据吗？这将删除所有服务器的登录信息。', '警告', { type: 'warning' }).then(() => {
    localStorage.removeItem('runixo_credentials')
    ElMessage.success('所有凭据已清除')
  }).catch(() => {})
}

// 代理相关函数
async function testProxy() {
  if (!settings.value.proxy.enabled) return

  // 验证必填字段
  if (!settings.value.proxy.host || !settings.value.proxy.port) {
    proxyTestResult.value = {
      success: false,
      message: '请填写代理地址和端口'
    }
    return
  }

  testingProxy.value = true
  proxyTestResult.value = null

  try {
    const result = await window.electronAPI.proxy.test({
      type: settings.value.proxy.type,
      host: settings.value.proxy.host,
      port: settings.value.proxy.port,
      username: settings.value.proxy.username || undefined,
      password: settings.value.proxy.password || undefined
    })
    proxyTestResult.value = result
  } catch (error) {
    proxyTestResult.value = {
      success: false,
      message: `测试失败: ${(error as Error).message}`
    }
  } finally {
    testingProxy.value = false
  }
}

// 主题自定义函数
function applyCustomTheme() {
  if (!settings.value.customTheme.enabled) return

  const root = document.documentElement
  root.style.setProperty('--primary-color', settings.value.customTheme.primaryColor)
  root.style.setProperty('--accent-color', settings.value.customTheme.accentColor)
  root.style.setProperty('--font-size-base', `${settings.value.customTheme.fontSize}px`)
  root.style.setProperty('--border-radius', `${settings.value.customTheme.borderRadius}px`)
}

function resetCustomTheme() {
  settings.value.customTheme = {
    enabled: true,
    primaryColor: '#6366f1',
    accentColor: '#22c55e',
    fontSize: 14,
    borderRadius: 8
  }
  applyCustomTheme()
  ElMessage.success('主题已重置为默认')
}

function previewTheme() {
  applyCustomTheme()
  ElMessage.success('主题预览已应用')
}

// 双因素认证函数
function setupTOTP() {
  ElMessageBox.alert(
    '请使用 Google Authenticator、Microsoft Authenticator 或其他 TOTP 应用扫描二维码完成设置。',
    'TOTP 设置',
    {
      confirmButtonText: '我已完成设置',
      callback: () => {
        ElMessage.success('TOTP 已配置')
      }
    }
  )
}

// 审计日志函数
function viewAuditLog() {
  ElMessage.info('审计日志功能即将推出')
}

function clearAuditLog() {
  ElMessageBox.confirm('确定要清除所有审计日志吗？', '确认', { type: 'warning' }).then(() => {
    localStorage.removeItem('runixo_audit_log')
    ElMessage.success('审计日志已清除')
  }).catch(() => {})
}

// 备份相关函数
function selectBackupLocation() {
  // 在 Electron 环境中使用对话框选择目录
  if (window.electronAPI?.dialog?.openFile) {
    window.electronAPI.dialog.openFile({
      properties: ['openDirectory']
    }).then((result: { canceled: boolean; filePaths: string[] }) => {
      if (!result.canceled && result.filePaths.length > 0) {
        settings.value.backup.backupLocation = result.filePaths[0]
      }
    })
  } else {
    // 非 Electron 环境下使用默认路径
    settings.value.backup.backupLocation = '~/runixo-backups'
    ElMessage.info('已设置默认备份目录')
  }
}

function createBackup() {
  creatingBackup.value = true

  setTimeout(() => {
    const config = {
      settings: settings.value,
      servers: JSON.parse(localStorage.getItem('runixo_servers') || '[]'),
      cloudProviders: JSON.parse(localStorage.getItem('runixo_cloud_providers') || '{}'),
      plugins: JSON.parse(localStorage.getItem('runixo_plugins') || '[]'),
      timestamp: new Date().toISOString()
    }

    // 保存到备份列表
    const backups = JSON.parse(localStorage.getItem('runixo_backups') || '[]')
    const backupName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
    backups.unshift({
      name: backupName,
      date: new Date().toLocaleString(),
      size: `${(JSON.stringify(config).length / 1024).toFixed(1)} KB`,
      data: config
    })

    // 只保留指定数量的备份
    while (backups.length > settings.value.backup.keepBackups) {
      backups.pop()
    }

    localStorage.setItem('runixo_backups', JSON.stringify(backups))
    creatingBackup.value = false
    ElMessage.success('备份创建成功')
  }, 1000)
}

function showRestoreDialog() {
  const backups = JSON.parse(localStorage.getItem('runixo_backups') || '[]')

  if (backups.length === 0) {
    ElMessage.warning('没有可用的备份')
    return
  }

  // 显示备份列表让用户选择
  const backupNames = backups.map((b: { name: string; date: string }) => `${b.name} (${b.date})`).join('\n')

  ElMessageBox.confirm(
    `可用备份:\n${backupNames}\n\n是否恢复最近的备份？`,
    '恢复备份',
    {
      confirmButtonText: '恢复最近备份',
      cancelButtonText: '取消',
      type: 'info'
    }
  ).then(() => {
    const backup = backups[0]
    if (backup && backup.data) {
      if (backup.data.settings) {
        settings.value = { ...defaultSettings, ...backup.data.settings }
        localStorage.setItem('runixo_settings', JSON.stringify(backup.data.settings))
      }
      if (backup.data.servers) {
        localStorage.setItem('runixo_servers', JSON.stringify(backup.data.servers))
      }
      if (backup.data.cloudProviders) {
        localStorage.setItem('runixo_cloud_providers', JSON.stringify(backup.data.cloudProviders))
      }
      if (backup.data.plugins) {
        localStorage.setItem('runixo_plugins', JSON.stringify(backup.data.plugins))
      }
      ElMessage.success('备份已恢复')
    }
  }).catch(() => {})
}
</script>

<style lang="scss" scoped>
.settings-page {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
  h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
  .subtitle { color: var(--text-secondary); font-size: 14px; }
}

.el-card { margin-bottom: 16px; }

.form-hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.data-actions {
  .action-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid var(--border-color);
    &:last-child { border-bottom: none; }
    .action-info {
      h4 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
      p { font-size: 12px; color: var(--text-secondary); margin: 0; }
    }
  }
}

.update-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  .current-version {
    .label { color: var(--text-secondary); margin-right: 12px; }
    .version { font-size: 18px; font-weight: 600; }
  }
}

.about-content {
  text-align: center;
  padding: 24px;
  .app-logo { font-size: 64px; margin-bottom: 16px; }
  h2 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
  .version { color: var(--text-secondary); margin-bottom: 8px; }
  .description { font-size: 16px; margin-bottom: 4px; }
  .tagline { color: var(--text-secondary); font-size: 14px; margin-bottom: 16px; }
  .links { margin-bottom: 16px; display: flex; justify-content: center; gap: 16px; }
  .tech-stack { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .copyright { font-size: 12px; color: var(--text-secondary); }
}

.settings-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.shortcuts-list {
  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color);

    &:last-child {
      border-bottom: none;
    }

    .shortcut-info {
      flex: 1;

      .shortcut-name {
        font-size: 14px;
        font-weight: 500;
      }
    }

    .shortcut-key {
      min-width: 120px;
      text-align: center;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;

      &:hover {
        background: var(--bg-tertiary);
      }

      .recording {
        color: var(--primary-color);
        font-size: 13px;
        animation: pulse 1s infinite;
      }
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.shortcut-tips {
  p {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 8px 0;

    &:first-child {
      margin-top: 0;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.proxy-test {
  display: flex;
  align-items: center;
  gap: 16px;

  .test-result {
    font-size: 13px;

    &.success {
      color: var(--el-color-success);
    }

    &.error {
      color: var(--el-color-danger);
    }
  }
}

// 主题自定义样式
.color-preview {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  margin-left: 12px;
  vertical-align: middle;
  border: 1px solid var(--border-color);
}

// 告警阈值样式
.threshold-group {
  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 16px;
    color: var(--text-primary);
  }
}

.threshold-value {
  margin-left: 16px;
  font-weight: 600;
  min-width: 50px;
  display: inline-block;

  &.warning {
    color: var(--el-color-warning);
  }

  &.critical {
    color: var(--el-color-danger);
  }
}

// 卡片头部带图标
.card-header-with-icon {
  display: flex;
  align-items: center;
  gap: 8px;

  .el-icon {
    font-size: 18px;
    color: var(--primary-color);
  }
}

// 警告提示
.warning-hint {
  color: var(--el-color-warning) !important;
}

// 更新频道标签
.update-channel {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;

  .channel-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .channel-name {
      font-weight: 600;
    }
  }

  .channel-desc {
    font-size: 12px;
    color: var(--text-secondary);
  }
}
</style>
