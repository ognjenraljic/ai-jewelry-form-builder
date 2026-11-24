import { FORMS, TEMPLATES, PIECE_OPTIONS, ONBOARDING_DEFAULTS, formFromOnboarding, publicForm, styleOf, optionsOf, offeredFor, validateFormDef, fromTemplate, enabledSteps, withStyleTeeth } from './forms.js';
import { buildPrompt, buildTweakPrompt, buildFilmPrompt, filmDescription, placeholderWord } from './prompt.js';
import { parseTeeth, teethSummary, teethPlan } from './teeth.js';
import { buildTryOnPrompt } from './tryon.js';
import { applyPresetTeeth } from '../public/grillz-selection.js';
import { stepNeedsAnswer, fieldRequired, conditionsMet } from '../public/step-rules.js';
import { onboardingProblems } from '../public/onboarding-check.js';
import { SUGGESTED } from '../public/option-suggestions.js';
import { artList, styleList, metalFamily } from '../public/option-art.js';
import { teethMapImage } from './teethmap.js';
import { estimate, leadSpecFrom, quoteBody, dimKey, applyMarket, MARKET_METALS, OZ, middleGround, specDiff } from '../public/pricing.js';
import { leadPageHtml, PAGE_ACTIONS } from './leadpage.js';
import { stripAudio } from './mp4.js';
import { mailOn, sendMail, validEmail, emailList } from './mail.js';
import { pikaOn, pikaImages, pikaImage, pikaJob, jobFile, jobCharge, startFilm, VIDEO_MODELS, filmModels as filmModelsOn, primaryFilm, extraFilms, modelKeyOf } from './pika.js';
import { sealPortalToken, openPortalToken, activePortalSession } from './portal-links.js';
import { areaOf } from '../public/area-codes.js';
import { ORDER_STAGES, orderPrefix, newOrderNo, normalizeOrderNo, orderView, nextOrder, parseOrder } from './orders.js';
import {
  cookies, setCookie, clearCookie, safeEqual, ADMIN_SESSION_S, adminSessionValue, isAdminRequest, signMedia, mediaSigned, ipNet,
  spendBlock, spendToday, filmRoom, budgets, SPEND_MESSAGE, turnstileOn, turnstileOk, flagged, FLAG_MESSAGE, sniffImage, withSecurity,
} from './guard.js';

// Cijene su procjena (USD po 1M tokena, Gemini API, početak 2026). Provjeriti prije budžeta.
// OpenAI (GPT Image 2.5): tekst $5, ulazna slika $8, izlazna slika $30 po 1M tokena (bez obzira na kvalitet).
// GPT Image 2.6: procjena iz Pika kataloga (Pika 5/8/30 = OpenAI cijena minus 5%), provjeriti na OpenAI računu.
const MODELS = {
  // 2.6 Flare (9.11.2026): prvi render i dorada, ~10 s, ~2x brži od 2.5 Flare za istu cijenu. Ako OpenAI odbije model, render ide na 2.5 Flare.
  // 2.6 Sunburst: tačan, ali na testu 9.11. sporiji i od 2.5 Sunbursta (40-75 s). Ako OpenAI odbije model, render ide na 2.5 Sunburst.
  gpt26sun: { provider: 'openai', id: 'gpt-image-2.6-sunburst', label: 'GPT Image 2.6 Sunburst', inPerM: 5.26, imgInPerM: 8.42, outPerM: 31.58, quality: 'high', fallback: 'gptsun' },
  gpt26flare: { provider: 'openai', id: 'gpt-image-2.6-flare', label: 'GPT Image 2.6 Flare', inPerM: 5.26, imgInPerM: 8.42, outPerM: 31.58, quality: 'high', fallback: 'gptflare' },
  flash: { id: 'gemini-2.5-flash-image', label: 'Nano Banana (Flash)', inPerM: 0.3, outPerM: 30 },
  pro: { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', inPerM: 2, outPerM: 120 },
  gptflare: { provider: 'openai', id: 'gpt-image-2.5-flare', label: 'GPT Image 2.5 Flare', inPerM: 5, imgInPerM: 8, outPerM: 30, quality: 'high', mask: true },
  gptsun: { provider: 'openai', id: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst', inPerM: 5, imgInPerM: 8, outPerM: 30, quality: 'high', mask: true },
  gpt2: { provider: 'openai', id: 'gpt-image-2', label: 'GPT Image 2', inPerM: 5, imgInPerM: 8, outPerM: 30, quality: 'high', mask: true },
  // Isti modeli preko Pike (jedan ključ, cijene po Pika katalogu).
  pikapro: { provider: 'pika', id: 'google/gemini-3-pro-image', label: 'Nano Banana Pro (Pika)', inPerM: 2, outPerM: 120 },
  pikaflash: { provider: 'pika', id: 'google/gemini-3.1-flash-image', label: 'Nano Banana (Pika)', inPerM: 0.5, outPerM: 60 },
  pikagpt: { provider: 'pika', id: 'openai/gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst (Pika)', inPerM: 4.75, imgInPerM: 7.6, outPerM: 28.5, quality: 'high', mask: true },
};

// Model mora imati svoj ključ: bez OPENAI_API_KEY renderi idu na Gemini i obrnuto, umjesto da padaju.
function withKey(env, key, geminiFallback) {
  const openai = MODELS[key].provider === 'openai';
  // PIKA_IMAGES=1: i slike idu preko Pike (jedan račun). GPT ostaje samo gdje treba tačan broj zuba i maska.
  if (pikaImages(env)) return key === 'pikagpt' || key === 'gptsun' ? 'pikagpt' : 'pikapro';
  if (openai && !env.OPENAI_API_KEY && env.GEMINI_API_KEY) return geminiFallback;
  if (!openai && !env.GEMINI_API_KEY && env.OPENAI_API_KEY) return 'gptflare';
  return key;
}
const maskModel = (env, model) => (pikaImages(env) ? MODELS.pikagpt : model);
const firstModel = (env) => (pikaImages(env) ? 'pikapro' : withKey(env, MODELS[env.FIRST_MODEL] ? env.FIRST_MODEL : 'pro', 'pro'));
const tweakModel = (env) => (pikaImages(env) ? 'pikaflash' : withKey(env, MODELS[env.TWEAK_MODEL] ? env.TWEAK_MODEL : 'flash', 'flash'));
// Grillz: isti brzi model kao ostali komadi (2.6 Flare, ~10 s umjesto 40-70 s na 2.5 Sunburstu). Broj zuba drži mapa zuba
// kao referenca uz prompt (Ognjen 16.11: slika odmah, bez brojanja). GRILLZ_MODEL (npr. gptsun) vraća sporiji, tačniji model.
const grillzModel = (env) => (MODELS[env.GRILLZ_MODEL] ? withKey(env, env.GRILLZ_MODEL, 'pro') : firstModel(env));
const tryOnModel = (env) => {
  const model = MODELS[withKey(env, MODELS[env.TRYON_MODEL] ? env.TRYON_MODEL : 'gptsun', 'pro')];
  return { ...model, quality: /^gpt-image-2\.[56]-/.test(model.id) ? 'xhigh' : model.quality };
};

const LEADS_PER_IP_HOUR = 10;
const MAX_REF_BYTES = 8 * 1024 * 1024;
const STALE_PENDING_MS = 180_000;
const STALE_BUILD_MS = 120_000;
const PAGE_SIZE = 50;
const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
const SELFIE_DAYS = 30;
const FILMS_PER_LEAD = 2;
// Dodatni modeli (samo za portal, poređenje): jedan video po modelu i upitu, od iste slike kao kupčev.
const EXTRA_FILMS_PER_LEAD = 1;
const STALE_FILM_MS = 10 * 60_000;
// Skuplji modeli znaju čekati u redu kod provajdera duže od H3 Flexa, pa im se daje više vremena.
const STALE_EXTRA_FILM_MS = 25 * 60_000;
// Kupac vidi samo svoj (prvi) model; svi ostali (i oni koji više nisu u FILM_MODELS) su samo za zlatara u portalu.
const customerFilm = (env, f) => f.model === VIDEO_MODELS[primaryFilm(env)].api;
const staleFor = (env, f) => (customerFilm(env, f) ? STALE_FILM_MS : STALE_EXTRA_FILM_MS);
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
      console.error('unhandled', request.method, url.pathname, err);
      return withSecurity(json({ error: 'Something went wrong. Please try again.' }, 500));
    }
  },
  // Svaku noć: brisanje selfija i proba na osmijehu starijih od 30 dana, i gašenje rendera koji su ostali "u toku".
  // Svakih 5 minuta: slika i video za kupce koji su zatvorili stranicu prije kraja (za outreach iz portala).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(event.cron === '*/5 * * * *' ? catchUp(env) : nightly(env));
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
  if (p.startsWith('/api/portal/')) return portalApi(request, env, p, secure, ctx);
  if (p === '/api/admin/view-as-log' && request.method === 'GET') return viewAsLog(request, env);
  if ((m = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)\/view-as$/)) && request.method === 'POST') return startViewAs(request, env, m[1]);
  if ((m = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)\/portal-link$/)) && ['GET', 'POST', 'DELETE'].includes(request.method)) return clientLink(request, env, m[1]);
  if (p === '/api/admin/overview' && request.method === 'GET') return adminOverview(request, env);
  if (p === '/api/admin/test-render' && request.method === 'POST') return testRender(request, env, ctx);
  if ((m = p.match(/^\/api\/admin\/clients\/([a-z0-9-]+)\/onboarding$/)) && request.method === 'POST') return startOnboarding(request, env, m[1]);
  if (p.startsWith('/api/admin/onboardings')) return adminOnboardings(request, env, p);
  if (p.startsWith('/api/admin/notifications')) return adminNotifications(request, env, p);
  if ((m = p.match(/^\/api\/leads\/([\w-]+)\/tryon$/)) && request.method === 'POST') return createTryOn(request, env, m[1], ctx);
  if ((m = p.match(/^\/api\/leads\/([\w-]+)\/films$/)) && request.method === 'POST') return createFilm(request, env, m[1], ctx);
  if ((m = p.match(/^\/api\/leads\/([\w-]+)\/films\/([a-z0-9]+)$/)) && request.method === 'GET') return filmStatus(request, env, m[1], m[2]);
  if ((m = p.match(/^\/api\/leads\/([\w-]+)$/)) && request.method === 'GET') return leadStatus(request, env, m[1]);
  if (p.startsWith('/api/admin/clients') && !p.endsWith('/upload')) return adminClients(request, env, p);
  if (p.startsWith('/api/admin/forms') || /^\/api\/admin\/clients\/[a-z0-9-]+\/upload$/.test(p)) return adminForms(request, env, p);
  if (p === '/api/leads' && request.method === 'POST') return createLead(request, env, ctx);
  // Praćenje narudžbe sa sajta radnje (23.11.2026): broj narudžbe + mejl kupca, bez prijave, sa bilo kog sajta.
  if (p === '/api/orders/track') return orderTrack(request, env);
  // Stranica kupca (19.11.2026): njegov dizajn, ponude i dugmad Deposit / Book appointment.
  if ((m = p.match(/^\/p\/([a-z0-9]{16,32})$/)) && read) return leadPage(request, env, ctx, m[1], url);
  if ((m = p.match(/^\/api\/page\/([a-z0-9]{16,32})\/action$/)) && request.method === 'POST') return pageAction(request, env, m[1]);
  if ((m = p.match(/^\/api\/leads\/([\w-]+)\/renders$/)) && request.method === 'POST') return createRender(request, env, m[1], ctx);
  if ((m = p.match(/^\/api\/leads\/([\w-]+)\/check$/)) && request.method === 'POST') return teethCheckRoute(request, env, m[1], ctx);
  if (p === '/api/demo-requests' && request.method === 'POST') return createDemoRequest(request, env);
  if (p === '/api/admin/leads' && request.method === 'GET') return adminLeads(request, env, url);
  if (p === '/api/admin/render-stats' && request.method === 'GET') return renderStats(request, env, url);
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
  return withStyleTeeth(row ? JSON.parse(row.data) : FORMS[id] || null);
}

async function getForm(env, id) {
  const form = await loadForm(env, id, { live: true });
  if (!form) return json({ error: 'This form is not available.' }, 404);
  const out = publicForm(form);
  if (turnstileOn(env)) out.turnstile = env.TURNSTILE_SITE_KEY;
  const fm = filmMode(env, form);
  if (fm === 'button') out.film = true;
  else if (fm === 'auto') out.film = 'auto';
  if (env.DEV_MODE === '1') {
    const auto = { key: 'auto', label: `Auto (${MODELS[firstModel(env)].label} pa ${MODELS[tweakModel(env)].label})` };
    out.dev = { models: [auto, ...Object.entries(MODELS).map(([k, v]) => ({ key: k, label: v.label }))], defaultModel: 'auto' };
  }
  return json(out);
}

async function createLead(request, env, ctx) {
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
    if (!visible(f, answers, form)) continue;
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
    `INSERT INTO leads (id, form_id, token, name, email, phone, answers, ip, ip_net, created_at, page_key)
     SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM leads WHERE ip_net = ? AND created_at > ?) < ?`
  ).bind(id, form.id, token, name, email, phone, JSON.stringify(answers), ip, net, Date.now(), rid(24), net, Date.now() - 3600_000, limit).run();
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
  await logEvent(env, id, 'created', { piece: typeof answers.type === 'string' ? answers.type.slice(0, 40) : null });
  // Prva quote poruka (Estimated price) se napiše odmah sa upitom (Ognjen 19.11.2026); cron je mreža sigurnosti.
  // Poslije nje radnja dobija mejl sa leadom i gotovom porukom (21.11.2026), ako ima upisane adrese za obavještenja.
  const origin = new URL(request.url).origin;
  ctx?.waitUntil?.(autoQuote(env, id, origin).catch((e) => console.error('auto quote', id, e.message))
    .then(() => alertShop(env, id, origin)).catch((e) => console.error('lead alert', id, e.message)));
  return json({ leadId: id, token, maxRenders: form.maxRenders });
}

// Mjesto za render se zauzima jednim upisom: prolazi samo ako upit nije potrošio limit i nema rendera u toku.
// Tako ni 200 paralelnih zahtjeva ne napravi više od jednog plaćenog rendera.
// ---------- Dovršavanje u pozadini (cron svakih 5 min) ----------
// Ognjen 16.11: ako kupac zatvori stranicu ranije, slika i video se ipak naprave iz njegovih odgovora, za outreach.
// 1) lead bez ijednog rendera (stariji od 3 min, mlađi od 24 h) dobija prvu sliku; 2) forma sa automatskim videom dobija
// video prvog rendera ako ga nema; 3) videi "u toku" se preuzmu u R2. Po krugu ograničeno, da cron ostane kratak.
const CATCHUP_RENDERS = 6;
const CATCHUP_FILMS = 10;
const CATCHUP_QUOTES = 8;
const ORIGIN = 'https://jewelrylead.com/';
async function catchUp(env) {
  const now = Date.now();
  const leads = (await env.DB.prepare(`SELECT l.* FROM leads l WHERE l.created_at < ? AND l.created_at > ?
      AND NOT EXISTS (SELECT 1 FROM renders r WHERE r.lead_id = l.id AND r.kind IS NULL) ORDER BY l.created_at LIMIT ${CATCHUP_RENDERS}`).bind(now - 3 * 60_000, now - 864e5).all()).results;
  for (const lead of leads) await serverFirstRender(env, lead).catch((e) => console.error('catch-up render', lead.id, e.message));
  // Prva quote poruka za SVAKI upit koji je još nema (Ognjen 19.11.2026), ako zlatar ima cijene; svaki upit samo jednom ($.auto), najnoviji prvi.
  const noQuote = await (async () => (await env.DB.prepare(`SELECT l.id FROM leads l JOIN forms f ON f.id = l.form_id JOIN clients c ON c.id = f.client_id
      WHERE l.created_at < ? AND ((json_type(COALESCE(l.quotes, '{}'), '$.picked') IS NULL AND json_type(COALESCE(l.quotes, '{}'), '$.auto') IS NULL)
        OR (json_type(COALESCE(l.quotes, '{}'), '$.fit') IS NULL AND json_type(COALESCE(l.quotes, '{}'), '$.autoFit') IS NULL AND l.created_at > ?))
      AND json_type(COALESCE(c.data, '{}'), '$.pricing') = 'object' ORDER BY l.created_at DESC LIMIT ${CATCHUP_QUOTES}`).bind(now - 60_000, now - 30 * 864e5).all()).results)().catch((e) => { console.error('catch-up quotes', e.message); return []; });
  for (const q of noQuote) await autoQuote(env, q.id, ORIGIN.replace(/\/$/, '')).catch((e) => console.error('catch-up quote', q.id, e.message));
  // Obavještenja radnji koja nisu stigla odmah i automatska prva poruka kupcu (21.11.2026).
  await notifySweep(env).catch((e) => console.error('notify sweep', e.message));
  if (pikaOn(env)) {
    const need = (await env.DB.prepare(`SELECT l.* FROM leads l JOIN renders r ON r.lead_id = l.id AND r.n = 1 AND r.kind IS NULL AND r.status = 'ok' AND (r.checking IS NULL)
        WHERE l.created_at > ? AND r.created_at < ? AND NOT EXISTS (SELECT 1 FROM films f WHERE f.lead_id = l.id) ORDER BY l.created_at LIMIT ${CATCHUP_FILMS}`).bind(now - 864e5, now - 60_000).all()).results;
    for (const lead of need) {
      const form = await loadForm(env, lead.form_id);
      if (autoFilm(env, form)) await startLeadFilm(env, lead, form, 1, { auto: true }).catch((e) => console.error('catch-up film', lead.id, e.message));
    }
    // Dodatni modeli (portal) za kupčev video koji je krenuo u zadnjem satu, ako nisu krenuli odmah. Samo svježi upiti,
    // da puštanje ove mogućnosti ne napravi videe za sve starije leadove.
    for (const key of extraFilms(env)) {
      const miss = (await env.DB.prepare(`SELECT l.*, r.n AS film_n FROM films p JOIN leads l ON l.id = p.lead_id JOIN renders r ON r.id = p.render_id
          WHERE p.model = ? AND p.status != 'error' AND p.created_at > ? AND p.created_at < ?
          AND NOT EXISTS (SELECT 1 FROM films x WHERE x.lead_id = l.id AND x.model = ?) ORDER BY p.created_at LIMIT 5`)
        .bind(VIDEO_MODELS[primaryFilm(env)].api, now - 60 * 60_000, now - 2 * 60_000, VIDEO_MODELS[key].api).all()).results;
      for (const lead of miss) {
        const form = await loadForm(env, lead.form_id);
        if (filmMode(env, form)) await startLeadFilm(env, lead, form, lead.film_n, { auto: true, modelKey: key }).catch((e) => console.error('catch-up extra film', key, lead.id, e.message));
      }
    }
    const pending = (await env.DB.prepare("SELECT * FROM films WHERE status = 'pending' AND created_at < ? ORDER BY created_at LIMIT 20").bind(now - 60_000).all()).results;
    for (const fl of pending) await settleFilm(env, fl).catch((e) => console.error('catch-up settle', fl.id, e.message));
  }
}

