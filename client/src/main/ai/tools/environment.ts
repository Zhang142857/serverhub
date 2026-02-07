import { ToolDefinition, ToolContext, ToolResult } from './registry'

export const environmentTools: ToolDefinition[] = [
  {
    name: 'check_environment',
    displayName: '检查环境',
    description: '检查服务器上已安装的软件环境（如 Node.js, Python, Docker, Nginx 等）',
    category: 'system',
    dangerous: false,
    parameters: {
      type: 'object',
      properties: {
        software: { type: 'array', items: { type: 'string' }, description: '要检查的软件列表，如 ["node", "python", "docker"]。不指定则检查常见软件' }
      }
    },
    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const software = (params.software as string[]) || ['node', 'python3', 'java', 'go', 'docker', 'nginx', 'mysql', 'redis', 'git']
      const results: Record<string, { installed: boolean; version?: string }> = {}
      for (const sw of software) {
        try {
          const res = await context.executor.executeCommand(context.serverId, `which ${sw} 2>/dev/null && ${sw} --version 2>&1 | head -1`)
          results[sw] = res.exitCode === 0 && res.stdout?.trim()
            ? { installed: true, version: res.stdout.trim().split('\n').pop() }
            : { installed: false }
        } catch { results[sw] = { installed: false } }
      }
      const installed = Object.values(results).filter(r => r.installed).length
      return { success: true, data: results, message: `检查了 ${software.length} 个软件，已安装 ${installed} 个` }
    }
  },
  {
    name: 'install_software',
    displayName: '安装软件',
    description: '使用系统包管理器安装软件（支持 apt, yum, dnf, apk）',
    category: 'system',
    dangerous: true,
    parameters: {
      type: 'object',
      properties: {
        packages: { type: 'array', items: { type: 'string' }, description: '要安装的软件包列表' }
      },
      required: ['packages']
    },
    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const packages = params.packages as string[]
      const detect = await context.executor.executeCommand(context.serverId, 'which apt-get || which yum || which dnf || which apk')
      const pm = detect.stdout?.trim().split('/').pop()
      const cmds: Record<string, string> = {
        'apt-get': `apt-get update -qq && apt-get install -y ${packages.join(' ')}`,
        'yum': `yum install -y ${packages.join(' ')}`,
        'dnf': `dnf install -y ${packages.join(' ')}`,
        'apk': `apk add ${packages.join(' ')}`
      }
      const cmd = cmds[pm || '']
      if (!cmd) return { success: false, data: null, message: `未检测到支持的包管理器` }
      const res = await context.executor.executeCommand(context.serverId, cmd)
      return { success: res.exitCode === 0, data: { output: res.stdout }, message: res.exitCode === 0 ? `已安装: ${packages.join(', ')}` : res.stderr || '安装失败' }
    }
  },
  {
    name: 'manage_service',
    displayName: '管理服务',
    description: '管理系统服务（启动、停止、重启、查看状态）',
    category: 'system',
    dangerous: true,
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: '服务名称，如 nginx, mysql, docker' },
        action: { type: 'string', enum: ['start', 'stop', 'restart', 'status', 'enable', 'disable'], description: '操作类型' }
      },
      required: ['service', 'action']
    },
    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const { service, action } = params as { service: string; action: string }
      const res = await context.executor.executeCommand(context.serverId, `systemctl ${action} ${service} 2>&1 || service ${service} ${action} 2>&1`)
      return { success: res.exitCode === 0, data: { output: res.stdout }, message: res.exitCode === 0 ? `${service} ${action} 成功` : res.stderr || '操作失败' }
    }
  }
]
