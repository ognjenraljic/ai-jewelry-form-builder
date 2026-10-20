import { FORMS, TEMPLATES, PIECE_OPTIONS, ONBOARDING_DEFAULTS, formFromOnboarding, publicForm, styleOf, optionsOf, validateFormDef, fromTemplate, enabledSteps } from './forms.js';
import { buildPrompt, buildTweakPrompt } from './prompt.js';
import { parseTeeth, teethSummary } from './teeth.js';
import {
  cookies, setCookie, clearCookie, safeEqual, ADMIN_SESSION_S, adminSessionValue, isAdminRequest, signMedia, mediaSigned, ipNet,
  spendBlock, SPEND_MESSAGE, turnstileOn, turnstileOk, flagged, FLAG_MESSAGE, sniffImage, withSecurity,
} from './guard.js';

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
const STALE_PENDING_MS = 180_000;
const PAGE_SIZE = 50;
const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
const SELFIE_DAYS = 30;
const MAX_VERSIONS = 50;

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/;
const PAGE = { '/builder': 'builder', '/admin': 'admin', '/portal': 'portal' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // DEV_MODE (izbor modela, veći limiti, lažni OpenAI) važi samo na lokalnoj adresi, i kad ga neko greškom postavi uživo.
    if (env.DEV_MODE === '1' && !LOCAL_HOST.test(url.hostname)) env = { ...env, DEV_MODE: '' };
    try {
      return withSecurity(await route(request, env, ctx, url));
    } catch (err) {
      console.error('unhandled', err);
      return withSecurity(json({ error: 'Something went wrong. Please try again.' }, 500));
    }
  },
  // Svaku noć: brisanje selfija i proba na osmijehu starijih od 30 dana, i gašenje rendera koji su ostali "u toku".
  async scheduled(event, env, ctx) {
    ctx.waitUntil(nightly(env));
  },
};

async function route(request, env, ctx, url) {
  const p = url.pathname;
  const read = request.method === 'GET' || request.method === 'HEAD';
  const secure = url.protocol === 'https:';
  // Stranice (i HEAD, za preglede linkova i provjere dostupnosti), sa sigurnosnim zaglavljima.
  if (read && url.hostname.startsWith('builder.') && p === '/') return page(env, new URL('/builder', url), request, { ancestors: "'none'" });
  if (read && p === '/') return page(env, url, request, { ancestors: "'self'", turnstile: turnstileOn(env) });
  if (read && PAGE[p]) return page(env, url, request, { ancestors: "'none'" });
  if (read && p.startsWith('/f/')) {
    const form = await loadForm(env, p.slice(3).split('/')[0], { live: true });
    const allowed = (form?.allowedOrigins || []).filter((o) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o));
    return page(env, new URL('/form', url), request, { ancestors: allowed.length ? `'self' ${allowed.join(' ')}` : '*', turnstile: turnstileOn(env) });
  }

  let m;
  if (p === '/api/admin/login' && request.method === 'POST') return adminLogin(request, env, secure);
  if (p === '/api/admin/logout' && request.method === 'POST') return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'set-cookie': clearCookie('aik_admin', secure) } });
  if (p === '/api/admin/session' && request.method === 'GET') return json({ admin: await isAdmin(request, env) });
  if ((m = p.match(/^\/api\/forms\/([\w-]+)$/)) && read) return getForm(env, m[1]);
  if (p === '/api/config' && read) return json({ turnstile: turnstileOn(env) ? env.TURNSTILE_SITE_KEY : null });
  if (p === '/api/portal/session' && request.method === 'POST') return portalLogin(request, env, secure);
  if (p === '/api/portal/logout' && request.method === 'POST') return portalLogout(request, env, secure);
  if (p.startsWith('/api/portal/')) return portalApi(request, env, p, secure);
  if (p === '/api/admin/view-as-log' && request.method === 'GET') return viewAsLog(request, env);
  if ((m = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)\/view-as$/)) && request.method === 'POST') return startViewAs(request, env, m[1]);
  if ((m = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)\/portal-link$/)) && (request.method === 'POST' || request.method === 'DELETE')) return clientLink(request, env, m[1]);
  if (p === '/api/admin/overview' && request.method === 'GET') return adminOverview(request, env);
  if (p === '/api/admin/test-render' && request.method === 'POST') return testRender(request, env, ctx);
  if ((m = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)\/onboarding$/)) && request.method === 'POST') return startOnboarding(request, env, m[1]);
  if (p.startsWith('/api/admin/onboardings')) return adminOnboardings(request, env, p);
  if (p.startsWith('/api/admin/notifications')) return adminNotifications(request, env, p);
  if ((m = p.match(/^\/api\/leads\/([\w-]+)\/tryon$/)) && request.method === 'POST') return createTryOn(request, env, m[1], ctx);
  if ((m = p.match(/^\/api\/leads\/([\w-]+)$/)) && request.method === 'GET') return leadStatus(request, env, m[1]);
  if (p.startsWith('/api/admin/clients') && !p.endsWith('/upload')) return adminClients(request, env, p);
  if (p.startsWith('/api/admin/forms') || /^\/api\/admin\/clients\/[a-z0-9-]+\/upload$/.test(p)) return adminForms(request, env, p);
  if (p === '/api/leads' && request.method === 'POST') return createLead(request, env);
  if ((m = p.match(/^\/api\/leads\/([\w-]+)\/renders$/)) && request.method === 'POST') return createRender(request, env, m[1], ctx);
  if (p === '/api/demo-requests' && request.method === 'POST') return createDemoRequest(request, env);
  if (p === '/api/admin/leads' && request.method === 'GET') return adminLeads(request, env, url);
  if ((m = p.match(/^\/api\/admin\/demo-requests\/([a-z0-9]+)\/handled$/)) && request.method === 'POST') return demoHandled(request, env, m[1]);
  if (p.startsWith('/media/') && read) return media(request, env, p.slice(7));
  if (p.startsWith('/api/')) return json({ error: 'Not found' }, 404);
  return notFoundPage();
}

// HTML stranica iz assets sa sigurnosnim zaglavljima (CSP, zabrana ugrađivanja gdje treba).
async function page(env, url, request, opts) {
  const res = await env.ASSETS.fetch(new Request(url, { method: 'GET', headers: request.headers }));
  const out = withSecurity(res, { page: true, ...opts });
  return request.method === 'HEAD' ? new Response(null, { status: out.status, headers: out.headers }) : out;
}

function notFoundPage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Page not found · JewelryLead</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b0c;color:#eef6f5;font:15px/1.6 system-ui,sans-serif;text-align:center;padding:24px}h1{font:500 40px Georgia,serif;margin:0 0 8px}p{color:#9fb3b1;margin:0 0 22px}a{color:#032220;background:#35d0c4;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:700}</style></head><body><main><h1>Page not found</h1><p>The page you are looking for doesn't exist or has moved.</p><a href="/">Go to JewelryLead</a></main></body></html>`;
  return withSecurity(new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }), { page: true, ancestors: "'none'" });
}

// Prijava u builder: token jednom, pa HttpOnly kolačić (token više ne živi u browseru ni u adresama).
async function adminLogin(request, env, secure) {
  const b = await request.json().catch(() => ({}));
  if (!env.ADMIN_TOKEN || !safeEqual(String(b.token || '').trim(), env.ADMIN_TOKEN)) {
    await new Promise((r) => setTimeout(r, 600)); // usporava pogađanje
    return json({ error: 'Wrong token.' }, 403);
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'set-cookie': setCookie('aik_admin', await adminSessionValue(env), { maxAge: ADMIN_SESSION_S, secure }) },
  });
}

