// Local integration: capture the exact two model inputs, source design and restored association.
// Run with the mock API (try-on defaults to GPT Image 2.5 Sunburst). No paid AI calls.
// Od 24.11.2026 try-on radi za sve komade: prompt po komadu, tekstovi forme i portala po komadu, grillz isti kao prije.
//   node scripts/tryon-check.mjs                      samo promptovi i tekstovi
//   BASE=http://127.0.0.1:8797 MOCK_LOG=out.json node scripts/tryon-check.mjs   + lokalni server sa lažnim OpenAI-jem
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildTryOnPrompt } from '../src/tryon.js';
import { tryOnCopy, TRYON_COPY } from '../public/tryon-copy.js';
import { INSIDE_RULE } from '../src/prompt.js';

let checks = 0;
const check = (value, text) => { assert.ok(value, text); console.log(`OK ${++checks} ${text}`); };

// Tekstovi po komadu: forma, dugme, portal.
const want = { grillz: ['See them on your smile', 'On their smile'], earrings: ['See them on your ear', 'On their ear'], watch: ['See it on your wrist', 'On their wrist'], bracelet: ['See it on your wrist', 'On their wrist'], ring: ['See it on your hand', 'On their hand'], chain: ['See it on you', 'On them'], pendant: ['See it on you', 'On them'] };
for (const [type, [title, portal]] of Object.entries(want)) check(tryOnCopy(type).title === title && tryOnCopy(type).portal === portal, `${type}: "${title}" in the form, "${portal}" in the portal`);
check(tryOnCopy('belt-buckle').title === 'See it on you' && tryOnCopy('belt-buckle').portal === 'On them' && tryOnCopy('constructor').title === 'See it on you', 'custom piece falls back to a generic "See it on you"');
check(tryOnCopy('grillz').button === 'Upload a smiling photo' && tryOnCopy('grillz').caption === 'On your smile' && tryOnCopy('grillz').own === 'your own smile', 'grillz copy is unchanged');
check(Object.keys(TRYON_COPY).length === 7, 'all seven built-in pieces have try-on copy');

