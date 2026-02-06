/**
 * 监控诊断工具定义
 * 包含系统诊断、日志分析、安全扫描等工具
 */

import { ToolDefinition, ToolContext, ToolResult } from './registry'

// 验证函数
function validateLogPath(path: string): boolean {
  if (!path || path.includes('..')) return false
  const allowedPaths = ['/var/log', '/opt', '/home', '/tmp', '/var/www']
  return path.startsWith('/') && allowedPaths.some(allowed => path.startsWith(allowed))
}

function validateRegexPattern(pattern: string): { valid: boolean; error?: string } {
  if (pattern.length > 200) {
    return { valid: false, error: '正则表达式过长（最多 200 字符）' }
  }
  // 检查危险模式（可能导致 ReDoS）
  const dangerousPatterns = [/(\*\+|\+\*|\*\*|\+\+)/, /\(\.\*\)\+/, /\(\.\+\)\*/]
  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      return { valid: false, error: '正则表达式包含危险模式' }
    }
  }
  try {
    new RegExp(pattern)
    return { valid: true }
  } catch {
    return { valid: false, error: '无效的正则表达式' }
  }
}

function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/**
 * 智能系统诊断工具
 */
export const diagnoseSystemTool: ToolDefinition = {
  name: 'diagnose_system',
  displayName: '智能系统诊断',
  description: '自动诊断系统问题，分析 CPU、内存、磁盘、网络状态，识别异常并提供解决建议',
  category: 'monitoring',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      focus: {
        type: 'string',
        description: '诊断重点（可选）',
        enum: ['cpu', 'memory', 'disk', 'network', 'all'],
        default: 'all'
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const focus = (params.focus as string) || 'all'
      const issues: Array<{ level: string; category: string; message: string; suggestion: string }> = []
      const metrics: Record<string, unknown> = {}

      context.onProgress?.('收集系统信息...')

      // 获取系统信息
      const sysInfo = await context.executor.getSystemInfo(context.serverId)
      metrics.system = sysInfo

      // CPU 诊断
      if (focus === 'all' || focus === 'cpu') {
        context.onProgress?.('分析 CPU 使用情况...')
        if (sysInfo.cpu.usage > 90) {
          issues.push({
            level: 'critical',
            category: 'cpu',
            message: `CPU 使用率过高: ${sysInfo.cpu.usage.toFixed(1)}%`,
            suggestion: '检查高 CPU 进程，考虑优化或扩容'
          })
        } else if (sysInfo.cpu.usage > 70) {
          issues.push({
            level: 'warning',
            category: 'cpu',
            message: `CPU 使用率较高: ${sysInfo.cpu.usage.toFixed(1)}%`,
            suggestion: '关注 CPU 使用趋势，准备扩容方案'
          })
        }

        // 获取高 CPU 进程
        const topResult = await context.executor.executeCommand(
          context.serverId, 'ps', ['aux', '--sort=-pcpu']
        )
        if (topResult.exit_code === 0) {
          const lines = topResult.stdout.split('\n').slice(1, 6)
          metrics.topCpuProcesses = lines.map(line => {
            const parts = line.trim().split(/\s+/)
            return { user: parts[0], pid: parts[1], cpu: parts[2], command: parts.slice(10).join(' ') }
          })
        }
      }

      // 内存诊断
      if (focus === 'all' || focus === 'memory') {
        context.onProgress?.('分析内存使用情况...')
        if (sysInfo.memory.usedPercent > 90) {
          issues.push({
            level: 'critical',
            category: 'memory',
            message: `内存使用率过高: ${sysInfo.memory.usedPercent.toFixed(1)}%`,
            suggestion: '检查内存泄漏，考虑增加内存或优化应用'
          })
        } else if (sysInfo.memory.usedPercent > 80) {
          issues.push({
            level: 'warning',
            category: 'memory',
            message: `内存使用率较高: ${sysInfo.memory.usedPercent.toFixed(1)}%`,
            suggestion: '关注内存使用趋势，准备扩容方案'
          })
        }

        // 获取高内存进程
        const memResult = await context.executor.executeCommand(
          context.serverId, 'ps', ['aux', '--sort=-pmem']
        )
        if (memResult.exit_code === 0) {
          const lines = memResult.stdout.split('\n').slice(1, 6)
          metrics.topMemProcesses = lines.map(line => {
            const parts = line.trim().split(/\s+/)
            return { user: parts[0], pid: parts[1], mem: parts[3], command: parts.slice(10).join(' ') }
          })
        }
      }

      // 磁盘诊断
      if (focus === 'all' || focus === 'disk') {
        context.onProgress?.('分析磁盘使用情况...')
        for (const disk of sysInfo.disks || []) {
          if (disk.usedPercent > 90) {
            issues.push({
              level: 'critical',
              category: 'disk',
              message: `磁盘 ${disk.mountpoint} 使用率过高: ${disk.usedPercent.toFixed(1)}%`,
              suggestion: '清理磁盘空间或扩容'
            })
          } else if (disk.usedPercent > 80) {
            issues.push({
              level: 'warning',
              category: 'disk',
              message: `磁盘 ${disk.mountpoint} 使用率较高: ${disk.usedPercent.toFixed(1)}%`,
              suggestion: '关注磁盘使用趋势，准备清理或扩容'
            })
          }
        }

        // 检查 inode 使用
        const inodeResult = await context.executor.executeCommand(context.serverId, 'df', ['-i'])
        metrics.inodeUsage = inodeResult.stdout
      }

      // 网络诊断
      if (focus === 'all' || focus === 'network') {
        context.onProgress?.('分析网络状态...')
        
        // 检查网络连接数
        const connResult = await context.executor.executeCommand(
          context.serverId, 'bash', ['-c', 'ss -s']
        )
        metrics.networkConnections = connResult.stdout

        // 检查 TIME_WAIT 连接
        const twResult = await context.executor.executeCommand(
          context.serverId, 'bash', ['-c', "ss -ant | grep TIME-WAIT | wc -l"]
        )
        const timeWaitCount = parseInt(twResult.stdout.trim()) || 0
        if (timeWaitCount > 1000) {
          issues.push({
            level: 'warning',
            category: 'network',
            message: `TIME_WAIT 连接数过多: ${timeWaitCount}`,
            suggestion: '考虑优化 TCP 参数或检查连接泄漏'
          })
        }
        metrics.timeWaitConnections = timeWaitCount
      }

      // 检查系统负载
      context.onProgress?.('检查系统负载...')
      const loadResult = await context.executor.executeCommand(context.serverId, 'cat', ['/proc/loadavg'])
      if (loadResult.exit_code === 0) {
        const loads = loadResult.stdout.trim().split(' ')
        const load1 = parseFloat(loads[0])
        const cpuCores = sysInfo.cpu.cores || 1
        metrics.loadAverage = { load1: loads[0], load5: loads[1], load15: loads[2] }
        
        if (load1 > cpuCores * 2) {
          issues.push({
            level: 'critical',
            category: 'load',
            message: `系统负载过高: ${load1} (CPU核心数: ${cpuCores})`,
            suggestion: '检查高负载进程，考虑优化或扩容'
          })
        } else if (load1 > cpuCores) {
          issues.push({
            level: 'warning',
            category: 'load',
            message: `系统负载较高: ${load1} (CPU核心数: ${cpuCores})`,
            suggestion: '关注系统负载趋势'
          })
        }
      }

      // 生成诊断报告
      const criticalCount = issues.filter(i => i.level === 'critical').length
      const warningCount = issues.filter(i => i.level === 'warning').length
      
      let healthScore = 100
      healthScore -= criticalCount * 20
      healthScore -= warningCount * 5
      healthScore = Math.max(0, healthScore)

      const summary = {
        healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
        criticalIssues: criticalCount,
        warningIssues: warningCount,
        checkedAt: new Date().toISOString()
      }

      return {
        success: true,
        data: { summary, issues, metrics },
        message: criticalCount > 0 
          ? `发现 ${criticalCount} 个严重问题，${warningCount} 个警告，健康评分: ${healthScore}`
          : warningCount > 0
          ? `发现 ${warningCount} 个警告，健康评分: ${healthScore}`
          : `系统状态良好，健康评分: ${healthScore}`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * 日志分析工具
 */
export const analyzeLogsTool: ToolDefinition = {
  name: 'analyze_logs',
  displayName: '智能日志分析',
  description: '分析日志文件，自动识别错误、警告和异常模式',
  category: 'monitoring',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      logPath: {
        type: 'string',
        description: '日志文件路径',
        required: true
      },
      lines: {
        type: 'number',
        description: '分析的行数',
        default: 500
      },
      pattern: {
        type: 'string',
        description: '自定义搜索模式（正则表达式）'
      }
    },
    required: ['logPath']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const logPath = params.logPath as string
      const lines = (params.lines as number) || 500
      const pattern = params.pattern as string

      // 验证日志路径
      if (!logPath || !validateLogPath(logPath)) {
        return { success: false, error: '无效的日志文件路径，只允许访问 /var/log、/opt、/home 等目录' }
      }

      // 验证正则表达式
      if (pattern) {
        const validation = validateRegexPattern(pattern)
        if (!validation.valid) {
          return { success: false, error: `正则表达式验证失败: ${validation.error}` }
        }
      }

      context.onProgress?.('读取日志文件...')

      const tailResult = await context.executor.executeCommand(
        context.serverId, 'tail', ['-n', String(lines), logPath]
      )

      if (tailResult.exit_code !== 0) {
        return { success: false, error: `读取日志失败: ${tailResult.stderr}` }
      }

      const logContent = tailResult.stdout
      const logLines = logContent.split('\n').filter(Boolean)

      context.onProgress?.('分析日志内容...')

      const errors: string[] = []
      const warnings: string[] = []
      const patternMatches: Record<string, number> = {}

      const errorPatterns = [/error/i, /exception/i, /failed/i, /fatal/i, /critical/i, /panic/i]
      const warningPatterns = [/warning/i, /warn/i, /deprecated/i]

      for (const line of logLines) {
        for (const ep of errorPatterns) {
          if (ep.test(line)) {
            errors.push(line.substring(0, 200))
            break
          }
        }
        for (const wp of warningPatterns) {
          if (wp.test(line) && !errorPatterns.some(ep => ep.test(line))) {
            warnings.push(line.substring(0, 200))
            break
          }
        }
        if (pattern) {
          const regex = new RegExp(pattern, 'gi')
          const matches = line.match(regex)
          if (matches) {
            for (const m of matches) {
              patternMatches[m] = (patternMatches[m] || 0) + 1
            }
          }
        }
      }

      const suggestions: string[] = []
      if (errors.length > 0) {
        suggestions.push(`发现 ${errors.length} 个错误，建议立即处理`)
        if (errors.some(e => /out of memory/i.test(e))) {
          suggestions.push('检测到内存不足错误，建议增加内存或优化应用')
        }
        if (errors.some(e => /connection refused|timeout/i.test(e))) {
          suggestions.push('检测到连接错误，建议检查网络和服务状态')
        }
      }

      return {
        success: true,
        data: {
          totalLines: logLines.length,
          errorCount: errors.length,
          warningCount: warnings.length,
          recentErrors: errors.slice(-10),
          recentWarnings: warnings.slice(-10),
          patternMatches,
          suggestions
        },
        message: `分析完成：${logLines.length} 行，${errors.length} 个错误，${warnings.length} 个警告`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * 安全扫描工具
 */
export const securityScanTool: ToolDefinition = {
  name: 'security_scan',
  displayName: '安全扫描',
  description: '扫描服务器安全配置，检查开放端口、SSH配置、防火墙状态等',
  category: 'monitoring',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        description: '扫描范围',
        enum: ['quick', 'full'],
        default: 'quick'
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const scope = (params.scope as string) || 'quick'
      const findings: Array<{ level: string; category: string; message: string; suggestion: string }> = []

      context.onProgress?.('开始安全扫描...')

      // 检查开放端口
      context.onProgress?.('检查开放端口...')
      const portsResult = await context.executor.executeCommand(
        context.serverId, 'bash', ['-c', 'ss -tlnp']
      )
      const openPorts = portsResult.stdout.split('\n').slice(1).filter(Boolean)
      
      const riskyPorts = [21, 23, 25, 110, 143, 3389]
      for (const line of openPorts) {
        for (const port of riskyPorts) {
          if (line.includes(`:${port} `) || line.includes(`:${port}\t`)) {
            findings.push({
              level: 'warning',
              category: 'ports',
              message: `检测到高风险端口 ${port} 开放`,
              suggestion: `考虑关闭端口 ${port} 或限制访问`
            })
          }
        }
      }

      // 检查 SSH 配置
      context.onProgress?.('检查 SSH 配置...')
      const sshResult = await context.executor.executeCommand(
        context.serverId, 'cat', ['/etc/ssh/sshd_config']
      )
      if (sshResult.exit_code === 0) {
        const sshConfig = sshResult.stdout
        if (sshConfig.includes('PermitRootLogin yes')) {
          findings.push({
            level: 'warning',
            category: 'ssh',
            message: 'SSH 允许 root 直接登录',
            suggestion: '建议设置 PermitRootLogin no 或 prohibit-password'
          })
        }
        if (sshConfig.includes('PasswordAuthentication yes')) {
          findings.push({
            level: 'info',
            category: 'ssh',
            message: 'SSH 允许密码认证',
            suggestion: '建议使用密钥认证并禁用密码认证'
          })
        }
        if (!sshConfig.includes('Port ') || sshConfig.includes('Port 22')) {
          findings.push({
            level: 'info',
            category: 'ssh',
            message: 'SSH 使用默认端口 22',
            suggestion: '考虑更改 SSH 端口以减少暴力破解尝试'
          })
        }
      }

      // 检查防火墙状态
      context.onProgress?.('检查防火墙状态...')
      const ufwResult = await context.executor.executeCommand(context.serverId, 'ufw', ['status'])
      const iptablesResult = await context.executor.executeCommand(
        context.serverId, 'iptables', ['-L', '-n']
      )
      
      if (ufwResult.stdout.includes('inactive') && 
          (!iptablesResult.stdout || iptablesResult.stdout.includes('ACCEPT     all'))) {
        findings.push({
          level: 'warning',
          category: 'firewall',
          message: '防火墙未启用或规则过于宽松',
          suggestion: '建议启用防火墙并配置适当的规则'
        })
      }

      // 完整扫描额外检查
      if (scope === 'full') {
        // 检查系统更新
        context.onProgress?.('检查系统更新...')
        const updateResult = await context.executor.executeCommand(
          context.serverId, 'bash', ['-c', 'apt list --upgradable 2>/dev/null | wc -l']
        )
        const upgradable = parseInt(updateResult.stdout.trim()) - 1
        if (upgradable > 10) {
          findings.push({
            level: 'warning',
            category: 'updates',
            message: `有 ${upgradable} 个软件包可更新`,
            suggestion: '建议定期更新系统软件包'
          })
        }

        // 检查失败的登录尝试
        context.onProgress?.('检查登录尝试...')
        const authResult = await context.executor.executeCommand(
          context.serverId, 'bash', ['-c', 'grep "Failed password" /var/log/auth.log 2>/dev/null | tail -100 | wc -l']
        )
        const failedLogins = parseInt(authResult.stdout.trim()) || 0
        if (failedLogins > 50) {
          findings.push({
            level: 'warning',
            category: 'auth',
            message: `检测到 ${failedLogins} 次失败的登录尝试`,
            suggestion: '考虑安装 fail2ban 或检查是否有暴力破解攻击'
          })
        }
      }

      const criticalCount = findings.filter(f => f.level === 'critical').length
      const warningCount = findings.filter(f => f.level === 'warning').length
      
      let securityScore = 100
      securityScore -= criticalCount * 25
      securityScore -= warningCount * 10
      securityScore = Math.max(0, securityScore)

      return {
        success: true,
        data: {
          securityScore,
          status: securityScore >= 80 ? 'good' : securityScore >= 60 ? 'fair' : 'poor',
          findings,
          openPortsCount: openPorts.length,
          scannedAt: new Date().toISOString()
        },
        message: `安全扫描完成，评分: ${securityScore}，发现 ${findings.length} 个问题`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * 端口检查工具
 */
export const checkPortTool: ToolDefinition = {
  name: 'check_port',
  displayName: '检查端口',
  description: '检查指定端口是否被占用，显示占用进程信息',
  category: 'monitoring',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      port: {
        type: 'number',
        description: '端口号',
        required: true
      }
    },
    required: ['port']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const port = params.port as number

      // 验证端口号
      if (!validatePort(port)) {
        return { success: false, error: '无效的端口号，必须是 1-65535 之间的整数' }
      }

      const result = await context.executor.executeCommand(
        context.serverId, 'ss', ['-tlnp']
      )

      if (result.exit_code !== 0) {
        return { success: false, error: `检查端口失败: ${result.stderr}` }
      }

      const portPattern = new RegExp(`:${port}\\s`)
      if (!portPattern.test(result.stdout)) {
        return {
          success: true,
          data: { port, inUse: false, available: true },
          message: `端口 ${port} 未被占用，可以使用`
        }
      }

      // 解析占用信息
      const lines = result.stdout.split('\n').filter(line => portPattern.test(line))
      const processes: Array<{ protocol: string; address: string; process: string }> = []
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 6) {
          processes.push({
            protocol: parts[0],
            address: parts[4],
            process: parts[6] || 'unknown'
          })
        }
      }

      return {
        success: true,
        data: { port, inUse: true, available: false, processes },
        message: `端口 ${port} 已被占用: ${processes.map(p => p.process).join(', ')}`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * 导出监控工具
 */
export const monitoringTools: ToolDefinition[] = [
  diagnoseSystemTool,
  analyzeLogsTool,
  securityScanTool,
  checkPortTool
]
