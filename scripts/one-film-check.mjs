// Pika H3 Flex (Ognjen 24.11.2026): bez FILM_MODELS na Workeru prva slika pravi kratki video za formu (6 s) i duži za
// stranicu kupca (sales, 10 s); portal ne pokazuje Wan/Seedance. Tri modela: three-films-check.mjs uz --var FILM_MODELS:flex,wan3,seedmini.
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
const H = { cookie, 'content-type': 'application/json' };
const client = (await (await fetch(`${base}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: `One Film QA ${Date.now()}` }) })).json()).client;
const formId = (await (await fetch(`${base}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) })).json()).form.id;
const cur = await (await fetch(`${base}/api/admin/forms/${formId}`, { headers: { cookie } })).json();
assert.equal((await fetch(`${base}/api/admin/forms/${formId}`, { method: 'PUT', headers: H, body: JSON.stringify({ form: { ...cur.form, highlightVideo: 'auto' }, force: true }) })).status, 200);
const fd = new FormData();
for (const [k, v] of Object.entries({ formId, name: 'One Film QA', email: 'one@example.com', phone: '555 010 0034', consent: 'yes', answers: JSON.stringify({ type: 'ring', style: 'other', metal: 'yellow-gold', karat: '14K', stones: 'natural', coverage: 'accents', budget: '$1,500 - $2,500' }) })) fd.set(k, v);
const lead = (await send('/api/leads', fd)).data;
check(lead?.leadId, 'upit napravljen');
const api = `/api/leads/${lead.leadId}`;
const h = { 'x-lead-token': lead.token };
const before = (await videoJobs()).length;
check((await send(`${api}/renders`, { token: lead.token })).status === 200, 'prvi render');
let jobs = [];
for (let i = 0; i < 20 && !jobs.length; i++) { await sleep(300); jobs = (await videoJobs()).slice(before); }
await sleep(2500);
jobs = (await videoJobs()).slice(before);
// 27.11.2026 (District): samo prvi, kratki video; duži (sales) samo uz FILM_MODELS=flex,sales.
check(jobs.length === 1, `prva slika pokrene jedan video (${jobs.length})`);
check(jobs.every((j) => j.path.includes('pika/pika-h3-flex/image-to-video') && !j.path.includes('#') && j.body.resolution === '768p' && j.body.last_frame_image === j.body.image), 'Pika H3 Flex, 768p, petlja');
check(jobs.map((j) => j.body.duration).join(',') === '6', 'samo kratki 6 s (bez dužeg za stranicu kupca)');
check(/cinematic pan/.test(jobs[0].body.prompt) && /lamp beam/.test(jobs[0].body.prompt), 'prompt je izabrani stil (pan + lampa)');
let st;
for (let i = 0; i < 4; i++) { st = (await send(api, null, h)).data; const fid = st.renders[0].film?.id; if (fid) await send(`${api}/films/${fid}`, null, h); }
st = (await send(api, null, h)).data;
check(st.renders[0].film?.status === 'ok', 'kupac vidi gotov video');
const tok = (await (await fetch(`${base}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: { cookie } })).json()).token;
const P = { 'x-portal-token': tok };
const all = await (await fetch(`${base}/api/portal/leads`, { headers: P })).json();
const mine = all.leads.find((l) => l.id === lead.leadId);
for (let i = 0; i < 6; i++) { await fetch(`${base}/api/portal/leads`, { headers: P }); await sleep(800); }
const all2 = await (await fetch(`${base}/api/portal/leads`, { headers: P })).json();
const mine2 = all2.leads.find((l) => l.id === lead.leadId);
check(mine2.films.length === 1 && mine2.films[0].model === 'flex' && mine2.films[0].customer, 'portal: samo kratki (kupčev) video');
check(all2.leads.every((l) => l.films.every((f) => ['flex', 'sales'].includes(f.model))), 'portal: nijedan Wan/Seedance video');
const salesUrl = mine2.films.find((f) => f.model === 'flex')?.url;
const page = mine2.page?.url;
check(page && salesUrl, 'upit ima stranicu kupca i video');
{
  const html = await (await fetch(`${base}${page}?preview=1`)).text();
  check(html.includes(salesUrl), 'stranica kupca pokazuje kratki video');
}
console.log(`\n${checks} provjera prošlo`);
