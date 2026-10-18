// Provjera platforme: klijenti, forme iz šablona, default/custom pitanja, slike i napomene po opciji, fajlovi.
// node scripts/platform-check.mjs            (bez rendera)
// RENDER=1 node scripts/platform-check.mjs   (+ jedan Flash render iz Grillz šablona, ~$0,04)
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN };
const HJ = { ...H, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b) => fetch(`${BASE}${p}`, { method: 'POST', headers: HJ, body: JSON.stringify(b) }).then(j);
const put = (p, b) => fetch(`${BASE}${p}`, { method: 'PUT', headers: HJ, body: JSON.stringify(b) }).then(j);
const get = (p, h = H) => fetch(`${BASE}${p}`, { headers: h }).then(j);
const img = async (path) => new Blob([await (await fetch(`${BASE}${path}`)).arrayBuffer()], { type: 'image/webp' });
const upload = async (scope, blob, type = 'image/webp') => {
  const fd = new FormData();
  fd.set('file', new Blob([await blob.arrayBuffer()], { type }), 'x');
  return fetch(`${BASE}/api/admin/${scope}/upload`, { method: 'POST', headers: H, body: fd }).then(j);
};
const lead = async (formId, answers, files = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId, name: 'Platform Test', email: 'platform@example.com', phone: '555 010 0003', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify(answers));
  for (const [k, b] of Object.entries(files)) fd.set(`file_${k}`, b, `${k}.webp`);
  return fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j);
};

