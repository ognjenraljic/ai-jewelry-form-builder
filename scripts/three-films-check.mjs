// Tri video modela po slici (22.11.2026): kupac dobija samo prvi (H3 Flex), portal pokazuje sva tri sa oznakom modela i filterom.
// Pokretanje kao film-check.mjs: mock-pika + mock-openai + wrangler dev (DEV_MODE, PIKA_API_KEY:mock-local, PIKA_BASE, OPENAI_BASE),
//   BASE=... PIKA=... ADMIN=<ADMIN_TOKEN> node scripts/three-films-check.mjs
import assert from 'node:assert/strict';

const base = process.env.BASE || 'http://127.0.0.1:8798';
const pika = process.env.PIKA || 'http://127.0.0.1:8898';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'samo lokalno');
let checks = 0;
const check = (value, text) => { assert.ok(value, text); console.log(`OK ${++checks} ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = async (path, body, headers = {}) => {
  const multipart = body instanceof FormData;
  const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(!multipart && body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) });
  return { status: res.status, data: await res.clone().json().catch(() => null), text: await res.text() };
};
const videoJobs = async () => (await (await fetch(`${pika}/__log`)).json()).jobs.filter((j) => j.kind === 'video');

const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: process.env.ADMIN || 'localtest123' }) });
const cookie = login.headers.get('set-cookie').split(';')[0];
// Svoj probni klijent i forma (lokalna demo forma nema klijenta, pa ni portal).
const H = { cookie, 'content-type': 'application/json' };
const client = (await (await fetch(`${base}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: `Three Films QA ${Date.now()}` }) })).json()).client;
const created = (await (await fetch(`${base}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) })).json()).form;
const formId = created.id;
const cur = await (await fetch(`${base}/api/admin/forms/${formId}`, { headers: { cookie } })).json();
const put = await fetch(`${base}/api/admin/forms/${formId}`, { method: 'PUT', headers: H, body: JSON.stringify({ form: { ...cur.form, highlightVideo: 'auto' }, force: true }) });
assert.equal(put.status, 200, await put.text());

const fd = new FormData();
for (const [k, v] of Object.entries({ formId, name: 'Three Films QA', email: 'three@example.com', phone: '555 010 0033', consent: 'yes', answers: JSON.stringify({ type: 'ring', style: 'other', metal: 'yellow-gold', karat: '14K', stones: 'natural', coverage: 'accents', budget: '$1,500 - $2,500' }) })) fd.set(k, v);
const lead = (await send('/api/leads', fd)).data;
check(lead?.leadId, 'upit napravljen');
const api = `/api/leads/${lead.leadId}`;
const h = { 'x-lead-token': lead.token };
const before = (await videoJobs()).length;
check((await send(`${api}/renders`, { token: lead.token })).status === 200, 'prvi render');
let jobs = [];
for (let i = 0; i < 20 && jobs.length < 3; i++) { await sleep(300); jobs = (await videoJobs()).slice(before); }
check(jobs.length === 3, `prva slika pokrene tri videa (${jobs.length})`);
const by = (s) => jobs.find((j) => j.path.includes(s));
const flex = by('pika/pika-h3-flex/'), hailuo = by('minimax/hailuo-2.3-fast/'), p25 = by('pika/pika-2.5/');
check(flex && flex.body.duration === 10 && flex.body.resolution === '768p' && flex.body.last_frame_image === flex.body.image, 'H3 Flex: 10 s, 768p, petlja');
check(hailuo && hailuo.body.duration === 10 && hailuo.body.resolution === '768p' && hailuo.body.first_frame_image && hailuo.body.prompt_optimizer === false, 'Hailuo 2.3 Fast: 10 s, 768p, bez prepisivanja prompta');
check(p25 && p25.body.duration_s === 10 && p25.body.resolution === '480p' && p25.body.image, 'Pika 2.5: 10 s, 480p');
check(flex.body.prompt === hailuo.body.prompt && flex.body.prompt === p25.body.prompt, 'isti prompt za sva tri');
check(jobs.indexOf(flex) === 0, 'kupčev video kreće prvi');

// Kupac: samo H3 Flex.
let st;
for (let i = 0; i < 4; i++) {
  st = (await send(api, null, h)).data;
  const fid = st.renders[0].film?.id;
  if (fid) await send(`${api}/films/${fid}`, null, h);
}
st = (await send(api, null, h)).data;
check(st.renders.length === 1 && st.renders[0].film?.status === 'ok', 'kupac vidi gotov video');

// Portal (view-as), sa lijeve strane sva tri videa sa oznakama.
const tok = (await (await fetch(`${base}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: { cookie } })).json()).token;
check(tok, 'portal sesija');
const P = { 'x-portal-token': tok };
const leadsOf = async (qs = '') => (await (await fetch(`${base}/api/portal/leads${qs}`, { headers: P })).json());
let mine;
for (let i = 0; i < 4; i++) { mine = (await leadsOf()).leads.find((l) => l.id === lead.leadId); if (mine.films.every((f) => f.url)) break; await sleep(200); }
check(mine.films.length === 3 && mine.films.every((f) => f.url), 'portal: sva tri videa gotova');
check(JSON.stringify(mine.films.map((f) => f.label).sort()) === JSON.stringify(['Hailuo 2.3 Fast', 'Pika 2.5', 'Pika H3 Flex']), 'portal: oznake modela');
check(mine.films.filter((f) => f.customer).length === 1 && mine.films.find((f) => f.customer).model === 'flex', 'portal: samo H3 Flex je označen kao kupčev');
check(st.renders[0].film.url === mine.films.find((f) => f.model === 'flex').url, 'kupac ima baš H3 Flex video');
const all = await leadsOf();
check(all.videoModels?.length === 3 && all.videoModels.find((m) => m.key === 'hailuo').count >= 1, 'portal: lista modela za filter sa brojem');
const onlyH = await leadsOf('?video=hailuo');
const mh = onlyH.leads.find((l) => l.id === lead.leadId);
check(mh && mh.films.length === 1 && mh.films[0].model === 'hailuo', 'filter Hailuo: samo Hailuo video');
check(onlyH.leads.every((l) => l.films.every((f) => f.model === 'hailuo')), 'filter Hailuo: nijedan drugi model');
check((await leadsOf('?video=pika25')).leads.find((l) => l.id === lead.leadId)?.films[0].model === 'pika25', 'filter Pika 2.5');
check((await leadsOf('?video=nepostoji')).leads.length === all.leads.length, 'nepoznat model ne filtrira');

