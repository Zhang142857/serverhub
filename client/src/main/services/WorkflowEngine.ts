import { EventEmitter } from 'events'

interface WorkflowDefinition {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  icon?: string
  category?: string
}

interface WorkflowStep {
  id: string
  type: 'tool' | 'condition' | 'loop'
  config: {
    tool?: string
    params?: Record<string, any>
    condition?: string
    loopOver?: string
  }
  next?: string | string[]
}

interface ToolDefinition {
  name: string
  displayName: string
  description: string
  category: string
  dangerous?: boolean
  parameters: Record<string, any>
  handler: (params: any) => Promise<any>
}

interface AgentDefinition {
  id: string
  name: string
  description: string
  systemPrompt: string
  tools: string[]
}

/**
 * 工作流执行引擎
 */
export class WorkflowEngine extends EventEmitter {
  private workflows = new Map<string, WorkflowDefinition>()
  private tools = new Map<string, ToolDefinition>()
  private agents = new Map<string, AgentDefinition>()

  registerWorkflow(workflow: WorkflowDefinition) {
    this.workflows.set(workflow.id, workflow)
  }

  registerTool(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
  }

  registerAgent(agent: AgentDefinition) {
    this.agents.set(agent.id, agent)
  }

  async execute(workflowId: string, inputs: Record<string, any>): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) throw new Error(`工作流不存在: ${workflowId}`)

    const context = new WorkflowContext(inputs)
    const execution = new WorkflowExecution(workflow, context, this)

    this.emit('workflow:start', workflowId)
    const result = await execution.run()
    this.emit('workflow:complete', workflowId, result)

    return result
  }

  async executeTool(name: string, params: any): Promise<any> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`工具不存在: ${name}`)
    return await tool.handler(params)
  }
}

/**
 * 工作流上下文
 */
class WorkflowContext {
  private variables: Record<string, any>
  private stepResults = new Map<string, any>()

  constructor(inputs: Record<string, any>) {
    this.variables = { ...inputs }
  }

  set(key: string, value: any) {
    this.variables[key] = value
  }

  get(key: string): any {
    return this.variables[key]
  }

  setStepResult(stepId: string, result: any) {
    this.stepResults.set(stepId, result)
    this.variables[`steps.${stepId}`] = result
  }

  getStepResult(stepId: string): any {
    return this.stepResults.get(stepId)
  }

  resolve(template: string): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_, path) => {
      return this.getByPath(path.trim())
    })
  }

  resolvePath(path: string): any {
    return this.getByPath(path)
  }

  private getByPath(path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], this.variables)
  }
}

/**
 * 工作流执行实例
 */
class WorkflowExecution {
  private workflow: WorkflowDefinition
  private context: WorkflowContext
  private engine: WorkflowEngine
  private currentStep?: string

  constructor(workflow: WorkflowDefinition, context: WorkflowContext, engine: WorkflowEngine) {
    this.workflow = workflow
    this.context = context
    this.engine = engine
  }

  async run(): Promise<WorkflowResult> {
    try {
      this.currentStep = this.workflow.steps[0].id

      while (this.currentStep) {
        const step = this.findStep(this.currentStep)
        if (!step) break

        this.engine.emit('step:start', step.id)
        const result = await this.executeStep(step)
        this.context.setStepResult(step.id, result)
        this.context.set('result', result)
        this.engine.emit('step:complete', step.id, result)

        this.currentStep = this.getNextStep(step, result)
      }

      return { success: true, results: this.context['stepResults'] }
    } catch (error: any) {
      return { success: false, error: error.message, results: this.context['stepResults'] }
    }
  }

  private async executeStep(step: WorkflowStep): Promise<any> {
    switch (step.type) {
      case 'tool':
        return await this.executeTool(step)
      case 'condition':
        return await this.evaluateCondition(step)
      case 'loop':
        return await this.executeLoop(step)
      default:
        throw new Error(`未知步骤类型: ${step.type}`)
    }
  }

  private async executeTool(step: WorkflowStep): Promise<any> {
    const { tool, params } = step.config
    const resolvedParams = this.resolveParams(params)
    return await this.engine.executeTool(tool!, resolvedParams)
  }

  private async evaluateCondition(step: WorkflowStep): Promise<boolean> {
    const { condition } = step.config
    if (!condition || typeof condition !== 'string') {
      return false
    }
    return evaluateSafeCondition(condition, this.context)
  }

  private async executeLoop(step: WorkflowStep): Promise<any[]> {
    const { loopOver } = step.config
    const items = this.context.get(loopOver!)
    if (!Array.isArray(items)) throw new Error(`循环变量不是数组: ${loopOver}`)

    const results = []
    for (const item of items) {
      this.context.set('item', item)
      const nextStep = this.findStep(step.next as string)
      if (nextStep) {
        const result = await this.executeStep(nextStep)
        results.push(result)
      }
    }
    return results
  }

