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

    return new Promise<{ success: boolean; port: number; token: string; error?: string }>((resolve) => {
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
        resolve({ success: false, port: 0, token: '', error: err.message })
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
            return resolve({ success: false, port: 0, token: '', error: `不支持的架构: ${arch}` })
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

          // ===== 释放端口 =====
          const port = 9527
          sendLog(win, `检查端口 ${port} 占用...`)
          const portCheck = await sshExec(conn, sudoCmd(`lsof -ti:${port} 2>/dev/null || true`, rp))
          if (portCheck.stdout) {
            sendLog(win, `端口 ${port} 被占用，正在释放...`)
            await sshExec(conn, sudoCmd(`kill -9 $(lsof -ti:${port}) 2>/dev/null || true`, rp))
            await new Promise(r => setTimeout(r, 1000))
          }
          sendLog(win, `✓ 端口 ${port} 可用`, 'success')

          // ===== 下载 =====
          sendLog(win, '下载 Runixo Agent...')
          const dlUrl = 'https://raw.githubusercontent.com/Zhang142857/runixo/main/agent/runixo-agent-linux'
          const dlCmd = `curl -fsSL -o /tmp/runixo-agent "${dlUrl}" 2>&1 || wget -q -O /tmp/runixo-agent "${dlUrl}" 2>&1`
          const dlRes = await sshExec(conn, dlCmd)
          if (dlRes.code !== 0) {
            sendLog(win, `❌ 下载失败: ${dlRes.stderr || dlRes.stdout}`, 'error')
            conn.end()
            return resolve({ success: false, port: 0, token: '', error: '下载 Agent 失败' })
          }
          sendLog(win, '✓ 下载完成', 'success')

          // ===== 安装 =====
          sendLog(win, '安装 Agent...')
          await sshExec(conn, 'chmod +x /tmp/runixo-agent')
          await sshExec(conn, sudoCmd('mv /tmp/runixo-agent /usr/local/bin/runixo-agent', rp))
          await sshExec(conn, sudoCmd('mkdir -p /etc/runixo /var/lib/runixo', rp))
          sendLog(win, '✓ 安装完成', 'success')

          // ===== 生成 token =====
          sendLog(win, '生成认证令牌...')
          const tokenRes = await sshExec(conn, 'runixo-agent --gen-token 2>&1')
          const token = tokenRes.stdout.match(/:\s*(.+)/)?.[1]?.trim() || tokenRes.stdout.trim()
          if (!token || token.length < 10) {
            sendLog(win, `❌ 生成令牌失败: ${tokenRes.stdout} ${tokenRes.stderr}`, 'error')
            conn.end()
            return resolve({ success: false, port: 0, token: '', error: '生成令牌失败' })
          }
          sendLog(win, '✓ 令牌已生成', 'success')

          // ===== 写配置 =====
          const configYaml = `server:\n  host: "0.0.0.0"\n  port: ${port}\n  tls:\n    enabled: false\nauth:\n  token: "${token}"\nmetrics:\n  interval: 2\nlog:\n  level: "info"`
          await sshExec(conn, sudoCmd(`bash -c 'cat > /etc/runixo/agent.yaml << EOFCFG\n${configYaml}\nEOFCFG'`, rp))
          await sshExec(conn, sudoCmd('chmod 600 /etc/runixo/agent.yaml', rp))
          sendLog(win, '✓ 配置文件已写入', 'success')

          // ===== 创建 systemd 服务 =====
          sendLog(win, '配置系统服务...')
          const serviceUnit = `[Unit]\nDescription=Runixo Agent\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=/usr/local/bin/runixo-agent -config /etc/runixo/agent.yaml\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target`
          await sshExec(conn, sudoCmd(`bash -c 'cat > /etc/systemd/system/runixo-agent.service << EOFSVC\n${serviceUnit}\nEOFSVC'`, rp))
          await sshExec(conn, sudoCmd('systemctl daemon-reload', rp))
          await sshExec(conn, sudoCmd('systemctl enable runixo-agent', rp))
          await sshExec(conn, sudoCmd('systemctl start runixo-agent', rp))
          sendLog(win, '✓ 服务已启动', 'success')

          // ===== 等待就绪 =====
          sendLog(win, '等待 Agent 就绪...')
          let ready = false
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 2000))
            const status = await sshExec(conn, sudoCmd('systemctl is-active runixo-agent', rp))
            if (status.stdout === 'active') { ready = true; break }
          }
          if (!ready) {
            const logs = await sshExec(conn, sudoCmd('journalctl -u runixo-agent --no-pager -n 10', rp))
            sendLog(win, `⚠ Agent 可能未正常启动:\n${logs.stdout}`, 'error')
          } else {
            sendLog(win, '✓ Agent 已就绪！', 'success')
          }

          conn.end()
          resolve({ success: ready, port, token, error: ready ? undefined : 'Agent 启动超时' })
        } catch (e: any) {
          sendLog(win, `❌ 安装出错: ${e.message}`, 'error')
          conn.end()
          resolve({ success: false, port: 0, token: '', error: e.message })
        }
      })

      sendLog(win, `连接 ${params.username}@${params.host}:${params.sshPort || 22}...`)
      conn.connect(connectConfig)
    })
  })
}
