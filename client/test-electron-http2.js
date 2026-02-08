const http2 = require('http2');
const tls = require('tls');

const HOST = '3.140.187.19';
const PORT = 9527;

// 测试 Electron 中 http2 模块是否正常
console.log('Node version:', process.version);
console.log('http2 available:', !!http2);

// 测试1: tls.connect
console.log('\n--- Test: tls.connect ---');
const socket = tls.connect({ host: HOST, port: PORT, rejectUnauthorized: false }, () => {
  console.log('tls.connect: OK, protocol:', socket.getProtocol());
  console.log('ALPN:', socket.alpnProtocol);
  socket.destroy();
  
  // 测试2: http2.connect
  console.log('\n--- Test: http2.connect ---');
  try {
    const session = http2.connect(`https://${HOST}:${PORT}`, {
      rejectUnauthorized: false
    });
    session.on('connect', () => {
      console.log('http2: CONNECTED');
      session.close();
      process.exit(0);
    });
    session.on('error', (err) => {
      console.log('http2 error:', err.message);
      process.exit(0);
    });
  } catch(e) {
    console.log('http2 exception:', e.message);
    process.exit(0);
  }
});
socket.on('error', (e) => console.log('tls error:', e.message));

setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 10000);
