import { Client } from 'ssh2'
import { ipcMain, BrowserWindow } from 'electron'
import { readFileSync } from 'fs'
import { homedir } from 'os'

interface SshInstallParams {
  host: string
  sshPort: number
  username: string
  authType: 'password' | 'key'
  password?: string
  keyPath?: string
  rootPassword?: string  // sudo 密码（可选）
}

function sendLog(win: BrowserWindow, text: string, type: 'info' | 'success' | 'error' = 'info') {
  win.webContents.send('ssh:install:log', { text, type })
}

function sshExec(conn: Client, cmd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let stdout = '', stderr = ''
      stream.on('data', (d: Buffer) => { stdout += d.toString() })
      stream.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      stream.on('close', (code: number) => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 }))
    })
  })
}

/** 构造 sudo 前缀：如果提供了 root 密码则用 echo pipe，否则用普通 sudo */
function sudoCmd(cmd: string, rootPassword?: string): string {
  if (rootPassword) {
    const escaped = rootPassword.replace(/'/g, "'\\''")
    return `echo '${escaped}' | sudo -S ${cmd}`
  }
  return `sudo ${cmd}`
}

export function registerSshHandlers() {
  ipcMain.handle('ssh:installAgent', async (event, params: SshInstallParams) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const conn = new Client()
    const rp = params.rootPassword

    return new Promise<{ success: boolean; port: number; token: string; certificate?: string; error?: string }>((resolve) => {
      const connectConfig: any = {
        host: params.host,
        port: params.sshPort || 22,
        username: params.username,
        readyTimeout: 15000,
      }

      if (params.authType === 'password') {
        connectConfig.password = params.password
      } else {
        const keyPath = (params.keyPath || '~/.ssh/id_rsa').replace('~', homedir())
        try { connectConfig.privateKey = readFileSync(keyPath) }
        catch { return resolve({ success: false, port: 0, token: '', error: `无法读取密钥: ${keyPath}` }) }
      }

      conn.on('error', (err) => {
        sendLog(win, `❌ SSH 连接失败: ${err.message}`, 'error')
        resolve({ success: false, port: 0, token: '', certificate: '', error: err.message })
      })

      conn.on('ready', async () => {
        try {
          sendLog(win, '✓ SSH 连接成功', 'success')

          // 检测架构
          sendLog(win, '检测系统架构...')
          const archRes = await sshExec(conn, 'uname -m')
          const arch = archRes.stdout.includes('aarch64') || archRes.stdout.includes('arm64') ? 'arm64' : 'amd64'
          sendLog(win, `系统: linux/${arch}`, 'success')

          if (arch !== 'amd64') {
            sendLog(win, `❌ 暂不支持 ${arch} 架构`, 'error')
            conn.end()
            return resolve({ success: false, port: 0, token: '', certificate: '', error: `不支持的架构: ${arch}` })
          }

          // ===== 清理所有旧版本 Agent =====
          sendLog(win, '清理旧版本 Agent...')
          // 停止所有可能的服务
          for (const svc of ['runixo-agent', 'serverhub-agent']) {
            await sshExec(conn, sudoCmd(`systemctl stop ${svc} 2>/dev/null || true`, rp))
            await sshExec(conn, sudoCmd(`systemctl disable ${svc} 2>/dev/null || true`, rp))
          }
          // 杀掉所有残留进程
          await sshExec(conn, sudoCmd('pkill -9 -f runixo-agent 2>/dev/null || true', rp))
          await sshExec(conn, sudoCmd('pkill -9 -f serverhub-agent 2>/dev/null || true', rp))
          // 删除旧二进制和服务文件
          await sshExec(conn, sudoCmd('rm -f /usr/local/bin/serverhub-agent /usr/local/bin/serverhub /etc/systemd/system/serverhub-agent.service', rp))
          await sshExec(conn, sudoCmd('rm -f /usr/local/bin/runixo-agent /usr/local/bin/runixo /etc/systemd/system/runixo-agent.service', rp))
          await sshExec(conn, sudoCmd('systemctl daemon-reload', rp))
          sendLog(win, '✓ 旧版本已清理', 'success')

          // ===== 下载并执行安装脚本 =====
          sendLog(win, '下载安装脚本...')
          const installScript = 'https://raw.githubusercontent.com/Zhang142857/runixo/security-test/scripts/install.sh'
          const installCmd = sudoCmd(`bash -c "curl -fsSL ${installScript} | bash"`, rp)
          
          sendLog(win, '执行安装脚本...')
          const installRes = await sshExec(conn, installCmd)
          
          // 调试：输出完整的安装脚本输出
          sendLog(win, `[DEBUG] exit code: ${installRes.code}`, 'info')
          sendLog(win, `[DEBUG] stdout length: ${installRes.stdout.length}`, 'info')
          sendLog(win, `[DEBUG] stderr length: ${installRes.stderr.length}`, 'info')
          sendLog(win, `[DEBUG] stdout: ${installRes.stdout}`, 'info')
          sendLog(win, `[DEBUG] stderr: ${installRes.stderr}`, 'error')
          
          if (installRes.code !== 0) {
            sendLog(win, `❌ 安装失败: ${installRes.stderr || installRes.stdout}`, 'error')
            conn.end()
            return resolve({ success: false, port: 0, token: '', certificate: '', error: '安装失败' })
          }
          
          sendLog(win, '✓ 安装完成', 'success')
          
          // 解析输出中的 token 和证书（移除 ANSI 颜色代码）
          const output = (installRes.stdout + '\n' + installRes.stderr).replace(/\x1b\[[0-9;]*m/g, '')
          sendLog(win, `[DEBUG] 清理后输出长度: ${output.length}`, 'info')
          sendLog(win, `[DEBUG] 输出最后200字符: ${output.slice(-200)}`, 'info')
          
          const tokenMatch = output.match(/Token:\s*([a-f0-9]{64})/i)
          const token = tokenMatch ? tokenMatch[1] : ''
          
          // 提取证书内容
          const certMatch = output.match(/-----BEGIN RUNIXO CERTIFICATE-----([\s\S]*?)-----END RUNIXO CERTIFICATE-----/)
          const certificate = certMatch ? certMatch[1].trim() : ''
          
          if (!token || token.length < 10) {
            sendLog(win, `❌ 未能获取令牌`, 'error')
            conn.end()
            return resolve({ success: false, port: 0, token: '', certificate: '', error: '未能获取令牌' })
          }
          
          sendLog(win, '✓ 令牌已获取', 'success')
          
          if (certificate) {
            sendLog(win, '✓ 证书已获取', 'success')
          } else {
            sendLog(win, '⚠ 未获取到证书，可能需要手动导入', 'error')
          }

          const port = 9527

          conn.end()
          resolve({ success: true, port, token, certificate, error: undefined })
        } catch (e: any) {
          sendLog(win, `❌ 安装出错: ${e.message}`, 'error')
          conn.end()
          resolve({ success: false, port: 0, token: '', certificate: '', error: e.message })
        }
      })

      sendLog(win, `连接 ${params.username}@${params.host}:${params.sshPort || 22}...`)
      conn.connect(connectConfig)
    })
  })
}
