// Local integration: capture the exact two model inputs, source design and restored association.
// Run with the mock API, FIRST_MODEL=gptsun and TWEAK_MODEL=gptflare. No paid AI calls.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildTryOnPrompt } from '../src/tryon.js';

let checks = 0;
const check = (value, text) => { assert.ok(value, text); console.log(`OK ${++checks} ${text}`); };
const top = buildTryOnPrompt({ teeth: 'T5,T6' });
check(top.includes('Top row: exactly 2 teeth') && top.includes('leave the entire lower row unchanged'), 'upper pair leaves lower row natural');
const bottom = buildTryOnPrompt({ teeth: 'B5' });
check(bottom.includes("lower central incisor (viewer's left)") && bottom.includes('leave the entire upper row unchanged'), 'single lower tooth has an exact location');
const mixed = buildTryOnPrompt({ teeth: 'T5,T6,B5,B6' });
check(mixed.includes('Top row: exactly 2 teeth') && mixed.includes('Bottom row: exactly 2 teeth'), 'two pairs stay separate instead of becoming full rows');
check(mixed.includes('A plain metal cap must remain plain metal') && mixed.includes('natural enamel'), 'mixed stone and plain caps preserve neighboring enamel');
check(mixed.includes('at most 2 upper and 2 lower teeth') && mixed.includes('overrides any extra jewelry visible'), 'selected pair prevents surplus reference side caps from reaching the smile');
check(mixed.includes('contact shadows') && mixed.includes('PHOTOGRAPHIC RELIGHTING') && mixed.includes('tiny identical gold squares'), 'portrait lighting, tooth shape and contact shadows are explicit');
check(buildTryOnPrompt({ style: 'set' }).includes('Determine the covered tooth positions only from IMAGE 2'), 'legacy answers without a tooth map do not invent a full set');

if (!process.env.BASE) { console.log(`Passed ${checks} prompt checks.`); process.exit(0); }
const base = process.env.BASE;
check(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'integration runs only on localhost');
const hash = b => createHash('sha256').update(b).digest('hex');
async function request(path, body, headers = {}) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(!multipart && body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${data.error || ''}`);
  return data;
}
const fd = new FormData();
for (const [key, value] of Object.entries({ formId: 'landing-demo', name: 'Try-on QA', email: 'tryon@example.com', phone: '555 010 0009', consent: 'yes', answers: JSON.stringify({ type: 'grillz', style: 'other', teeth: 'T5,T6,B5,B6', metal: 'white-gold', karat: '14K', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }) })) fd.set(key, value);
const lead = await request('/api/leads', fd);
const path = `/api/leads/${lead.leadId}`;
const renders = [];
for (let i = 0; i < 3; i++) renders.push(await request(path + '/renders', { token: lead.token, ...(i ? { tweak: `Design variant ${i}`, base: i } : {}) }));
check(renders.length === 3, 'three distinct product previews created by the mock');
const selfie = readFileSync(new URL('../public/site/gallery/chain-category-v2.webp', import.meta.url));
const photo = new FormData();
photo.set('token', lead.token); photo.set('consent', 'yes'); photo.set('base', '2'); photo.set('photo', new Blob([selfie], { type: 'image/webp' }), 'mock-selfie.webp');
const result = await request(path + '/tryon', photo);
check(result.base === 2 && result.remaining === 1, 'try-on records the chosen older design, not the latest one');
const restored = await request(path, null, { 'x-lead-token': lead.token });
check(restored.renders.length === 3 && restored.tryons[0].base === 2, 'refresh restores the exact source and keeps try-ons out of product renders');
const chosen = Buffer.from(await (await fetch(base + renders[1].url)).arrayBuffer());
const latest = Buffer.from(await (await fetch(base + renders[2].url)).arrayBuffer());
const entries = JSON.parse(readFileSync(process.env.MOCK_LOG || '/tmp/jewelrylead-tryon-api.json', 'utf8'));
const sent = entries.filter(e => e.path === '/v1/images/edits').at(-1);
check(sent.images === 2 && sent.imageHashes[0] === hash(selfie), 'first model image is exactly the submitted photograph');
check(sent.imageHashes[1] === hash(chosen) && hash(chosen) !== hash(latest), 'second model image is exactly the chosen design');
check(sent.prompt === mixed && sent.size === 'auto', 'placement instructions and original-aspect output reach the model');
check(sent.model === 'gpt-image-2.5-sunburst' && sent.quality === 'xhigh', 'try-on uses the precision model at extra-high quality');
photo.set('base', '3');
const second = await request(path + '/tryon', photo);
const both = await request(path, null, { 'x-lead-token': lead.token });
check(second.remaining === 0 && both.tryons.map(t => t.base).join() === '2,3', 'two saved try-ons retain independent source designs after refresh');
if (process.env.QA_STATE_FILE) writeFileSync(process.env.QA_STATE_FILE, JSON.stringify({ leadId: lead.leadId, token: lead.token }));
console.log(`Passed ${checks} checks. No paid AI calls.`);
console.log(`Local UI review: ${base}/f/landing-demo, lead ${lead.leadId}`);
