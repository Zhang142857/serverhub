/**
 * 存储提供商 - 支持多种存储后端
 */

import { GrpcClient } from '../grpc/client'
import * as path from 'path'

/**
 * 存储提供商接口
 */
export interface StorageProvider {
  /**
   * 上传文件到存储
   */
  upload(
    grpcClient: GrpcClient,
    localPath: string,
    remotePath: string,
    credentials?: any
  ): Promise<void>

  /**
   * 从存储下载文件
   */
  download(
    grpcClient: GrpcClient,
    remotePath: string,
    localPath: string,
    credentials?: any
  ): Promise<void>

  /**
   * 删除存储中的文件
   */
  delete(
    grpcClient: GrpcClient,
    remotePath: string,
    credentials?: any
  ): Promise<void>

  /**
   * 列出存储中的文件
   */
  list(
    grpcClient: GrpcClient,
    remotePath: string,
    credentials?: any
  ): Promise<string[]>
}

/**
 * 本地存储提供商
 */
export class LocalStorageProvider implements StorageProvider {
  async upload(
    grpcClient: GrpcClient,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    // 确保目标目录存在
    const targetDir = path.dirname(remotePath)
    await grpcClient.executeCommand('mkdir', ['-p', targetDir])

    // 复制文件
    const result = await grpcClient.executeCommand('cp', [localPath, remotePath])
    
    if (result.exit_code !== 0) {
      throw new Error(`本地存储上传失败: ${result.stderr}`)
    }
  }

  async download(
    grpcClient: GrpcClient,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    // 确保目标目录存在
    const targetDir = path.dirname(localPath)
    await grpcClient.executeCommand('mkdir', ['-p', targetDir])

    // 复制文件
    const result = await grpcClient.executeCommand('cp', [remotePath, localPath])
    
    if (result.exit_code !== 0) {
      throw new Error(`本地存储下载失败: ${result.stderr}`)
    }
  }

  async delete(
    grpcClient: GrpcClient,
    remotePath: string
  ): Promise<void> {
    const result = await grpcClient.executeCommand('rm', ['-f', remotePath])
    
    if (result.exit_code !== 0) {
      throw new Error(`本地存储删除失败: ${result.stderr}`)
    }
  }

  async list(
    grpcClient: GrpcClient,
    remotePath: string
  ): Promise<string[]> {
    const result = await grpcClient.executeCommand('ls', ['-1', remotePath])
    
    if (result.exit_code !== 0) {
      return []
    }

    return result.stdout.split('\n').filter(line => line.trim())
  }
}

/**
 * 阿里云OSS存储提供商
 */
export class OSSStorageProvider implements StorageProvider {
  async upload(
    grpcClient: GrpcClient,
    localPath: string,
    remotePath: string,
    credentials?: any
  ): Promise<void> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('OSS存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    // 使用ossutil上传
    const result = await grpcClient.executeCommand('ossutil', [
      'cp',
      localPath,
      `oss://${credentials.bucket}/${remotePath}`,
      '-e',
      credentials.endpoint || 'oss-cn-hangzhou.aliyuncs.com',
      '-i',
      credentials.accessKeyId,
      '-k',
      credentials.secretAccessKey
    ])

    if (result.exit_code !== 0) {
      throw new Error(`OSS上传失败: ${result.stderr}`)
    }
  }

  async download(
    grpcClient: GrpcClient,
    remotePath: string,
    localPath: string,
    credentials?: any
  ): Promise<void> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('OSS存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    // 确保目标目录存在
    const targetDir = path.dirname(localPath)
    await grpcClient.executeCommand('mkdir', ['-p', targetDir])

    // 使用ossutil下载
    const result = await grpcClient.executeCommand('ossutil', [
      'cp',
      `oss://${credentials.bucket}/${remotePath}`,
      localPath,
      '-e',
      credentials.endpoint || 'oss-cn-hangzhou.aliyuncs.com',
      '-i',
      credentials.accessKeyId,
      '-k',
      credentials.secretAccessKey
    ])

    if (result.exit_code !== 0) {
      throw new Error(`OSS下载失败: ${result.stderr}`)
    }
  }

  async delete(
    grpcClient: GrpcClient,
    remotePath: string,
    credentials?: any
  ): Promise<void> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('OSS存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    const result = await grpcClient.executeCommand('ossutil', [
      'rm',
      `oss://${credentials.bucket}/${remotePath}`,
      '-e',
      credentials.endpoint || 'oss-cn-hangzhou.aliyuncs.com',
      '-i',
      credentials.accessKeyId,
      '-k',
      credentials.secretAccessKey
    ])

    if (result.exit_code !== 0) {
      throw new Error(`OSS删除失败: ${result.stderr}`)
    }
  }

  async list(
    grpcClient: GrpcClient,
    remotePath: string,
    credentials?: any
  ): Promise<string[]> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('OSS存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    const result = await grpcClient.executeCommand('ossutil', [
      'ls',
      `oss://${credentials.bucket}/${remotePath}`,
      '-e',
      credentials.endpoint || 'oss-cn-hangzhou.aliyuncs.com',
      '-i',
      credentials.accessKeyId,
      '-k',
      credentials.secretAccessKey
    ])

    if (result.exit_code !== 0) {
      return []
    }

    // 解析ossutil ls输出
    return result.stdout
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('Object Number'))
      .map(line => line.trim())
  }
}

/**
 * AWS S3存储提供商
 */