// Prva slika bez otvorene stranice: isti model, ulazi i prompt kao kad je kupac na stranici.
async function serverFirstRender(env, lead) {
  const form = await loadForm(env, lead.form_id);
  if (!form) return;
  const answers = JSON.parse(lead.answers);
  if (await spendBlock(env, lead.form_id)) return;
  const model = MODELS[answers.type === 'grillz' ? grillzModel(env) : firstModel(env)];
  const renderId = rid(12);
  const n = await claimRender(env, { id: renderId, leadId: lead.id, model, tweak: null, kind: null, maxOk: form.maxRenders, maxAll: form.maxRenders + 3 });
  if (!n) return;
  const ref = lead.ref_key ? await r2Image(env, lead.ref_key) : null;
  const { images, prompt } = await renderInputs(env, new Request(ORIGIN), form, answers, { ref });
  const t0 = Date.now();
  try {
    const out = await runModel(env, model, prompt, images, null);
    const key = await saveRender(env, lead.id, n, out);
    await env.DB.prepare('UPDATE renders SET status = ?, image_key = ?, prompt = ?, ms = ?, in_tokens = ?, out_tokens = ?, cost_usd = ?, model = ? WHERE id = ?')
      .bind('ok', key, prompt, out.ms, out.inT, out.outT, out.cost, out.modelUsed || model.id, renderId).run();
    console.log('catch-up render ok', lead.id, out.ms);
    if (n === 1 && autoFilm(env, form)) await startLeadFilm(env, lead, form, n, { auto: true }).catch((e) => console.error('catch-up film', lead.id, e.message));
  } catch (err) {
    await env.DB.prepare('UPDATE renders SET status = ?, error = ?, prompt = ?, ms = ? WHERE id = ?').bind('error', `catch-up: ${String(err.message).slice(0, 480)}`, prompt, Date.now() - t0, renderId).run();
  }
}

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
  const modelKey = env.DEV_MODE === '1' && MODELS[body.model] ? body.model : isTweak ? tweakModel(env) : JSON.parse(lead.answers).type === 'grillz' ? grillzModel(env) : firstModel(env);
  const model = isTweak && body.mask ? maskModel(env, MODELS[modelKey]) : MODELS[modelKey];
  // Označeni dio slike (maska) razumiju samo GPT modeli; ako stigne a ne može se pročitati, bolje reći nego mijenjati cijelu sliku.
  const mask = isTweak && body.mask && model.mask ? maskFrom(body.mask) : null;
  if (isTweak && body.mask && model.mask && !mask) return json({ error: 'We could not read the marked area. Please mark it again.' }, 400);
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
      // Grillz: model zna dodati ili izgubiti zub. Kupac ODMAH dobija prvu sliku; brojanje kapa i eventualni ispravljen
      // render idu u pozadini (checkTeeth), a forma zamijeni sliku kad stigne (Ognjen 16.11: predugo se čekala slika).
      const plan = !isTweak ? teethPlan(answers.teeth) : null;
      const checking = !!plan && teethCheckOn(env);
      const key = await saveRender(env, leadId, n, out);
      await env.DB.prepare('UPDATE renders SET status = ?, image_key = ?, prompt = ?, ms = ?, in_tokens = ?, out_tokens = ?, cost_usd = ?, model = ?, checking = ? WHERE id = ?')
        .bind('ok', key, prompt, out.ms, out.inT, out.outT, out.cost, out.modelUsed || model.id, checking ? 1 : null, renderId).run();
      await monthlyBudgetCheck(env, lead.form_id).catch((e) => console.error('monthly budget check', e.message));
      // Provjeru zuba pokreće forma odmah poslije prikaza (POST /api/leads/<id>/check): waitUntil živi samo ~30 s poslije
      // odgovora, a ispravljen render traje duže. Video samo za zlatara: kod provjere kreće poslije nje (od tačne slike).
      if (!checking && !isTweak && n === 1 && autoFilm(env, form)) ctx?.waitUntil?.(startLeadFilm(env, lead, form, n, { auto: true }).catch((e) => console.error('auto film', e.message)));
      return json({
        url: `/media/${key}`, n, remaining: form.maxRenders - n, ...(checking ? { checking: true } : {}),
        ...(env.DEV_MODE === '1' ? { dev: { model: out.modelUsed && out.modelUsed !== model.id ? `${model.label} -> ${out.modelUsed}` : model.label, ms: out.ms, inTokens: out.inT, outTokens: out.outT, costUsd: out.cost, prompt } } : {}),
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

async function saveRender(env, leadId, n, out) {
  const ext = out.mime.split('/')[1] || 'png';
  const key = `renders/${leadId}/${n}-${rid(8)}.${ext}`;
  await env.MEDIA.put(key, fromB64(out.b64), { httpMetadata: { contentType: out.mime } });
  return key;
}

// Provjera zuba za render koji kupac već gleda. Zove je forma; jedan poziv po renderu (checking 1 -> 2 jednim upisom).
const CHECK_STALE_MS = 6 * 60_000;
async function teethCheckRoute(request, env, leadId, ctx) {
  const body = await request.json().catch(() => ({}));
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first();
  if (!lead || !body.token || !safeEqual(body.token, lead.token)) return json({ error: 'Not allowed.' }, 403);
  const row = await env.DB.prepare("SELECT id, n, image_key, model, prompt, checking, created_at FROM renders WHERE lead_id = ? AND n = ? AND kind IS NULL AND status = 'ok' AND image_key IS NOT NULL").bind(leadId, Number(body.n) || 0).first();
  if (!row) return json({ error: 'Preview not found.' }, 404);
  const now = Date.now();
  if (row.checking === 2 && row.created_at < now - CHECK_STALE_MS) await env.DB.prepare('UPDATE renders SET checking = NULL WHERE id = ?').bind(row.id).run();
  const claimed = row.checking === 1 && (await env.DB.prepare('UPDATE renders SET checking = 2 WHERE id = ? AND checking = 1').bind(row.id).run()).meta.changes === 1;
  if (!claimed) return json({ url: `/media/${row.image_key}`, n: row.n, checking: row.checking === 2 && row.created_at >= now - CHECK_STALE_MS });
  const work = (async () => {
    const form = await loadForm(env, lead.form_id);
    const answers = JSON.parse(lead.answers);
    const plan = teethPlan(answers.teeth);
    const out = plan ? await r2Image(env, row.image_key) : null;
    if (!plan || !out) { await env.DB.prepare('UPDATE renders SET checking = NULL WHERE id = ?').bind(row.id).run(); return; }
    const ref = lead.ref_key ? await r2Image(env, lead.ref_key) : null;
    const { images } = await renderInputs(env, request, form, answers, { ref, tweak: '', base: null, masked: false });
    const modelKey = Object.keys(MODELS).find((k) => MODELS[k].id === row.model) || grillzModel(env);
    await checkTeeth(env, { leadId, renderId: row.id, n: row.n, model: MODELS[modelKey], prompt: row.prompt, images, out, plan });
    if (row.n === 1 && autoFilm(env, form)) await startLeadFilm(env, lead, form, row.n, { auto: true }).catch((e) => console.error('auto film', e.message));
  })();
  ctx?.waitUntil?.(work.catch(() => {}));
  await work.catch((e) => console.error('teeth check route', e.message));
  const fresh = await env.DB.prepare('SELECT image_key FROM renders WHERE id = ?').bind(row.id).first();
  return json({ url: `/media/${fresh.image_key}`, n: row.n, changed: fresh.image_key !== row.image_key });
}

// Pozadinska provjera broja zuba poslije prvog grillz rendera. Kad se broj ne slaže: jedan ispravljen render koji zamijeni
// sliku, osim ako je kupac u međuvremenu već tražio doradu (tada ostaje ono što gleda). Trošak se dopiše na isti render.
async function checkTeeth(env, { leadId, renderId, n, model, prompt, images, out, plan }) {
  let extra = 0;
  try {
    const seen = await countCaps(env, out);
    extra += seen?.cost || 0;
    if (seen && (seen.top !== plan.top || seen.bottom !== plan.bottom)) {
      console.log('teeth mismatch', leadId, JSON.stringify({ want: [plan.top, plan.bottom], got: [seen.top, seen.bottom] }));
      const fixPrompt = `${prompt}\n${teethRetryLine(plan, seen)}`;
      const again = await runModel(env, model, fixPrompt, images, null);
      const check = await countCaps(env, again);
      console.log('teeth retry', leadId, JSON.stringify({ want: [plan.top, plan.bottom], got: check ? [check.top, check.bottom] : null }));
      extra += again.cost + (check?.cost || 0);
      const newer = await env.DB.prepare('SELECT 1 FROM renders WHERE lead_id = ? AND n > ? AND kind IS NULL').bind(leadId, n).first();
      if (!newer) {
        const key = await saveRender(env, leadId, n, again);
        await env.DB.prepare('UPDATE renders SET image_key = ?, prompt = ?, ms = ms + ?, out_tokens = ?, model = ?, cost_usd = cost_usd + ?, checking = NULL WHERE id = ?')
          .bind(key, fixPrompt, again.ms, again.outT, again.modelUsed || model.id, extra, renderId).run();
        return;
      }
    }
  } catch (err) {
    console.error('teeth check failed', err.message);
  }
  await env.DB.prepare('UPDATE renders SET cost_usd = cost_usd + ?, checking = NULL WHERE id = ?').bind(extra, renderId).run().catch(() => {});
}

// ---------- Broj zuba (grillz) ----------
// Jeftin model sa vidom broji kape po redu. Ako poziv ne uspije, render ide dalje bez provjere (nikad ne ruši render).
// TEETH_CHECK=0 gasi provjeru; COUNT_MODEL bira model (podrazumijevano gpt-5-mini).
const COUNT_PRICE = { in: 0.25, out: 2 }; // $ po milion tokena, gpt-5-mini
// Brojanje zuba poslije rendera je isključeno (Ognjen 16.11: broj mora pogoditi prompt sa mapom zuba); TEETH_CHECK=1 ga vraća.
const teethCheckOn = (env) => env.TEETH_CHECK === '1' && !!env.OPENAI_API_KEY;
async function countCaps(env, out) {
  if (!teethCheckOn(env) || !out?.b64) return null;
  const api = env.DEV_MODE === '1' && env.OPENAI_BASE ? env.OPENAI_BASE : 'https://api.openai.com';
  try {
    const res = await fetch(`${api}/v1/responses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: env.COUNT_MODEL || 'gpt-5-mini',
        reasoning: { effort: 'low' },
        input: [{ role: 'user', content: [
          { type: 'input_text', text: 'This is a product photo of dental grillz (teeth jewelry). Count the individual tooth caps in the upper (top) row and in the lower (bottom) row separately. A cap is one covered tooth; count each one left to right. If there is no lower row, bottom is 0; if there is no upper row, top is 0.' },
          { type: 'input_image', image_url: `data:${out.mime};base64,${out.b64}`, detail: 'high' },
        ] }],
        text: { format: { type: 'json_schema', name: 'caps', strict: true, schema: { type: 'object', additionalProperties: false, required: ['top', 'bottom'], properties: { top: { type: 'integer' }, bottom: { type: 'integer' } } } } },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${res.status} ${data.error?.message || ''}`);
    const text = data.output_text || (data.output || []).flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text;
    const n = JSON.parse(text || '{}');
    if (!Number.isInteger(n.top) || !Number.isInteger(n.bottom)) return null;
    const u = data.usage || {};
    return { top: n.top, bottom: n.bottom, cost: ((u.input_tokens || 0) * COUNT_PRICE.in + (u.output_tokens || 0) * COUNT_PRICE.out) / 1e6 };
  } catch (err) {
    console.error('teeth count failed', err.message);
    return null;
  }
}

function teethRetryLine(plan, seen) {
  const row = (name, want, got) => (want === got ? `The ${name} row is right with ${want}.` : `The ${name} row must have exactly ${want} ${want === 1 ? 'cap' : 'caps'}, not ${got}${got > want ? ': remove the extra caps at the outer ends' : ': add the missing caps'}.`);
  return `IMPORTANT correction: a previous attempt got the number of tooth caps wrong. ${plan.top || seen.top ? row('top', plan.top, seen.top) : ''} ${plan.bottom || seen.bottom ? row('bottom', plan.bottom, seen.bottom) : ''} Count every cap before finishing.`.replace(/\s+/g, ' ').trim();
}

// ---------- Film komada (Pika) ----------
// Render postaje prvi kadar kratkog filma. Posao traje oko 3 minute, pa forma pita za stanje, a Worker
// tek kad je gotovo prebaci video u R2. Dva filma po upitu; greška se ne broji.
const filmJson = (f) => ({ id: f.id, status: f.status, created: f.created_at, ...(f.video_key ? { url: `/media/${f.video_key}` } : {}) });

// Video komada po formi (form.highlightVideo): 'button' = kupac klikne "Generate a highlight video",
// 'backend' = pravi se sam poslije prvog rendera i vidi ga samo zlatar u portalu, bez = isključeno. Uvijek traži PIKA_API_KEY.
// 'auto' = kreće sam čim je prva slika gotova, kupac ga vidi u prozorčiću ispod slike (Ognjen 16.11).
const filmMode = (env, form) => (pikaOn(env) && ['button', 'backend', 'auto'].includes(form?.highlightVideo) ? form.highlightVideo : null);
// Film koji kreće sam poslije prvog rendera (bez klika): zlatarev pozadinski i kupčev automatski.
const autoFilm = (env, form) => ['backend', 'auto'].includes(filmMode(env, form));

async function createFilm(request, env, leadId, ctx) {
  if (!pikaOn(env)) return json({ error: 'Not available.' }, 404);
  const body = await request.json().catch(() => ({}));
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first();
  if (!lead || !body.token || !safeEqual(body.token, lead.token)) return json({ error: 'Not allowed.' }, 403);
  const form = await loadForm(env, lead.form_id);
  if (!['button', 'auto'].includes(filmMode(env, form))) return json({ error: 'Not available.' }, 404);
  const out = await startLeadFilm(env, lead, form, body.n, { ctx });
  return json(out.film ? { film: out.film } : { error: out.error, ...(out.paused ? { paused: true } : {}), ...(out.dev ? { dev: out.dev } : {}) }, out.status);
}

// Zajedničko za dugme kupca i pozadinski film: zauzme mjesto jednim upisom i pošalje posao Piki.
// modelKey bez vrijednosti = kupčev model; kad on krene, isti render ide i na dodatne modele (samo portal).
async function startLeadFilm(env, lead, form, n, { auto = false, modelKey = null, ctx = null } = {}) {
  const leadId = lead.id;
  const key = modelKey || primaryFilm(env);
  const vm = VIDEO_MODELS[key];
  const extra = key !== primaryFilm(env);
  const render = await env.DB.prepare("SELECT id, image_key FROM renders WHERE lead_id = ? AND n = ? AND status = 'ok' AND kind IS NULL AND image_key IS NOT NULL").bind(leadId, n).first();
  if (!render) return { error: 'Preview not found.', status: 404 };
  const block = await spendBlock(env, lead.form_id);
  if (block) { await budgetNotice(env, block, lead.form_id); return { error: SPEND_MESSAGE, paused: true, status: 503 }; }
  // Video koji kreće sam se preskače kad ostane manje od 30% dnevnog budžeta: slike kupaca imaju prednost.
  if ((auto || extra) && !(await filmRoom(env, lead.form_id, vm.est))) { console.log('auto film skipped: budget kept for pictures', leadId, key); return { error: 'skipped', status: 409 }; }

  const now = Date.now();
  await env.DB.prepare("UPDATE films SET status = 'error', error = 'timed out', cost_usd = 0 WHERE lead_id = ? AND model = ? AND status = 'pending' AND created_at < ?").bind(leadId, vm.api, now - (extra ? STALE_EXTRA_FILM_MS : STALE_FILM_MS)).run();
  const typeField = form?.steps?.flatMap((st) => st.fields).find((f) => f.id === 'type');
  const answers = JSON.parse(lead.answers);
  const piece = (typeField?.options || []).find((o) => o.value === answers.type)?.label || answers.type;
  const stones = answers.coverage ? answers.coverage !== 'none' : !!answers.stones;
  const prompt = buildFilmPrompt(piece, answers.type, filmDescription(form, answers), { stones });
  const id = rid(12);
  const perLead = extra ? EXTRA_FILMS_PER_LEAD : FILMS_PER_LEAD;
  // Mjesto se zauzima jednim upisom, kao kod rendera: ni paralelni zahtjevi ne prave drugi plaćeni posao. Limiti važe po modelu.
  const r = await env.DB.prepare(
    `INSERT INTO films (id, lead_id, render_id, model, prompt, status, cost_usd, created_at)
     SELECT ?,?,?,?,?,'pending',?,? WHERE
       (SELECT COUNT(*) FROM films WHERE lead_id = ? AND model = ? AND status != 'error') < ? AND
       (SELECT COUNT(*) FROM films WHERE lead_id = ? AND model = ?) < ? AND
       NOT EXISTS (SELECT 1 FROM films WHERE lead_id = ? AND model = ? AND status = 'pending') AND
       NOT EXISTS (SELECT 1 FROM films WHERE render_id = ? AND model = ? AND status = 'ok')`
  ).bind(id, leadId, render.id, vm.api, prompt, vm.est, now, leadId, vm.api, perLead, leadId, vm.api, perLead + 2, leadId, vm.api, render.id, vm.api).run();
  if (r.meta.changes !== 1) {
    const mine = await env.DB.prepare("SELECT * FROM films WHERE render_id = ? AND model = ? AND status != 'error' ORDER BY created_at DESC").bind(render.id, vm.api).first();
    return mine ? { film: filmJson(mine), status: 200 } : { error: 'Video limit reached. Our team will follow up with you.', status: 429 };
  }
  try {
    const img = await env.MEDIA.get(render.image_key);
    const job = await startFilm(env, new Uint8Array(await img.arrayBuffer()), img.httpMetadata?.contentType || 'image/png', prompt, id, key);
    await env.DB.prepare('UPDATE films SET job_id = ? WHERE id = ?').bind(job.id, id).run();
    if (!extra && extraFilms(env).length) {
      // Dodatni modeli kreću poslije kupčevog i ne zadržavaju njegov odgovor.
      const more = startExtraFilms(env, lead, form, n);
      if (ctx?.waitUntil) ctx.waitUntil(more); else await more;
    }
    return { film: { id, status: 'pending', created: now }, status: 201 };
  } catch (err) {
    console.error('film failed', key, err.message);
    await env.DB.prepare("UPDATE films SET status = 'error', error = ?, cost_usd = 0 WHERE id = ?").bind(String(err.message).slice(0, 500), id).run();
    return { error: 'We could not start your video this time.', status: 502, ...(env.DEV_MODE === '1' ? { dev: { error: err.message } } : {}) };
  }
}

// Isti render na svaki dodatni model, jedan po jedan (greška jednog ne zaustavlja ostale).
async function startExtraFilms(env, lead, form, n) {
  for (const key of extraFilms(env)) {
    const out = await startLeadFilm(env, lead, form, n, { auto: true, modelKey: key }).catch((e) => ({ error: e.message }));
    if (out.error && out.status !== 429) console.log('extra film', key, lead.id, out.error);
  }
}

async function filmStatus(request, env, leadId, filmId) {
  const token = request.headers.get('x-lead-token');
  const lead = await env.DB.prepare('SELECT token FROM leads WHERE id = ?').bind(leadId).first();
  if (!lead || !token || !safeEqual(token, lead.token)) return json({ error: 'Not allowed.' }, 403);
  const film = await env.DB.prepare('SELECT * FROM films WHERE id = ? AND lead_id = ?').bind(filmId, leadId).first();
  if (!film || !customerFilm(env, film)) return json({ error: 'Not found' }, 404);
  return json({ film: filmJson(await settleFilm(env, film)) });
}

// Pita Piku za posao na čekanju; gotov video prebaci u R2. Vraća film u novom stanju (ili istom dok traje).
async function settleFilm(env, film) {
  if (film.status !== 'pending' || !film.job_id) return film;
  let job;
  try { job = await pikaJob(env, film.job_id); } catch (err) { console.error('film status', err.message); return film; }
  const fail = async (reason, cost) => {
    await env.DB.prepare("UPDATE films SET status = 'error', error = ?, cost_usd = ? WHERE id = ?").bind(String(reason).slice(0, 500), cost, film.id).run();
    return { ...film, status: 'error' };
  };
  if (job.status === 'failed') return fail(`${job.error?.code || ''} ${job.error?.message || ''}`.trim(), (await jobCharge(env, job)) || 0);
  if (job.status !== 'completed') return Date.now() - film.created_at > staleFor(env, film) ? fail('timed out', film.cost_usd) : film;
  const file = jobFile(job);
  const res = file && (await fetch(file.url));
  if (!res?.ok) return film; // sljedeća provjera pokušava ponovo
  const key = `renders/${film.lead_id}/film-${rid(8)}.mp4`;
  // Bez zvuka i muzike (Ognjen 16.11): Pika uvijek dodaje zvuk, pa se audio traka izbaci prije čuvanja.
  const raw = new Uint8Array(await res.arrayBuffer());
  let silent = null;
  try { silent = stripAudio(raw); } catch (err) { console.error('film audio strip', err.message); }
  await env.MEDIA.put(key, silent || raw, { httpMetadata: { contentType: 'video/mp4' } });
  const cost = (await jobCharge(env, job)) ?? film.cost_usd;
  // Vrijeme generisanja: koliko je posao trajao kod Pike (runtime_s), inače od pokretanja do preuzimanja.
  const ms = Number(job.runtime_s) > 0 ? Math.round(job.runtime_s * 1000) : Date.now() - film.created_at;
  await env.DB.prepare("UPDATE films SET status = 'ok', video_key = ?, ms = ?, cost_usd = ? WHERE id = ? AND status = 'pending'").bind(key, ms, cost, film.id).run();
  return { ...film, status: 'ok', video_key: key };
}

// Mjesečni AI budžet po klijentu (zlataru): $50, ili CLIENT_MONTHLY_BUDGET_USD u Cloudflare Variables.
// Ne zaustavlja rendere: admin dobije obavještenje kad klijent pređe granicu, klijent vidi potrošnju u portalu.
// Mjesec je kalendarski po UTC-u; broje se renderi i try-on upita tog klijenta (probni renderi iz buildera ne).
const monthlyBudget = (env) => { const n = Number(env.CLIENT_MONTHLY_BUDGET_USD); return Number.isFinite(n) && n > 0 ? n : 50; };
const monthStart = (t = Date.now(), add = 0) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + add, 1); };
async function clientMonthCost(env, clientId) {
  const sum = (table) => env.DB.prepare(`SELECT COALESCE(SUM(r.cost_usd), 0) AS cost FROM ${table} r JOIN leads l ON l.id = r.lead_id JOIN forms f ON f.id = l.form_id WHERE f.client_id = ? AND r.created_at >= ?`).bind(clientId, monthStart()).first();
  const [renders, films] = await Promise.all([sum('renders'), sum('films')]);
  return (renders?.cost || 0) + (films?.cost || 0);
}
// Poslije svakog plaćenog rendera: prešao granicu ovog mjeseca -> jedno obavještenje po klijentu i mjesecu.
async function monthlyBudgetCheck(env, formId) {
  const f = await env.DB.prepare('SELECT f.client_id, c.name FROM forms f JOIN clients c ON c.id = f.client_id WHERE f.id = ?').bind(formId).first();
  if (!f) return;
  const limit = monthlyBudget(env);
  const spent = await clientMonthCost(env, f.client_id);
  if (spent < limit) return;
  const month = new Date().toISOString().slice(0, 7);
  const ref = `monthly:${f.client_id}:${month}`;
  await env.DB.prepare("INSERT INTO notifications (id, kind, title, ref, created_at) SELECT ?, 'budget', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE ref = ?)")
    .bind(rid(12), clean(`${f.name} passed the $${limit} monthly AI budget: $${spent.toFixed(2)} so far in ${month}`, 160), ref, Date.now(), ref).run();
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

  const model = tryOnModel(env);
  const renderId = rid(12);
  if (!(await claimRender(env, { id: renderId, leadId, model, tweak: 'Try-on on the customer photo', kind: 'tryon', maxOk: TRYONS_PER_LEAD, maxAll: TRYONS_PER_LEAD + 2 }))) {
    const busy = (await env.DB.prepare("SELECT 1 FROM renders WHERE lead_id = ? AND status = 'pending'").bind(leadId).first());
    return busy ? json({ error: 'Your preview is still being created.' }, 409) : json({ error: 'You have used all your try-ons. Our team will follow up with you.' }, 429);
  }
  await env.DB.prepare('UPDATE renders SET base_render_id = ? WHERE id = ?').bind(pick.id, renderId).run();
  const job = (async () => {
    // Selfi je privatan i briše se poslije SELFIE_DAYS dana (noćno čišćenje).
    await env.MEDIA.put(`refs/${leadId}-selfie-${rid(8)}.${type.split('/')[1]}`, buf, { httpMetadata: { contentType: type } });
    const base = await r2Image(env, pick.image_key);
    const prompt = buildTryOnPrompt(answers);
    try {
      const out = await runModel(env, model, prompt, [selfie, base], null, model.mask ? 'auto' : '1024x1024');
      const key = `refs/${leadId}-tryon-${rid(8)}.${out.mime.split('/')[1] || 'png'}`;
      await env.MEDIA.put(key, fromB64(out.b64), { httpMetadata: { contentType: out.mime } });
      // 14.11-16.11 ovdje je stajao nedefinisan usedPrompt: slika se napravila i naplatila, pa je upis pucao i kupac je dobijao grešku.
      await env.DB.prepare('UPDATE renders SET status = ?, image_key = ?, prompt = ?, ms = ?, in_tokens = ?, out_tokens = ?, cost_usd = ?, model = ? WHERE id = ?')
        .bind('ok', key, prompt, out.ms, out.inT, out.outT, out.cost, out.modelUsed || model.id, renderId).run();
      await monthlyBudgetCheck(env, lead.form_id).catch((e) => console.error('monthly budget check', e.message));
      return json({ url: await signMedia(env, key), base: pick.n, remaining: TRYONS_PER_LEAD - (tries.filter((r) => r.status === 'ok').length + 1) });
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
  const rows = (await env.DB.prepare("SELECT id, n, image_key, kind, status, base_render_id, checking, created_at FROM renders WHERE lead_id = ? AND status = 'ok' AND image_key IS NOT NULL ORDER BY created_at").bind(leadId).all()).results;
  const design = rows.filter((r) => r.kind !== 'tryon');
  const tries = rows.filter((r) => r.kind === 'tryon');
  const films = (await env.DB.prepare('SELECT * FROM films WHERE lead_id = ? ORDER BY created_at').bind(leadId).all()).results;
  return json({
    answers: JSON.parse(lead.answers),
    renders: design.map((r) => {
      const film = films.filter((f) => f.render_id === r.id && customerFilm(env, f)).pop();
      return { url: `/media/${r.image_key}`, n: r.n, ...(r.checking && r.created_at > Date.now() - CHECK_STALE_MS ? { checking: true } : {}), ...(film ? { film: filmJson(film) } : {}) };
    }),
    tryons: await Promise.all(tries.map(async (r) => ({ url: await signMedia(env, r.image_key), base: design.find((d) => d.id === r.base_render_id)?.n ?? null }))),
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
  await env.DB.prepare('DELETE FROM order_lookups WHERE at < ?').bind(Date.now() - 2 * 86400_000).run();
  console.log('nightly', { removed });
}

// Ulaz za model: prvi render (slika stila iz biblioteke ili buildera, pa slika kupca) ili dorada (baza + izmjena).
async function renderInputs(env, request, form, answers, { ref = null, tweak = '', base = null, masked = false } = {}) {
  if (tweak && base) return { images: [base], prompt: buildTweakPrompt(tweak, { masked, type: answers.type }) };
  const images = [];
  const refs = [];
  const style = styleOf(form, answers);
  // Ugrađeni grillz stilovi govore samo broj zuba; kad kupac izabere tačne zube, njihova slika bi nametnula pogrešan broj.
  const countOnly = answers.type === 'grillz' && parseTeeth(answers.teeth) && /^\/library\/grillz\/(top6|top8|set|fangs)\.webp$/.test(style?.image || '');
  // Slika stila sa probnom riječi ("Name") se ne šalje kad je kupac upisao svoj natpis: model je prepisivao riječ sa slike
  // (District 19.11.2026). Oblik tada nosi opis stila i izabrani font.
  const sampleWord = placeholderWord(style) && String(answers.inscription || '').trim();
  if (style?.image && !countOnly && !sampleWord) {
    let img = null;
    if (style.image.startsWith('/media/forms/')) img = await r2Image(env, style.image.slice(7));
    else {
      const res = await env.ASSETS.fetch(new Request(new URL(style.image, request.url)));
      if (res.ok) img = { mime: 'image/webp', b64: toB64(await res.arrayBuffer()) };
    }
    if (img) { images.push(img); refs.push('style'); }
  }
  // Grillz sa tačno izabranim zubima: mapa zuba (ravan crtež, izabrani zubi u boji metala) kao referenca rasporeda.
  if (answers.type === 'grillz') {
    const metalOpt = (form.steps || []).flatMap((st) => st.fields).find((f) => f.id === 'metal')?.options?.find((o) => o.value === answers.metal);
    const map = await teethMapImage(answers.teeth, metalFamily(metalOpt?.label || answers.metal || '')).catch(() => null);
    if (map) { images.push({ mime: map.mime, b64: map.b64 }); refs.push('teethmap'); }
  }
  if (ref) { images.push(ref); refs.push('customer'); }
  // Hiperrealni izgled (Ognjen 23.11.2026) je podrazumijevan; REALISM=off na Workeru vraća stari katalog stil bez deploya.
  return { images, prompt: buildPrompt(form, answers, { refs, style, cinematic: pikaImages(env), realism: env.REALISM === 'off' ? '' : 'ultra' }) };
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
  if (model.provider === 'pika') {
    const out = await pikaImage(env, model, prompt, images.map((x) => ({ bytes: fromB64(x.b64), mime: x.mime })), mask, size);
    const inT = out.usage.input_tokens || 0;
    const outT = out.usage.image_output_tokens || 0;
    return { b64: toB64(out.buf), mime: out.mime, ms: Date.now() - t0, inT, outT, cost: out.cost ?? (inT * model.inPerM + outT * model.outPerM) / 1e6 };
  }
  let used = model;
  let out;
  if (model.provider !== 'openai') out = await gemini(env, model.id, prompt, images);
  else {
    try {
      out = await openaiImage(env, model, prompt, images, mask, size);
    } catch (err) {
      // Novi model koji nalog još nema (ili mu je promijenjeno ime): isti render na rezervnom modelu, kupac ne vidi grešku.
      const fb = model.fallback && MODELS[model.fallback];
      if (!fb || !/^OpenAI (400|403|404): .*model/i.test(err.message)) throw err;
      console.error('model fallback', model.id, '->', fb.id, err.message);
      used = fb;
      out = await openaiImage(env, { ...fb, quality: model.quality }, prompt, images, mask, size);
    }
  }
  const inT = out.usage.promptTokenCount ?? out.usage.input_tokens ?? 0;
  const outT = out.usage.candidatesTokenCount ?? out.usage.output_tokens ?? 0;
  const imgIn = out.usage.input_tokens_details?.image_tokens || 0;
  const cost = ((inT - imgIn) * used.inPerM + imgIn * (used.imgInPerM || used.inPerM) + outT * used.outPerM) / 1e6;
  return { ...out, ms: Date.now() - t0, inT, outT, cost, modelUsed: used.id };
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
  const maskFile = fd.get('mask');
  const marked = base && maskFile && typeof maskFile === 'object';
  const picked = MODELS[tweak ? tweakModel(env) : answers.type === 'grillz' ? grillzModel(env) : firstModel(env)];
  const model = marked ? maskModel(env, picked) : picked;
  const mask = marked && model.mask ? maskFrom(new Uint8Array(await maskFile.arrayBuffer())) : null;
  if (marked && model.mask && typeof maskFile === 'object' && !mask) return json({ error: 'The marked area could not be read.' }, 400);
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
      .bind(id, form.id, out.modelUsed || model.id, prompt, note, key, 'ok', out.ms, out.inT, out.outT, out.cost, now).run();
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
// IMAGE_QUALITY (Cloudflare varijabla, bez deploya): low / medium / high za render i doradu; niži kvalitet = manje izlaznih
// tokena = brže i jeftinije. Try-on (xhigh) ostaje kakav jeste.
const quality = (env, model) => (model.quality !== 'xhigh' && ['low', 'medium', 'high'].includes(env.IMAGE_QUALITY) ? env.IMAGE_QUALITY : model.quality || 'high');
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
    fd.set('quality', quality(env, model));
    fd.set('output_format', 'jpeg');
    images.forEach((img, i) => fd.append('image[]', new Blob([fromB64(img.b64)], { type: img.mime }), `ref-${i + 1}.${img.mime.split('/')[1] || 'png'}`));
    if (mask) fd.set('mask', new Blob([mask], { type: 'image/png' }), 'mask.png');
    res = await fetch(`${api}/v1/images/edits`, { method: 'POST', headers, body: fd });
  } else {
    res = await fetch(`${api}/v1/images/generations`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ model: model.id, prompt, size: '1024x1024', quality: quality(env, model), output_format: 'jpeg' }),
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

// Id mora stati u SLUG_RE (40 znakova) i kad je ime klijenta dugo, zajedno sa nastavkom -custom i brojem -2.
const fitId = (base, suffix = '') => `${base.slice(0, 40 - suffix.length).replace(/-+$/, '')}${suffix}`;
async function uniqueId(env, table, base) {
  const root = base || 'item';
  let id = fitId(root);
  for (let i = 2; await env.DB.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).bind(id).first() || (table === 'forms' && FORMS[id]); i++) id = fitId(root, `-${i}`);
  return id;
}

async function adminForms(request, env, p) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const method = request.method;
  let m;

  // Built-in catalogue and this form's uploads. Customer references/selfies are
  // deliberately outside this prefix and are never offered as reusable images.
  if ((m = p.match(/^\/api\/admin\/forms\/([a-z0-9-]+)\/images$/)) && method === 'GET') {
    if (!(await loadForm(env, m[1]))) return json({ error: 'Form not found' }, 404);
    const cursor = new URL(request.url).searchParams.get('cursor') || undefined;
    if (cursor?.length > 2048) return json({ error: 'Invalid cursor' }, 400);
    const list = await env.MEDIA.list({ prefix: `forms/${m[1]}/`, limit: 60, cursor, include: ['customMetadata'] });
    const images = list.objects.filter((o) => /\.(png|jpe?g|webp)$/i.test(o.key)).map((o) => ({
      image: `/media/${o.key}`, label: o.customMetadata?.name || 'Uploaded image', category: 'uploads',
    }));
    const library = cursor ? [] : [
      ...ONBOARDING_DEFAULTS.pieces.filter((p) => p.value === 'chain').map((p) => ({ image: p.image, label: 'Chain', category: p.value })),
      ...Object.entries(ONBOARDING_DEFAULTS.styles).flatMap(([category, styles]) => styles.map(({ image, label }) => ({ image, label, category }))),
      ...artList().map((x) => ({ ...x, category: 'options' })),
    ];
    if (!cursor) library.push(...styleList().filter((x) => !library.some((y) => y.image === x.image)));
    return json({ images: [...library, ...images], next: list.truncated ? list.cursor : null });
  }

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
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: type }, customMetadata: { name: clean(fd.get('name') || file.name, 80) } });
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

// Permanent owner access: hash for authentication, encrypted token for admin retrieval.
const CLIENT_COOKIE_S = 30 * 86400;
const LEGACY_LINK_MESSAGE = 'This existing link is still active. Open it once in the owner portal to make it available here, or explicitly replace it.';
async function clientLink(request, env, clientId) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const client = await env.DB.prepare('SELECT id, name, archived_at FROM clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Client not found' }, 404);
  if (client.archived_at && request.method !== 'DELETE') return json({ error: 'This client is archived. Restore it first.' }, 409);
  if (request.method === 'DELETE') {
    await env.DB.prepare("UPDATE portal_sessions SET ended_at = ? WHERE client_id = ? AND kind = 'client' AND ended_at IS NULL").bind(Date.now(), client.id).run();
    return json({ ok: true });
  }
  if (request.method === 'GET') return json(await readClientLink(request, env, client.id));
  const body = await request.json().catch(() => ({}));
  const link = await makeClientLink(request, env, client.id, { replace: body?.replace === true });
  return link.url ? json(link) : json({ error: LEGACY_LINK_MESSAGE, legacy: true }, 409);
}

