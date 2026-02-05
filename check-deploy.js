const grpc = require('./client/node_modules/@grpc/grpc-js');
const protoLoader = require('./client/node_modules/@grpc/proto-loader');

const TOKEN = 'fcb75bf947ca1f3808ba5fb09d04033eb53e03187e2f81d776e362fcd343232a';
const packageDef = protoLoader.loadSync('./proto/agent.proto');
const proto = grpc.loadPackageDefinition(packageDef).serverhub;
const client = new proto.AgentService('3.143.142.246:9527', grpc.credentials.createInsecure());

const metadata = new grpc.Metadata();
metadata.set('authorization', `Bearer ${TOKEN}`);

const commands = [
  // 检查 PM2 进程
  'pm2 list 2>&1',
  // 检查端口监听
  'netstat -tlnp | grep -E "3010|3005|3000" 2>&1 || ss -tlnp | grep -E "3010|3005|3000" 2>&1 || echo "端口未监听"',
  // 检查项目目录
  'ls -la /home/qrcode-generator/ 2>&1',
  // 检查 PM2 日志
  'pm2 logs TEST-APP2 --lines 30 --nostream 2>&1 || echo "无日志"',
  // 直接测试本地访问
  'curl -s http://127.0.0.1:3010 2>&1 | head -20 || echo "本地无法访问"',
  // 检查 systemd 服务
  'systemctl status serverhub-TEST-APP2 --no-pager 2>&1 || echo "systemd服务不存在"'
];

async function run() {
  for (const cmd of commands) {
    await new Promise((resolve) => {
      client.ExecuteCommand({ command: 'bash', args: ['-c', cmd] }, metadata, (err, res) => {
        console.log('\n========================================');
        console.log('命令:', cmd.slice(0, 80));
        console.log('========================================');
        if (err) console.log('错误:', err.message);
        else console.log(res.stdout || res.stderr || '(无输出)');
        resolve();
      });
    });
  }
  process.exit(0);
}
run();
