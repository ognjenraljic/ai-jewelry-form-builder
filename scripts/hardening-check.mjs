// Provjera zaštite (pregled 20.10.2026): prijava kolačićem, zaglavlja, HEAD i 404, atomični limiti, budžet, moderacija,
// potpisani linkovi, portal (status, stranice, 120+ upita), verzije onboardinga, konflikti forme, spam, noćno čišćenje.
// Pokretanje: lažni OpenAI (node scripts/mock-openai.mjs 8899 log.json) i
//   npx wrangler dev --port 8799 --test-scheduled --var OPENAI_API_KEY:mock --var OPENAI_BASE:http://127.0.0.1:8899
// pa: BASE=http://127.0.0.1:8799 node scripts/hardening-check.mjs   (ništa se ne generiše, ništa ne košta)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ipNet } from '../src/guard.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const ROOT = new URL('..', import.meta.url).pathname;
const TOKEN = readFileSync(`${ROOT}.dev.vars`, 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const A = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
const img = readFileSync(`${ROOT}public/site/gallery/halo-ring.webp`);
// Lokalni dev server zna prekinuti vezu odmah poslije direktnog upisa u bazu (wrangler d1 execute): ponovi jednom.
const rawFetch = globalThis.fetch;
globalThis.fetch = async (...args) => { try { return await rawFetch(...args); } catch (e) { await new Promise((r) => setTimeout(r, 1500)); return rawFetch(...args); } };
let fail = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}${extra ? ` | ${extra}` : ''}`); if (!c) fail++; };
const j = async (r) => ({ s: r.status, h: r.headers, d: await r.json().catch(() => ({})) });
const post = (p, body, h = A) => fetch(BASE + p, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(j);
const sql = (q) => {
  const f = `${process.env.TMPDIR || '/tmp'}/hc.sql`;
  writeFileSync(f, q);
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'konfigurator', '--local', '--file', f], { cwd: ROOT, stdio: 'pipe', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
};
const RUN = Date.now().toString(36);
const ringA = { type: 'ring', style: 'halo', metal: 'white-gold', karat: '14K', stones: 'lab', coverage: 'accents', budget: '$1,500 - $2,500' };
const grillzA = { type: 'grillz', style: 'top6', teeth: 'T3,T4,T5,T6,T7,T8', metal: 'yellow-gold', karat: '14K', stones: 'none', budget: 'Under $1,500' };
async function lead(form, answers, over = {}, files = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form, name: 'Hardening', email: 'h@example.com', phone: '555 010 0001', consent: 'yes', answers: JSON.stringify(answers), ...over })) fd.set(k, v);
  for (const [k, f] of Object.entries(files)) fd.set(k, f);
  return j(await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }));
}

// 1. Admin prijava kolačićem
const bad = await post('/api/admin/login', { token: 'wrong' }, { 'content-type': 'application/json' });
ok(bad.s === 403, 'pogrešan token: 403');
const login = await fetch(`${BASE}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: TOKEN }) });
const setC = login.headers.get('set-cookie') || '';
ok(login.status === 200 && /HttpOnly/i.test(setC) && /SameSite=Strict/i.test(setC), 'prijava: HttpOnly + SameSite=Strict kolačić', setC.split(';').slice(1, 4).join(';'));
ok(!setC.includes(TOKEN), 'kolačić ne sadrži sam token');
const cookie = setC.split(';')[0];
ok((await fetch(`${BASE}/api/admin/session`, { headers: { cookie } }).then(j)).d.admin === true, 'kolačić = admin');
ok((await fetch(`${BASE}/api/admin/leads?k=${TOKEN}`)).status === 403, 'token u adresi (?k=) više ne radi');
ok((await fetch(`${BASE}/api/admin/leads`, { headers: { cookie } })).status === 200, 'admin API sa kolačićem');
ok((await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{"name":"Evil"}' })).status === 403, 'kolačić + tuđi Origin (CSRF): 403');
ok((await fetch(`${BASE}/api/admin/session`, { headers: { cookie: 'aik_admin=v1.9999999999.forged' } }).then(j)).d.admin === false, 'lažni kolačić: nije admin');

// 2. Zaglavlja, HEAD, 404
const hb = (await fetch(`${BASE}/builder`)).headers;
ok(/frame-ancestors 'none'/.test(hb.get('content-security-policy') || '') && hb.get('x-frame-options') === 'DENY', 'builder: CSP + zabrana ugrađivanja');
ok(/max-age=31536000/.test(hb.get('strict-transport-security') || '') && hb.get('x-content-type-options') === 'nosniff', 'HSTS + nosniff');
ok(/frame-ancestors 'none'/.test((await fetch(`${BASE}/portal`)).headers.get('content-security-policy') || ''), 'portal: zabrana ugrađivanja');
ok(/frame-ancestors 'none'/.test((await fetch(`${BASE}/admin`)).headers.get('content-security-policy') || ''), 'admin: zabrana ugrađivanja');
ok(/frame-ancestors \*/.test((await fetch(`${BASE}/f/landing-demo`)).headers.get('content-security-policy') || ''), 'forma bez ograničenja: može se ugraditi svuda');
for (const p of ['/', '/f/landing-demo', '/builder']) ok((await fetch(BASE + p, { method: 'HEAD' })).status === 200, `HEAD ${p}: 200`);
const nf = await fetch(`${BASE}/nema-ove-stranice`);
ok(nf.status === 404 && (nf.headers.get('content-type') || '').includes('html') && (await nf.text()).includes('Page not found'), '404: prava stranica');
ok((await fetch(`${BASE}/api/nema`)).headers.get('content-type')?.includes('json'), '404 za API ostaje JSON');
ok((await fetch(`${BASE}/robots.txt`).then((r) => r.text())).includes('Disallow: /builder'), 'robots.txt');
ok((await fetch(`${BASE}/favicon.svg`)).status === 200, 'favicon');
ok((await fetch(`${BASE}/api/config`).then(j)).d.turnstile === null, 'Turnstile isključen bez ključeva');

// 3. Dozvoljeni sajtovi za ugradnju
const f0 = await fetch(`${BASE}/api/admin/forms/landing-demo`, { headers: A }).then(j);
const withO = { ...f0.d.form, allowedOrigins: ['https://shop.example.com'] };
ok((await fetch(`${BASE}/api/admin/forms/landing-demo`, { method: 'PUT', headers: A, body: JSON.stringify({ form: withO, force: true }) })).status === 200, 'čuvanje dozvoljenih sajtova');
ok(/frame-ancestors 'self' https:\/\/shop\.example\.com/.test((await fetch(`${BASE}/f/landing-demo`)).headers.get('content-security-policy') || ''), 'forma samo na dozvoljenom sajtu');
ok((await fetch(`${BASE}/api/admin/forms/landing-demo`, { method: 'PUT', headers: A, body: JSON.stringify({ form: { ...withO, allowedOrigins: ['javascript:alert(1)'] }, force: true }) })).status === 400, 'loša adresa sajta odbijena');
const restore = { ...f0.d.form }; delete restore.allowedOrigins;
await fetch(`${BASE}/api/admin/forms/landing-demo`, { method: 'PUT', headers: A, body: JSON.stringify({ form: restore, force: true }) });

// 4. Konflikt forme i premještanje upita
const f1 = await fetch(`${BASE}/api/admin/forms/landing-demo`, { headers: A }).then(j);
ok(typeof f1.d.updated_at === 'number', 'forma vraća updated_at');
const c1 = await fetch(`${BASE}/api/admin/forms/landing-demo`, { method: 'PUT', headers: A, body: JSON.stringify({ form: f1.d.form, baseUpdatedAt: 1 }) }).then(j);
ok(c1.s === 409 && c1.d.conflict, 'čuvanje preko novije verzije: 409');
ok((await fetch(`${BASE}/api/admin/forms/landing-demo`, { method: 'PUT', headers: A, body: JSON.stringify({ form: f1.d.form, baseUpdatedAt: f1.d.updated_at }) })).status === 200, 'čuvanje sa tačnom verzijom: 200');
const other = (await post('/api/admin/clients', { name: `Move Test ${Date.now() % 1e5}` })).d.client;
await lead('landing-demo', ringA);
const mv = await fetch(`${BASE}/api/admin/forms/landing-demo`, { method: 'PUT', headers: A, body: JSON.stringify({ form: { ...f1.d.form, clientId: other.id }, force: true }) }).then(j);
ok(mv.s === 409 && mv.d.moveLeads, 'promjena klijenta forme sa upitima traži potvrdu');

// 5. Upiti: moderacija, stvarni tip slike, mreža
ok((await lead('landing-demo', { ...ringA, vision: 'please FLAGME' })).s === 400, 'moderacija: opis odbijen');
ok((await lead('landing-demo', ringA, {}, { file_reference: new File(['not an image'], 'x.jpg', { type: 'image/jpeg' }) })).s === 400, 'lažna slika (tekst kao jpeg) odbijena');
ok((await lead('landing-demo', ringA, {}, { file_reference: new File([img], 'x.webp', { type: 'image/webp' }) })).s === 200, 'prava slika prolazi');
const req = (ip) => new Request('http://x', { headers: { 'cf-connecting-ip': ip } });
ok(ipNet(req('2001:db8:aa:bb:1:2:3:4')) === ipNet(req('2001:db8:aa:bb:ffff::9')), 'IPv6: ista /64 mreža = isti limit');
ok(ipNet(req('2001:db8:aa:cc::1')) !== ipNet(req('2001:db8:aa:bb::1')), 'IPv6: druga mreža = drugi limit');
ok(ipNet(req('203.0.113.7')) === '203.0.113.7', 'IPv4 po adresi');

// 6. Renderi: atomično, moderacija dorade, budžet, vraćanje rezultata
const L = (await lead('landing-demo', ringA)).d;
const R = (body) => post(`/api/leads/${L.leadId}/renders`, { token: L.token, ...body }, { 'content-type': 'application/json' });
const par = await Promise.all(Array.from({ length: 10 }, () => R({})));
// Lažni model odgovara odmah, pa poslije prvog može proći još jedan; nikad dva u isto vrijeme i nikad preko limita (4).
const okPar = par.filter((x) => x.s === 200);
ok(okPar.length >= 1 && okPar.length <= 4 && new Set(okPar.map((x) => x.d.n)).size === okPar.length, '10 paralelnih rendera: najviše jedan u isto vrijeme, različiti brojevi', par.map((x) => x.s).join(','));
ok((await R({ tweak: 'make it FLAGME' })).s === 400, 'moderacija: dorada odbijena');
const st = await fetch(`${BASE}/api/leads/${L.leadId}`, { headers: { 'x-lead-token': L.token } }).then(j);
ok(st.s === 200 && st.d.renders.length === okPar.length && st.d.answers.type === 'ring', 'kupac vraća rezultat poslije osvježavanja');
ok((await fetch(`${BASE}/api/leads/${L.leadId}`)).status === 403, 'stanje upita bez tokena: 403');
sql(`INSERT INTO renders (id, lead_id, n, model, prompt, status, cost_usd, created_at) VALUES ('hcb${RUN}', '${L.leadId}', 99, 'x', '', 'ok', 999, ${Date.now()});`);
const over = await R({ tweak: 'bigger stones' });
ok(over.s === 503 && over.d.paused, 'dnevni budžet dostignut: render ne nastaje', over.d.error);
const nt = await fetch(`${BASE}/api/admin/notifications`, { headers: A }).then(j);
ok(nt.d.items.some((n) => n.kind === 'budget'), 'obavještenje o budžetu u zvoncu');
sql(`DELETE FROM renders WHERE id = 'hcb${RUN}';`);

// 7. Proba na osmijehu: pristanak, potpisan link
const G = (await lead('landing-demo', grillzA)).d;
await post(`/api/leads/${G.leadId}/renders`, { token: G.token }, { 'content-type': 'application/json' });
const tryOn = (consent) => { const fd = new FormData(); fd.set('token', G.token); fd.set('base', '1'); if (consent) fd.set('consent', 'yes'); fd.set('photo', new File([img], 's.webp', { type: 'image/webp' })); return fetch(`${BASE}/api/leads/${G.leadId}/tryon`, { method: 'POST', body: fd }).then(j); };
ok((await tryOn(false)).s === 400, 'proba bez pristanka odbijena');
const t1 = await tryOn(true);
ok(t1.s === 200 && /\?e=\d+&s=/.test(t1.d.url) && !t1.d.url.includes(G.token), 'proba: potpisan link, bez tokena upita', t1.d.url?.slice(0, 60));
if (t1.d.url) {
  ok((await fetch(BASE + t1.d.url)).status === 200, 'potpisan link radi');
  ok((await fetch(BASE + t1.d.url.replace(/s=[^&]+/, 's=forged'))).status === 403, 'izmijenjen potpis: 403');
  ok((await fetch(BASE + t1.d.url.replace(/e=\d+/, 'e=100'))).status === 403, 'istekao link: 403');
  ok((await fetch(BASE + t1.d.url.split('?')[0])).status === 403, 'bez potpisa: 403');
  ok(/private/.test((await fetch(BASE + t1.d.url)).headers.get('cache-control') || ''), 'privatna slika: privatan keš');
}
const pubR = (await fetch(`${BASE}/api/leads/${G.leadId}`, { headers: { 'x-lead-token': G.token } }).then(j)).d.renders[0]?.url;
ok(/immutable/.test((await fetch(BASE + pubR)).headers.get('cache-control') || ''), 'render: dugo keširanje (immutable)');

// 8. Portal: kolačić, status, stranice, 120 upita
const cl = (await post('/api/admin/clients', { name: `Portal Big ${Date.now() % 1e5}` })).d.client;
const fm = (await post('/api/admin/forms', { clientId: cl.id, template: 'ring' })).d.form;
const now = Date.now();
sql(`INSERT INTO leads (id, form_id, token, name, email, phone, answers, created_at) VALUES ${Array.from({ length: 120 }, (_, i) => `('pb${cl.id.slice(-5)}${i}', '${fm.id}', 't', 'Lead ${i}', 'l${i}@example.com', '555 000 ${String(i).padStart(4, '0')}', '{"type":"ring"}', ${now - i * 1000})`).join(',')};`);
const link = (await post(`/api/admin/clients/${cl.id}/portal-link`, {})).d.url;
const ex = await fetch(`${BASE}/api/portal/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: link.split('#k=')[1] }) });
const pc = (ex.headers.get('set-cookie') || '').split(';')[0];
ok(ex.status === 200 && /HttpOnly/i.test(ex.headers.get('set-cookie') || ''), 'portal link -> HttpOnly kolačić');
const PG = (q = '') => fetch(`${BASE}/api/portal/leads${q}`, { headers: { cookie: pc } }).then(j);
const p1 = await PG();
ok(p1.s === 200 && p1.d.leads.length === 50 && p1.d.more, '120 upita: radi (bez greške D1), stranica od 50', `${p1.s} ${p1.d.leads?.length}`);
const p3 = await PG(`?before=${(await PG(`?before=${p1.d.next}`)).d.next}`);
ok(p3.d.leads.length === 20 && !p3.d.more, 'treća stranica: zadnjih 20');
const first = p1.d.leads[0].id;
ok((await fetch(`${BASE}/api/portal/leads/${first}`, { method: 'PATCH', headers: { cookie: pc, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'quoted', note: 'Sent quote' }) })).status === 200, 'status i bilješka upita');
const q = await PG('?status=quoted');
ok(q.d.leads.length === 1 && q.d.leads[0].note === 'Sent quote' && q.d.counts.quoted === 1, 'filter po statusu i brojač');
ok((await PG('?q=lead 11')).d.leads.length >= 1, 'pretraga po imenu');
ok((await fetch(`${BASE}/api/portal/leads/${first}`, { method: 'PATCH', headers: { cookie: pc, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'hacked' }) })).status === 400, 'nepoznat status odbijen');
const va = (await post(`/api/admin/clients/${cl.id}/view-as`, {})).d.token;
ok((await fetch(`${BASE}/api/portal/leads/${first}`, { method: 'PATCH', headers: { 'x-portal-token': va, 'content-type': 'application/json' }, body: '{"status":"lost"}' })).status === 403, 'admin pregled ne mijenja status');

// 9. Onboarding: čišćenje podataka, verzije, admin samo gleda
const oc = (await post('/api/admin/clients', { name: `Ob Rev ${Date.now() % 1e5}` })).d.client;
const ol = (await post(`/api/admin/clients/${oc.id}/onboarding`, {})).d.url.split('#k=')[1];
const OH = { 'x-portal-token': ol, 'content-type': 'application/json' };
const me = await fetch(`${BASE}/api/portal/me`, { headers: OH }).then(j);
const put = (data, rev) => fetch(`${BASE}/api/portal/onboarding`, { method: 'PUT', headers: OH, body: JSON.stringify({ data, rev }) }).then(j);
const s1 = await put({ store: { name: 'X', accent: 'red;background:url(//evil)', logo: 'https://evil.example/pixel.png' }, pieces: [{ value: 'ring', label: 'Ring', styles: [{ label: 'A', image: '/media/onboarding/other-client/x.webp' }] }] }, me.d.onboarding.rev);
ok(s1.s === 200, 'onboarding čuvanje');
const saved = (await fetch(`${BASE}/api/portal/me`, { headers: OH }).then(j)).d.onboarding.data;
ok(saved.store.accent === '#35d0c4' && saved.store.logo === '' && saved.pieces[0].styles[0].image === '', 'loša boja, tuđi logo i tuđa slika očišćeni');
ok((await put({ store: { name: 'Old device' } }, 0)).s === 409, 'čuvanje sa starom verzijom: 409 (drugi uređaj)');
const vo = (await post(`/api/admin/clients/${oc.id}/view-as`, {})).d.token;
ok((await fetch(`${BASE}/api/portal/onboarding`, { method: 'PUT', headers: { 'x-portal-token': vo, 'content-type': 'application/json' }, body: JSON.stringify({ data: {}, rev: s1.d.rev }) })).status === 403, 'admin pregled ne mijenja onboarding');
const sub = await Promise.all([1, 2, 3].map(() => fetch(`${BASE}/api/portal/onboarding/submit`, { method: 'POST', headers: OH }).then(j)));
const obNotes = (await fetch(`${BASE}/api/admin/notifications`, { headers: A }).then(j)).d.items.filter((n) => n.kind === 'onboarding' && n.title.startsWith(oc.name));
ok(sub.every((x) => x.s === 200) && obNotes.length === 1, '3 slanja odjednom: jedno obavještenje');
const ob = (await fetch(`${BASE}/api/admin/onboardings`, { headers: A }).then(j)).d.onboardings.find((o) => o.client_id === oc.id);
const builds = await Promise.all([1, 2].map(() => post(`/api/admin/onboardings/${ob.id}/build`, {})));
ok(builds.filter((b) => b.s === 200).length === 1, 'dvostruki klik "Create form": jedna forma', builds.map((b) => b.s).join(','));

// 10. Zahtjev za demo: skriveno polje = mogući spam (čuva se, bez obavještenja)
const before = (await fetch(`${BASE}/api/admin/notifications`, { headers: A }).then(j)).d.items.length;
ok((await post('/api/demo-requests', { name: 'Maybe Bot', email: 'b@example.com', website: 'bot.example', hp_extra: 'x' }, { 'content-type': 'application/json' })).s === 200, 'skriveno polje: odgovor OK');
const dem = (await fetch(`${BASE}/api/admin/leads`, { headers: A }).then(j)).d.demos.find((d) => d.name === 'Maybe Bot');
ok(dem?.spam === 1, 'sačuvan kao mogući spam (ne nestaje)');
ok((await fetch(`${BASE}/api/admin/notifications`, { headers: A }).then(j)).d.items.length === before, 'bez obavještenja za spam');

// 11. Noćno čišćenje (render koji je ostao "u toku")
sql(`INSERT INTO renders (id, lead_id, n, model, prompt, status, created_at) VALUES ('hcs${RUN}', '${L.leadId}', 98, 'x', '', 'pending', ${Date.now() - 600000});`);
const sch = await fetch(`${BASE}/__scheduled?cron=17+3+*+*+*`);
ok(sch.status === 200, 'noćni zadatak radi', `${sch.status}`);
await new Promise((r) => setTimeout(r, 800));
const stale = (await fetch(`${BASE}/api/admin/leads`, { headers: A }).then(j)).d.leads.find((l) => l.id === L.leadId)?.renders.find((r) => r.n === 98);
ok(stale?.status === 'error', 'zaglavljen render ugašen');
sql(`DELETE FROM renders WHERE id = 'hcs${RUN}';`);

console.log(fail ? `\n${fail} palo` : '\nsve prošlo');
process.exit(fail ? 1 : 0);
