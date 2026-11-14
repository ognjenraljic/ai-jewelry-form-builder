// Lokalna provjera toka slika -> film preko lažnog Pika servera, bez troška.
// Pokretanje: node scripts/mock-pika.mjs 8898 film.mp4, pa wrangler dev uz
// --var PIKA_API_KEY:mock-local --var PIKA_BASE:http://127.0.0.1:8898, pa BASE=... PIKA=... node scripts/film-check.mjs
import assert from 'node:assert/strict';

const base = process.env.BASE || 'http://127.0.0.1:8798';
const pika = process.env.PIKA || 'http://127.0.0.1:8898';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'samo lokalno');
let checks = 0;
const check = (value, text) => { assert.ok(value, text); console.log(`OK ${++checks} ${text}`); };
const send = async (path, body, headers = {}) => {
  const multipart = body instanceof FormData;
  const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(!multipart && body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) });
  return { status: res.status, headers: res.headers, data: await res.clone().json().catch(() => null), res };
};
const mock = async () => (await fetch(`${pika}/__log`)).json();
const video = () => mock().then((l) => l.jobs.filter((j) => j.kind === 'video'));

const fd = new FormData();
for (const [k, v] of Object.entries({ formId: 'demo', name: 'Film QA', email: 'film@example.com', phone: '555 010 0010', consent: 'yes', answers: JSON.stringify({ type: 'ring', style: 'other', metal: 'rose-gold', karat: '14K', stones: 'natural', coverage: 'accents', budget: '$1,500 - $2,500' }) })) fd.set(k, v);
const lead = (await send('/api/leads', fd)).data;
check(lead?.leadId, 'upit napravljen');
const api = `/api/leads/${lead.leadId}`;
// Video je po formi (Brand & look → Highlight video): isključen dok ga zlatar ne uključi.
check((await send('/api/forms/demo')).data.film !== true, 'bez podešavanja forma nema dugme za video');
const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: process.env.ADMIN || 'localtest123' }) });
const cookie = login.headers.get('set-cookie').split(';')[0];
const setVideo = async (mode) => {
  const cur = await (await fetch(`${base}/api/admin/forms/demo`, { headers: { cookie } })).json();
  const form = { ...cur.form };
  if (mode) form.highlightVideo = mode; else delete form.highlightVideo;
  const r = await fetch(`${base}/api/admin/forms/demo`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ form, force: true }) });
  assert.equal(r.status, 200, await r.text());
};
check((await send(`${api}/films`, { token: lead.token, n: 1 })).status === 404, 'isključen video se ne može naručiti');
await setVideo('button');
const cfg = await send('/api/forms/demo');
check(cfg.data.film === true, 'dugme za video uključeno u formi');

const r1 = await send(`${api}/renders`, { token: lead.token });
check(r1.status === 200 && r1.data.url, 'prvi render preko Pike');
const logA = await mock();
const img = logA.jobs.filter((j) => j.kind === 'image').pop();
check(img.path.includes('google/gemini-3-pro-image/'), `prvi render ide na Nano Banana Pro (${img.path})`);
check(img.body.prompt.includes('Pure black seamless background'), 'prompt traži crnu filmsku scenu');
check(!JSON.stringify(cfg.data).includes('mock-local'), 'ključ nije u odgovoru forme');

const before = (await video()).length;
check((await send(`${api}/films`, { token: 'wrong', n: 1 })).status === 403, 'tuđi token ne pravi film');
check((await send(`${api}/films`, { token: lead.token, n: 9 })).status === 404, 'nepostojeći render ne pravi film');
check((await video()).length === before, 'odbijeni zahtjevi nisu plaćeni');

const [a, b] = await Promise.all([send(`${api}/films`, { token: lead.token, n: 1 }), send(`${api}/films`, { token: lead.token, n: 1 })]);
check(a.data.film?.id && a.data.film.id === b.data.film?.id, 'dva istovremena klika su jedan film');
check((await video()).length === before + 1, 'plaćen je samo jedan posao');
const job = (await video()).pop();
check(job.path.includes('pika/pika-h3-flex/image-to-video') && job.body.duration === 10 && job.body.resolution === '768p' && job.body.last_frame_image === job.body.image && job.body.rewrite === false, 'H3 Flex, 10 s, 768p, zadnji kadar = prvi');
check(job.body.prompt.includes('The ring slowly rotates') && job.body.prompt.includes('360-degree'), 'prompt okreće komad jednom u krug');

