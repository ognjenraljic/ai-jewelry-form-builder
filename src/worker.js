import { FORMS, TEMPLATES, PIECE_OPTIONS, publicForm, styleOf, optionsOf, validateFormDef, fromTemplate, enabledSteps } from './forms.js';
import { buildPrompt, buildTweakPrompt } from './prompt.js';
import { parseTeeth, teethSummary } from './teeth.js';

// Cijene su procjena (USD po 1M tokena, Gemini API, početak 2026). Provjeriti prije budžeta.
// OpenAI (GPT Image 2.5): tekst $5, ulazna slika $8, izlazna slika $30 po 1M tokena (bez obzira na kvalitet).
const MODELS = {
  flash: { id: 'gemini-2.5-flash-image', label: 'Nano Banana (Flash)', inPerM: 0.3, outPerM: 30 },
  pro: { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', inPerM: 2, outPerM: 120 },
  gptflare: { provider: 'openai', id: 'gpt-image-2.5-flare', label: 'GPT Image 2.5 Flare', inPerM: 5, imgInPerM: 8, outPerM: 30, quality: 'high' },
  gptsun: { provider: 'openai', id: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst', inPerM: 5, imgInPerM: 8, outPerM: 30, quality: 'high' },
  gpt2: { provider: 'openai', id: 'gpt-image-2', label: 'GPT Image 2', inPerM: 5, imgInPerM: 8, outPerM: 30, quality: 'high' },
};

// Model mora imati svoj ključ: bez OPENAI_API_KEY renderi idu na Gemini i obrnuto, umjesto da padaju.
function withKey(env, key, geminiFallback) {
  const openai = MODELS[key].provider === 'openai';
  if (openai && !env.OPENAI_API_KEY && env.GEMINI_API_KEY) return geminiFallback;
  if (!openai && !env.GEMINI_API_KEY && env.OPENAI_API_KEY) return 'gptflare';
  return key;
}
const firstModel = (env) => withKey(env, MODELS[env.FIRST_MODEL] ? env.FIRST_MODEL : 'pro', 'pro');
const tweakModel = (env) => withKey(env, MODELS[env.TWEAK_MODEL] ? env.TWEAK_MODEL : 'flash', 'flash');

const LEADS_PER_IP_HOUR = 10;
const MAX_REF_BYTES = 8 * 1024 * 1024;
const PENDING_WINDOW_MS = 120_000;
const MAX_VERSIONS = 50;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      // builder.<domen>/ otvara builder (lokalno: http://builder.localhost:8797)
      if (url.hostname.startsWith('builder.') && p === '/' && request.method === 'GET') {
        return env.ASSETS.fetch(new Request(new URL('/builder', url), request));
      }
      if (p === '/' && request.method === 'GET') return env.ASSETS.fetch(request);
      if (p.startsWith('/f/') && request.method === 'GET') {
        return env.ASSETS.fetch(new Request(new URL('/form', url), request));
      }
      let m;
      if ((m = p.match(/^\/api\/forms\/([\w-]+)$/)) && request.method === 'GET') return getForm(env, m[1]);
      if (p.startsWith('/api/portal/')) return portalApi(request, env, p);
      if (p === '/api/admin/view-as-log' && request.method === 'GET') return viewAsLog(request, env);
      if ((m = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)\/view-as$/)) && request.method === 'POST') return startViewAs(request, env, m[1]);
      if ((m = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)\/portal-link$/)) && (request.method === 'POST' || request.method === 'DELETE')) return clientLink(request, env, m[1]);
      if (p === '/api/admin/overview' && request.method === 'GET') return adminOverview(request, env);
      if (p === '/api/admin/test-render' && request.method === 'POST') return testRender(request, env);
      if (p.startsWith('/api/admin/clients') && !p.endsWith('/upload')) return adminClients(request, env, p);
      if (p.startsWith('/api/admin/forms') || /^\/api\/admin\/clients\/[a-z0-9-]+\/upload$/.test(p)) return adminForms(request, env, p);
      if (p === '/api/leads' && request.method === 'POST') return createLead(request, env);
      if ((m = p.match(/^\/api\/leads\/([\w-]+)\/renders$/)) && request.method === 'POST') return createRender(request, env, m[1]);
      if (p === '/api/demo-requests' && request.method === 'POST') return createDemoRequest(request, env);
      if (p === '/api/admin/leads' && request.method === 'GET') return adminLeads(request, env);
      if ((m = p.match(/^\/api\/admin\/demo-requests\/([a-z0-9]+)\/handled$/)) && request.method === 'POST') return demoHandled(request, env, m[1]);
      if (p.startsWith('/media/') && request.method === 'GET') return media(request, env, p.slice(7));
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('unhandled', err);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};

// Forma iz D1 (builder), inače ugrađena iz koda. live: arhivirana forma se ne prikazuje kupcima i ne prima upite.
async function loadForm(env, id, { live = false } = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(String(id || ''))) return null;
  const row = await env.DB.prepare('SELECT data, archived_at FROM forms WHERE id = ?').bind(id).first();
  if (row && live && row.archived_at) return null;
  return row ? JSON.parse(row.data) : FORMS[id] || null;
}

async function getForm(env, id) {
  const form = await loadForm(env, id, { live: true });
  if (!form) return json({ error: 'This form is not available.' }, 404);
  const out = publicForm(form);
  if (env.DEV_MODE === '1') {
    const auto = { key: 'auto', label: `Auto (${MODELS[firstModel(env)].label} pa ${MODELS[tweakModel(env)].label})` };
    out.dev = { models: [auto, ...Object.entries(MODELS).map(([k, v]) => ({ key: k, label: v.label }))], defaultModel: 'auto' };
  }
  return json(out);
}

