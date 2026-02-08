const tls = require('tls');
const http2 = require('http2');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const HOST = '3.140.187.19';
const PORT = 9527;
const TOKEN = 'e5231fa88ac3d79cf83b2125799ae73af9c4e118e51ac92ebe890bbd890fcacf';

async function main() {
  // 获取证书
  const rootCert = await new Promise((resolve, reject) => {
    const socket = tls.connect({ host: HOST, port: PORT, rejectUnauthorized: false, ALPNProtocols: ['h2'] }, () => {
      const cert = socket.getPeerCertificate(true);
      const b64 = cert.raw.toString('base64');
      console.log('ALPN negotiated:', socket.alpnProtocol);
      resolve(Buffer.from(`-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`));
      socket.destroy();
    });
    socket.setTimeout(5000);
    socket.on('error', reject);
  });

  // 直接用 http2 + 证书连接 gRPC
  console.log('\n--- Test: http2 with CA cert ---');
  const session = http2.connect(`https://${HOST}:${PORT}`, {
    ca: rootCert,
    rejectUnauthorized: false
  });
  
  await new Promise((resolve) => {
    session.on('connect', () => {
      console.log('http2 session: CONNECTED');
      
      // 发送 gRPC 请求
      const req = session.request({
        ':method': 'POST',
        ':path': '/runixo.AgentService/Authenticate',
        'content-type': 'application/grpc',
        'te': 'trailers'
      });
      
      req.on('response', (headers) => {
        console.log('gRPC response status:', headers[':status']);
        console.log('grpc-status:', headers['grpc-status']);
      });
      
      req.on('data', (chunk) => {
        console.log('Got data, length:', chunk.length);
      });
      
      req.on('end', () => {
        console.log('Request ended');
        session.close();
        resolve();
      });
      
      req.on('error', (e) => {
        console.log('Request error:', e.message);
        session.close();
        resolve();
      });
      
      // 不发送实际 protobuf 数据，只测试连接
      req.end();
    });
    
    session.on('error', (err) => {
      console.log('http2 error:', err.message);
      resolve();
    });
  });

  // 现在用 grpc-js 但开启 trace
  console.log('\n--- Test: grpc-js with GRPC_TRACE ---');
  process.env.GRPC_TRACE = 'channel,subchannel';
  process.env.GRPC_VERBOSITY = 'DEBUG';
  
  const PROTO_PATH = path.join(__dirname, '..', 'proto', 'agent.proto');
  const pkgDef = await protoLoader.load(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
  });
  const proto = grpc.loadPackageDefinition(pkgDef);
  const creds = grpc.credentials.createSsl(rootCert, null, null, {
    checkServerIdentity: () => undefined
  });
  const client = new proto.runixo.AgentService(`${HOST}:${PORT}`, creds);
  
  await new Promise((resolve) => {
    client.Authenticate({token: TOKEN, client_version: '0.1.0'}, {deadline: new Date(Date.now() + 8000)}, (err, res) => {
      if (err) console.log('gRPC FAILED:', err.code, err.details || err.message);
      else console.log('gRPC SUCCESS:', res.success, res.message);
      resolve();
    });
  });
}

main().then(() => process.exit(0)).catch(e => { console.log('FATAL:', e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 20000);