const isAdmin = (request, env) => isAdminRequest(request, env);

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
  if (turnstileOn(env)) out.turnstile = env.TURNSTILE_SITE_KEY;
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
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (!(await turnstileOk(env, fd.get('cf-turnstile-response'), ip))) return json({ error: 'Please confirm you are human and try again.' }, 400);

  let answers;
  try { answers = JSON.parse(fd.get('answers') || '{}'); } catch { return json({ error: 'Invalid answers.' }, 400); }
  const problem = validateAnswers(form, answers);
  if (problem) return json({ error: problem }, 400);

  // Fajlovi samo za pitanja koja kupac vidi (sakriveno pitanje ne šalje fotografiju zlataru).
  // Polje "reference" je inspiracija za AI; ostala upload pitanja i dodatna polja za fajl idu u files.
  const uploads = [];
  for (const f of enabledSteps(form).flatMap((st) => st.fields.filter((x) => x.enabled !== false))) {
    if (!visible(f, answers)) continue;
    if (f.type === 'upload') uploads.push(f.id);
    if (f.followup === 'file' && answers[f.id] != null && answers[f.id] !== '') uploads.push(`${f.id}__more`);
  }
  const incoming = [];
  for (const key of uploads) {
    const file = fd.get(`file_${key}`) || (key === 'reference' ? fd.get('reference') : null);
    if (!file || typeof file !== 'object' || !file.size) continue;
    if (file.size > MAX_REF_BYTES) return json({ error: 'A photo is too large (max 8 MB).' }, 400);
    const type = await sniffImage(file);
    if (!type) return json({ error: 'Photos must be JPG, PNG or WebP.' }, 400);
    incoming.push([key, file, type]);
  }
  if (incoming.length > 5) return json({ error: 'Too many photos (max 5).' }, 400);

  // Tekst kupca prolazi moderaciju prije nego ijedan model vidi upit.
  if (await flagged(env, { text: [answers.vision, answers.inscription, ...Object.entries(answers).filter(([k]) => k.endsWith('__more')).map(([, v]) => v)].filter(Boolean).join('\n') })) {
    return json({ error: FLAG_MESSAGE }, 400);
  }

  // Limit po mreži, atomično: upit se upiše samo ako mreža nije prešla limit u zadnjem satu.
  const net = ipNet(request);
  const limit = env.DEV_MODE === '1' ? 100 : LEADS_PER_IP_HOUR;
  const id = rid(12);
  const token = rid(24);
  const ins = await env.DB.prepare(
    `INSERT INTO leads (id, form_id, token, name, email, phone, answers, ip, ip_net, created_at)
     SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM leads WHERE ip_net = ? AND created_at > ?) < ?`
  ).bind(id, form.id, token, name, email, phone, JSON.stringify(answers), ip, net, Date.now(), net, Date.now() - 3600_000, limit).run();
  if (!ins.meta.changes) return json({ error: 'Too many requests. Please try again later.' }, 429);

  // Fotografije tek poslije upisa, pa nema fajlova bez upita.
  let refKey = null;
  const files = {};
  for (const [key, file, type] of incoming) {
    const ext = type.split('/')[1];
    const r2 = key === 'reference' ? `refs/${id}.${ext}` : `refs/${id}-${key}.${ext}`;
    await env.MEDIA.put(r2, file.stream(), { httpMetadata: { contentType: type } });
    if (key === 'reference') refKey = r2; else files[key] = r2;
  }
  if (refKey || Object.keys(files).length) {
    await env.DB.prepare('UPDATE leads SET ref_key = ?, files = ? WHERE id = ?').bind(refKey, Object.keys(files).length ? JSON.stringify(files) : null, id).run();
  }
  return json({ leadId: id, token, maxRenders: form.maxRenders });
}

// Mjesto za render se zauzima jednim upisom: prolazi samo ako upit nije potrošio limit i nema rendera u toku.
// Tako ni 200 paralelnih zahtjeva ne napravi više od jednog plaćenog rendera.
async function claimRender(env, { id, leadId, model, tweak, kind, maxOk, maxAll }) {
  const now = Date.now();
  // Render koji je ostao "u toku" duže od 3 minute (zatvoren tab, pad) više ne blokira i ne broji se kao uspjeh.
  await env.DB.prepare("UPDATE renders SET status = 'error', error = 'timed out' WHERE lead_id = ? AND status = 'pending' AND created_at < ?").bind(leadId, now - STALE_PENDING_MS).run();
  const kindSql = kind ? 'kind = ?' : 'kind IS NULL';
  const kindArgs = kind ? [kind] : [];
  // Redni broj se računa u istom upisu (dva brza rendera ne dobiju isti broj).
  const r = await env.DB.prepare(
    `INSERT INTO renders (id, lead_id, n, model, prompt, tweak, status, kind, created_at)
     SELECT ?,?,(SELECT COUNT(*) FROM renders WHERE lead_id = ? AND ${kindSql} AND status = 'ok') + 1,?,'',?,'pending',?,? WHERE
       (SELECT COUNT(*) FROM renders WHERE lead_id = ? AND ${kindSql} AND status = 'ok') < ? AND
       (SELECT COUNT(*) FROM renders WHERE lead_id = ? AND ${kindSql}) < ? AND
       NOT EXISTS (SELECT 1 FROM renders WHERE lead_id = ? AND status = 'pending')`
  ).bind(id, leadId, leadId, ...kindArgs, model.id, tweak, kind || null, now, leadId, ...kindArgs, maxOk, leadId, ...kindArgs, maxAll, leadId).run();
  if (r.meta.changes !== 1) return 0;
  return (await env.DB.prepare('SELECT n FROM renders WHERE id = ?').bind(id).first()).n;
}

