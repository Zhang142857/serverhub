import { z } from 'zod'
import type { ToolDefinition } from '../gateway'

export const environmentTools: ToolDefinition[] = [
  {
    name: 'check_environment',
    displayName: '检查环境',
    description: '检查服务器上已安装的软件环境（如 Node.js, Python, Docker, Nginx 等）',
    category: 'environment',
    dangerous: false,
    parameters: z.object({
      software: z.array(z.string()).optional().describe('要检查的软件列表，如 ["node", "python", "docker"]。不指定则检查常见软件')
    }),
    async execute({ software }, { serverId, grpcClient }) {
      const commonSoftware = software || ['node', 'python', 'python3', 'java', 'go', 'rust', 'docker', 'nginx', 'mysql', 'postgresql', 'redis', 'git', 'curl', 'wget']
      const results: Record<string, { installed: boolean; version?: string; path?: string }> = {}

      for (const sw of commonSoftware) {
        try {
          const checkCmd = `which ${sw} && ${sw} --version 2>&1 | head -1`
          const res = await grpcClient.executeCommand(checkCmd)
          
          if (res.exitCode === 0 && res.stdout) {
            const lines = res.stdout.trim().split('\n')
            results[sw] = {
              installed: true,
              version: lines[lines.length - 1],
              path: lines[0]
            }
          } else {
            results[sw] = { installed: false }
          }
        } catch {
          results[sw] = { installed: false }
        }
      }

      return {
        success: true,
        environment: results,
        summary: `检查了 ${commonSoftware.length} 个软件，已安装 ${Object.values(results).filter(r => r.installed).length} 个`
      }
    }
  },

  {
    name: 'install_software',
    displayName: '安装软件',
    description: '使用系统包管理器安装软件（支持 apt, yum, dnf, apk）',
    category: 'environment',
    dangerous: true,
    parameters: z.object({
      packages: z.array(z.string()).describe('要安装的软件包列表'),
      update_cache: z.boolean().optional().describe('是否先更新包缓存（默认 true）')
    }),
    async execute({ packages, update_cache = true }, { serverId, grpcClient }) {
      // 检测包管理器
      const detectPM = await grpcClient.executeCommand('which apt-get || which yum || which dnf || which apk')
      if (detectPM.exitCode !== 0) {
        return { success: false, error: '未检测到支持的包管理器' }
      }

      const pm = detectPM.stdout.trim().split('/').pop()
      let installCmd = ''

      switch (pm) {
        case 'apt-get':
          if (update_cache) await grpcClient.executeCommand('apt-get update')
          installCmd = `apt-get install -y ${packages.join(' ')}`
          break
        case 'yum':
          installCmd = `yum install -y ${packages.join(' ')}`
          break
        case 'dnf':
          installCmd = `dnf install -y ${packages.join(' ')}`
          break
        case 'apk':
          if (update_cache) await grpcClient.executeCommand('apk update')
          installCmd = `apk add ${packages.join(' ')}`
          break
        default:
          return { success: false, error: `不支持的包管理器: ${pm}` }
      }

      const result = await grpcClient.executeCommand(installCmd)
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.exitCode !== 0 ? result.stderr : undefined,
        installed: packages
      }
    }
  },

  {
    name: 'manage_service',
    displayName: '管理服务',
    description: '管理系统服务（启动、停止、重启、查看状态）',
    category: 'environment',
    dangerous: true,
    parameters: z.object({
      service: z.string().describe('服务名称，如 nginx, mysql, docker'),
      action: z.enum(['start', 'stop', 'restart', 'status', 'enable', 'disable']).describe('操作类型')
    }),
    async execute({ service, action }, { serverId, grpcClient }) {
      // 检测服务管理器
      const detectSM = await grpcClient.executeCommand('which systemctl || which service')
      const useSystemctl = detectSM.stdout.includes('systemctl')

      let cmd = ''
      if (useSystemctl) {
        cmd = `systemctl ${action} ${service}`
      } else {
        // 旧版 service 命令
        const actionMap: Record<string, string> = {
          start: 'start',
          stop: 'stop',
          restart: 'restart',
          status: 'status',
          enable: 'start', // 近似
          disable: 'stop'
        }
        cmd = `service ${service} ${actionMap[action]}`
      }

      const result = await grpcClient.executeCommand(cmd)

      return {
        success: result.exitCode === 0,
        service,
        action,
        output: result.stdout,
        error: result.exitCode !== 0 ? result.stderr : undefined
      }
    }
  },

  {
    name: 'setup_environment',
    displayName: '配置开发环境',
    description: '一键配置常见开发环境（Node.js, Python, Docker 等）',
    category: 'environment',
    dangerous: true,
    parameters: z.object({
      environment: z.enum(['nodejs', 'python', 'docker', 'nginx', 'full-stack']).describe('环境类型'),
      version: z.string().optional().describe('指定版本，如 "18" for Node.js')
    }),
    async execute({ environment, version }, { serverId, grpcClient }) {
      const steps: string[] = []
      const results: string[] = []

      switch (environment) {
        case 'nodejs':
          steps.push('安装 Node.js 和 npm')
          const nodeCmd = version 
            ? `curl -fsSL https://deb.nodesource.com/setup_${version}.x | bash - && apt-get install -y nodejs`
            : 'apt-get install -y nodejs npm'
          const nodeRes = await grpcClient.executeCommand(nodeCmd)
          results.push(nodeRes.exitCode === 0 ? '✓ Node.js 安装成功' : '✗ Node.js 安装失败')
          break

        case 'python':
          steps.push('安装 Python 和 pip')
          const pyCmd = version
            ? `apt-get install -y python${version} python${version}-pip`
            : 'apt-get install -y python3 python3-pip'
          const pyRes = await grpcClient.executeCommand(pyCmd)
          results.push(pyRes.exitCode === 0 ? '✓ Python 安装成功' : '✗ Python 安装失败')
          break

        case 'docker':
          steps.push('安装 Docker')
          const dockerCmd = 'curl -fsSL https://get.docker.com | sh && systemctl enable docker && systemctl start docker'
          const dockerRes = await grpcClient.executeCommand(dockerCmd)
          results.push(dockerRes.exitCode === 0 ? '✓ Docker 安装成功' : '✗ Docker 安装失败')
          break

        case 'nginx':
          steps.push('安装 Nginx')
          const nginxCmd = 'apt-get install -y nginx && systemctl enable nginx && systemctl start nginx'
          const nginxRes = await grpcClient.executeCommand(nginxCmd)
          results.push(nginxRes.exitCode === 0 ? '✓ Nginx 安装成功' : '✗ Nginx 安装失败')
          break

        case 'full-stack':
          steps.push('安装完整开发环境（Node.js, Python, Docker, Nginx, Git）')
          const fullCmd = 'apt-get update && apt-get install -y nodejs npm python3 python3-pip git nginx && curl -fsSL https://get.docker.com | sh'
          const fullRes = await grpcClient.executeCommand(fullCmd)
          results.push(fullRes.exitCode === 0 ? '✓ 完整环境安装成功' : '✗ 部分安装失败')
          break
      }

      return {
        success: true,
        environment,
        steps,
        results
      }
    }
  }
]
