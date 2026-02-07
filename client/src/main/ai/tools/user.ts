import { ToolDefinition, ToolContext, ToolResult } from './registry'

export const userTools: ToolDefinition[] = [
  {
    name: 'list_users',
    displayName: '列出用户',
    description: '列出系统用户列表（可登录的用户）',
    category: 'user',
    dangerous: false,
    parameters: { type: 'object', properties: {} },
    async execute(_params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const res = await ctx.executor.executeCommand(ctx.serverId, `awk -F: '$7 !~ /(nologin|false)$/ {print $1":"$3":"$6":"$7}' /etc/passwd`)
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
    dangerous: false,
    parameters: { type: 'object', properties: {} },
    async execute(_params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const [who, last] = await Promise.all([
        ctx.executor.executeCommand(ctx.serverId, 'who 2>/dev/null'),
        ctx.executor.executeCommand(ctx.serverId, 'last -n 10 2>/dev/null')
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
      const cmds: Record<string, string> = {
        create: `useradd -m -s ${shell} ${username}`,
        delete: `userdel -r ${username}`,
        lock: `usermod -L ${username}`,
        unlock: `usermod -U ${username}`
      }
      const cmd = cmds[action]
      if (!cmd) return { success: false, data: null, message: `未知操作: ${action}` }
      const res = await ctx.executor.executeCommand(ctx.serverId, cmd)
      return { success: res.exitCode === 0, data: { action, username }, message: res.exitCode === 0 ? `${action} ${username} 成功` : res.stderr || '操作失败' }
    }
  }
]
