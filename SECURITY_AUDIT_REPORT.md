# Runixo 项目安全审计报告

**审计日期**: 2026-02-07  
**项目版本**: 当前开发版本  
**审计范围**: 全代码库深度审查  
**总体安全评分**: ⚠️ **6.2/10** (需立即修复多个严重问题)

---

## 🚨 严重安全漏洞 (P0 - 立即修复)

### 1. 认证机制严重缺陷
**位置**: `agent/internal/auth/auth.go:233-235`
```go
func ValidateToken(token string) bool {
    return len(token) >= TokenMinLength  // 仅检查长度！
}
```
**问题**: 
- Token 验证仅检查长度，没有任何加密验证
- Token 明文存储，无哈希保护
- 缺少时间戳验证，Token 永不过期
- 无防重放攻击机制

**影响**: 攻击者可以轻易伪造 Token，完全绕过认证系统

**修复建议**:
```go
// 使用 HMAC-SHA256 或 JWT
func ValidateToken(token string) (bool, error) {
    parts := strings.Split(token, ".")
    if len(parts) != 3 {
        return false, errors.New("invalid token format")
    }
    
    // 验证签名
    signature := hmac.New(sha256.New, secretKey)
    signature.Write([]byte(parts[0] + "." + parts[1]))
    expectedMAC := signature.Sum(nil)
    
    // 验证时间戳
    claims := parseTokenClaims(parts[1])
    if time.Now().Unix() > claims.ExpiresAt {
        return false, errors.New("token expired")
    }
    
    return hmac.Equal(expectedMAC, []byte(parts[2])), nil
}
```

---

### 2. 命令注入漏洞风险
**位置**: `client/src/main/ipc/handlers.ts:110-130`
**问题**: 
- 用户输入直接传递给 shell 执行
- 虽然 Agent 端有验证，但客户端缺少预验证
- 错误处理暴露系统详细信息

**位置**: `agent/internal/executor/executor.go:69-161`
```go
// 虽然有 ValidateCommand，但实现不够严格
cmd = exec.CommandContext(ctx, command, args...)
```

**攻击场景**:
```bash
# 恶意输入
command: "ls"
args: ["; rm -rf /"]  # 如果验证不严格可能绕过
```

**修复建议**:
- 使用命令白名单，禁止任意命令执行
- 参数必须经过严格转义
- 禁用 shell 解释器，直接执行二进制
- 添加命令审计日志

---

### 3. 敏感数据明文存储
**位置**: `client/src/renderer/stores/server.ts:120-125`
**问题**:
- Token、密码等敏感信息明文存储在 localStorage
- Electron 的 localStorage 可被轻易读取

**位置**: 多个配置文件中发现硬编码 Token
- `scripts/check-agent.js`
- `scripts/check-deploy.js`
- `scripts/upload-agent.js`

**修复建议**:
```typescript
// 使用 Electron safeStorage API
import { safeStorage } from 'electron'

function saveToken(token: string) {
  const encrypted = safeStorage.encryptString(token)
  localStorage.setItem('token', encrypted.toString('base64'))
}

function getToken(): string {
  const encrypted = Buffer.from(localStorage.getItem('token'), 'base64')
  return safeStorage.decryptString(encrypted)
}
```

---

### 4. SSRF 漏洞
**位置**: `proto/agent.proto` - `ProxyHttpRequest`
**问题**:
- 允许客户端通过 Agent 发起任意 HTTP 请求
- 可用于扫描内网、访问云元数据服务

**攻击场景**:
```javascript
// 攻击者可以访问 AWS 元数据
proxyHttpRequest({
  url: "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
})
```

**修复建议**:
- 实现 URL 白名单
- 禁止访问私有 IP 段 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- 禁止访问云元数据服务 (169.254.169.254)
- 添加请求审计

---

### 5. Electron CSP 配置过于宽松
**位置**: `client/src/main/index.ts:32-38`
```typescript
// 开发模式允许 unsafe-inline 和 unsafe-eval
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval'"]
    }
  })
})
```

**问题**: 
- `unsafe-inline` 和 `unsafe-eval` 允许执行任意脚本
- 即使在开发模式，也应该严格限制

