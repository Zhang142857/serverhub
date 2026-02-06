/**
 * 网络工具定义
 * 包含 Ping、端口扫描、DNS 查询等工具
 */

import { ToolDefinition, ToolContext, ToolResult } from './registry'

// 验证函数
function validateHost(host: string): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  
  if (ipRegex.test(host)) {
    const parts = host.split('.').map(Number)
    return parts.every(part => part >= 0 && part <= 255)
  }
  return hostnameRegex.test(host) || host === 'localhost'
}

function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/**
 * Ping 测试工具
 */
export const pingTool: ToolDefinition = {
  name: 'ping',
  displayName: 'Ping 测试',
  description: '测试与目标主机的网络连通性，返回延迟和丢包率',
  category: 'network',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      host: {
        type: 'string',
        description: '目标主机（IP 或域名）',
        required: true
      },
      count: {
        type: 'number',
        description: 'Ping 次数',
        default: 4
      }
    },
    required: ['host']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const host = params.host as string
      const count = Math.min((params.count as number) || 4, 10)

      if (!host || !validateHost(host)) {
        return { success: false, error: '无效的主机地址' }
      }

      context.onProgress?.(`正在 Ping ${host}...`)

      const result = await context.executor.executeCommand(
        context.serverId,
        'ping',
        ['-c', String(count), '-W', '3', host]
      )

      // 解析 ping 结果
      const output = result.stdout + result.stderr
      const stats: {
        host: string
        transmitted: number
        received: number
        lossPercent: number
        minRtt: number
        avgRtt: number
        maxRtt: number
        reachable: boolean
      } = {
        host,
        transmitted: count,
        received: 0,
        lossPercent: 100,
        minRtt: 0,
        avgRtt: 0,
        maxRtt: 0,
        reachable: false
      }

      // 解析统计信息
      const statsMatch = output.match(/(\d+) packets transmitted, (\d+) (?:packets )?received, (\d+(?:\.\d+)?)% packet loss/)
      if (statsMatch) {
        stats.transmitted = parseInt(statsMatch[1])
        stats.received = parseInt(statsMatch[2])
        stats.lossPercent = parseFloat(statsMatch[3])
        stats.reachable = stats.received > 0
      }

      // 解析 RTT
      const rttMatch = output.match(/(?:rtt|round-trip) min\/avg\/max(?:\/mdev)? = ([\d.]+)\/([\d.]+)\/([\d.]+)/)
      if (rttMatch) {
        stats.minRtt = parseFloat(rttMatch[1])
        stats.avgRtt = parseFloat(rttMatch[2])
        stats.maxRtt = parseFloat(rttMatch[3])
      }

      return {
        success: true,
        data: {
          ...stats,
          rawOutput: output
        },
        message: stats.reachable
          ? `${host} 可达，平均延迟 ${stats.avgRtt.toFixed(2)}ms，丢包率 ${stats.lossPercent}%`
          : `${host} 不可达`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * 端口扫描工具
 */
export const portScanTool: ToolDefinition = {
  name: 'port_scan',
  displayName: '端口扫描',
  description: '扫描目标主机的指定端口，检查端口是否开放',
  category: 'network',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      host: {
        type: 'string',
        description: '目标主机（IP 或域名）',
        required: true
      },
      ports: {
        type: 'string',
        description: '端口范围（如 "80" 或 "80,443,8080" 或 "1-1000"）',
        required: true
      },
      timeout: {
        type: 'number',
        description: '超时时间（秒）',
        default: 2
      }
    },
    required: ['host', 'ports']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const host = params.host as string
      const portsStr = params.ports as string
      const timeout = Math.min((params.timeout as number) || 2, 10)

      if (!host || !validateHost(host)) {
        return { success: false, error: '无效的主机地址' }
      }

      // 解析端口
      const ports: number[] = []
      const portParts = portsStr.split(',')
      
      for (const part of portParts) {
        const trimmed = part.trim()
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map(Number)
          if (start && end && start <= end && start >= 1 && end <= 65535) {
            for (let p = start; p <= Math.min(end, start + 100); p++) {
              ports.push(p)
            }
          }
        } else {
          const port = parseInt(trimmed)
          if (validatePort(port)) {
            ports.push(port)
          }
        }
      }

      if (ports.length === 0) {
        return { success: false, error: '无效的端口范围' }
      }

      if (ports.length > 100) {
        return { success: false, error: '端口数量过多，最多扫描 100 个端口' }
      }

      context.onProgress?.(`扫描 ${host} 的 ${ports.length} 个端口...`)

      const openPorts: Array<{ port: number; service: string }> = []
      const closedPorts: number[] = []

      // 常见端口服务映射
      const serviceMap: Record<number, string> = {
        21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
        80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 465: 'SMTPS',
        587: 'Submission', 993: 'IMAPS', 995: 'POP3S', 3306: 'MySQL',
        3389: 'RDP', 5432: 'PostgreSQL', 6379: 'Redis', 8080: 'HTTP-Alt',
        8443: 'HTTPS-Alt', 27017: 'MongoDB'
      }

      // 使用 nc 或 timeout + bash 检查端口
      for (const port of ports) {
        const checkResult = await context.executor.executeCommand(
          context.serverId,
          'timeout',
          [String(timeout), 'bash', '-c', `echo > /dev/tcp/${host}/${port}`]
        )

        if (checkResult.exit_code === 0) {
          openPorts.push({
            port,
            service: serviceMap[port] || 'Unknown'
          })
        } else {
          closedPorts.push(port)
        }
      }

      return {
        success: true,
        data: {
          host,
          scannedPorts: ports.length,
          openPorts,
          closedPorts: closedPorts.length > 20 ? closedPorts.slice(0, 20) : closedPorts,
          openCount: openPorts.length,
          closedCount: closedPorts.length
        },
        message: `扫描完成：${openPorts.length} 个端口开放，${closedPorts.length} 个端口关闭`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * DNS 查询工具
 */
export const dnsLookupTool: ToolDefinition = {
  name: 'dns_lookup',
  displayName: 'DNS 查询',
  description: '查询域名的 DNS 记录，支持 A、AAAA、MX、NS、TXT、CNAME 等记录类型',
  category: 'network',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: '要查询的域名',
        required: true
      },
      type: {
        type: 'string',
        description: '记录类型',
        enum: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'ANY'],
        default: 'A'
      },
      server: {
        type: 'string',
        description: 'DNS 服务器（可选，默认使用系统 DNS）'
      }
    },
    required: ['domain']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const domain = params.domain as string
      const recordType = (params.type as string) || 'A'
      const server = params.server as string

      if (!domain) {
        return { success: false, error: '请指定域名' }
      }

      context.onProgress?.(`查询 ${domain} 的 ${recordType} 记录...`)

      const args = [domain, recordType]
      if (server && validateHost(server)) {
        args.push(`@${server}`)
      }

      // 尝试使用 dig
      let result = await context.executor.executeCommand(context.serverId, 'dig', ['+short', ...args])
      
      // 如果 dig 不可用，尝试 nslookup
      if (result.exit_code !== 0) {
        result = await context.executor.executeCommand(context.serverId, 'nslookup', ['-type=' + recordType, domain])
      }

      // 如果都不可用，尝试 host
      if (result.exit_code !== 0) {
        result = await context.executor.executeCommand(context.serverId, 'host', ['-t', recordType, domain])
      }

      const records = result.stdout.trim().split('\n').filter(line => line.trim())

      return {
        success: result.exit_code === 0,
        data: {
          domain,
          type: recordType,
          records,
          server: server || 'system default',
          rawOutput: result.stdout
        },
        message: records.length > 0
          ? `找到 ${records.length} 条 ${recordType} 记录`
          : `未找到 ${recordType} 记录`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * Traceroute 工具
 */
export const tracerouteTool: ToolDefinition = {
  name: 'traceroute',
  displayName: '路由追踪',
  description: '追踪到目标主机的网络路由路径',
  category: 'network',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      host: {
        type: 'string',
        description: '目标主机（IP 或域名）',
        required: true
      },
      maxHops: {
        type: 'number',
        description: '最大跳数',
        default: 20
      }
    },
    required: ['host']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const host = params.host as string
      const maxHops = Math.min((params.maxHops as number) || 20, 30)

      if (!host || !validateHost(host)) {
        return { success: false, error: '无效的主机地址' }
      }

      context.onProgress?.(`追踪到 ${host} 的路由...`)

      // 尝试 traceroute
      let result = await context.executor.executeCommand(
        context.serverId,
        'traceroute',
        ['-m', String(maxHops), '-w', '2', host]
      )

      // 如果 traceroute 不可用，尝试 tracepath
      if (result.exit_code !== 0) {
        result = await context.executor.executeCommand(
          context.serverId,
          'tracepath',
          ['-m', String(maxHops), host]
        )
      }

      // 解析路由跳数
      const hops: Array<{ hop: number; host: string; ip: string; rtt: string }> = []
      const lines = result.stdout.split('\n')
      
      for (const line of lines) {
        const hopMatch = line.match(/^\s*(\d+)\s+(.+)/)
        if (hopMatch) {
          const hopNum = parseInt(hopMatch[1])
          const rest = hopMatch[2]
          
          // 解析 IP 和 RTT
          const ipMatch = rest.match(/\(?([\d.]+)\)?/)
          const rttMatch = rest.match(/([\d.]+)\s*ms/)
          
          hops.push({
            hop: hopNum,
            host: rest.split(/\s+/)[0] || '*',
            ip: ipMatch ? ipMatch[1] : '*',
            rtt: rttMatch ? `${rttMatch[1]}ms` : '*'
          })
        }
      }

      return {
        success: true,
        data: {
          host,
          hops,
          totalHops: hops.length,
          rawOutput: result.stdout
        },
        message: `路由追踪完成，共 ${hops.length} 跳`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * 网络连接统计工具
 */
export const netstatTool: ToolDefinition = {
  name: 'netstat',
  displayName: '网络连接统计',
  description: '查看服务器的网络连接状态统计',
  category: 'network',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: '连接类型',
        enum: ['all', 'tcp', 'udp', 'listening'],
        default: 'all'
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const type = (params.type as string) || 'all'

      context.onProgress?.('获取网络连接统计...')

      // 使用 ss 命令（比 netstat 更快）
      const args = ['-n']
      switch (type) {
        case 'tcp':
          args.push('-t')
          break
        case 'udp':
          args.push('-u')
          break
        case 'listening':
          args.push('-l')
          break
        default:
          args.push('-a')
      }

      const result = await context.executor.executeCommand(context.serverId, 'ss', args)

      // 统计连接状态
      const stats: Record<string, number> = {
        ESTABLISHED: 0,
        TIME_WAIT: 0,
        CLOSE_WAIT: 0,
        LISTEN: 0,
        SYN_SENT: 0,
        SYN_RECV: 0,
        FIN_WAIT1: 0,
        FIN_WAIT2: 0,
        LAST_ACK: 0,
        CLOSING: 0
      }

      const lines = result.stdout.split('\n')
      for (const line of lines) {
        for (const state of Object.keys(stats)) {
          if (line.includes(state)) {
            stats[state]++
          }
        }
      }

      const totalConnections = Object.values(stats).reduce((a, b) => a + b, 0)

      return {
        success: true,
        data: {
          type,
          stats,
          totalConnections,
          rawOutput: result.stdout.split('\n').slice(0, 50).join('\n') // 只返回前50行
        },
        message: `共 ${totalConnections} 个连接，其中 ${stats.ESTABLISHED} 个已建立，${stats.LISTEN} 个监听中`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * 导出网络工具
 */
export const networkTools: ToolDefinition[] = [
  pingTool,
  portScanTool,
  dnsLookupTool,
  tracerouteTool,
  netstatTool
]
