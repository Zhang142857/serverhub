<template>
  <div class="ai-ops-page">
    <!-- 顶部 -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </div>
        <div>
          <h2>AI 运维</h2>
          <p class="subtitle">智能运维代理，自动巡检、诊断和修复服务器问题</p>
        </div>
      </div>
      <div class="header-right">
        <el-select v-model="selectedServer" placeholder="选择服务器" size="default" clearable style="width: 180px">
          <el-option v-for="s in connectedServers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
    </div>

    <div class="ops-body">
      <!-- 无服务器 -->
      <div v-if="!selectedServer" class="empty-state">
        <el-icon :size="48" color="var(--text-muted)"><Monitor /></el-icon>
        <p>请先选择一个已连接的服务器</p>
      </div>

      <template v-else>
        <!-- 技能卡片区 -->
        <div class="skills-section">
          <h3>运维技能</h3>
          <div class="skills-grid">
            <div v-for="skill in skills" :key="skill.id" class="skill-card" :class="{ active: activeSkill === skill.id }" @click="runSkill(skill)">
              <div class="skill-icon" v-html="skill.svg"></div>
              <div class="skill-info">
                <div class="skill-name">{{ skill.name }}</div>
                <div class="skill-desc">{{ skill.desc }}</div>
              </div>
              <el-tag v-if="skill.auto" size="small" type="success" effect="plain">自动</el-tag>
            </div>
          </div>
        </div>

        <!-- 自定义指令 -->
        <div class="custom-section">
          <div class="custom-input">
            <el-input v-model="customPrompt" placeholder="输入自定义运维指令，例如：检查为什么 Nginx 返回 502" @keydown.enter="runCustom">
              <template #append>
                <el-button :loading="running" @click="runCustom"><el-icon><Promotion /></el-icon></el-button>
              </template>
            </el-input>
          </div>
        </div>

        <!-- 执行结果区 -->
        <div v-if="results.length > 0" class="results-section">
          <div class="results-header">
            <h3>执行结果</h3>
            <el-button text size="small" @click="results = []">清空</el-button>
          </div>
          <div class="results-list">
            <div v-for="(r, i) in results" :key="i" class="result-card" :class="r.status">
              <div class="result-header">
                <span class="result-title">{{ r.title }}</span>
                <el-tag :type="r.status === 'success' ? 'success' : r.status === 'error' ? 'danger' : 'warning'" size="small">
                  {{ r.status === 'success' ? '正常' : r.status === 'error' ? '异常' : '运行中' }}
                </el-tag>
              </div>
              <div class="result-content" v-html="formatContent(r.content)"></div>
              <div v-if="r.suggestions?.length" class="result-suggestions">
                <div class="suggestion-title">建议操作：</div>
                <div v-for="(s, j) in r.suggestions" :key="j" class="suggestion-item" @click="customPrompt = s; runCustom()">
                  <el-icon><Promotion /></el-icon> {{ s }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useServerStore } from '@/stores/server'
import { useAIStore } from '@/stores/ai'
import { Monitor, Promotion } from '@element-plus/icons-vue'

const serverStore = useServerStore()
const aiStore = useAIStore()

const selectedServer = ref<string | null>(serverStore.currentServerId)
const customPrompt = ref('')
const running = ref(false)
const isProcessing = ref(false)
const activeSkill = ref('')
const results = ref<Array<{ title: string; status: string; content: string; suggestions?: string[] }>>([])

const connectedServers = computed(() => serverStore.connectedServers)

