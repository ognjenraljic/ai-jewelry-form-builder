// Pika API: slika i video kroz jedan ključ. Ključ ostaje u Workeru, kupac dobija gotov fajl iz našeg R2.
// Bez PIKA_API_KEY sve ostaje kao prije (OpenAI/Gemini, bez videa).
const API = 'https://api.dev.pika.art';
const IMAGE_WAIT_MS = 150_000; // manje od STALE_PENDING_MS u workeru
const POLL_MS = 2000;

export const FILM_API = 'pika/pika-h3-flex/image-to-video';
export const FILM_SECONDS = 10;
export const FILM_RESOLUTION = '768p';
export const FILM_EST_USD = 0.2; // 0,02 $ po sekundi na 768p; trošak se ispravi kad posao stigne

export const pikaOn = (env) => !!env.PIKA_API_KEY;
// Samo lokalno: lažni Pika server za provjere bez troška (scripts/mock-pika.mjs).
const base = (env) => (env.DEV_MODE === '1' && env.PIKA_BASE ? env.PIKA_BASE : API);
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function call(env, path, { method = 'GET', body, key } = {}) {
  const res = await fetch(base(env) + path, {
    method,
    headers: { 'x-api-key': env.PIKA_API_KEY, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...(key ? { 'idempotency-key': key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Pika ${res.status}: ${String(data.message || data.error?.message || 'request failed').slice(0, 200)}`);
  return data;
}

// Pika čita ulazne slike sa svoje adrese: fajl ide na jednokratni link za upload.
async function upload(env, bytes, mime) {
  const u = await call(env, '/v1/media/uploads', { method: 'POST', body: { content_type: mime, size_bytes: bytes.length } });
  const res = await fetch(u.upload_url, { method: 'PUT', body: bytes, headers: u.headers || {} });
  if (!res.ok) throw new Error(`Pika upload ${res.status}`);
  return u.url;
}

const submit = (env, api, body, key = crypto.randomUUID()) => call(env, `/v1/media/${api}`, { method: 'POST', body, key });
export const pikaJob = (env, id) => call(env, `/v1/media/jobs/${encodeURIComponent(id)}`);

export function jobFile(job) {
  const out = job.output || {};
  const f = out.video || out.videos?.[0] || out.image || out.images?.[0] || out;
  return f?.url ? { url: f.url, mime: f.content_type || '' } : null;
}

// Naplata stiže malo poslije kraja posla; null znači da je još nema.
export async function jobCharge(env, job) {
  let j = job;
  for (const ms of [0, 1000, 2000]) {
    if (ms) { await wait(ms); j = await pikaJob(env, job.id); }
    if (j.billing?.state === 'settled') return j.billing.charge_micro_usd / 1e6;
  }
  return null;
}

// images: [{ bytes, mime }]. Bez slika ide text-to-image, sa njima image-to-image.
export async function pikaImage(env, model, prompt, images, mask = null, size = '1024x1024') {
  const body = { prompt, num_images: 1, output_format: 'png' };
  if (model.mask) { body.size = size; body.quality = model.quality; } else { body.aspect_ratio = '1:1'; body.resolution = '1K'; }
  if (images.length) body.image_urls = await Promise.all(images.map((x) => upload(env, x.bytes, x.mime)));
  if (mask) body.mask_image_url = await upload(env, mask, 'image/png');
  let job = await submit(env, `${model.id}/${images.length ? 'image-to-image' : 'text-to-image'}`, body);
  const t0 = Date.now();
  while (job.status !== 'completed' && job.status !== 'failed') {
    if (Date.now() - t0 > IMAGE_WAIT_MS) throw new Error('Pika image timed out');
    await wait(POLL_MS);
    job = await pikaJob(env, job.id);
  }
  if (job.status === 'failed') throw new Error(`Pika image failed: ${job.error?.code || ''} ${job.error?.message || ''}`.trim());
  const file = jobFile(job);
  if (!file) throw new Error('Pika image has no output');
  const res = await fetch(file.url);
  if (!res.ok) throw new Error(`Pika image download ${res.status}`);
  return { buf: await res.arrayBuffer(), mime: file.mime || 'image/png', usage: job.usage || {}, cost: await jobCharge(env, job) };
}

// Video se ne čeka u zahtjevu (nekoliko minuta): vraća se broj posla, a forma ga prati.
// Isti prvi i zadnji kadar: film se vrti u krug bez skoka.
// key je ID filma, pa ponovljen zahtjev ne pravi drugi plaćeni posao.
export async function startFilm(env, bytes, mime, prompt, key) {
  const image_url = await upload(env, bytes, mime);
  return submit(env, FILM_API, { image: image_url, last_frame_image: image_url, prompt, duration: FILM_SECONDS, resolution: FILM_RESOLUTION, rewrite: false }, key);
}