async function readClientLink(request, env, clientId) {
  const session = await env.DB.prepare("SELECT * FROM portal_sessions WHERE client_id = ? AND kind = 'client' AND ended_at IS NULL AND (expires_at = 0 OR expires_at > ?) ORDER BY started_at DESC LIMIT 1")
    .bind(clientId, Date.now()).first();
  if (!session) return { active: false, url: null };
  const info = { active: true, createdAt: session.started_at, expiresAt: session.expires_at || null };
  try {
    const token = await openPortalToken(env, session);
    if (!safeEqual(await sha256(token), session.token_hash)) throw new Error('Invalid retained link.');
    const origin = new URL(request.url).origin.replace('//builder.', '//');
    return { ...info, url: `${origin}/portal#k=${token}` };
  } catch {
    // Legacy hash-only links cannot be reversed. Keep them active until their owner visits.
    return { ...info, url: null, legacy: true };
  }
}

// Reuse the same owner link for onboarding and future visits; only an explicit replacement revokes it.
async function makeClientLink(request, env, clientId, { replace = false } = {}) {
  if (!replace) {
    const current = await readClientLink(request, env, clientId);
    if (current.active) return current;
  }
  const now = Date.now();
  const session = { id: rid(12), client_id: clientId };
  const token = rid(40), cipher = await sealPortalToken(env, session, token);
  await env.DB.batch([
    env.DB.prepare(`UPDATE portal_sessions SET ended_at = ? WHERE client_id = ? AND kind = 'client' AND ended_at IS NULL${replace ? '' : ' AND expires_at != 0 AND expires_at <= ?'}`)
      .bind(now, clientId, ...(replace ? [] : [now])),
    env.DB.prepare("INSERT INTO portal_sessions (id, token_hash, client_id, kind, ip, started_at, expires_at, token_cipher) SELECT ?,?,?,?,?,?,0,? WHERE NOT EXISTS (SELECT 1 FROM portal_sessions WHERE client_id = ? AND kind = 'client' AND ended_at IS NULL)")
      .bind(session.id, await sha256(token), clientId, 'client', request.headers.get('cf-connecting-ip') || 'local', now, cipher, clientId),
  ]);
  return readClientLink(request, env, clientId);
}

async function retainClientLink(env, session, token) {
  if (session.kind !== 'client') return;
  if (!session.token_cipher || session.expires_at !== 0) {
    const cipher = await sealPortalToken(env, session, token);
    await env.DB.prepare("UPDATE portal_sessions SET token_cipher = ?, expires_at = 0 WHERE id = ? AND ended_at IS NULL")
      .bind(cipher, session.id).run();
    session.expires_at = 0;
  }
}

const notify = (env, kind, title, ref) => env.DB.prepare('INSERT INTO notifications (id, kind, title, ref, created_at) VALUES (?,?,?,?,?)').bind(rid(12), kind, clean(title, 160), ref || null, Date.now());

// ---------- Onboarding klijenta ----------
// Admin šalje onboarding: nacrt za klijenta + njegov portal link (isti link kasnije vodi u običan portal).
async function startOnboarding(request, env, clientId) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const client = await env.DB.prepare('SELECT id, name, data, archived_at FROM clients WHERE id = ?').bind(clientId).first();
  if (!client) return json({ error: 'Client not found' }, 404);
  if (client.archived_at) return json({ error: 'This client is archived. Restore it first.' }, 409);
  const link = await makeClientLink(request, env, client.id);
  if (!link.url) return json({ error: LEGACY_LINK_MESSAGE, legacy: true }, 409);
  const body = await request.json().catch(() => ({}));
  // Po jedan onboarding za svaku formu: id = isti link ponovo, fresh = novi nacrt, bez toga zadnji neupotrijebljen.
  let ob = null;
  if (body?.id) {
    ob = await env.DB.prepare('SELECT id, status FROM onboardings WHERE id = ? AND client_id = ?').bind(String(body.id), client.id).first();
    if (!ob) return json({ error: 'Onboarding not found' }, 404);
  } else if (!body?.fresh) {
    ob = await env.DB.prepare("SELECT id, status FROM onboardings WHERE client_id = ? AND status != 'done' ORDER BY created_at DESC LIMIT 1").bind(client.id).first();
  }
  if (!ob) {
    const cd = JSON.parse(client.data || '{}');
    const now = Date.now();
    ob = { id: rid(12), status: 'draft' };
    await env.DB.prepare('INSERT INTO onboardings (id, client_id, data, status, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .bind(ob.id, client.id, JSON.stringify({ formName: clean(body?.name, 80), store: { name: client.name, website: cd.website || '', logo: cd.logo || '' } }), 'draft', now, now).run();
  }
  return json({ ...link, onboarding: ob });
}

// Link nosi id onboardinga; bez njega prvi neposlat, pa najnoviji.
function pickOnboarding(request, env, clientId) {
  const id = new URL(request.url).searchParams.get('onboarding');
  const want = /^[a-z0-9]{6,}$/.test(id || '') ? id : null;
  return env.DB.prepare("SELECT * FROM onboardings WHERE client_id = ? AND (? IS NULL OR id = ?) ORDER BY status = 'draft' DESC, created_at DESC LIMIT 1").bind(clientId, want, want).first();
}

