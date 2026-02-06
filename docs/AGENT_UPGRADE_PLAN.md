# Agent系统升级方案

> 增强AI Agent能力，实现多Agent协作和智能工具市场

---

## 🎯 升级目标

1. **多Agent协作** - 支持主Agent调用子Agent完成复杂任务
2. **Agent工具市场** - 插件可注册工具，Agent智能发现和使用
3. **长期记忆系统** - 向量数据库存储历史对话和知识
4. **自主规划增强** - 更强的任务分解和执行能力
5. **安全机制完善** - 危险操作确认、审计日志、回滚机制

---

## 🏗️ 架构升级

### 当前架构

```
┌─────────────────────────────────────────┐
│         AI Gateway                      │
│  ┌──────────────────────────────────┐   │
│  │  ReAct Engine                    │   │
│  │  - Think → Act → Observe         │   │
│  │  - 单Agent执行                    │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Tool Registry (40+ tools)       │   │
│  │  - system, docker, file, etc.    │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 升级后架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Orchestrator                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Multi-Agent Coordinator                             │   │
│  │  - 任务分解和分配                                      │   │
│  │  - Agent间通信                                        │   │
│  │  - 结果聚合                                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Main Agent   │  │ Sub Agent 1  │  │ Sub Agent 2  │      │
│  │ (ReAct)      │  │ (Specialist) │  │ (Specialist) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Enhanced Tool Registry                              │   │
│  │  - 核心工具 (40+)                                     │   │
│  │  - 插件工具 (动态注册)                                │   │
│  │  - 工具分类和搜索                                     │   │
│  │  - 智能推荐                                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Memory System                                       │   │
│  │  - 短期记忆 (会话历史)                                │   │
│  │  - 长期记忆 (向量数据库)                              │   │
│  │  - 知识图谱                                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Security & Audit                                    │   │
│  │  - 操作审计日志                                       │   │
│  │  - 危险操作确认                                       │   │
│  │  - 回滚机制                                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤝 多Agent协作系统

### Agent类型定义

```typescript
/**
 * Agent类型
 */
export enum AgentType {
  /** 主Agent - 负责任务规划和协调 */
  MAIN = 'main',
  
  /** 专家Agent - 专注特定领域 */
  SPECIALIST = 'specialist',
  
  /** 工具Agent - 执行特定工具 */
  TOOL = 'tool'
}

/**
 * Agent定义
 */
export interface AgentDefinition {
  id: string
  name: string
  type: AgentType
  description: string
  capabilities: string[]
  tools: string[]
  model?: string
  temperature?: number
}
```

### Agent协调器

```typescript
/**
 * Agent协调器 - 管理多个Agent的协作
 */
export class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map()
  private taskQueue: TaskQueue
  private messageRouter: MessageRouter

  /**
   * 注册Agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent)
  }

  /**
   * 执行任务 - 自动选择合适的Agent
   */
  async executeTask(task: Task): Promise<TaskResult> {
    // 1. 任务分析
    const analysis = await this.analyzeTask(task)
    
    // 2. 选择Agent
    const agent = this.selectAgent(analysis)
    
    // 3. 如果需要协作，分解任务
    if (analysis.requiresCollaboration) {
      return await this.executeCollaborativeTask(task, analysis)
    }
    
    // 4. 单Agent执行
    return await agent.execute(task)
  }

  /**
   * 协作任务执行
   */
  private async executeCollaborativeTask(
    task: Task,
    analysis: TaskAnalysis
  ): Promise<TaskResult> {
    // 1. 分解任务
    const subtasks = await this.decomposeTask(task, analysis)
    
    // 2. 分配给不同的Agent
    const assignments = this.assignTasks(subtasks)
    
    // 3. 并行或串行执行
    const results = await this.executeSubtasks(assignments)
    
    // 4. 聚合结果
    return await this.aggregateResults(results)
  }

  /**
   * Agent间消息传递
   */
  async sendMessage(
    from: string,
    to: string,
    message: AgentMessage
  ): Promise<void> {
    await this.messageRouter.route(from, to, message)
  }
}
```

### 专家Agent示例

```typescript
/**
 * Docker专家Agent
 */
export class DockerExpertAgent extends Agent {
  constructor() {
    super({
      id: 'docker-expert',
      name: 'Docker专家',
      type: AgentType.SPECIALIST,
      description: '专注于Docker容器管理和故障排查',
      capabilities: [
        'container-management',
        'image-management',
        'network-troubleshooting',
        'performance-optimization'
      ],
      tools: [
        'docker_list_containers',
        'docker_inspect',
        'docker_logs',
        'docker_stats',
        'docker_exec'
      ]
    })
  }

  async execute(task: Task): Promise<TaskResult> {
    // 使用ReAct模式执行Docker相关任务
    return await this.reactLoop(task)
  }
}

