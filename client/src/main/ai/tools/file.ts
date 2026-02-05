/**
 * 文件工具定义
 * 包含文件读写、目录操作等工具
 */

import { ToolDefinition, ToolContext, ToolResult } from './registry'

/**
 * 列出目录工具
 */
export const listDirectoryTool: ToolDefinition = {
  name: 'list_directory',
  displayName: '列出目录',
  description: '列出指定目录的内容，包括文件和子目录的名称、大小、权限等信息',
  category: 'file',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '目录的绝对路径',
        required: true
      },
      recursive: {
        type: 'boolean',
        description: '是否递归列出子目录',
        default: false
      }
    },
    required: ['path']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = params.path as string
      const recursive = params.recursive as boolean

      const result = await context.executor.listDirectory(context.serverId, path, recursive)

      return {
        success: true,
        data: result.entries,
        message: `目录 ${path} 包含 ${result.entries?.length || 0} 个项目`
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
 * 读取文件工具
 */
export const readFileTool: ToolDefinition = {
  name: 'read_file',
  displayName: '读取文件',
  description: '读取服务器上文件的内容。支持文本文件，大文件会被截断',
  category: 'file',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件的绝对路径',
        required: true
      },
      maxSize: {
        type: 'number',
        description: '最大读取字节数（默认 100KB）',
        default: 102400
      }
    },
    required: ['path']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = params.path as string
      const maxSize = (params.maxSize as number) || 102400

      const result = await context.executor.readFile(context.serverId, path)

      let content = result.content
      let truncated = false

      if (content && content.length > maxSize) {
        content = content.substring(0, maxSize)
        truncated = true
      }

      return {
        success: true,
        data: {
          content,
          size: result.size,
          truncated
        },
        message: truncated ? `文件内容已截断（超过 ${maxSize} 字节）` : '成功读取文件'
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
 * 写入文件工具
 */
export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  displayName: '写入文件',
  description: '将内容写入服务器上的文件。如果文件不存在会创建，存在则覆盖',
  category: 'file',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件的绝对路径',
        required: true
      },
      content: {
        type: 'string',
        description: '要写入的内容',
        required: true
      },
      createDirs: {
        type: 'boolean',
        description: '如果父目录不存在是否自动创建',
        default: true
      }
    },
    required: ['path', 'content']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = params.path as string
      const content = params.content as string

      const result = await context.executor.writeFile(context.serverId, path, content)

      return {
        success: result.success,
        data: result,
        message: result.success ? `文件 ${path} 写入成功` : result.error
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
 * 删除文件工具
 */
export const deleteFileTool: ToolDefinition = {
  name: 'delete_file',
  displayName: '删除文件',
  description: '删除服务器上的文件或目录',
  category: 'file',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件或目录的绝对路径',
        required: true
      },
      recursive: {
        type: 'boolean',
        description: '如果是目录，是否递归删除',
        default: false
      }
    },
    required: ['path']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = params.path as string

      const result = await context.executor.deleteFile(context.serverId, path)

      return {
        success: result.success,
        data: result,
        message: result.success ? `${path} 已删除` : result.error
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
 * 搜索文件工具
 */
export const searchFilesTool: ToolDefinition = {
  name: 'search_files',
  displayName: '搜索文件',
  description: '在指定目录中搜索文件，支持文件名模式匹配',
  category: 'file',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '搜索的起始目录',
        required: true
      },
      pattern: {
        type: 'string',
        description: '文件名匹配模式（支持通配符 * 和 ?）',
        required: true
      },
      maxDepth: {
        type: 'number',
        description: '最大搜索深度',
        default: 5
      },
      type: {
        type: 'string',
        description: '搜索类型',
        enum: ['file', 'directory', 'all'],
        default: 'all'
      }
    },
    required: ['path', 'pattern']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = params.path as string
      const pattern = params.pattern as string
      const maxDepth = (params.maxDepth as number) || 5
      const type = (params.type as string) || 'all'

      // 使用 find 命令搜索
      const args = [path, '-maxdepth', String(maxDepth), '-name', pattern]

      if (type === 'file') {
        args.push('-type', 'f')
      } else if (type === 'directory') {
        args.push('-type', 'd')
      }

      const result = await context.executor.executeCommand(context.serverId, 'find', args)

      const files = result.stdout
        .split('\n')
        .filter(Boolean)
        .slice(0, 100) // 限制结果数量

      return {
        success: result.exit_code === 0,
        data: files,
        message: `找到 ${files.length} 个匹配项`
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
 * 搜索文件内容工具
 */
export const grepFilesTool: ToolDefinition = {
  name: 'grep_files',
  displayName: '搜索文件内容',
  description: '在文件中搜索指定的文本或正则表达式',
  category: 'file',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '搜索的目录或文件路径',
        required: true
      },
      pattern: {
        type: 'string',
        description: '搜索的文本或正则表达式',
        required: true
      },
      recursive: {
        type: 'boolean',
        description: '是否递归搜索子目录',
        default: true
      },
      ignoreCase: {
        type: 'boolean',
        description: '是否忽略大小写',
        default: false
      },
      maxResults: {
        type: 'number',
        description: '最大结果数量',
        default: 50
      }
    },
    required: ['path', 'pattern']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = params.path as string
      const pattern = params.pattern as string
      const recursive = params.recursive !== false
      const ignoreCase = params.ignoreCase as boolean
      const maxResults = (params.maxResults as number) || 50

      const args = ['-n'] // 显示行号

      if (recursive) {
        args.push('-r')
      }

      if (ignoreCase) {
        args.push('-i')
      }

      args.push('-m', String(maxResults), pattern, path)

      const result = await context.executor.executeCommand(context.serverId, 'grep', args)

      const matches = result.stdout
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const match = line.match(/^(.+?):(\d+):(.*)$/)
          if (match) {
            return {
              file: match[1],
              line: parseInt(match[2]),
              content: match[3]
            }
          }
          return { file: '', line: 0, content: line }
        })

      return {
        success: true,
        data: matches,
        message: `找到 ${matches.length} 个匹配项`
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
 * 获取文件信息工具
 */
export const fileInfoTool: ToolDefinition = {
  name: 'file_info',
  displayName: '文件信息',
  description: '获取文件或目录的详细信息，包括大小、权限、修改时间等',
  category: 'file',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件或目录的绝对路径',
        required: true
      }
    },
    required: ['path']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = params.path as string

      const result = await context.executor.executeCommand(
        context.serverId,
        'stat',
        ['--format', '{"name":"%n","size":%s,"mode":"%a","uid":%u,"gid":%g,"atime":"%x","mtime":"%y","ctime":"%z"}', path]
      )

      if (result.exit_code !== 0) {
        return {
          success: false,
          error: result.stderr || '获取文件信息失败'
        }
      }

      let info: unknown
      try {
        info = JSON.parse(result.stdout.trim())
      } catch {
        info = { raw: result.stdout }
      }

      return {
        success: true,
        data: info,
        message: '成功获取文件信息'
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
 * 复制文件工具
 */
export const copyFileTool: ToolDefinition = {
  name: 'copy_file',
  displayName: '复制文件',
  description: '复制文件或目录到新位置',
  category: 'file',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: '源文件或目录路径',
        required: true
      },
      destination: {
        type: 'string',
        description: '目标路径',
        required: true
      },
      recursive: {
        type: 'boolean',
        description: '如果是目录，是否递归复制',
        default: true
      }
    },
    required: ['source', 'destination']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const source = params.source as string
      const destination = params.destination as string
      const recursive = params.recursive !== false

      const args = recursive ? ['-r', source, destination] : [source, destination]

      const result = await context.executor.executeCommand(context.serverId, 'cp', args)

      return {
        success: result.exit_code === 0,
        data: { source, destination },
        message: result.exit_code === 0 ? `已复制到 ${destination}` : result.stderr
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
 * 移动文件工具
 */
export const moveFileTool: ToolDefinition = {
  name: 'move_file',
  displayName: '移动文件',
  description: '移动或重命名文件/目录',
  category: 'file',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: '源文件或目录路径',
        required: true
      },
      destination: {
        type: 'string',
        description: '目标路径',
        required: true
      }
    },
    required: ['source', 'destination']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const source = params.source as string
      const destination = params.destination as string

      const result = await context.executor.executeCommand(context.serverId, 'mv', [source, destination])

      return {
        success: result.exit_code === 0,
        data: { source, destination },
        message: result.exit_code === 0 ? `已移动到 ${destination}` : result.stderr
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
 * 创建目录工具
 */
export const createDirectoryTool: ToolDefinition = {
  name: 'create_directory',
  displayName: '创建目录',
  description: '创建新目录，支持递归创建父目录',
  category: 'file',
  dangerous: false,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要创建的目录路径',
        required: true
      },
      mode: {
        type: 'string',
        description: '目录权限（如 755）',
        default: '755'
      }
    },
    required: ['path']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = params.path as string
      const mode = (params.mode as string) || '755'

      const result = await context.executor.executeCommand(
        context.serverId,
        'mkdir',
        ['-p', '-m', mode, path]
      )

      return {
        success: result.exit_code === 0,
        data: { path, mode },
        message: result.exit_code === 0 ? `目录 ${path} 创建成功` : result.stderr
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
 * 修改文件权限工具
 */
export const chmodTool: ToolDefinition = {
  name: 'chmod',
  displayName: '修改权限',
  description: '修改文件或目录的权限',
  category: 'file',
  dangerous: true,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件或目录路径',
        required: true
      },
      mode: {
        type: 'string',
        description: '权限模式（如 755, 644, u+x）',
        required: true
      },
      recursive: {
        type: 'boolean',
        description: '是否递归修改',
        default: false
      }
    },
    required: ['path', 'mode']
  },
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = params.path as string
      const mode = params.mode as string
      const recursive = params.recursive as boolean

      const args = recursive ? ['-R', mode, path] : [mode, path]

      const result = await context.executor.executeCommand(context.serverId, 'chmod', args)

      return {
        success: result.exit_code === 0,
        data: { path, mode },
        message: result.exit_code === 0 ? `权限已修改为 ${mode}` : result.stderr
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
 * 导出所有文件工具
 */
export const fileTools: ToolDefinition[] = [
  listDirectoryTool,
  readFileTool,
  writeFileTool,
  deleteFileTool,
  searchFilesTool,
  grepFilesTool,
  fileInfoTool,
  copyFileTool,
  moveFileTool,
  createDirectoryTool,
  chmodTool
]
