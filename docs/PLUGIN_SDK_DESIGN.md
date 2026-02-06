# 插件SDK详细设计方案

> ServerHub插件开发工具包完整设计

---

## 📦 SDK包结构

### 1. @serverhub/plugin-sdk (核心SDK)

```
@serverhub/plugin-sdk/
├── src/
│   ├── core/
│   │   ├── Plugin.ts           # 插件基类
│   │   ├── PluginContext.ts    # 插件上下文
│   │   └── PluginLifecycle.ts  # 生命周期管理
│   ├── api/
│   │   ├── storage.ts          # 存储API
│   │   ├── http.ts             # HTTP客户端
│   │   ├── ui.ts               # UI API
│   │   ├── system.ts           # 系统API
│   │   ├── events.ts           # 事件系统
│   │   └── agent.ts            # Agent API
│   ├── types/
│   │   ├── plugin.ts           # 插件类型定义
│   │   ├── tool.ts             # 工具类型定义
│   │   ├── menu.ts             # 菜单类型定义
│   │   └── route.ts            # 路由类型定义
│   └── index.ts
├── package.json
└── README.md
```

### 2. @serverhub/plugin-cli (开发工具)

```
@serverhub/plugin-cli/
├── bin/
│   └── serverhub-plugin.js     # CLI入口
├── src/
│   ├── commands/
│   │   ├── create.ts           # 创建插件
│   │   ├── dev.ts              # 开发服务器
│   │   ├── build.ts            # 构建插件
│   │   ├── test.ts             # 测试插件
│   │   └── publish.ts          # 发布插件
│   ├── templates/              # 插件模板
│   └── utils/
└── package.json
```

### 3. @serverhub/plugin-types (类型定义)

```
@serverhub/plugin-types/
├── index.d.ts
├── plugin.d.ts
├── context.d.ts
├── api.d.ts
└── package.json
```

---

## 🎯 核心API设计

### Plugin基类

```typescript
import { PluginContext, PluginConfig } from './types'

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
    return this.context.agent.call(prompt, options)
  }
}
```

### PluginContext接口

