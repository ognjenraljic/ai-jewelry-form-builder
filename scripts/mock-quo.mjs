// Lažni Quo (OpenPhone) za lokalne provjere: node scripts/mock-quo.mjs 8913
// Brojevi (GET /v1/phone-numbers), slanje poruke (POST /v1/messages -> 202; broj na 0000 = odjavljen kupac, na 9999 = A2P nije odobren),
// webhookovi (POST /webhooks, DELETE /webhooks/:id) i GET /_state. POST /_emit potpiše događaj ključem tog webhooka i pošalje ga na adresu.
import { createServer } from 'node:http';
import { createHmac, randomBytes } from 'node:crypto';
const port = Number(process.argv[2]) || 8913;
const S = { messages: [], webhooks: {}, calls: [] };
let seq = 0;
const send = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(data == null ? '' : JSON.stringify(data)); };
const NUMBERS = [
  { id: 'PNmain00001', name: 'Main line', number: '+13035550100', formattedNumber: '(303) 555-0100' },
  { id: 'PNstudio002', name: 'Studio', number: '+13035550101', formattedNumber: '(303) 555-0101' },
];
createServer(async (req, res) => {
  let raw = '';
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : null;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/_state') return send(res, 200, S);
  // Potpisan događaj prema Standard Webhooks: { url, webhookId, event, badSig? }
  if (req.method === 'POST' && url.pathname === '/_emit') {
    const w = S.webhooks[body.webhookId];
    const text = JSON.stringify(body.event);
    const id = `msg_${++seq}`;
    const ts = String(Math.floor((body.ts || Date.now()) / 1000));
    const secret = Buffer.from((body.badSig ? `whsec_${randomBytes(32).toString('base64')}` : w?.key || '').replace(/^whsec_/, ''), 'base64');
    const sig = createHmac('sha256', secret).update(`${id}.${ts}.${text}`).digest('base64');
    const r = await fetch(body.url, { method: 'POST', headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}` }, body: text });
    return send(res, 200, { status: r.status, body: await r.json().catch(() => ({})) });
  }
  if (req.method === 'POST' && url.pathname === '/_failwebhook') { S.failWebhook = !!body?.on; return send(res, 200, { failWebhook: S.failWebhook }); }
  S.calls.push({ method: req.method, path: url.pathname, auth: req.headers.authorization || '', version: req.headers['quo-api-version'] || '' });
  // Ključ je sirov (bez Bearer) i u ovom lažnom serveru mora počinjati sa "quo-".
  if (!/^quo-/.test(req.headers.authorization || '')) return send(res, 401, { message: 'Unauthorized', code: '0100401', status: 401 });
  let m;
  if (req.method === 'GET' && url.pathname === '/v1/phone-numbers') return send(res, 200, { data: NUMBERS, totalItems: NUMBERS.length });
  if (req.method === 'POST' && url.pathname === '/v1/messages') {
    if (!body || typeof body.content !== 'string' || !body.content || body.content.length > 1600 || !Array.isArray(body.to) || body.to.length !== 1 || !/^\+[1-9]\d{7,14}$/.test(body.to[0]) || !body.from) {
      return send(res, 400, { message: 'Invalid request', code: '0200400', status: 400 });
    }
    if (body.to[0].endsWith('0000')) return send(res, 400, { message: 'User Opted Out', code: '0201400', status: 400 });
    if (body.to[0].endsWith('9999')) return send(res, 400, { message: 'A2P Registration Not Approved', code: '0206400', status: 400 });
    const msg = { id: `AC${++seq}`, from: body.from, to: body.to, content: body.content, status: 'queued', createdAt: new Date().toISOString() };
    S.messages.push(msg);
    return send(res, 202, { data: msg });
  }
  if (req.method === 'POST' && url.pathname === '/webhooks') {
    if (req.headers['quo-api-version'] !== '2026-03-30') return send(res, 400, { message: 'Missing version', code: '0300400', status: 400 });
    if (S.failWebhook) return send(res, 403, { message: 'Forbidden', code: '0300403', status: 403 });
    const w = { id: `WH${++seq}`, url: body.url, events: body.events, resourceIds: body.resourceIds, label: body.label, key: `whsec_${randomBytes(32).toString('base64')}` };
    S.webhooks[w.id] = w;
    return send(res, 201, { data: w });
  }
  if (req.method === 'DELETE' && (m = url.pathname.match(/^\/webhooks\/([^/]+)$/))) { delete S.webhooks[m[1]]; return send(res, 204, null); }
  send(res, 404, { message: `No route ${req.method} ${url.pathname}`, code: '0000404', status: 404 });
}).listen(port, '127.0.0.1', () => console.log(`mock Quo on ${port}`));