const skills = [
  { id: 'health', name: '健康巡检', desc: '全面检查 CPU、内存、磁盘、网络状态', prompt: '对服务器进行全面健康巡检，检查 CPU、内存、磁盘、网络，给出健康评分', auto: true,
    svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' },
  { id: 'security', name: '安全扫描', desc: '检查端口、用户、SSH 配置、防火墙', prompt: '执行安全扫描：检查开放端口、用户权限、SSH 配置、防火墙规则，给出安全评分', auto: true,
    svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L4 6v5c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6L12 2z"/></svg>' },
  { id: 'performance', name: '性能分析', desc: '分析系统瓶颈，找出高负载进程', prompt: '分析服务器性能瓶颈，检查高 CPU/内存进程、IO 等待、网络延迟', auto: false,
    svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>' },
  { id: 'logs', name: '日志诊断', desc: '智能分析系统日志中的错误和警告', prompt: '分析系统日志（syslog、dmesg、journalctl），找出最近的错误和警告，给出诊断', auto: false,
    svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>' },
  { id: 'docker', name: '容器巡检', desc: '检查 Docker 容器状态、资源占用', prompt: '检查所有 Docker 容器状态、资源占用、异常重启，给出容器健康报告', auto: true,
    svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="10" width="20" height="8" rx="2"/><rect x="5" y="6" width="4" height="4" rx="0.5"/><rect x="10" y="6" width="4" height="4" rx="0.5"/></svg>' },
  { id: 'cleanup', name: '系统清理', desc: '清理日志、临时文件、无用镜像', prompt: '检查可清理的磁盘空间：旧日志、临时文件、无用 Docker 镜像，列出可释放空间但不要自动删除', auto: false,
    svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>' },
]

function formatContent(content: string): string {
  return escapeHtml(content)
    .replace(/\n/g, '<br>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function runSkill(skill: typeof skills[0]) {
  activeSkill.value = skill.id
  await executeOps(skill.name, skill.prompt)
  activeSkill.value = ''
}

async function runCustom() {
  const prompt = customPrompt.value.trim()
  if (!prompt || running.value) return
  customPrompt.value = ''
  await executeOps('自定义指令', prompt)
}

async function executeOps(title: string, prompt: string) {
  if (!selectedServer.value || running.value) return
  running.value = true

  const result: typeof results.value[0] = { title, status: 'running', content: '正在执行...', suggestions: [] }
  results.value.unshift(result)

  try {
    if (!aiStore.currentConversation) {
      await aiStore.createConversation({ agentId: 'diagnostics', serverId: selectedServer.value })
    }
    
    await aiStore.addMessage({ role: 'user', content: prompt })
    isProcessing.value = true

    let fullResponse = ''
    const response = await window.electronAPI.ai.chat(prompt, {
      serverId: selectedServer.value
    })
    
    fullResponse = response
    result.content = fullResponse

    result.status = fullResponse.includes('异常') || fullResponse.includes('错误') || fullResponse.includes('失败') ? 'error' : 'success'
    result.content = fullResponse || '执行完成'

    const lines = fullResponse.split('\n')
    result.suggestions = lines
      .filter(l => /^[-•]\s*建议|^[-•]\s*推荐|^[-•]\s*可以/.test(l.trim()))
      .map(l => l.replace(/^[-•]\s*/, '').trim())
      .slice(0, 3)
  } catch (e) {
    result.status = 'error'
    result.content = `执行失败: ${(e as Error).message}`
  } finally {
    running.value = false
    isProcessing.value = false
  }
}
</script>

<style lang="scss" scoped>
.ai-ops-page { height: 100%; display: flex; flex-direction: column; background: var(--bg-color); }

.page-header {
  padding: 20px 28px; display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid var(--border-color); background: var(--bg-secondary);
  .header-left { display: flex; align-items: center; gap: 14px; }
  .header-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: linear-gradient(135deg, #f59e0b, #ef4444);
    color: #fff; display: flex; align-items: center; justify-content: center;
  }
  h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .subtitle { margin: 2px 0 0; font-size: 13px; color: var(--text-secondary); }
}

.ops-body { flex: 1; overflow-y: auto; padding: 24px 28px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 300px; gap: 12px; color: var(--text-muted); font-size: 14px;
}

.skills-section {
  margin-bottom: 24px;
  h3 { font-size: 15px; font-weight: 600; margin: 0 0 14px; }
}
.skills-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.skill-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
  transition: all 0.2s;
  &:hover { border-color: var(--primary-color); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  &.active { border-color: #f59e0b; background: rgba(245, 158, 11, 0.05); }
  .skill-icon { color: #f59e0b; flex-shrink: 0; }
  .skill-info { flex: 1; min-width: 0; }
  .skill-name { font-size: 13px; font-weight: 600; }
  .skill-desc { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
}

.custom-section { margin-bottom: 24px; }
.custom-input { max-width: 700px; }

.results-section {
  .results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  h3 { font-size: 15px; font-weight: 600; margin: 0; }
}
.results-list { display: flex; flex-direction: column; gap: 12px; }
.result-card {
  border: 1px solid var(--border-color); border-radius: 10px;
  background: var(--bg-secondary); overflow: hidden;
  &.success { border-left: 3px solid #10b981; }
  &.error { border-left: 3px solid #ef4444; }
  &.running { border-left: 3px solid #f59e0b; }
  .result-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--border-color);
    .result-title { font-size: 14px; font-weight: 600; }
  }
  .result-content {
    padding: 14px 16px; font-size: 13px; line-height: 1.7; color: var(--text-color);
    max-height: 300px; overflow-y: auto;
    code { background: var(--bg-tertiary); padding: 1px 5px; border-radius: 3px; font-size: 12px; }
  }
  .result-suggestions {
    padding: 10px 16px; border-top: 1px solid var(--border-color); background: var(--bg-tertiary);
    .suggestion-title { font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text-secondary); }
    .suggestion-item {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: var(--primary-color); cursor: pointer;
      padding: 3px 0; &:hover { text-decoration: underline; }
    }
  }
}
</style>
