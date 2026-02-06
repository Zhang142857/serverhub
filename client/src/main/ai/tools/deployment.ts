/**
 * 部署工具定义
 * 包含应用部署、Nginx配置、SSL证书等工具
 */

import { ToolDefinition, ToolContext, ToolResult } from './registry'
import { randomBytes } from 'crypto'

// 应用模板定义
interface AppTemplate {
  id: string
  name: string
  keywords: string[]
  category: string
  description: string
  image: string
  defaultPort: number
  envVars: Array<{ name: string; label: string; default?: string; required?: boolean; secret?: boolean }>
  volumes: Array<{ container: string; host: string; label: string }>
  dependencies?: string[]
  healthCheck?: { path: string; port: number }
}

// 验证函数
function validateDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return domainRegex.test(domain) && domain.length <= 253
}

function validateHost(host: string): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  
  if (ipRegex.test(host)) {
    const parts = host.split('.').map(Number)
    return parts.every(part => part >= 0 && part <= 255)
  }
  return hostnameRegex.test(host) || host === 'localhost'
}

function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

function validateContainerName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name) && name.length <= 255
}

function validatePath(path: string): boolean {
  return !path.includes('..') && path.startsWith('/')
}

// 预置应用模板
const appTemplates: AppTemplate[] = [
  {
    id: 'nginx',
    name: 'Nginx',
    keywords: ['nginx', 'web服务器', 'web server', '静态网站', 'static'],
    category: 'webserver',
    description: '高性能 Web 服务器和反向代理',
    image: 'nginx:alpine',
    defaultPort: 80,
    envVars: [],
    volumes: [
      { container: '/usr/share/nginx/html', host: '/var/www/html', label: '网站根目录' },
      { container: '/etc/nginx/conf.d', host: '/etc/nginx/conf.d', label: '配置目录' }
    ]
  },
  {
    id: 'mysql',
    name: 'MySQL',
    keywords: ['mysql', '数据库', 'database', 'db', 'sql'],
    category: 'database',
    description: 'MySQL 关系型数据库',
    image: 'mysql:8.0',
    defaultPort: 3306,
    envVars: [
      { name: 'MYSQL_ROOT_PASSWORD', label: 'Root密码', required: true, secret: true },
      { name: 'MYSQL_DATABASE', label: '默认数据库', default: 'app' },
      { name: 'MYSQL_USER', label: '用户名', default: 'app' },
      { name: 'MYSQL_PASSWORD', label: '用户密码', secret: true }
    ],
    volumes: [
      { container: '/var/lib/mysql', host: '/var/lib/mysql', label: '数据目录' }
    ]
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    keywords: ['postgresql', 'postgres', 'pg', '数据库', 'database'],
    category: 'database',
    description: 'PostgreSQL 关系型数据库',
    image: 'postgres:16-alpine',
    defaultPort: 5432,
    envVars: [
      { name: 'POSTGRES_PASSWORD', label: '密码', required: true, secret: true },
      { name: 'POSTGRES_USER', label: '用户名', default: 'postgres' },
      { name: 'POSTGRES_DB', label: '默认数据库', default: 'app' }
    ],
    volumes: [
      { container: '/var/lib/postgresql/data', host: '/var/lib/postgresql/data', label: '数据目录' }
    ]
  },
  {
    id: 'redis',
    name: 'Redis',
    keywords: ['redis', '缓存', 'cache', 'kv', '键值'],
    category: 'cache',
    description: 'Redis 内存数据库/缓存',
    image: 'redis:alpine',
    defaultPort: 6379,
    envVars: [],
    volumes: [
      { container: '/data', host: '/var/lib/redis', label: '数据目录' }
    ]
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    keywords: ['mongodb', 'mongo', 'nosql', '文档数据库'],
    category: 'database',
    description: 'MongoDB 文档数据库',
    image: 'mongo:7',
    defaultPort: 27017,
    envVars: [
      { name: 'MONGO_INITDB_ROOT_USERNAME', label: '管理员用户名', default: 'admin' },
      { name: 'MONGO_INITDB_ROOT_PASSWORD', label: '管理员密码', required: true, secret: true }
    ],
    volumes: [
      { container: '/data/db', host: '/var/lib/mongodb', label: '数据目录' }
    ]
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    keywords: ['wordpress', 'wp', '博客', 'blog', 'cms'],
    category: 'cms',
    description: 'WordPress 博客/CMS 系统',
    image: 'wordpress:latest',
    defaultPort: 80,
    envVars: [
      { name: 'WORDPRESS_DB_HOST', label: '数据库地址', default: 'mysql:3306' },
      { name: 'WORDPRESS_DB_USER', label: '数据库用户', default: 'wordpress' },
      { name: 'WORDPRESS_DB_PASSWORD', label: '数据库密码', required: true, secret: true },
      { name: 'WORDPRESS_DB_NAME', label: '数据库名', default: 'wordpress' }
    ],
    volumes: [
      { container: '/var/www/html', host: '/var/www/wordpress', label: '网站目录' }
    ],
    dependencies: ['mysql']
  },
  {
    id: 'ghost',
    name: 'Ghost',
    keywords: ['ghost', '博客', 'blog'],
    category: 'cms',
    description: 'Ghost 现代博客平台',
    image: 'ghost:5-alpine',
    defaultPort: 2368,
    envVars: [
      { name: 'url', label: '站点URL', default: 'http://localhost:2368' }
    ],
    volumes: [
      { container: '/var/lib/ghost/content', host: '/var/lib/ghost', label: '内容目录' }
    ]
  },
  {
    id: 'nextcloud',
    name: 'Nextcloud',
    keywords: ['nextcloud', '网盘', '云盘', 'cloud', 'storage'],
    category: 'storage',
    description: 'Nextcloud 私有云存储',
    image: 'nextcloud:latest',
    defaultPort: 80,
    envVars: [
      { name: 'MYSQL_HOST', label: '数据库地址', default: 'mysql' },
      { name: 'MYSQL_DATABASE', label: '数据库名', default: 'nextcloud' },
      { name: 'MYSQL_USER', label: '数据库用户', default: 'nextcloud' },
      { name: 'MYSQL_PASSWORD', label: '数据库密码', required: true, secret: true }
    ],
    volumes: [
      { container: '/var/www/html', host: '/var/www/nextcloud', label: '应用目录' }
    ],
    dependencies: ['mysql']
  },
  {
    id: 'gitea',
    name: 'Gitea',
    keywords: ['gitea', 'git', '代码仓库', 'repository'],
    category: 'devtools',
    description: 'Gitea 轻量级 Git 服务',
    image: 'gitea/gitea:latest',
    defaultPort: 3000,
    envVars: [
      { name: 'USER_UID', label: '用户UID', default: '1000' },
      { name: 'USER_GID', label: '用户GID', default: '1000' }
    ],
    volumes: [
      { container: '/data', host: '/var/lib/gitea', label: '数据目录' }
    ]
  },
  {
    id: 'portainer',
    name: 'Portainer',
    keywords: ['portainer', 'docker管理', 'container'],
    category: 'devtools',
    description: 'Portainer Docker 管理界面',
    image: 'portainer/portainer-ce:latest',
    defaultPort: 9000,
    envVars: [],
    volumes: [
      { container: '/data', host: '/var/lib/portainer', label: '数据目录' },
      { container: '/var/run/docker.sock', host: '/var/run/docker.sock', label: 'Docker Socket' }
    ]
  }
]

