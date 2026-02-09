<div align="center">
  <img src="assets/logo.svg" width="80" height="80" alt="Runixo">
  <h1>Runixo</h1>
  <p><strong>AI-Native Server Management Platform</strong></p>
  <p>安全优先的服务器管理平台。零暴露架构，AI 驱动运维。</p>

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

## 🔒 为什么需要 Runixo？

**传统服务器面板最大的问题是安全。**

它们需要在服务器上开放 Web 端口，面板本身就是一个暴露在公网的攻击面——一旦面板存在漏洞，攻击者可以直接获取服务器 root 权限。

Runixo 从架构层面解决了这个问题：

| | 传统 Web 面板 | Runixo |
|---|---|---|
| **攻击面** | 服务器开放 Web 端口，面板暴露在公网 | **Agent 零 Web 端口**，不暴露任何 HTTP 服务 |
| **通信安全** | HTTP/HTTPS，面板自身可能被中间人攻击 | **gRPC + TLS 端到端加密**，TOFU 证书指纹验证 |
| **认证机制** | 用户名密码，容易被暴力破解 | **Token 认证 + 自动过期 + 暴力破解防护** |
| **权限控制** | 面板拥有完整 root 权限 | **命令白名单 + 路径访问控制 + 审计日志** |
| **更新安全** | 面板自更新，无校验 | **SHA256 校验和验证**，防止供应链攻击 |
| **插件安全** | 插件直接运行在服务器 | **沙箱隔离 + 权限声明 + SSRF 防护** |

> **核心理念：服务器上不应该运行任何 Web 服务来管理自己。**

---

## 🔑 安全架构

```
┌─────────────────────────────────────────────────┐
│          Runixo Client (你的电脑)                │
│    Electron 桌面应用 · 不经过任何第三方服务器       │
└──────────────────┬──────────────────────────────┘
                   │ gRPC + TLS（端到端加密，直连）
┌──────────────────▼──────────────────────────────┐
│          Runixo Agent (你的服务器)               │
│    零 Web 端口 · 命令白名单 · 路径控制 · 审计日志   │
└─────────────────────────────────────────────────┘
```

- **零暴露**：Agent 不开放任何 Web 端口，攻击者无法通过浏览器访问
- **直连加密**：客户端与 Agent 直接通信，TLS 端到端加密，不经过中间服务器
- **TOFU 验证**：首次连接记录证书指纹，后续连接自动验证，防止中间人攻击
- **最小权限**：命令白名单默认开启，禁止 `rm`/`chmod`/`sudo` 等危险操作
- **审计追踪**：所有操作记录审计日志，可追溯每一条命令的执行

---

## ✨ 功能特性

### 🤖 AI 驱动运维

用自然语言和服务器对话。AI 理解你的意图，执行命令，分析输出，诊断问题并给出修复方案。

### 🐳 完整 Docker 管理

容器、镜像、网络、卷、Compose 编排——全部可视化管理，支持实时日志和终端。

### 📊 实时监控

CPU、内存、磁盘、网络实时图表，进程管理，服务状态一目了然。

### 🌐 云服务集成

Cloudflare DNS/SSL/缓存/Tunnel，阿里云、腾讯云、DigitalOcean 等云平台集成。

### 🧩 插件生态

通过插件扩展功能。官方提供 Cloudflare、Nginx、DevOps 助手等插件，也可以用 [SDK](https://github.com/Zhang142857/runixo-sdk) 开发自己的插件。

### 📁 文件管理 & 💻 Web 终端

可视化文件浏览器 + 内置 SSH 终端，支持多标签页。

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
    <td align="center"><b>通用设置</b></td>
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

## 📦 项目仓库

| 仓库 | 说明 | 技术栈 |
|---|---|---|
| [**runixo**](https://github.com/Zhang142857/runixo)（本仓库） | 桌面客户端 | Electron 28 + Vue 3 + TypeScript |
| [**runixo-agent**](https://github.com/Zhang142857/runixo-agent) | 服务器 Agent | Go 1.22 + gRPC |
| [**runixo-sdk**](https://github.com/Zhang142857/runixo-sdk) | 插件 SDK | TypeScript |

---

## 🛠️ 本地开发

```bash
git clone https://github.com/Zhang142857/runixo.git
cd runixo/client && pnpm install && pnpm electron:dev
```

---

## 📄 License

[MIT](LICENSE)