// Stranica kupca (/p/<key>): samo kupčev video.
const kupcevUrl = st.renders[0].film.url;
const page = mine.page?.url ? await send(`${mine.page.url}?preview=1`) : null;
if (page) {
  check(page.text.includes(kupcevUrl), 'stranica kupca ima H3 Flex video');
  check(mine.films.filter((f) => !f.customer).every((f) => !page.text.includes(f.url)), 'stranica kupca nema dodatne videe');
}

// Ponovljen klik ne pravi nove poslove; druga verzija ne pravi dodatne modele ponovo.
const n0 = (await videoJobs()).length;
const again = await send(`${api}/films`, { token: lead.token, n: 1 });
check(again.data.film?.id === st.renders[0].film.id, 'isti render: isti kupčev video');
await sleep(800);
check((await videoJobs()).length === n0, 'bez novih plaćenih poslova');
check((await send(`${api}/renders`, { token: lead.token, tweak: 'make the band thinner' })).status === 200, 'dorada');
const f2 = await send(`${api}/films`, { token: lead.token, n: 2 });
check(f2.status === 201, 'video druge verzije (kupčev model)');
await sleep(800);
const after2 = (await videoJobs()).slice(n0);
check(after2.length === 1 && after2[0].path.includes('pika-h3-flex'), 'druga verzija: samo kupčev model, dodatni samo jednom po upitu');

console.log(`Passed ${checks} three-film checks.`);