async function createRender(request, env, leadId, ctx) {
  const body = await request.json().catch(() => ({}));
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first();
  if (!lead || !body.token || !safeEqual(body.token, lead.token)) return json({ error: 'Not allowed.' }, 403);
  const form = await loadForm(env, lead.form_id);
  if (!form) return json({ error: 'Form not found' }, 404);

  const all = (await env.DB.prepare('SELECT * FROM renders WHERE lead_id = ? ORDER BY created_at').bind(leadId).all()).results;
  const rows = all.filter((r) => r.kind !== 'tryon'); // proba na osmijehu se ne broji u dorade
  const ok = rows.filter((r) => r.status === 'ok');
  if (ok.length >= form.maxRenders) return json({ error: 'You have used all your previews. Our team will follow up with you.' }, 429);

  const tweak = clean(body.tweak, 300);
  const isTweak = !!(tweak && ok.length);
  // Prvi render ide na jači model (to je trenutak kad kupac odlučuje), dorade na brži i jeftiniji.
  // U dev modu forma može izabrati model ručno radi poređenja.
  const modelKey = env.DEV_MODE === '1' && MODELS[body.model] ? body.model : isTweak ? tweakModel(env) : firstModel(env);
  const model = MODELS[modelKey];
  // Označeni dio slike (maska) razumije samo OpenAI; ako stigne a ne može se pročitati, bolje reći nego mijenjati cijelu sliku.
  const mask = isTweak && body.mask && model.provider === 'openai' ? maskFrom(body.mask) : null;
  if (isTweak && body.mask && model.provider === 'openai' && !mask) return json({ error: 'We could not read the marked area. Please mark it again.' }, 400);
  if (isTweak && (await flagged(env, { text: tweak }))) return json({ error: FLAG_MESSAGE }, 400);
  const block = await spendBlock(env, lead.form_id);
  if (block) { await budgetNotice(env, block, lead.form_id); return json({ error: SPEND_MESSAGE, paused: true }, 503); }

  const renderId = rid(12);
  const tweakNote = tweak ? (mask ? `Marked area: ${tweak}` : tweak) : null;
  const n = await claimRender(env, { id: renderId, leadId, model, tweak: tweakNote, kind: null, maxOk: form.maxRenders, maxAll: form.maxRenders + 3 });
  if (!n) {
    const busy = (await env.DB.prepare("SELECT 1 FROM renders WHERE lead_id = ? AND status = 'pending'").bind(leadId).first());
    return busy ? json({ error: 'Your preview is still being created.' }, 409) : json({ error: 'Preview limit reached. Our team will follow up with you.' }, 429);
  }

  // Posao teče kroz waitUntil: ako kupac zatvori tab, render se ipak završi i trošak upiše.
  const job = (async () => {
    const answers = JSON.parse(lead.answers);
    // Dorada polazi od rendera koji kupac gleda (base = njegov redni broj), inače od zadnjeg.
    const pick = isTweak ? ok[Number.isInteger(body.base) && body.base >= 1 && body.base <= ok.length ? body.base - 1 : ok.length - 1] : null;
    const base = pick ? await r2Image(env, pick.image_key) : null;
    const ref = !isTweak && lead.ref_key ? await r2Image(env, lead.ref_key) : null;
    const { images, prompt } = await renderInputs(env, request, form, answers, { ref, tweak: isTweak ? tweak : '', base, masked: !!(mask && base) });
    const t0 = Date.now();
    try {
      const out = await runModel(env, model, prompt, images, base ? mask : null);
      const ext = out.mime.split('/')[1] || 'png';
      const key = `renders/${leadId}/${n}-${rid(8)}.${ext}`;
      await env.MEDIA.put(key, fromB64(out.b64), { httpMetadata: { contentType: out.mime } });
      await env.DB.prepare('UPDATE renders SET status = ?, image_key = ?, prompt = ?, ms = ?, in_tokens = ?, out_tokens = ?, cost_usd = ? WHERE id = ?')
        .bind('ok', key, prompt, out.ms, out.inT, out.outT, out.cost, renderId).run();
      return json({
        url: `/media/${key}`, n, remaining: form.maxRenders - n,
        ...(env.DEV_MODE === '1' ? { dev: { model: model.label, ms: out.ms, inTokens: out.inT, outTokens: out.outT, costUsd: out.cost, prompt } } : {}),
      });
    } catch (err) {
      console.error('render failed', model.id, err.message);
      await env.DB.prepare('UPDATE renders SET status = ?, error = ?, prompt = ?, ms = ? WHERE id = ?').bind('error', String(err.message).slice(0, 500), prompt, Date.now() - t0, renderId).run();
      return json({ error: 'We could not create your preview this time. Please try again.', ...(env.DEV_MODE === '1' ? { dev: { error: err.message } } : {}) }, 502);
    }
  })();
  ctx?.waitUntil?.(job.catch(() => {}));
  return job;
}

// Kad se dostigne dnevni budžet ili pauza: jedno obavještenje dnevno po razlogu (zvonce u builderu).
async function budgetNotice(env, block, formId) {
  const day = new Date().toISOString().slice(0, 10);
  const ref = `${block}:${block === 'form' ? formId : 'all'}:${day}`;
  if (await env.DB.prepare('SELECT 1 FROM notifications WHERE ref = ?').bind(ref).first()) return;
  const title = block === 'paused' ? 'Renders are paused (RENDERS_PAUSED)' : block === 'daily' ? 'Daily AI budget reached: renders stopped until tomorrow' : `Daily budget for form ${formId} reached: its renders stopped until tomorrow`;
  await notify(env, 'budget', title, ref).run();
}

// Grillz na fotografiji kupca: njegov osmijeh + render koji gleda -> ista osoba sa tim grillzima.
// Fotografija i rezultat su privatni (refs/): vide ih kupac (token upita), zlatar i admin. Najviše TRYONS_PER_LEAD po upitu.
const TRYONS_PER_LEAD = 2;
async function createTryOn(request, env, leadId, ctx) {
  const fd = await request.formData();
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first();
  if (!lead || !fd.get('token') || !safeEqual(fd.get('token'), lead.token)) return json({ error: 'Not allowed.' }, 403);
  const form = await loadForm(env, lead.form_id);
  const answers = JSON.parse(lead.answers);
  if (!form || form.tryOn === false || answers.type !== 'grillz') return json({ error: 'Try-on is not available for this piece.' }, 400);
  if (fd.get('consent') !== 'yes') return json({ error: 'Please confirm that we may use your photo for this preview.' }, 400);
  const all = (await env.DB.prepare('SELECT * FROM renders WHERE lead_id = ? ORDER BY created_at').bind(leadId).all()).results;
  const tries = all.filter((r) => r.kind === 'tryon');
  if (tries.filter((r) => r.status === 'ok').length >= TRYONS_PER_LEAD) return json({ error: 'You have used all your try-ons. Our team will follow up with you.' }, 429);
  const design = all.filter((r) => r.kind !== 'tryon' && r.status === 'ok');
  const n = Number(fd.get('base'));
  const pick = design[Number.isInteger(n) && n >= 1 && n <= design.length ? n - 1 : design.length - 1];
  if (!pick) return json({ error: 'Create your grillz preview first.' }, 400);
  const photo = fd.get('photo');
  if (!photo || typeof photo !== 'object' || !photo.size) return json({ error: 'Please upload a JPG, PNG or WebP photo.' }, 400);
  if (photo.size > MAX_REF_BYTES) return json({ error: 'The photo is too large (max 8 MB).' }, 400);
  const type = await sniffImage(photo);
  if (!type) return json({ error: 'Please upload a JPG, PNG or WebP photo.' }, 400);
  const buf = await photo.arrayBuffer();
  const selfie = { mime: type, b64: toB64(buf) };
  if (await flagged(env, { image: selfie })) return json({ error: "We can't use this photo. Please upload a clear photo of your own smile." }, 400);
  const block = await spendBlock(env, lead.form_id);
  if (block) { await budgetNotice(env, block, lead.form_id); return json({ error: SPEND_MESSAGE, paused: true }, 503); }

  const model = MODELS[tweakModel(env)];
  const renderId = rid(12);
  if (!(await claimRender(env, { id: renderId, leadId, model, tweak: 'Try-on on the customer photo', kind: 'tryon', maxOk: TRYONS_PER_LEAD, maxAll: TRYONS_PER_LEAD + 2 }))) {
    const busy = (await env.DB.prepare("SELECT 1 FROM renders WHERE lead_id = ? AND status = 'pending'").bind(leadId).first());
    return busy ? json({ error: 'Your preview is still being created.' }, 409) : json({ error: 'You have used all your try-ons. Our team will follow up with you.' }, 429);
  }
  const job = (async () => {
    // Selfi je privatan i briše se poslije SELFIE_DAYS dana (noćno čišćenje).
    await env.MEDIA.put(`refs/${leadId}-selfie-${rid(8)}.${type.split('/')[1]}`, buf, { httpMetadata: { contentType: type } });
    const base = await r2Image(env, pick.image_key);
    const prompt = [
      'Image 1 is a photo of a customer smiling. Image 2 is the custom grillz (teeth jewelry) they designed.',
      'Create a photorealistic photo of the same person wearing exactly these grillz on their teeth: same metal color, stones, shape, rows and number of covered teeth as image 2, fitted naturally to their teeth and gums.',
      "Keep the person's face, identity, skin, expression, hair, clothing, lighting, camera angle and background exactly as in image 1. Change only the teeth area.",
      'No text, no watermark, no extra people.',
    ].join('\n');
    try {
      const out = await runModel(env, model, prompt, [selfie, base], null, model.provider === 'openai' ? 'auto' : '1024x1024');
      const key = `refs/${leadId}-tryon-${rid(8)}.${out.mime.split('/')[1] || 'png'}`;
      await env.MEDIA.put(key, fromB64(out.b64), { httpMetadata: { contentType: out.mime } });
      await env.DB.prepare('UPDATE renders SET status = ?, image_key = ?, prompt = ?, ms = ?, in_tokens = ?, out_tokens = ?, cost_usd = ? WHERE id = ?')
        .bind('ok', key, prompt, out.ms, out.inT, out.outT, out.cost, renderId).run();
      return json({ url: await signMedia(env, key), remaining: TRYONS_PER_LEAD - (tries.filter((r) => r.status === 'ok').length + 1) });
    } catch (err) {
      console.error('try-on failed', model.id, err.message);
      await env.DB.prepare('UPDATE renders SET status = ?, error = ?, prompt = ? WHERE id = ?').bind('error', String(err.message).slice(0, 500), prompt, renderId).run();
      return json({ error: 'We could not create the try-on this time. Please try another photo.', ...(env.DEV_MODE === '1' ? { dev: { error: err.message } } : {}) }, 502);
    }
  })();
  ctx?.waitUntil?.(job.catch(() => {}));
  return job;
}

