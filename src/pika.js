// Pika API: slika i video kroz jedan ključ. Ključ ostaje u Workeru, kupac dobija gotov fajl iz našeg R2.
// Bez PIKA_API_KEY sve ostaje kao prije (OpenAI/Gemini, bez videa).
const API = 'https://api.dev.pika.art';
const IMAGE_WAIT_MS = 150_000; // manje od STALE_PENDING_MS u workeru
const POLL_MS = 2000;

// Tri video modela po slici (Ognjen 22.11.2026): kupac dobija samo prvi (H3 Flex, najbrži, $0,20), a zlatar u portalu
// vidi sva tri sa oznakom modela, da se uporedi kvalitet za cijenu. Svi kreću od iste slike i završavaju na njoj (petlja):
// dodatni su dva najjeftinija modela sa završnim kadrom, Wan 3.0 480p ($0,33) i Seedance 2.0 Mini 480p ($0,39).
// Hailuo 2.3 Fast i Pika 2.5 su jeftiniji, ali bez završnog kadra; ostaju u katalogu za FILM_MODELS.
// Cijene za 10 s provjerene preko besplatnog Pika quote-a 22.11. (procjena; pravi iznos stiže sa poslom).
// FILM_MODELS (Worker variable, npr. "flex" ili "flex,pika25") bira koji se prave; prvi u listi je uvijek kupčev.
export const FILM_SECONDS = 10;
export const VIDEO_MODELS = {
  flex: { api: 'pika/pika-h3-flex/image-to-video', label: 'Pika H3 Flex', est: 0.2,
    body: (img, prompt) => ({ image: img, last_frame_image: img, prompt, duration: FILM_SECONDS, resolution: '768p', rewrite: false }) },
  wan3: { api: 'alibaba/wan3.0-video/image-to-video', label: 'Wan 3.0', est: 0.325,
    body: (img, prompt) => ({ first_frame_url: img, last_frame_url: img, prompt, duration: FILM_SECONDS, resolution: '480p', ratio: '1:1', audio: false }) },
  seedmini: { api: 'bytedance/seedance-2.0-mini/image-to-video', label: 'Seedance 2.0 Mini', est: 0.388,
    body: (img, prompt) => ({ image_url: img, end_image_url: img, prompt, duration: FILM_SECONDS, resolution: '480p', ratio: '1:1', generate_audio: false }) },
  // Hailuo 2.3 Fast i Pika 2.5 nemaju zadnji kadar: komad se njiše i vraća po promptu, ali šav petlje nije zagarantovan.
  hailuo: { api: 'minimax/hailuo-2.3-fast/image-to-video', label: 'Hailuo 2.3 Fast', est: 0.192,
    body: (img, prompt) => ({ first_frame_image: img, prompt, duration: FILM_SECONDS, resolution: '768p', prompt_optimizer: false }) },
  pika25: { api: 'pika/pika-2.5/image-to-video', label: 'Pika 2.5', est: 0.2,
    body: (img, prompt) => ({ image: img, prompt, duration_s: FILM_SECONDS, resolution: '480p' }) },
};
export const DEFAULT_FILM_MODELS = ['flex', 'wan3', 'seedmini'];
export const filmModels = (env) => {
  const list = String(env.FILM_MODELS || '').split(',').map((x) => x.trim()).filter((x) => VIDEO_MODELS[x]);
  return [...new Set(list.length ? list : DEFAULT_FILM_MODELS)];
};
// Kupčev model (prvi) i dodatni samo za portal.
export const primaryFilm = (env) => filmModels(env)[0];
export const extraFilms = (env) => filmModels(env).slice(1);
// Zapisi u bazi nose API putanju modela; ključ modela se iz nje pronalazi.
export const modelKeyOf = (api) => Object.keys(VIDEO_MODELS).find((k) => VIDEO_MODELS[k].api === api) || null;
export const FILM_API = VIDEO_MODELS.flex.api;
export const FILM_EST_USD = VIDEO_MODELS.flex.est;

export const pikaOn = (env) => !!env.PIKA_API_KEY;
// Slike preko Pike samo kad se izričito uključi (PIKA_IMAGES=1). Ključ sam po sebi pali samo video komada,
// a renderi ostaju na OpenAI/Gemini modelima na kojima su podešeni prompt i provjera broja zuba (16.11.2026).
export const pikaImages = (env) => pikaOn(env) && env.PIKA_IMAGES === '1';
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
export async function startFilm(env, bytes, mime, prompt, key, modelKey = 'flex') {
  const m = VIDEO_MODELS[modelKey] || VIDEO_MODELS.flex;
  const image_url = await upload(env, bytes, mime);
  return submit(env, m.api, m.body(image_url, prompt), key);
}