/**
 * 网络专家Agent
 */
export class NetworkExpertAgent extends Agent {
  constructor() {
    super({
      id: 'network-expert',
      name: '网络专家',
      type: AgentType.SPECIALIST,
      description: '专注于网络配置和故障诊断',
      capabilities: [
        'network-diagnosis',
        'firewall-management',
        'dns-management',
        'ssl-management'
      ],
      tools: [
        'network_ping',
        'network_traceroute',
        'network_port_scan',
        'firewall_list_rules',
        'dns_lookup'
      ]
    })
  }
}
```

---

## 🛠️ 增强的工具注册系统

### 工具注册中心升级

```typescript
/**
 * 增强的工具注册中心
 */
export class EnhancedToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private categories: Map<string, Set<string>> = new Map()
  private pluginTools: Map<string, Set<string>> = new Map()
  private usageStats: Map<string, ToolUsageStats> = new Map()

  /**
   * 注册工具（支持插件注册）
   */
  registerTool(tool: ToolDefinition, pluginId?: string): void {
    this.tools.set(tool.name, tool)
    
    // 分类索引
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set())
    }
    this.categories.get(tool.category)!.add(tool.name)
    
    // 插件工具索引
    if (pluginId) {
      if (!this.pluginTools.has(pluginId)) {
        this.pluginTools.set(pluginId, new Set())
      }
      this.pluginTools.get(pluginId)!.add(tool.name)
    }
    
    // 初始化使用统计
    this.usageStats.set(tool.name, {
      callCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTime: 0
    })
  }

  /**
   * 智能搜索工具
   */
  searchTools(query: string, context?: SearchContext): ToolDefinition[] {
    const results: Array<{ tool: ToolDefinition; score: number }> = []
    
    for (const tool of this.tools.values()) {
      let score = 0
      
      // 名称匹配
      if (tool.name.includes(query)) score += 10
      if (tool.displayName.includes(query)) score += 8
      
      // 描述匹配
      if (tool.description.includes(query)) score += 5
      
      // 分类匹配
      if (context?.category && tool.category === context.category) score += 3
      
      // 使用频率加权
      const stats = this.usageStats.get(tool.name)
      if (stats) {
        score += Math.log(stats.callCount + 1)
      }
      
      if (score > 0) {
        results.push({ tool, score })
      }
    }
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score)
    
    return results.map(r => r.tool)
  }

  /**
   * 获取分类下的工具
   */
  getToolsByCategory(category: string): ToolDefinition[] {
    const toolNames = this.categories.get(category) || new Set()
    return Array.from(toolNames)
      .map(name => this.tools.get(name))
      .filter(Boolean) as ToolDefinition[]
  }

  /**
   * 获取插件的工具
   */
  getPluginTools(pluginId: string): ToolDefinition[] {
    const toolNames = this.pluginTools.get(pluginId) || new Set()
    return Array.from(toolNames)
      .map(name => this.tools.get(name))
      .filter(Boolean) as ToolDefinition[]
  }

  /**
   * 推荐工具
   */
  recommendTools(context: RecommendContext): ToolDefinition[] {
    // 基于上下文推荐相关工具
    const recommendations: Array<{ tool: ToolDefinition; relevance: number }> = []
    
    for (const tool of this.tools.values()) {
      let relevance = 0
      
      // 基于任务类型
      if (context.taskType && tool.category === context.taskType) {
        relevance += 5
      }
      
      // 基于历史使用
      if (context.recentTools?.includes(tool.name)) {
        relevance += 3
      }
      
      // 基于成功率
      const stats = this.usageStats.get(tool.name)
      if (stats && stats.callCount > 0) {
        const successRate = stats.successCount / stats.callCount
        relevance += successRate * 2
      }
      
      if (relevance > 0) {
        recommendations.push({ tool, relevance })
      }
    }
    
    recommendations.sort((a, b) => b.relevance - a.relevance)
    
    return recommendations.slice(0, 10).map(r => r.tool)
  }

  /**
   * 记录工具使用
   */
  recordUsage(
    toolName: string,
    success: boolean,
    executionTime: number
  ): void {
    const stats = this.usageStats.get(toolName)
    if (!stats) return
    
    stats.callCount++
    if (success) {
      stats.successCount++
    } else {
      stats.failureCount++
    }
    
    // 更新平均执行时间
    stats.avgExecutionTime = 
      (stats.avgExecutionTime * (stats.callCount - 1) + executionTime) / 
      stats.callCount
  }

  /**
   * 卸载插件工具
   */
  unregisterPluginTools(pluginId: string): void {
    const toolNames = this.pluginTools.get(pluginId)
    if (!toolNames) return
    
    for (const toolName of toolNames) {
      this.tools.delete(toolName)
      this.usageStats.delete(toolName)
      
      // 从分类索引中移除
      for (const categoryTools of this.categories.values()) {
        categoryTools.delete(toolName)
      }
    }
    
    this.pluginTools.delete(pluginId)
  }
}
```

---

## 🧠 长期记忆系统

### 记忆架构

```typescript
/**
 * 记忆类型
 */