**修复建议**:
```typescript
const csp = isDev 
  ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  : "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'"
```

---

## ⚠️ 高危问题 (P1 - 短期修复)

### 6. 资源泄漏 - Goroutine 泄漏
**位置**: `agent/internal/server/grpc.go:493`
**问题**:
- 流式 RPC 中启动的 goroutine 没有正确清理
- 客户端断开连接时，goroutine 可能继续运行

**修复建议**:
```go
func (s *AgentServer) GetMetrics(req *pb.MetricsRequest, stream pb.AgentService_GetMetricsServer) error {
    ctx := stream.Context()
    ticker := time.NewTicker(time.Duration(req.IntervalSeconds) * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()  // 确保退出
        case <-ticker.C:
            // 发送指标
        }
    }
}
```

---

### 7. 资源泄漏 - PTY 进程泄漏
**位置**: Shell 会话管理
**问题**:
- PTY 进程在客户端断开后可能继续运行
- 没有超时机制

**修复建议**:
- 实现会话超时 (30分钟无活动自动关闭)
- 客户端断开时立即清理所有相关进程
- 添加进程监控和自动清理

---

### 8. 资源泄漏 - 文件句柄泄漏
**位置**: 文件操作相关代码
**问题**:
- 某些错误路径下文件未关闭
- 大文件上传/下载可能耗尽文件描述符

**修复建议**:
```go
func readFile(path string) ([]byte, error) {
    f, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer f.Close()  // 确保所有路径都关闭
    
    return io.ReadAll(f)
}
```

---

### 9. 并发安全 - Map 并发访问
**位置**: `client/src/main/ipc/handlers.ts:15-20`
```typescript
const serverConnections = new Map<string, GrpcClient>()
const activeStreams = new Map<string, any>()
const activeShells = new Map<string, any>()
```

**问题**:
- JavaScript Map 在多个 IPC 处理器中并发访问
- 没有锁保护，可能导致数据竞争

**修复建议**:
- 使用异步队列串行化访问
- 或使用支持并发的数据结构

---

### 10. XSS 防护不足
**位置**: `client/src/renderer/views/AIAssistant.vue:45-50`
**问题**:
- AI 返回的内容直接渲染，未转义
- 用户输入的命令输出未过滤

**修复建议**:
```typescript
import DOMPurify from 'dompurify'

function sanitizeOutput(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'code', 'pre'],
    ALLOWED_ATTR: []
  })
}
```

---

### 11. 错误信息泄露
**位置**: `client/src/main/ipc/handlers.ts:25-30`
**问题**:
- 详细错误信息直接返回给前端
- 可能暴露系统路径、版本信息等

**修复建议**:
```typescript
catch (error) {
  console.error('[Internal]', error)  // 仅记录到日志
  return { 
    success: false, 
    error: '操作失败，请稍后重试'  // 通用错误信息
  }
}
```

---

## 🔶 中等问题 (P2 - 中期修复)

### 12. 内存泄漏 - 事件监听器未清理
**位置**: `client/src/preload/index.ts:100-110`
**问题**:
- IPC 事件监听器注册后从不移除
- 长时间运行会累积大量监听器

**修复建议**:
```typescript
// 返回清理函数
function onMetrics(callback: Function) {
  const handler = (_, data) => callback(data)
  ipcRenderer.on('metrics', handler)
  
  return () => ipcRenderer.removeListener('metrics', handler)
}
```

---

### 13. 内存泄漏 - 流未超时清理
**位置**: `client/src/main/ipc/handlers.ts:60-75`
**问题**:
- 活跃流存储在 Map 中，但没有超时清理机制

**修复建议**:
```typescript
const streamTimeouts = new Map<string, NodeJS.Timeout>()

function registerStream(id: string, stream: any) {
  activeStreams.set(id, stream)
  
  // 30分钟超时
  const timeout = setTimeout(() => {
    stream.cancel()
    activeStreams.delete(id)
    streamTimeouts.delete(id)
  }, 30 * 60 * 1000)
  
  streamTimeouts.set(id, timeout)
}
```

---