const id = a.data.film.id;
check((await send(`${api}/films/${id}`)).status === 403, 'stanje filma traži token');
const h = { 'x-lead-token': lead.token };
let film = (await send(`${api}/films/${id}`, null, h)).data.film;
check(film.status === 'pending', 'prva provjera: još u toku');
film = (await send(`${api}/films/${id}`, null, h)).data.film;
check(film.status === 'ok' && film.url.endsWith('.mp4'), 'film stigao u R2');

const full = await fetch(base + film.url);
check(full.status === 200 && full.headers.get('content-type') === 'video/mp4' && full.headers.get('accept-ranges') === 'bytes', 'video se servira kao mp4');
const size = (await full.arrayBuffer()).byteLength;
const part = await fetch(base + film.url, { headers: { range: 'bytes=0-99' } });
check(part.status === 206 && part.headers.get('content-range') === `bytes 0-99/${size}` && (await part.arrayBuffer()).byteLength === 100, 'Safari dobija dio fajla (0-99)');
const open = await fetch(base + film.url, { headers: { range: 'bytes=100-' } });
check(open.status === 206 && open.headers.get('content-range') === `bytes 100-${size - 1}/${size}`, 'otvoren raspon radi');

const again = await send(`${api}/films`, { token: lead.token, n: 1 });
check(again.data.film?.id === id, 'isti render ne pravi drugi film');
const restored = (await send(api, null, h)).data;
check(restored.renders[0].film?.url === film.url && restored.renders[0].n === 1, 'poslije osvježavanja film je tu');

// Dorada ne pravi film sama; greška se ne broji, limit je dva filma.
const tw = await send(`${api}/renders`, { token: lead.token, tweak: 'make the stone larger' });
check(tw.status === 200, 'dorada radi');
check((await mock()).jobs.filter((j) => j.kind === 'image').pop().path.includes('gemini-3.1-flash-image/image-to-image'), 'dorada ide na brži model');
await fetch(`${pika}/__fail`, { method: 'POST' });
const f2 = await send(`${api}/films`, { token: lead.token, n: 2 });
await send(`${api}/films/${f2.data.film.id}`, null, h);
const failed = (await send(`${api}/films/${f2.data.film.id}`, null, h)).data.film;
check(failed.status === 'error', 'pad kod Pike se vidi kao greška');
const f3 = await send(`${api}/films`, { token: lead.token, n: 2 });
check(f3.status === 201 && f3.data.film.id !== f2.data.film.id, 'poslije greške film može ponovo');
await send(`${api}/films/${f3.data.film.id}`, null, h);
await send(`${api}/films/${f3.data.film.id}`, null, h);
const tw2 = await send(`${api}/renders`, { token: lead.token, tweak: 'make the band thinner' });
check(tw2.status === 200, 'druga dorada radi');
const over = await send(`${api}/films`, { token: lead.token, n: 3 });
check(over.status === 429, 'treći film je odbijen');

// Samo za zlatara: kupac ne vidi dugme, film se pravi sam poslije prvog rendera.
await setVideo('backend');
check((await send('/api/forms/demo')).data.film !== true, 'backend: kupac nema dugme');
const fd2 = new FormData();
for (const [k, v] of fd.entries()) fd2.set(k, k === 'email' ? 'film2@example.com' : v);
const lead2 = (await send('/api/leads', fd2)).data;
const videosBefore = (await video()).length;
check((await send(`/api/leads/${lead2.leadId}/renders`, { token: lead2.token })).status === 200, 'backend: prvi render');
await new Promise((r) => setTimeout(r, 1500));
check((await video()).length === videosBefore + 1, 'backend: film krenuo sam');
check((await send(`/api/leads/${lead2.leadId}/films`, { token: lead2.token, n: 1 })).status === 404, 'backend: kupac ne može naručiti film');
await setVideo(null);

const log = await mock();
check(new Set(log.keys).size === log.keys.length, 'svaki plaćeni posao ima svoj ključ');
console.log(`Passed ${checks} film checks.`);
