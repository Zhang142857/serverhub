const grpc = require('./client/node_modules/@grpc/grpc-js')
const protoLoader = require('./client/node_modules/@grpc/proto-loader')
const { join } = require('path')
const fs = require('fs')

const PROTO_PATH = join(__dirname, 'proto', 'agent.proto')
const TOKEN = 'fcb75bf947ca1f3808ba5fb09d04033eb53e03187e2f81d776e362fcd343232a'

async function main() {
  const packageDefinition = await protoLoader.load(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })

  const proto = grpc.loadPackageDefinition(packageDefinition)
  const client = new proto.serverhub.AgentService(
    '3.143.142.246:9527',
    grpc.credentials.createInsecure()
  )

  const metadata = new grpc.Metadata()
  metadata.set('authorization', `Bearer ${TOKEN}`)

  const binaryPath = join(__dirname, 'agent', 'serverhub-agent-linux')
  const binaryContent = fs.readFileSync(binaryPath)
  const base64 = binaryContent.toString('base64')
  
  console.log(`Binary size: ${(binaryContent.length / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Base64 length: ${base64.length}`)
  
  // 使用更小的块，并用 heredoc 方式写入避免引号问题
  const chunkSize = 500 * 1024 // 500KB chunks
  const chunks = []
  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(base64.slice(i, i + chunkSize))
  }
  
  console.log(`Uploading in ${chunks.length} chunks...`)
  
  // 先清空目标文件
  await execCmd(client, metadata, 'rm -f /tmp/agent.b64')
  
  // 逐块上传，使用 printf 避免 echo 的问题
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    // 使用 printf 和 >> 追加
    await execCmd(client, metadata, `printf '%s' "${chunk}" >> /tmp/agent.b64`, 60)
    console.log(`Chunk ${i + 1}/${chunks.length} uploaded`)
  }
  
  // 验证上传的 base64 长度
  const result = await execCmd(client, metadata, 'wc -c /tmp/agent.b64')
  console.log('Uploaded base64 size:', result.stdout)
  console.log('Expected:', base64.length)
  
  // 解码
  console.log('Decoding...')
  await execCmd(client, metadata, 'base64 -d /tmp/agent.b64 > /tmp/serverhub-agent-new', 120)
  
  // 验证解码后的文件
  const decoded = await execCmd(client, metadata, 'ls -la /tmp/serverhub-agent-new && md5sum /tmp/serverhub-agent-new')
  console.log('Decoded file:', decoded.stdout)
  
  // 替换并重启
  console.log('Replacing and restarting...')
  await execCmd(client, metadata, 'chmod +x /tmp/serverhub-agent-new && mv /tmp/serverhub-agent-new /usr/local/bin/serverhub-agent')
  await execCmd(client, metadata, 'systemctl restart serverhub-agent')
  
  // 等待启动
  await new Promise(r => setTimeout(r, 3000))
  
  // 检查日志
  const logs = await execCmd(client, metadata, 'journalctl -u serverhub-agent -n 10 --no-pager')
  console.log('\nLogs:', logs.stdout)
  
  // 测试 API
  const health = await execCmd(client, metadata, 'curl -s http://localhost:9528/api/health')
  console.log('\nHealth API:', health.stdout)
  
  process.exit(0)
}

function execCmd(client, metadata, cmd, timeout = 30) {
  return new Promise((resolve, reject) => {
    client.ExecuteCommand({
      command: 'bash',
      args: ['-c', cmd],
      timeout_seconds: timeout
    }, metadata, (err, res) => {
      if (err) reject(err)
      else resolve(res)
    })
  })
}

main().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