### 14. TypeScript 类型不安全
**位置**: `client/src/renderer/stores/ai.ts:15-20`
**问题**:
- 大量使用 `any` 和 `unknown` 类型
- 失去类型检查保护

**修复建议**:
```typescript
// 定义明确的类型
interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface AIResponse {
  message: AIMessage
  toolCalls?: ToolCall[]
}
```

---

### 15. 插件安全隔离不足
**位置**: `agent/internal/plugin/manager.go`
**问题**:
- 插件可以访问所有系统 API
- 没有权限细粒度控制
- 插件间可能相互干扰

**修复建议**:
- 实现插件沙箱 (使用 seccomp/AppArmor)
- 细粒度权限控制 (文件访问、网络访问、命令执行)
- 资源配额限制 (CPU、内存、磁盘)

---

### 16. 路径遍历保护不足
**位置**: `agent/internal/security/security.go:190-214`
**问题**:
- 路径验证可能被符号链接绕过
- 没有检查 TOCTOU (Time-of-check to time-of-use) 问题

**修复建议**:
```go
func (v *PathValidator) ValidatePath(path string) error {
    // 解析符号链接
    realPath, err := filepath.EvalSymlinks(path)
    if err != nil {
        return err
    }
    
    // 检查是否在允许的根目录下
    for _, allowedRoot := range v.config.AllowedRoots {
        if strings.HasPrefix(realPath, allowedRoot) {
            return nil
        }
    }
    
    return fmt.Errorf("path outside allowed roots")
}
```

---

## 📊 性能问题

### 17. 阻塞操作
**位置**: `agent/internal/executor/executor.go:136-137`
```go
stdoutBytes, _ := io.ReadAll(stdout)
stderrBytes, _ := io.ReadAll(stderr)
```

**问题**:
- 同步读取可能阻塞
- 大输出会占用大量内存

**修复建议**:
- 使用流式读取
- 限制输出大小
- 实现背压控制

---

### 18. 缺少连接池
**位置**: gRPC 客户端
**问题**:
- 每次请求可能创建新连接
- 没有连接复用

**修复建议**:
- 实现连接池
- 配置 keepalive
- 设置合理的连接超时

---

### 19. 不必要的重渲染
**位置**: `client/src/renderer/views/AIAssistant.vue:60-65`
**问题**:
- 大量消息列表没有虚拟滚动
- 每次新消息都重新渲染整个列表

**修复建议**:
```vue
<template>
  <RecycleScroller
    :items="messages"
    :item-size="80"
    key-field="id"
  >
    <template #default="{ item }">
      <MessageItem :message="item" />
    </template>
  </RecycleScroller>
</template>
```

---

## 🏗️ 架构和设计问题

### 20. API 设计 - 单一职责违反
**位置**: `proto/agent.proto`
**问题**:
- `AgentService` 承担过多职责
- 系统监控、文件操作、Docker、HTTP 代理混在一起

**修复建议**:
```protobuf
service SystemService {
  rpc GetMetrics(...) returns (...);
  rpc GetProcesses(...) returns (...);
}

service FileService {
  rpc ReadFile(...) returns (...);
  rpc WriteFile(...) returns (...);
}

service DockerService {
  rpc ListContainers(...) returns (...);
  rpc CreateContainer(...) returns (...);
}
```

---

### 21. 缺少 API 版本控制
**位置**: `proto/agent.proto`
**问题**:
- 没有版本标识
- 无法平滑升级

**修复建议**:
```protobuf
syntax = "proto3";

package runixo.agent.v1;  // 添加版本

option go_package = "github.com/runixo/agent/api/v1";
```

---

### 22. 消息大小无限制
**位置**: `proto/agent.proto`
```protobuf
message FileContent {
  bytes content = 2;  // 无大小限制
}
```

**问题**:
- 可能导致内存溢出
- 可被用于 DoS 攻击

**修复建议**:
```go
const MaxFileSize = 100 * 1024 * 1024  // 100MB

func (s *AgentServer) ReadFile(ctx context.Context, req *pb.FileRequest) (*pb.FileContent, error) {
    info, err := os.Stat(req.Path)
    if err != nil {
        return nil, err
    }
    
    if info.Size() > MaxFileSize {
        return nil, status.Errorf(codes.InvalidArgument, "file too large")
    }
    
    // ...
}
```

