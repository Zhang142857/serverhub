import { ToolDefinition, ToolContext, ToolResult } from './registry'

// 用户名验证：Linux 用户名规则
const VALID_USERNAME = /^[a-z_][a-z0-9_-]{0,31}$/
// Shell 路径验证：只允许绝对路径且不含特殊字符
const VALID_SHELL = /^\/[a-zA-Z0-9/_-]+$/

export const userTools: ToolDefinition[] = [
  {
    name: 'list_users',
    displayName: '列出用户',
    description: '列出系统用户列表（可登录的用户）',
    category: 'user',
    dangerous: true,
    parameters: { type: 'object', properties: {} },
    async execute(_params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const res = await ctx.executor.executeCommand(ctx.serverId, 'awk', ['-F:', '$7 !~ /(nologin|false)$/ {print $1":"$3":"$6":"$7}', '/etc/passwd'])
      const users = res.stdout?.trim().split('\n').map(line => {
        const [name, uid, home, shell] = line.split(':')
        return { name, uid, home, shell }
      }) || []
      return { success: true, data: users, message: `共 ${users.length} 个可登录用户` }
    }
  },
  {
    name: 'check_user_activity',
    displayName: '检查用户活动',
    description: '查看最近登录的用户和当前在线用户',
    category: 'user',
    dangerous: true,
    parameters: { type: 'object', properties: {} },
    async execute(_params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const [who, last] = await Promise.all([
        ctx.executor.executeCommand(ctx.serverId, 'who'),
        ctx.executor.executeCommand(ctx.serverId, 'last', ['-n', '10'])
      ])
      return { success: true, data: { online: who.stdout, recentLogins: last.stdout }, message: '用户活动信息' }
    }
  },
  {
    name: 'manage_user',
    displayName: '管理用户',
    description: '创建、删除用户或修改用户密码',
    category: 'user',
    dangerous: true,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'delete', 'lock', 'unlock'], description: '操作类型' },
        username: { type: 'string', description: '用户名' },
        shell: { type: 'string', description: '登录 shell（仅创建时有效）' }
      },
      required: ['action', 'username']
    },
    async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const { action, username, shell = '/bin/bash' } = params as any

      // 安全修复：验证用户名，防止命令注入
      if (!VALID_USERNAME.test(username)) {
        return { success: false, data: null, message: '用户名格式无效（只允许小写字母、数字、下划线、连字符，最长32位）' }
      }
      if (action === 'create' && !VALID_SHELL.test(shell)) {
        return { success: false, data: null, message: 'Shell 路径格式无效' }
      }

      // 使用 command + args 形式，避免字符串拼接
      const cmds: Record<string, [string, string[]]> = {
        create: ['useradd', ['-m', '-s', shell, username]],
        delete: ['userdel', ['-r', username]],
        lock: ['usermod', ['-L', username]],
        unlock: ['usermod', ['-U', username]]
      }
      const entry = cmds[action]
      if (!entry) return { success: false, data: null, message: `未知操作: ${action}` }

      const res = await ctx.executor.executeCommand(ctx.serverId, entry[0], entry[1], { sudo: true })
      return { success: res.exitCode === 0, data: { action, username }, message: res.exitCode === 0 ? `${action} ${username} 成功` : res.stderr || '操作失败' }
    }
  }
]
