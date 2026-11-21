// Lažni Resend API za lokalne provjere mejla. Worker ga koristi samo uz DEV_MODE=1 i MAIL_API_BASE.
// Pokretanje: node scripts/mock-mail.mjs [port]   GET /__log = poslati mejlovi, POST /__fail = sljedeće slanje padne (500)
import { createServer } from 'node:http';

const port = +(process.argv[2] || 8897);
const sent = [];
let failNext = 0;
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    if (req.url === '/__log') return send(res, 200, sent);
    if (req.url === '/__fail') { failNext++; return send(res, 200, { ok: true }); }
    if (req.url === '/emails' && req.method === 'POST') {
      if (!/^Bearer \S+/.test(req.headers.authorization || '')) return send(res, 401, { message: 'missing key' });
      if (failNext) { failNext--; return send(res, 500, { message: 'mock failure' }); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const id = `mock_${sent.length + 1}`;
      sent.push({ id, ...body, at: Date.now() });
      return send(res, 200, { id });
    }
    send(res, 404, { message: 'not found' });
  });
}).listen(port, '127.0.0.1', () => console.log(`mock mail on ${port}`));