  private resolveParams(params?: Record<string, any>): Record<string, any> {
    if (!params) return {}
    const resolved: Record<string, any> = {}
    for (const [key, value] of Object.entries(params)) {
      resolved[key] = typeof value === 'string' ? this.context.resolve(value) : value
    }
    return resolved
  }

  private findStep(stepId: string): WorkflowStep | undefined {
    return this.workflow.steps.find(s => s.id === stepId)
  }

  private getNextStep(step: WorkflowStep, result: any): string | undefined {
    if (!step.next) return undefined
    if (typeof step.next === 'string') return step.next
    if (Array.isArray(step.next)) {
      const condition = result === true || result?.success === true
      return step.next[condition ? 0 : 1]
    }
    return undefined
  }
}

const IDENTIFIER_PATTERN = /^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)*$/

function evaluateSafeCondition(expression: string, context: WorkflowContext): boolean {
  const normalized = stripOuterParentheses(expression.trim())
  if (!normalized) return false

  const orParts = splitTopLevel(normalized, '||')
  if (orParts.length > 1) {
    return orParts.some(part => evaluateSafeCondition(part, context))
  }

  const andParts = splitTopLevel(normalized, '&&')
  if (andParts.length > 1) {
    return andParts.every(part => evaluateSafeCondition(part, context))
  }

  if (normalized.startsWith('!')) {
    return !evaluateSafeCondition(normalized.slice(1), context)
  }

  const comparison = findTopLevelComparison(normalized)
  if (comparison) {
    const left = parseOperand(comparison.left, context)
    const right = parseOperand(comparison.right, context)
    switch (comparison.operator) {
      case '===':
        return left === right
      case '!==':
        return left !== right
      case '==':
        return left == right
      case '!=':
        return left != right
      case '>':
        return Number(left) > Number(right)
      case '<':
        return Number(left) < Number(right)
      case '>=':
        return Number(left) >= Number(right)
      case '<=':
        return Number(left) <= Number(right)
      default:
        return false
    }
  }

  return Boolean(parseOperand(normalized, context))
}

function parseOperand(raw: string, context: WorkflowContext): unknown {
  const token = stripOuterParentheses(raw.trim())

  if (!token) return ''
  if (token === 'true') return true
  if (token === 'false') return false
  if (token === 'null') return null
  if (token === 'undefined') return undefined

  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return Number(token)
  }

  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1)
  }

  if (IDENTIFIER_PATTERN.test(token)) {
    return context.resolvePath(token)
  }

  throw new Error(`不支持的条件表达式片段: ${token}`)
}

function findTopLevelComparison(expression: string): { left: string; operator: string; right: string } | null {
  const operators = ['===', '!==', '>=', '<=', '==', '!=', '>', '<']
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let i = 0; i < expression.length; i++) {
    const ch = expression[i]

    if (quote) {
      if (ch === quote && expression[i - 1] !== '\\') quote = null
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }

    if (ch === '(') {
      depth++
      continue
    }

    if (ch === ')') {
      depth--
      continue
    }

    if (depth !== 0) continue

    for (const operator of operators) {
      if (expression.startsWith(operator, i)) {
        return {
          left: expression.slice(0, i),
          operator,
          right: expression.slice(i + operator.length)
        }
      }
    }
  }

  return null
}

function splitTopLevel(expression: string, separator: '||' | '&&'): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: '"' | "'" | null = null
  let start = 0

  for (let i = 0; i < expression.length; i++) {
    const ch = expression[i]

    if (quote) {
      if (ch === quote && expression[i - 1] !== '\\') quote = null
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }

    if (ch === '(') {
      depth++
      continue
    }

    if (ch === ')') {
      depth--
      continue
    }

    if (depth === 0 && expression.startsWith(separator, i)) {
      parts.push(expression.slice(start, i).trim())
      i += separator.length - 1
      start = i + 1
    }
  }

  if (start === 0) return [expression]
  parts.push(expression.slice(start).trim())
  return parts
}

function stripOuterParentheses(expression: string): string {
  let current = expression.trim()

  while (current.startsWith('(') && current.endsWith(')') && hasOuterPair(current)) {
    current = current.slice(1, -1).trim()
  }

  return current
}

function hasOuterPair(expression: string): boolean {
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let i = 0; i < expression.length; i++) {
    const ch = expression[i]

    if (quote) {
      if (ch === quote && expression[i - 1] !== '\\') quote = null
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }

    if (ch === '(') depth++
    if (ch === ')') depth--

    if (depth === 0 && i < expression.length - 1) {
      return false
    }
  }

  return true
}

interface WorkflowResult {
  success: boolean
  results: Map<string, any>
  error?: string
}
