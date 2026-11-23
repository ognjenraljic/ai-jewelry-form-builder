// Samo Pika H3 Flex (Ognjen 23.11.2026): bez FILM_MODELS na Workeru pravi se jedan video po slici, a portal ne pokazuje druge modele
// (ni stare Wan/Seedance videe). Tri modela: three-films-check.mjs uz --var FILM_MODELS:flex,wan3,seedmini.
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
check(jobs.length === 1, `prva slika pokrene jedan video (${jobs.length})`);
check(jobs[0].path.includes('pika/pika-h3-flex/') && jobs[0].body.resolution === '768p' && jobs[0].body.last_frame_image === jobs[0].body.image, 'taj video je Pika H3 Flex, 768p, petlja');
let st;
for (let i = 0; i < 4; i++) { st = (await send(api, null, h)).data; const fid = st.renders[0].film?.id; if (fid) await send(`${api}/films/${fid}`, null, h); }
st = (await send(api, null, h)).data;
check(st.renders[0].film?.status === 'ok', 'kupac vidi gotov video');
const tok = (await (await fetch(`${base}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: { cookie } })).json()).token;
const P = { 'x-portal-token': tok };
const all = await (await fetch(`${base}/api/portal/leads`, { headers: P })).json();
const mine = all.leads.find((l) => l.id === lead.leadId);
check(mine.films.length === 1 && mine.films[0].model === 'flex' && mine.films[0].customer, 'portal: jedan video, Pika H3 Flex');
check(all.videoModels.length === 1 && all.videoModels[0].key === 'flex', 'portal: filter modela ima samo Pika H3 Flex');
check(all.leads.every((l) => l.films.every((f) => f.model === 'flex')), 'portal: nijedan Wan/Seedance video');
console.log(`\n${checks} provjera prošlo`);
