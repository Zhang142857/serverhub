<div align="center">
  <img src="server/src/public/logo.svg" width="80" height="80" alt="Runixo">
  <h1>Runixo</h1>
  <p><strong>AI-Native 服务器管理平台</strong></p>
  <p>将 AI 能力深度融合到服务器运维的每个环节</p>

  <p>
    <a href="https://github.com/Zhang142857/runixo/releases"><img src="https://img.shields.io/github/v/release/Zhang142857/runixo?style=flat-square&color=6366f1" alt="Release"></a>
    <a href="https://github.com/Zhang142857/runixo/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Zhang142857/runixo?style=flat-square" alt="License"></a>
    <a href="https://github.com/Zhang142857/runixo/stargazers"><img src="https://img.shields.io/github/stars/Zhang142857/runixo?style=flat-square" alt="Stars"></a>
    <a href="https://github.com/Zhang142857/runixo/releases"><img src="https://img.shields.io/github/downloads/Zhang142857/runixo/total?style=flat-square" alt="Downloads"></a>
  </p>

  <p>
    <a href="https://runixo.top">官网</a> ·
    <a href="https://runixo.top/guide/">文档</a> ·
    <a href="https://github.com/Zhang142857/runixo/releases">下载</a> ·
    <a href="./README.md">English</a>
  </p>
</div>

<br>

<p align="center">
  <img src="screenshots/01-dashboard.png" width="800" alt="Runixo Dashboard">
</p>

## 特性

- 🔒 **零暴露安全架构** — Agent 不开放 Web 端口，gRPC + TLS 端到端加密
- 🤖 **AI 深度融合** — 自然语言运维、智能故障诊断、自动化工作流
- 🖥️ **多服务器管理** — 一个客户端管理所有服务器，批量操作、跨节点编排
- 🐳 **完整容器管理** — Docker 容器/镜像/网络/卷/Compose 全生命周期管理
- 🧩 **插件生态** — 插件市场，功能即装即用，支持自定义开发
- ☁️ **云服务集成** — Cloudflare DNS/SSL/缓存等一键管理
- 📊 **实时监控** — CPU、内存、磁盘、网络实时指标图表

## 快速开始

### 1. 下载客户端

从 [Releases](https://github.com/Zhang142857/runixo/releases) 下载：

| 平台 | 文件 |
|------|------|
| Windows | `Runixo-Setup-x.x.x.exe` |
| macOS | `Runixo-x.x.x.dmg` |
| Linux | `Runixo-x.x.x.AppImage` |

### 2. 安装 Agent

**方式一：SSH 自动安装（推荐）**

客户端 →「服务器」→「SSH 安装」→ 填写连接信息 → 自动完成。

**方式二：一键脚本**

```bash
curl -fsSL https://raw.githubusercontent.com/Zhang142857/runixo/security-test/scripts/install.sh | sudo bash
sudo runixo info
```

### 3. 连接

在客户端添加服务器：填写 IP、端口、Token 即可。

## 架构

```
┌──────────────────────────────────────────────┐
│           Runixo Client (Electron)           │
│   Vue 3 + TypeScript  │  AI 模块  │  插件    │
└──────────────┬───────────────────────────────┘
               │ gRPC + TLS（加密）
┌──────────────▼───────────────────────────────┐
│           Runixo Agent (Go, ~15MB)           │
│   命令执行  │  Docker  │  监控  │  文件管理   │
└──────────────────────────────────────────────┘
```

## 开发

```bash
# 客户端
cd client && pnpm install && pnpm electron:dev

# Agent
cd agent && go run cmd/agent/main.go

# 官网
cd server && npm install && npm run dev
```

## 许可证

[MIT](LICENSE)
