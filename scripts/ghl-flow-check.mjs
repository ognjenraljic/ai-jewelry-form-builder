// GoHighLevel cijeli tok na lokalnom serveru sa lažnim GHL-om (24.11.2026):
//   node scripts/mock-ghl.mjs 8897
//   npx wrangler dev --port 8811 --test-scheduled --var GHL_BASE:http://127.0.0.1:8897 (+ lažni OpenAI kao ostale provjere)
//   BASE=http://127.0.0.1:8811 GHL=http://127.0.0.1:8897 node scripts/ghl-flow-check.mjs
import { readFileSync } from 'node:fs';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const GHL = process.env.GHL || 'http://127.0.0.1:8897';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ghl = async () => (await fetch(`${GHL}/_state`)).json();
const cron = () => fetch(`${BASE}/__scheduled?cron=${encodeURIComponent('*/5 * * * *')}`);

const tag = Math.random().toString(36).slice(2, 7);
const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: `GHL Flow ${tag}` }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const viewAs = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const V = { 'x-portal-token': viewAs, 'content-type': 'application/json' };
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: V, body: JSON.stringify({ pricing: SUGGESTED_PRICING }) });
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
const lead = async (name) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form.id, name, email: `${name.split(' ')[0].toLowerCase()}-${tag}@example.com`, phone: '+1 (480) 465-7783', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }));
  return (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
};
const put = (body, h = C) => fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: h, body: JSON.stringify(body) }).then(j);
const mine = (st) => Object.values(st.contacts).filter((c) => String(c.email).includes(`-${tag}@`));

// Dva leada PRIJE povezivanja (postojeći), jedan od njih Quoted, jedan arhiviran.
const old1 = await lead('Olda One');
const old2 = await lead('Oldb Two');
const old3 = await lead('Oldc Archived');
await fetch(`${BASE}/api/portal/leads/${old2.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ status: 'quoted' }) });
await fetch(`${BASE}/api/portal/leads/${old3.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ archived: true }) });
await sleep(1500);

// Povezivanje: pogrešan token, pa pravi; pipeline-i sa pogođenim fazama.
ok((await fetch(`${BASE}/api/portal/ghl/pipelines`, { method: 'POST', headers: C, body: JSON.stringify({ token: 'wrong-token-that-is-long-enough-to-pass-format', locationId: 'LOC1234567890ab' }) }).then(j)).status === 400, 'pogrešan token: jasna greška');
const pl = (await fetch(`${BASE}/api/portal/ghl/pipelines`, { method: 'POST', headers: C, body: JSON.stringify({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab' }) }).then(j)).body;
ok(pl.pipelines?.[0]?.guess?.new === 'st-new' && pl.pipelines[0].guess.quoted === 'st-quo' && pl.pipelines[0].guess.won === 'st-won', 'pipeline učitan, faze pogođene po imenu');
let g = (await put({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab', pipelineId: 'pipe1', stages: pl.pipelines[0].guess, tags: ['jewelrylead'], enabled: true })).body;
ok(g.connected && g.enabled && !('token' in g) && g.tokenHint === '…7890' && g.counts.waiting === 2, `povezano i uključeno, token se ne vraća, 2 leada čekaju (${JSON.stringify(g.counts)})`);

// Novi lead poslije uključenja ide sam.
const fresh = await lead('Newa Fresh');
let st;
for (let i = 0; i < 40; i++) { await sleep(1500); st = await ghl(); if (mine(st).some((c) => c.name === 'Newa Fresh' && c.notes.length)) break; }
const nf = mine(st).find((c) => c.name === 'Newa Fresh');
ok(nf && nf.firstName === 'Newa' && nf.lastName === 'Fresh' && nf.tags.includes('jewelrylead') && nf.tags.includes('jewelrylead grillz'), 'novi lead: kontakt sa tagovima');
ok(nf?.notes?.[0]?.includes('Phoenix East Valley, AZ') && /\/p\/[a-z0-9]+\?preview=1/.test(nf.notes[0]) && /Metal: Yellow Gold/.test(nf.notes[0]), 'novi lead: bilješka sa izborima, gradom i stranicom kupca');
const no = Object.values(st.opportunities).find((o) => o.contactId === nf?.id);
ok(no && no.pipelineStageId === 'st-new' && no.status === 'open' && no.monetaryValue > 0, `novi lead: opportunity u New sa vrijednošću ($${no?.monetaryValue})`);
ok(mine(st).length === 1, 'postojeći leadovi se ne šalju dok se ne uključi slanje unazad');

// Status i tag u portalu prate u GHL-u.
await fetch(`${BASE}/api/portal/leads/${fresh.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ status: 'won' }) });
await fetch(`${BASE}/api/portal/leads/${fresh.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ tags: ['VIP'] }) });
await sleep(2500);
st = await ghl();
const no2 = Object.values(st.opportunities).find((o) => o.contactId === nf.id);
ok(no2.status === 'won' && no2.pipelineStageId === 'st-won', 'Won u portalu zatvara opportunity kao won');
ok(mine(st).find((c) => c.id === nf.id).tags.includes('vip'), 'tag iz portala ide na kontakt');

// Slanje unazad: postojeći leadovi kroz cron, arhivirani nikad, Quoted u svoju fazu.
g = (await put({ backfill: true })).body;
ok(g.backfill === true, 'slanje postojećih leadova uključeno');
// Cron šalje leadove starije od 2 minute (da se ne sudari sa obradom tek pristiglog leada), pa se čeka.
for (let i = 0; i < 20; i++) { await cron(); await sleep(10_000); st = await ghl(); if (mine(st).length >= 3) break; }
ok(mine(st).length === 3 && !mine(st).some((c) => c.name === 'Oldc Archived'), `postojeći leadovi poslati (${mine(st).length} kontakta), arhivirani nije`);
const q = Object.values(st.opportunities).find((o) => o.contactId === mine(st).find((c) => c.name === 'Oldb Two')?.id);
ok(q?.pipelineStageId === 'st-quo' && q.status === 'open', 'postojeći Quoted lead u fazi Quote Sent');
await cron(); await sleep(3000);
st = await ghl();
ok(mine(st).length === 3 && Object.values(st.opportunities).filter((o) => mine(st).some((c) => c.id === o.contactId)).length === 3, 'drugi krug crona ne pravi duplikate');
g = (await fetch(`${BASE}/api/portal/ghl`, { headers: C }).then(j)).body;
ok(g.counts.sent === 3 && g.counts.waiting === 0 && g.counts.failed === 0, `brojevi na kartici: 3 poslata, 0 čeka (${JSON.stringify(g.counts)})`);
ok(st.calls.every((c) => c.version === '2021-07-28'), 'svaki poziv nosi Version zaglavlje');
ok((await put({ disconnect: true })).body.connected === false, 'Disconnect briše token i gasi slanje');

console.log(fails ? `${fails} FAILED` : 'GoHighLevel flow checks passed.');
process.exit(fails ? 1 : 0);
