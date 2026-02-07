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
  },

  // ==================== 消息队列 ====================
  {
    id: 'rabbitmq',
    name: 'rabbitmq',
    displayName: 'RabbitMQ',
    description: '可靠的开源消息代理，支持多种消息协议',
    icon: '🐰',
    category: AppCategory.MESSAGE_QUEUE,
    version: '3.13',
    author: 'Broadcom',
    homepage: 'https://www.rabbitmq.com',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'rabbitmq',
      tag: '3.13-management-alpine',
      ports: [
        { container: 5672, host: 5672, protocol: 'tcp' },
        { container: 15672, host: 15672, protocol: 'tcp' }
      ],
      volumes: [{ container: '/var/lib/rabbitmq', host: './rabbitmq_data', mode: 'rw' }],
      environment: [
        { name: 'RABBITMQ_DEFAULT_USER', value: '{{user}}' },
        { name: 'RABBITMQ_DEFAULT_PASS', value: '{{password}}' }
      ],
      restart: 'always'
    },
    configForm: [
      { name: 'user', label: '用户名', type: 'text', required: true, default: 'admin' },
      { name: 'password', label: '密码', type: 'password', required: true, placeholder: '请输入密码' },
      { name: 'port', label: 'AMQP端口', type: 'number', required: true, default: 5672 }
    ],
    healthCheck: { type: 'tcp', port: 5672, interval: 30, timeout: 5, retries: 3 },
    tags: ['mq', 'amqp', 'rabbitmq', 'message'],
    downloads: 12800,
    rating: 4.6,
    requirements: { memory: 256, cpu: 1, disk: 1024 }
  },
  {
    id: 'kafka',
    name: 'kafka',
    displayName: 'Apache Kafka',
    description: '高吞吐量分布式消息流平台',
    icon: '📨',
    category: AppCategory.MESSAGE_QUEUE,
    version: '3.7',
    author: 'Apache Software Foundation',
    homepage: 'https://kafka.apache.org',
    deployment: {
      type: DeploymentType.COMPOSE,
      composeFile: `version: '3.8'
services:
  kafka:
    image: bitnami/kafka:{{version}}
    restart: always
    ports:
      - "{{port}}:9092"
    environment:
      KAFKA_CFG_NODE_ID: 0
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 0@kafka:9093
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://localhost:{{port}}
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
    volumes:
      - kafka_data:/bitnami/kafka
volumes:
  kafka_data:
`,
      services: ['kafka'],
      environment: []
    },
    configForm: [
      { name: 'version', label: '版本', type: 'select', required: true, default: '3.7', options: [{ label: '3.7', value: '3.7' }, { label: '3.6', value: '3.6' }] },
      { name: 'port', label: '端口', type: 'number', required: true, default: 9092 }
    ],
    healthCheck: { type: 'tcp', port: 9092, interval: 30, timeout: 10, retries: 5 },
    tags: ['mq', 'kafka', 'streaming', 'message'],
    downloads: 16500,
    rating: 4.5,
    requirements: { memory: 1024, cpu: 2, disk: 2048 }
  },
  {
    id: 'nats',
    name: 'nats',
    displayName: 'NATS',
    description: '轻量级高性能云原生消息系统',
    icon: '⚡',
    category: AppCategory.MESSAGE_QUEUE,
    version: '2.10',
    author: 'Synadia',
    homepage: 'https://nats.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'nats',
      tag: '2.10-alpine',
      ports: [
        { container: 4222, host: 4222, protocol: 'tcp' },
        { container: 8222, host: 8222, protocol: 'tcp' }
      ],
      volumes: [{ container: '/data', host: './nats_data', mode: 'rw' }],
      environment: [],
      command: ['--jetstream', '--store_dir', '/data'],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '客户端端口', type: 'number', required: true, default: 4222 }
    ],
    healthCheck: { type: 'http', endpoint: '/healthz', interval: 30, timeout: 5, retries: 3 },
    tags: ['mq', 'nats', 'cloud-native', 'message'],
    downloads: 8200,
    rating: 4.7,
    requirements: { memory: 64, cpu: 1, disk: 512 }
  },

  // ==================== 监控 ====================
  {
    id: 'prometheus',
    name: 'prometheus',
    displayName: 'Prometheus',
    description: '开源系统监控和告警工具包',
    icon: '🔥',
    category: AppCategory.MONITORING,
    version: '2.51',
    author: 'Prometheus Authors',
    homepage: 'https://prometheus.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'prom/prometheus',
      tag: 'v2.51.0',
      ports: [{ container: 9090, host: 9090, protocol: 'tcp' }],
      volumes: [
        { container: '/prometheus', host: './prometheus_data', mode: 'rw' },
        { container: '/etc/prometheus', host: './prometheus_config', mode: 'rw' }
      ],
      environment: [],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 9090 }
    ],
    healthCheck: { type: 'http', endpoint: '/-/healthy', interval: 30, timeout: 5, retries: 3 },
    tags: ['monitoring', 'metrics', 'prometheus', 'alerting'],
    downloads: 19800,
    rating: 4.8,
    requirements: { memory: 512, cpu: 1, disk: 2048 }
  },
  {
    id: 'grafana',
    name: 'grafana',
    displayName: 'Grafana',
    description: '开源数据可视化和监控仪表盘平台',
    icon: '📊',
    category: AppCategory.MONITORING,
    version: '11.0',
    author: 'Grafana Labs',
    homepage: 'https://grafana.com',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'grafana/grafana-oss',
      tag: '11.0.0',
      ports: [{ container: 3000, host: 3000, protocol: 'tcp' }],
      volumes: [{ container: '/var/lib/grafana', host: './grafana_data', mode: 'rw' }],
      environment: [
        { name: 'GF_SECURITY_ADMIN_USER', value: '{{user}}' },
        { name: 'GF_SECURITY_ADMIN_PASSWORD', value: '{{password}}' }
      ],
      restart: 'always'
    },
    configForm: [
      { name: 'user', label: '管理员用户', type: 'text', required: true, default: 'admin' },
      { name: 'password', label: '管理员密码', type: 'password', required: true, placeholder: '请输入密码' },
      { name: 'port', label: '端口', type: 'number', required: true, default: 3000 }
    ],
    healthCheck: { type: 'http', endpoint: '/api/health', interval: 30, timeout: 5, retries: 3 },
    tags: ['monitoring', 'dashboard', 'grafana', 'visualization'],
    downloads: 24600,
    rating: 4.9,
    requirements: { memory: 256, cpu: 1, disk: 1024 }
  },
  {
    id: 'uptime-kuma',
    name: 'uptime-kuma',
    displayName: 'Uptime Kuma',
    description: '简洁美观的自托管监控工具',
    icon: '📡',
    category: AppCategory.MONITORING,
    version: '1.23',
    author: 'Louis Lam',
    homepage: 'https://github.com/louislam/uptime-kuma',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'louislam/uptime-kuma',
      tag: '1',
      ports: [{ container: 3001, host: 3001, protocol: 'tcp' }],
      volumes: [{ container: '/app/data', host: './uptime_data', mode: 'rw' }],
      environment: [],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 3001 }
    ],
    healthCheck: { type: 'http', endpoint: '/', interval: 30, timeout: 5, retries: 3 },
    tags: ['monitoring', 'uptime', 'status-page'],
    downloads: 15300,
    rating: 4.8,
    requirements: { memory: 128, cpu: 1, disk: 512 }
  },
  {
    id: 'node-exporter',
    name: 'node-exporter',
    displayName: 'Node Exporter',
    description: 'Prometheus 硬件和操作系统指标导出器',
    icon: '📈',
    category: AppCategory.MONITORING,
    version: '1.8',
    author: 'Prometheus Authors',
    homepage: 'https://prometheus.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'prom/node-exporter',
      tag: 'v1.8.0',
      ports: [{ container: 9100, host: 9100, protocol: 'tcp' }],
      volumes: [
        { container: '/host/proc', host: '/proc', mode: 'ro' },
        { container: '/host/sys', host: '/sys', mode: 'ro' }
      ],
      environment: [],
      command: ['--path.procfs=/host/proc', '--path.sysfs=/host/sys'],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 9100 }
    ],
    healthCheck: { type: 'http', endpoint: '/metrics', interval: 30, timeout: 5, retries: 3 },
    tags: ['monitoring', 'metrics', 'prometheus', 'exporter'],
    downloads: 18200,
    rating: 4.7,
    requirements: { memory: 32, cpu: 1, disk: 128 }
  },

  // ==================== DevOps ====================
  {
    id: 'gitea',
    name: 'gitea',
    displayName: 'Gitea',
    description: '轻量级自托管 Git 服务',
    icon: '🍵',
    category: AppCategory.DEVOPS,
    version: '1.22',
    author: 'Gitea',
    homepage: 'https://gitea.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'gitea/gitea',
      tag: '1.22',
      ports: [
        { container: 3000, host: 3000, protocol: 'tcp' },
        { container: 22, host: 2222, protocol: 'tcp' }
      ],
      volumes: [{ container: '/data', host: './gitea_data', mode: 'rw' }],
      environment: [
        { name: 'GITEA__database__DB_TYPE', value: 'sqlite3' },
        { name: 'GITEA__server__ROOT_URL', value: 'http://localhost:{{port}}/' }
      ],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: 'Web端口', type: 'number', required: true, default: 3000 }
    ],
    healthCheck: { type: 'http', endpoint: '/', interval: 30, timeout: 5, retries: 3 },
    tags: ['devops', 'git', 'gitea', 'code'],
    downloads: 14200,
    rating: 4.7,
    requirements: { memory: 256, cpu: 1, disk: 2048 }
  },
  {
    id: 'jenkins',
    name: 'jenkins',
    displayName: 'Jenkins',
    description: '领先的开源自动化 CI/CD 服务器',
    icon: '🔧',
    category: AppCategory.DEVOPS,
    version: '2.450',
    author: 'Jenkins Project',
    homepage: 'https://www.jenkins.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'jenkins/jenkins',
      tag: 'lts-jdk17',
      ports: [{ container: 8080, host: 8080, protocol: 'tcp' }],
      volumes: [{ container: '/var/jenkins_home', host: './jenkins_data', mode: 'rw' }],
      environment: [],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 8080 }
    ],
    healthCheck: { type: 'http', endpoint: '/login', interval: 30, timeout: 10, retries: 5 },
    tags: ['devops', 'ci', 'cd', 'jenkins', 'automation'],
    downloads: 21300,
    rating: 4.4,
    requirements: { memory: 1024, cpu: 2, disk: 4096 }
  },
  {
    id: 'drone',
    name: 'drone',
    displayName: 'Drone CI',
    description: '容器原生的持续集成平台',
    icon: '🚁',
    category: AppCategory.DEVOPS,
    version: '2.24',
    author: 'Harness',
    homepage: 'https://www.drone.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'drone/drone',
      tag: '2',
      ports: [{ container: 80, host: 8080, protocol: 'tcp' }],
      volumes: [{ container: '/data', host: './drone_data', mode: 'rw' }],
      environment: [
        { name: 'DRONE_SERVER_HOST', value: '{{host}}' },
        { name: 'DRONE_SERVER_PROTO', value: 'http' },
        { name: 'DRONE_RPC_SECRET', value: '{{rpc_secret}}' }
      ],
      restart: 'always'
    },
    configForm: [
      { name: 'host', label: '服务器地址', type: 'text', required: true, placeholder: 'drone.example.com' },
      { name: 'rpc_secret', label: 'RPC密钥', type: 'password', required: true, placeholder: '请输入RPC密钥' },
      { name: 'port', label: '端口', type: 'number', required: true, default: 8080 }
    ],
    healthCheck: { type: 'http', endpoint: '/healthz', interval: 30, timeout: 5, retries: 3 },
    tags: ['devops', 'ci', 'cd', 'drone', 'container'],
    downloads: 7800,
    rating: 4.5,
    requirements: { memory: 256, cpu: 1, disk: 2048 }
  },
  {
    id: 'portainer',
    name: 'portainer',
    displayName: 'Portainer',
    description: '轻量级 Docker 管理 UI',
    icon: '🐋',
    category: AppCategory.DEVOPS,
    version: '2.20',
    author: 'Portainer.io',
    homepage: 'https://www.portainer.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'portainer/portainer-ce',
      tag: '2.20.0-alpine',
      ports: [{ container: 9000, host: 9000, protocol: 'tcp' }],
      volumes: [
        { container: '/data', host: './portainer_data', mode: 'rw' },
        { container: '/var/run/docker.sock', host: '/var/run/docker.sock', mode: 'rw' }
      ],
      environment: [],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 9000 }
    ],
    healthCheck: { type: 'http', endpoint: '/', interval: 30, timeout: 5, retries: 3 },
    tags: ['devops', 'docker', 'portainer', 'management'],
    downloads: 26100,
    rating: 4.8,
    requirements: { memory: 128, cpu: 1, disk: 512 }
  },

  // ==================== 存储 ====================
  {
    id: 'minio',
    name: 'minio',
    displayName: 'MinIO',
    description: '高性能对象存储，兼容 S3 API',
    icon: '🪣',
    category: AppCategory.STORAGE,
    version: 'latest',
    author: 'MinIO Inc.',
    homepage: 'https://min.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'minio/minio',
      tag: 'latest',
      ports: [
        { container: 9000, host: 9000, protocol: 'tcp' },
        { container: 9001, host: 9001, protocol: 'tcp' }
      ],
      volumes: [{ container: '/data', host: './minio_data', mode: 'rw' }],
      environment: [
        { name: 'MINIO_ROOT_USER', value: '{{user}}' },
        { name: 'MINIO_ROOT_PASSWORD', value: '{{password}}' }
      ],
      command: ['server', '/data', '--console-address', ':9001'],
      restart: 'always'
    },
    configForm: [
      { name: 'user', label: '用户名', type: 'text', required: true, default: 'minioadmin' },
      { name: 'password', label: '密码', type: 'password', required: true, placeholder: '至少8位' },
      { name: 'port', label: 'API端口', type: 'number', required: true, default: 9000 }
    ],
    healthCheck: { type: 'http', endpoint: '/minio/health/live', interval: 30, timeout: 5, retries: 3 },
    tags: ['storage', 's3', 'minio', 'object-storage'],
    downloads: 13500,
    rating: 4.7,
    requirements: { memory: 256, cpu: 1, disk: 4096 }
  },
  {
    id: 'nextcloud',
    name: 'nextcloud',
    displayName: 'Nextcloud',
    description: '自托管云存储和协作平台',
    icon: '☁️',
    category: AppCategory.STORAGE,
    version: '29',
    author: 'Nextcloud GmbH',
    homepage: 'https://nextcloud.com',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'nextcloud',
      tag: '29-apache',
      ports: [{ container: 80, host: 8080, protocol: 'tcp' }],
      volumes: [{ container: '/var/www/html', host: './nextcloud_data', mode: 'rw' }],
      environment: [
        { name: 'SQLITE_DATABASE', value: 'nextcloud' },
        { name: 'NEXTCLOUD_ADMIN_USER', value: '{{user}}' },
        { name: 'NEXTCLOUD_ADMIN_PASSWORD', value: '{{password}}' }
      ],
      restart: 'always'
    },
    configForm: [
      { name: 'user', label: '管理员用户', type: 'text', required: true, default: 'admin' },
      { name: 'password', label: '管理员密码', type: 'password', required: true, placeholder: '请输入密码' },
      { name: 'port', label: '端口', type: 'number', required: true, default: 8080 }
    ],
    healthCheck: { type: 'http', endpoint: '/status.php', interval: 30, timeout: 10, retries: 5 },
    tags: ['storage', 'cloud', 'nextcloud', 'file-sharing'],
    downloads: 11200,
    rating: 4.5,
    requirements: { memory: 512, cpu: 1, disk: 4096 }
  },

  // ==================== 网络工具 ====================
  {
    id: 'traefik',
    name: 'traefik',
    displayName: 'Traefik',
    description: '云原生反向代理和负载均衡器',
    icon: '🔀',
    category: AppCategory.NETWORK,
    version: '3.0',
    author: 'Traefik Labs',
    homepage: 'https://traefik.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'traefik',
      tag: 'v3.0',
      ports: [
        { container: 80, host: 80, protocol: 'tcp' },
        { container: 443, host: 443, protocol: 'tcp' },
        { container: 8080, host: 8080, protocol: 'tcp' }
      ],
      volumes: [
        { container: '/var/run/docker.sock', host: '/var/run/docker.sock', mode: 'ro' },
        { container: '/etc/traefik', host: './traefik_config', mode: 'rw' }
      ],
      environment: [],
      command: ['--api.insecure=true', '--providers.docker=true'],
      restart: 'always'
    },
    configForm: [
      { name: 'http_port', label: 'HTTP端口', type: 'number', required: true, default: 80 },
      { name: 'https_port', label: 'HTTPS端口', type: 'number', required: true, default: 443 }
    ],
    healthCheck: { type: 'http', endpoint: '/ping', interval: 30, timeout: 5, retries: 3 },
    tags: ['network', 'proxy', 'traefik', 'load-balancer'],
    downloads: 16800,
    rating: 4.7,
    requirements: { memory: 128, cpu: 1, disk: 256 }
  },
  {
    id: 'caddy',
    name: 'caddy',
    displayName: 'Caddy',
    description: '自动 HTTPS 的现代 Web 服务器',
    icon: '🔒',
    category: AppCategory.NETWORK,
    version: '2.8',
    author: 'Matthew Holt',
    homepage: 'https://caddyserver.com',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'caddy',
      tag: '2.8-alpine',
      ports: [
        { container: 80, host: 80, protocol: 'tcp' },
        { container: 443, host: 443, protocol: 'tcp' }
      ],
      volumes: [
        { container: '/data', host: './caddy_data', mode: 'rw' },
        { container: '/config', host: './caddy_config', mode: 'rw' },
        { container: '/srv', host: './caddy_site', mode: 'rw' }
      ],
      environment: [],
      restart: 'always'
    },
    configForm: [
      { name: 'http_port', label: 'HTTP端口', type: 'number', required: true, default: 80 }
    ],
    healthCheck: { type: 'http', endpoint: '/', interval: 30, timeout: 5, retries: 3 },
    tags: ['network', 'web', 'caddy', 'https', 'proxy'],
    downloads: 9800,
    rating: 4.8,
    requirements: { memory: 64, cpu: 1, disk: 256 }
  },
  {
    id: 'pi-hole',
    name: 'pi-hole',
    displayName: 'Pi-hole',
    description: '网络级广告和追踪器拦截 DNS',
    icon: '🕳️',
    category: AppCategory.NETWORK,
    version: '2024',
    author: 'Pi-hole',
    homepage: 'https://pi-hole.net',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'pihole/pihole',
      tag: 'latest',
      ports: [
        { container: 53, host: 53, protocol: 'tcp' },
        { container: 53, host: 53, protocol: 'udp' },
        { container: 80, host: 8053, protocol: 'tcp' }
      ],
      volumes: [
        { container: '/etc/pihole', host: './pihole_etc', mode: 'rw' },
        { container: '/etc/dnsmasq.d', host: './pihole_dnsmasq', mode: 'rw' }
      ],
      environment: [
        { name: 'WEBPASSWORD', value: '{{password}}' }
      ],
      restart: 'always'
    },
    configForm: [
      { name: 'password', label: 'Web密码', type: 'password', required: true, placeholder: '请输入密码' },
      { name: 'port', label: 'Web端口', type: 'number', required: true, default: 8053 }
    ],
    healthCheck: { type: 'http', endpoint: '/admin/', interval: 30, timeout: 5, retries: 3 },
    tags: ['network', 'dns', 'ad-blocking', 'pi-hole'],
    downloads: 12400,
    rating: 4.6,
    requirements: { memory: 128, cpu: 1, disk: 512 }
  },

  // ==================== 安全工具 ====================
  {
    id: 'vaultwarden',
    name: 'vaultwarden',
    displayName: 'Vaultwarden',
    description: '轻量级 Bitwarden 兼容密码管理器',
    icon: '🔐',
    category: AppCategory.SECURITY,
    version: '1.31',
    author: 'Vaultwarden',
    homepage: 'https://github.com/dani-garcia/vaultwarden',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'vaultwarden/server',
      tag: 'latest',
      ports: [{ container: 80, host: 8080, protocol: 'tcp' }],
      volumes: [{ container: '/data', host: './vaultwarden_data', mode: 'rw' }],
      environment: [
        { name: 'ADMIN_TOKEN', value: '{{admin_token}}' }
      ],
      restart: 'always'
    },
    configForm: [
      { name: 'admin_token', label: '管理员Token', type: 'password', required: true, placeholder: '请输入管理Token' },
      { name: 'port', label: '端口', type: 'number', required: true, default: 8080 }
    ],
    healthCheck: { type: 'http', endpoint: '/alive', interval: 30, timeout: 5, retries: 3 },
    tags: ['security', 'password', 'vaultwarden', 'bitwarden'],
    downloads: 14800,
    rating: 4.9,
    requirements: { memory: 64, cpu: 1, disk: 512 }
  },
  {
    id: 'authelia',
    name: 'authelia',
    displayName: 'Authelia',
    description: '开源认证和授权服务器（SSO/2FA）',
    icon: '🛡️',
    category: AppCategory.SECURITY,
    version: '4.38',
    author: 'Authelia',
    homepage: 'https://www.authelia.com',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'authelia/authelia',
      tag: '4.38',
      ports: [{ container: 9091, host: 9091, protocol: 'tcp' }],
      volumes: [{ container: '/config', host: './authelia_config', mode: 'rw' }],
      environment: [],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 9091 }
    ],
    healthCheck: { type: 'http', endpoint: '/api/health', interval: 30, timeout: 5, retries: 3 },
    tags: ['security', 'auth', 'sso', '2fa', 'authelia'],
    downloads: 6500,
    rating: 4.6,
    requirements: { memory: 128, cpu: 1, disk: 256 }
  },

  // ==================== 更多 Web 应用 ====================
  {
    id: 'ghost',
    name: 'ghost',
    displayName: 'Ghost',
    description: '专业的开源博客和内容发布平台',
    icon: '👻',
    category: AppCategory.WEB,
    version: '5.82',
    author: 'Ghost Foundation',
    homepage: 'https://ghost.org',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'ghost',
      tag: '5-alpine',
      ports: [{ container: 2368, host: 2368, protocol: 'tcp' }],
      volumes: [{ container: '/var/lib/ghost/content', host: './ghost_data', mode: 'rw' }],
      environment: [
        { name: 'url', value: 'http://localhost:{{port}}' },
        { name: 'database__client', value: 'sqlite3' }
      ],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 2368 }
    ],
    healthCheck: { type: 'http', endpoint: '/', interval: 30, timeout: 10, retries: 3 },
    tags: ['web', 'blog', 'cms', 'ghost'],
    downloads: 9600,
    rating: 4.6,
    requirements: { memory: 256, cpu: 1, disk: 1024 }
  },
  {
    id: 'n8n',
    name: 'n8n',
    displayName: 'n8n',
    description: '可扩展的工作流自动化工具',
    icon: '🔗',
    category: AppCategory.DEVOPS,
    version: '1.40',
    author: 'n8n GmbH',
    homepage: 'https://n8n.io',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'n8nio/n8n',
      tag: 'latest',
      ports: [{ container: 5678, host: 5678, protocol: 'tcp' }],
      volumes: [{ container: '/home/node/.n8n', host: './n8n_data', mode: 'rw' }],
      environment: [],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 5678 }
    ],
    healthCheck: { type: 'http', endpoint: '/healthz', interval: 30, timeout: 5, retries: 3 },
    tags: ['devops', 'automation', 'workflow', 'n8n'],
    downloads: 11500,
    rating: 4.7,
    requirements: { memory: 256, cpu: 1, disk: 1024 }
  },
  {
    id: 'elasticsearch',
    name: 'elasticsearch',
    displayName: 'Elasticsearch',
    description: '分布式搜索和分析引擎',
    icon: '🔍',
    category: AppCategory.DATABASE,
    version: '8.13',
    author: 'Elastic',
    homepage: 'https://www.elastic.co',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'elasticsearch',
      tag: '8.13.0',
      ports: [{ container: 9200, host: 9200, protocol: 'tcp' }],
      volumes: [{ container: '/usr/share/elasticsearch/data', host: './es_data', mode: 'rw' }],
      environment: [
        { name: 'discovery.type', value: 'single-node' },
        { name: 'ELASTIC_PASSWORD', value: '{{password}}' },
        { name: 'xpack.security.enabled', value: 'true' }
      ],
      restart: 'always'
    },
    configForm: [
      { name: 'password', label: '密码', type: 'password', required: true, placeholder: '请输入密码' },
      { name: 'port', label: '端口', type: 'number', required: true, default: 9200 }
    ],
    healthCheck: { type: 'http', endpoint: '/_cluster/health', interval: 30, timeout: 10, retries: 5 },
    tags: ['database', 'search', 'elasticsearch', 'analytics'],
    downloads: 17200,
    rating: 4.5,
    requirements: { memory: 2048, cpu: 2, disk: 4096 }
  },
  {
    id: 'adminer',
    name: 'adminer',
    displayName: 'Adminer',
    description: '轻量级数据库管理 Web 工具',
    icon: '🗄️',
    category: AppCategory.DATABASE,
    version: '4.8',
    author: 'Jakub Vrána',
    homepage: 'https://www.adminer.org',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'adminer',
      tag: 'latest',
      ports: [{ container: 8080, host: 8080, protocol: 'tcp' }],
      volumes: [],
      environment: [],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 8080 }
    ],
    healthCheck: { type: 'http', endpoint: '/', interval: 30, timeout: 5, retries: 3 },
    tags: ['database', 'admin', 'adminer', 'management'],
    downloads: 8900,
    rating: 4.4,
    requirements: { memory: 64, cpu: 1, disk: 128 }
  },
  {
    id: 'registry',
    name: 'registry',
    displayName: 'Docker Registry',
    description: '私有 Docker 镜像仓库',
    icon: '📦',
    category: AppCategory.DEVOPS,
    version: '2.8',
    author: 'Docker',
    homepage: 'https://docs.docker.com/registry/',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'registry',
      tag: '2',
      ports: [{ container: 5000, host: 5000, protocol: 'tcp' }],
      volumes: [{ container: '/var/lib/registry', host: './registry_data', mode: 'rw' }],
      environment: [],
      restart: 'always'
    },
    configForm: [
      { name: 'port', label: '端口', type: 'number', required: true, default: 5000 }
    ],
    healthCheck: { type: 'http', endpoint: '/v2/', interval: 30, timeout: 5, retries: 3 },
    tags: ['devops', 'docker', 'registry', 'images'],
    downloads: 10200,
    rating: 4.5,
    requirements: { memory: 128, cpu: 1, disk: 4096 }
  },
  {
    id: 'watchtower',
    name: 'watchtower',
    displayName: 'Watchtower',
    description: '自动更新 Docker 容器镜像',
    icon: '🗼',
    category: AppCategory.DEVOPS,
    version: '1.7',
    author: 'containrrr',
    homepage: 'https://containrrr.dev/watchtower/',
    deployment: {
      type: DeploymentType.DOCKER,
      image: 'containrrr/watchtower',
      tag: 'latest',
      ports: [],
      volumes: [{ container: '/var/run/docker.sock', host: '/var/run/docker.sock', mode: 'ro' }],
      environment: [
        { name: 'WATCHTOWER_CLEANUP', value: 'true' },
        { name: 'WATCHTOWER_POLL_INTERVAL', value: '86400' }
      ],
      restart: 'always'
    },
    configForm: [],
    healthCheck: { type: 'command', command: 'echo ok', interval: 60, timeout: 5, retries: 3 },
    tags: ['devops', 'docker', 'watchtower', 'auto-update'],
    downloads: 13800,
    rating: 4.6,
    requirements: { memory: 32, cpu: 1, disk: 128 }
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
