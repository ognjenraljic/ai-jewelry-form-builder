// Prvi render ide na GPT Image 2.6 Flare; ako OpenAI odbije model, isti render prođe na 2.5 Flare.
// Lažni OpenAI (ništa ne košta), drugi prolaz sa MOCK_REJECT_MODEL=gpt-image-2.6-flare:
//   node scripts/mock-openai.mjs 8898 log.json
//   npx wrangler dev --port 8818 --var OPENAI_API_KEY:mock --var OPENAI_BASE:http://127.0.0.1:8898
//   BASE=http://127.0.0.1:8818 LOG=log.json EXPECT=ok|fallback node scripts/model-fallback-check.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://127.0.0.1:8818';
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw new Error('Run this check only against a local server.');
const EXPECT = process.env.EXPECT || 'ok';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b) => fetch(`${BASE}${p}`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(j);
const models = () => JSON.parse(readFileSync(process.env.LOG || 'log.json', 'utf8')).filter((e) => e.path?.startsWith('/v1/images')).map((e) => e.model || 'generations');

const client = (await post('/api/admin/clients', { name: `Model QA ${Date.now().toString(36)}` })).body.client;
const form = (await post('/api/admin/forms', { clientId: client.id, template: 'ring' })).body.form;
const fd = new FormData();
for (const [k, v] of Object.entries({ formId: form.id, name: 'Model Test', email: 'model@example.com', phone: '555 010 0005', consent: 'yes' })) fd.set(k, v);
fd.set('answers', JSON.stringify({ style: 'solitaire', center_shape: 'oval', metal: 'yellow-gold', karat: '14K', stones: 'lab', budget: '$2,500 - $5,000' }));
const lead = (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
assert.ok(lead.leadId, `lead created (${JSON.stringify(lead).slice(0, 200)})`);
let before = 0;
try { before = models().length; } catch {}
const r = await fetch(`${BASE}/api/leads/${lead.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: lead.token }) }).then(j);
const calls = models().slice(before);
console.log('render', r.status, r.body.dev?.model, '| OpenAI pozivi:', calls.join(' -> '));
assert.equal(r.status, 200, `render ok (${JSON.stringify(r.body).slice(0, 300)})`);
assert.ok(r.body.url, 'render has an image');
if (EXPECT === 'ok') {
  assert.deepEqual(calls, ['gpt-image-2.6-flare'], 'first render uses 2.6 Flare only');
  assert.equal(r.body.dev?.model, 'GPT Image 2.6 Flare');
} else {
  assert.deepEqual(calls, ['gpt-image-2.6-flare', 'gpt-image-2.5-flare'], 'rejected 2.6 falls back to 2.5 Flare');
  assert.equal(r.body.dev?.model, 'GPT Image 2.6 Flare -> gpt-image-2.5-flare');
}
console.log('OK', EXPECT);
