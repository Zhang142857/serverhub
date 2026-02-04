const grpc = require('./client/node_modules/@grpc/grpc-js')
const protoLoader = require('./client/node_modules/@grpc/proto-loader')
const { join } = require('path')

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

  // 检查文件大小和 MD5
  client.ExecuteCommand({
    command: 'bash',
    args: ['-c', 'ls -la /usr/local/bin/serverhub-agent && md5sum /usr/local/bin/serverhub-agent'],
    timeout_seconds: 10
  }, metadata, (err, res) => {
    console.log('Server binary info:')
    console.log(res?.stdout || res?.stderr)
    
    // 检查运行中的进程
    client.ExecuteCommand({
      command: 'bash',
      args: ['-c', 'ps aux | grep serverhub-agent | grep -v grep'],
      timeout_seconds: 5
    }, metadata, (err2, res2) => {
      console.log('\nRunning process:')
      console.log(res2?.stdout || 'Not found')
      
      // 检查端口
      client.ExecuteCommand({
        command: 'bash',
        args: ['-c', 'ss -tlnp | grep -E "9527|9528"'],
        timeout_seconds: 5
      }, metadata, (err3, res3) => {
        console.log('\nListening ports:')
        console.log(res3?.stdout || 'None')
        
        // 检查版本
        client.ExecuteCommand({
          command: 'bash',
          args: ['-c', '/usr/local/bin/serverhub-agent --version'],
          timeout_seconds: 5
        }, metadata, (err4, res4) => {
          console.log('\nBinary version:')
          console.log(res4?.stdout || res4?.stderr)
          process.exit(0)
        })
      })
    })
  })
}

main().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
