// ID leada + GoHighLevel proizvodna tabla za radnike + težine lanaca (25.11.2026), lokalno sa lažnim GHL-om:
//   node scripts/mock-ghl.mjs 8897
//   npx wrangler dev --port 8811 --test-scheduled --var GHL_BASE:http://127.0.0.1:8897
//   BASE=http://127.0.0.1:8811 GHL=http://127.0.0.1:8897 node scripts/ghl-orders-check.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8811';
const GHL = process.env.GHL || 'http://127.0.0.1:8897';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ghl = async () => (await fetch(`${GHL}/_state`)).json();
const cron = () => fetch(`${BASE}/__scheduled?cron=${encodeURIComponent('*/5 * * * *')}`);
const sql = (q) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'konfigurator', '--local', '--command', q], { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });

const tag = Math.random().toString(36).slice(2, 7);
const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: `Diamond Joe ${tag}` }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: C, body: JSON.stringify({ pricing: SUGGESTED_PRICING }) });
const lead = async (name, answers) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form.id, name, email: `${name.split(' ')[0].toLowerCase()}-${tag}@example.com`, phone: '+1 (480) 465-7783', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify(answers || { type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500', vision: 'Call me at 480 465 7783, for my girl Maria' }));
  return (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
};
const leads = async (q = '') => (await fetch(`${BASE}/api/portal/leads?q=${encodeURIComponent(q)}`, { headers: C }).then(j)).body.leads || [];
// Samo podaci ovog prolaza (lažni GHL pamti i ranije prolaze).
const myOpps = (st) => Object.values(st.opportunities).filter((o) => String(st.contacts[o.contactId]?.email || '').includes(`-${tag}@`) || String(st.contacts[o.contactId]?.source || '') === 'JewelryLead order' && myOrders.has(st.contacts[o.contactId]?.lastName));
const myOrders = new Set();
const put = (body) => fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: C, body: JSON.stringify(body) }).then(j);

// 1) ID leada: redni broj po radnji, pretraga po ID-ju.
const a = await lead('Anna First');
const b = await lead('Bruno Second');
let list = await leads();
const la = list.find((l) => l.id === a.leadId); const lb = list.find((l) => l.id === b.leadId);
ok(la?.ref === 'L-0001' && lb?.ref === 'L-0002', `ID leada po redu za novu radnju (${la?.ref}, ${lb?.ref})`);
ok((await leads('L-0002')).map((l) => l.id).join() === b.leadId, 'pretraga "L-0002" nađe tačno taj lead');
ok((await leads('#2')).some((l) => l.id === b.leadId), 'pretraga "#2" nađe lead');

