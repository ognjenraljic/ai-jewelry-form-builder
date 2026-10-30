// Mjesečni AI budžet po klijentu: zbir u /api/admin/overview, jedno obavještenje kad se pređe, potrošnja u portalu.
// Lažni OpenAI i mali budžet da par rendera pređe granicu (ništa ne košta):
//   node scripts/mock-openai.mjs 8898 log.json
//   npx wrangler dev --port 8818 --var OPENAI_API_KEY:mock --var OPENAI_BASE:http://127.0.0.1:8898 --var CLIENT_MONTHLY_BUDGET_USD:0.15
//   BASE=http://127.0.0.1:8818 node scripts/monthly-budget-check.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://127.0.0.1:8818';
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw new Error('Run this check only against a local server.');
const TOKEN = process.env.QA_ADMIN_TOKEN || readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN };
let count = 0;
const check = (ok, msg) => { assert.ok(ok, msg); console.log(`OK ${++count} ${msg}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b, h = H) => fetch(`${BASE}${p}`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(j);
const get = (p, h = H) => fetch(`${BASE}${p}`, { headers: h }).then(j);

const client = (await post('/api/admin/clients', { name: `Budget QA ${Date.now().toString(36)}` })).body.client;
const form = (await post('/api/admin/forms', { clientId: client.id, template: 'ring' })).body.form;
check(client?.id && form?.id, 'client and form created');
const limit = (await get('/api/admin/overview')).body.month.limit;
check(limit > 0, `monthly budget is ${limit}`);

const fd = new FormData();
for (const [k, v] of Object.entries({ formId: form.id, name: 'Budget Test', email: 'budget@example.com', phone: '555 010 0004', consent: 'yes' })) fd.set(k, v);
fd.set('answers', JSON.stringify({ style: 'solitaire', center_shape: 'oval', metal: 'yellow-gold', karat: '14K', stones: 'lab', budget: '$2,500 - $5,000' }));
const lead = (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
check(lead.leadId, 'lead created');
const notes = async () => (await get('/api/admin/notifications')).body.items.filter((n) => n.ref?.startsWith(`monthly:${client.id}:`));
let spent = 0;
for (let i = 0; i < 4 && spent < limit; i++) {
  const r = await fetch(`${BASE}/api/leads/${lead.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: lead.token, ...(i ? { tweak: 'make the band thinner' } : {}) }) }).then(j);
  check(r.status === 200, `render ${i + 1} ok`);
  spent = (await get('/api/admin/overview')).body.month.clients[client.id] || 0;
  if (spent < limit) check(!(await notes()).length, `no notification while under budget ($${spent.toFixed(3)})`);
}
check(spent >= limit, `client passed the budget ($${spent.toFixed(3)} of $${limit})`);
const n1 = await notes();
check(n1.length === 1 && n1[0].kind === 'budget' && n1[0].title.includes(client.name), `admin notified once: "${n1[0]?.title}"`);
const more = await fetch(`${BASE}/api/leads/${lead.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: lead.token, tweak: 'add a hidden halo' }) }).then(j);
check(more.status === 200, 'renders keep working over the budget');
check((await notes()).length === 1, 'still a single notification this month');

const link = (await post(`/api/admin/clients/${client.id}/portal-link`, {})).body;
const portal = new URL(link.url).hash.slice(3);
const me = (await get('/api/portal/me', { 'x-portal-token': portal })).body;
check(me.usage && me.usage.limit === limit && me.usage.spent >= limit * 0.99, `portal shows usage $${me.usage?.spent} of $${me.usage?.limit}`);
check(me.usage.resetsAt > Date.now() && new Date(me.usage.resetsAt).getUTCDate() === 1, 'usage resets on the 1st of next month');
console.log(`Passed ${count} monthly budget checks. No paid AI calls.`);