// Stanje upita za kupca (token u zaglavlju, ne u adresi): vraća rendere i probe poslije osvježavanja stranice.
async function leadStatus(request, env, leadId) {
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first();
  const token = request.headers.get('x-lead-token');
  if (!lead || !token || !safeEqual(token, lead.token)) return json({ error: 'Not allowed.' }, 403);
  const form = await loadForm(env, lead.form_id);
  const rows = (await env.DB.prepare("SELECT n, image_key, kind, status FROM renders WHERE lead_id = ? AND status = 'ok' AND image_key IS NOT NULL ORDER BY created_at").bind(leadId).all()).results;
  const design = rows.filter((r) => r.kind !== 'tryon');
  const tries = rows.filter((r) => r.kind === 'tryon');
  return json({
    answers: JSON.parse(lead.answers),
    renders: design.map((r) => ({ url: `/media/${r.image_key}` })),
    tryons: await Promise.all(tries.map(async (r) => ({ url: await signMedia(env, r.image_key) }))),
    maxRenders: form?.maxRenders || 4,
    tryLeft: Math.max(0, TRYONS_PER_LEAD - tries.length),
  });
}

// Noćno: selfiji i probe stariji od SELFIE_DAYS se brišu (fotografije lica ne čuvamo zauvijek), renderi "u toku" se gase.
async function nightly(env) {
  const cutoff = Date.now() - SELFIE_DAYS * 86400_000;
  let cursor;
  let removed = 0;
  do {
    const list = await env.MEDIA.list({ prefix: 'refs/', cursor, limit: 1000 });
    const old = list.objects.filter((o) => /-(selfie|tryon)-/.test(o.key) && o.uploaded.getTime() < cutoff).map((o) => o.key);
    if (old.length) {
      await env.MEDIA.delete(old);
      removed += old.length;
      for (const key of old.filter((k) => k.includes('-tryon-'))) await env.DB.prepare("UPDATE renders SET image_key = NULL, error = 'deleted after 30 days' WHERE image_key = ?").bind(key).run();
    }
    cursor = list.truncated ? list.cursor : null;
  } while (cursor);
  await env.DB.prepare("UPDATE renders SET status = 'error', error = 'timed out' WHERE status = 'pending' AND created_at < ?").bind(Date.now() - STALE_PENDING_MS).run();
  console.log('nightly', { removed });
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
async function runModel(env, model, prompt, images, mask = null, size = '1024x1024') {
  const t0 = Date.now();
  const out = model.provider === 'openai' ? await openaiImage(env, model, prompt, images, mask, size) : await gemini(env, model.id, prompt, images);
  const inT = out.usage.promptTokenCount ?? out.usage.input_tokens ?? 0;
  const outT = out.usage.candidatesTokenCount ?? out.usage.output_tokens ?? 0;
  const imgIn = out.usage.input_tokens_details?.image_tokens || 0;
  const cost = ((inT - imgIn) * model.inPerM + imgIn * (model.imgInPerM || model.inPerM) + outT * model.outPerM) / 1e6;
  return { ...out, ms: Date.now() - t0, inT, outT, cost };
}

// Probni render iz buildera: nacrt forme i odgovori iz pregleda, bez upita (lead). Trošak se bilježi u test_renders.
async function testRender(request, env, ctx) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
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
  const model = MODELS[tweak ? tweakModel(env) : firstModel(env)];
  const maskFile = fd.get('mask');
  const mask = base && model.provider === 'openai' && maskFile && typeof maskFile === 'object' ? maskFrom(new Uint8Array(await maskFile.arrayBuffer())) : null;
  if (base && model.provider === 'openai' && maskFile && typeof maskFile === 'object' && !mask) return json({ error: 'The marked area could not be read.' }, 400);
  const refFile = fd.get('reference');
  let ref = null;
  if (!tweak && refFile && typeof refFile === 'object' && refFile.size) {
    const type = await sniffImage(refFile);
    if (!type || refFile.size > MAX_REF_BYTES) return json({ error: 'Photo must be JPG, PNG or WebP, max 8 MB.' }, 400);
    ref = { mime: type, b64: toB64(await refFile.arrayBuffer()) };
  }
  // Pauza i dnevni budžet važe i za probe iz buildera.
  const block = await spendBlock(env, form.id);
  if (block === 'paused' || block === 'daily') return json({ error: block === 'paused' ? 'Renders are paused (RENDERS_PAUSED).' : 'The daily AI budget is used up. Raise DAILY_BUDGET_USD or try tomorrow.' }, 503);
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
async function openaiImage(env, model, prompt, images, mask = null, size = '1024x1024') {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY nije postavljen');
  const headers = { authorization: `Bearer ${env.OPENAI_API_KEY}` };
  // Samo lokalno: lažni OpenAI server za provjere bez troška (scripts/mask-check.mjs).
  const api = env.DEV_MODE === '1' && env.OPENAI_BASE ? env.OPENAI_BASE : 'https://api.openai.com';
  let res;
  if (images.length) {
    const fd = new FormData();
    fd.set('model', model.id);
    fd.set('prompt', prompt);
    fd.set('size', size);
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
  // Skriveno polje: botovi ga popune. Takav zahtjev se čuva kao mogući spam (ne nestaje tiho) i ne pravi obavještenje.
  const spam = !!(b.hp_extra || b.company);
  const name = clean(b.name, 80);
  const email = clean(b.email, 120).toLowerCase();
  const website = clean(b.website, 200);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || website.length < 4) {
    return json({ error: 'Please add your name, a valid email and your store website.' }, 400);
  }
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (!spam && !(await turnstileOk(env, b.turnstile, ip))) return json({ error: 'Please confirm you are human and try again.' }, 400);
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM demo_requests WHERE ip = ? AND created_at > ?').bind(ip, Date.now() - 3600_000).first();
  if (n >= (env.DEV_MODE === '1' ? 50 : 5)) return json({ error: 'Too many requests. Please try again later.' }, 429);
  const demoId = rid(12);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO demo_requests (id, name, email, website, platform, volume, ip, created_at, spam) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(demoId, name, email, website, clean(b.platform, 40), clean(b.volume, 40), ip, Date.now(), spam ? 1 : 0),
    ...(spam ? [] : [notify(env, 'demo', `Demo request: ${name} (${website})`, demoId)]),
  ]);
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
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
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
      const row = await env.DB.prepare('SELECT updated_at FROM forms WHERE id = ?').bind(id).first();
      return form ? json({ form, updated_at: row?.updated_at || 0 }) : json({ error: 'Form not found' }, 404);
    }
    if (method === 'PUT') {
      const raw = await request.text();
      if (raw.length > 300_000) return json({ error: 'Form is too large' }, 413);
      let form;
      let body;
      try { body = JSON.parse(raw); form = body.form; } catch { return json({ error: 'Invalid JSON' }, 400); }
      try { validateFormDef(form, id); } catch (e) { return json({ error: e.message }, 400); }
      const cur = await env.DB.prepare('SELECT updated_at, client_id FROM forms WHERE id = ?').bind(id).first();
      // Dva taba (ili dvije osobe) na istoj formi: čuvanje preko tuđe novije verzije traži potvrdu.
      if (cur && body.baseUpdatedAt != null && !body.force && cur.updated_at !== body.baseUpdatedAt) {
        return json({ error: 'This form was saved somewhere else (another tab or person) after you opened it.', conflict: true, updated_at: cur.updated_at }, 409);
      }
      // Promjena klijenta seli i sve dosadašnje upite te forme u portal drugog klijenta: samo uz izričitu potvrdu.
      if (cur && (cur.client_id || null) !== (form.clientId || null) && !body.moveLeads) {
        const has = await env.DB.prepare('SELECT 1 FROM leads WHERE form_id = ? LIMIT 1').bind(id).first();
        if (has) return json({ error: 'This form already has leads. Moving it to another client also moves those leads to that client\'s portal.', moveLeads: true }, 409);
      }
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
    if (!file || typeof file !== 'object' || !file.size) return json({ error: 'Image must be JPG, PNG or WebP' }, 400);
    if (file.size > 5 * 1024 * 1024) return json({ error: 'Image is too large (max 5 MB)' }, 400);
    const type = await sniffImage(file);
    if (!type) return json({ error: 'Image must be JPG, PNG or WebP' }, 400);
    const key = `${m[1]}/${m[2]}/${rid(10)}.${type.split('/')[1]}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: type } });
    return json({ url: `/media/${key}` });
  }
  return json({ error: 'Not found' }, 404);
}

// Klijenti (zlatari): ime, sajt, logo (podrazumijevani za nove forme), napomene.
async function adminClients(request, env, p) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
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
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const client = await env.DB.prepare('SELECT id, name, archived_at FROM clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Client not found' }, 404);
  if (client.archived_at) return json({ error: 'This client is archived. Restore it first.' }, 409);
  const token = rid(40);
  const now = Date.now();
  await env.DB.prepare('INSERT INTO portal_sessions (id, token_hash, client_id, kind, ip, started_at, expires_at) VALUES (?,?,?,?,?,?,?)')
    .bind(rid(12), await sha256(token), client.id, 'view-as', request.headers.get('cf-connecting-ip') || 'local', now, now + VIEW_AS_MS).run();
  return json({ token, expiresAt: now + VIEW_AS_MS, client });
}

async function viewAsLog(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const rows = (await env.DB.prepare("SELECT s.client_id, c.name, s.kind, s.started_at, s.expires_at, s.ended_at FROM portal_sessions s LEFT JOIN clients c ON c.id = s.client_id WHERE s.kind = 'view-as' ORDER BY s.started_at DESC LIMIT 50").all()).results;
  return json({ sessions: rows });
}

// Stalni link klijenta za njegov portal (bez lozinke). Novi link gasi stari, DELETE gasi link.
// Čuvamo samo hash, pa se link vidi samo jednom, kad se napravi.
const CLIENT_LINK_MS = 365 * 86400_000;
async function clientLink(request, env, clientId) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const client = await env.DB.prepare('SELECT id, name, archived_at FROM clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Client not found' }, 404);
  if (client.archived_at && request.method !== 'DELETE') return json({ error: 'This client is archived. Restore it first.' }, 409);
  if (request.method === 'DELETE') {
    await env.DB.prepare("UPDATE portal_sessions SET ended_at = ? WHERE client_id = ? AND kind = 'client' AND ended_at IS NULL").bind(Date.now(), client.id).run();
    return json({ ok: true });
  }
  return json(await makeClientLink(request, env, client.id));
}

// Novi stalni link klijenta (stari prestaje da radi). Koriste ga i portal link i onboarding.
async function makeClientLink(request, env, clientId) {
  const now = Date.now();
  const token = rid(40);
  await env.DB.batch([
    env.DB.prepare("UPDATE portal_sessions SET ended_at = ? WHERE client_id = ? AND kind = 'client' AND ended_at IS NULL").bind(now, clientId),
    env.DB.prepare('INSERT INTO portal_sessions (id, token_hash, client_id, kind, ip, started_at, expires_at) VALUES (?,?,?,?,?,?,?)')
      .bind(rid(12), await sha256(token), clientId, 'client', request.headers.get('cf-connecting-ip') || 'local', now, now + CLIENT_LINK_MS),
  ]);
  const origin = new URL(request.url).origin.replace('//builder.', '//');
  return { url: `${origin}/portal#k=${token}`, createdAt: now, expiresAt: now + CLIENT_LINK_MS };
}

