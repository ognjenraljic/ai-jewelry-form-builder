// Quote poruka iz portala (18.11.2026): samo leadovi tog zlatara, bez cijene nema poruke, poruka nosi tačnu cijenu.
//   node scripts/quote-check.mjs   (server mora raditi; token iz .dev.vars; jedan Workers AI poziv po poruci ako je AI vezan)
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Quote Check Jewelers' }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const fd = new FormData();
for (const [k, v] of Object.entries({ formId: form.id, name: 'Jordan Price', email: 'q@example.com', phone: '555 010 0011', consent: 'yes' })) fd.set(k, v);
fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '10K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'none', budget: '$1,500 - $2,500' }));
const lead = (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
const token = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const P = { 'x-portal-token': token, 'content-type': 'application/json' };
const leadId = (await fetch(`${BASE}/api/portal/leads`, { headers: P }).then(j)).body.leads?.[0]?.id || lead.id;

const body = { piece: 'grillz', metal: 'Yellow Gold', karat: '10K', teeth: { top: 6, bottom: 6 }, total: 1500, lines: [{ label: '10K set 6 x 6', amount: 1400 }, { label: 'Molding fee', amount: 100 }] };
const q = (id, b) => fetch(`${BASE}/api/portal/leads/${id}/quote`, { method: 'POST', headers: P, body: JSON.stringify(b) }).then(j);

ok((await fetch(`${BASE}/api/portal/leads/${leadId}/quote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).status === 401, 'bez portal sesije = 401');
ok((await q('nemaga', body)).status === 404, 'tuđi ili nepostojeći lead = 404');
ok((await q(leadId, { ...body, total: 0 })).status === 400, 'bez cijene nema poruke');
const r = await q(leadId, body);
ok(r.status === 200 && typeof r.body.message === 'string', `poruka napisana (${r.body.source})`);
ok(r.body.message?.includes('$1,500'), 'poruka nosi tačnu cijenu $1,500');
ok(!/\$(?!1,500)\d/.test(r.body.message || ''), 'nema drugih iznosa');
ok(/Jordan/.test(r.body.message || ''), 'poruka se obraća kupcu po imenu');
ok(!/—/.test(r.body.message || ''), 'bez em dash');
// Store info zlatara ide doslovno na kraj svake poruke (i AI i standardne), a poruka se onda ne potpisuje dvaput.
const INFO = '📍Quote Check Jewelers\n1 Main St\nMon-Sat 10am-6pm\n\nOut Of State Customers:\n$60 molding kit fee Plus Shipping Fees back';
const saved = await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: P, body: JSON.stringify({ pricing: { quoteInfo: `${INFO}\r\n\n\n` } }) }).then(j);
ok(saved.body.pricing?.quoteInfo === INFO, 'store info sačuvan (emoji i redovi ostaju, višak praznih redova skinut)');
const r2 = await q(leadId, body);
ok(r2.status === 200 && r2.body.message.endsWith(`\n\n${INFO}`), `store info na kraju poruke (${r2.body.source})`);
ok(r2.body.message.includes('$1,500') && r2.body.message.split('$60').length === 2, 'cijena tačna, $60 samo iz store infa');
const above = r2.body.message.slice(0, r2.body.message.length - INFO.length).trim();
ok(!/(Quote Check Jewelers|regards|sincerely)[\s.,!]*$/i.test(above), 'poruka iznad store infa nije potpisana');
console.log(`\n${r2.body.message}\n`);
if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Quote checks passed.');