// 生成安全的随机密码
function generatePassword(length: number = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  const randomValues = randomBytes(length)
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(randomValues[i] % chars.length)
  }
  return password
}

// 匹配应用模板
function matchTemplate(description: string): AppTemplate | null {
  const lowerDesc = description.toLowerCase()
  let bestMatch: AppTemplate | null = null
  let bestScore = 0

  for (const template of appTemplates) {
    let score = 0
    for (const keyword of template.keywords) {
      if (lowerDesc.includes(keyword.toLowerCase())) {
        score += keyword.length
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = template
    }
  }

  return bestScore > 0 ? bestMatch : null
}

/**
 * 智能部署应用工具
 */
export const deployApplicationTool: ToolDefinition = {
  name: 'deploy_application',
  displayName: '一键部署应用',
  description: '根据描述智能部署应用。支持：Nginx、MySQL、PostgreSQL、Redis、MongoDB、WordPress、Ghost、Nextcloud、Gitea、Portainer 等常用应用',
  category: 'deployment',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: '应用描述（如"部署一个WordPress博客"、"安装MySQL数据库"）',
        required: true
      },
      name: {
        type: 'string',
        description: '容器名称（可选，默认自动生成）'
      },
      port: {
        type: 'number',
        description: '映射到主机的端口（可选）'
      },
      envVars: {
        type: 'object',
        description: '环境变量（键值对）'
      },
      dataPath: {
        type: 'string',
        description: '数据存储路径（可选，默认 /opt/apps）'
      }
    },
    required: ['description']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const description = params.description as string
      const customName = params.name as string | undefined
      const customPort = params.port as number | undefined
      const customEnvVars = params.envVars as Record<string, string> | undefined
      const dataPath = (params.dataPath as string) || '/opt/apps'

      context.onProgress?.('分析部署需求...')

      // 匹配应用模板
      const template = matchTemplate(description)
      if (!template) {
        return {
          success: false,
          error: `无法识别要部署的应用。支持的应用：${appTemplates.map(t => t.name).join('、')}`,
          data: { supportedApps: appTemplates.map(t => ({ id: t.id, name: t.name, description: t.description })) }
        }
      }

      context.onProgress?.(`识别到应用: ${template.name}`)

      // 检查 Docker 是否可用
      const dockerCheck = await context.executor.executeCommand(context.serverId, 'docker', ['--version'])
      if (dockerCheck.exit_code !== 0) {
        return {
          success: false,
          error: 'Docker 未安装或不可用，请先安装 Docker'
        }
      }

      // 生成容器名称
      const containerName = customName || `${template.id}-${Date.now().toString(36)}`
      if (!validateContainerName(containerName)) {
        return { success: false, error: '无效的容器名称' }
      }
      const appDataPath = `${dataPath}/${containerName}`

      // 创建数据目录
      context.onProgress?.('创建数据目录...')
      await context.executor.executeCommand(context.serverId, 'mkdir', ['-p', appDataPath])

      // 准备环境变量
      const envVars: Record<string, string> = { ...customEnvVars }
      const generatedSecrets: Record<string, string> = {}

      for (const envDef of template.envVars) {
        if (!envVars[envDef.name]) {
          if (envDef.secret && envDef.required) {
            // 生成随机密码
            const password = generatePassword()
            envVars[envDef.name] = password
            generatedSecrets[envDef.name] = password
          } else if (envDef.default) {
            envVars[envDef.name] = envDef.default
          }
        }
      }

      // 检查端口是否可用
      const hostPort = customPort || template.defaultPort
      if (!validatePort(hostPort)) {
        return { success: false, error: `无效的端口号: ${hostPort}` }
      }
      
      context.onProgress?.(`检查端口 ${hostPort}...`)
      const portCheck = await context.executor.executeCommand(
        context.serverId,
        'ss',
        ['-tlnp']
      )
      
      if (portCheck.exit_code === 0) {
        const portPattern = new RegExp(`:${hostPort}\\s`)
        if (portPattern.test(portCheck.stdout)) {
          return {
            success: false,
            error: `端口 ${hostPort} 已被占用，请指定其他端口`,
            data: { usedPort: hostPort }
          }
        }
      }

      // 拉取镜像
      context.onProgress?.(`拉取镜像 ${template.image}...`)
      const pullResult = await context.executor.executeCommand(
        context.serverId,
        'docker',
        ['pull', template.image]
      )
      if (pullResult.exit_code !== 0) {
        return {
          success: false,
          error: `镜像拉取失败: ${pullResult.stderr}`
        }
      }

      // 构建 docker run 命令
      const dockerArgs = ['run', '-d', '--name', containerName, '--restart', 'unless-stopped']

      // 添加端口映射
      dockerArgs.push('-p', `${hostPort}:${template.defaultPort}`)

      // 添加环境变量
      for (const [key, value] of Object.entries(envVars)) {
        dockerArgs.push('-e', `${key}=${value}`)
      }

      // 添加数据卷
      for (const vol of template.volumes) {
        const hostPath = vol.host.startsWith('/') ? vol.host : `${appDataPath}/${vol.host}`
        await context.executor.executeCommand(context.serverId, 'mkdir', ['-p', hostPath])
        dockerArgs.push('-v', `${hostPath}:${vol.container}`)
      }

      dockerArgs.push(template.image)

      // 启动容器
      context.onProgress?.('启动容器...')
      const runResult = await context.executor.executeCommand(context.serverId, 'docker', dockerArgs)
      if (runResult.exit_code !== 0) {
        return {
          success: false,
          error: `容器启动失败: ${runResult.stderr}`
        }
      }

      // 保存配置信息
      const configContent = JSON.stringify({
        app: template.name,
        image: template.image,
        containerName,
        port: hostPort,
        envVars: Object.fromEntries(
          Object.entries(envVars).map(([k, v]) => [k, generatedSecrets[k] ? '***' : v])
        ),
        secrets: generatedSecrets,
        createdAt: new Date().toISOString()
      }, null, 2)
      
      await context.executor.writeFile(context.serverId, `${appDataPath}/deploy-config.json`, configContent)

      // 验证容器状态
      context.onProgress?.('验证部署状态...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const statusResult = await context.executor.executeCommand(
        context.serverId,
        'docker',
        ['ps', '--filter', `name=${containerName}`, '--format', '{{.Status}}']
      )

      const isRunning = statusResult.stdout.toLowerCase().includes('up')

      return {
        success: isRunning,
        data: {
          app: template.name,
          containerName,
          containerId: runResult.stdout.trim().substring(0, 12),
          port: hostPort,
          dataPath: appDataPath,
          status: isRunning ? 'running' : 'failed',
          accessUrl: `http://服务器IP:${hostPort}`,
          generatedSecrets: Object.keys(generatedSecrets).length > 0 ? generatedSecrets : undefined,
          configFile: `${appDataPath}/deploy-config.json`
        },
        message: isRunning 
          ? `${template.name} 部署成功！\n访问地址: http://服务器IP:${hostPort}\n容器名称: ${containerName}${Object.keys(generatedSecrets).length > 0 ? '\n生成的密码已保存到配置文件' : ''}`
          : `容器启动失败，请检查日志: docker logs ${containerName}`
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

/**
 * 创建 Nginx 配置工具
 */
export const createNginxConfigTool: ToolDefinition = {
  name: 'create_nginx_config',
  displayName: '生成 Nginx 配置',
  description: '智能生成 Nginx 配置文件，支持反向代理、静态文件、SSL 等场景',
  category: 'deployment',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: '配置类型: reverse-proxy(反向代理), static(静态文件), php(PHP站点)',
        enum: ['reverse-proxy', 'static', 'php'],
        required: true
      },
      domain: {
        type: 'string',
        description: '域名',
        required: true
      },
      upstreamHost: {
        type: 'string',
        description: '上游服务器地址（反向代理时需要，如 127.0.0.1）'
      },
      upstreamPort: {
        type: 'number',
        description: '上游服务器端口（反向代理时需要，如 3000）'
      },
      rootPath: {
        type: 'string',
        description: '网站根目录（静态文件/PHP时需要）'
      },
      ssl: {
        type: 'boolean',
        description: '是否启用 SSL',
        default: false
      },
      sslCertPath: {
        type: 'string',
        description: 'SSL 证书路径'
      },
      sslKeyPath: {
        type: 'string',
        description: 'SSL 私钥路径'
      },
      websocket: {
        type: 'boolean',
        description: '是否支持 WebSocket',
        default: false
      }
    },
    required: ['type', 'domain']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const type = params.type as string
      const domain = params.domain as string
      const ssl = params.ssl as boolean
      const websocket = params.websocket as boolean

      // 验证域名
      if (!domain || !validateDomain(domain)) {
        return { success: false, error: '无效的域名格式' }
      }

      let config = ''
      const upstreamName = domain.replace(/\./g, '_')

      // 生成上游配置（反向代理）
      if (type === 'reverse-proxy') {
        const upstreamHost = params.upstreamHost as string
        const upstreamPort = params.upstreamPort as number
        if (!upstreamHost || !validateHost(upstreamHost)) {
          return { success: false, error: '无效的上游服务器地址' }
        }
        if (!upstreamPort || !validatePort(upstreamPort)) {
          return { success: false, error: '无效的上游服务器端口' }
        }

        config += `upstream ${upstreamName}_backend {\n`
        config += `    server ${upstreamHost}:${upstreamPort};\n`
        config += `    keepalive 32;\n`
        config += `}\n\n`
      }

      // HTTP 重定向到 HTTPS
      if (ssl) {
        config += `server {\n`
        config += `    listen 80;\n`
        config += `    listen [::]:80;\n`
        config += `    server_name ${domain};\n`
        config += `    return 301 https://$server_name$request_uri;\n`
        config += `}\n\n`
      }

      // 主服务器配置
      config += `server {\n`
      if (ssl) {
        config += `    listen 443 ssl http2;\n`
        config += `    listen [::]:443 ssl http2;\n`
      } else {
        config += `    listen 80;\n`
        config += `    listen [::]:80;\n`
      }
      config += `    server_name ${domain};\n\n`

      // SSL 配置
      if (ssl) {
        const certPath = params.sslCertPath as string || `/etc/letsencrypt/live/${domain}/fullchain.pem`
        const keyPath = params.sslKeyPath as string || `/etc/letsencrypt/live/${domain}/privkey.pem`
        config += `    ssl_certificate ${certPath};\n`
        config += `    ssl_certificate_key ${keyPath};\n`
        config += `    ssl_protocols TLSv1.2 TLSv1.3;\n`
        config += `    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;\n`
        config += `    ssl_prefer_server_ciphers off;\n`
        config += `    ssl_session_cache shared:SSL:10m;\n`
        config += `    ssl_session_timeout 1d;\n\n`
      }

      // Gzip 配置
      config += `    gzip on;\n`
      config += `    gzip_vary on;\n`
      config += `    gzip_min_length 1024;\n`
      config += `    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml;\n\n`

      // 根据类型生成不同的配置
      switch (type) {
        case 'reverse-proxy':
          config += `    location / {\n`
          config += `        proxy_pass http://${upstreamName}_backend;\n`
          config += `        proxy_http_version 1.1;\n`
          config += `        proxy_set_header Host $host;\n`
          config += `        proxy_set_header X-Real-IP $remote_addr;\n`
          config += `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n`
          config += `        proxy_set_header X-Forwarded-Proto $scheme;\n`
          if (websocket) {
            config += `        proxy_set_header Upgrade $http_upgrade;\n`
            config += `        proxy_set_header Connection "upgrade";\n`
            config += `        proxy_read_timeout 86400;\n`
          } else {
            config += `        proxy_set_header Connection "";\n`
          }
          config += `    }\n`
          break

        case 'static':
          const staticRoot = params.rootPath as string
          if (!staticRoot) {
            return { success: false, error: '静态文件服务需要指定 rootPath' }
          }
          config += `    root ${staticRoot};\n`
          config += `    index index.html index.htm;\n\n`
          config += `    location / {\n`
          config += `        try_files $uri $uri/ /index.html;\n`
          config += `    }\n\n`
          config += `    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {\n`
          config += `        expires 1y;\n`
          config += `        add_header Cache-Control "public, immutable";\n`
          config += `    }\n`
          break

        case 'php':
          const phpRoot = params.rootPath as string
          if (!phpRoot) {
            return { success: false, error: 'PHP 服务需要指定 rootPath' }
          }
          config += `    root ${phpRoot};\n`
          config += `    index index.php index.html;\n\n`
          config += `    location / {\n`
          config += `        try_files $uri $uri/ /index.php?$query_string;\n`
          config += `    }\n\n`
          config += `    location ~ \\.php$ {\n`
          config += `        fastcgi_pass unix:/var/run/php/php-fpm.sock;\n`
          config += `        fastcgi_index index.php;\n`
          config += `        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;\n`
          config += `        include fastcgi_params;\n`
          config += `    }\n\n`
          config += `    location ~ /\\.ht {\n`
          config += `        deny all;\n`
          config += `    }\n`
          break
      }

      config += `}\n`

      // 保存配置文件
      const configPath = `/etc/nginx/sites-available/${domain}`
      const enabledPath = `/etc/nginx/sites-enabled/${domain}`

      context.onProgress?.('保存 Nginx 配置...')
      const writeResult = await context.executor.writeFile(context.serverId, configPath, config)
      if (!writeResult.success) {
        return { success: false, error: `配置文件保存失败: ${writeResult.error}` }
      }

      // 创建软链接
      await context.executor.executeCommand(context.serverId, 'ln', ['-sf', configPath, enabledPath])

      // 测试配置
      context.onProgress?.('测试 Nginx 配置...')
      const testResult = await context.executor.executeCommand(context.serverId, 'nginx', ['-t'])

      if (testResult.exit_code !== 0) {
        return {
          success: false,
          error: `Nginx 配置测试失败: ${testResult.stderr}`,
          data: { config, configPath }
        }
      }

      return {
        success: true,
        data: {
          configPath,
          enabledPath,
          config,
          testOutput: testResult.stderr || testResult.stdout
        },
        message: `Nginx 配置已生成: ${configPath}\n请运行 'systemctl reload nginx' 或 'nginx -s reload' 重载配置`
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

/**
 * 获取可部署应用列表工具
 */
export const listDeployableAppsTool: ToolDefinition = {
  name: 'list_deployable_apps',
  displayName: '列出可部署应用',
  description: '列出所有支持一键部署的应用模板',
  category: 'deployment',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: '按分类筛选（可选）',
        enum: ['webserver', 'database', 'cache', 'cms', 'storage', 'devtools']
      }
    },
    required: []
  },
  execute: async (params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> => {
    const category = params.category as string | undefined
    
    let apps = appTemplates
    if (category) {
      apps = apps.filter(t => t.category === category)
    }

    const result = apps.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      image: t.image,
      defaultPort: t.defaultPort,
      requiredEnvVars: t.envVars.filter(e => e.required).map(e => e.name),
      dependencies: t.dependencies || []
    }))

    return {
      success: true,
      data: result,
      message: `找到 ${result.length} 个可部署应用`
    }
  }
}

/**
 * 导出部署工具
 */
export const deploymentTools: ToolDefinition[] = [
  deployApplicationTool,
  createNginxConfigTool,
  listDeployableAppsTool
]
