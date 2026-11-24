// Lažni GoHighLevel (LeadConnector) za lokalne provjere: node scripts/mock-ghl.mjs 8897
// Pamti kontakte, tagove, bilješke i opportunity-je; GET /_state vraća sve što je stiglo. Token mora biti "pit-...".
import { createServer } from 'node:http';
const port = Number(process.argv[2]) || 8897;
const S = { contacts: {}, opportunities: {}, calls: [] };
let seq = 0;
const send = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
createServer(async (req, res) => {
  let raw = '';
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : null;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/_state') return send(res, 200, S);
  S.calls.push({ method: req.method, path: url.pathname, version: req.headers.version });
  if (!/^Bearer pit-/.test(req.headers.authorization || '')) return send(res, 401, { message: 'Invalid token' });
  if (req.headers.version !== '2021-07-28') return send(res, 400, { message: 'version header was not found' });
  let m;
  if (req.method === 'GET' && url.pathname === '/opportunities/pipelines') return send(res, 200, { pipelines: [{ id: 'pipe1', name: 'Custom Jewelry', stages: [{ id: 'st-new', name: 'New Lead' }, { id: 'st-con', name: 'Contacted' }, { id: 'st-quo', name: 'Quote Sent' }, { id: 'st-won', name: 'Won' }, { id: 'st-lost', name: 'Lost' }] }] });
  if (req.method === 'POST' && url.pathname === '/contacts/upsert') {
    const old = Object.values(S.contacts).find((c) => c.email && c.email === body.email);
    const c = old || { id: `c${++seq}`, tags: [], notes: [] };
    Object.assign(c, body);
    S.contacts[c.id] = c;
    return send(res, 200, { contact: { id: c.id }, new: !old });
  }
  if (req.method === 'POST' && (m = url.pathname.match(/^\/contacts\/([^/]+)\/tags$/))) { const c = S.contacts[m[1]]; if (!c) return send(res, 404, { message: 'Contact not found' }); c.tags = [...new Set([...c.tags, ...body.tags])]; return send(res, 200, { tags: c.tags }); }
  if (req.method === 'POST' && (m = url.pathname.match(/^\/contacts\/([^/]+)\/notes$/))) { const c = S.contacts[m[1]]; if (!c) return send(res, 404, { message: 'Contact not found' }); c.notes.push(body.body); return send(res, 200, { note: { id: `n${++seq}` } }); }
  if (req.method === 'POST' && url.pathname === '/opportunities/') { const o = { id: `o${++seq}`, ...body }; S.opportunities[o.id] = o; return send(res, 201, { opportunity: { id: o.id } }); }
  if (req.method === 'PUT' && (m = url.pathname.match(/^\/opportunities\/([^/]+)$/))) { const o = S.opportunities[m[1]]; if (!o) return send(res, 404, { message: 'Opportunity not found' }); Object.assign(o, body); return send(res, 200, { opportunity: { id: o.id } }); }
  send(res, 404, { message: `No route ${req.method} ${url.pathname}` });
}).listen(port, '127.0.0.1', () => console.log(`mock GHL on ${port}`));