async function createLead(request, env) {
  const fd = await request.formData();
  const form = await loadForm(env, fd.get('formId'), { live: true });
  if (!form) return json({ error: 'This form is not available.' }, 404);

  const name = clean(fd.get('name'), 80);
  const email = clean(fd.get('email'), 120).toLowerCase();
  const phone = clean(fd.get('phone'), 30);
  if (name.length < 2) return json({ error: 'Please enter your name.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'Please enter a valid email.' }, 400);
  if (phone.replace(/\D/g, '').length < 7) return json({ error: 'Please enter a valid phone number.' }, 400);
  if (fd.get('consent') !== 'yes') return json({ error: 'Please accept to be contacted.' }, 400);

  let answers;
  try { answers = JSON.parse(fd.get('answers') || '{}'); } catch { return json({ error: 'Invalid answers.' }, 400); }
  const problem = validateAnswers(form, answers);
  if (problem) return json({ error: problem }, 400);

  // Fajlovi: polje "reference" je inspiracija za AI; ostala upload pitanja i dodatna polja za fajl idu u files.
  const uploads = [];
  for (const f of enabledSteps(form).flatMap((st) => st.fields.filter((x) => x.enabled !== false))) {
    if (f.type === 'upload') uploads.push(f.id);
    if (f.followup === 'file') uploads.push(`${f.id}__more`);
  }
  const incoming = [];
  for (const key of uploads) {
    const file = fd.get(`file_${key}`) || (key === 'reference' ? fd.get('reference') : null);
    if (!file || typeof file !== 'object' || !file.size) continue;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return json({ error: 'Photos must be JPG, PNG or WebP.' }, 400);
    if (file.size > MAX_REF_BYTES) return json({ error: 'A photo is too large (max 8 MB).' }, 400);
    incoming.push([key, file]);
  }
  if (incoming.length > 5) return json({ error: 'Too many photos (max 5).' }, 400);

  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const hourAgo = Date.now() - 3600_000;
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM leads WHERE ip = ? AND created_at > ?').bind(ip, hourAgo).first();
  // Lokalno testiramo skriptama sa jedne adrese, pa je u dev modu limit veći.
  if (n >= (env.DEV_MODE === '1' ? 100 : LEADS_PER_IP_HOUR)) return json({ error: 'Too many requests. Please try again later.' }, 429);

  const id = rid(12);
  const token = rid(24);
  let refKey = null;
  const files = {};
  for (const [key, file] of incoming) {
    const r2 = key === 'reference' ? `refs/${id}.${file.type.split('/')[1]}` : `refs/${id}-${key}.${file.type.split('/')[1]}`;
    await env.MEDIA.put(r2, file.stream(), { httpMetadata: { contentType: file.type } });
    if (key === 'reference') refKey = r2; else files[key] = r2;
  }

  await env.DB.prepare(
    'INSERT INTO leads (id, form_id, token, name, email, phone, answers, ref_key, files, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, form.id, token, name, email, phone, JSON.stringify(answers), refKey, Object.keys(files).length ? JSON.stringify(files) : null, ip, Date.now()).run();

  return json({ leadId: id, token, maxRenders: form.maxRenders });
}

async function createRender(request, env, leadId) {
  const body = await request.json().catch(() => ({}));
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first();
  if (!lead || !body.token || body.token !== lead.token) return json({ error: 'Not allowed.' }, 403);
  const form = await loadForm(env, lead.form_id);
  if (!form) return json({ error: 'Form not found' }, 404);

  const rows = (await env.DB.prepare('SELECT * FROM renders WHERE lead_id = ? ORDER BY created_at').bind(leadId).all()).results;
  const ok = rows.filter((r) => r.status === 'ok');
  if (ok.length >= form.maxRenders) return json({ error: 'You have used all your previews. Our team will follow up with you.' }, 429);
  if (rows.length >= form.maxRenders + 3) return json({ error: 'Preview limit reached. Our team will follow up with you.' }, 429);
  if (rows.some((r) => r.status === 'pending' && Date.now() - r.created_at < PENDING_WINDOW_MS)) {
    return json({ error: 'Your preview is still being created.' }, 409);
  }

  const tweak = clean(body.tweak, 300);
  const isTweak = !!(tweak && ok.length);
  // Označeni dio slike (maska): samo uz doradu; ako stigne a ne može se pročitati, bolje reći nego mijenjati cijelu sliku.
  const mask = isTweak && body.mask ? maskFrom(body.mask) : null;
  if (isTweak && body.mask && !mask) return json({ error: 'We could not read the marked area. Please mark it again.' }, 400);
  // Prvi render ide na jači model (to je trenutak kad kupac odlučuje), dorade na brži i jeftiniji.
  // U dev modu forma može izabrati model ručno radi poređenja.
  const modelKey = env.DEV_MODE === '1' && MODELS[body.model] ? body.model : isTweak ? tweakModel(env) : firstModel(env);
  const model = MODELS[modelKey];
  const answers = JSON.parse(lead.answers);

  // Dorada polazi od rendera koji kupac gleda (base = njegov redni broj), inače od zadnjeg.
  const pick = isTweak ? ok[Number.isInteger(body.base) && body.base >= 1 && body.base <= ok.length ? body.base - 1 : ok.length - 1] : null;
  const base = pick ? await r2Image(env, pick.image_key) : null;
  const ref = !isTweak && lead.ref_key ? await r2Image(env, lead.ref_key) : null;
  const { images, prompt } = await renderInputs(env, request, form, answers, { ref, tweak: isTweak ? tweak : '', base, masked: !!(mask && base) });

  const renderId = rid(12);
  const n = ok.length + 1;
  const tweakNote = tweak ? (mask ? `Marked area: ${tweak}` : tweak) : null;
  await env.DB.prepare('INSERT INTO renders (id, lead_id, n, model, prompt, tweak, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(renderId, leadId, n, model.id, prompt, tweakNote, 'pending', Date.now()).run();

  const t0 = Date.now();
  try {
    const out = await runModel(env, model, prompt, images, base ? mask : null);
    const ext = out.mime.split('/')[1] || 'png';
    const key = `renders/${leadId}/${n}-${rid(8)}.${ext}`;
    await env.MEDIA.put(key, fromB64(out.b64), { httpMetadata: { contentType: out.mime } });
    await env.DB.prepare('UPDATE renders SET status = ?, image_key = ?, ms = ?, in_tokens = ?, out_tokens = ?, cost_usd = ? WHERE id = ?')
      .bind('ok', key, out.ms, out.inT, out.outT, out.cost, renderId).run();
    return json({
      url: `/media/${key}`, n, remaining: form.maxRenders - n,
      ...(env.DEV_MODE === '1' ? { dev: { model: model.label, ms: out.ms, inTokens: out.inT, outTokens: out.outT, costUsd: out.cost, prompt } } : {}),
    });
  } catch (err) {
    const ms = Date.now() - t0;
    console.error('render failed', model.id, err.message);
    await env.DB.prepare('UPDATE renders SET status = ?, error = ?, ms = ? WHERE id = ?').bind('error', String(err.message).slice(0, 500), ms, renderId).run();
    return json({ error: 'We could not create your preview this time. Please try again.', ...(env.DEV_MODE === '1' ? { dev: { error: err.message } } : {}) }, 502);
  }
}

// Ulaz za model: prvi render (slika stila iz biblioteke ili buildera, pa slika kupca) ili dorada (baza + izmjena).
async function renderInputs(env, request, form, answers, { ref = null, tweak = '', base = null, masked = false } = {}) {
  if (tweak && base) return { images: [base], prompt: buildTweakPrompt(tweak, { masked }) };
  const images = [];
  const refs = [];
  const style = styleOf(form, answers);
  // Ugrađeni grillz stilovi govore samo broj zuba; kad kupac izabere tačne zube, njihova slika bi nametnula pogrešan broj.
  const countOnly = answers.type === 'grillz' && ['top6', 'top8', 'set', 'fangs'].includes(answers.style) && parseTeeth(answers.teeth);
  if (style?.image && !countOnly) {
    let img = null;
    if (style.image.startsWith('/media/forms/')) img = await r2Image(env, style.image.slice(7));
    else {
      const res = await env.ASSETS.fetch(new Request(new URL(style.image, request.url)));
      if (res.ok) img = { mime: 'image/webp', b64: toB64(await res.arrayBuffer()) };
    }
    if (img) { images.push(img); refs.push('style'); }
  }
  if (ref) { images.push(ref); refs.push('customer'); }
  return { images, prompt: buildPrompt(form, answers, { refs, style }) };
}

async function r2Image(env, key) {
  const obj = await env.MEDIA.get(key);
  return obj ? { mime: obj.httpMetadata?.contentType || 'image/png', b64: toB64(await obj.arrayBuffer()) } : null;
}

// Maska iz forme: PNG (data URL ili fajl), providno = dio koji se mijenja. Do 2 MB.
function maskFrom(v) {
  let bytes;
  try {
    if (typeof v === 'string') {
      const m = v.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
      if (!m || m[1].length > 2_800_000) return null;
      bytes = fromB64(m[1]);
    } else if (v instanceof Uint8Array) bytes = v;
    else return null;
  } catch { return null; }
  const png = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return png && bytes.length <= 2 * 1024 * 1024 ? bytes : null;
}

// Poziv modela + trošak iz potrošnje tokena (cijene u MODELS).
async function runModel(env, model, prompt, images, mask = null) {
  const t0 = Date.now();
  const out = model.provider === 'openai' ? await openaiImage(env, model, prompt, images, mask) : await gemini(env, model.id, prompt, images);
  const inT = out.usage.promptTokenCount ?? out.usage.input_tokens ?? 0;
  const outT = out.usage.candidatesTokenCount ?? out.usage.output_tokens ?? 0;
  const imgIn = out.usage.input_tokens_details?.image_tokens || 0;
  const cost = ((inT - imgIn) * model.inPerM + imgIn * (model.imgInPerM || model.inPerM) + outT * model.outPerM) / 1e6;
  return { ...out, ms: Date.now() - t0, inT, outT, cost };
}

// Probni render iz buildera: nacrt forme i odgovori iz pregleda, bez upita (lead). Trošak se bilježi u test_renders.
async function testRender(request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Not allowed.' }, 403);
  const fd = await request.formData();
  let form;
  let answers;
  try { form = JSON.parse(fd.get('form')); answers = JSON.parse(fd.get('answers') || '{}'); } catch { return json({ error: 'Invalid form.' }, 400); }
  try { validateFormDef(form, form?.id); } catch (e) { return json({ error: e.message }, 400); }
  const problem = validateAnswers(form, answers);
  if (problem) return json({ error: `${problem} Go through the steps in the preview first.` }, 400);

  const tweak = clean(fd.get('tweak'), 300);
  let base = null;
  if (tweak) {
    const key = String(fd.get('base') || '');
    if (!/^tests\/[\w./-]+$/.test(key) || key.includes('..')) return json({ error: 'Make a test render first.' }, 400);
    base = await r2Image(env, key);
    if (!base) return json({ error: 'Test render not found.' }, 404);
  }
  const maskFile = fd.get('mask');
  const mask = base && maskFile && typeof maskFile === 'object' ? maskFrom(new Uint8Array(await maskFile.arrayBuffer())) : null;
  if (base && maskFile && !mask) return json({ error: 'The marked area could not be read.' }, 400);
  const refFile = fd.get('reference');
  let ref = null;
  if (!tweak && refFile && typeof refFile === 'object' && refFile.size) {
    if (!/^image\/(jpeg|png|webp)$/.test(refFile.type) || refFile.size > MAX_REF_BYTES) return json({ error: 'Photo must be JPG, PNG or WebP, max 8 MB.' }, 400);
    ref = { mime: refFile.type, b64: toB64(await refFile.arrayBuffer()) };
  }

  const model = MODELS[tweak ? tweakModel(env) : firstModel(env)];
  const { images, prompt } = await renderInputs(env, request, form, answers, { ref, tweak, base, masked: !!mask });
  const id = rid(12);
  const now = Date.now();
  const note = tweak ? (mask ? `Marked area: ${tweak}` : tweak) : null;
  try {
    const out = await runModel(env, model, prompt, images, mask);
    const key = `tests/${form.id}/${rid(10)}.${out.mime.split('/')[1] || 'png'}`;
    await env.MEDIA.put(key, fromB64(out.b64), { httpMetadata: { contentType: out.mime } });
    await env.DB.prepare('INSERT INTO test_renders (id, form_id, model, prompt, tweak, image_key, status, ms, in_tokens, out_tokens, cost_usd, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, form.id, model.id, prompt, note, key, 'ok', out.ms, out.inT, out.outT, out.cost, now).run();
    return json({ url: `/media/${key}`, key, model: model.label, ms: out.ms, costUsd: out.cost, prompt });
  } catch (err) {
    console.error('test render failed', model.id, err.message);
    await env.DB.prepare('INSERT INTO test_renders (id, form_id, model, prompt, tweak, status, error, ms, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(id, form.id, model.id, prompt, note, 'error', String(err.message).slice(0, 500), Date.now() - now, now).run();
    return json({ error: `Render failed: ${err.message}` }, 502);
  }
}

// OpenAI Image API: sa referencama /v1/images/edits (multipart, redom kao u promptu), bez njih /v1/images/generations.
// Maska ide uz prvu sliku (bazu): providni pikseli su dio koji model smije mijenjati.
async function openaiImage(env, model, prompt, images, mask = null) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY nije postavljen');
  const headers = { authorization: `Bearer ${env.OPENAI_API_KEY}` };
  // Samo lokalno: lažni OpenAI server za provjere bez troška (scripts/mask-check.mjs).
  const api = env.DEV_MODE === '1' && env.OPENAI_BASE ? env.OPENAI_BASE : 'https://api.openai.com';
  let res;
  if (images.length) {
    const fd = new FormData();
    fd.set('model', model.id);
    fd.set('prompt', prompt);
    fd.set('size', '1024x1024');
    fd.set('quality', model.quality || 'high');
    fd.set('output_format', 'jpeg');
    images.forEach((img, i) => fd.append('image[]', new Blob([fromB64(img.b64)], { type: img.mime }), `ref-${i + 1}.${img.mime.split('/')[1] || 'png'}`));
    if (mask) fd.set('mask', new Blob([mask], { type: 'image/png' }), 'mask.png');
    res = await fetch(`${api}/v1/images/edits`, { method: 'POST', headers, body: fd });
  } else {
    res = await fetch(`${api}/v1/images/generations`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ model: model.id, prompt, size: '1024x1024', quality: model.quality || 'high', output_format: 'jpeg' }),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${data.error?.message || 'nepoznata greška'}`);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI nije vratio sliku');
  return { b64, mime: 'image/jpeg', usage: data.usage || {} };
}

async function gemini(env, modelId, prompt, images) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY nije postavljen');
  const parts = images.map((img) => ({ inline_data: { mime_type: img.mime, data: img.b64 } }));
  parts.push({ text: prompt });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message || 'nepoznata greška'}`);
  const cand = data.candidates?.[0];
  const outParts = cand?.content?.parts || [];
  const img = outParts.find((x) => x.inlineData || x.inline_data);
  if (!img) {
    const text = outParts.find((x) => x.text)?.text || '';
    throw new Error(`Model nije vratio sliku (${cand?.finishReason || data.promptFeedback?.blockReason || 'bez razloga'}) ${text.slice(0, 200)}`);
  }
  const d = img.inlineData || img.inline_data;
  return { b64: d.data, mime: d.mimeType || d.mime_type || 'image/png', usage: data.usageMetadata || {} };
}

// Zahtjev za demo sa JewelryLead sajta (zlatar koji želi platformu, ne kupac nakita).
async function createDemoRequest(request, env) {
  const b = await request.json().catch(() => ({}));
  if (b.company) return json({ ok: true }); // honeypot: botovi popune skriveno polje
  const name = clean(b.name, 80);
  const email = clean(b.email, 120).toLowerCase();
  const website = clean(b.website, 200);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || website.length < 4) {
    return json({ error: 'Please add your name, a valid email and your store website.' }, 400);
  }
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM demo_requests WHERE ip = ? AND created_at > ?').bind(ip, Date.now() - 3600_000).first();
  if (n >= (env.DEV_MODE === '1' ? 50 : 5)) return json({ error: 'Too many requests. Please try again later.' }, 429);
  await env.DB.prepare('INSERT INTO demo_requests (id, name, email, website, platform, volume, ip, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(rid(12), name, email, website, clean(b.platform, 40), clean(b.volume, 40), ip, Date.now()).run();
  return json({ ok: true });
}

// ---------- Builder API (samo admin token) ----------
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const slugify = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36);

async function uniqueId(env, table, base) {
  let id = base || 'item';
  for (let i = 2; await env.DB.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).bind(id).first() || (table === 'forms' && FORMS[id]); i++) id = `${base}-${i}`;
  return id;
}

async function adminForms(request, env, p) {
  if (!isAdmin(request, env)) return json({ error: 'Not allowed.' }, 403);
  const method = request.method;
  let m;

  // Sve odjednom za builder: klijenti, forme (grupisane po client_id) i šabloni.
  if (p === '/api/admin/forms' && method === 'GET') {
    const clients = (await env.DB.prepare('SELECT id, name, data, created_at, archived_at FROM clients ORDER BY name').all()).results.map((c) => ({ id: c.id, name: c.name, ...JSON.parse(c.data || '{}'), archivedAt: c.archived_at || null }));
    const rows = (await env.DB.prepare('SELECT id, data, client_id, template, updated_at, archived_at FROM forms ORDER BY updated_at DESC').all()).results;
    const forms = rows.map((r) => { const d = JSON.parse(r.data); return { id: r.id, name: d.name || d.brand?.name || r.id, clientId: r.client_id || d.clientId || null, template: r.template || d.template || null, updated_at: r.updated_at, archivedAt: r.archived_at || null }; });
    for (const [id, f] of Object.entries(FORMS)) if (!forms.some((x) => x.id === id)) forms.push({ id, name: f.name, clientId: null, template: f.template, builtin: true });
    const templates = Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, description: t.description }));
    return json({ clients, forms, templates, pieces: PIECE_OPTIONS });
  }

  // Nova forma: iz šablona za klijenta, ili kopija postojeće forme.
  if (p === '/api/admin/forms' && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const client = b.clientId ? await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(b.clientId).first() : null;
    if (!client) return json({ error: 'Pick a client first' }, 400);
    const cdata = JSON.parse(client.data || '{}');
    const id = b.id ? String(b.id).trim().toLowerCase() : await uniqueId(env, 'forms', `${client.id}-${slugify(b.piece || b.template || 'form')}`);
    if (!SLUG_RE.test(id)) return json({ error: 'ID: lowercase letters, numbers and dashes (e.g. northstar-grillz)' }, 400);
    if ((await env.DB.prepare('SELECT 1 FROM forms WHERE id = ?').bind(id).first()) || FORMS[id]) return json({ error: 'A form with this ID already exists' }, 409);
    let form;
    if (b.copyFrom) {
      const src = await loadForm(env, b.copyFrom);
      if (!src) return json({ error: 'Form to copy not found' }, 404);
      form = { ...structuredClone(src), id, clientId: client.id, name: clean(b.name, 80) || `${src.name} (copy)` };
    } else {
      if (!TEMPLATES[b.template]) return json({ error: 'Pick a template' }, 400);
      const piece = b.piece ? String(b.piece) : null;
      if (piece && (b.template !== 'custom-enquiry' || !PIECE_OPTIONS.some((o) => o.value === piece))) return json({ error: 'Pick a piece' }, 400);
      form = fromTemplate(b.template, { id, brand: client.name, name: clean(b.name, 80), clientId: client.id, logo: cdata.logo, piece });
    }
    try { validateFormDef(form, id); } catch (e) { return json({ error: e.message }, 400); }
    await env.DB.prepare('INSERT INTO forms (id, data, client_id, template, updated_at) VALUES (?,?,?,?,?)').bind(id, JSON.stringify(form), client.id, form.template || null, Date.now()).run();
    return json({ form });
  }

  if ((m = p.match(/^\/api\/admin\/forms\/([a-z0-9-]+)$/))) {
    const id = m[1];
    if (method === 'GET') {
      const form = await loadForm(env, id);
      return form ? json({ form }) : json({ error: 'Form not found' }, 404);
    }
    if (method === 'PUT') {
      const raw = await request.text();
      if (raw.length > 300_000) return json({ error: 'Form is too large' }, 413);
      let form;
      try { form = JSON.parse(raw).form; } catch { return json({ error: 'Invalid JSON' }, 400); }
      try { validateFormDef(form, id); } catch (e) { return json({ error: e.message }, 400); }
      if (form.clientId && !(await env.DB.prepare('SELECT 1 FROM clients WHERE id = ?').bind(form.clientId).first())) return json({ error: 'Client not found' }, 400);
      const data = JSON.stringify(form);
      const now = Date.now();
      // Istorija: verzija prije ovog čuvanja (prvo čuvanje ugrađene forme čuva verziju iz koda).
      const prev = await env.DB.prepare('SELECT data, updated_at FROM forms WHERE id = ?').bind(id).first();
      const old = prev ? prev.data : FORMS[id] ? JSON.stringify(FORMS[id]) : null;
      const batch = [];
      if (old && old !== data) {
        batch.push(env.DB.prepare('INSERT INTO form_versions (id, form_id, data, saved_at) VALUES (?,?,?,?)').bind(rid(12), id, old, prev?.updated_at || 0));
        batch.push(env.DB.prepare('DELETE FROM form_versions WHERE form_id = ? AND id NOT IN (SELECT id FROM form_versions WHERE form_id = ? ORDER BY saved_at DESC LIMIT ?)').bind(id, id, MAX_VERSIONS));
      }
      batch.push(env.DB.prepare('INSERT INTO forms (id, data, client_id, template, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, client_id = excluded.client_id, template = excluded.template, updated_at = excluded.updated_at')
        .bind(id, data, form.clientId || null, form.template || null, now));
      await env.DB.batch(batch);
      return json({ ok: true, updated_at: now });
    }
  }

  // Istorija verzija: lista (sa redom koraka, da se vidi šta se mijenjalo) i jedna verzija za vraćanje u builder.
  if ((m = p.match(/^\/api\/admin\/forms\/([a-z0-9-]+)\/versions$/)) && method === 'GET') {
    const rows = (await env.DB.prepare('SELECT id, data, saved_at FROM form_versions WHERE form_id = ? ORDER BY saved_at DESC').bind(m[1]).all()).results;
    return json({
      versions: rows.map((r) => {
        const d = JSON.parse(r.data);
        return { id: r.id, savedAt: r.saved_at, name: d.name, steps: (d.steps || []).map((s) => `${s.label || s.title || s.id}${s.enabled === false ? ' (off)' : ''}`) };
      }),
    });
  }
  if ((m = p.match(/^\/api\/admin\/forms\/([a-z0-9-]+)\/versions\/([a-z0-9]+)$/)) && method === 'GET') {
    const r = await env.DB.prepare('SELECT data FROM form_versions WHERE form_id = ? AND id = ?').bind(m[1], m[2]).first();
    return r ? json({ form: JSON.parse(r.data) }) : json({ error: 'Version not found' }, 404);
  }

  // Arhiva forme: sakrivena iz pregleda i ne prima nove upite. Vraća se istim putem.
  if ((m = p.match(/^\/api\/admin\/forms\/([a-z0-9-]+)\/archive$/)) && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const r = await env.DB.prepare('UPDATE forms SET archived_at = ? WHERE id = ?').bind(b.archived === false ? null : Date.now(), m[1]).run();
    if (!r.meta.changes) return json({ error: FORMS[m[1]] ? 'Save the built-in demo once before archiving it.' : 'Form not found' }, 404);
    return json({ ok: true });
  }

  // Slika stila, opcije ili logo forme. Browser je već smanji; ovdje samo tip i veličina.
  if ((m = p.match(/^\/api\/admin\/(forms|clients)\/([a-z0-9-]+)\/upload$/)) && method === 'POST') {
    const fd = await request.formData();
    const file = fd.get('file');
    // Bez SVG-a: servira se sa našeg domena, a SVG može nositi skriptu.
    if (!file || typeof file !== 'object' || !/^image\/(jpeg|png|webp)$/.test(file.type)) return json({ error: 'Image must be JPG, PNG or WebP' }, 400);
    if (file.size > 5 * 1024 * 1024) return json({ error: 'Image is too large (max 5 MB)' }, 400);
    const ext = file.type.split('/')[1];
    const key = `${m[1]}/${m[2]}/${rid(10)}.${ext}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    return json({ url: `/media/${key}` });
  }
  return json({ error: 'Not found' }, 404);
}

// Klijenti (zlatari): ime, sajt, logo (podrazumijevani za nove forme), napomene.
async function adminClients(request, env, p) {
  if (!isAdmin(request, env)) return json({ error: 'Not allowed.' }, 403);
  const method = request.method;
  const body = method === 'GET' ? {} : await request.json().catch(() => ({}));
  const data = () => {
    const d = { website: clean(body.website, 200), notes: String(body.notes ?? '').slice(0, 2000), logo: clean(body.logo, 200) };
    if (d.logo && !d.logo.startsWith('/media/clients/')) throw new Error('Logo must be uploaded here');
    return d;
  };
  const name = clean(body.name, 60);
  try {
    if (p === '/api/admin/clients' && method === 'POST') {
      if (name.length < 2) return json({ error: 'Client name is required' }, 400);
      const id = await uniqueId(env, 'clients', slugify(body.id || name) || 'client');
      await env.DB.prepare('INSERT INTO clients (id, name, data, created_at) VALUES (?,?,?,?)').bind(id, name, JSON.stringify(data()), Date.now()).run();
      return json({ client: { id, name, ...data() } });
    }
    // Arhiva klijenta: arhivira i njegove aktivne forme (isto vrijeme) i gasi portal link. Vraćanje vraća te forme.
    const a = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)\/archive$/);
    if (a && method === 'POST') {
      const c = await env.DB.prepare('SELECT id, archived_at FROM clients WHERE id = ?').bind(a[1]).first();
      if (!c) return json({ error: 'Client not found' }, 404);
      if (body.archived === false) {
        await env.DB.batch([
          env.DB.prepare('UPDATE clients SET archived_at = NULL WHERE id = ?').bind(c.id),
          env.DB.prepare('UPDATE forms SET archived_at = NULL WHERE client_id = ? AND archived_at = ?').bind(c.id, c.archived_at || -1),
        ]);
      } else if (!c.archived_at) {
        const now = Date.now();
        await env.DB.batch([
          env.DB.prepare('UPDATE clients SET archived_at = ? WHERE id = ?').bind(now, c.id),
          env.DB.prepare('UPDATE forms SET archived_at = ? WHERE client_id = ? AND archived_at IS NULL').bind(now, c.id),
          env.DB.prepare("UPDATE portal_sessions SET ended_at = ? WHERE client_id = ? AND kind = 'client' AND ended_at IS NULL").bind(now, c.id),
        ]);
      }
      return json({ ok: true });
    }
    const m = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)$/);
    if (m && method === 'PUT') {
      if (name.length < 2) return json({ error: 'Client name is required' }, 400);
      const r = await env.DB.prepare('UPDATE clients SET name = ?, data = ? WHERE id = ?').bind(name, JSON.stringify(data()), m[1]).run();
      if (!r.meta.changes) return json({ error: 'Client not found' }, 404);
      return json({ ok: true });
    }
  } catch (e) {
    return json({ error: e.message }, 400);
  }
  return json({ error: 'Not found' }, 404);
}

// ---------- View as client + portal klijenta ----------
const VIEW_AS_MS = 60 * 60 * 1000;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Admin otvara portal klijenta: kratka sesija samo za tog klijenta, upisana u log.
async function startViewAs(request, env, clientId) {
  if (!isAdmin(request, env)) return json({ error: 'Not allowed.' }, 403);
  const client = await env.DB.prepare('SELECT id, name FROM clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Client not found' }, 404);
  const token = rid(40);
  const now = Date.now();
  await env.DB.prepare('INSERT INTO portal_sessions (id, token_hash, client_id, kind, ip, started_at, expires_at) VALUES (?,?,?,?,?,?,?)')
    .bind(rid(12), await sha256(token), client.id, 'view-as', request.headers.get('cf-connecting-ip') || 'local', now, now + VIEW_AS_MS).run();
  return json({ token, expiresAt: now + VIEW_AS_MS, client });
}

async function viewAsLog(request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Not allowed.' }, 403);
  const rows = (await env.DB.prepare("SELECT s.client_id, c.name, s.kind, s.started_at, s.expires_at, s.ended_at FROM portal_sessions s LEFT JOIN clients c ON c.id = s.client_id WHERE s.kind = 'view-as' ORDER BY s.started_at DESC LIMIT 50").all()).results;
  return json({ sessions: rows });
}

// Stalni link klijenta za njegov portal (bez lozinke). Novi link gasi stari, DELETE gasi link.
// Čuvamo samo hash, pa se link vidi samo jednom, kad se napravi.
const CLIENT_LINK_MS = 365 * 86400_000;
async function clientLink(request, env, clientId) {
  if (!isAdmin(request, env)) return json({ error: 'Not allowed.' }, 403);
  const client = await env.DB.prepare('SELECT id, name FROM clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Client not found' }, 404);
  const now = Date.now();
  await env.DB.prepare("UPDATE portal_sessions SET ended_at = ? WHERE client_id = ? AND kind = 'client' AND ended_at IS NULL").bind(now, client.id).run();
  if (request.method === 'DELETE') return json({ ok: true });
  const token = rid(40);
  await env.DB.prepare('INSERT INTO portal_sessions (id, token_hash, client_id, kind, ip, started_at, expires_at) VALUES (?,?,?,?,?,?,?)')
    .bind(rid(12), await sha256(token), client.id, 'client', request.headers.get('cf-connecting-ip') || 'local', now, now + CLIENT_LINK_MS).run();
  const origin = new URL(request.url).origin.replace('//builder.', '//');
  return json({ url: `${origin}/portal#k=${token}`, createdAt: now, expiresAt: now + CLIENT_LINK_MS });
}

