// Praćenje narudžbe (23.11.2026): Won lead dobija broj, zlatar pomjera faze, kupac prati sa brojem + mejlom.
//   BASE=http://127.0.0.1:8797 node scripts/order-tracking-check.mjs   (lokalni server; token iz .dev.vars)
//   Ponovno pokretanje tek poslije sat vremena (zadnja provjera potroši limit pogrešnih pokušaja za 127.0.0.1).
import { readFileSync } from 'node:fs';
import { normalizeOrderNo, nextOrder, orderPrefix } from '../src/orders.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) });

// Čiste funkcije
ok(normalizeOrderNo('dj 7k4q9') === 'DJ-7K4Q9' && normalizeOrderNo('#DJ-7K4Q9') === 'DJ-7K4Q9' && normalizeOrderNo('DJD7K4Q9') === 'DJD-7K4Q9', 'broj se normalizuje (mala slova, razmak, #)');
ok(normalizeOrderNo('') === null && normalizeOrderNo('x') === null, 'prazan ili prekratak broj = null');
ok(orderPrefix('District Jewelers Denver') === 'DJ' && orderPrefix('Acme', { orderPrefix: 'acm!' }) === 'ACM', 'prefiks iz imena radnje ili podešen');
const n3 = nextOrder(null, { stage: 3 }, 1000);
ok(n3.stage === 3 && n3.at.placed === 1000 && n3.at.setting === 1000 && !n3.at.polish, 'skok na fazu 3 popuni ranije faze');
const n1 = nextOrder(JSON.stringify(n3), { stage: 1 }, 2000);
ok(n1.stage === 1 && n1.at.cad === 1000 && !n1.at.cast && !n1.at.setting, 'vraćanje na raniju fazu briše kasnija vremena');
ok(nextOrder(null, { stage: 9 }) === null && nextOrder(null, { stage: -1 }) === null, 'nepostojeća faza odbijena');

// Server
const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Order Track Jewelers' }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const viewAs = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const V = { 'x-portal-token': viewAs, 'content-type': 'application/json' };
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
const lead = async (name) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form.id, name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone: '555 010 0011', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }));
  return (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
};
const a = await lead('Ava Order');
const b = await lead('Ben Quoted');
const patch = (id, body, h = C) => fetch(`${BASE}/api/portal/leads/${id}`, { method: 'PATCH', headers: h, body: JSON.stringify(body) }).then(j);
const order = (id, body, h = C) => fetch(`${BASE}/api/portal/leads/${id}/order`, { method: 'PATCH', headers: h, body: JSON.stringify(body) }).then(j);
const track = (o, email, origin = 'https://district-jewelers.vercel.app') => fetch(`${BASE}/api/orders/track`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ order: o, email }) }).then(j);

ok((await order(a.leadId, { stage: 1 })).status === 409, 'faza prije Won = 409');
const won = await patch(a.leadId, { status: 'won' });
const no = won.body.order?.no;
ok(/^OT-[2-9A-HJKMNP-Z]{5}$/.test(no || '') && won.body.order.stage === 0, `Won dodijeli broj narudžbe (${no}), faza Order placed`);
await patch(b.leadId, { status: 'quoted' });
let list = (await fetch(`${BASE}/api/portal/leads`, { headers: C }).then(j)).body.leads;
ok(list.find((l) => l.id === a.leadId).order?.no === no && !list.find((l) => l.id === b.leadId).order, 'lista: Won ima narudžbu, Quoted nema');
ok((await patch(a.leadId, { status: 'won' })).body.order.no === no, 'ponovni Won ne mijenja broj');

ok((await order(a.leadId, { stage: 2 }, V)).status === 403, 'admin pregled ne mijenja fazu');
const st = await order(a.leadId, { stage: 3, note: 'Stones arrived, setting starts Monday' });
ok(st.body.order.stage === 3 && st.body.order.stages[3].at && !st.body.order.stages[4].at, 'zlatar pomjerio na Stone setting');

let t = await track(no.toLowerCase().replace('-', ' '), ' AVA@example.com ');
ok(t.status === 200 && t.body.order === no && t.body.stage === 3 && t.body.name === 'Ava' && t.body.note.startsWith('Stones'), `kupac vidi fazu 3 i poruku (${t.status})`);
ok(t.headers.get('access-control-allow-origin') === '*', 'CORS otvoren za sajt radnje');
ok(!('email' in t.body) && !('phone' in t.body) && t.body.stages.length === 6 && t.body.stages[0].text, 'odgovor bez mejla/telefona, 6 faza sa opisom');
ok((await fetch(`${BASE}/api/orders/track`, { method: 'OPTIONS', headers: { origin: 'https://x.com', 'access-control-request-method': 'POST' } })).status === 204, 'preflight 204');
ok((await track(no, 'ben@example.com')).status === 404, 'tuđi mejl = 404');
ok((await track('OT-22222', 'ava@example.com')).status === 404, 'pogrešan broj = 404');

await patch(a.leadId, { status: 'lost' });
ok((await track(no, 'ava@example.com')).status === 200, 'broj ostaje i ako se status kasnije promijeni');
ok((await order(a.leadId, { stage: 5 })).body.order.stage === 5, 'Ready for pick up');

// Limit pogađanja: 20 pogrešnih po satu sa iste mreže
let last;
for (let i = 0; i < 20; i++) last = await track(`OT-${String(30000 + i).replace(/[01]/g, '9')}`, 'x@example.com');
ok(last.status === 429 || (await track('OT-99999', 'x@example.com')).status === 429, 'poslije 20 pogrešnih pokušaja = 429');

if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Order tracking checks passed.');