export enum MemoryType {
  /** 短期记忆 - 当前会话 */
  SHORT_TERM = 'short_term',
  
  /** 长期记忆 - 持久化存储 */
  LONG_TERM = 'long_term',
  
  /** 工作记忆 - 任务执行期间 */
  WORKING = 'working'
}

/**
 * 记忆项
 */
export interface MemoryItem {
  id: string
  type: MemoryType
  content: string
  embedding?: number[]
  metadata: {
    timestamp: number
    source: string
    importance: number
    tags: string[]
  }
}

/**
 * 记忆系统
 */
export class MemorySystem {
  private shortTermMemory: MemoryItem[] = []
  private vectorStore: VectorStore
  private knowledgeGraph: KnowledgeGraph

  constructor() {
    this.vectorStore = new VectorStore()
    this.knowledgeGraph = new KnowledgeGraph()
  }

  /**
   * 存储记忆
   */
  async store(item: MemoryItem): Promise<void> {
    if (item.type === MemoryType.SHORT_TERM) {
      this.shortTermMemory.push(item)
      
      // 短期记忆容量限制
      if (this.shortTermMemory.length > 100) {
        // 将重要的记忆转为长期记忆
        await this.consolidateMemory()
      }
    } else if (item.type === MemoryType.LONG_TERM) {
      // 生成embedding
      item.embedding = await this.generateEmbedding(item.content)
      
      // 存储到向量数据库
      await this.vectorStore.add(item)
      
      // 更新知识图谱
      await this.knowledgeGraph.addNode(item)
    }
  }

  /**
   * 检索相关记忆
   */
  async retrieve(query: string, limit: number = 5): Promise<MemoryItem[]> {
    // 1. 生成查询embedding
    const queryEmbedding = await this.generateEmbedding(query)
    
    // 2. 向量搜索
    const vectorResults = await this.vectorStore.search(queryEmbedding, limit)
    
    // 3. 结合知识图谱
    const graphResults = await this.knowledgeGraph.findRelated(query)
    
    // 4. 合并和排序
    return this.mergeResults(vectorResults, graphResults, limit)
  }

  /**
   * 记忆整合 - 将短期记忆转为长期记忆
   */
  private async consolidateMemory(): Promise<void> {
    // 评估重要性
    const importantMemories = this.shortTermMemory
      .filter(m => m.metadata.importance > 0.7)
    
    // 转为长期记忆
    for (const memory of importantMemories) {
      await this.store({
        ...memory,
        type: MemoryType.LONG_TERM
      })
    }
    
    // 清理短期记忆
    this.shortTermMemory = this.shortTermMemory
      .filter(m => m.metadata.importance <= 0.7)
      .slice(-50)  // 保留最近50条
  }

  /**
   * 生成embedding
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // 调用embedding模型
    // 这里可以使用本地模型或API
    return await embeddingModel.encode(text)
  }

  /**
   * 获取会话上下文
   */
  async getContext(query: string): Promise<string> {
    // 1. 获取短期记忆
    const recentMemories = this.shortTermMemory.slice(-10)
    
    // 2. 检索相关长期记忆
    const relevantMemories = await this.retrieve(query, 5)
    
    // 3. 构建上下文
    const context = [
      '## 最近对话',
      ...recentMemories.map(m => m.content),
      '',
      '## 相关知识',
      ...relevantMemories.map(m => m.content)
    ].join('\n')
    
    return context
  }
}
```

### 向量存储实现

```typescript
/**
 * 向量存储（使用SQLite + VSS扩展）
 */
export class VectorStore {
  private db: Database

  constructor() {
    this.db = new Database('memory.db')
    this.initialize()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vectors USING vss0(
        embedding(384)
      );
      
      CREATE TABLE IF NOT EXISTS memory_items (
        id TEXT PRIMARY KEY,
        content TEXT,
        metadata TEXT,
        created_at INTEGER
      );
    `)
  }

  async add(item: MemoryItem): Promise<void> {
    // 存储向量
    this.db.prepare(`
      INSERT INTO vectors(rowid, embedding)
      VALUES (?, ?)
    `).run(item.id, item.embedding)
    
    // 存储内容
    this.db.prepare(`
      INSERT INTO memory_items(id, content, metadata, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      item.id,
      item.content,
      JSON.stringify(item.metadata),
      Date.now()
    )
  }