// Pregled svih formi za builder: upiti, renderi, zadnji upit i trošak po formi, plus aktivni linkovi klijenata.
async function adminOverview(request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Not allowed.' }, 403);
  const [leads, renders, links, tests] = await env.DB.batch([
    env.DB.prepare('SELECT form_id, COUNT(*) AS leads, MAX(created_at) AS last_lead FROM leads GROUP BY form_id'),
    env.DB.prepare("SELECT l.form_id, SUM(CASE WHEN r.status = 'ok' THEN 1 ELSE 0 END) AS renders, SUM(r.cost_usd) AS cost FROM renders r JOIN leads l ON l.id = r.lead_id GROUP BY l.form_id"),
    env.DB.prepare("SELECT client_id, MAX(started_at) AS created_at FROM portal_sessions WHERE kind = 'client' AND ended_at IS NULL AND expires_at > ? GROUP BY client_id").bind(Date.now()),
    env.DB.prepare("SELECT form_id, COUNT(*) AS tests, SUM(cost_usd) AS cost FROM test_renders WHERE status = 'ok' GROUP BY form_id"),
  ]);
  const stats = {};
  const row = (id) => (stats[id] ||= { leads: 0, renders: 0, cost: 0, lastLead: null, tests: 0, testCost: 0 });
  for (const r of leads.results) Object.assign(row(r.form_id), { leads: r.leads, lastLead: r.last_lead });
  for (const r of renders.results) Object.assign(row(r.form_id), { renders: r.renders || 0, cost: r.cost || 0 });
  // Probni renderi iz buildera su pravi trošak: ulaze u ukupno, a posebno se vidi koliko je na njih otišlo.
  for (const r of tests.results) { const x = row(r.form_id); x.tests = r.tests; x.testCost = r.cost || 0; x.cost += r.cost || 0; }
  return json({ stats, links: Object.fromEntries(links.results.map((r) => [r.client_id, { createdAt: r.created_at }])) });
}

