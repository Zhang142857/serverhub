const tls = require('tls');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const HOST = '3.140.187.19';
const PORT = 9527;
const TOKEN = 'e5231fa88ac3d79cf83b2125799ae73af9c4e118e51ac92ebe890bbd890fcacf';

async function main() {
  // 获取证书
  const rootCert = await new Promise((resolve, reject) => {
    const socket = tls.connect({ host: HOST, port: PORT, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(true);
      const b64 = cert.raw.toString('base64');
      const pem = `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
      resolve(Buffer.from(pem));
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

  // 方法1: createSsl 带 checkServerIdentity
  console.log('\n--- Test 1: createSsl with rootCert ---');
  await testConnect(proto, grpc.credentials.createSsl(rootCert, null, null, {
    checkServerIdentity: () => undefined
  }));

  // 方法2: createSsl 不传 rootCert
  console.log('\n--- Test 2: createSsl without rootCert ---');
  await testConnect(proto, grpc.credentials.createSsl(null, null, null, {
    checkServerIdentity: () => undefined
  }));

  // 方法3: createSsl 带自定义 secureContext
  console.log('\n--- Test 3: createSsl with custom secureContext ---');
  const secureContext = tls.createSecureContext({ ca: rootCert });
  await testConnect(proto, grpc.credentials.createSsl(rootCert, null, null, {
    checkServerIdentity: () => undefined
  }));

  // 方法4: 手动创建 ChannelCredentials
  console.log('\n--- Test 4: createFromSecureContext ---');
  try {
    const ctx = tls.createSecureContext({ ca: rootCert });
    const creds = grpc.ChannelCredentials.createSsl(rootCert, null, null);
    await testConnect(proto, creds);
  } catch(e) { console.log('Error:', e.message); }
}

function testConnect(proto, creds) {
  return new Promise((resolve) => {
    const client = new proto.runixo.AgentService(`${HOST}:${PORT}`, creds);
    const deadline = new Date(Date.now() + 8000);
    client.Authenticate({token: TOKEN, client_version: '0.1.0'}, {deadline}, (err, res) => {
      if (err) console.log('FAILED:', err.code, err.details || err.message);
      else console.log('SUCCESS:', res.success, res.message);
      resolve();
    });
  });
}

main().then(() => process.exit(0)).catch(e => { console.log('FATAL:', e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 40000);
