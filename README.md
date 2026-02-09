<div align="center">
  <img src="server/src/public/logo.svg" width="80" height="80" alt="Runixo">
  <h1>Runixo</h1>
  <p><strong>AI-Native Server Management Platform</strong></p>
  <p>用自然语言管理你的服务器。安全优先，插件驱动。</p>

  <p>
    <a href="https://runixo.top">🌐 官网</a> ·
    <a href="https://runixo.top/guide/">📖 文档</a> ·
    <a href="https://github.com/Zhang142857/runixo/releases">⬇️ 下载</a> ·
    <a href="./README_CN.md">中文</a>
  </p>

  <p>
    <a href="https://github.com/Zhang142857/runixo/releases"><img src="https://img.shields.io/github/v/release/Zhang142857/runixo?style=flat-square&color=6366f1" alt="Release"></a>
    <a href="https://github.com/Zhang142857/runixo/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Zhang142857/runixo?style=flat-square" alt="License"></a>
    <a href="https://github.com/Zhang142857/runixo/stargazers"><img src="https://img.shields.io/github/stars/Zhang142857/runixo?style=flat-square" alt="Stars"></a>
    <a href="https://github.com/Zhang142857/runixo/releases"><img src="https://img.shields.io/github/downloads/Zhang142857/runixo/total?style=flat-square" alt="Downloads"></a>
  </p>
</div>

<br>

<p align="center">
  <img src="screenshots/01-dashboard.png" width="800" alt="Runixo Dashboard">
</p>

---

## ✨ 为什么选择 Runixo？

传统服务器面板需要在服务器上开放 Web 端口，暴露在公网中。Runixo 完全不同：

| | 传统面板 (宝塔/1Panel) | Runixo |
|---|---|---|
| **安全模型** | 服务器开放 Web 端口，暴露在公网 | Agent 零 Web 端口，仅 gRPC + TLS 加密通信 |
| **操作方式** | 浏览器登录面板，手动点击 | 桌面客户端 + 自然语言：*"重启 nginx 并查看日志"* |
| **故障排查** | 自己 SSH 上去查日志、搜报错 | AI 自动诊断问题，给出修复建议 |
| **扩展性** | 功能固定，等官方更新 | 插件生态，按需安装，支持自定义开发 |
| **多服务器** | 每台服务器装一个面板 | 一个客户端管理所有服务器 |

---

## 🔑 核心功能

### 🔒 零暴露安全架构

Agent 不开放任何 Web 端口，所有通信通过 gRPC + TLS 端到端加密。支持 Token 认证、暴力破解防护、命令白名单、路径访问控制。

### 🤖 AI 驱动运维

用自然语言和服务器对话。AI 理解你的意图，执行命令，分析输出，诊断问题并给出修复方案。

### 🐳 完整 Docker 管理

容器、镜像、网络、卷、Compose 编排——全部可视化管理，支持实时日志和终端。

### 📊 实时监控

CPU、内存、磁盘、网络实时图表，进程管理，服务状态一目了然。

### 🌐 云服务集成

Cloudflare DNS/SSL/缓存/Tunnel 管理，阿里云、腾讯云、DigitalOcean 等云平台集成。

### 🧩 插件生态

通过插件扩展功能。官方提供 Cloudflare、Nginx、DevOps 助手等插件，也可以用 SDK 开发自己的插件。

### 📁 文件管理

可视化文件浏览器，支持上传、下载、编辑、权限管理，内置代码编辑器。

### 💻 Web 终端

内置 SSH 终端，支持多标签页，直接在客户端中操作服务器。

---

## 📸 界面预览

<table>
  <tr>
    <td><img src="screenshots/01-dashboard.png" alt="仪表盘"></td>
    <td><img src="screenshots/02-cloud-services.png" alt="云服务"></td>
  </tr>
  <tr>
    <td align="center"><b>仪表盘</b> — 服务器状态总览</td>
    <td align="center"><b>云服务</b> — 多平台云服务管理</td>
  </tr>
  <tr>
    <td><img src="screenshots/03-cloudflare-dns.png" alt="DNS 管理"></td>
    <td><img src="screenshots/04-cloudflare-ssl.png" alt="SSL 管理"></td>
  </tr>
  <tr>
    <td align="center"><b>DNS 管理</b> — Cloudflare DNS 记录</td>
    <td align="center"><b>SSL 管理</b> — 证书配置与部署</td>
  </tr>
  <tr>
    <td><img src="screenshots/03-settings-general.png" alt="设置"></td>
    <td><img src="screenshots/04-settings-ai.png" alt="AI 设置"></td>
  </tr>
  <tr>
    <td align="center"><b>通用设置</b> — 外观与行为配置</td>
    <td align="center"><b>AI 设置</b> — 模型与提供商配置</td>
  </tr>
</table>

---

## 🚀 快速开始

### 1. 下载客户端

| 平台 | 下载 |
|------|------|
| Windows | `Runixo-Setup-x.x.x.exe` |
| macOS | `Runixo-x.x.x.dmg` |
| Linux | `Runixo-x.x.x.AppImage` / `.deb` |

👉 [前往 Releases 下载](https://github.com/Zhang142857/runixo/releases)

### 2. 安装 Agent

**方式一：客户端 SSH 一键安装（推荐）**

客户端 → 服务器 → SSH 安装 → 输入连接信息 → 完成。全自动。

**方式二：命令行安装**

```bash
curl -fsSL https://raw.githubusercontent.com/Zhang142857/runixo-agent/main/scripts/install.sh | sudo bash
```

安装完成后查看连接信息：

```bash
sudo runixo info
```

### 3. 连接

在客户端中添加服务器，输入 IP、端口和 Token，即可开始管理。

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────┐
│          Runixo Client (Electron)               │
│    Vue 3 + TypeScript  │  AI Engine  │  Plugins │
└──────────────────┬──────────────────────────────┘
                   │ gRPC + TLS (端到端加密)
┌──────────────────▼──────────────────────────────┐
│          Runixo Agent (Go, ~15MB)               │
│  命令执行 │ Docker │ 监控 │ 文件 │ 插件 │ 自动更新 │
└─────────────────────────────────────────────────┘
```

- **Client**：Electron 桌面应用，Vue 3 + TypeScript，内置插件系统和 AI 引擎
- **Agent**：单个 Go 二进制，<1% CPU 占用，无数据库依赖，支持 7 个平台
- **通信**：gRPC + TLS 加密，Token 认证，暴力破解防护，命令白名单

---

## 📦 项目仓库

| 仓库 | 说明 | 技术栈 |
|---|---|---|
| [**runixo**](https://github.com/Zhang142857/runixo)（本仓库） | 桌面客户端 | Electron 28 + Vue 3 + TypeScript |
| [**runixo-agent**](https://github.com/Zhang142857/runixo-agent) | 服务器 Agent | Go 1.22 + gRPC |
| [**runixo-sdk**](https://github.com/Zhang142857/runixo-sdk) | 插件 SDK | TypeScript |

---

## 🧩 插件开发

使用 [Runixo SDK](https://github.com/Zhang142857/runixo-sdk) 开发自定义插件：

```bash
npx runixo-sdk create my-plugin
cd my-plugin && npm install && npm run build && npm run pack
```

将生成的 `.shplugin` 文件拖入客户端即可安装。详见 [插件开发指南](https://runixo.top/guide/plugins)。

---

## 🛠️ 本地开发

```bash
# 克隆
git clone https://github.com/Zhang142857/runixo.git
cd runixo

# 客户端开发
cd client && pnpm install && pnpm electron:dev
```

---

## 📄 License

[MIT](LICENSE)
