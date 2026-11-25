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
  if (req.method === 'GET' && url.pathname === '/opportunities/pipelines') return send(res, 200, { pipelines: [{ id: 'pipe1', name: 'Custom Jewelry', stages: [{ id: 'st-new', name: 'New Lead' }, { id: 'st-con', name: 'Contacted' }, { id: 'st-quo', name: 'Quote Sent' }, { id: 'st-won', name: 'Won' }, { id: 'st-lost', name: 'Lost' }] },
    // Proizvodna tabla (25.11.2026)
    { id: 'prod1', name: 'Production', stages: [{ id: 'pr-placed', name: 'Order placed' }, { id: 'pr-cad', name: 'CAD approved' }, { id: 'pr-cast', name: 'Wax & cast' }, { id: 'pr-set', name: 'Stone setting' }, { id: 'pr-pol', name: 'Polish' }, { id: 'pr-ready', name: 'Ready for pick up' }] }] });
  if (req.method === 'GET' && url.pathname === '/users/') return send(res, 200, { users: [{ id: 'userWorker01', name: 'Moissanite Worker' }, { id: 'userOwner001', firstName: 'Enrique', lastName: 'G' }] });
  if (req.method === 'POST' && url.pathname === '/contacts/') { const c = { id: `c${++seq}`, tags: [], notes: [], ...body }; S.contacts[c.id] = c; return send(res, 201, { contact: { id: c.id } }); }
  if (req.method === 'GET' && (m = url.pathname.match(/^\/opportunities\/([^/]+)$/)) && m[1] !== 'pipelines') { const o = S.opportunities[m[1]]; return o ? send(res, 200, { opportunity: o }) : send(res, 404, { message: 'Opportunity not found' }); }
  if (req.method === 'POST' && url.pathname === '/contacts/upsert') {
    const old = Object.values(S.contacts).find((c) => c.email && c.email === body.email);
    const c = old || { id: `c${++seq}`, tags: [], notes: [] };
    Object.assign(c, body);
    S.contacts[c.id] = c;
    return send(res, 200, { contact: { id: c.id }, new: !old });
  }
  if (req.method === 'POST' && (m = url.pathname.match(/^\/contacts\/([^/]+)\/tags$/))) { const c = S.contacts[m[1]]; if (!c) return send(res, 404, { message: 'Contact not found' }); c.tags = [...new Set([...c.tags, ...body.tags])]; return send(res, 200, { tags: c.tags }); }
  if (req.method === 'POST' && (m = url.pathname.match(/^\/contacts\/([^/]+)\/notes$/))) { const c = S.contacts[m[1]]; if (!c) return send(res, 404, { message: 'Contact not found' }); c.notes.push(body.body); return send(res, 200, { note: { id: `n${++seq}` } }); }
  // Kao pravi GHL: jedna opportunity po kontaktu u pipeline-u (OPPORTUNITY_NO_DUPLICATE + meta.existingId).
  if (req.method === 'POST' && url.pathname === '/opportunities/' && body.contactId) { const dup = Object.values(S.opportunities).find((o) => o.contactId === body.contactId && o.pipelineId === body.pipelineId); if (dup) return send(res, 400, { statusCode: 400, message: 'Can not create duplicate opportunity for the contact.', code: 'OPPORTUNITY_NO_DUPLICATE', meta: { existingId: dup.id } }); }
  if (req.method === 'POST' && url.pathname === '/opportunities/') { const o = { id: `o${++seq}`, ...body }; S.opportunities[o.id] = o; return send(res, 201, { opportunity: { id: o.id } }); }
  if (req.method === 'PUT' && (m = url.pathname.match(/^\/opportunities\/([^/]+)$/))) { const o = S.opportunities[m[1]]; if (!o) return send(res, 404, { message: 'Opportunity not found' }); Object.assign(o, body); return send(res, 200, { opportunity: { id: o.id } }); }
  send(res, 404, { message: `No route ${req.method} ${url.pathname}` });
}).listen(port, '127.0.0.1', () => console.log(`mock GHL on ${port}`));