async function adminOnboardings(request, env, p) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  let m;
  if (p === '/api/admin/onboardings' && request.method === 'GET') {
    const rows = (await env.DB.prepare("SELECT o.id, o.client_id, c.name, json_extract(o.data, '$.formName') AS form_name, o.status, o.created_at, o.updated_at, o.submitted_at, o.form_id FROM onboardings o LEFT JOIN clients c ON c.id = o.client_id ORDER BY o.updated_at DESC LIMIT 200").all()).results;
    return json({ onboardings: rows });
  }
  if ((m = p.match(/^\/api\/admin\/onboardings\/([a-z0-9]+)$/)) && request.method === 'GET') {
    const r = await env.DB.prepare('SELECT o.*, c.name FROM onboardings o LEFT JOIN clients c ON c.id = o.client_id WHERE o.id = ?').bind(m[1]).first();
    return r ? json({ onboarding: { ...r, data: JSON.parse(r.data || '{}') } }) : json({ error: 'Not found' }, 404);
  }
  // Nacrt koji klijent još nije poslao može da se povuče; poslat ostaje kao zapis.
  if ((m = p.match(/^\/api\/admin\/onboardings\/([a-z0-9]+)$/)) && request.method === 'DELETE') {
    const r = await env.DB.prepare("DELETE FROM onboardings WHERE id = ? AND status = 'draft'").bind(m[1]).run();
    return r.meta.changes ? json({ ok: true }) : json({ error: 'Only an onboarding that was not sent can be removed.' }, 409);
  }
  // Forma iz poslatog onboardinga: slike se kopiraju u folder forme (i logo kod klijenta), pa admin pregleda formu u builderu.
  if ((m = p.match(/^\/api\/admin\/onboardings\/([a-z0-9]+)\/build$/)) && request.method === 'POST') {
    const ob = await env.DB.prepare('SELECT * FROM onboardings WHERE id = ?').bind(m[1]).first();
    if (!ob) return json({ error: 'Not found' }, 404);
    if (ob.status === 'done') return json({ error: 'A form was already created from this onboarding.' }, 409);
    if (ob.status === 'draft') return json({ error: 'The client has not sent this onboarding yet.' }, 409);
    const client = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(ob.client_id).first();
    if (!client) return json({ error: 'Client not found' }, 404);
    // Zauzmi onboarding (dvostruki klik ne pravi dvije forme). Pravljenje koje je palo usred posla se može ponoviti poslije STALE_BUILD_MS.
    const claim = await env.DB.prepare("UPDATE onboardings SET status = 'building', updated_at = ? WHERE id = ? AND (status = 'submitted' OR (status = 'building' AND updated_at < ?))").bind(Date.now(), ob.id, Date.now() - STALE_BUILD_MS).run();
    if (!claim.meta.changes) return json({ error: 'This form is still being created. Please wait a moment and refresh.' }, 409);
    try {
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
      const images = [...(d.pieces || []).flatMap((piece) => [piece?.image, ...(piece.styles || []).map((s) => s?.image), ...Object.values(piece.customSpecs || {}).flat().map((x) => x?.image)]), ...(d.products || []).map((x) => x?.image), ...(d.customMetals || []).map((x) => x?.image), ...(d.customStones || []).map((x) => x?.image)];
      for (const u of images) if (u?.startsWith(prefix) && !map.has(u)) map.set(u, await copy(u, `forms/${id}`));
      const logo = d.store?.logo?.startsWith(prefix) ? await copy(d.store.logo, `clients/${client.id}`) : d.store?.logo?.startsWith('/media/clients/') ? d.store.logo : '';
      const form = formFromOnboarding(d, { id, clientId: client.id, brand: clean(d.store?.name, 60) || client.name, logo, img: (u) => (u.startsWith('/library/') ? u : map.get(u) || '') });
      validateFormDef(form, id);
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
    } catch (e) {
      console.error('onboarding build failed', ob.id, e);
      await env.DB.prepare("UPDATE onboardings SET status = 'submitted' WHERE id = ? AND status = 'building'").bind(ob.id).run();
      return json({ error: `Could not create the form: ${e.message}` }, 400);
    }
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
  const start = monthStart();
  const [leads, renders, links, tests, month] = await env.DB.batch([
    env.DB.prepare('SELECT form_id, COUNT(*) AS leads, MAX(created_at) AS last_lead FROM leads GROUP BY form_id'),
    env.DB.prepare("SELECT l.form_id, SUM(CASE WHEN r.status = 'ok' THEN 1 ELSE 0 END) AS renders, SUM(r.cost_usd) AS cost FROM renders r JOIN leads l ON l.id = r.lead_id GROUP BY l.form_id"),
    env.DB.prepare("SELECT client_id, MAX(started_at) AS created_at FROM portal_sessions WHERE kind = 'client' AND ended_at IS NULL AND (expires_at = 0 OR expires_at > ?) GROUP BY client_id").bind(Date.now()),
    env.DB.prepare("SELECT form_id, COUNT(*) AS tests, SUM(cost_usd) AS cost FROM test_renders WHERE status = 'ok' GROUP BY form_id"),
    env.DB.prepare('SELECT f.client_id, SUM(r.cost_usd) AS cost FROM renders r JOIN leads l ON l.id = r.lead_id JOIN forms f ON f.id = l.form_id WHERE r.created_at >= ? AND f.client_id IS NOT NULL GROUP BY f.client_id').bind(start),
  ]);
  const stats = {};
  const row = (id) => (stats[id] ||= { leads: 0, renders: 0, cost: 0, lastLead: null, tests: 0, testCost: 0 });
  for (const r of leads.results) Object.assign(row(r.form_id), { leads: r.leads, lastLead: r.last_lead });
  for (const r of renders.results) Object.assign(row(r.form_id), { renders: r.renders || 0, cost: r.cost || 0 });
  // Probni renderi iz buildera su pravi trošak: ulaze u ukupno, a posebno se vidi koliko je na njih otišlo.
  for (const r of tests.results) { const x = row(r.form_id); x.tests = r.tests; x.testCost = r.cost || 0; x.cost += r.cost || 0; }
  return json({
    stats, links: Object.fromEntries(links.results.map((r) => [r.client_id, { createdAt: r.created_at }])),
    month: { start, limit: monthlyBudget(env), clients: Object.fromEntries(month.results.map((r) => [r.client_id, r.cost || 0])) },
  });
}

// Token iz zaglavlja (skripte) ili HttpOnly kolačića (browser: admin pregled ima prednost nad klijentovim linkom).
async function portalSession(request, env) {
  const c = cookies(request);
  const token = request.headers.get('x-portal-token') || c.aik_viewas || c.aik_portal;
  if (!token || token.length < 20) return null;
  const s = await env.DB.prepare('SELECT * FROM portal_sessions WHERE token_hash = ?').bind(await sha256(token)).first();
  if (!activePortalSession(s)) return null;
  await retainClientLink(env, s, token);
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
  const token = String(b?.token || '');
  if (token.length < 20) return json({ error: 'Invalid link.' }, 400);
  const s = await env.DB.prepare('SELECT * FROM portal_sessions WHERE token_hash = ?').bind(await sha256(token)).first();
  if (!activePortalSession(s)) return json({ error: 'This link no longer works.' }, 401);
  await retainClientLink(env, s, token);
  const name = s.kind === 'view-as' ? 'aik_viewas' : 'aik_portal';
  const maxAge = s.kind === 'client' ? CLIENT_COOKIE_S : Math.max(60, Math.floor((s.expires_at - Date.now()) / 1000));
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

async function portalApi(request, env, p, secure, ctx) {
  const sess = await portalSession(request, env);
  if (!sess) return json({ error: 'Session expired. Open the portal again.' }, 401);
  // Brzina (22.11.2026): klijent i forme u isto vrijeme; svaki upit u D1 je jedan put do baze.
  const [client, formRes] = await Promise.all([
    env.DB.prepare('SELECT id, name, data FROM clients WHERE id = ?').bind(sess.client_id).first(),
    env.DB.prepare('SELECT id, data, template, updated_at, archived_at FROM forms WHERE client_id = ? ORDER BY updated_at DESC').bind(sess.client_id).all(),
  ]);
  if (!client) return json({ error: 'Client not found' }, 404);

  // Admin zatvara svoj pregled. Klijentov link se ovdje ne gasi (odjava samo briše token u browseru).
  if (p === '/api/portal/exit' && request.method === 'POST') {
    if (sess.kind === 'view-as') await env.DB.prepare('UPDATE portal_sessions SET ended_at = ? WHERE id = ?').bind(Date.now(), sess.id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'set-cookie': clearCookie('aik_viewas', secure) } });
  }
  // Onboarding: zlatar popunjava svoj vodič; čuva se dok kuca, Send ga šalje adminu.
  if (p.startsWith('/api/portal/onboarding')) return portalOnboarding(request, env, p, client, sess);
  const formRows = formRes.results;
  const forms = Object.fromEntries(formRows.map((r) => [r.id, JSON.parse(r.data)]));

  if (p === '/api/portal/me' && request.method === 'GET') {
    const d = JSON.parse(client.data || '{}');
    const [stats, perRows, gen, ob, speed, market, spent] = await Promise.all([env.DB.prepare(`SELECT COUNT(DISTINCT l.id) AS leads, COUNT(r.id) AS renders, COUNT(DISTINCT CASE WHEN l.created_at > ? THEN l.id END) AS recent
      FROM leads l JOIN forms f ON f.id = l.form_id LEFT JOIN renders r ON r.lead_id = l.id AND r.status = 'ok' WHERE f.client_id = ?`).bind(Date.now() - 30 * 86400_000, client.id).first(),
    // Po formi: upiti, renderi i zadnji upit. Trošak po formi klijent ne vidi; vidi samo mjesečnu potrošnju naspram budžeta.
    env.DB.prepare(`SELECT l.form_id, COUNT(DISTINCT l.id) AS leads, COUNT(r.id) AS renders, MAX(l.created_at) AS last_lead
      FROM leads l JOIN forms f ON f.id = l.form_id LEFT JOIN renders r ON r.lead_id = l.id AND r.status = 'ok' WHERE f.client_id = ? GROUP BY l.form_id`).bind(client.id).all(),
    // Prosječno vrijeme generisanja (slika i video) i broj videa, za statistiku na vrhu portala.
    env.DB.prepare(`SELECT
        (SELECT AVG(r.ms) FROM renders r JOIN leads l ON l.id = r.lead_id JOIN forms f ON f.id = l.form_id WHERE f.client_id = ?1 AND r.status = 'ok' AND r.kind IS NULL AND r.ms > 0) AS render_ms,
        (SELECT AVG(fl.ms) FROM films fl JOIN leads l ON l.id = fl.lead_id JOIN forms f ON f.id = l.form_id WHERE f.client_id = ?1 AND fl.status = 'ok' AND fl.ms > 0 AND fl.model = ?2) AS film_ms,
        (SELECT COUNT(*) FROM films fl JOIN leads l ON l.id = fl.lead_id JOIN forms f ON f.id = l.form_id WHERE f.client_id = ?1 AND fl.status = 'ok') AS films`).bind(client.id, VIDEO_MODELS[primaryFilm(env)].api).first(),
    pickOnboarding(request, env, client.id),
    replySpeed(env, client.id),
    getMarket(env).catch(() => null),
    clientMonthCost(env, client.id),
    ]);
    const per = Object.fromEntries(perRows.results.map((r) => [r.form_id, r]));
    return json({
      session: { kind: sess.kind, expiresAt: sess.expires_at || null },
      mail: mailOn(env),
      speed,
      client: { id: client.id, name: client.name, logo: d.logo || null, website: d.website || '' },
      onboarding: ob ? { id: ob.id, status: ob.status, rev: ob.rev, data: JSON.parse(ob.data || '{}'), updatedAt: ob.updated_at, submittedAt: ob.submitted_at } : null,
      ...(ob && ob.status === 'draft' ? { onboardingDefaults: ONBOARDING_DEFAULTS, onboardingSuggestions: await onboardingSuggestions(env, client.id) } : {}),
      forms: formRows.filter((r) => !r.archived_at).map((r) => ({
        id: r.id, name: forms[r.id].name, template: r.template, label: TEMPLATES[r.template]?.label || 'Custom', updated_at: r.updated_at,
        leads: per[r.id]?.leads || 0, renders: per[r.id]?.renders || 0, lastLead: per[r.id]?.last_lead || null,
      })),
      stats: { leads: stats?.leads || 0, renders: stats?.renders || 0, recent: stats?.recent || 0, films: gen?.films || 0, renderMs: Math.round(gen?.render_ms || 0), filmMs: Math.round(gen?.film_ms || 0) },
      pricing: d.pricing || null,
      market,
      // Izbori formi koje kalkulator cijene treba (natpisi), po formi.
      formSpecs: Object.fromEntries(formRows.filter((r) => !r.archived_at).map((r) => [r.id, pricingSpec(forms[r.id])])),
      usage: { spent: Math.round(spent * 100) / 100, limit: monthlyBudget(env), resetsAt: monthStart(Date.now(), 1) },
    });
  }
  // Bookings (19.11.2026): kupci koji su na svojoj stranici kliknuli Reserve with a deposit ili Book an appointment.
  if (p === '/api/portal/bookings' && request.method === 'GET') return json(await portalBookings(env, client));
  // Zlatar je otvorio tab: zahtjevi do sada su viđeni (obavještenje nestaje). Admin pregled ne mijenja ništa.
  if (p === '/api/portal/bookings/seen' && request.method === 'POST') {
    if (sess.kind === 'view-as') return json({ ok: true, readOnly: true });
    const at = Date.now();
    await env.DB.prepare(`UPDATE clients SET data = json_set(COALESCE(data, '{}'), '$.bookingsSeenAt', ?) WHERE id = ?`).bind(at, client.id).run();
    return json({ ok: true, seenAt: at });
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
    // Filter po komadu (District 19.11.2026: "filter po kategoriji proizvoda"): odgovor "type" iz upita.
    const piece = /^[a-z0-9-]{1,40}$/.test(u.searchParams.get('piece') || '') ? u.searchParams.get('piece') : '';
    if (piece) { where.push("json_extract(l.answers, '$.type') = ?"); args.push(piece); }
    // Filter po tagu i po budžetu kupca (District 24.11.2026).
    const tag = cleanTag(u.searchParams.get('tag'));
    if (tag) { where.push('EXISTS (SELECT 1 FROM json_each(COALESCE(l.tags, \'[]\')) jt WHERE jt.value = ?)'); args.push(tag); }
    // Vrijednost odgovora je slug ili (starije forme) sam natpis raspona; ide kao parametar upita.
    const budget = clean(u.searchParams.get('budget'), 60);
    if (budget) { where.push("json_extract(l.answers, '$.budget') = ?"); args.push(budget); }
    // Filter po video modelu (22.11.2026): samo upiti koji imaju video tog modela, i u kartici samo ti videi.
    const video = VIDEO_MODELS[u.searchParams.get('video')] ? u.searchParams.get('video') : '';
    if (video) { where.push("EXISTS (SELECT 1 FROM films vf WHERE vf.lead_id = l.id AND vf.model = ? AND vf.status IN ('ok', 'pending'))"); args.push(VIDEO_MODELS[video].api); }
    // Jedan dan (klik na traku u portalu): od ponoći do ponoći po vremenskoj zoni pregledača (?tz= u minutama).
    // Dani za traku: od zadnjih 90 dana, ili od početka mjeseca/sedmice koju zlatar lista strelicama (do 2 godine unazad).
    const dayFrom = Math.max(Date.now() - 730 * 864e5, Math.min(Date.now() - 90 * 864e5, Number(u.searchParams.get('dfrom')) || Infinity));
    const baseWhere = [...where];
    const baseArgs = [...args];
    const dayM = (u.searchParams.get('day') || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dayM) {
      const tzOff = Math.max(-840, Math.min(840, Number(u.searchParams.get('tz')) || 0));
      const from = Date.UTC(+dayM[1], +dayM[2] - 1, +dayM[3]) + tzOff * 60_000;
      where.push('l.created_at >= ? AND l.created_at < ?');
      args.push(from, from + 864e5);
    }
    // Brzina (22.11.2026): sve što ne zavisi od stranice ide u isto vrijeme kad i lista (ranije 7 upita zaredom).
    const tz = Math.max(-840, Math.min(840, Number(u.searchParams.get('tz')) || 0));
    const [leadRes, countRows, pieceRows, dayRes, vrowsRes, tagRows, budgetRows] = await Promise.all([env.DB.prepare(`SELECT l.id, l.form_id, l.name, l.email, l.phone, l.answers, l.ref_key, l.files, l.created_at, l.status, l.note, l.quotes, l.page_key, l.page, l.tags,
        l.alerted_at, l.auto_sent_at, l.first_reply_at, l.order_no, l.order_data
      FROM leads l JOIN forms f ON f.id = l.form_id WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT ${PAGE_SIZE + 1}`).bind(...args).all(),
    // Brojevi po statusu prate izabrani komad; brojevi po komadu su uvijek za sve upite zlatara.
    env.DB.prepare(`SELECT COALESCE(l.status, 'new') AS s, COUNT(*) AS n FROM leads l JOIN forms f ON f.id = l.form_id WHERE f.client_id = ?${piece ? " AND json_extract(l.answers, '$.type') = ?" : ''} GROUP BY COALESCE(l.status, 'new')`).bind(...(piece ? [client.id, piece] : [client.id])).all(),
    env.DB.prepare(`SELECT json_extract(l.answers, '$.type') AS t, COUNT(*) AS n FROM leads l JOIN forms f ON f.id = l.form_id WHERE f.client_id = ? GROUP BY t`).bind(client.id).all(),
    // Upiti po danu (zlatar prati koliko mu dolazi dnevno): dan po vremenskoj zoni pregledača, zadnjih 90 dana, isti filteri kao lista.
    env.DB.prepare(`SELECT strftime('%Y-%m-%d', (l.created_at / 1000) - ? * 60, 'unixepoch') AS d, l.form_id AS fid, COUNT(*) AS n FROM leads l JOIN forms f ON f.id = l.form_id
        WHERE ${baseWhere.filter((w) => w !== 'l.created_at < ?').join(' AND ')} AND l.created_at >= ? GROUP BY d, fid`).bind(tz, ...baseArgs.filter((_, k) => k !== 1), dayFrom).all(),
    // Video modeli za filter: broj gotovih videa, prosječno vrijeme i cijena po modelu (za sve upite zlatara).
    env.DB.prepare(`SELECT fl.model, COUNT(*) AS n, AVG(CASE WHEN fl.ms > 0 THEN fl.ms END) AS ms, AVG(fl.cost_usd) AS cost FROM films fl JOIN leads l ON l.id = fl.lead_id JOIN forms f ON f.id = l.form_id
        WHERE f.client_id = ? AND fl.status = 'ok' GROUP BY fl.model`).bind(client.id).all(),
    // Tagovi i budžeti sa brojem upita (za čipove filtera), za sve upite zlatara.
    env.DB.prepare(`SELECT jt.value AS t, COUNT(*) AS n FROM leads l JOIN forms f ON f.id = l.form_id, json_each(COALESCE(l.tags, '[]')) jt WHERE f.client_id = ? GROUP BY jt.value ORDER BY n DESC LIMIT 40`).bind(client.id).all(),
    env.DB.prepare(`SELECT json_extract(l.answers, '$.budget') AS b, COUNT(*) AS n FROM leads l JOIN forms f ON f.id = l.form_id WHERE f.client_id = ? AND json_extract(l.answers, '$.budget') IS NOT NULL GROUP BY b`).bind(client.id).all(),
    ]);
    const leads = leadRes.results;
    // Won lead bez broja narudžbe (npr. Won prije praćenja narudžbi) dobija broj sada.
    for (const l of leads.slice(0, PAGE_SIZE).filter((x) => x.status === 'won' && !x.order_no)) {
      const o = await assignOrder(env, l.id, client).catch((e) => { console.error('order', l.id, e.message); return null; });
      if (o) { l.order_no = o.no; l.order_data = o.data; }
    }
    const more = leads.length > PAGE_SIZE;
    const pageLeads = leads.slice(0, PAGE_SIZE);
    const oldest = pageLeads.length ? pageLeads[pageLeads.length - 1].created_at : before;
    const [renders, filmRows] = pageLeads.length ? await Promise.all([
      env.DB.prepare(`SELECT r.lead_id, r.n, r.image_key, r.tweak, r.kind, r.ms FROM renders r JOIN leads l ON l.id = r.lead_id JOIN forms f ON f.id = l.form_id
          WHERE f.client_id = ? AND l.created_at < ? AND l.created_at >= ? AND r.status = 'ok' AND r.image_key IS NOT NULL ORDER BY r.created_at`).bind(client.id, before, oldest).all(),
      // Video komada (dugme kupca ili pozadinski): gotovi idu uz upit.
      env.DB.prepare(`SELECT fl.* FROM films fl JOIN leads l ON l.id = fl.lead_id JOIN forms f ON f.id = l.form_id
          WHERE f.client_id = ? AND l.created_at < ? AND l.created_at >= ? AND fl.status IN ('ok', 'pending') ORDER BY fl.created_at`).bind(client.id, before, oldest).all(),
    ]).then(([r, f]) => [r.results, f.results]) : [[], []];
    const counts = Object.fromEntries(countRows.results.map((r) => [r.s, r.n]));
    const pieces = Object.fromEntries(pieceRows.results.filter((r) => r.t).map((r) => [String(r.t), r.n]));
    const days = {};
    for (const r of dayRes.results) (days[r.d] ||= {})[r.fid] = r.n;
    let films = filmRows;
    // Videi na čekanju se provjere kod Pike u pozadini (ranije je lista čekala Piku); portal ih vidi pri sljedećem osvježavanju.
    const waiting = films.filter((fl) => fl.status === 'pending').slice(0, 6);
    if (pikaOn(env) && waiting.length) {
      const work = Promise.all(waiting.map((fl) => settleFilm(env, fl).catch(() => null)));
      if (ctx?.waitUntil) ctx.waitUntil(work); else await work;
    }
    if (video) films = films.filter((fl) => fl.model === VIDEO_MODELS[video].api);
    const vrows = vrowsRes.results;
    const videoModels = Object.entries(VIDEO_MODELS).map(([k, m]) => {
      const r = vrows.find((x) => x.model === m.api);
      return { key: k, label: m.label, customer: k === primaryFilm(env), count: r?.n || 0, ms: Math.round(r?.ms || 0) || null, cost: r ? +Number(r.cost || 0).toFixed(3) : m.est };
    }).filter((m) => filmModelsOn(env).includes(m.key));   // samo modeli koji su uključeni (stari Wan/Seedance videi se ne pokazuju)
    return json({
      more, next: more ? oldest : null, counts, days, pieces, videoModels,
      tags: Object.fromEntries(tagRows.results.filter((r) => typeof r.t === 'string').map((r) => [r.t, r.n])),
      budgets: Object.fromEntries(budgetRows.results.filter((r) => r.b != null).map((r) => [String(r.b), r.n])),
      leads: pageLeads.map((l) => {
        const a = JSON.parse(l.answers);
        let files = {};
        try { files = JSON.parse(l.files || '{}'); } catch {}
        return {
          id: l.id, formId: l.form_id, form: forms[l.form_id]?.name || l.form_id, name: l.name, email: l.email, phone: l.phone, created_at: l.created_at,
          status: l.status || 'new', note: l.note || '', tags: parseTags(l.tags), quotes: leadQuotes(l.quotes), page: pageInfo(l),
          alertedAt: l.alerted_at || null, autoSentAt: l.auto_sent_at || null, firstReplyAt: l.first_reply_at || null,
          order: orderView(l.order_no, l.order_data),
          vision: a.vision || '', details: leadDetails(forms[l.form_id], a), answers: pricingAnswers(a),
          photos: [
            ...(l.ref_key ? [{ label: 'Inspiration', key: l.ref_key }] : []),
            ...Object.entries(files).map(([k, key]) => ({ label: k.replace(/__more$/, ' (extra)').replace(/_/g, ' '), key })),
            ...renders.filter((r) => r.lead_id === l.id && r.kind === 'tryon').map((r) => ({ label: 'On their smile', key: r.image_key })),
          ],
          renders: renders.filter((r) => r.lead_id === l.id && r.kind !== 'tryon').map((r) => ({ url: `/media/${r.image_key}`, tweak: r.tweak, ms: r.ms || null })),
          films: films.filter((fl) => fl.lead_id === l.id && fl.status !== 'error' && filmModelsOn(env).includes(modelKeyOf(fl.model))).map((fl) => {
            const mk = modelKeyOf(fl.model);
            const tag = { model: mk || '', label: VIDEO_MODELS[mk]?.label || 'Video', customer: customerFilm(env, fl) };
            return fl.video_key ? { url: `/media/${fl.video_key}`, ms: fl.ms || null, cost: fl.cost_usd ?? null, ...tag } : { pending: true, ...tag };
          }),
        };
      }),
    });
  }
  // Tabela cijena za kalkulator (zlatar je sam unosi; cijena metala se stalno mijenja). Admin pregled ne mijenja.
  // Cijene smije mijenjati i admin u pregledu klijenta (Ognjen ih postavlja zlataru), za razliku od statusa i bilješki.
  if (p === '/api/portal/pricing' && request.method === 'PUT') {
    const b = await request.json().catch(() => ({}));
    const pricing = cleanPricing(b.pricing);
    const d = JSON.parse(client.data || '{}');
    // Automatska prva poruka važi samo za leadove poslije uključenja (stari leadovi ne dobijaju mejl naknadno).
    const prev = d.pricing || {};
    const autoSendSince = pricing.autoSend ? (prev.autoSend === true && Number(prev.autoSendSince) > 0 ? prev.autoSendSince : Date.now()) : null;
    d.pricing = { ...pricing, autoSendSince, updatedAt: Date.now() };
    await env.DB.prepare('UPDATE clients SET data = ? WHERE id = ?').bind(JSON.stringify(d), client.id).run();
    return json({ pricing: d.pricing });
  }
  // Quote poruka za kupca (18.11.2026): zlatar podesi specifikacije u "Fits the budget", Workers AI napiše kratku poruku.
  // Ništa se ne čuva i ne šalje; zlatar je kopira (Copy) u svoj softver za poruke. Radi i u admin pregledu.
  let qm;
  if ((qm = p.match(/^\/api\/portal\/leads\/([a-z0-9]+)\/quote$/)) && request.method === 'POST') {
    const lead = await env.DB.prepare('SELECT l.id, l.name, l.page_key, f.data AS form_data FROM leads l JOIN forms f ON f.id = l.form_id WHERE l.id = ? AND f.client_id = ?').bind(qm[1], client.id).first();
    if (!lead) return json({ error: 'Not found' }, 404);
    const b = await request.json().catch(() => ({}));
    const out = await writeQuote(env, client, lead, b, new URL(request.url).origin);
    return out ? json(out) : json({ error: 'The quote needs a price first.' }, 400);
  }
  // Izmjena poruke (zlatar je uredi u polju): čuva se najnovija verzija, izbori i izvor ostaju.
  if ((qm = p.match(/^\/api\/portal\/leads\/([a-z0-9]+)\/quote$/)) && request.method === 'PUT') {
    const b = await request.json().catch(() => ({}));
    const slot = QUOTE_SLOTS.includes(b.slot) ? b.slot : null;
    // Podešena ponuda (22.11.2026): izbori i konačna cijena koje zlatar namjesti u Estimated price / Fits the budget.
    // Čuvaju se i bez poruke, a stranica kupca pokazuje baš njih.
    if (slot && b.message == null && ('spec' in b || 'price' in b || 'show' in b)) {
      const row = await env.DB.prepare('SELECT l.quotes FROM leads l JOIN forms f ON f.id = l.form_id WHERE l.id = ? AND f.client_id = ?').bind(qm[1], client.id).first();
      if (!row) return json({ error: 'Not found' }, 404);
      let quotes = {};
      try { quotes = JSON.parse(row.quotes || '{}') || {}; } catch {}
      const cur = quotes[slot] && typeof quotes[slot] === 'object' ? quotes[slot] : {};
      const at = Date.now();
      const next = { ...cur, adjAt: at };
      if ('spec' in b) { const sp = quoteSpecToSave(b.spec); if (sp) next.spec = sp; else delete next.spec; }
      if ('price' in b) { const pr = quotePrice(b.price); if (pr) next.price = pr; else delete next.price; }
      // Fits the budget se na stranici kupca pokazuje tek kad zlatar uključi "Show on sales page" (22.11.2026);
      // showAt ponovo pokreće rok ponude na stranici.
      if ('show' in b && slot === 'fit') { next.show = b.show === true; if (next.show && !cur.show) next.showAt = at; }
      await env.DB.prepare(`UPDATE leads SET quotes = json_set(COALESCE(quotes, '{}'), '$.${slot}', json(?)) WHERE id = ?`).bind(JSON.stringify(next), qm[1]).run();
      return json({ ok: true, at, price: next.price ?? null });
    }
    const msg = quoteMessageText(b.message);
    if (!slot || msg == null) return json({ error: 'Nothing to save.' }, 400);
    const at = Date.now();
    // msgFor: za koje izbore i cijenu je tekst (portal ga pošalje kad sam zamijeni cijenu u poruci), da se poslije
    // osvježavanja zna da li je poruka zastarjela.
    const mf = msgForText(b.msgFor);
    const r = await env.DB.prepare(`UPDATE leads SET quotes = json_set(quotes, '$.${slot}.msg', ?, '$.${slot}.edited', json('true'), '$.${slot}.at', ?${mf ? `, '$.${slot}.msgFor', ?` : ''})
      WHERE id = ? AND json_type(quotes, '$.${slot}.msg') = 'text' AND form_id IN (SELECT id FROM forms WHERE client_id = ?)`).bind(...[msg, at, ...(mf ? [mf] : []), qm[1], client.id]).run();
    return r.meta.changes ? json({ ok: true, at }) : json({ error: 'Generate the message first.' }, 404);
  }
  let lm;
  // Koraci iz portala koje server inače ne vidi (21.11.2026): Copy poruke i Copy mejla/telefona. Admin pregled se ne broji.
  if ((lm = p.match(/^\/api\/portal\/leads\/([a-z0-9]+)\/events$/)) && request.method === 'POST') {
    if (sess.kind === 'view-as') return json({ ok: true, readOnly: true });
    const b = await request.json().catch(() => ({}));
    const type = ['quote_copied', 'contact_copied'].includes(b.type) ? b.type : null;
    if (!type) return json({ error: 'Unknown event.' }, 400);
    const lead = await env.DB.prepare('SELECT l.id FROM leads l JOIN forms f ON f.id = l.form_id WHERE l.id = ? AND f.client_id = ?').bind(lm[1], client.id).first();
    if (!lead) return json({ error: 'Not found' }, 404);
    const meta = type === 'quote_copied' ? { slot: QUOTE_SLOTS.includes(b.slot) ? b.slot : null } : { what: ['email', 'phone'].includes(b.what) ? b.what : null };
    await logEvent(env, lead.id, type, meta);
    if (type === 'quote_copied') await markReply(env, lead.id);
    return json({ ok: true });
  }
  // Status i bilješka upita (zlatar prati šta je uradio); admin pregled ne mijenja podatke klijenta.
  if ((lm = p.match(/^\/api\/portal\/leads\/([a-z0-9]+)$/)) && request.method === 'PATCH') {
    if (sess.kind === 'view-as') return json({ error: 'Admin view is read-only.' }, 403);
    const b = await request.json().catch(() => ({}));
    const st = b.status != null ? String(b.status) : null;
    if (st != null && !LEAD_STATUSES.includes(st)) return json({ error: 'Unknown status.' }, 400);
    // Tagovi (24.11.2026): cijela lista se šalje i zamjenjuje (do 8, svaki do 24 znaka).
    const tags = Array.isArray(b.tags) ? JSON.stringify([...new Set(b.tags.map(cleanTag).filter(Boolean))].slice(0, 8)) : null;
    const before = await env.DB.prepare('SELECT l.status FROM leads l JOIN forms f ON f.id = l.form_id WHERE l.id = ? AND f.client_id = ?').bind(lm[1], client.id).first();
    if (!before) return json({ error: 'Not found' }, 404);
    const r = await env.DB.prepare(`UPDATE leads SET status = COALESCE(?, status), note = COALESCE(?, note), tags = COALESCE(?, tags), status_at = CASE WHEN ? IS NULL THEN status_at ELSE ? END WHERE id = ? AND form_id IN (SELECT id FROM forms WHERE client_id = ?)`)
      .bind(st, b.note != null ? String(b.note).slice(0, 2000) : null, tags, st, Date.now(), lm[1], client.id).run();
    if (!r.meta.changes) return json({ error: 'Not found' }, 404);
    // Istorija statusa (status_at čuva samo zadnju promjenu); Contacted/Quoted/Won je odgovor kupcu.
    if (st != null && st !== (before.status || 'new')) {
      await logEvent(env, lm[1], 'status', { from: before.status || 'new', to: st });
      if (REPLY_STATUSES.includes(st)) await markReply(env, lm[1]);
    }
    // Won = narudžba: broj za praćenje se dodjeljuje jednom i ostaje i ako se status kasnije promijeni.
    if (st === 'won') {
      const o = await assignOrder(env, lm[1], client);
      return json({ ok: true, order: o ? orderView(o.no, o.data) : null });
    }
    return json({ ok: true, ...(tags ? { tags: JSON.parse(tags) } : {}) });
  }
  // Statistika (24.11.2026, District: "Stats > tracking revenue, pipeline, opportunities, leads, budget total sum..."):
  // jedan red po upitu (bez slika), portal sam računa periode, pipeline i zbirove.
  if (p === '/api/portal/stats' && request.method === 'GET') return json(await portalStats(env, client));
  // Obavještenja (24.11.2026): novi upiti, kupac otvorio stranicu, Deposit/Appointment, automatske poruke, greške slanja.
  if (p === '/api/portal/notifications' && request.method === 'GET') return json(await portalNotifications(env, client));
  if (p === '/api/portal/notifications/seen' && request.method === 'POST') {
    if (sess.kind === 'view-as') return json({ ok: true, readOnly: true });
    const at = Date.now();
    await env.DB.prepare(`UPDATE clients SET data = json_set(COALESCE(data, '{}'), '$.notifSeenAt', ?) WHERE id = ?`).bind(at, client.id).run();
    return json({ ok: true, seenAt: at });
  }
  // Faza izrade i poruka kupcu za praćenje narudžbe (23.11.2026). Admin pregled ne mijenja podatke klijenta.
  if ((lm = p.match(/^\/api\/portal\/leads\/([a-z0-9]+)\/order$/)) && request.method === 'PATCH') {
    if (sess.kind === 'view-as') return json({ error: 'Admin view is read-only.' }, 403);
    const b = await request.json().catch(() => ({}));
    const row = await env.DB.prepare('SELECT l.id, l.order_no, l.order_data FROM leads l JOIN forms f ON f.id = l.form_id WHERE l.id = ? AND f.client_id = ?').bind(lm[1], client.id).first();
    if (!row) return json({ error: 'Not found' }, 404);
    if (!row.order_no) return json({ error: 'Mark the lead as Won first.' }, 409);
    const next = nextOrder(row.order_data, { stage: b.stage, note: b.note });
    if (!next) return json({ error: 'Unknown stage.' }, 400);
    await env.DB.prepare('UPDATE leads SET order_data = ? WHERE id = ?').bind(JSON.stringify(next), row.id).run();
    const prev = parseOrder(row.order_data).stage;
    if (next.stage !== prev) await logEvent(env, row.id, 'order_stage', { from: ORDER_STAGES[prev].key, to: ORDER_STAGES[next.stage].key });
    return json({ ok: true, order: orderView(row.order_no, JSON.stringify(next)) });
  }
  return json({ error: 'Not found' }, 404);
}

