/**
 * AI 审计日志 - 记录所有 AI 工具调用
 */
import { app } from 'electron'
import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const LOG_DIR = () => join(app.getPath('userData'), 'ai-audit')

export interface AuditEntry {
  timestamp: string
  serverId: string
  toolName: string
  args: Record<string, unknown>
  result: { success: boolean; error?: string }
  userConfirmed: boolean
  dangerLevel: number
}

function ensureDir() {
  const dir = LOG_DIR()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

/** 记录审计日志 */
export function logToolCall(entry: AuditEntry): void {
  try {
    ensureDir()
    const date = new Date().toISOString().slice(0, 10)
    const logFile = join(LOG_DIR(), `${date}.jsonl`)
    appendFileSync(logFile, JSON.stringify(entry) + '\n', { mode: 0o600 })
  } catch (err) {
    console.error('[AuditLogger] 写入失败:', err)
  }
}
