import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'

const CERT_DIR = join(app.getPath('userData'), 'certificates')

// 确保证书目录存在
function ensureCertDir() {
  if (!existsSync(CERT_DIR)) {
    mkdirSync(CERT_DIR, { recursive: true })
  }
}

// 验证 serverId 防止路径遍历
function sanitizeServerId(serverId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(serverId)) {
    throw new Error('Invalid serverId: only alphanumeric, underscore and hyphen allowed')
  }
  return serverId
}

/**
 * 保存服务器证书
 * @param serverId 服务器 ID
 * @param certificate PEM 格式的证书内容
 */
export function saveCertificate(serverId: string, certificate: string): void {
  ensureCertDir()
  const certPath = join(CERT_DIR, `${sanitizeServerId(serverId)}.pem`)
  writeFileSync(certPath, certificate, 'utf-8')
}

/**
 * 读取服务器证书
 * @param serverId 服务器 ID
 * @returns PEM 格式的证书内容，如果不存在返回 null
 */
export function getCertificate(serverId: string): string | null {
  const certPath = join(CERT_DIR, `${sanitizeServerId(serverId)}.pem`)
  if (!existsSync(certPath)) {
    return null
  }
  return readFileSync(certPath, 'utf-8')
}

/**
 * 删除服务器证书
 * @param serverId 服务器 ID
 */
export function deleteCertificate(serverId: string): void {
  const certPath = join(CERT_DIR, `${sanitizeServerId(serverId)}.pem`)
  if (existsSync(certPath)) {
    require('fs').unlinkSync(certPath)
  }
}
