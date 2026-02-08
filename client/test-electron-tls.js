// 用 ELECTRON_RUN_AS_NODE 模式测试，模拟 Electron 主进程中的 Node.js 环境
const tls = require('tls');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const HOST = '3.140.187.19';
const PORT = 9527;
const TOKEN = 'e5231fa88ac3d79cf83b2125799ae73af9c4e118e51ac92ebe890bbd890fcacf';

async function main() {
  console.log('Electron Node version:', process.version);
  console.log('grpc-js version:', require('@grpc/grpc-js/package.json').version);
  
  // fetchServerCert - TLS handshake
  const rootCert = await new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: HOST, port: PORT, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate(true);
        if (cert && cert.raw) {
          const b64 = cert.raw.toString('base64');
          const pem = `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
          console.log('TOFU: OK, length:', pem.length);
          resolve(Buffer.from(pem));
        } else {
          reject(new Error('no cert'));
        }
        socket.destroy();
      }
    );
    socket.setTimeout(5000);
    socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
    socket.on('error', (err) => { console.log('TLS error:', err.message); reject(err); });
  });

  // gRPC connect
  const PROTO_PATH = path.join(__dirname, '..', 'proto', 'agent.proto');
  console.log('Proto path:', PROTO_PATH);
  const pkgDef = await protoLoader.load(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
  });
  const proto = grpc.loadPackageDefinition(pkgDef);
  const creds = grpc.credentials.createSsl(rootCert, null, null, {
    checkServerIdentity: () => undefined
  });
  const client = new proto.runixo.AgentService(`${HOST}:${PORT}`, creds);

  return new Promise((resolve) => {
    client.Authenticate({token: TOKEN, client_version: '0.1.0'}, (err, res) => {
      if (err) {
        console.log('CONNECT FAILED:', err.code, err.message);
      } else {
        console.log('CONNECT SUCCESS:', res.success, res.message);
      }
      resolve();
    });
  });
}

main().then(() => process.exit(0)).catch(e => { console.log('FATAL:', e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);