const notify = (env, kind, title, ref) => env.DB.prepare('INSERT INTO notifications (id, kind, title, ref, created_at) VALUES (?,?,?,?,?)').bind(rid(12), kind, clean(title, 160), ref || null, Date.now());

// ---------- Onboarding klijenta ----------
// Admin šalje onboarding: nacrt za klijenta + njegov portal link (isti link kasnije vodi u običan portal).
async function startOnboarding(request, env, clientId) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const client = await env.DB.prepare('SELECT id, name, data, archived_at FROM clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Client not found' }, 404);
  if (client.archived_at) return json({ error: 'This client is archived. Restore it first.' }, 409);
  let ob = await env.DB.prepare("SELECT id, status FROM onboardings WHERE client_id = ? AND status != 'done' ORDER BY created_at DESC LIMIT 1").bind(client.id).first();
  if (!ob) {
    const cd = JSON.parse(client.data || '{}');
    const now = Date.now();
    ob = { id: rid(12), status: 'draft' };
    await env.DB.prepare('INSERT INTO onboardings (id, client_id, data, status, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .bind(ob.id, client.id, JSON.stringify({ store: { name: client.name, website: cd.website || '', logo: cd.logo || '' } }), 'draft', now, now).run();
  }
  return json({ ...(await makeClientLink(request, env, client.id)), onboarding: ob });
}