// Token iz zaglavlja (fetch) ili ?t= (slike u <img>, koje ne mogu slati zaglavlja).
async function portalSession(request, env) {
  const token = request.headers.get('x-portal-token') || new URL(request.url).searchParams.get('t');
  if (!token || token.length < 20) return null;
  const s = await env.DB.prepare('SELECT * FROM portal_sessions WHERE token_hash = ?').bind(await sha256(token)).first();
  if (!s || s.ended_at || s.expires_at < Date.now()) return null;
  return s;
}

// Odgovori kao "pitanje: odgovor" po definiciji forme (natpisi, ne ID-jevi).
function leadDetails(form, a) {
  const out = [];
  for (const st of form?.steps || []) {
    for (const f of st.fields) {
      if (f.type === 'upload' || f.id === 'vision') continue;
      const v = a[f.id];
      if (v == null || v === '') continue;
      const o = (optionsOf(f, a, form) || []).find((x) => x.value === v);
      const more = a[`${f.id}__more`];
      out.push({ label: f.label || st.label || f.id, value: `${o ? o.label : f.type === 'teeth' ? teethSummary(v) : v}${more ? ` · "${more}"` : ''}` });
    }
  }
  return out;
}

async function portalApi(request, env, p) {
  const sess = await portalSession(request, env);
  if (!sess) return json({ error: 'Session expired. Open the portal again.' }, 401);
  const client = await env.DB.prepare('SELECT id, name, data FROM clients WHERE id = ?').bind(sess.client_id).first();
  if (!client) return json({ error: 'Client not found' }, 404);

  // Admin zatvara svoj pregled. Klijentov link se ovdje ne gasi (odjava samo briše token u browseru).
  if (p === '/api/portal/exit' && request.method === 'POST') {
    if (sess.kind === 'view-as') await env.DB.prepare('UPDATE portal_sessions SET ended_at = ? WHERE id = ?').bind(Date.now(), sess.id).run();
    return json({ ok: true });
  }
  const formRows = (await env.DB.prepare('SELECT id, data, template, updated_at, archived_at FROM forms WHERE client_id = ? ORDER BY updated_at DESC').bind(client.id).all()).results;
  const forms = Object.fromEntries(formRows.map((r) => [r.id, JSON.parse(r.data)]));

  if (p === '/api/portal/me' && request.method === 'GET') {
    const d = JSON.parse(client.data || '{}');
    const stats = await env.DB.prepare(`SELECT COUNT(DISTINCT l.id) AS leads, COUNT(r.id) AS renders, COUNT(DISTINCT CASE WHEN l.created_at > ? THEN l.id END) AS recent
      FROM leads l JOIN forms f ON f.id = l.form_id LEFT JOIN renders r ON r.lead_id = l.id AND r.status = 'ok' WHERE f.client_id = ?`).bind(Date.now() - 30 * 86400_000, client.id).first();
    // Po formi: upiti, renderi i zadnji upit. Trošak AI-ja klijent ne vidi (samo admin).
    const per = Object.fromEntries((await env.DB.prepare(`SELECT l.form_id, COUNT(DISTINCT l.id) AS leads, COUNT(r.id) AS renders, MAX(l.created_at) AS last_lead
      FROM leads l JOIN forms f ON f.id = l.form_id LEFT JOIN renders r ON r.lead_id = l.id AND r.status = 'ok' WHERE f.client_id = ? GROUP BY l.form_id`).bind(client.id).all()).results.map((r) => [r.form_id, r]));
    return json({
      session: { kind: sess.kind, expiresAt: sess.expires_at },
      client: { id: client.id, name: client.name, logo: d.logo || null, website: d.website || '' },
      forms: formRows.filter((r) => !r.archived_at).map((r) => ({
        id: r.id, name: forms[r.id].name, template: r.template, label: TEMPLATES[r.template]?.label || 'Custom', updated_at: r.updated_at,
        leads: per[r.id]?.leads || 0, renders: per[r.id]?.renders || 0, lastLead: per[r.id]?.last_lead || null,
      })),
      stats: { leads: stats?.leads || 0, renders: stats?.renders || 0, recent: stats?.recent || 0 },
    });
  }
  if (p === '/api/portal/leads' && request.method === 'GET') {
    const ids = Object.keys(forms);
    if (!ids.length) return json({ leads: [] });
    const marks = ids.map(() => '?').join(',');
    const leads = (await env.DB.prepare(`SELECT id, form_id, name, email, phone, answers, ref_key, files, created_at FROM leads WHERE form_id IN (${marks}) ORDER BY created_at DESC LIMIT 200`).bind(...ids).all()).results;
    const lids = leads.map((l) => l.id);
    const renders = lids.length
      ? (await env.DB.prepare(`SELECT lead_id, n, image_key, tweak FROM renders WHERE status = 'ok' AND lead_id IN (${lids.map(() => '?').join(',')}) ORDER BY created_at`).bind(...lids).all()).results
      : [];
    return json({
      leads: leads.map((l) => {
        const a = JSON.parse(l.answers);
        let files = {};
        try { files = JSON.parse(l.files || '{}'); } catch {}
        return {
          id: l.id, formId: l.form_id, form: forms[l.form_id]?.name || l.form_id, name: l.name, email: l.email, phone: l.phone, created_at: l.created_at,
          vision: a.vision || '', details: leadDetails(forms[l.form_id], a),
          photos: [...(l.ref_key ? [{ label: 'Inspiration', key: l.ref_key }] : []), ...Object.entries(files).map(([k, key]) => ({ label: k.replace(/__more$/, ' (extra)').replace(/_/g, ' '), key }))],
          renders: renders.filter((r) => r.lead_id === l.id).map((r) => ({ url: `/media/${r.image_key}`, tweak: r.tweak })),
        };
      }),
    });
  }
  return json({ error: 'Not found' }, 404);
}

