const tls = require('tls');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const HOST = '3.140.187.19';
const PORT = 9527;
const TOKEN = 'e5231fa88ac3d79cf83b2125799ae73af9c4e118e51ac92ebe890bbd890fcacf';

async function main() {
  const rootCert = await new Promise((resolve, reject) => {
    const socket = tls.connect({ host: HOST, port: PORT, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(true);
      const b64 = cert.raw.toString('base64');
      resolve(Buffer.from(`-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`));
      socket.destroy();
    });
    socket.setTimeout(5000);
    socket.on('error', reject);
  });
  console.log('TOFU OK');

  const PROTO_PATH = path.join(__dirname, '..', 'proto', 'agent.proto');
  const pkgDef = await protoLoader.load(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
  });
  const proto = grpc.loadPackageDefinition(pkgDef);

  // 方法: 使用 grpc.credentials.createSsl 并设置 grpc.ssl_target_name_override
  console.log('--- Test: ssl_target_name_override ---');
  const creds = grpc.credentials.createSsl(rootCert);
  const client = new proto.runixo.AgentService(`${HOST}:${PORT}`, creds, {
    'grpc.ssl_target_name_override': 'runixo-agent',
    'grpc.default_authority': 'runixo-agent'
  });
  
  await new Promise((resolve) => {
    client.Authenticate({token: TOKEN, client_version: '0.1.0'}, {deadline: new Date(Date.now() + 8000)}, (err, res) => {
      if (err) console.log('FAILED:', err.code, err.details || err.message);
      else console.log('SUCCESS:', res.success, res.message);
      resolve();
    });
  });

  // 方法: createInsecure
  console.log('--- Test: insecure ---');
  const client2 = new proto.runixo.AgentService(`${HOST}:${PORT}`, grpc.credentials.createInsecure());
  await new Promise((resolve) => {
    client2.Authenticate({token: TOKEN, client_version: '0.1.0'}, {deadline: new Date(Date.now() + 8000)}, (err, res) => {
      if (err) console.log('FAILED:', err.code, err.details || err.message);
      else console.log('SUCCESS:', res.success, res.message);
      resolve();
    });
  });
}

main().then(() => process.exit(0)).catch(e => { console.log('FATAL:', e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 25000);