// ---------- Tagovi, statistika i obavještenja (24.11.2026) ----------
const cleanTag = (v) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
function parseTags(raw) {
  try { const t = JSON.parse(raw || '[]'); return Array.isArray(t) ? t.filter((x) => typeof x === 'string' && x).slice(0, 8) : []; } catch { return []; }
}
const STATS_MAX = 5000;
async function portalStats(env, client) {
  const rows = (await env.DB.prepare(`SELECT l.id, l.form_id, l.name, l.email, l.created_at, COALESCE(l.status, 'new') AS status, l.status_at, l.first_reply_at, l.tags,
      json_extract(l.answers, '$.type') AS type, json_extract(l.answers, '$.budget') AS budget,
      json_extract(l.quotes, '$.picked.price') AS p_price, json_extract(l.quotes, '$.picked.total') AS p_total,
      json_extract(l.quotes, '$.fit.price') AS f_price, json_extract(l.quotes, '$.fit.total') AS f_total, json_extract(l.quotes, '$.fit.show') AS f_show,
      json_extract(l.page, '$.views') AS views, json_array_length(COALESCE(json_extract(l.page, '$.actions'), '[]')) AS actions, l.order_no
    FROM leads l JOIN forms f ON f.id = l.form_id WHERE f.client_id = ? ORDER BY l.created_at DESC LIMIT ${STATS_MAX}`).bind(client.id).all()).results;
  const num = (v) => (Number(v) > 0 ? Math.round(Number(v)) : null);
  return {
    max: STATS_MAX,
    leads: rows.map((r) => ({
      id: r.id, formId: r.form_id, name: r.name, email: r.email, at: r.created_at, status: r.status, statusAt: r.status_at || null, replyAt: r.first_reply_at || null,
      type: r.type || '', budget: r.budget == null ? '' : String(r.budget), tags: parseTags(r.tags),
      // Vrijednost upita: cijena koju je zlatar ostavio u Estimated price, inače izračunata; Fits the budget posebno.
      value: num(r.p_price) ?? num(r.p_total), fit: num(r.f_price) ?? num(r.f_total), fitShown: r.f_show === 1 || r.f_show === true,
      views: Number(r.views) || 0, actions: Number(r.actions) || 0, order: r.order_no || null,
    })),
  };
}
// Automatske quote poruke nisu ovdje: stižu uz svaki lead (dvije po leadu) i samo bi zatrpale listu.
const NOTIFY_TYPES = ['created', 'page_view', 'page_action', 'auto_sent', 'auto_send_failed', 'alert_failed', 'order_created'];
async function portalNotifications(env, client) {
  const since = Date.now() - 30 * 864e5;
  const rows = (await env.DB.prepare(`SELECT e.id, e.lead_id, e.type, e.at, e.meta, l.name, l.email, json_extract(l.answers, '$.type') AS piece
      FROM lead_events e JOIN leads l ON l.id = e.lead_id
      WHERE e.client_id = ? AND e.at > ? AND e.type IN (${NOTIFY_TYPES.map(() => '?').join(',')})
      ORDER BY e.at DESC LIMIT 300`).bind(client.id, since, ...NOTIFY_TYPES).all()).results;
  let seenAt = 0;
  try { seenAt = Number(JSON.parse(client.data || '{}').notifSeenAt) || 0; } catch {}
  const items = [];
  for (const r of rows) {
    let meta = {};
    try { meta = JSON.parse(r.meta || '{}') || {}; } catch {}
    items.push({ id: r.id, lead: r.lead_id, type: r.type, at: r.at, name: r.name, email: r.email, piece: r.piece || '', meta: { action: meta.action || null, option: meta.option || null } });
    if (items.length >= 150) break;
  }
  return { seenAt, unseen: items.filter((x) => x.at > seenAt).length, items };
}

// ---------- Quote poruka (portal) ----------
// Piše poruku iz konačnih izbora (portal ili automatski) i čuva je uz lead. Ispod teksta ide link stranice kupca
// (19.11.2026: kupcu se šalje link sa njegovim dizajnom i ponudama), pa store info zlatara.
async function writeQuote(env, client, lead, b, origin, { auto = false } = {}) {
  let store = client.name;
  try { store = JSON.parse(lead.form_data || '{}').brand?.name || client.name; } catch {}
  const facts = quoteFacts(b, lead, store);
  if (!facts) return null;
  let info = '';
  try { info = quoteInfoText(JSON.parse(client.data || '{}').pricing?.quoteInfo) || ''; } catch {}
  facts.footer = !!info;
  const message = await quoteByAI(env, facts);
  const body = info ? dropSignature(message || quoteTemplate(facts), facts.store, info) : message || quoteTemplate(facts);
  const slot = QUOTE_SLOTS.includes(b.slot) ? b.slot : null;
  // Stanje slota prije nove poruke: "Show on sales page" i njegovo vrijeme ostaju.
  let cur = {};
  if (slot) { try { cur = JSON.parse((await env.DB.prepare('SELECT quotes FROM leads WHERE id = ?').bind(lead.id).first())?.quotes || '{}')?.[slot] || {}; } catch {} }
  const both = slot === 'fit' && cur.show === true;
  const link = lead.page_key ? `${both ? 'See both options side by side' : 'See your design and quote'}: ${origin}/p/${lead.page_key}` : '';
  const out = { message: [body, link, info].filter(Boolean).join('\n\n'), source: message ? 'ai' : 'template' };
  // Poruka ostaje zabilježena za taj lead (Ognjen 19.11.2026): poslije izlaska ili osvježavanja je ista, nova je zamjenjuje.
  if (slot) {
    // Cijena iz poruke se zaključava uz nju (22.11.2026): sa živim cijenama metala stranica kupca bi se inače
    // poslije par dana razlikovala od poslate poruke.
    const price = quotePrice(b.price) ?? facts.total;
    const keep = slot === 'fit' && cur.show ? { show: true, showAt: cur.showAt || null } : {};
    const saved = { ...keep, msg: out.message, source: out.source, spec: quoteSpecToSave(b.spec), total: facts.total, ...(price ? { price } : {}), ...(msgForText(b.msgFor) ? { msgFor: msgForText(b.msgFor) } : {}), edited: false, at: Date.now() };
    await env.DB.prepare(`UPDATE leads SET quotes = json_set(COALESCE(quotes, '{}'), '$.${slot}', json(?)) WHERE id = ?`).bind(JSON.stringify(saved), lead.id).run();
    out.saved = saved;
    await logEvent(env, lead.id, 'quote_generated', { slot, source: out.source, auto });
  }
  return out;
}
// Prva poruka bez zlatara (Ognjen 19.11.2026: "neka se prva poruka odmah generiše sa leadom"): Estimated price, tačno
// kako je kupac izabrao, istim računom kao portal. Ne dira poruku koju je zlatar već napravio; pokušava se samo jednom.
// Od 24.11.2026 (District: "add generated message, no reason to wait") i Fits the budget dobija svoju poruku odmah
// ($.autoFit), istim računom kao portal (middleGround + poređenje sa Estimated price); zlatar je i dalje podešava.
async function autoQuote(env, leadId, origin) {
  const row = await env.DB.prepare(`SELECT l.id, l.name, l.answers, l.quotes, l.page_key, f.data AS form_data, c.id AS client_id, c.name AS client_name, c.data AS client_data
      FROM leads l JOIN forms f ON f.id = l.form_id JOIN clients c ON c.id = f.client_id WHERE l.id = ?`).bind(leadId).first();
  if (!row) return null;
  let quotes = {};
  try { quotes = JSON.parse(row.quotes || '{}') || {}; } catch {}
  const doPicked = !quotes.picked && !quotes.auto;
  const doFit = !quotes.fit && !quotes.autoFit;
  if (!doPicked && !doFit) return null;
  const mark = (k) => env.DB.prepare(`UPDATE leads SET quotes = json_set(COALESCE(quotes, '{}'), '$.${k}', ?) WHERE id = ?`).bind(Date.now(), leadId).run();
  let pricing = null;
  try { pricing = JSON.parse(row.client_data || '{}').pricing || null; } catch {}
  pricing = await marketPricing(env, pricing);
  const form = JSON.parse(row.form_data || '{}');
  const ls = pricing && leadSpecFrom(pricingSpec(form), pricingAnswers(JSON.parse(row.answers || '{}')));
  const est = ls && estimate(pricing, ls.spec);
  if (!est || est.total == null) { if (doPicked) await mark('auto'); if (doFit) await mark('autoFit'); return null; }
  const client = { id: row.client_id, name: row.client_name, data: row.client_data };
  const lead = { id: row.id, name: row.name, page_key: row.page_key, form_data: row.form_data };
  let out = null;
  if (doPicked) {
    await mark('auto');
    out = await writeQuote(env, client, lead, { ...quoteBody(ls, ls.spec, est), slot: 'picked', spec: ls.spec }, origin, { auto: true });
  }
  // Fits the budget postoji samo kad kupac ima gornju granicu budžeta (inače je kartica "Your quote", ista kao izbor).
  const high = ls.budget?.high;
  if (doFit && Number.isFinite(high)) {
    await mark('autoFit');
    // Poređenje ide naspram Estimated price kako ga je zlatar ostavio (ako ga je već podesio), kao u portalu.
    const pickedSaved = quotes.picked?.spec && quotes.picked.spec.type === ls.spec.type ? { ...ls.spec, ...quotes.picked.spec } : ls.spec;
    const pe = estimate(pricing, pickedSaved);
    const orig = pe.total == null ? null : Number(quotes.picked?.price) > 0 ? Number(quotes.picked.price) : pe.total;
    const mg = middleGround(pricing, ls.spec, high, ls.choices);
    const spec = mg?.spec || ls.spec;
    const fe = estimate(pricing, spec);
    if (fe.total != null) {
      const b = { ...quoteBody(ls, spec, fe), slot: 'fit', spec };
      b.changes = specDiff({ ...ls, spec: pickedSaved }, spec);
      if (b.changes.length && orig != null && Math.round(orig) !== Math.round(fe.total)) Object.assign(b, { mode: 'fit', originalTotal: Math.round(orig), inBudget: fe.total <= high });
      const fit = await writeQuote(env, client, lead, b, origin, { auto: true });
      out = out || fit;
    }
  } else if (doFit) await mark('autoFit');
  return out;
}
// ---------- Dnevnik koraka, obavještenje radnji i prva poruka kupcu (21.11.2026) ----------
// Dokaz za zlatara (vrijeme do prvog odgovora, kopirane ponude, statusi) i brzina: radnja dobija mejl čim lead stigne,
// a kupac, ako je radnja to uključila, prvu poruku sa cijenom i linkom svoje stranice za par minuta, i u 11 uveče.
// Ništa se ne šalje bez RESEND_API_KEY + MAIL_FROM (vidi src/mail.js) i bez adresa koje radnja upiše u Pricing tabu.
const REPLY_STATUSES = ['contacted', 'quoted', 'won'];
const EVENTS_SINCE = Date.UTC(2026, 10, 21); // statistika odgovora samo od uvođenja dnevnika (stari leadovi nemaju korake)
const ALERT_WINDOW_MS = 30 * 60_000; // cron dopunjava obavještenja samo za svježe leadove (uključenje ne šalje staru gomilu)
const AUTO_SEND_DELAY_MS = 2 * 60_000; // kupac prvo stigne da vidi sliku; bez slike najkasnije poslije 6 min
const AUTO_SEND_NO_RENDER_MS = 6 * 60_000;
const AUTO_SEND_WINDOW_MS = 2 * 3600_000;
const NOTIFY_PER_RUN = 10;
const ORIGIN_BASE = ORIGIN.replace(/\/$/, '');