async function demoHandled(request, env, id) {
  if (!isAdmin(request, env)) return json({ error: 'Not allowed.' }, 403);
  const b = await request.json().catch(() => ({}));
  const r = await env.DB.prepare('UPDATE demo_requests SET handled_at = ? WHERE id = ?').bind(b.handled === false ? null : Date.now(), id).run();
  return r.meta.changes ? json({ ok: true }) : json({ error: 'Not found' }, 404);
}

async function adminLeads(request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Not allowed.' }, 403);
  const leads = (await env.DB.prepare('SELECT id, form_id, name, email, phone, answers, ref_key, files, created_at FROM leads ORDER BY created_at DESC LIMIT 200').all()).results;
  const renders = (await env.DB.prepare('SELECT lead_id, n, model, tweak, image_key, status, error, ms, in_tokens, out_tokens, cost_usd, created_at FROM renders ORDER BY created_at').all()).results;
  const byLead = {};
  for (const r of renders) (byLead[r.lead_id] ||= []).push(r);
  const totals = renders.reduce(
    (t, r) => ({ renders: t.renders + (r.status === 'ok' ? 1 : 0), errors: t.errors + (r.status === 'error' ? 1 : 0), cost: t.cost + (r.cost_usd || 0) }),
    { renders: 0, errors: 0, cost: 0 }
  );
  const demos = (await env.DB.prepare('SELECT id, name, email, website, platform, volume, created_at, handled_at FROM demo_requests ORDER BY created_at DESC LIMIT 200').all()).results;
  const tests = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(cost_usd) AS cost FROM test_renders WHERE status = 'ok'").first();
  return json({
    demos,
    totals: { leads: leads.length, ...totals, tests: tests?.n || 0, testCost: tests?.cost || 0 },
    leads: leads.map((l) => ({ ...l, answers: JSON.parse(l.answers), renders: byLead[l.id] || [] })),
  });
}

