// Duplicate forme (26.11.2026): kopija sačuvane forme sa svim koracima, stilovima, cijenama i izgledom, bez leadova;
// u istom projektu ostaje sve, u drugom projektu dobija ime i logo te radnje, bez tuđih proizvoda i Privacy/Terms linkova.
//   BASE=http://127.0.0.1:8797 node scripts/duplicate-check.mjs   (token iz .dev.vars)
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (path, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: H, body: JSON.stringify(body) }).then(j);
const getForm = (id) => fetch(`${BASE}/api/admin/forms/${id}`, { headers: H }).then(j).then((r) => r.body);

const tag = Date.now().toString(36).slice(-4);
const a = (await post('/api/admin/clients', { name: `Dup Alpha ${tag}` })).body.client;
const b = (await post('/api/admin/clients', { name: `Dup Beta ${tag}` })).body.client;
const orig = (await post('/api/admin/forms', { clientId: a.id, template: 'grillz', name: 'Alpha grillz' })).body.form;

// Izmjena originala: drugi naslov koraka, proizvod u shopu, svoj Privacy link, ime radnje u tekstu.
const { form: saved, updated_at } = await getForm(orig.id);
saved.steps[0].title = 'Pick your grill';
saved.theme.accent = '#123456';
saved.products = [{ id: 'p1', name: 'Gold grill', price: '$900', url: 'https://alpha.example/p1' }];
saved.contact = { ...saved.contact, privacyUrl: 'https://alpha.example/privacy' };
const put = await fetch(`${BASE}/api/admin/forms/${orig.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ form: saved, baseUpdatedAt: updated_at }) }).then(j);
ok(put.status === 200, `original sačuvan sa izmjenama (${put.status} ${put.body.error || ''})`);

// Lead na originalu: ne smije preći na kopiju.
const fd = new FormData();
for (const [k, v] of Object.entries({ formId: orig.id, name: 'Lead Stay', email: 'stay@example.com', phone: '+1 (303) 555-0101', consent: 'yes' })) fd.set(k, v);
fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }));
const lead = await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j);
ok(lead.status === 200, 'lead na originalu');

// 1) Isti projekat
const same = await post('/api/admin/forms', { copyFrom: orig.id, clientId: a.id, name: 'Alpha grillz (copy)' });
ok(same.status === 200 && same.body.form.id !== orig.id, `kopija u istom projektu ima svoj ID (${same.body.form?.id})`);
ok(same.body.form.id.startsWith(`${a.id}-grillz`), 'ID kopije po šablonu izvora, ne "form"');
const s = (await getForm(same.body.form.id)).form;
ok(s.name === 'Alpha grillz (copy)' && s.clientId === a.id && s.template === orig.template, 'ime, projekat i šablon');
ok(s.steps[0].title === 'Pick your grill' && s.theme.accent === '#123456', 'kopija nosi sačuvane izmjene (korak, boja)');
ok(s.products?.length === 1 && s.contact.privacyUrl === 'https://alpha.example/privacy' && s.brand.name === saved.brand.name, 'u istom projektu ostaju proizvodi, Privacy link i ime radnje');
ok(JSON.stringify(s.steps) === JSON.stringify(saved.steps) && JSON.stringify(s.styles) === JSON.stringify(saved.styles), 'koraci i stilovi identični');

// 2) Drugi projekat
const other = await post('/api/admin/forms', { copyFrom: orig.id, clientId: b.id });
const o = (await getForm(other.body.form.id)).form;
ok(other.status === 200 && o.clientId === b.id && o.id.startsWith(`${b.id}-grillz`), `kopija u drugom projektu (${o.id})`);
ok(o.name === 'Alpha grillz (copy)', 'podrazumijevano ime "(copy)"');
ok(o.brand.name === b.name && !o.brand.logo, 'ime radnje i logo drugog projekta');
ok(!JSON.stringify(o.contact).includes(saved.brand.name) && o.contact.consent.includes(b.name), 'tekst pristanka sa imenom nove radnje');
ok(!o.products?.length && !o.contact.privacyUrl && !o.contact.termsUrl, 'bez tuđih proizvoda i Privacy/Terms linkova');
ok(o.steps[0].title === 'Pick your grill', 'koraci ostaju');

// 3) Leadovi ostaju na originalu, forme su odvojene
const list = (await fetch(`${BASE}/api/admin/forms`, { headers: H }).then(j)).body.forms;
ok([orig.id, s.id, o.id].every((id) => list.some((f) => f.id === id)), 'sve tri forme u listi');
const pub = await fetch(`${BASE}/api/forms/${o.id}`).then(j);
ok(pub.status === 200 && pub.body.contact.privacyUrl === `/legal/${o.id}/privacy`, 'javna kopija radi i ima svoje pravne stranice');

// 4) Greške
ok((await post('/api/admin/forms', { copyFrom: 'nema-te-forme', clientId: a.id })).status === 404, 'nepostojeća forma = 404');
ok((await post('/api/admin/forms', { copyFrom: orig.id })).status === 400, 'bez projekta = 400');
const noAuth = await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ copyFrom: orig.id, clientId: a.id }) });
ok(noAuth.status === 403, 'bez admin prijave = 403');

console.log(fails ? `${fails} FAILED` : 'Duplicate checks passed.');
process.exit(fails ? 1 : 0);