async function logEvent(env, leadId, type, meta = null, at = Date.now()) {
  try {
    await env.DB.prepare(`INSERT INTO lead_events (lead_id, client_id, type, at, meta) SELECT l.id, f.client_id, ?, ?, ? FROM leads l LEFT JOIN forms f ON f.id = l.form_id WHERE l.id = ?`)
      .bind(type, at, meta ? JSON.stringify(meta).slice(0, 1000) : null, leadId).run();
  } catch (e) { console.error('event', type, leadId, e.message); }
}
async function markReply(env, leadId, at = Date.now()) {
  try { await env.DB.prepare('UPDATE leads SET first_reply_at = ? WHERE id = ? AND first_reply_at IS NULL').bind(at, leadId).run(); } catch (e) { console.error('reply', leadId, e.message); }
}
function notifySettings(clientData) {
  let p = {};
  try { p = JSON.parse(clientData || '{}').pricing || {}; } catch {}
  return { alertEmails: emailList(p.alertEmails), replyTo: validEmail(p.replyTo), autoSend: p.autoSend === true, autoSendSince: Number(p.autoSendSince) || 0 };
}
function notifyRow(env, leadId) {
  return env.DB.prepare(`SELECT l.*, f.data AS form_data, c.id AS client_id, c.name AS client_name, c.data AS client_data
      FROM leads l JOIN forms f ON f.id = l.form_id JOIN clients c ON c.id = f.client_id WHERE l.id = ?`).bind(leadId).first();
}
function storeName(row) {
  try { return JSON.parse(row.form_data || '{}').brand?.name || row.client_name || 'Your jeweler'; } catch { return row.client_name || 'Your jeweler'; }
}
const pieceName = (a) => (typeof a?.type === 'string' && a.type ? a.type.replace(/[-_]+/g, ' ') : 'custom piece');
const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Jednostavan HTML iz teksta: pasusi, prelomi i klikabilni https linkovi (mejl klijenti bolje prikazuju nego čist tekst).
function textToHtml(text) {
  const body = String(text).split(/\n{2,}/).map((par) => `<p style="margin:0 0 14px">${escHtml(par).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#15181d;max-width:600px">${body}</div>`;
}

function leadAlertMail(row, origin) {
  const form = JSON.parse(row.form_data || '{}');
  const a = JSON.parse(row.answers || '{}');
  let quotes = {};
  try { quotes = JSON.parse(row.quotes || '{}') || {}; } catch {}
  const piece = pieceName(a);
  const first = String(row.name || '').split(/\s+/)[0] || 'the customer';
  const lines = [
    `New ${piece} lead from ${row.name}`,
    [`Email: ${row.email}`, row.phone ? `Phone: ${row.phone}${areaOf(row.phone) ? ` (${areaOf(row.phone).label}, by area code)` : ''}` : ''].filter(Boolean).join('\n'),
    a.vision ? `What they want:\n"${String(a.vision).slice(0, 600)}"` : '',
    leadDetails(form, a).slice(0, 14).map((d) => `${d.label}: ${d.value}`).join('\n'),
    quotes.picked?.msg ? `Ready-to-send quote message:\n\n${quotes.picked.msg}` : '',
    row.page_key ? `Their design and quote page: ${origin}/p/${row.page_key}?preview=1` : '',
    `Open your portal: ${origin}/portal`,
    `Reply to this email to answer ${first} directly.`,
  ].filter(Boolean);
  const text = lines.join('\n\n');
  return { subject: `New lead: ${row.name}, ${piece}`, text, html: textToHtml(text) };
}

async function alertShop(env, leadId, origin = ORIGIN_BASE) {
  if (!mailOn(env)) return null;
  const row = await notifyRow(env, leadId);
  if (!row || row.alerted_at) return null;
  const s = notifySettings(row.client_data);
  if (!s.alertEmails.length) return null;
  const claim = await env.DB.prepare('UPDATE leads SET alerted_at = ? WHERE id = ? AND alerted_at IS NULL').bind(Date.now(), leadId).run();
  if (!claim.meta.changes) return null;
  const mail = leadAlertMail(row, origin);
  try {
    const r = await sendMail(env, { to: s.alertEmails, subject: mail.subject, text: mail.text, html: mail.html, replyTo: row.email, fromName: `${storeName(row)} leads` });
    await logEvent(env, leadId, 'alert_sent', { to: s.alertEmails.length, id: r.id || null });
    return r;
  } catch (e) {
    // Pokušava se ponovo u sljedećem krugu crona, dok je lead svjež (ALERT_WINDOW_MS).
    await env.DB.prepare('UPDATE leads SET alerted_at = NULL WHERE id = ?').bind(leadId).run();
    await logEvent(env, leadId, 'alert_failed', { error: String(e.message).slice(0, 200) });
    console.error('lead alert', leadId, e.message);
    return null;
  }
}

// Prva poruka kupcu mejlom: sačuvana Estimated price poruka (sa linkom stranice i store infom), odgovor ide radnji.
// Samo kad je radnja uključila, upisala adresu za odgovore, lead je poslije uključenja, nov i niko mu još nije odgovorio.
async function autoSendFirst(env, leadId) {
  if (!mailOn(env)) return null;
  const row = await notifyRow(env, leadId);
  if (!row || row.auto_sent_at || row.first_reply_at || (row.status && row.status !== 'new')) return null;
  const s = notifySettings(row.client_data);
  if (!s.autoSend || !s.replyTo || !s.autoSendSince || row.created_at < s.autoSendSince) return null;
  let quotes = {};
  try { quotes = JSON.parse(row.quotes || '{}') || {}; } catch {}
  const msg = typeof quotes.picked?.msg === 'string' ? quotes.picked.msg.trim() : '';
  if (!msg) return null;
  const at = Date.now();
  const claim = await env.DB.prepare('UPDATE leads SET auto_sent_at = ? WHERE id = ? AND auto_sent_at IS NULL AND first_reply_at IS NULL').bind(at, leadId).run();
  if (!claim.meta.changes) return null;
  const store = storeName(row);
  const a = JSON.parse(row.answers || '{}');
  const text = `${msg}\n\nYou are getting this email because you asked ${store} for a custom design. Just reply to talk to us.`;
  try {
    const r = await sendMail(env, { to: row.email, subject: `Your custom ${pieceName(a)} design from ${store}`, text, html: textToHtml(text), replyTo: s.replyTo, fromName: store });
    await logEvent(env, leadId, 'auto_sent', { id: r.id || null }, at);
    await markReply(env, leadId, at);
    return r;
  } catch (e) {
    // Ne šalje se ponovo (ako je mejl ipak otišao, kupac ne smije dobiti dva); zlatar odgovara ručno kao i do sada.
    await logEvent(env, leadId, 'auto_send_failed', { error: String(e.message).slice(0, 200) });
    console.error('auto send', leadId, e.message);
    return null;
  }
}

async function notifySweep(env) {
  if (!mailOn(env)) return;
  const now = Date.now();
  // Lokalne provjere (DEV_MODE): NOTIFY_TEST_DELAY_MS skraćuje čekanja da test ne traje minutima.
  const test = env.DEV_MODE === '1' && env.NOTIFY_TEST_DELAY_MS != null ? Number(env.NOTIFY_TEST_DELAY_MS) : null;
  const alertDelay = test ?? 60_000;
  const sendDelay = test ?? AUTO_SEND_DELAY_MS;
  const noRender = test ?? AUTO_SEND_NO_RENDER_MS;
  const alerts = (await env.DB.prepare(`SELECT l.id FROM leads l JOIN forms f ON f.id = l.form_id JOIN clients c ON c.id = f.client_id
      WHERE l.alerted_at IS NULL AND l.created_at < ? AND l.created_at > ? AND json_array_length(COALESCE(json_extract(c.data, '$.pricing.alertEmails'), '[]')) > 0
      ORDER BY l.created_at LIMIT ${NOTIFY_PER_RUN}`).bind(now - alertDelay, now - ALERT_WINDOW_MS).all()).results;
  for (const r of alerts) await alertShop(env, r.id, ORIGIN_BASE).catch((e) => console.error('sweep alert', r.id, e.message));
  const sends = (await env.DB.prepare(`SELECT l.id FROM leads l JOIN forms f ON f.id = l.form_id JOIN clients c ON c.id = f.client_id
      WHERE l.auto_sent_at IS NULL AND l.first_reply_at IS NULL AND COALESCE(l.status, 'new') = 'new' AND json_extract(c.data, '$.pricing.autoSend') = 1
        AND json_type(COALESCE(l.quotes, '{}'), '$.picked') = 'object' AND l.created_at > ? AND l.created_at < ?
        AND (l.created_at < ? OR EXISTS (SELECT 1 FROM renders r WHERE r.lead_id = l.id AND r.kind IS NULL AND r.status = 'ok'))
      ORDER BY l.created_at LIMIT ${NOTIFY_PER_RUN}`).bind(now - AUTO_SEND_WINDOW_MS, now - sendDelay, now - noRender).all()).results;
  for (const r of sends) await autoSendFirst(env, r.id).catch((e) => console.error('sweep send', r.id, e.message));
}

// Vrijeme do prvog odgovora za portal: zadnjih 30 dana (od uvođenja dnevnika), medijana u minutama.
async function replySpeed(env, clientId) {
  const since = Math.max(EVENTS_SINCE, Date.now() - 30 * 864e5);
  const rows = (await env.DB.prepare(`SELECT l.created_at, l.first_reply_at, l.auto_sent_at FROM leads l JOIN forms f ON f.id = l.form_id
      WHERE f.client_id = ? AND l.created_at >= ? ORDER BY l.created_at DESC LIMIT 1000`).bind(clientId, since).all()).results;
  const mins = rows.filter((r) => r.first_reply_at).map((r) => Math.max(0, (r.first_reply_at - r.created_at) / 60_000)).sort((x, y) => x - y);
  const mid = mins.length ? (mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2) : null;
  return { since, leads: rows.length, replied: mins.length, auto: rows.filter((r) => r.auto_sent_at).length, medianMin: mid == null ? null : Math.round(mid * 10) / 10 };
}

// Sačuvane poruke po leadu: picked = Estimated price, fit = Fits the budget (vidi migraciju 0023).
const QUOTE_SLOTS = ['picked', 'fit'];
function quoteMessageText(v) {
  if (typeof v !== 'string') return null;
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, 4000);
}
// Izbori za koje je poruka napisana (da se radni sto vrati na njih): samo kratki tekstovi i brojevi.
function quoteSpecToSave(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const out = {};
  for (const [k, v] of Object.entries(s).slice(0, 20)) {
    if (!/^[a-z]{1,20}$/i.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 200);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
function leadQuotes(raw) {
  let q = {};
  try { q = JSON.parse(raw || '{}') || {}; } catch {}
  return Object.fromEntries(QUOTE_SLOTS.filter((k) => q[k] && (typeof q[k].msg === 'string' || q[k].spec || q[k].price)).map((k) => [k, {
    msg: typeof q[k].msg === 'string' ? q[k].msg : null, source: q[k].source === 'ai' ? 'ai' : 'template', spec: q[k].spec || null,
    price: quotePrice(q[k].price), msgFor: msgForText(q[k].msgFor) || null, show: q[k].show === true, edited: !!q[k].edited, at: q[k].at || null }]));
}
const msgForText = (v) => (typeof v === 'string' && v.length <= 4000 ? v : undefined);
// Konačna cijena koju zlatar upiše ili namjesti sliderom (cijeli dolari).
function quotePrice(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= 5e6 ? n : null;
}
// Store info zlatara (adresa, radno vrijeme, rokovi izrade, uslovi): ide doslovno na kraj SVAKE quote poruke
// (Ognjen 19.11.2026, District). Čuva se uz cijene (pricing.quoteInfo); emoji i novi redovi ostaju kako su upisani.
function quoteInfoText(v) {
  const t = String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').split('\n').map((x) => x.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return t ? t.slice(0, 1200) : undefined;
}
// Činjenice samo iz konačnih izbora zlatara; tekst ograničen, cijena mora ostati tačno ona iz kalkulatora.
function quoteFacts(b, lead, store) {
  const str = (v, n = 60) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
  const total = Math.round(Number(b?.total));
  if (!Number.isFinite(total) || total <= 0 || total > 5e6) return null;
  const piece = str(b.piece, 30).toLowerCase() || 'piece';
  const teeth = b.teeth && typeof b.teeth === 'object' ? { top: Math.max(0, Math.min(10, Math.round(Number(b.teeth.top) || 0))), bottom: Math.max(0, Math.min(10, Math.round(Number(b.teeth.bottom) || 0))) } : null;
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 8).map((x) => ({ label: str(x?.label, 140), amount: Math.round(Number(x?.amount) || 0) })).filter((x) => x.label);
  return {
    store: str(store, 60), first: /^[A-Za-zÀ-ž][A-Za-zÀ-ž'-]*$/.test(str(lead.name, 60).split(' ')[0]) ? str(lead.name, 60).split(' ')[0] : 'there', piece,
    metal: str(b.metal), karat: str(b.karat, 12), ice: str(b.ice, 30), stones: str(b.stones, 40), clarity: str(b.clarity, 12), cut: str(b.cut, 40),
    teeth, total, price: `$${total.toLocaleString('en-US')}`,
    molding: lines.some((x) => /molding/i.test(x.label)),
    ...fitFacts(b, total, str),
  };
}
// "Fits the budget" (District 19.11.2026, Enrique): poruka kao "to fit your budget, these are the changes: from gold to
// silver, from lab diamonds to moissanite, this would run you $880". Samo kad ima izmjena i drugačiju cijenu od izabranog.
function fitFacts(b, total, str) {
  const orig = Math.round(Number(b?.originalTotal));
  const changes = (Array.isArray(b?.changes) ? b.changes : []).slice(0, 6)
    .map((c) => ({ what: str(c?.what, 20), from: str(c?.from, 50), to: str(c?.to, 50) }))
    .filter((c) => c.what && c.to && c.from.toLowerCase() !== c.to.toLowerCase())
    // Karat i čistoća koji samo nestanu (zlato u srebro, prirodni dijamanti u moissanite) se podrazumijevaju.
    .filter((c) => !(['Karat', 'Clarity'].includes(c.what) && /^(none|)$/i.test(c.to)));
  if (b?.mode !== 'fit' || !changes.length || !Number.isFinite(orig) || orig <= 0 || orig > 5e6 || orig === total) return {};
  // Ako ni predlog ne stane u budžet, poruka ne smije reći da staje: "to get closer to your budget".
  return { fit: true, changes, original: `$${orig.toLocaleString('en-US')}`, budget: str(b.budget, 40), toFit: b.inBudget === false ? 'To get closer to your budget' : 'To fit your budget' };
}
// "Gold to Silver", "Teeth: 6 top + 6 bottom to 4 top + 4 bottom"; "none" dobija riječi ("no stones", "not iced").
function changeLine(c) {
  const none = (v) => (/^(none|)$/i.test(v) ? (c.what === 'Stones' ? 'no stones' : c.what === 'Ice' ? 'not iced' : c.what === 'Cut' ? 'polished' : 'none') : v);
  const label = ['Teeth', 'Karat', 'Clarity', 'Cut'].includes(c.what) ? `${c.what}: ` : '';
  return `${label}${none(c.from)} to ${none(c.to)}`;
}
function quoteSpecLine(f) {
  const metal = [f.karat, f.metal].filter(Boolean).join(' ');
  const teeth = f.teeth ? [f.teeth.top ? `${f.teeth.top} top` : '', f.teeth.bottom ? `${f.teeth.bottom} bottom` : ''].filter(Boolean).join(' + ') : '';
  const ice = f.ice ? `${f.ice.toLowerCase()} with ${[f.clarity, f.stones].filter(Boolean).join(' ').toLowerCase()}` : '';
  const cut = f.cut && !/polished|solid/i.test(f.cut) ? `${f.cut.toLowerCase()} finish` : '';
  return [teeth ? `${teeth} ${f.piece}` : f.piece, metal && `in ${metal}`, ice, cut].filter(Boolean).join(', ');
}
// Kad ispod ide store info, poruka se ne potpisuje (Ognjen 19.11: "District Jewelers Denver" na kraju ne treba).
// Sa kraja se skidaju kratki redovi koji su samo pozdrav ili ime radnje (iz imena forme ili prvog reda store infa).
function dropSignature(text, store, info) {
  const words = (v) => String(v || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const name = new Set([...words(store), ...words(String(info).split('\n')[0]), 'the', 'team', 'from', 'at', 'and', 'co', 'inc', 'llc']);
  const closing = /^(best|kind|warm|warmest)?\s*(regards|wishes)|^(sincerely|thanks|thank you|cheers|warmly|talk soon|all the best)[\s,!.]*$/i;
  const lines = String(text).split('\n');
  while (lines.length > 1) {
    const last = lines[lines.length - 1].trim();
    const w = words(last);
    if (!last) { lines.pop(); continue; }
    if (w.length <= 6 && (closing.test(last) || w.every((x) => name.has(x)))) { lines.pop(); continue; }
    break;
  }
  return lines.join('\n').trim();
}
function quoteTemplate(f) {
  if (f.fit) {
    return `Hi ${f.first}, thank you for designing your ${f.piece} with ${f.store}!\n\n${f.toFit}${f.budget ? ` (${f.budget})` : ''}, these are the changes we would make:\n${f.changes.map((c) => `- ${changeLine(c)}`).join('\n')}\n\nThat makes it ${quoteSpecLine(f)}, and it would run you ${f.price}${f.molding ? ' (molding included)' : ''} instead of ${f.original} for the original design.\n\nLet me know if that sounds fair and we will get started.${f.footer ? '' : `\n\n${f.store}`}`;
  }
  return `Hi ${f.first}, thank you for designing your ${f.piece} with ${f.store}!\n\nHere is your quote: ${quoteSpecLine(f)}.\n\nTotal: ${f.price}${f.molding ? ' (molding included)' : ''}.\n\nReply here if you would like to move forward or adjust anything, and we will set up the next step.${f.footer ? '' : `\n\n${f.store}`}`;
}
async function quoteByAI(env, f) {
  if (!env.AI?.run) return null;
  if (f.fit) return fitByAI(env, f);
  const sys = 'You write short quote messages that a jewelry store sends to a customer by text message. Plain US English, warm and premium, no emojis, no hashtags, no markdown, no em dashes. 55 to 95 words. Start with "Hi <first name>,". Thank them for their design, then describe the quoted piece in one natural sentence using only the given specs. It is a quote for a piece to be made: never say it is already made or created. State the total price exactly as given, written exactly the same way. Say molding is included only if told so. Do not invent anything: no deadlines, deposits, discounts, warranties, shipping or extra options. End with an invitation to reply to move forward or adjust anything.';
  const user = `Store: ${f.store}\nCustomer first name: ${f.first}\nPiece: ${quoteSpecLine(f)}\nTotal price: ${f.price}\nMolding included: ${f.molding ? 'yes' : 'no'}\n${f.footer ? 'Do not sign the message: the store details are added below it automatically.' : 'After the invitation, add an empty line and the store name on its own line.'}`;
  try {
    const run = env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], max_tokens: 320, temperature: 0.6 });
    const r = await Promise.race([run, new Promise((ok) => setTimeout(() => ok(null), 15000))]);
    const text = String(r?.response || '').trim().replace(/^["']|["']$/g, '').replace(/—/g, ',').replace(/\n{3,}/g, '\n\n');
    // Provjera: tačna cijena, bez drugih iznosa, razumna dužina; inače standardna poruka.
    const amounts = [...text.matchAll(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?!\d)|\$\s?\d+(?:\.\d+)?/g)].map((m) => m[0].replace(/\s/g, ''));
    const why = !text.includes(f.price) ? 'price missing' : amounts.some((a) => a !== f.price) ? `other amount ${amounts.join(' ')}` : text.length > 900 ? 'too long' : text.length < 80 ? 'too short' : '';
    if (why) { console.log('quote AI rejected:', why, JSON.stringify(text.slice(0, 300))); return null; }
    return text;
  } catch (e) {
    console.log('quote AI failed', e?.message || e);
    return null;
  }
}

// Poruka "Fits the budget": izmjene od-do, nova cijena naspram cijene izabranog; provjera kao kod obične poruke.
async function fitByAI(env, f) {
  const sys = 'You write short text messages that a jewelry store sends to a customer whose design came out above their budget. Friendly, relaxed and personal, like the jeweler texting a regular customer. Plain US English, no emojis, no hashtags, no markdown, no em dashes. 60 to 110 words. Start with "Hi <first name>,". Introduce the changes with exactly the given lead-in phrase, then list EVERY given change on its own line starting with "- ", worded exactly as given. Then say what the piece would run them, the new total exactly as given, and compare it with the original design price exactly as given. It is a quote for a piece to be made. Do not invent anything: no other changes, deadlines, deposits, discounts, warranties or shipping. End by asking if it sounds fair and inviting them to reply. Follow this format, with your own warm wording:\n\nHi <first name>,\n\nThank you for designing your <piece> with us! <lead-in>, these are the changes we would make:\n- <change 1>\n- <change 2>\n\nWith those changes it would run you <new total>, compared to <original design price> for the original design.\n\nLet me know if that sounds fair and we can get started.';
  const user = `Store: ${f.store}\nCustomer first name: ${f.first}\nCustomer budget: ${f.budget || 'not given'}\nLead-in phrase: ${f.toFit}\nChanges:\n${f.changes.map((c) => `- ${changeLine(c)}`).join('\n')}\nPiece after the changes: ${quoteSpecLine(f)}\nNew total: ${f.price}\nOriginal design price: ${f.original}\nMolding included: ${f.molding ? 'yes' : 'no'}\n${f.footer ? 'Do not sign the message: the store details are added below it automatically.' : 'After the question, add an empty line and the store name on its own line.'}`;
  try {
    const run = env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], max_tokens: 360, temperature: 0.5 });
    const r = await Promise.race([run, new Promise((ok) => setTimeout(() => ok(null), 15000))]);
    const text = String(r?.response || '').trim().replace(/^["']|["']$/g, '').replace(/—/g, ',').replace(/\n{3,}/g, '\n\n');
    const amounts = [...text.matchAll(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?!\d)|\$\s?\d+(?:\.\d+)?/g)].map((m) => m[0].replace(/\s/g, ''));
    const lower = text.toLowerCase();
    const lost = f.changes.find((c) => !/^none$/i.test(c.to) && !lower.includes(String(c.to).toLowerCase()));
    const why = !text.includes(f.price) ? 'price missing' : !text.includes(f.original) ? 'original price missing' : amounts.some((a) => a !== f.price && a !== f.original) ? `other amount ${amounts.join(' ')}` : lost ? `change missing ${lost.what}` : text.length > 1000 ? 'too long' : text.length < 80 ? 'too short' : '';
    if (why) { console.log('fit AI rejected:', why, JSON.stringify(text.slice(0, 300))); return null; }
    return text;
  } catch (e) {
    console.log('fit AI failed', e?.message || e);
    return null;
  }
}