async function media(request, env, key) {
  if (!/^(renders|refs|forms|clients|tests)\/[\w./-]+$/.test(key) || key.includes('..')) return json({ error: 'Not found' }, 404);
  // Renderi su javni preko nepogodivog ključa; referentne slike kupaca vidi samo admin.
  if (key.startsWith('refs/') && !isAdmin(request, env)) {
    const sess = await portalSession(request, env);
    const leadId = key.slice(5).split(/[.-]/)[0];
    const owner = sess && (await env.DB.prepare('SELECT f.client_id FROM leads l JOIN forms f ON f.id = l.form_id WHERE l.id = ?').bind(leadId).first());
    if (!owner || owner.client_id !== sess.client_id) return json({ error: 'Not allowed.' }, 403);
  }
  const obj = await env.MEDIA.get(key);
  if (!obj) return json({ error: 'Not found' }, 404);
  return new Response(obj.body, {
    headers: { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' },
  });
}

function isAdmin(request, env) {
  const url = new URL(request.url);
  const given = request.headers.get('x-admin-token') || url.searchParams.get('k');
  return Boolean(env.ADMIN_TOKEN) && given === env.ADMIN_TOKEN;
}

// Provjera i čišćenje odgovora: isključeni koraci i pitanja se brišu, podrazumijevane vrijednosti se upisuju.
function validateAnswers(form, a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return 'Invalid answers.';
  const on = new Map();
  for (const st of form.steps || []) {
    for (const f of st.fields) {
      if (f.default != null && (st.enabled === false || a[f.id] == null || a[f.id] === '')) a[f.id] = f.default;
      if (st.enabled !== false && f.enabled !== false) on.set(f.id, f);
      else if (f.default == null) { delete a[f.id]; delete a[`${f.id}__more`]; }
    }
  }
  for (const k of Object.keys(a)) {
    const base = k.endsWith('__more') ? k.slice(0, -6) : k;
    const f = on.get(base) || (form.steps || []).flatMap((st) => st.fields).find((x) => x.id === base && x.default != null);
    if (!f) { delete a[k]; continue; }
    if (k !== base) {
      if (f.followup !== 'text' || typeof a[k] !== 'string' || a[k].length > 500) return 'Invalid answer.';
    }
  }
  for (const f of on.values()) {
    if (f.type === 'upload') continue;
    if (!visible(f, a)) { delete a[f.id]; delete a[`${f.id}__more`]; continue; }
    const v = a[f.id];
    if (f.required && (v == null || v === '')) return `Please complete: ${f.label || f.id}`;
    if (v == null || v === '') continue;
    if (typeof v !== 'string') return 'Invalid answer.';
    if (f.type === 'teeth') {
      const t = parseTeeth(v);
      if (!t || (!t.top.length && !t.bottom.length)) return 'Please select at least one tooth.';
      continue;
    }
    const opts = optionsOf(f, a, form);
    if (opts && !opts.some((o) => o.value === v)) return 'Invalid choice.';
    if (!opts && v.length > (f.max || 1000)) return 'Text is too long.';
  }
  return null;
}

function visible(field, a) {
  const c = field.showIf;
  if (!c) return true;
  const v = a[c.field];
  if (c.in) return c.in.includes(v);
  if (c.notIn) return v != null && !c.notIn.includes(v);
  return true;
}

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function rid(len) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