// 2) GHL: prodajni pipeline + ID u imenu opportunity-ja i u bilješci.
const pl = (await fetch(`${BASE}/api/portal/ghl/pipelines`, { method: 'POST', headers: C, body: JSON.stringify({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab' }) }).then(j)).body;
const sales = pl.pipelines.find((p) => p.id === 'pipe1'); const prod = pl.pipelines.find((p) => p.id === 'prod1');
ok(prod?.guessOrder?.placed === 'pr-placed' && prod.guessOrder.cad === 'pr-cad' && prod.guessOrder.cast === 'pr-cast' && prod.guessOrder.setting === 'pr-set' && prod.guessOrder.polish === 'pr-pol' && prod.guessOrder.ready === 'pr-ready', 'faze proizvodne table pogođene po imenu');
let g = (await put({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab', pipelineId: 'pipe1', stages: sales.guess, enabled: true, backfill: true })).body;
ok(g.enabled, 'GHL uključen sa slanjem postojećih');
const c = await lead('Cara Third');
let st;
for (let i = 0; i < 30; i++) { await sleep(1500); st = await ghl(); if (Object.values(st.opportunities).some((o) => /Cara Third/.test(o.name))) break; }
const oc = Object.values(st.opportunities).find((o) => /Cara Third/.test(o.name));
ok(oc?.name.startsWith('L-0003 · Cara Third'), `opportunity počinje ID-jem (${oc?.name})`);
const cc = Object.values(st.contacts).find((x) => x.name === 'Cara Third');
ok(/JewelryLead L-0003:/.test(cc?.notes?.[0] || ''), 'bilješka počinje ID-jem');

// 3) Već poslat lead bez ID-ja u imenu (kao 228 poslatih 24.11.) se preimenuje u cronu.
for (let i = 0; i < 12; i++) { await cron(); await sleep(8000); st = await ghl(); if (myOpps(st).filter((o) => /Anna First|Bruno Second/.test(o.name)).length >= 2) break; }
const oa = myOpps(st).find((o) => /Anna First/.test(o.name));
ok(!!oa, 'postojeći lead poslat unazad');
sql(`UPDATE leads SET ghl = json_remove(ghl, '$.ref') WHERE id = '${a.leadId}'`);
st.opportunities[oa.id].name = 'Anna First · custom grillz';
await fetch(`${GHL}/opportunities/${oa.id}`, { method: 'PUT', headers: { authorization: 'Bearer pit-x', version: '2021-07-28', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Anna First · custom grillz' }) });
await cron(); await sleep(4000);
st = await ghl();
ok(st.opportunities[oa.id].name === 'L-0001 · Anna First · custom grillz', `stari opportunity preimenovan (${st.opportunities[oa.id].name})`);

// 4) Proizvodna tabla: isti pipeline kao prodaja odbijen, pa poseban.
ok((await put({ prod: { enabled: true, pipelineId: 'pipe1', stages: prod.guessOrder } })).status === 400, 'proizvodnja u prodajnom pipeline-u odbijena');
const users = (await fetch(`${BASE}/api/portal/ghl/users`, { method: 'POST', headers: C, body: '{}' }).then(j)).body.users || [];
ok(users.some((u) => u.id === 'userWorker01') && users.some((u) => u.name === 'Enrique G'), 'korisnici sub-accounta učitani');
ok((await put({ prod: { assignTo: 'bad id!' } })).status === 400, 'pogrešan User ID odbijen');
g = (await put({ prod: { enabled: true, pipelineId: 'prod1', stages: prod.guessOrder, assignTo: 'userWorker01', assignName: 'Moissanite Worker' } })).body;
ok(g.prod?.enabled && g.prod.assignTo === 'userWorker01', 'proizvodna tabla uključena, radnik izabran');

// Won -> narudžba na tabli: kontakt bez podataka kupca, bilješka samo sa specifikacijama.
const won = await fetch(`${BASE}/api/portal/leads/${c.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ status: 'won' }) }).then(j);
const orderNo = won.body.order?.no;
ok(/^DJ-[2-9A-Z]{5}$/.test(orderNo || ''), `Won dobija broj narudžbe (${orderNo})`);
myOrders.add(orderNo);
let ocard;
for (let i = 0; i < 20; i++) { await sleep(1500); st = await ghl(); ocard = Object.values(st.contacts).find((x) => x.lastName === orderNo); if (ocard?.notes?.length) break; }
ok(ocard && ocard.name === `Order ${orderNo}` && !ocard.email && !ocard.phone && ocard.assignedTo === 'userWorker01', 'kontakt narudžbe: samo broj, bez mejla i telefona, dodijeljen radniku');
const note = ocard?.notes?.[0] || '';
ok(/Metal: Yellow Gold/i.test(note) && note.includes(orderNo), 'bilješka narudžbe ima specifikacije');
ok(!/Cara|Third|example\.com|480|465|\$|\/p\/|preview|Maria/i.test(note), `bilješka narudžbe bez imena, mejla, telefona, cijene, stranice kupca i opisa kupca`);
const po = Object.values(st.opportunities).find((o) => o.contactId === ocard?.id);
ok(po && po.pipelineId === 'prod1' && po.pipelineStageId === 'pr-placed' && po.assignedTo === 'userWorker01' && !('monetaryValue' in po) && po.name.startsWith(orderNo), 'kartica u Production / Order placed, bez vrijednosti, dodijeljena radniku');
ok(!myOpps(st).some((o) => o.pipelineId === 'prod1' && /Cara/.test(o.name)), 'prodajni kontakt nije na proizvodnoj tabli');

// Faza iz portala -> tabla.
await fetch(`${BASE}/api/portal/leads/${c.leadId}/order`, { method: 'PATCH', headers: C, body: JSON.stringify({ stage: 1 }) });
await sleep(2500);
st = await ghl();
ok(st.opportunities[po.id].pipelineStageId === 'pr-cad', 'CAD approved u portalu pomjera karticu');

// Radnik pomjeri karticu u GHL-u -> portal (i stranica praćenja kupca) za 5 min.
await fetch(`${GHL}/opportunities/${po.id}`, { method: 'PUT', headers: { authorization: 'Bearer pit-x', version: '2021-07-28', 'content-type': 'application/json' }, body: JSON.stringify({ pipelineStageId: 'pr-set' }) });
await cron(); await sleep(4000);
list = await leads();
ok(list.find((l) => l.id === c.leadId)?.order?.stage === 3, `Stone setting sa table stiže u portal (faza ${list.find((l) => l.id === c.leadId)?.order?.stage})`);
ok(list.find((l) => l.id === c.leadId)?.prodBoard?.on === true, 'portal zna da je narudžba na tabli');
ok((await leads(orderNo)).some((l) => l.id === c.leadId), 'pretraga po broju narudžbe');
await cron(); await sleep(3000);
st = await ghl();
ok(myOpps(st).filter((o) => o.pipelineId === 'prod1').length === 1, 'cron ne pravi duplu karticu');
g = (await fetch(`${BASE}/api/portal/ghl`, { headers: C }).then(j)).body;
ok(g.counts.orders === 1 && g.counts.onBoard === 1, `brojevi: ${JSON.stringify(g.counts)}`);

// 5) Težine lanaca: podešavanje se čuva, nepoznat red kataloga se odbacuje.
const pr = { ...SUGGESTED_PRICING, chainWeights: { on: true, map: { 'miami-cuban': 'cuban-hollow', rope: '', bogus: 'not-a-line' } } };
const saved = (await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: C, body: JSON.stringify({ pricing: pr }) }).then(j)).body.pricing;
ok(saved.chainWeights?.on === true && saved.chainWeights.map['miami-cuban'] === 'cuban-hollow' && saved.chainWeights.map.rope === '' && !('bogus' in saved.chainWeights.map), `težine lanaca sačuvane (${JSON.stringify(saved.chainWeights)})`);

console.log(fails ? `${fails} FAILED` : 'Lead ID, production board and chain weight checks passed.');
process.exit(fails ? 1 : 0);