// ---------- Žive cijene metala (22.11.2026) ----------
// api.gold-api.com (bez ključa), keš u Workeru 15 min; ako izvor ne odgovori, računa se sa zlatarevim brojem.
const MARKET_TTL = 900;
async function getMarket(env) {
  const key = new Request('https://market.jewelrylead.invalid/spot/v1');
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  try { const hit = cache && (await cache.match(key)); if (hit) return await hit.json(); } catch {}
  const base = env.MARKET_BASE || 'https://api.gold-api.com';
  const out = { at: Date.now(), source: 'gold-api.com' };
  await Promise.all(MARKET_METALS.map(async (m) => {
    try {
      const r = await fetch(`${base}/price/${m.symbol}`, { signal: AbortSignal.timeout(3500) });
      const j = await r.json();
      if (Number(j.price) > 0) { out[m.key] = Math.round((j.price / OZ) * 100) / 100; out[`${m.key}Oz`] = Number(j.price); if (j.updatedAt) out[`${m.key}At`] = j.updatedAt; }
    } catch (e) { console.log('market', m.symbol, e.message); }
  }));
  if (MARKET_METALS.some((m) => out[m.key]) && cache) {
    try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': `max-age=${MARKET_TTL}` } })); } catch {}
  }
  return out;
}
const marketPricing = async (env, pricing) => (pricing ? applyMarket(pricing, await getMarket(env).catch(() => null)) : pricing);

// ---------- Kalkulator cijene (portal) ----------
// Samo izbori koji ulaze u cijenu, kao natpisi; vrijednosti iz odgovora kupca uz lead.
const CUT_FIELD = /(^|_)cut$/;
function pricingSpec(form) {
  const fields = (form?.steps || []).filter((st) => st.enabled !== false).flatMap((st) => st.fields || []).filter((f) => f.enabled !== false);
  const opts = (f) => (f?.options || []).map((o) => ({ value: o.value, label: o.label }));
  const by = (id) => fields.find((f) => f.id === id);
  // Veličina komada (22.11.2026) za kamenje po površini: ključ bez prefiksa komada (chain_length -> length).
  const dims = {};
  for (const f of fields) { const k = dimKey(f.id); if (k) dims[k] = [...(dims[k] || []), ...opts(f)]; }
  // Izbori po komadu (perPiece): radni sto nudi samo ono što taj komad ima u formi.
  const per = Object.fromEntries(['metal', 'karat', 'stones', 'coverage', 'clarity'].map((k) => [k, by(k)?.perPiece || null]).filter(([, v]) => v));
  return { type: opts(by('type')), metal: opts(by('metal')), karat: opts(by('karat')), stones: opts(by('stones')), coverage: opts(by('coverage')), clarity: opts(by('clarity')), budget: opts(by('budget')), cut: fields.filter((f) => CUT_FIELD.test(f.id)).flatMap(opts), dims, per };
}
function pricingAnswers(a) {
  const out = {};
  for (const k of ['type', 'metal', 'karat', 'stones', 'coverage', 'clarity', 'style', 'budget', 'teeth']) if (a[k] != null && a[k] !== '') out[k] = String(a[k]).slice(0, 200);
  const cut = Object.keys(a).find((k) => CUT_FIELD.test(k) && a[k]);
  if (cut) out.cut = String(a[cut]).slice(0, 80);
  for (const [k, v] of Object.entries(a)) { const d = dimKey(k); if (d && v != null && v !== '' && typeof v !== 'object') out[`d_${d}`] = String(v).slice(0, 60); }
  return out;
}
// Tabela cijena: samo brojevi >= 0, ključevi kratki, ograničen broj stavki.
function cleanPricing(p) {
  const n = (v) => { const x = Number(v); return Number.isFinite(x) && x >= 0 && x < 1e7 ? Math.round(x * 100) / 100 : undefined; };
  const map = (o, depth = 1) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 80).map(([k, v]) => [String(k).toLowerCase().slice(0, 60), depth > 1 ? map(v, depth - 1) : n(v)]).filter(([, v]) => v !== undefined && (typeof v !== 'object' || Object.keys(v).length)));
  // Grillz cjenovnik (18.11.2026): brojevi ili ugniježđene tabele do 3 nivoa (grillz.sets.6.10k).
  const tree = (o, depth) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 80).map(([k, v]) => [String(k).toLowerCase().slice(0, 60), v && typeof v === 'object' ? (depth > 1 ? tree(v, depth - 1) : undefined) : n(v)]).filter(([, v]) => v !== undefined && (typeof v !== 'object' || Object.keys(v).length)));
  return { goldSpot: n(p?.goldSpot), markup: n(p?.markup), metals: map(p?.metals), grams: map(p?.grams), labor: map(p?.labor), stones: map(p?.stones, 2), setting: n(p?.setting), cuts: map(p?.cuts),
    // Rok ponude na stranici kupca u satima (prazno = 48, 0 = bez odbrojavanja).
    offerHours: n(p?.offerHours) != null ? Math.min(720, n(p?.offerHours)) : undefined,
    live: Object.fromEntries(MARKET_METALS.map((m) => [m.key, p?.live?.[m.key] !== false])), grillz: tree(p?.grillz, 3), quoteInfo: quoteInfoText(p?.quoteInfo), depositUrl: httpsUrl(p?.depositUrl), bookingUrl: httpsUrl(p?.bookingUrl),
    // Obavještenja i prva poruka (21.11.2026): kome ide mejl o leadu, na koju adresu kupac odgovara, da li prva poruka ide sama.
    alertEmails: emailList(p?.alertEmails), replyTo: validEmail(p?.replyTo) || undefined, autoSend: p?.autoSend === true };
}

async function demoHandled(request, env, id) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const b = await request.json().catch(() => ({}));
  const r = await env.DB.prepare('UPDATE demo_requests SET handled_at = ? WHERE id = ?').bind(b.handled === false ? null : Date.now(), id).run();
  return r.meta.changes ? json({ ok: true }) : json({ error: 'Not found' }, 404);
}

