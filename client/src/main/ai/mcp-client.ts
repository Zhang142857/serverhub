/**
 * MCP (Model Context Protocol) 客户端
 * 通过 stdio 与 MCP 服务器通信，动态注册工具到 ToolRegistry
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { toolRegistry, ToolDefinition, ToolContext, ToolResult } from './tools/registry'

export interface MCPServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled: boolean
}

interface MCPTool {
  name: string
  description: string
  inputSchema: { type: string; properties?: Record<string, any>; required?: string[] }
}

export class MCPClient extends EventEmitter {
  private servers = new Map<string, { config: MCPServerConfig; process: ChildProcess; tools: string[] }>()
  private configPath: string
  private requestId = 0
  private pendingRequests = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>()

  constructor() {
    super()
    this.configPath = join(app.getPath('userData'), 'mcp-servers.json')
  }

  // ==================== 配置管理 ====================

  getConfigs(): MCPServerConfig[] {
    try {
      return JSON.parse(readFileSync(this.configPath, 'utf-8'))
    } catch { return [] }
  }

  saveConfigs(configs: MCPServerConfig[]): void {
    writeFileSync(this.configPath, JSON.stringify(configs, null, 2))
  }

  addServer(config: MCPServerConfig): void {
    const configs = this.getConfigs()
    configs.push(config)
    this.saveConfigs(configs)
  }

  removeServer(name: string): void {
    this.stopServer(name)
    const configs = this.getConfigs().filter(c => c.name !== name)
    this.saveConfigs(configs)
  }

  // ==================== 服务器生命周期 ====================

  async startServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.name)) return

    const proc = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const entry = { config, process: proc, tools: [] as string[] }
    this.servers.set(config.name, entry)

    let buffer = ''
    proc.stdout!.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          this.handleMessage(config.name, msg)
        } catch {}
      }
    })

    proc.stderr!.on('data', (data: Buffer) => {
      console.error(`[MCP:${config.name}] stderr:`, data.toString())
    })

    proc.on('exit', (code) => {
      console.log(`[MCP:${config.name}] exited with code ${code}`)
      this.unregisterTools(config.name)
      this.servers.delete(config.name)
      this.emit('server:stopped', config.name)
    })

    // 初始化握手
    await this.sendRequest(config.name, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'runixo', version: '0.1.0' }
    })

    // 发送 initialized 通知
    this.sendNotification(config.name, 'notifications/initialized', {})

    // 获取工具列表
    const result = await this.sendRequest(config.name, 'tools/list', {})
    if (result?.tools) {
      this.registerMCPTools(config.name, result.tools)
    }

    console.log(`[MCP:${config.name}] Started, ${entry.tools.length} tools registered`)
    this.emit('server:started', config.name)
  }

  stopServer(name: string): void {
    const entry = this.servers.get(name)
    if (!entry) return
    this.unregisterTools(name)
    entry.process.kill()
    this.servers.delete(name)
  }

  async startAll(): Promise<void> {
    for (const config of this.getConfigs()) {
      if (!config.enabled) continue
      try { await this.startServer(config) }
      catch (e) { console.error(`[MCP] Failed to start ${config.name}:`, e) }
    }
  }

  stopAll(): void {
    for (const name of this.servers.keys()) this.stopServer(name)
  }

  getStatus(): Array<{ name: string; running: boolean; tools: number }> {
    const configs = this.getConfigs()
    return configs.map(c => ({
      name: c.name,
      running: this.servers.has(c.name),
      tools: this.servers.get(c.name)?.tools.length || 0
    }))
  }

  // ==================== JSON-RPC 通信 ====================

  private sendRequest(serverName: string, method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const entry = this.servers.get(serverName)
      if (!entry) return reject(new Error(`Server ${serverName} not running`))

      const id = ++this.requestId
      this.pendingRequests.set(id, { resolve, reject })

      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
      entry.process.stdin!.write(msg)

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`MCP request timeout: ${method}`))
        }
      }, 30000)
    })
  }

  private sendNotification(serverName: string, method: string, params: any): void {
    const entry = this.servers.get(serverName)
    if (!entry) return
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'
    entry.process.stdin!.write(msg)
  }

  private handleMessage(serverName: string, msg: any): void {
    if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!
      this.pendingRequests.delete(msg.id)
      if (msg.error) pending.reject(new Error(msg.error.message))
      else pending.resolve(msg.result)
    }
  }

  // ==================== 工具注册桥接 ====================

  private registerMCPTools(serverName: string, tools: MCPTool[]): void {
    const entry = this.servers.get(serverName)
    if (!entry) return

    for (const mcpTool of tools) {
      const toolName = `mcp_${serverName}_${mcpTool.name}`
      const def: ToolDefinition = {
        name: toolName,
        displayName: `[${serverName}] ${mcpTool.name}`,
        description: mcpTool.description || mcpTool.name,
        category: 'plugin',
        dangerous: false,
        parameters: {
          type: 'object',
          properties: mcpTool.inputSchema?.properties || {},
          required: mcpTool.inputSchema?.required
        },
        execute: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
          try {
            const result = await this.sendRequest(serverName, 'tools/call', {
              name: mcpTool.name,
              arguments: params
            })
            const text = result?.content?.map((c: any) => c.text || JSON.stringify(c)).join('\n') || JSON.stringify(result)
            return { success: true, data: result, message: text }
          } catch (e: any) {
            return { success: false, data: null, message: e.message }
          }
        }
      }

      toolRegistry.register(def)
      entry.tools.push(toolName)
    }
  }

  private unregisterTools(serverName: string): void {
    const entry = this.servers.get(serverName)
    if (!entry) return
    for (const name of entry.tools) {
      toolRegistry.unregister(name)
    }
    entry.tools = []
  }
}

export const mcpClient = new MCPClient()
