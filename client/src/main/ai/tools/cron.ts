import { ToolDefinition, ToolContext, ToolResult } from './registry'

export const cronTools: ToolDefinition[] = [
  {
    name: 'list_cron_jobs',
    displayName: '列出定时任务',
    description: '列出当前用户或所有用户的 crontab 定时任务',
    category: 'cron',
    dangerous: false,
    parameters: {
      type: 'object',
      properties: {
        user: { type: 'string', description: '指定用户，不指定则列出 root 的 crontab' }
      }
    },
    async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const user = (params.user as string) || 'root'
      const res = await ctx.executor.executeCommand(ctx.serverId, `crontab -u ${user} -l 2>&1`)
      return { success: res.exitCode === 0, data: { user, crontab: res.stdout }, message: res.exitCode === 0 ? `${user} 的定时任务` : res.stderr || '无定时任务' }
    }
  },
  {
    name: 'add_cron_job',
    displayName: '添加定时任务',
    description: '添加一条 crontab 定时任务',
    category: 'cron',
    dangerous: true,
    parameters: {
      type: 'object',
      properties: {
        schedule: { type: 'string', description: 'Cron 表达式，如 "0 2 * * *"（每天凌晨2点）' },
        command: { type: 'string', description: '要执行的命令' },
        user: { type: 'string', description: '用户，默认 root' }
      },
      required: ['schedule', 'command']
    },
    async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const { schedule, command, user = 'root' } = params as any
      const res = await ctx.executor.executeCommand(ctx.serverId, `(crontab -u ${user} -l 2>/dev/null; echo "${schedule} ${command}") | crontab -u ${user} -`)
      return { success: res.exitCode === 0, data: { schedule, command }, message: res.exitCode === 0 ? '定时任务已添加' : res.stderr || '添加失败' }
    }
  }
]
