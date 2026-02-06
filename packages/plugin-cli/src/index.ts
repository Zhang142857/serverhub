#!/usr/bin/env node

import { Command } from 'commander'
import { createCommand } from './commands/create'
import { buildCommand } from './commands/build'
import { devCommand } from './commands/dev'

const program = new Command()

program
  .name('serverhub-plugin')
  .description('CLI tool for creating and managing ServerHub plugins')
  .version('1.0.0')

// 创建插件命令
program
  .command('create [name]')
  .description('Create a new plugin')
  .option('-t, --template <template>', 'Plugin template (basic, cloud-service, monitoring)')
  .action(createCommand)

// 构建插件命令
program
  .command('build')
  .description('Build the plugin')
  .option('-w, --watch', 'Watch mode')
  .action(buildCommand)

// 开发模式命令
program
  .command('dev')
  .description('Start development server with hot reload')
  .option('-p, --port <port>', 'Dev server port', '3000')
  .action(devCommand)

program.parse()