```typescript
/**
 * 插件上下文 - 提供插件可用的所有API
 */
export interface PluginContext {
  // ========== 基础信息 ==========
  
  /** 插件ID */
  readonly pluginId: string
  
  /** 插件配置 */
  readonly config: PluginConfig
  
  /** 插件元数据 */
  readonly metadata: PluginMetadata
  
  /** 应用版本 */
  readonly appVersion: string

  // ========== 存储API ==========
  
  storage: {
    /**
     * 获取存储的值
     */
    get<T = any>(key: string): Promise<T | null>
    
    /**
     * 设置存储的值
     */
    set(key: string, value: any): Promise<void>
    
    /**
     * 删除存储的值
     */
    delete(key: string): Promise<void>
    
    /**
     * 清空所有存储
     */
    clear(): Promise<void>
    
    /**
     * 获取所有键
     */
    keys(): Promise<string[]>
  }

  // ========== 安全存储API（加密） ==========
  
  secureStorage: {
    /**
     * 获取加密存储的值
     */
    get(key: string): Promise<string | null>
    
    /**
     * 设置加密存储的值
     */
    set(key: string, value: string): Promise<void>
    
    /**
     * 删除加密存储的值
     */
    delete(key: string): Promise<void>
  }

  // ========== HTTP客户端 ==========
  
  http: {
    /**
     * GET请求
     */
    get<T = any>(url: string, options?: HttpOptions): Promise<HttpResponse<T>>
    
    /**
     * POST请求
     */
    post<T = any>(url: string, data?: any, options?: HttpOptions): Promise<HttpResponse<T>>
    
    /**
     * PUT请求
     */
    put<T = any>(url: string, data?: any, options?: HttpOptions): Promise<HttpResponse<T>>
    
    /**
     * DELETE请求
     */
    delete<T = any>(url: string, options?: HttpOptions): Promise<HttpResponse<T>>
    
    /**
     * 自定义请求
     */
    request<T = any>(config: HttpRequestConfig): Promise<HttpResponse<T>>
  }

  // ========== UI API ==========
  
  ui: {
    /**
     * 显示通知
     */
    showNotification(message: string, type?: 'success' | 'error' | 'warning' | 'info'): void
    
    /**
     * 显示对话框
     */
    showDialog(options: DialogOptions): Promise<DialogResult>
    
    /**
     * 显示确认框
     */
    showConfirm(message: string, title?: string): Promise<boolean>
    
    /**
     * 显示输入框
     */
    showPrompt(message: string, defaultValue?: string): Promise<string | null>
    
    /**
     * 注册Vue组件
     */
    registerComponent(name: string, component: any): void
    
    /**
     * 打开外部链接
     */
    openExternal(url: string): void
  }

  // ========== 系统API（受限） ==========
  
  system: {
    /**
     * 执行命令（需要权限）
     */
    executeCommand(command: string, options?: ExecOptions): Promise<CommandResult>
    
    /**
     * 读取文件（需要权限）
     */
    readFile(path: string, encoding?: string): Promise<string>
    
    /**
     * 写入文件（需要权限）
     */
    writeFile(path: string, content: string, encoding?: string): Promise<void>
    
    /**
     * 检查文件是否存在
     */
    fileExists(path: string): Promise<boolean>
    
    /**
     * 获取系统信息
     */
    getSystemInfo(): Promise<SystemInfo>
  }

  // ========== 事件系统 ==========
  
  events: {
    /**
     * 监听事件
     */
    on(event: string, handler: EventHandler): void
    
    /**
     * 监听一次事件
     */
    once(event: string, handler: EventHandler): void
    
    /**
     * 取消监听
     */
    off(event: string, handler: EventHandler): void
    
    /**
     * 发送事件
     */
    emit(event: string, data?: any): void
  }

  // ========== Agent API ==========
  
  agent: {
    /**
     * 注册Agent工具
     */
    registerTool(tool: AgentToolDefinition): void
    
    /**
     * 调用Agent工具
     */
    callTool(toolName: string, params: any): Promise<any>
    
    /**
     * 与Agent对话
     */
    chat(message: string, options?: ChatOptions): Promise<string>
    
    /**
     * 获取对话历史
     */
    getHistory(): Promise<ChatMessage[]>
  }

  // ========== 工具注册 ==========
  
  tools: {
    /**
     * 注册工具
     */
    register(tool: ToolDefinition): void
    
    /**
     * 取消注册工具
     */
    unregister(toolName: string): void
    
    /**
     * 获取已注册的工具
     */
    list(): ToolDefinition[]
  }

  // ========== 菜单注册 ==========
  
  menus: {
    /**
     * 注册菜单
     */
    register(menu: MenuDefinition): void
    
    /**
     * 取消注册菜单
     */
    unregister(menuId: string): void
  }

  // ========== 路由注册 ==========
  
  routes: {
    /**
     * 注册路由
     */
    register(route: RouteDefinition): void
    
    /**
     * 取消注册路由
     */
    unregister(routeName: string): void
    
    /**
     * 导航到路由
     */
    navigate(path: string): void
  }

  // ========== 命令注册 ==========
  
  commands: {
    /**
     * 注册命令
     */
    register(command: CommandDefinition): void
    
    /**
     * 取消注册命令
     */
    unregister(commandId: string): void
    
    /**
     * 执行命令
     */
    execute(commandId: string, ...args: any[]): Promise<any>
  }

  // ========== 日志API ==========
  
  logger: {
    debug(message: string, ...args: any[]): void
    info(message: string, ...args: any[]): void
    warn(message: string, ...args: any[]): void
    error(message: string, ...args: any[]): void
  }
}
```

---

## 🔧 类型定义

### 工具定义

```typescript
export interface ToolDefinition {
  /** 工具名称（唯一标识） */
  name: string
  
  /** 显示名称 */
  displayName: string
  
  /** 工具描述 */
  description: string
  
  /** 工具分类 */
  category: string
  
  /** 是否为危险操作 */
  dangerous?: boolean
  
  /** 参数定义 */
  parameters: Record<string, ParameterDefinition>
  
  /** 工具处理函数 */
  handler: (params: any) => Promise<any>
  
  /** 权限要求 */
  permissions?: string[]
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
  default?: any
  enum?: any[]
  validation?: (value: any) => boolean
}
```

### Agent工具定义

```typescript
export interface AgentToolDefinition {
  name: string
  displayName: string
  description: string
  category: string
  dangerous: boolean
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
    }>
    required: string[]
  }
  handler: string  // 处理函数名称
}
```

### 菜单定义

```typescript
export interface MenuDefinition {
  id: string
  label: string
  icon?: string
  route?: string
  position: 'sidebar' | 'toolbar' | 'context'
  order?: number
  children?: MenuDefinition[]
  visible?: () => boolean
}
```

### 路由定义