export class S3StorageProvider implements StorageProvider {
  async upload(
    grpcClient: GrpcClient,
    localPath: string,
    remotePath: string,
    credentials?: any
  ): Promise<void> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('S3存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    // 设置AWS凭证环境变量
    const env = {
      AWS_ACCESS_KEY_ID: credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      AWS_DEFAULT_REGION: credentials.region || 'us-east-1'
    }

    // 使用aws cli上传
    const result = await grpcClient.executeCommand('aws', [
      's3',
      'cp',
      localPath,
      `s3://${credentials.bucket}/${remotePath}`
    ], { env })

    if (result.exit_code !== 0) {
      throw new Error(`S3上传失败: ${result.stderr}`)
    }
  }

  async download(
    grpcClient: GrpcClient,
    remotePath: string,
    localPath: string,
    credentials?: any
  ): Promise<void> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('S3存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    // 确保目标目录存在
    const targetDir = path.dirname(localPath)
    await grpcClient.executeCommand('mkdir', ['-p', targetDir])

    // 设置AWS凭证环境变量
    const env = {
      AWS_ACCESS_KEY_ID: credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      AWS_DEFAULT_REGION: credentials.region || 'us-east-1'
    }

    // 使用aws cli下载
    const result = await grpcClient.executeCommand('aws', [
      's3',
      'cp',
      `s3://${credentials.bucket}/${remotePath}`,
      localPath
    ], { env })

    if (result.exit_code !== 0) {
      throw new Error(`S3下载失败: ${result.stderr}`)
    }
  }

  async delete(
    grpcClient: GrpcClient,
    remotePath: string,
    credentials?: any
  ): Promise<void> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('S3存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    const env = {
      AWS_ACCESS_KEY_ID: credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      AWS_DEFAULT_REGION: credentials.region || 'us-east-1'
    }

    const result = await grpcClient.executeCommand('aws', [
      's3',
      'rm',
      `s3://${credentials.bucket}/${remotePath}`
    ], { env })

    if (result.exit_code !== 0) {
      throw new Error(`S3删除失败: ${result.stderr}`)
    }
  }

  async list(
    grpcClient: GrpcClient,
    remotePath: string,
    credentials?: any
  ): Promise<string[]> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('S3存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    const env = {
      AWS_ACCESS_KEY_ID: credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      AWS_DEFAULT_REGION: credentials.region || 'us-east-1'
    }

    const result = await grpcClient.executeCommand('aws', [
      's3',
      'ls',
      `s3://${credentials.bucket}/${remotePath}`
    ], { env })

    if (result.exit_code !== 0) {
      return []
    }

    // 解析aws s3 ls输出
    return result.stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.trim().split(/\s+/)
        return parts[parts.length - 1]
      })
  }
}

/**
 * 腾讯云COS存储提供商
 */
export class COSStorageProvider implements StorageProvider {
  async upload(
    grpcClient: GrpcClient,
    localPath: string,
    remotePath: string,
    credentials?: any
  ): Promise<void> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('COS存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    // 使用coscli上传
    const result = await grpcClient.executeCommand('coscli', [
      'cp',
      localPath,
      `cos://${credentials.bucket}/${remotePath}`,
      '-e',
      credentials.endpoint || 'cos.ap-guangzhou.myqcloud.com',
      '-i',
      credentials.accessKeyId,
      '-k',
      credentials.secretAccessKey
    ])

    if (result.exit_code !== 0) {
      throw new Error(`COS上传失败: ${result.stderr}`)
    }
  }

  async download(
    grpcClient: GrpcClient,
    remotePath: string,
    localPath: string,
    credentials?: any
  ): Promise<void> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('COS存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    // 确保目标目录存在
    const targetDir = path.dirname(localPath)
    await grpcClient.executeCommand('mkdir', ['-p', targetDir])

    // 使用coscli下载
    const result = await grpcClient.executeCommand('coscli', [
      'cp',
      `cos://${credentials.bucket}/${remotePath}`,
      localPath,
      '-e',
      credentials.endpoint || 'cos.ap-guangzhou.myqcloud.com',
      '-i',
      credentials.accessKeyId,
      '-k',
      credentials.secretAccessKey
    ])

    if (result.exit_code !== 0) {
      throw new Error(`COS下载失败: ${result.stderr}`)
    }
  }

  async delete(
    grpcClient: GrpcClient,
    remotePath: string,
    credentials?: any
  ): Promise<void> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('COS存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    const result = await grpcClient.executeCommand('coscli', [
      'rm',
      `cos://${credentials.bucket}/${remotePath}`,
      '-e',
      credentials.endpoint || 'cos.ap-guangzhou.myqcloud.com',
      '-i',
      credentials.accessKeyId,
      '-k',
      credentials.secretAccessKey
    ])

    if (result.exit_code !== 0) {
      throw new Error(`COS删除失败: ${result.stderr}`)
    }
  }

  async list(
    grpcClient: GrpcClient,
    remotePath: string,
    credentials?: any
  ): Promise<string[]> {
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.bucket) {
      throw new Error('COS存储需要提供accessKeyId、secretAccessKey和bucket')
    }

    const result = await grpcClient.executeCommand('coscli', [
      'ls',
      `cos://${credentials.bucket}/${remotePath}`,
      '-e',
      credentials.endpoint || 'cos.ap-guangzhou.myqcloud.com',
      '-i',
      credentials.accessKeyId,
      '-k',
      credentials.secretAccessKey
    ])

    if (result.exit_code !== 0) {
      return []
    }

    // 解析coscli ls输出
    return result.stdout
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('KEY'))
      .map(line => line.trim())
  }
}