async function adminOnboardings(request, env, p) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  let m;
  if (p === '/api/admin/onboardings' && request.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT o.id, o.client_id, c.name, o.status, o.created_at, o.updated_at, o.submitted_at, o.form_id FROM onboardings o LEFT JOIN clients c ON c.id = o.client_id ORDER BY o.updated_at DESC LIMIT 200').all()).results;
    return json({ onboardings: rows });
  }
  if ((m = p.match(/^\/api\/admin\/onboardings\/([a-z0-9]+)$/)) && request.method === 'GET') {
    const r = await env.DB.prepare('SELECT o.*, c.name FROM onboardings o LEFT JOIN clients c ON c.id = o.client_id WHERE o.id = ?').bind(m[1]).first();
    return r ? json({ onboarding: { ...r, data: JSON.parse(r.data || '{}') } }) : json({ error: 'Not found' }, 404);
  }
  // Forma iz poslatog onboardinga: slike se kopiraju u folder forme (i logo kod klijenta), pa admin pregleda formu u builderu.
  if ((m = p.match(/^\/api\/admin\/onboardings\/([a-z0-9]+)\/build$/)) && request.method === 'POST') {
    const ob = await env.DB.prepare('SELECT * FROM onboardings WHERE id = ?').bind(m[1]).first();
    if (!ob) return json({ error: 'Not found' }, 404);
    if (ob.status !== 'submitted') return json({ error: ob.status === 'done' ? 'A form was already created from this onboarding.' : 'The client has not sent this onboarding yet.' }, 409);
    const client = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(ob.client_id).first();
    if (!client) return json({ error: 'Client not found' }, 404);
    // Zauzmi onboarding (dvostruki klik ne pravi dvije forme).
    const claim = await env.DB.prepare("UPDATE onboardings SET status = 'building', updated_at = ? WHERE id = ? AND status = 'submitted'").bind(Date.now(), ob.id).run();
    if (!claim.meta.changes) return json({ error: 'This onboarding is already being turned into a form.' }, 409);
    const unclaim = () => env.DB.prepare("UPDATE onboardings SET status = 'submitted' WHERE id = ? AND status = 'building'").bind(ob.id).run();
    const d = JSON.parse(ob.data || '{}');
    const id = await uniqueId(env, 'forms', `${client.id}-custom`);
    const prefix = `/media/onboarding/${client.id}/`;
    const copy = async (url, dir) => {
      if (!url || !url.startsWith(prefix) || url.includes('..')) return '';
      const obj = await env.MEDIA.get(url.slice(7));
      if (!obj) return '';
      const key = `${dir}/${rid(10)}.${url.split('.').pop()}`;
      await env.MEDIA.put(key, obj.body, { httpMetadata: { contentType: obj.httpMetadata?.contentType || 'image/webp' } });
      return `/media/${key}`;
    };
    const map = new Map();
    for (const piece of d.pieces || []) for (const s of piece.styles || []) if (s?.image?.startsWith(prefix) && !map.has(s.image)) map.set(s.image, await copy(s.image, `forms/${id}`));
    const logo = d.store?.logo?.startsWith(prefix) ? await copy(d.store.logo, `clients/${client.id}`) : d.store?.logo?.startsWith('/media/clients/') ? d.store.logo : '';
    let form;
    try {
      form = formFromOnboarding(d, { id, clientId: client.id, brand: clean(d.store?.name, 60) || client.name, logo, img: (u) => (u.startsWith('/library/') ? u : map.get(u) || '') });
      validateFormDef(form, id);
    } catch (e) { await unclaim(); return json({ error: e.message }, 400); }
    const cd = JSON.parse(client.data || '{}');
    const extra = [d.questions && `Questions they want to ask customers: ${clean(d.questions, 1500)}`, d.notes && `Notes from onboarding: ${clean(d.notes, 1500)}`].filter(Boolean).join('\n');
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO forms (id, data, client_id, template, updated_at) VALUES (?,?,?,?,?)').bind(id, JSON.stringify(form), client.id, 'custom-enquiry', now),
      env.DB.prepare('UPDATE onboardings SET status = ?, form_id = ?, updated_at = ? WHERE id = ?').bind('done', id, now, ob.id),
      env.DB.prepare('UPDATE clients SET data = ? WHERE id = ?').bind(JSON.stringify({
        ...cd, website: cd.website || clean(d.store?.website, 200), logo: cd.logo || logo,
        notes: [cd.notes, extra].filter(Boolean).join('\n\n').slice(0, 4000),
      }), client.id),
    ]);
    return json({ form });
  }
  return json({ error: 'Not found' }, 404);
}

async function adminNotifications(request, env, p) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  if (p === '/api/admin/notifications/seen' && request.method === 'POST') {
    await env.DB.prepare('UPDATE notifications SET seen_at = ? WHERE seen_at IS NULL').bind(Date.now()).run();
    return json({ ok: true });
  }
  const items = (await env.DB.prepare('SELECT id, kind, title, ref, created_at, seen_at FROM notifications ORDER BY created_at DESC LIMIT 30').all()).results;
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE seen_at IS NULL').first();
  return json({ items, unseen: n });
}