// Podaci iz vodiča: samo očekivani oblici, slike samo iz foldera tog klijenta ili biblioteke, boja samo hex.
function cleanOnboarding(d, clientId) {
  d = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  const own = `/media/onboarding/${clientId}/`;
  const img = (u) => (typeof u === 'string' && !u.includes('..') && (u.startsWith(own) || u.startsWith(`/media/clients/${clientId}/`) || /^\/library\/[a-z]+\/[\w-]+\.webp$/.test(u) || /^\/library\/options\/[a-z/-]+\/[\w-]+\.(webp|svg)$/.test(u)) ? u : '');
  const str = (v, max) => String(v ?? '').slice(0, max);
  const list = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  const st = d.store || {};
  const vals = (v, n = 12) => list(v, n).map((x) => str(x, 40));
  // Vlastite opcije zlatara: isti oblik svuda (metali, kamenje, specifikacije), sa opcionom slikom.
  const customOptions = (v, n) => list(v, n).filter((x) => x && typeof x === 'object' && /^custom-[a-z0-9-]+$/.test(x.value || '') && String(x.label || '').trim()).map((x) => ({ uid: str(x.uid, 24), value: str(x.value, 40), label: str(x.label, 40), image: img(x.image) }));
  const stepKey = typeof d.step === 'string' && /^[a-z0-9:_-]{1,60}$/i.test(d.step) ? d.step : Math.max(0, Math.min(5, Number(d.step) || 0));
  return {
    step: stepKey,
    formName: str(d.formName, 80),
    store: { name: str(st.name, 60), website: str(st.website, 200), logo: img(st.logo), accent: /^#[0-9a-f]{6}$/i.test(st.accent || '') ? st.accent : '#35d0c4', imageStyle: st.imageStyle === 'light' ? 'light' : 'dark', theme: st.theme === 'light' ? 'light' :'dark' },
    pieces: list(d.pieces, 12).filter((x) => x && typeof x === 'object').map((x) => ({
      uid: str(x.uid, 24), value: str(x.value, 40), label: str(x.label, 60), image: img(x.image),
      styles: list(x.styles, 24).filter((y) => y && typeof y === 'object').map((y) => ({
        uid: str(y.uid, 24), value: str(y.value, 40), label: str(y.label, 40), image: img(y.image), note: str(y.note, 300), custom: !!y.custom, keep: y.keep !== false,
      })),
      // Po komadu: metali, karati, kamenje, budžet, specifikacije i pitanja zlatara (stariji onboarding ih nema).
      ...(Array.isArray(x.metals) ? { metals: vals(x.metals) } : {}),
      ...(Array.isArray(x.karats) ? { karats: vals(x.karats, 6) } : {}),
      ...(Array.isArray(x.stones) ? { stones: vals(x.stones) } : {}),
      ...(Array.isArray(x.budgets) ? { budgets: vals(x.budgets, 10) } : {}),
      ...(x.specs && typeof x.specs === 'object' && !Array.isArray(x.specs) ? { specs: Object.fromEntries(Object.entries(x.specs).slice(0, 8).filter(([k, v]) => /^[a-z_]{1,30}$/.test(k) && Array.isArray(v)).map(([k, v]) => [k, vals(v, 20)])) } : {}),
      questions: list(x.questions, 6).filter((q) => q && typeof q === 'object').map((q) => ({ uid: str(q.uid, 24), label: str(q.label, 120), options: str(q.options, 600) })),
      ...(x.customSpecs && typeof x.customSpecs === 'object' && !Array.isArray(x.customSpecs) ? { customSpecs: Object.fromEntries(Object.entries(x.customSpecs).slice(0, 8).filter(([k, v]) => /^[a-z_]{1,30}$/.test(k) && Array.isArray(v)).map(([k, v]) => [k, customOptions(v, 12).map(({ uid, value, label, image }) => ({ uid, value, label, image }))])) } : {}),
      ...(x.required && typeof x.required === 'object' ? { required: { styles: x.required.styles !== false, materials: x.required.materials !== false, details: x.required.details === true } } : {}),
    })),
    products: list(d.products, 24).filter((x) => x && typeof x === 'object').map((x) => ({
      uid: str(x.uid, 24), name: str(x.name, 80), price: str(x.price, 30), url: str(x.url, 500), description: str(x.description, 300), image: img(x.image), pieces: vals(x.pieces, 12),
    })),
    metals: list(d.metals, 12).map((x) => str(x, 40)),
    metalsOther: str(d.metalsOther, 200),
    customMetals: customOptions(d.customMetals, 12).map((x) => { const swatch = d.customMetals.find((m) => m?.value === x.value)?.swatch; return { ...x, swatch: /^#[0-9a-f]{6}$/i.test(swatch || '') ? swatch : '#c0c4c8' }; }),
    stones: list(d.stones, 12).map((x) => str(x, 40)),
    customStones: customOptions(d.customStones, 12),
    customKarats: list(d.customKarats, 12).map((x) => str(x, 40)),
    budgets: list(d.budgets, 10).map((x) => str(x, 40)),
    questions: str(d.questions, 2000),
    notes: str(d.notes, 2000),
  };
}

// Izbori koje su dodale ranije radnje, ponuđeni pri novom onboardingu uz SUGGESTED. Tuđe fotografije i opisi se ne dijele, samo natpisi.
async function onboardingSuggestions(env, clientId) {
  const rows = (await env.DB.prepare("SELECT data FROM onboardings WHERE status != 'draft' AND client_id != ? ORDER BY updated_at DESC LIMIT 200").bind(clientId).all()).results;
  const out = { ...structuredClone(SUGGESTED), specs: {} };
  const put = (list, key, item) => { if (key && !list.some((x) => String(x.label ?? x).toLowerCase() === key.toLowerCase())) list.push(item); };
  const known = new Set(ONBOARDING_DEFAULTS.budgets);
  for (const r of rows) {
    const d = safeJson(r.data);
    for (const m of d.customMetals || []) put(out.metals, m.label, { label: m.label, swatch: m.swatch });
    for (const s of d.customStones || []) put(out.stones, s.label, { label: s.label });
    for (const k of d.customKarats || []) put(out.karats, k, k);
    for (const pc of d.pieces || []) {
      if (!pc.value) put(out.pieces, pc.label, pc.label);
      for (const s of pc.styles || []) if (s.custom && s.keep !== false && pc.value) put((out.styles[pc.value] ||= []), s.label, s.label);
      for (const [id, list] of Object.entries(pc.customSpecs || {})) for (const c of list) put((out.specs[`${pc.value}.${id}`] ||= []), c.label, c.label);
      for (const b of pc.budgets || []) if (!known.has(b)) put(out.budgets, b, b);
    }
  }
  return out;
}
const safeJson = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

async function portalOnboarding(request, env, p, client, sess) {
  const ob = await pickOnboarding(request, env, client.id);
  if (!ob) return json({ error: 'No onboarding for this store.' }, 404);
  // Isti renderer i ista konverzija kao stvarna forma, bez čuvanja, upita ili AI troška.
  if (p === '/api/portal/onboarding/preview' && ['GET', 'POST'].includes(request.method)) {
    let draft = JSON.parse(ob.data || '{}');
    if (request.method === 'POST') {
      const raw = await request.text();
      if (raw.length > 200_000) return json({ error: 'Too much data.' }, 413);
      let body;
      try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid data.' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid data.' }, 400);
      if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return json({ error: 'Invalid data.' }, 400);
      draft = body.data;
    }
    const d = cleanOnboarding(draft, client.id);
    if (!d.pieces.some((x) => x.label.trim())) d.pieces = ONBOARDING_DEFAULTS.pieces.map((x) => ({ ...x, styles: ONBOARDING_DEFAULTS.styles[x.value] || [] }));
    const form = formFromOnboarding(d, { id: 'onboarding-preview', clientId: client.id, brand: d.store.name.trim() || client.name, logo: d.store.logo });
    return json({ form: publicForm(form) });
  }
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
    const raw = await request.text();
    if (raw.length > 200_000) return json({ error: 'Too much data.' }, 413);
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch { return json({ error: 'Invalid data.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid data.' }, 400);
    if (body.data != null && (typeof body.data !== 'object' || Array.isArray(body.data))) return json({ error: 'Invalid data.' }, 400);
    const d = cleanOnboarding(body.data ?? JSON.parse(ob.data || '{}'), client.id);
    // Ista provjera kao u portalu, pa probna forma: šta god bi kasnije oborilo pravljenje forme ne prolazi slanje.
    const problems = onboardingProblems(d);
    if (!problems.length) {
      try {
        const id = 'onboarding-check';
        validateFormDef(formFromOnboarding(d, { id, clientId: client.id, brand: d.store.name.trim(), img: (u) => (u.startsWith('/library/') ? u : '') }), id);
      } catch (e) { console.error('onboarding check failed', ob.id, e); problems.push({ step: 'send', field: '', message: e.message }); }
    }
    if (problems.length) return json({ error: problems[0].message, problems }, 422);
    const rev = body.rev == null ? ob.rev : Number(body.rev);
    const now = Date.now();
    // D1 batch je transakcija: odgovori, status i obavještenje ili svi prođu ili svi ostanu nepromijenjeni.
    const [r] = await env.DB.batch([
      env.DB.prepare("UPDATE onboardings SET data = ?, status = 'submitted', submitted_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND status = 'draft' AND rev = ?")
        .bind(JSON.stringify(d), now, now, ob.id, rev),
      env.DB.prepare("INSERT OR IGNORE INTO notifications (id, kind, title, ref, created_at) SELECT ?, 'onboarding', ?, id, ? FROM onboardings WHERE id = ? AND status = 'submitted' AND submitted_at = ?")
        .bind(`onboarding-${ob.id}`, clean(`${client.name} sent their onboarding`, 160), now, ob.id, now),
    ]);
    if (!r.meta.changes) {
      const latest = await env.DB.prepare('SELECT status, data, rev FROM onboardings WHERE id = ?').bind(ob.id).first();
      if (latest.status !== 'draft') return json({ ok: true, status: latest.status });
      return json({ error: 'Your answers changed in another tab. Refresh to review the latest answers before sending.', conflict: true, rev: latest.rev, data: JSON.parse(latest.data || '{}') }, 409);
    }
    return json({ ok: true, status: 'submitted', rev: rev + 1 });
  }
  return json({ error: 'Not found' }, 404);
}

// Koliko stvarno traju renderi (cilj Ognjena 16.11: skoro uvijek ispod 9 s). Samo admin: /api/admin/render-stats?days=7
// Po modelu, komadu i vrsti (prvi render / dorada / try-on): broj, medijana, p90, najduži i udio ispod 9 s.
async function renderStats(request, env, url) {
  if (!(await isAdmin(request, env))) return json({ error: 'Not allowed.' }, 403);
  const days = Math.max(1, Math.min(90, Number(url?.searchParams.get('days')) || 7));
  const rows = (await env.DB.prepare(`SELECT r.model, r.ms, r.tweak, r.kind, json_extract(l.answers, '$.type') AS piece FROM renders r JOIN leads l ON l.id = r.lead_id
    WHERE r.status = 'ok' AND r.ms IS NOT NULL AND r.created_at > ?`).bind(Date.now() - days * 864e5).all()).results;
  const groups = {};
  for (const r of rows) {
    const kind = r.kind === 'tryon' ? 'try-on' : r.tweak ? 'refine' : 'first';
    (groups[`${r.model} | ${r.piece || '?'} | ${kind}`] ||= []).push(r.ms);
  }
  const pct = (list, p) => list[Math.min(list.length - 1, Math.floor((list.length - 1) * p))];
  const out = Object.entries(groups).map(([key, list]) => {
    list.sort((a, b) => a - b);
    const [model, piece, kind] = key.split(' | ');
    return { model, piece, kind, count: list.length, median_s: +(pct(list, 0.5) / 1000).toFixed(1), p90_s: +(pct(list, 0.9) / 1000).toFixed(1), max_s: +(list[list.length - 1] / 1000).toFixed(1), under_9s: `${Math.round((100 * list.filter((x) => x < 9000).length) / list.length)}%` };
  }).sort((a, b) => b.count - a.count);
  // Današnja potrošnja naspram dnevnih limita (po formi i ukupno) i zadnje greške: zašto lead nema sliku ili video.
  const forms = (await env.DB.prepare("SELECT DISTINCT l.form_id AS id FROM leads l WHERE l.created_at > ?").bind(Date.now() - 864e5).all()).results;
  const spend = {};
  for (const f of forms) { const s = await spendToday(env, f.id); spend[f.id] = { today_usd: +s.form.toFixed(2), video_usd: +s.formFilms.toFixed(2) }; }
  const allToday = forms.length ? await spendToday(env, forms[0].id) : null;
  const errors = (await env.DB.prepare(`SELECT 'render' AS what, r.created_at, l.form_id, r.model, r.kind, r.error FROM renders r JOIN leads l ON l.id = r.lead_id WHERE r.status = 'error' AND r.created_at > ?
    UNION ALL SELECT 'video', fl.created_at, l.form_id, fl.model, NULL, fl.error FROM films fl JOIN leads l ON l.id = fl.lead_id WHERE fl.status = 'error' AND fl.created_at > ?
    ORDER BY 2 DESC LIMIT 30`).bind(Date.now() - days * 864e5, Date.now() - days * 864e5).all()).results.map((e) => ({ ...e, created_at: new Date(e.created_at).toISOString() }));
  const noPicture = (await env.DB.prepare(`SELECT l.form_id, COUNT(*) AS n FROM leads l WHERE l.created_at > ? AND NOT EXISTS (SELECT 1 FROM renders r WHERE r.lead_id = l.id AND r.status = 'ok') GROUP BY l.form_id`).bind(Date.now() - 864e5).all()).results;
  return json({
    days, quality: env.IMAGE_QUALITY || 'high', firstModel: firstModel(env), grillzModel: grillzModel(env), tweakModel: tweakModel(env),
    budgets: { ...Object.fromEntries(Object.entries(budgets(env)).map(([k, v]) => [k, Number.isFinite(v) ? v : 'none'])), paused: env.RENDERS_PAUSED === '1', spent_today_all_usd: allToday ? +allToday.all.toFixed(2) : 0, per_form_today: spend },
    leads_without_picture_24h: noPicture, recent_errors: errors, groups: out,
  });
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
  // Safari pušta video samo ako server daje dijelove fajla (Range).
  const video = key.endsWith('.mp4');
  const part = video && request.headers.has('range');
  const obj = await env.MEDIA.get(key, part ? { range: request.headers } : undefined);
  if (!obj) return json({ error: 'Not found' }, 404);
  const headers = { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream', 'x-content-type-options': 'nosniff', etag: obj.httpEtag };
  if (video) headers['accept-ranges'] = 'bytes';
  if (!part && obj.size != null) headers['content-length'] = String(obj.size);
  // Ključevi se ne mijenjaju (nova slika = nov ključ), pa se javne slike keširaju dugo; privatne kratko i samo u browseru.
  headers['cache-control'] = priv ? 'private, max-age=600' : 'public, max-age=31536000, immutable';
  if (part && obj.range) {
    const offset = obj.range.suffix != null ? obj.size - obj.range.suffix : obj.range.offset ?? 0;
    const length = obj.range.suffix ?? obj.range.length ?? obj.size - offset;
    headers['content-range'] = `bytes ${offset}-${offset + length - 1}/${obj.size}`;
    headers['content-length'] = String(length);
    return new Response(request.method === 'HEAD' ? null : obj.body, { status: 206, headers });
  }
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
      const writeIn = f.writeIn && a[base] === 'other';
      // Tekst "Other" ostao uz drugi izbor: samo se izbaci.
      if (f.writeIn && !writeIn && f.followup !== 'text') { delete a[k]; continue; }
      if ((f.followup !== 'text' && !writeIn) || typeof a[k] !== 'string' || a[k].length > 500) return 'Invalid answer.';
    }
  }
  applyPresetTeeth(form, a, styleOf(form, a));
  const stepOf = new Map((form.steps || []).flatMap((st) => st.fields.map((f) => [f.id, st])));
  // Skriveno pitanje briše odgovor, a to može sakriti sljedeće (i u drugom koraku): u krug dok se ne smiri.
  for (let round = 0, gone = true; gone && round < 5; round++) {
    gone = false;
    for (const f of on.values()) if (f.id !== 'type' && a[f.id] != null && !visible(f, a, form)) { delete a[f.id]; delete a[`${f.id}__more`]; gone = true; }
  }
  for (const f of on.values()) {
    if (f.type === 'upload') continue;
    if (!visible(f, a, form)) { delete a[f.id]; delete a[`${f.id}__more`]; continue; }
    const v = a[f.id];
    if (fieldRequired(form, stepOf.get(f.id), f, a) && (v == null || v === '')) return `Please complete: ${f.label || f.id}`;
    // "Other": kupac mora upisati šta; bez "Other" upisani tekst ne ostaje (osim kad pitanje ima i "Add details").
    if (f.writeIn && v === 'other' && !String(a[`${f.id}__more`] || '').trim()) return `Please describe: ${f.label || f.id}`;
    if (f.writeIn && v !== 'other' && f.followup !== 'text') delete a[`${f.id}__more`];
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
  // Obavezan korak: bar jedan odgovor. Korak sa fotografijom provjerava forma (fajlovi nisu među odgovorima).
  for (const st of form.steps || []) {
    if (st.enabled === false || !stepNeedsAnswer(st, a)) continue;
    const shown = st.fields.filter((f) => f.enabled !== false && visible(f, a, form));
    if (shown.length && !shown.some((f) => f.type === 'upload' || (a[f.id] != null && a[f.id] !== ''))) return `Please complete: ${st.title}`;
  }
  return null;
}

function visible(field, a, form) {
  if (!offeredFor(field, a)) return false;
  return conditionsMet(field, a);
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

// ---------- Stranica kupca /p/<page_key> (19.11.2026) ----------
// Ognjen: kupcu se šalje link na personalizovanu stranicu: njegove slike i video, dvije ponude (kako je izabrao i
// "Fits the budget" kad je zlatar napravi), dugmad Deposit i Book appointment, stilovi i završne obrade radnje.
// Cijene se računaju uživo iz zlatarevog cjenovnika, isto kao u portalu. Bez prijave: link je nepogodiv.
const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|telegram|twitter|linkedin|discord|embedly|skype|bitly|vkshare|pinterest/i;
function httpsUrl(v) {
  const s = String(v ?? '').trim();
  if (!s) return undefined;
  try { const u = new URL(s); return u.protocol === 'https:' && s.length <= 500 ? u.href : undefined; } catch { return undefined; }
}
function pageInfo(l) {
  let pg = {};
  try { pg = JSON.parse(l.page || '{}') || {}; } catch {}
  return l.page_key ? { url: `/p/${l.page_key}`, views: pg.views || 0, lastView: pg.lastView || null, actions: Array.isArray(pg.actions) ? pg.actions.slice(-10) : [] } : null;
}
async function leadPage(request, env, ctx, key, url) {
  const row = await env.DB.prepare(`SELECT l.*, f.data AS form_data, c.name AS client_name, c.data AS client_data FROM leads l JOIN forms f ON f.id = l.form_id
      LEFT JOIN clients c ON c.id = f.client_id WHERE l.page_key = ?`).bind(key).first();
  if (!row) return notFoundPage();
  const form = JSON.parse(row.form_data || '{}');
  const answers = JSON.parse(row.answers || '{}');
  let client = {};
  try { client = JSON.parse(row.client_data || '{}') || {}; } catch {}
  let quotes = {};
  try { quotes = JSON.parse(row.quotes || '{}') || {}; } catch {}
  const pricing = await marketPricing(env, client.pricing || null);
  const renders = (await env.DB.prepare(`SELECT image_key, tweak, n FROM renders WHERE lead_id = ? AND status = 'ok' AND image_key IS NOT NULL AND kind IS NULL ORDER BY created_at`).bind(row.id).all()).results;
  // Stranica kupca: duži video (sales, 24.11.2026) kad postoji za najnoviji dizajn sa videom, inače kupčev kratki.
  const okFilms = (await env.DB.prepare(`SELECT f.video_key, f.model, r.created_at AS rat FROM films f JOIN renders r ON r.id = f.render_id WHERE f.lead_id = ? AND f.status = 'ok' AND f.video_key IS NOT NULL ORDER BY r.created_at DESC, f.created_at DESC`).bind(row.id).all()).results;
  const salesApi = VIDEO_MODELS.sales.api;
  const newest = okFilms.find((f) => f.model === salesApi || customerFilm(env, f));
  const film = newest && (okFilms.find((f) => f.model === salesApi && f.rat === newest.rat) || newest);
  const ls = leadSpecFrom(pricingSpec(form), pricingAnswers(answers));
  const html = leadPageHtml({
    key, origin: url.origin, form, answers, details: leadDetails(form, answers), ls, pricing, quotes,
    lead: { name: row.name, createdAt: row.created_at },
    store: { name: form.brand?.name || row.client_name || 'Our studio', logo: form.brand?.logo || '', info: quoteInfoText(pricing?.quoteInfo) || '' },
    renders: renders.map((r, k) => ({ url: `/media/${r.image_key}`, label: k === 0 ? 'First design' : r.tweak ? `Change ${k}` : `Version ${k + 1}` })),
    film: film ? `/media/${film.video_key}` : '',
  });
  // Pregled: zlatar (?preview=1) i roboti za preglede linkova se ne broje.
  if (request.method === 'GET' && url.searchParams.get('preview') !== '1' && !BOT_UA.test(request.headers.get('user-agent') || '')) {
    const now = Date.now();
    ctx.waitUntil(env.DB.prepare(`UPDATE leads SET page = json_set(COALESCE(page, '{}'), '$.views', COALESCE(json_extract(page, '$.views'), 0) + 1, '$.lastView', ?, '$.firstView', COALESCE(json_extract(page, '$.firstView'), ?)) WHERE id = ?`).bind(now, now, row.id).run());
    let seen = false;
    try { seen = !!JSON.parse(row.page || '{}')?.firstView; } catch {}
    if (!seen) ctx.waitUntil(logEvent(env, row.id, 'page_view', null, now));
  }
  const res = new Response(request.method === 'HEAD' ? null : html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  return withSecurity(res, { page: true, ancestors: "'none'" });
}
// Deposit / Book appointment: zabilježi klik uz lead (zlatar ga vidi u portalu) i vrati link radnje ako ga je upisala.
async function pageAction(request, env, key) {
  const b = await request.json().catch(() => ({}));
  const action = PAGE_ACTIONS.includes(b.action) ? b.action : null;
  const option = ['picked', 'fit'].includes(b.option) ? b.option : '';
  if (!action) return json({ error: 'Unknown action.' }, 400);
  const row = await env.DB.prepare('SELECT l.id, l.page, c.data AS client_data FROM leads l JOIN forms f ON f.id = l.form_id LEFT JOIN clients c ON c.id = f.client_id WHERE l.page_key = ?').bind(key).first();
  if (!row) return json({ error: 'Not found' }, 404);
  let pg = {};
  try { pg = JSON.parse(row.page || '{}') || {}; } catch {}
  const actions = [...(Array.isArray(pg.actions) ? pg.actions : []), { action, option, at: Date.now() }].slice(-30);
  await env.DB.prepare(`UPDATE leads SET page = json_set(COALESCE(page, '{}'), '$.actions', json(?)) WHERE id = ?`).bind(JSON.stringify(actions), row.id).run();
  await logEvent(env, row.id, 'page_action', { action, option });
  let pricing = {};
  try { pricing = JSON.parse(row.client_data || '{}').pricing || {}; } catch {}
  return json({ ok: true, redirect: httpsUrl(action === 'deposit' ? pricing.depositUrl : pricing.bookingUrl) || null });
}

// Bookings za portal: svaki lead sa bar jednim klikom na stranici kupca, najnoviji klik prvi; "new" = poslije zadnjeg
// otvaranja taba (clients.data.bookingsSeenAt). Cijena ponude iz sačuvane poruke (quotes.picked/fit.total) kad postoji.
async function portalBookings(env, client) {
  let seenAt = 0;
  try { seenAt = Number(JSON.parse(client.data || '{}').bookingsSeenAt) || 0; } catch {}
  const rows = (await env.DB.prepare(`SELECT l.id, l.name, l.email, l.phone, l.created_at, l.status, l.page, l.page_key, l.quotes, l.answers,
      (SELECT r.image_key FROM renders r WHERE r.lead_id = l.id AND r.status = 'ok' AND r.kind IS NULL AND r.image_key IS NOT NULL ORDER BY r.created_at DESC LIMIT 1) AS img
      FROM leads l JOIN forms f ON f.id = l.form_id WHERE f.client_id = ? AND json_array_length(COALESCE(l.page, '{}'), '$.actions') > 0
      ORDER BY l.created_at DESC LIMIT 300`).bind(client.id).all()).results;
  const items = rows.map((l) => {
    const pg = JSON.parse(l.page || '{}') || {};
    let q = {};
    try { q = JSON.parse(l.quotes || '{}') || {}; } catch {}
    let type = '';
    try { type = JSON.parse(l.answers || '{}').type || ''; } catch {}
    const actions = (Array.isArray(pg.actions) ? pg.actions : []).filter((a) => PAGE_ACTIONS.includes(a.action))
      .map((a) => ({ action: a.action, option: a.option || '', at: a.at, total: quotePrice(q[a.option]?.price) || Number(q[a.option]?.total) || null })).sort((a, b) => b.at - a.at);
    return { id: l.id, name: l.name, email: l.email, phone: l.phone, createdAt: l.created_at, status: l.status || 'new', piece: type,
      img: l.img ? `/media/${l.img}` : '', page: l.page_key ? `/p/${l.page_key}` : '', views: pg.views || 0, lastAt: actions[0]?.at || 0,
      isNew: actions.some((a) => a.at > seenAt), actions };
  }).filter((x) => x.actions.length).sort((a, b) => b.lastAt - a.lastAt);
  return { seenAt, unseen: items.filter((x) => x.isNew).length, items };
}

// ---------- Praćenje narudžbe (23.11.2026) ----------
// Broj se dodjeljuje Won leadu jednom (prefiks radnje, npr. DJ-7K4Q9); sudar sa postojećim brojem = novi pokušaj.
async function assignOrder(env, leadId, client) {
  const cur = await env.DB.prepare('SELECT order_no, order_data FROM leads WHERE id = ?').bind(leadId).first();
  if (!cur) return null;
  if (cur.order_no) return { no: cur.order_no, data: cur.order_data };
  let d = {};
  try { d = JSON.parse(client.data || '{}') || {}; } catch {}
  const prefix = orderPrefix(client.name, d);
  const data = JSON.stringify(nextOrder(null, { stage: 0 }));
  for (let i = 0; i < 5; i++) {
    const no = newOrderNo(prefix);
    try {
      const r = await env.DB.prepare('UPDATE leads SET order_no = ?, order_data = ? WHERE id = ? AND order_no IS NULL').bind(no, data, leadId).run();
      if (r.meta.changes) { await logEvent(env, leadId, 'order_created', { no }); return { no, data }; }
      const again = await env.DB.prepare('SELECT order_no, order_data FROM leads WHERE id = ?').bind(leadId).first();
      return again?.order_no ? { no: again.order_no, data: again.order_data } : null;
    } catch (e) {
      if (!/UNIQUE/i.test(e.message)) throw e;
    }
  }
  return null;
}

const ORDER_LOOKUPS_PER_HOUR = 20;
const TRACK_CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' };
const trackJson = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...TRACK_CORS } });

// Kupac na sajtu radnje: broj narudžbe + mejl iz upita. Nema kolačića ni prijave, pa je CORS otvoren za sve sajtove;
// oba podatka moraju da se poklope, a pogrešni pokušaji su ograničeni po mreži (pogađanje brojeva).
async function orderTrack(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: TRACK_CORS });
  if (request.method !== 'POST') return trackJson({ error: 'Not found' }, 404);
  const net = ipNet(request);
  const now = Date.now();
  const tries = await env.DB.prepare('SELECT COUNT(*) AS n FROM order_lookups WHERE net = ? AND at > ? AND ok = 0').bind(net, now - 3600_000).first();
  if ((tries?.n || 0) >= ORDER_LOOKUPS_PER_HOUR) return trackJson({ error: 'Too many attempts. Please try again in an hour or call the store.' }, 429);
  const b = await request.json().catch(() => ({}));
  const no = normalizeOrderNo(b.order);
  const email = String(b.email ?? '').trim().toLowerCase();
  const row = no && email ? await env.DB.prepare(`SELECT l.id, l.name, l.email, l.answers, l.order_no, l.order_data, f.data AS form_data, c.name AS client_name,
      (SELECT r.image_key FROM renders r WHERE r.lead_id = l.id AND r.status = 'ok' AND r.kind IS NULL AND r.image_key IS NOT NULL ORDER BY r.created_at DESC LIMIT 1) AS img
      FROM leads l JOIN forms f ON f.id = l.form_id JOIN clients c ON c.id = f.client_id WHERE l.order_no = ?`).bind(no).first() : null;
  const hit = !!row && safeEqual(String(row.email || '').trim().toLowerCase(), email);
  await env.DB.prepare('INSERT INTO order_lookups (net, at, ok) VALUES (?,?,?)').bind(net, now, hit ? 1 : 0).run();
  if (!hit) return trackJson({ error: 'We could not find an order with that number and email. Check the order ID in your receipt email.' }, 404);
  let form = {};
  try { form = JSON.parse(row.form_data || '{}') || {}; } catch {}
  let a = {};
  try { a = JSON.parse(row.answers || '{}') || {}; } catch {}
  const v = orderView(row.order_no, row.order_data);
  const piece = typeof a.type === 'string' ? a.type.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '';
  return trackJson({
    order: v.no, name: String(row.name || '').trim().split(/\s+/)[0] || '', piece, store: form.brand?.name || row.client_name,
    stage: v.stage, stages: v.stages.map((s, i) => ({ ...s, text: ORDER_STAGES[i].text })), note: v.note, updatedAt: v.updatedAt,
    image: row.img ? `${ORIGIN_BASE}/media/${row.img}` : null,
  });
}