```typescript
export interface RouteDefinition {
  path: string
  name: string
  component: string | (() => Promise<any>)
  meta?: {
    title?: string
    icon?: string
    requiresAuth?: boolean
    [key: string]: any
  }
}
```

---

## 🛠️ CLI工具使用

### 创建新插件

```bash
# 使用交互式向导创建插件
npx @serverhub/plugin-cli create

# 或指定模板
npx @serverhub/plugin-cli create --template=cloud-service my-plugin
```

### 开发模式

```bash
cd my-plugin
npm run dev

# CLI会启动开发服务器，支持热重载
```

### 构建插件

```bash
npm run build

# 输出到 dist/ 目录
```

### 测试插件

```bash
npm test

# 运行单元测试和集成测试
```

### 发布插件

```bash
npm run publish

# 发布到ServerHub插件市场
```

---

## 📝 插件示例

### 基础插件示例

```typescript
import { Plugin, PluginContext } from '@serverhub/plugin-sdk'

export default class MyPlugin extends Plugin {
  constructor(context: PluginContext) {
    super(context)
  }

  async onLoad() {
    this.context.logger.info('插件加载')
    
    // 注册菜单
    this.registerMenu({
      id: 'my-plugin-menu',
      label: '我的插件',
      icon: 'Star',
      route: '/plugin/my-plugin',
      position: 'sidebar',
      order: 100
    })
    
    // 注册路由
    this.registerRoute({
      path: '/plugin/my-plugin',
      name: 'MyPlugin',
      component: './views/Main.vue',
      meta: {
        title: '我的插件'
      }
    })
    
    // 注册工具
    this.registerTool({
      name: 'my_tool',
      displayName: '我的工具',
      description: '这是一个示例工具',
      category: 'custom',
      parameters: {
        input: {
          type: 'string',
          description: '输入参数',
          required: true
        }
      },
      handler: async (params) => {
        return { result: `处理: ${params.input}` }
      }
    })
  }

  async onEnable() {
    this.context.logger.info('插件启用')
    this.context.ui.showNotification('插件已启用', 'success')
  }

  async onDisable() {
    this.context.logger.info('插件禁用')
  }
}
```

### 云服务插件示例

```typescript
import { Plugin, PluginContext } from '@serverhub/plugin-sdk'

export default class CloudServicePlugin extends Plugin {
  private apiToken: string | null = null

  async onLoad() {
    // 加载API Token
    this.apiToken = await this.context.secureStorage.get('api_token')
    
    // 注册Agent工具
    this.registerAgentTool({
      name: 'list_resources',
      displayName: '列出资源',
      description: '列出云服务资源',
      category: 'cloud',
      dangerous: false,
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '资源类型'
          }
        },
        required: ['type']
      },
      handler: 'listResources'
    })
  }

  async listResources(params: { type: string }) {
    if (!this.apiToken) {
      throw new Error('未配置API Token')
    }
    
    const response = await this.context.http.get(
      `https://api.example.com/resources?type=${params.type}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      }
    )
    
    return response.data
  }

  async onConfigChange(newConfig: any) {
    super.onConfigChange(newConfig)
    
    // 保存API Token到安全存储
    if (newConfig.apiToken) {
      await this.context.secureStorage.set('api_token', newConfig.apiToken)
      this.apiToken = newConfig.apiToken
    }
  }
}
```

---

## 🔒 权限系统

### 权限列表

```typescript
export enum PluginPermission {
  // 网络权限
  NETWORK_REQUEST = 'network:request',
  
  // 文件系统权限
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  
  // 系统权限
  SYSTEM_EXECUTE = 'system:execute',
  SYSTEM_INFO = 'system:info',
  
  // UI权限
  UI_NOTIFICATION = 'ui:notification',
  UI_DIALOG = 'ui:dialog',
  
  // 注册权限
  MENU_REGISTER = 'menu:register',
  ROUTE_REGISTER = 'route:register',
  TOOL_REGISTER = 'tool:register',
  COMMAND_REGISTER = 'command:register',
  
  // Agent权限
  AGENT_TOOL = 'agent:tool',
  AGENT_CHAT = 'agent:chat'
}
```

### plugin.json中声明权限

```json
{
  "id": "my-plugin",
  "name": "我的插件",
  "permissions": [
    "network:request",
    "menu:register",
    "route:register",
    "tool:register"
  ]
}
```

---

## 📚 下一步

1. 实现核心SDK包
2. 开发CLI工具
3. 编写详细文档
4. 创建插件模板
5. 建立插件市场

---

**文档版本**: v1.0  
**最后更新**: 2026-02-06