// Pregled svih formi za builder: upiti, renderi, zadnji upit i trošak po formi, plus aktivni linkovi klijenata.
async function adminOverview(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
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

// Token iz zaglavlja (skripte) ili HttpOnly kolačića (browser: admin pregled ima prednost nad klijentovim linkom).
async function portalSession(request, env) {
  const c = cookies(request);
  const token = request.headers.get('x-portal-token') || c.aik_viewas || c.aik_portal;
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

// Link klijenta (#k=...) ili admin pregled se jednom razmijene za HttpOnly kolačić; token više ne ide u adrese slika.
async function portalLogin(request, env, secure) {
  const b = await request.json().catch(() => ({}));
  const token = String(b.token || '');
  if (token.length < 20) return json({ error: 'Invalid link.' }, 400);
  const s = await env.DB.prepare('SELECT * FROM portal_sessions WHERE token_hash = ?').bind(await sha256(token)).first();
  if (!s || s.ended_at || s.expires_at < Date.now()) return json({ error: 'This link no longer works.' }, 401);
  const name = s.kind === 'view-as' ? 'aik_viewas' : 'aik_portal';
  const maxAge = Math.max(60, Math.floor((s.expires_at - Date.now()) / 1000));
  const h = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  h.append('set-cookie', setCookie(name, token, { maxAge, secure }));
  if (name === 'aik_portal') h.append('set-cookie', clearCookie('aik_viewas', secure));
  return new Response(JSON.stringify({ ok: true, kind: s.kind }), { headers: h });
}
async function portalLogout(request, env, secure) {
  const h = new Headers({ 'content-type': 'application/json' });
  h.append('set-cookie', clearCookie('aik_portal', secure));
  h.append('set-cookie', clearCookie('aik_viewas', secure));
  return new Response(JSON.stringify({ ok: true }), { headers: h });
}

async function portalApi(request, env, p, secure) {
  const sess = await portalSession(request, env);
  if (!sess) return json({ error: 'Session expired. Open the portal again.' }, 401);
  const client = await env.DB.prepare('SELECT id, name, data FROM clients WHERE id = ?').bind(sess.client_id).first();
  if (!client) return json({ error: 'Client not found' }, 404);

  // Admin zatvara svoj pregled. Klijentov link se ovdje ne gasi (odjava samo briše token u browseru).
  if (p === '/api/portal/exit' && request.method === 'POST') {
    if (sess.kind === 'view-as') await env.DB.prepare('UPDATE portal_sessions SET ended_at = ? WHERE id = ?').bind(Date.now(), sess.id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'set-cookie': clearCookie('aik_viewas', secure) } });
  }
  // Onboarding: zlatar popunjava svoj vodič; čuva se dok kuca, Send ga šalje adminu.
  if (p.startsWith('/api/portal/onboarding')) return portalOnboarding(request, env, p, client, sess);
  const formRows = (await env.DB.prepare('SELECT id, data, template, updated_at, archived_at FROM forms WHERE client_id = ? ORDER BY updated_at DESC').bind(client.id).all()).results;
  const forms = Object.fromEntries(formRows.map((r) => [r.id, JSON.parse(r.data)]));

  if (p === '/api/portal/me' && request.method === 'GET') {
    const d = JSON.parse(client.data || '{}');
    const stats = await env.DB.prepare(`SELECT COUNT(DISTINCT l.id) AS leads, COUNT(r.id) AS renders, COUNT(DISTINCT CASE WHEN l.created_at > ? THEN l.id END) AS recent
      FROM leads l JOIN forms f ON f.id = l.form_id LEFT JOIN renders r ON r.lead_id = l.id AND r.status = 'ok' WHERE f.client_id = ?`).bind(Date.now() - 30 * 86400_000, client.id).first();
    // Po formi: upiti, renderi i zadnji upit. Trošak AI-ja klijent ne vidi (samo admin).
    const per = Object.fromEntries((await env.DB.prepare(`SELECT l.form_id, COUNT(DISTINCT l.id) AS leads, COUNT(r.id) AS renders, MAX(l.created_at) AS last_lead
      FROM leads l JOIN forms f ON f.id = l.form_id LEFT JOIN renders r ON r.lead_id = l.id AND r.status = 'ok' WHERE f.client_id = ? GROUP BY l.form_id`).bind(client.id).all()).results.map((r) => [r.form_id, r]));
    const ob = await env.DB.prepare('SELECT id, status, data, updated_at, submitted_at, rev FROM onboardings WHERE client_id = ? ORDER BY created_at DESC LIMIT 1').bind(client.id).first();
    return json({
      session: { kind: sess.kind, expiresAt: sess.expires_at },
      client: { id: client.id, name: client.name, logo: d.logo || null, website: d.website || '' },
      onboarding: ob ? { id: ob.id, status: ob.status, rev: ob.rev, data: JSON.parse(ob.data || '{}'), updatedAt: ob.updated_at, submittedAt: ob.submitted_at } : null,
      ...(ob && ob.status === 'draft' ? { onboardingDefaults: ONBOARDING_DEFAULTS } : {}),
      forms: formRows.filter((r) => !r.archived_at).map((r) => ({
        id: r.id, name: forms[r.id].name, template: r.template, label: TEMPLATES[r.template]?.label || 'Custom', updated_at: r.updated_at,
        leads: per[r.id]?.leads || 0, renders: per[r.id]?.renders || 0, lastLead: per[r.id]?.last_lead || null,
      })),
      stats: { leads: stats?.leads || 0, renders: stats?.renders || 0, recent: stats?.recent || 0 },
    });
  }
  // Upiti po stranicama (50), bez dugih IN lista (D1 prima najviše 100 parametara po upitu).
  if (p === '/api/portal/leads' && request.method === 'GET') {
    const u = new URL(request.url);
    const before = Number(u.searchParams.get('before')) || Date.now() + 1;
    const status = u.searchParams.get('status');
    const q = clean(u.searchParams.get('q'), 80).toLowerCase();
    const where = ['f.client_id = ?', 'l.created_at < ?'];
    const args = [client.id, before];
    if (LEAD_STATUSES.includes(status)) { where.push(status === 'new' ? "(l.status IS NULL OR l.status = 'new')" : 'l.status = ?'); if (status !== 'new') args.push(status); }
    if (q) { where.push('(lower(l.name) LIKE ? OR lower(l.email) LIKE ? OR l.phone LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const leads = (await env.DB.prepare(`SELECT l.id, l.form_id, l.name, l.email, l.phone, l.answers, l.ref_key, l.files, l.created_at, l.status, l.note
      FROM leads l JOIN forms f ON f.id = l.form_id WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT ${PAGE_SIZE + 1}`).bind(...args).all()).results;
    const more = leads.length > PAGE_SIZE;
    const pageLeads = leads.slice(0, PAGE_SIZE);
    const oldest = pageLeads.length ? pageLeads[pageLeads.length - 1].created_at : before;
    const renders = pageLeads.length
      ? (await env.DB.prepare(`SELECT r.lead_id, r.n, r.image_key, r.tweak, r.kind FROM renders r JOIN leads l ON l.id = r.lead_id JOIN forms f ON f.id = l.form_id
          WHERE f.client_id = ? AND l.created_at < ? AND l.created_at >= ? AND r.status = 'ok' AND r.image_key IS NOT NULL ORDER BY r.created_at`).bind(client.id, before, oldest).all()).results
      : [];
    const counts = Object.fromEntries((await env.DB.prepare(`SELECT COALESCE(l.status, 'new') AS s, COUNT(*) AS n FROM leads l JOIN forms f ON f.id = l.form_id WHERE f.client_id = ? GROUP BY COALESCE(l.status, 'new')`).bind(client.id).all()).results.map((r) => [r.s, r.n]));
    return json({
      more, next: more ? oldest : null, counts,
      leads: pageLeads.map((l) => {
        const a = JSON.parse(l.answers);
        let files = {};
        try { files = JSON.parse(l.files || '{}'); } catch {}
        return {
          id: l.id, formId: l.form_id, form: forms[l.form_id]?.name || l.form_id, name: l.name, email: l.email, phone: l.phone, created_at: l.created_at,
          status: l.status || 'new', note: l.note || '',
          vision: a.vision || '', details: leadDetails(forms[l.form_id], a),
          photos: [
            ...(l.ref_key ? [{ label: 'Inspiration', key: l.ref_key }] : []),
            ...Object.entries(files).map(([k, key]) => ({ label: k.replace(/__more$/, ' (extra)').replace(/_/g, ' '), key })),
            ...renders.filter((r) => r.lead_id === l.id && r.kind === 'tryon').map((r) => ({ label: 'On their smile', key: r.image_key })),
          ],
          renders: renders.filter((r) => r.lead_id === l.id && r.kind !== 'tryon').map((r) => ({ url: `/media/${r.image_key}`, tweak: r.tweak })),
        };
      }),
    });
  }
  // Status i bilješka upita (zlatar prati šta je uradio); admin pregled ne mijenja podatke klijenta.
  let lm;
  if ((lm = p.match(/^\/api\/portal\/leads\/([a-z0-9]+)$/)) && request.method === 'PATCH') {
    if (sess.kind === 'view-as') return json({ error: 'Admin view is read-only.' }, 403);
    const b = await request.json().catch(() => ({}));
    const st = b.status != null ? String(b.status) : null;
    if (st != null && !LEAD_STATUSES.includes(st)) return json({ error: 'Unknown status.' }, 400);
    const r = await env.DB.prepare(`UPDATE leads SET status = COALESCE(?, status), note = COALESCE(?, note), status_at = ? WHERE id = ? AND form_id IN (SELECT id FROM forms WHERE client_id = ?)`)
      .bind(st, b.note != null ? String(b.note).slice(0, 2000) : null, Date.now(), lm[1], client.id).run();
    return r.meta.changes ? json({ ok: true }) : json({ error: 'Not found' }, 404);
  }
  return json({ error: 'Not found' }, 404);
}

async function demoHandled(request, env, id) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const b = await request.json().catch(() => ({}));
  const r = await env.DB.prepare('UPDATE demo_requests SET handled_at = ? WHERE id = ?').bind(b.handled === false ? null : Date.now(), id).run();
  return r.meta.changes ? json({ ok: true }) : json({ error: 'Not found' }, 404);
}

// Podaci iz vodiča: samo očekivani oblici, slike samo iz foldera tog klijenta ili biblioteke, boja samo hex.
function cleanOnboarding(d, clientId) {
  const own = `/media/onboarding/${clientId}/`;
  const img = (u) => (typeof u === 'string' && !u.includes('..') && (u.startsWith(own) || /^\/library\/[a-z]+\/[\w-]+\.webp$/.test(u)) ? u : '');
  const str = (v, max) => String(v ?? '').slice(0, max);
  const list = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  const st = d.store || {};
  return {
    step: Math.max(0, Math.min(5, Number(d.step) || 0)),
    store: { name: str(st.name, 60), website: str(st.website, 200), logo: img(st.logo), accent: /^#[0-9a-f]{6}$/i.test(st.accent || '') ? st.accent : '#35d0c4', theme: st.theme === 'light' ? 'light' : 'dark' },
    pieces: list(d.pieces, 12).filter((x) => x && typeof x === 'object').map((x) => ({
      uid: str(x.uid, 24), value: str(x.value, 40), label: str(x.label, 60),
      styles: list(x.styles, 24).filter((y) => y && typeof y === 'object').map((y) => ({
        uid: str(y.uid, 24), value: str(y.value, 40), label: str(y.label, 40), image: img(y.image), note: str(y.note, 300), custom: !!y.custom, keep: y.keep !== false,
      })),
    })),
    metals: list(d.metals, 12).map((x) => str(x, 40)),
    metalsOther: str(d.metalsOther, 200),
    stones: list(d.stones, 8).map((x) => str(x, 40)),
    budgets: list(d.budgets, 10).map((x) => str(x, 40)),
    questions: str(d.questions, 2000),
    notes: str(d.notes, 2000),
  };
}

async function portalOnboarding(request, env, p, client, sess) {
  const ob = await env.DB.prepare('SELECT * FROM onboardings WHERE client_id = ? ORDER BY created_at DESC LIMIT 1').bind(client.id).first();
  if (!ob) return json({ error: 'No onboarding for this store.' }, 404);
  const open = ob.status === 'draft';
  // Admin pregled (view-as) samo gleda: ne mijenja ni ne šalje klijentove odgovore.
  if (request.method !== 'GET' && sess.kind === 'view-as') return json({ error: 'Admin view is read-only.' }, 403);
  if (p === '/api/portal/onboarding' && request.method === 'PUT') {
    if (!open) return json({ error: 'This onboarding was already sent.' }, 409);
    const raw = await request.text();
    if (raw.length > 200_000) return json({ error: 'Too much data.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid data.' }, 400); }
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return json({ error: 'Invalid data.' }, 400);
    const data = cleanOnboarding(body.data, client.id);
    // Verzija: čuvanje sa starijom verzijom (drugi uređaj) ne prepisuje novije odgovore.
    const r = await env.DB.prepare("UPDATE onboardings SET data = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND status = 'draft' AND rev = ?")
      .bind(JSON.stringify(data), Date.now(), ob.id, Number(body.rev) || 0).run();
    if (!r.meta.changes) {
      const now = await env.DB.prepare('SELECT data, rev, status FROM onboardings WHERE id = ?').bind(ob.id).first();
      return json({ error: now.status === 'draft' ? 'Your answers were changed on another device.' : 'This onboarding was already sent.', conflict: true, rev: now.rev, data: JSON.parse(now.data || '{}') }, 409);
    }
    return json({ ok: true, savedAt: Date.now(), rev: (Number(body.rev) || 0) + 1 });
  }
  if (p === '/api/portal/onboarding/upload' && request.method === 'POST') {
    if (!open) return json({ error: 'This onboarding was already sent.' }, 409);
    const file = (await request.formData()).get('file');
    if (!file || typeof file !== 'object' || !file.size) return json({ error: 'Photo must be JPG, PNG or WebP.' }, 400);
    if (file.size > 5 * 1024 * 1024) return json({ error: 'Photo is too large (max 5 MB).' }, 400);
    const type = await sniffImage(file);
    if (!type) return json({ error: 'Photo must be JPG, PNG or WebP.' }, 400);
    // Limit slika po klijentu, da vodič ne postane besplatno skladište.
    const listed = await env.MEDIA.list({ prefix: `onboarding/${client.id}/`, limit: 401 });
    if (listed.objects.length >= 400) return json({ error: 'Too many photos. Please remove some styles you do not need.' }, 413);
    const key = `onboarding/${client.id}/${rid(12)}.${type.split('/')[1]}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: type } });
    return json({ url: `/media/${key}` });
  }
  if (p === '/api/portal/onboarding/submit' && request.method === 'POST') {
    if (!open) return json({ ok: true, status: ob.status });
    const d = cleanOnboarding(JSON.parse(ob.data || '{}'), client.id);
    if (!d.pieces.some((x) => x.label.trim())) return json({ error: 'Pick at least one piece you make.' }, 400);
    const now = Date.now();
    const r = await env.DB.prepare("UPDATE onboardings SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'").bind(now, now, ob.id).run();
    if (r.meta.changes) await notify(env, 'onboarding', `${client.name} sent their onboarding`, ob.id).run();
    return json({ ok: true, status: 'submitted' });
  }
  return json({ error: 'Not found' }, 404);
}

