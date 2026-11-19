// Tab Bookings u portalu (19.11.2026): klikovi kupca na Reserve / Book appointment, obavještenje dok se tab ne otvori.
//   BASE=http://127.0.0.1:8796 node scripts/bookings-check.mjs   (server sa lažnim OpenAI-jem; token iz .dev.vars)
import { readFileSync } from 'node:fs';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Bookings Check Jewelers' }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const viewAs = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const V = { 'x-portal-token': viewAs, 'content-type': 'application/json' };
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: V, body: JSON.stringify({ pricing: SUGGESTED_PRICING }) });
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };

const lead = async (name) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form.id, name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone: '555 010 0011', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }));
  return (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
};
const a = await lead('Ava Deposit');
const b = await lead('Ben Appointment');
await lead('Cal Nothing');
await fetch(`${BASE}/api/leads/${a.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: a.token }) });
await sleep(2500);
const list = (await fetch(`${BASE}/api/portal/leads`, { headers: V }).then(j)).body.leads;
const key = (id) => list.find((l) => l.id === id).page.url.slice(3);
const act = (id, action, option) => fetch(`${BASE}/api/page/${key(id)}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, option }) }).then(j);

let bk = (await fetch(`${BASE}/api/portal/bookings`, { headers: C }).then(j)).body;
ok(bk.items?.length === 0 && bk.unseen === 0, 'bez klikova Bookings je prazan');
await act(a.leadId, 'deposit', 'picked');
await sleep(20);
await act(b.leadId, 'appointment', '');
bk = (await fetch(`${BASE}/api/portal/bookings`, { headers: C }).then(j)).body;
ok(bk.items.length === 2 && bk.unseen === 2, `dva kupca kliknula, oba nova (${bk.items.length}, novih ${bk.unseen})`);
ok(bk.items[0].name === 'Ben Appointment' && bk.items[0].actions[0].action === 'appointment', 'najnoviji klik prvi');
const ava = bk.items.find((x) => x.name === 'Ava Deposit');
ok(ava.actions[0].action === 'deposit' && ava.actions[0].option === 'picked' && ava.actions[0].total === 7900, `Ava: deposit, Option 1, $7,900 iz sačuvane poruke (${ava.actions[0].total})`);
ok(ava.page.startsWith('/p/') && ava.email === 'ava@example.com' && ava.img, 'red ima stranicu, kontakt i sliku');
ok(!bk.items.some((x) => x.name === 'Cal Nothing'), 'lead bez klika nije u Bookings');

// Admin pregled ne označava viđeno; zlatar (njegov link) da.
ok((await fetch(`${BASE}/api/portal/bookings/seen`, { method: 'POST', headers: V }).then(j)).body.readOnly === true, 'admin pregled: viđeno se ne upisuje');
ok((await fetch(`${BASE}/api/portal/bookings`, { headers: C }).then(j)).body.unseen === 2, 'i dalje 2 nova poslije admin pregleda');
ok((await fetch(`${BASE}/api/portal/bookings/seen`, { method: 'POST', headers: C }).then(j)).body.seenAt > 0, 'zlatar otvorio tab');
bk = (await fetch(`${BASE}/api/portal/bookings`, { headers: C }).then(j)).body;
ok(bk.unseen === 0 && bk.items.length === 2, 'poslije otvaranja: 0 novih, oba ostaju na listi');
await sleep(20);
await act(a.leadId, 'appointment', 'picked');
bk = (await fetch(`${BASE}/api/portal/bookings`, { headers: C }).then(j)).body;
ok(bk.unseen === 1 && bk.items[0].name === 'Ava Deposit' && bk.items[0].actions.length === 2, 'novi klik: 1 novo obavještenje, Ava opet na vrhu sa oba klika');

// Drugi zlatar ne vidi tuđe zahtjeve; bez prijave nema ništa.
const other = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Bookings Other' }) }).then(j)).body.client;
const otherTok = (await fetch(`${BASE}/api/admin/clients/${other.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
ok((await fetch(`${BASE}/api/portal/bookings`, { headers: { 'x-portal-token': otherTok } }).then(j)).body.items.length === 0, 'drugi zlatar ne vidi tuđe zahtjeve');
ok((await fetch(`${BASE}/api/portal/bookings`)).status === 401, 'bez prijave = 401');
if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Bookings checks passed.');
if (process.env.SHOW) console.log(`Portal (admin view): ${BASE}/portal#v=${viewAs}`);
