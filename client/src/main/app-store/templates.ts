/**
 * 应用商店 - 应用模板定义
 */

import {
  AppTemplate,
  AppCategory,
  DeploymentType
} from '../../types/app-store'

/**
 * 常用应用模板列表
 */
export const appTemplates: AppTemplate[] = [
  // WordPress
  {
    id: 'wordpress',
    name: 'wordpress',
    displayName: 'WordPress',
    description: '流行的内容管理系统，用于创建网站和博客',
    icon: '📝',
    category: AppCategory.WEB,
    version: '6.4',
    author: 'WordPress Foundation',
    homepage: 'https://wordpress.org',
    documentation: 'https://wordpress.org/support/',
    deployment: {
      type: DeploymentType.COMPOSE,
      composeFile: `version: '3.8'

services:
  wordpress:
    image: wordpress:{{version}}
    restart: always
    ports:
      - "{{port}}:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: {{db_user}}
      WORDPRESS_DB_PASSWORD: {{db_password}}
      WORDPRESS_DB_NAME: {{db_name}}
    volumes:
      - wordpress_data:/var/www/html

  db:
    image: mysql:8.0
    restart: always
    environment:
      MYSQL_DATABASE: {{db_name}}
      MYSQL_USER: {{db_user}}
      MYSQL_PASSWORD: {{db_password}}
      MYSQL_ROOT_PASSWORD: {{db_root_password}}
    volumes:
      - db_data:/var/lib/mysql

volumes:
  wordpress_data:
  db_data:
`,
      services: ['wordpress', 'db'],
      environment: []
    },
    configForm: [
      {
        name: 'version',
        label: 'WordPress版本',
        type: 'select',
        required: true,
        default: 'latest',
        options: [
          { label: '最新版', value: 'latest' },
          { label: '6.4', value: '6.4' },
          { label: '6.3', value: '6.3' }
        ]
      },
      {
        name: 'port',
        label: '访问端口',
        type: 'number',
        required: true,
        default: 8080,
        validation: {
          min: 1024,
          max: 65535,
          message: '端口范围: 1024-65535'
        }
      },
      {
        name: 'db_name',
        label: '数据库名称',
        type: 'text',
        required: true,
        default: 'wordpress'
      },
      {
        name: 'db_user',
        label: '数据库用户',
        type: 'text',
        required: true,
        default: 'wordpress'
      },
      {
        name: 'db_password',
        label: '数据库密码',
        type: 'password',
        required: true,
        placeholder: '请输入数据库密码'
      },
      {
        name: 'db_root_password',
        label: '数据库Root密码',
        type: 'password',
        required: true,
        placeholder: '请输入Root密码'
      }
    ],
    healthCheck: {
      type: 'http',
      endpoint: '/',
      interval: 30,
      timeout: 10,
      retries: 3
    },
    tags: ['cms', 'blog', 'php', 'mysql'],
    downloads: 15420,
    rating: 4.5,
    requirements: {
      memory: 512,
      cpu: 1,
      disk: 2048
    }
  },

  // MySQL
  {
    id: 'mysql',
    name: 'mysql',
    displayName: 'MySQL',
    description: '流行的开源关系型数据库',
    icon: '🐬',
    category: AppCategory.DATABASE,
    version: '8.0',
    author: 'Oracle',
    homepage: 'https://www.mysql.com',
    documentation: 'https://dev.mysql.com/doc/',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'mysql',
      tag: '8.0',
      ports: [
        { container: 3306, host: 3306, protocol: 'tcp' }
      ],
      volumes: [
        { container: '/var/lib/mysql', host: './mysql_data', mode: 'rw' }
      ],
      environment: [
        { name: 'MYSQL_ROOT_PASSWORD', value: '{{root_password}}' },
        { name: 'MYSQL_DATABASE', value: '{{database}}' },
        { name: 'MYSQL_USER', value: '{{user}}' },
        { name: 'MYSQL_PASSWORD', value: '{{password}}' }
      ],
      restart: 'always'
    },
    configForm: [
      {
        name: 'root_password',
        label: 'Root密码',
        type: 'password',
        required: true,
        placeholder: '请输入Root密码'
      },
      {
        name: 'database',
        label: '数据库名称',
        type: 'text',
        required: false,
        default: 'mydb',
        description: '初始数据库名称（可选）'
      },
      {
        name: 'user',
        label: '用户名',
        type: 'text',
        required: false,
        default: 'user',
        description: '初始用户名（可选）'
      },
      {
        name: 'password',
        label: '用户密码',
        type: 'password',
        required: false,
        description: '初始用户密码（可选）'
      },
      {
        name: 'port',
        label: '端口',
        type: 'number',
        required: true,
        default: 3306
      }
    ],
    healthCheck: {
      type: 'tcp',
      port: 3306,
      interval: 30,
      timeout: 5,
      retries: 3
    },
    tags: ['database', 'sql', 'mysql'],
    downloads: 28500,
    rating: 4.7,
    requirements: {
      memory: 256,
      cpu: 1,
      disk: 1024
    }
  },

  // Redis
  {
    id: 'redis',
    name: 'redis',
    displayName: 'Redis',
    description: '高性能的内存数据库和缓存',
    icon: '🔴',
    category: AppCategory.CACHE,
    version: '7.2',
    author: 'Redis Ltd.',
    homepage: 'https://redis.io',
    documentation: 'https://redis.io/docs/',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'redis',
      tag: '7.2-alpine',
      ports: [
        { container: 6379, host: 6379, protocol: 'tcp' }
      ],
      volumes: [
        { container: '/data', host: './redis_data', mode: 'rw' }
      ],
      environment: [],
      command: ['redis-server', '--requirepass', '{{password}}'],
      restart: 'always'
    },
    configForm: [
      {
        name: 'password',
        label: '密码',
        type: 'password',
        required: false,
        placeholder: '留空则不设置密码',
        description: 'Redis访问密码（可选）'
      },
      {
        name: 'port',
        label: '端口',
        type: 'number',
        required: true,
        default: 6379
      }
    ],
    healthCheck: {
      type: 'tcp',
      port: 6379,
      interval: 30,
      timeout: 5,
      retries: 3
    },
    tags: ['cache', 'database', 'redis', 'nosql'],
    downloads: 32100,
    rating: 4.8,
    requirements: {
      memory: 128,
      cpu: 1,
      disk: 512
    }
  },

  // Nginx
  {
    id: 'nginx',
    name: 'nginx',
    displayName: 'Nginx',
    description: '高性能的Web服务器和反向代理',
    icon: '🌐',
    category: AppCategory.WEB,
    version: '1.25',
    author: 'Nginx Inc.',
    homepage: 'https://nginx.org',
    documentation: 'https://nginx.org/en/docs/',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'nginx',
      tag: 'alpine',
      ports: [
        { container: 80, host: 80, protocol: 'tcp' },
        { container: 443, host: 443, protocol: 'tcp' }
      ],
      volumes: [
        { container: '/usr/share/nginx/html', host: './html', mode: 'rw' },
        { container: '/etc/nginx/conf.d', host: './conf.d', mode: 'rw' }
      ],
      environment: [],
      restart: 'always'
    },
    configForm: [
      {
        name: 'http_port',
        label: 'HTTP端口',
        type: 'number',
        required: true,
        default: 80
      },
      {
        name: 'https_port',
        label: 'HTTPS端口',
        type: 'number',
        required: true,
        default: 443
      }
    ],
    healthCheck: {
      type: 'http',
      endpoint: '/',
      interval: 30,
      timeout: 5,
      retries: 3
    },
    tags: ['web', 'proxy', 'nginx', 'server'],
    downloads: 45200,
    rating: 4.9,
    requirements: {
      memory: 64,
      cpu: 1,
      disk: 256
    }
  },

  // PostgreSQL
  {
    id: 'postgresql',
    name: 'postgresql',
    displayName: 'PostgreSQL',
    description: '强大的开源对象关系型数据库',
    icon: '🐘',
    category: AppCategory.DATABASE,
    version: '16',
    author: 'PostgreSQL Global Development Group',
    homepage: 'https://www.postgresql.org',
    documentation: 'https://www.postgresql.org/docs/',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'postgres',
      tag: '16-alpine',
      ports: [
        { container: 5432, host: 5432, protocol: 'tcp' }
      ],
      volumes: [
        { container: '/var/lib/postgresql/data', host: './postgres_data', mode: 'rw' }
      ],
      environment: [
        { name: 'POSTGRES_PASSWORD', value: '{{password}}' },
        { name: 'POSTGRES_USER', value: '{{user}}' },
        { name: 'POSTGRES_DB', value: '{{database}}' }
      ],
      restart: 'always'
    },
    configForm: [
      {
        name: 'user',
        label: '用户名',
        type: 'text',
        required: true,
        default: 'postgres'
      },
      {
        name: 'password',
        label: '密码',
        type: 'password',
        required: true,
        placeholder: '请输入密码'
      },
      {
        name: 'database',
        label: '数据库名称',
        type: 'text',
        required: true,
        default: 'postgres'
      },
      {
        name: 'port',
        label: '端口',
        type: 'number',
        required: true,
        default: 5432
      }
    ],
    healthCheck: {
      type: 'tcp',
      port: 5432,
      interval: 30,
      timeout: 5,
      retries: 3
    },
    tags: ['database', 'sql', 'postgresql', 'postgres'],
    downloads: 18900,
    rating: 4.8,
    requirements: {
      memory: 256,
      cpu: 1,
      disk: 1024
    }
  },

  // MongoDB
  {
    id: 'mongodb',
    name: 'mongodb',
    displayName: 'MongoDB',
    description: '流行的NoSQL文档数据库',
    icon: '🍃',
    category: AppCategory.DATABASE,
    version: '7.0',
    author: 'MongoDB Inc.',
    homepage: 'https://www.mongodb.com',
    documentation: 'https://docs.mongodb.com/',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'mongo',
      tag: '7.0',
      ports: [
        { container: 27017, host: 27017, protocol: 'tcp' }
      ],
      volumes: [
        { container: '/data/db', host: './mongo_data', mode: 'rw' }
      ],
      environment: [
        { name: 'MONGO_INITDB_ROOT_USERNAME', value: '{{username}}' },
        { name: 'MONGO_INITDB_ROOT_PASSWORD', value: '{{password}}' }
      ],
      restart: 'always'
    },
    configForm: [
      {
        name: 'username',
        label: '用户名',
        type: 'text',
        required: true,
        default: 'admin'
      },
      {
        name: 'password',
        label: '密码',
        type: 'password',
        required: true,
        placeholder: '请输入密码'
      },
      {
        name: 'port',
        label: '端口',
        type: 'number',
        required: true,
        default: 27017
      }
    ],
    healthCheck: {
      type: 'tcp',
      port: 27017,
      interval: 30,
      timeout: 5,
      retries: 3
    },
    tags: ['database', 'nosql', 'mongodb', 'document'],
    downloads: 22400,
    rating: 4.6,
    requirements: {
      memory: 512,
      cpu: 1,
      disk: 2048
    }
  }
]

/**
 * 根据ID获取应用模板
 */
export function getAppTemplate(id: string): AppTemplate | undefined {
  return appTemplates.find(app => app.id === id)
}

/**
 * 根据分类获取应用模板
 */
export function getAppTemplatesByCategory(category: AppCategory): AppTemplate[] {
  return appTemplates.filter(app => app.category === category)
}

/**
 * 搜索应用模板
 */
export function searchAppTemplates(query: string): AppTemplate[] {
  const lowerQuery = query.toLowerCase()
  return appTemplates.filter(app =>
    app.name.toLowerCase().includes(lowerQuery) ||
    app.displayName.toLowerCase().includes(lowerQuery) ||
    app.description.toLowerCase().includes(lowerQuery) ||
    app.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  )
}