async function adminLeads(request, env, url) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const before = Number(url?.searchParams.get('before')) || Date.now() + 1;
  const leads = (await env.DB.prepare(`SELECT id, form_id, name, email, phone, answers, ref_key, files, created_at, status FROM leads WHERE created_at < ? ORDER BY created_at DESC LIMIT ${PAGE_SIZE + 1}`).bind(before).all()).results;
  const more = leads.length > PAGE_SIZE;
  const page = leads.slice(0, PAGE_SIZE);
  const oldest = page.length ? page[page.length - 1].created_at : before;
  const renders = page.length
    ? (await env.DB.prepare('SELECT r.lead_id, r.n, r.model, r.tweak, r.image_key, r.status, r.error, r.ms, r.in_tokens, r.out_tokens, r.cost_usd, r.created_at, r.kind FROM renders r JOIN leads l ON l.id = r.lead_id WHERE l.created_at < ? AND l.created_at >= ? ORDER BY r.created_at').bind(before, oldest).all()).results
    : [];
  const byLead = {};
  for (const r of renders) (byLead[r.lead_id] ||= []).push(r);
  // Zbirovi iz cijele baze (ne iz jedne stranice).
  const [t1, t2, t3] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM leads'),
    env.DB.prepare("SELECT SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS renders, SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors, COALESCE(SUM(cost_usd), 0) AS cost FROM renders"),
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(cost_usd), 0) AS cost FROM test_renders WHERE status = 'ok'"),
  ]);
  const demos = !url?.searchParams.get('before') ? (await env.DB.prepare('SELECT id, name, email, website, platform, volume, created_at, handled_at, spam FROM demo_requests ORDER BY created_at DESC LIMIT 200').all()).results : [];
  return json({
    demos, more, next: more ? oldest : null,
    totals: { leads: t1.results[0].n, renders: t2.results[0].renders || 0, errors: t2.results[0].errors || 0, cost: t2.results[0].cost, tests: t3.results[0].n, testCost: t3.results[0].cost },
    leads: page.map((l) => ({ ...l, answers: JSON.parse(l.answers), renders: byLead[l.id] || [] })),
  });
}

async function media(request, env, key) {
  if (!/^(renders|refs|forms|clients|tests|onboarding)\/[\w./-]+$/.test(key) || key.includes('..')) return json({ error: 'Not found' }, 404);
  // Javne slike imaju nepogodiv ključ; slike kupaca (refs/: inspiracija, selfi, proba) vide admin, zlatar tog upita
  // (portal kolačić) i kupac preko potpisanog linka koji ističe. Tokeni se ne stavljaju u adrese.
  const priv = key.startsWith('refs/');
  if (priv && !(await isAdmin(request, env)) && !(await mediaSigned(request, env, key))) {
    const leadId = key.slice(5).split(/[.-]/)[0];
    const sess = await portalSession(request, env);
    const lead = sess && (await env.DB.prepare('SELECT f.client_id FROM leads l LEFT JOIN forms f ON f.id = l.form_id WHERE l.id = ?').bind(leadId).first());
    if (!lead || lead.client_id !== sess.client_id) return json({ error: 'Not allowed.' }, 403);
  }
  const obj = await env.MEDIA.get(key);
  if (!obj) return json({ error: 'Not found' }, 404);
  const headers = { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream', 'x-content-type-options': 'nosniff', etag: obj.httpEtag };
  // Ključevi se ne mijenjaju (nova slika = nov ključ), pa se javne slike keširaju dugo; privatne kratko i samo u browseru.
  headers['cache-control'] = priv ? 'private, max-age=600' : 'public, max-age=31536000, immutable';
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
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
