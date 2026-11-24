// District 24.11.2026: tagovi leada, filter po budžetu i tagu, Stats, Notifications i automatska Fits the budget poruka.
//   BASE=http://127.0.0.1:8811 node scripts/stats-tags-check.mjs   (server sa lažnim OpenAI-jem; token iz .dev.vars)
import { readFileSync } from 'node:fs';
import { SUGGESTED_PRICING } from '../public/pricing.js';
import { areaOf } from '../public/area-codes.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

ok(areaOf('+1 (480) 465-7783')?.label === 'Phoenix East Valley, AZ', 'pozivni 480 = Phoenix East Valley, AZ');
ok(areaOf('+1 (666) 666-6666') === null && areaOf('+387 65 123 456') === null, 'nepostojeći i strani broj bez grada');
ok(areaOf('(785) 555-0101')?.state === 'KS', '785 = Kansas (opis pominje Manhattan, KS)');

const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Stats Check Jewelers' }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const viewAs = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const V = { 'x-portal-token': viewAs, 'content-type': 'application/json' };
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: V, body: JSON.stringify({ pricing: SUGGESTED_PRICING }) });
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
const spec = (await fetch(`${BASE}/api/forms/${form.id}`).then(j)).body;
const budgets = (spec.form || spec).steps.flatMap((s) => s.fields).find((f) => f.id === 'budget').options.map((o) => o.value);

const lead = async (name, phone, budget, extra = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form.id, name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone, consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'lab', coverage: 'full', budget, ...extra }));
  return (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
};
const a = await lead('Ava Tags', '+1 (480) 465-7783', budgets[1]);
const b = await lead('Ben Budget', '+1 (303) 555-0101', budgets[budgets.length - 1]);
const c = await lead('Cal Cheap', '+1 (212) 555-0101', budgets[0]);
// Poruke piše Workers AI u pozadini (lokalno preko mreže, ~10 s): čeka se dok Ava i Cal nemaju obje.
let list;
for (let i = 0; i < 40; i++) {
  await sleep(1500);
  list = (await fetch(`${BASE}/api/portal/leads`, { headers: C }).then(j)).body;
  if (list.leads.filter((l) => l.quotes?.picked?.msg).length === 3 && list.leads.filter((l) => l.quotes?.fit?.msg).length === 2) break;
}
ok(list.leads.length === 3 && list.leads.every((l) => Array.isArray(l.tags) && !l.tags.length), 'leadovi imaju prazne tagove');
ok(Object.keys(list.budgets || {}).length === 3, `brojevi po budžetu (${JSON.stringify(list.budgets)})`);
const ava = list.leads.find((l) => l.id === a.leadId);
ok(!!ava.quotes?.picked?.msg, 'Estimated price poruka napisana sama');
ok(!!ava.quotes?.fit?.msg && ava.quotes.fit.price > 0, `Fits the budget poruka napisana sama ($${ava.quotes?.fit?.price})`);
ok(!list.leads.find((l) => l.id === b.leadId).quotes?.fit, 'budžet "$20,000+" (bez gornje granice) nema Fits the budget poruku');
console.log('     fit poruka:', JSON.stringify((ava.quotes?.fit?.msg || '').slice(0, 220)));

// Tagovi: admin pregled samo čita, zlatar mijenja.
ok((await fetch(`${BASE}/api/portal/leads/${a.leadId}`, { method: 'PATCH', headers: V, body: JSON.stringify({ tags: ['Friend'] }) })).status === 403, 'admin pregled ne mijenja tagove');
const r = (await fetch(`${BASE}/api/portal/leads/${a.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ tags: ['Friend', 'Returning customer', 'Friend', '  VIP  ', 'a<x>'] }) }).then(j)).body;
ok(JSON.stringify(r.tags) === JSON.stringify(['Friend', 'Returning customer', 'VIP', 'ax']), `tagovi očišćeni i bez duplikata (${JSON.stringify(r.tags)})`);
await fetch(`${BASE}/api/portal/leads/${a.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ tags: ['Friend', 'VIP'] }) });
await fetch(`${BASE}/api/portal/leads/${b.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ tags: ['Family'], status: 'won' }) });
await fetch(`${BASE}/api/portal/leads/${c.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ note: 'call back' }) });
list = (await fetch(`${BASE}/api/portal/leads`, { headers: C }).then(j)).body;
ok(list.tags.Friend === 1 && list.tags.VIP === 1 && list.tags.Family === 1, `brojevi po tagu (${JSON.stringify(list.tags)})`);
ok(JSON.stringify(list.leads.find((l) => l.id === c.leadId).tags) === '[]', 'bilješka ne dira tagove');
const byTag = (await fetch(`${BASE}/api/portal/leads?tag=Family`, { headers: C }).then(j)).body.leads;
ok(byTag.length === 1 && byTag[0].id === b.leadId, 'filter po tagu');
const byBudget = (await fetch(`${BASE}/api/portal/leads?budget=${encodeURIComponent(budgets[0])}`, { headers: C }).then(j)).body.leads;
ok(byBudget.length === 1 && byBudget[0].id === c.leadId, 'filter po budžetu');

// Stats
const st = (await fetch(`${BASE}/api/portal/stats`, { headers: C }).then(j)).body;
ok(st.leads.length === 3, 'stats: svi upiti');
const sb = st.leads.find((l) => l.id === b.leadId);
ok(sb.status === 'won' && sb.value > 0 && sb.tags[0] === 'Family' && sb.budget === budgets[budgets.length - 1], `stats red: status, vrijednost $${sb.value}, tag, budžet`);

// Notifications
let nt = (await fetch(`${BASE}/api/portal/notifications`, { headers: C }).then(j)).body;
ok(nt.items.filter((x) => x.type === 'created').length === 3, 'obavještenje za svaki novi upit');
ok(!nt.items.some((x) => x.type === 'quote_generated'), 'automatske poruke ne zatrpavaju obavještenja');
ok(nt.unseen === nt.items.length && nt.unseen > 0, `sve novo dok se tab ne otvori (${nt.unseen})`);
ok((await fetch(`${BASE}/api/portal/notifications/seen`, { method: 'POST', headers: V }).then(j)).body.readOnly === true, 'admin pregled ne označava viđeno');
await fetch(`${BASE}/api/portal/notifications/seen`, { method: 'POST', headers: C });
nt = (await fetch(`${BASE}/api/portal/notifications`, { headers: C }).then(j)).body;
ok(nt.unseen === 0 && nt.items.length > 0, 'poslije otvaranja 0 novih');
await sleep(20);
const key = list.leads.find((l) => l.id === c.leadId).page.url.slice(3);
await fetch(`${BASE}/api/page/${key}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'deposit', option: 'picked' }) });
nt = (await fetch(`${BASE}/api/portal/notifications`, { headers: C }).then(j)).body;
ok(nt.unseen === 1 && nt.items[0].type === 'page_action' && nt.items[0].meta.action === 'deposit', 'klik Deposit = novo obavještenje');

console.log(fails ? `${fails} FAILED` : 'Stats, tags and notifications checks passed.');
console.log(`PORTAL=${link}`);
process.exit(fails ? 1 : 0);
