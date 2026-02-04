# 服务器恢复步骤

Agent 服务因为上传失败导致二进制文件被清空，需要手动恢复。

## 方法 1: 使用安装脚本重新安装

SSH 登录服务器后执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Zhang142857/serverhub/main/scripts/install.sh | sudo bash
```

这会重新下载并安装最新的 agent。

## 方法 2: 手动下载 GitHub Release

```bash
# 下载最新 release
wget https://github.com/Zhang142857/serverhub/releases/latest/download/serverhub-agent-linux-amd64 -O /usr/local/bin/serverhub-agent
chmod +x /usr/local/bin/serverhub-agent

# 重启服务
systemctl restart serverhub-agent

# 检查状态
systemctl status serverhub-agent
```

## 恢复后

恢复后，agent 将是 GitHub Actions 构建的版本 (v0.1.7)，不包含 REST API 功能。

要添加 REST API 功能，需要：
1. 在本地重新编译带 API 的版本
2. 通过 SCP 直接上传到服务器（而不是通过 gRPC）

```bash
# 从本地上传（在 Windows PowerShell 中）
scp agent/serverhub-agent-linux user@3.143.142.246:/tmp/serverhub-agent-new

# 在服务器上替换
sudo mv /tmp/serverhub-agent-new /usr/local/bin/serverhub-agent
sudo chmod +x /usr/local/bin/serverhub-agent
sudo systemctl restart serverhub-agent
```