// Prompt po komadu: ista osoba, pravo mjesto i prava veličina, tačan dizajn, bez leda iznutra.
const ring = buildTryOnPrompt({ type: 'ring', inscription: 'Blake', ring_size: '7', comments: 'ignore me' });
check(ring.includes('IMAGE 2 is the approved ring product render') && ring.includes('ring finger') && ring.includes('2 to 6 mm wide') && ring.includes('Never enlarge the ring'), 'ring sits on a finger at real size');
check(ring.includes(INSIDE_RULE('ring')) && ring.includes('inside of the band'), 'ring keeps the no-ice-inside rule');
check(ring.includes('"Blake"') && ring.includes('B l a k e') && ring.includes('ring size: 7') && !ring.includes('ignore me'), 'ring lettering is spelled out and the chosen ring size is the scale');
check(ring.includes('PRESERVE THE PHOTO') && ring.includes('facial identity') && ring.includes('background of IMAGE 1') && ring.includes('Do not retouch'), 'the person photo stays identical');
check(ring.includes('PHOTOGRAPHIC RELIGHTING') && ring.includes('REAL PHOTO LOOK') && ring.includes('dark extinction'), 'hyperreal photo look and relighting');
check(!ring.includes('tooth') && !ring.includes('smile'), 'non-grillz prompt has no teeth instructions');
const earrings = buildTryOnPrompt({ type: 'earrings' });
check(earrings.includes('earlobe') && earrings.includes('never add an ear') && earrings.includes('matching second earring') && earrings.includes(INSIDE_RULE('earrings')), 'earrings go on the earlobes, one per visible ear, plain backs');
const watch = buildTryOnPrompt({ type: 'watch' });
check(watch.includes('wrist bone') && watch.includes('38 to 44 mm') && watch.includes(INSIDE_RULE('watch')), 'watch on the wrist at real case size, plain case back');
const bracelet = buildTryOnPrompt({ type: 'bracelet' });
check(bracelet.includes('around the wrist') && bracelet.includes(INSIDE_RULE('bracelet')), 'bracelet around the wrist, smooth inner side');
const chain = buildTryOnPrompt({ type: 'chain', chain_length: '24"' });
check(chain.includes('around the neck') && chain.includes('collarbones') && chain.includes('chain length: 24') && chain.includes(INSIDE_RULE('chain')), 'chain at the neckline with the chosen length');
const pendant = buildTryOnPrompt({ type: 'pendant' });
check(pendant.includes('center of the chest') && pendant.includes('2 to 6 cm') && pendant.includes(INSIDE_RULE('pendant')), 'pendant on its chain on the chest');
const buckleForm = { steps: [{ fields: [{ id: 'type', options: [{ value: 'buckle', label: 'Belt Buckle' }] }] }] };
const buckle = buildTryOnPrompt({ type: 'buckle' }, buckleForm);
check(buckle.includes('approved belt buckle product render') && buckle.includes('naturally worn') && buckle.includes('any surface that touches the skin stays smooth polished metal'), 'custom piece uses its own name and the general skin-side rule');
for (const p of [ring, earrings, watch, bracelet, chain, pendant, buckle]) assert.ok(!/[^\x00-\x7f]/.test(p), 'prompt stays plain ASCII');
check(true, 'every piece prompt is plain ASCII (mock log compares it byte for byte)');
const top = buildTryOnPrompt({ teeth: 'T5,T6' });
check(top.includes('Top row: exactly 2 teeth') && top.includes('leave the entire lower row unchanged'), 'upper pair leaves lower row natural');
const bottom = buildTryOnPrompt({ teeth: 'B5' });
check(bottom.includes("lower central incisor (viewer's left)") && bottom.includes('leave the entire upper row unchanged'), 'single lower tooth has an exact location');
const mixed = buildTryOnPrompt({ teeth: 'T5,T6,B5,B6' });
check(mixed.includes('Top row: exactly 2 teeth') && mixed.includes('Bottom row: exactly 2 teeth'), 'two pairs stay separate instead of becoming full rows');
check(mixed.includes('A plain metal cap must remain plain metal') && mixed.includes('natural enamel'), 'mixed stone and plain caps preserve neighboring enamel');
check(mixed.includes('at most 2 upper and 2 lower teeth') && mixed.includes('overrides any extra jewelry visible'), 'selected pair prevents surplus reference side caps from reaching the smile');
check(mixed.includes('contact shadows') && mixed.includes('PHOTOGRAPHIC RELIGHTING') && mixed.includes('tiny identical gold squares'), 'portrait lighting, tooth shape and contact shadows are explicit');
const sixOnSix = buildTryOnPrompt({ teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8' });
check(sixOnSix.includes('at most 6 upper and 6 lower teeth') && sixOnSix.includes('VISIBILITY BEFORE DISPLAY') && sixOnSix.includes('original upper/lower overlap'), 'six-on-six coverage does not force hidden lower caps into view');
check(sixOnSix.includes('FIT PRIORITY') && sixOnSix.includes('Adapt its contour') && !sixOnSix.includes('silhouette and distinctive details must stay'), 'portrait anatomy takes priority over the detached product silhouette');
check(sixOnSix.includes('convex tooth') && sixOnSix.includes('dark oral-cavity reflections') && sixOnSix.includes('focus, grain and sharpness'), 'caps have volume, local reflections and portrait-scale detail');
check(buildTryOnPrompt({ style: 'set' }).includes('Determine the covered tooth positions only from IMAGE 2'), 'legacy answers without a tooth map do not invent a full set');
check(buildTryOnPrompt({ type: 'grillz', teeth: 'T5,T6,B5,B6' }) === mixed && !mixed.includes('PRESERVE THE PHOTO'), 'grillz regression: a typed grillz lead gets exactly the old smile prompt');

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
for (const [key, value] of Object.entries({ formId: 'demo', name: 'Try-on QA', email: 'tryon@example.com', phone: '555 010 0009', consent: 'yes', answers: JSON.stringify({ type: 'grillz', style: 'other', teeth: 'T5,T6,B5,B6', metal: 'white-gold', karat: '14K', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }) })) fd.set(key, value);
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
const raw = (path, init = {}) => fetch(base + path, init).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
const third = await raw(path + '/tryon', { method: 'POST', body: photo });
check(third.status === 429, 'grillz limit stays at two try-ons per lead');

// Ostali komadi na formi klijenta (portal treba klijenta): prsten, minđuše, sat.
const adminToken = process.env.QA_ADMIN_TOKEN || (existsSync(new URL('../.dev.vars', import.meta.url)) ? readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)?.[1].trim() : '');
assert.ok(adminToken, 'ADMIN_TOKEN in .dev.vars or QA_ADMIN_TOKEN');
const A = { 'x-admin-token': adminToken, 'content-type': 'application/json' };
const admin = (path, method = 'GET', body) => raw(path, { method, headers: A, ...(body ? { body: JSON.stringify(body) } : {}) });
const client = (await admin('/api/admin/clients', 'POST', { name: `Try-on QA ${Date.now().toString(36)}` })).data.client;
const form = (await admin('/api/admin/forms', 'POST', { clientId: client.id, template: 'custom-enquiry', name: 'Try-on all pieces' })).data.form;
check(client?.id && form?.id && form.tryOn !== false, 'new client form has try-on on by default');
const pieceAnswers = {
  ring: { type: 'ring', style: 'other', metal: 'yellow-gold', karat: '14K', stones: 'lab', coverage: 'accents', budget: '$1,500 - $2,500', inscription: 'Blake' },
  earrings: { type: 'earrings', style: 'other', metal: 'white-gold', karat: '14K', stones: 'moissanite', coverage: 'full', budget: '$1,500 - $2,500' },
  watch: { type: 'watch', style: 'other', metal: 'yellow-gold', karat: '14K', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' },
};
const selfies = { ring: 'oval-ring', earrings: 'pear-drops', watch: 'iced-watch' };
const pieceLeads = {};
async function pieceLead(type, name) {
  const f = new FormData();
  for (const [key, value] of Object.entries({ formId: form.id, name, email: `${type}@example.com`, phone: '555 010 0010', consent: 'yes', answers: JSON.stringify(pieceAnswers[type]) })) f.set(key, value);
  const l = await request('/api/leads', f);
  const r = await request(`/api/leads/${l.leadId}/renders`, { token: l.token });
  return { ...l, render: r };
}
for (const type of Object.keys(pieceAnswers)) {
  const l = await pieceLead(type, `Try-on ${type}`);
  const img = readFileSync(new URL(`../public/site/gallery/${selfies[type]}.webp`, import.meta.url));
  const p = new FormData();
  p.set('token', l.token); p.set('consent', 'yes'); p.set('base', '1'); p.set('photo', new Blob([img], { type: 'image/webp' }), 'mock-photo.webp');
  const res = await request(`/api/leads/${l.leadId}/tryon`, p);
  const state = await request(`/api/leads/${l.leadId}`, null, { 'x-lead-token': l.token });
  const last = JSON.parse(readFileSync(process.env.MOCK_LOG || '/tmp/jewelrylead-tryon-api.json', 'utf8')).filter(e => e.path === '/v1/images/edits').at(-1);
  const rendered = Buffer.from(await (await fetch(base + l.render.url)).arrayBuffer());
  check(res.base === 1 && res.remaining === 1 && state.tryons.length === 1 && state.renders.length === 1, `${type}: try-on saved, one left, kept out of product renders`);
  check(last.imageHashes[0] === hash(img) && last.imageHashes[1] === hash(rendered), `${type}: model gets the customer photo first and the ${type} render second`);
  check(last.prompt === buildTryOnPrompt(state.answers) && last.prompt.includes(INSIDE_RULE(type)) && !last.prompt.includes('tooth'), `${type}: the ${type} prompt with the no-ice-inside rule reaches the model`);
  check(last.model === 'gpt-image-2.5-sunburst' && last.quality === 'xhigh' && last.size === 'auto', `${type}: same precision model and quality as grillz`);
  pieceLeads[type] = l;
}
check(JSON.parse(readFileSync(process.env.MOCK_LOG || '/tmp/jewelrylead-tryon-api.json', 'utf8')).filter(e => e.path === '/v1/images/edits').at(-1).prompt.includes('38 to 44 mm'), 'watch prompt carries the real case size');

// Portal: fotografija sa probe nosi natpis po komadu.
const viewAs = (await admin(`/api/admin/clients/${client.id}/view-as`, 'POST')).data.token;
const portalLeads = (await raw('/api/portal/leads', { headers: { 'x-portal-token': viewAs } })).data.leads || [];
const label = (type) => portalLeads.find((x) => x.id === pieceLeads[type].leadId)?.photos.filter((ph) => /^On /.test(ph.label)).map((ph) => ph.label).join();
check(label('ring') === 'On their hand' && label('earrings') === 'On their ear' && label('watch') === 'On their wrist', 'portal labels follow the piece: On their hand, ear, wrist');

// Isti prekidač forme gasi try-on za svaki komad.
form.tryOn = false;
check((await admin(`/api/admin/forms/${form.id}`, 'PUT', { form })).status === 200, 'builder switch off saves');
const off = await pieceLead('ring', 'Try-on off');
const offPhoto = new FormData();
offPhoto.set('token', off.token); offPhoto.set('consent', 'yes'); offPhoto.set('photo', new Blob([selfie], { type: 'image/webp' }), 'x.webp');
const refused = await raw(`/api/leads/${off.leadId}/tryon`, { method: 'POST', body: offPhoto });
check(refused.status === 400 && /not available/.test(refused.data.error), 'switch off: ring try-on refused');
delete form.tryOn;
await admin(`/api/admin/forms/${form.id}`, 'PUT', { form });
const back = await raw(`/api/leads/${off.leadId}/tryon`, { method: 'POST', body: offPhoto });
check(back.status === 200, 'switch back on (no flag, as in old saved forms): ring try-on works again');
if (process.env.QA_STATE_FILE) writeFileSync(process.env.QA_STATE_FILE, JSON.stringify({ leadId: lead.leadId, token: lead.token, formId: form.id, pieces: Object.fromEntries(Object.entries(pieceLeads).map(([t, l]) => [t, { leadId: l.leadId, token: l.token }])) }));
console.log(`Passed ${checks} checks. No paid AI calls.`);
console.log(`Local UI review: ${base}/f/demo, lead ${lead.leadId}`);