// --- Klijent ---
ok((await get('/api/admin/clients', {})).status === 403 || (await post('/api/admin/clients', {})).status !== 200, 'klijenti traže token');
const c = await post('/api/admin/clients', { name: 'Platform Jewelers', website: 'platform.example' });
ok(c.status === 200 && c.body.client?.id, `klijent napravljen (${c.body.client?.id})`);
const cid = c.body.client.id;
const logoBlob = await img('/library/ring/signet.webp');
const lg = await upload(`clients/${cid}`, logoBlob);
ok(lg.body.url?.startsWith(`/media/clients/${cid}/`), 'logo klijenta uploadovan');
const svg = await upload(`clients/${cid}`, new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>']), 'image/svg+xml');
ok(svg.status === 400, 'SVG logo odbijen (XSS zaštita)');
ok((await put(`/api/admin/clients/${cid}`, { name: 'Platform Jewelers', website: 'platform.example', logo: lg.body.url, notes: 'test' })).status === 200, 'klijent sačuvan sa logom');
ok((await put(`/api/admin/clients/${cid}`, { name: 'X Y', logo: 'https://evil.example/l.png' })).status === 400, 'strani logo odbijen');

// --- Forme iz svakog šablona ---
const list0 = (await get('/api/admin/forms')).body;
ok(list0.templates?.length === 4, `4 šablona (${list0.templates?.map((t) => t.key).join(', ')})`);
ok((await post('/api/admin/forms', { template: 'grillz' })).status === 400, 'forma bez klijenta odbijena');
const made = {};
for (const t of list0.templates) {
  const r = await post('/api/admin/forms', { clientId: cid, template: t.key });
  made[t.key] = r.body.form;
  ok(r.status === 200 && r.body.form?.clientId === cid && r.body.form.brand.logo === lg.body.url, `${t.label}: forma za klijenta, logo preuzet (${r.body.form?.id})`);
}
const list = (await get('/api/admin/forms')).body;
ok(list.forms.filter((f) => f.clientId === cid).length === 4, 'lista: 4 forme pod klijentom');
ok(list.clients.some((x) => x.id === cid && x.logo), 'lista: klijent sa logom');

// --- Grillz: isključen korak komada, default vrijednost, default pitanja ---
const gid = made.grillz.id;
let r = await lead(gid, { style: 'top8', teeth: 'T2,T3,T4,T5,T6,T7,T8,T9', metal: 'yellow-gold', karat: '14K', stones: 'none', budget: 'Under $1,500' });
ok(r.status === 200, `grillz lead bez izbora komada (default "grillz") ${r.body.error || ''}`);
r = await lead(gid, { type: 'ring', style: 'top8', teeth: 'T2,T3,T4,T5,T6,T7,T8,T9', metal: 'yellow-gold', karat: '14K', stones: 'none', budget: 'Under $1,500' });
ok(r.status === 200, 'pokušaj podmetanja drugog komada se prepiše defaultom');

// isključi default pitanje (karat) i označi "Cut" obaveznim; dodaj custom pitanja
const g = (await get(`/api/admin/forms/${gid}`)).body.form;
const design = g.steps.find((s) => s.id === 'design');
design.fields.find((f) => f.id === 'karat').enabled = false;
design.fields.find((f) => f.id === 'grill_cut').required = true;
const optImg = await upload(`forms/${gid}`, await img('/library/grillz/top6.webp'));
ok(optImg.body.url?.startsWith(`/media/forms/${gid}/`), 'slika opcije uploadovana');
g.steps.find((s) => s.id === 'fit').fields.push(
  { id: 'finish', type: 'dropdown', label: 'Finish', required: true, followup: 'text', options: [{ value: 'polished', label: 'Polished', image: optImg.body.url, note: 'mirror polished metal' }, { value: 'matte', label: 'Matte', note: 'brushed matte metal' }] },
  { id: 'gift', type: 'yesno', label: 'Is it a gift?', ai: false, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { id: 'teeth_photo', type: 'upload', label: 'Photo of your teeth (optional)' },
);
let s = await put(`/api/admin/forms/${gid}`, { form: g });
ok(s.status === 200, `custom pitanja sačuvana (dropdown + slika + napomena, yes/no, upload) ${s.body.error || ''}`);
const bad = structuredClone(g);
bad.steps.find((st) => st.id === 'fit').fields.find((f) => f.id === 'finish').default = 'gold';
ok((await put(`/api/admin/forms/${gid}`, { form: bad })).status === 400, 'default van opcija odbijen');
const bad2 = structuredClone(g);
bad2.steps.find((st) => st.id === 'fit').fields.find((f) => f.id === 'finish').options[0].image = 'https://evil.example/a.png';
ok((await put(`/api/admin/forms/${gid}`, { form: bad2 })).status === 400, 'strana slika opcije odbijena');

const pub = (await get(`/api/forms/${gid}`, {})).body;
const pubFinish = pub.steps.flatMap((st) => st.fields).find((f) => f.id === 'finish');
ok(pubFinish && !pubFinish.options.some((o) => o.note) && !('ai' in pubFinish) && pubFinish.options[0].image, 'javna forma: slika opcije ide, AI napomena i ai zastavica ne');

const base = { style: 'top8', metal: 'yellow-gold', stones: 'moissanite', coverage: 'full', grill_cut: 'open-face', budget: '$2,500 - $5,000', mold: 'yes', teeth: 'T3,T4,T5,T6,T7,T8' };
r = await lead(gid, { ...base });
ok(r.status === 400 && /Finish/.test(r.body.error), 'obavezno custom pitanje (Finish) se traži');
r = await lead(gid, { ...base, finish: 'gold' });
ok(r.status === 400, 'nepostojeća opcija odbijena');
r = await lead(gid, { ...base, finish: 'polished', finish__more: 'x'.repeat(600) });
ok(r.status === 400, 'predugačak dodatni tekst odbijen');
const teeth = await img('/library/grillz/set.webp');
r = await lead(gid, { ...base, karat: '18K', finish: 'polished', finish__more: 'extra shiny please', gift: 'no' }, { teeth_photo: teeth });
ok(r.status === 200, `lead sa custom pitanjima i fajlom ${r.body.error || ''}`);
const adm = (await get('/api/admin/leads')).body.leads.find((l) => l.id === r.body.leadId);
ok(adm && !('karat' in adm.answers), 'isključeno pitanje (karat) izbačeno iz odgovora');
ok(adm?.answers.finish__more === 'extra shiny please' && adm.answers.type === 'grillz', 'dodatni tekst i default komad sačuvani');
ok(adm && adm.files && JSON.parse(adm.files).teeth_photo, 'custom upload sačuvan u files');

if (process.env.RENDER) {
  const rr = (await fetch(`${BASE}/api/leads/${r.body.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: r.body.token, model: 'flash' }) }).then(j)).body;
  const p = rr.dev?.prompt || '';
  ok(rr.url, `render: ${rr.url || rr.error}`);
  ok(p.includes('open face grill') && p.includes('mirror polished metal'), 'prompt: napomene opcija (cut, finish)');
  ok(p.includes('extra shiny please'), 'prompt: dodatni tekst kupca');
  ok(!p.includes('gift') && !p.includes('molds') && !p.includes('2,500') && !p.includes('18K'), 'prompt: bez ai:false i isključenih pitanja');
  console.log('slika:', `${BASE}${rr.url}`);
}

console.log(fails ? `\n${fails} FAIL` : '\nsve prošlo');
process.exit(fails ? 1 : 0);
