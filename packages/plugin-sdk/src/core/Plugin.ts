import {
  PluginContext,
  PluginConfig,
  PluginMetadata,
  ToolDefinition,
  MenuDefinition,
  RouteDefinition,
  CommandDefinition,
  AgentToolDefinition,
  AgentCallOptions,
  AgentResponse
} from '@serverhub/plugin-types'

/**
 * 插件基类
 * 所有插件都应该继承此类
 */
export abstract class Plugin {
  protected context: PluginContext
  protected config: PluginConfig

  constructor(context: PluginContext) {
    this.context = context
    this.config = context.config
  }

  /**
   * 插件加载时调用（插件首次安装或应用启动时）
   */
  async onLoad(): Promise<void> {
    // 子类可选实现
  }

  /**
   * 插件启用时调用
   */
  async onEnable(): Promise<void> {
    // 子类可选实现
  }

  /**
   * 插件禁用时调用
   */
  async onDisable(): Promise<void> {
    // 子类可选实现
  }

  /**
   * 插件卸载时调用
   */
  async onUnload(): Promise<void> {
    // 子类可选实现
  }

  /**
   * 配置变更时调用
   */
  async onConfigChange(newConfig: PluginConfig): Promise<void> {
    this.config = newConfig
  }

  /**
   * 注册工具到插件系统
   */
  protected registerTool(tool: ToolDefinition): void {
    this.context.tools.register(tool)
  }

  /**
   * 注册菜单项
   */
  protected registerMenu(menu: MenuDefinition): void {
    this.context.menus.register(menu)
  }

  /**
   * 注册路由
   */
  protected registerRoute(route: RouteDefinition): void {
    this.context.routes.register(route)
  }

  /**
   * 注册命令
   */
  protected registerCommand(command: CommandDefinition): void {
    this.context.commands.register(command)
  }

  /**
   * 注册Agent工具
   */
  protected registerAgentTool(tool: AgentToolDefinition): void {
    this.context.agent.registerTool(tool)
  }

  /**
   * 调用Agent
   */
  protected async callAgent(
    prompt: string,
    options?: AgentCallOptions
  ): Promise<AgentResponse> {
    return this.context.agent.chat(prompt, options) as any
  }

  /**
   * 获取插件ID
   */
  get pluginId(): string {
    return this.context.pluginId
  }

  /**
   * 获取插件元数据
   */
  get metadata(): PluginMetadata {
    return this.context.metadata
  }

  /**
   * 日志记录
   */
  protected log = {
    debug: (...args: any[]) => this.context.logger.debug(...args),
    info: (...args: any[]) => this.context.logger.info(...args),
    warn: (...args: any[]) => this.context.logger.warn(...args),
    error: (...args: any[]) => this.context.logger.error(...args)
  }
}