  async search(
    queryEmbedding: number[],
    limit: number
  ): Promise<MemoryItem[]> {
    const results = this.db.prepare(`
      SELECT 
        m.id,
        m.content,
        m.metadata,
        v.distance
      FROM vectors v
      JOIN memory_items m ON v.rowid = m.id
      WHERE vss_search(v.embedding, ?)
      ORDER BY v.distance
      LIMIT ?
    `).all(queryEmbedding, limit)
    
    return results.map(row => ({
      id: row.id,
      type: MemoryType.LONG_TERM,
      content: row.content,
      metadata: JSON.parse(row.metadata)
    }))
  }
}
```

---

## 🔒 安全机制增强

### 操作审计

```typescript
/**
 * 审计日志
 */
export interface AuditLog {
  id: string
  timestamp: number
  agentId: string
  action: string
  tool: string
  parameters: any
  result: 'success' | 'failure' | 'cancelled'
  dangerous: boolean
  userConfirmed?: boolean
}

/**
 * 审计系统
 */
export class AuditSystem {
  private logs: AuditLog[] = []
  private db: Database

  /**
   * 记录操作
   */
  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const log: AuditLog = {
      id: generateId(),
      timestamp: Date.now(),
      ...entry
    }
    
    this.logs.push(log)
    
    // 持久化
    await this.persist(log)
    
    // 危险操作告警
    if (entry.dangerous && entry.result === 'success') {
      await this.alertDangerousOperation(log)
    }
  }

  /**
   * 查询审计日志
   */
  async query(filter: AuditFilter): Promise<AuditLog[]> {
    let results = this.logs
    
    if (filter.agentId) {
      results = results.filter(l => l.agentId === filter.agentId)
    }
    
    if (filter.dangerous !== undefined) {
      results = results.filter(l => l.dangerous === filter.dangerous)
    }
    
    if (filter.startTime) {
      results = results.filter(l => l.timestamp >= filter.startTime!)
    }
    
    return results
  }

  /**
   * 生成审计报告
   */
  async generateReport(period: 'day' | 'week' | 'month'): Promise<AuditReport> {
    const now = Date.now()
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    }[period]
    
    const logs = this.logs.filter(l => l.timestamp >= now - periodMs)
    
    return {
      period,
      totalOperations: logs.length,
      successfulOperations: logs.filter(l => l.result === 'success').length,
      failedOperations: logs.filter(l => l.result === 'failure').length,
      dangerousOperations: logs.filter(l => l.dangerous).length,
      topTools: this.getTopTools(logs),
      timeline: this.generateTimeline(logs)
    }
  }
}
```

### 回滚机制

```typescript
/**
 * 操作快照
 */
export interface OperationSnapshot {
  id: string
  timestamp: number
  operation: string
  stateBefore: any
  stateAfter: any
  rollbackScript?: string
}

/**
 * 回滚系统
 */
export class RollbackSystem {
  private snapshots: Map<string, OperationSnapshot> = new Map()

  /**
   * 创建快照
   */
  async createSnapshot(
    operation: string,
    stateBefore: any
  ): Promise<string> {
    const snapshot: OperationSnapshot = {
      id: generateId(),
      timestamp: Date.now(),
      operation,
      stateBefore,
      stateAfter: null
    }
    
    this.snapshots.set(snapshot.id, snapshot)
    return snapshot.id
  }

  /**
   * 更新快照
   */
  async updateSnapshot(
    id: string,
    stateAfter: any,
    rollbackScript?: string
  ): Promise<void> {
    const snapshot = this.snapshots.get(id)
    if (!snapshot) return
    
    snapshot.stateAfter = stateAfter
    snapshot.rollbackScript = rollbackScript
  }

  /**
   * 回滚操作
   */
  async rollback(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId)
    if (!snapshot) {
      throw new Error('快照不存在')
    }
    
    if (snapshot.rollbackScript) {
      // 执行回滚脚本
      await executeScript(snapshot.rollbackScript)
    } else {
      // 恢复状态
      await restoreState(snapshot.stateBefore)
    }
  }
}
```

---

## 📊 实施计划

### 阶段1：基础架构（2周）

- [ ] Agent协调器实现
- [ ] 增强工具注册系统
- [ ] 审计系统基础

### 阶段2：多Agent协作（2周）

- [ ] 专家Agent实现
- [ ] Agent间通信
- [ ] 任务分解和分配

### 阶段3：记忆系统（2周）

- [ ] 向量存储实现
- [ ] 记忆整合机制
- [ ] 知识图谱基础

### 阶段4：安全增强（1周）

- [ ] 回滚机制
- [ ] 审计报告
- [ ] 危险操作确认优化

---

**文档版本**: v1.0  
**最后更新**: 2026-02-06