---

### 23. 缺少流量控制
**位置**: 流式 RPC
**问题**:
- `GetMetrics`、`TailLog` 等流式操作没有背压控制
- 客户端处理慢时会累积大量数据

**修复建议**:
- 实现滑动窗口
- 客户端确认机制
- 自动降级采样率

---

## 🔧 代码质量问题

### 24. 错误处理不一致
**位置**: 多处
**问题**:
- 有些地方返回 error，有些返回 nil
- 错误信息格式不统一

**修复建议**:
- 统一错误处理模式
- 使用 `errors.Is` 和 `errors.As`
- 定义标准错误类型

---

### 25. 大量 TODO 标记
**位置**: 79 处 TODO/FIXME
**问题**:
- 功能未完成
- 可能存在未知风险

**关键 TODO**:
- `client/src/renderer/views/ObjectStorage.vue:394` - 云存储 API 未实现
- `client/src/main/backup/backup-engine.ts:389` - 恢复逻辑未实现
- `client/src/main/plugins/loader.ts:309` - 插件下载未实现

---

### 26. 空插件目录
**位置**: `plugins/docker/`, `plugins/nginx/`, `plugins/mysql/`
**问题**:
- 官方插件未实现
- 文档中声称支持但实际不可用

---

### 27. 依赖版本问题
**位置**: `package.json`, `go.mod`
**问题**:
- 某些依赖版本较旧
- 需要运行 `npm audit` 和 `go list -m -u all` 检查漏洞

**建议**:
```bash
# 检查 npm 依赖漏洞
cd client && npm audit

# 检查 Go 依赖更新
cd agent && go list -m -u all

# 使用 Snyk 或 Dependabot 自动化检查
```

---

## 📋 修复优先级总结

### 🔴 立即修复 (1-2 天)
1. ✅ 重新实现 Token 认证机制 (使用 JWT 或 HMAC)
2. ✅ 删除所有硬编码的认证令牌
3. ✅ 修复命令注入漏洞 (严格白名单)
4. ✅ 使用 Electron safeStorage 加密敏感数据
5. ✅ 修复 SSRF 漏洞 (URL 白名单)

### 🟠 短期修复 (1 周)
6. ✅ 修复所有资源泄漏 (goroutine, PTY, 文件句柄)
7. ✅ 加强并发安全 (Map 访问保护)
8. ✅ 实现 XSS 防护 (输入输出过滤)
9. ✅ 严格化 CSP 配置
10. ✅ 过滤错误信息泄露

### 🟡 中期修复 (2-4 周)
11. ✅ 修复内存泄漏 (事件监听器、流超时)
12. ✅ 强化 TypeScript 类型安全
13. ✅ 实现插件沙箱和权限控制
14. ✅ 改进路径遍历保护
15. ✅ 优化性能问题 (虚拟滚动、连接池)

### 🟢 长期改进 (1-3 月)
16. ✅ 重构 API 设计 (服务拆分、版本控制)
17. ✅ 实现完整的审计日志
18. ✅ 添加速率限制和 DoS 防护
19. ✅ 完成所有 TODO 功能
20. ✅ 建立自动化安全扫描 (CI/CD)

---

## 🛡️ 安全最佳实践建议

### 1. 实施纵深防御
- 客户端验证 + Agent 验证
- 多层权限检查
- 最小权限原则

### 2. 建立安全开发流程
- 代码审查必须包含安全检查
- 使用静态分析工具 (gosec, eslint-plugin-security)
- 定期进行渗透测试

### 3. 加强监控和审计
- 记录所有敏感操作
- 实时告警异常行为
- 定期审查日志

### 4. 依赖管理
- 使用 Dependabot 自动更新
- 定期扫描已知漏洞
- 锁定依赖版本

### 5. 文档和培训
- 编写安全开发指南
- 团队安全培训
- 建立漏洞响应流程

---

## 📈 改进后预期评分

修复所有 P0 和 P1 问题后，预期安全评分可提升至 **8.5/10**

---

**审计人员**: Kiro AI Security Audit  
**报告生成时间**: 2026-02-07 21:31:42
