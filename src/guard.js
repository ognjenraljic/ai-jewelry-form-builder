// Zaštita platforme: prijava kolačićem, potpisani linkovi za slike, dnevni budžet, limit po mreži,
// Turnstile, moderacija teksta i slika, provjera stvarnog tipa fajla i sigurnosna zaglavlja.

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

// Poređenje bez curenja vremena (ne otkriva koliko se znakova poklopilo).
export function safeEqual(a, b) {
  const x = enc.encode(String(a ?? ''));
  const y = enc.encode(String(b ?? ''));
  if (x.length !== y.length || !x.length) return false;
  return crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(x, y) : x.every((v, i) => v === y[i]);
}

export function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// HttpOnly kolačić: JavaScript na stranici ga ne može pročitati, pa ga ni XSS ne može ukrasti.
export function setCookie(name, value, { maxAge, secure = true } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}${maxAge != null ? `; Max-Age=${maxAge}` : ''}`;
}
export const clearCookie = (name, secure = true) => setCookie(name, '', { maxAge: 0, secure });

// ---------- Admin sesija ----------
// U kolačiću nije sam ADMIN_TOKEN nego potpis izveden iz njega (promjena tokena gasi sve sesije).
export const ADMIN_SESSION_S = 30 * 86400;
export async function adminSessionValue(env) {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_S;
  return `v1.${exp}.${await hmac(env.ADMIN_TOKEN, `admin-session:${exp}`)}`;
}
export async function isAdminRequest(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const header = request.headers.get('x-admin-token');
  if (header) return safeEqual(header, env.ADMIN_TOKEN);
  const v = cookies(request).aik_admin;
  if (!v) return false;
  const [ver, exp, sig] = v.split('.');
  if (ver !== 'v1' || !(+exp > Date.now() / 1000)) return false;
  if (!safeEqual(sig, await hmac(env.ADMIN_TOKEN, `admin-session:${exp}`))) return false;
  // Kolačić + izmjena: zahtjev mora doći sa našeg sajta (CSRF), SameSite=Strict je druga brava.
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return false;
  }
  return true;
}

// ---------- Potpisani linkovi za privatne slike ----------
// Kupac vidi svoju probu na osmijehu preko linka koji ističe; token upita se nikad ne stavlja u adresu.
const mediaSecret = (env) => `media:${env.MEDIA_SIGNING_KEY || env.ADMIN_TOKEN || 'dev'}`;
export async function signMedia(env, key, ttlS = 24 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlS;
  return `/media/${key}?e=${exp}&s=${await hmac(mediaSecret(env), `${key}:${exp}`)}`;
}
export async function mediaSigned(request, env, key) {
  const u = new URL(request.url);
  const exp = +u.searchParams.get('e');
  const s = u.searchParams.get('s');
  if (!s || !(exp > Date.now() / 1000)) return false;
  return safeEqual(s, await hmac(mediaSecret(env), `${key}:${exp}`));
}

// ---------- Mreža za limit upita ----------
// IPv4 po adresi, IPv6 po /64 mreži (prve četiri grupe), da promjena adrese u istoj mreži ne zaobiđe limit.
export function ipNet(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (!ip.includes(':')) return ip;
  const full = ip.includes('::') ? expand6(ip) : ip.split(':');
  return `${full.slice(0, 4).map((x) => x || '0').join(':')}::/64`;
}
function expand6(ip) {
  const [a, b] = ip.split('::');
  const left = a ? a.split(':') : [];
  const right = b ? b.split(':') : [];
  return [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
}

// ---------- Dnevni budžet i pauza ----------
// Procjena za render koji je u toku (još nema stvarnog troška), da paralelni zahtjevi ne prođu limit.
export const EST_RENDER_USD = 0.08;
const dayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
export const budgets = (env) => ({
  daily: Number(env.DAILY_BUDGET_USD) > 0 ? Number(env.DAILY_BUDGET_USD) : 30,
  perForm: Number(env.FORM_DAILY_BUDGET_USD) > 0 ? Number(env.FORM_DAILY_BUDGET_USD) : 15,
});
// null = može; inače razlog ('paused' | 'daily' | 'form').
export async function spendBlock(env, formId) {
  if (env.RENDERS_PAUSED === '1') return 'paused';
  const since = dayStart();
  const { daily, perForm } = budgets(env);
  const [all, tests, form] = await env.DB.batch([
    env.DB.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS c, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS p FROM renders WHERE created_at > ?").bind(since),
    env.DB.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS c FROM test_renders WHERE created_at > ?').bind(since),
    env.DB.prepare("SELECT COALESCE(SUM(r.cost_usd), 0) AS c, SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) AS p FROM renders r JOIN leads l ON l.id = r.lead_id WHERE r.created_at > ? AND l.form_id = ?").bind(since, formId),
  ]);
  const a = all.results[0];
  const f = form.results[0];
  if (a.c + tests.results[0].c + (a.p || 0) * EST_RENDER_USD >= daily) return 'daily';
  if (f.c + (f.p || 0) * EST_RENDER_USD >= perForm) return 'form';
  return null;
}
export const SPEND_MESSAGE = 'Previews are paused for now. Your request is saved and our team will follow up with you soon.';

// ---------- Turnstile (Cloudflare provjera protiv botova) ----------
// Radi samo kad su postavljeni TURNSTILE_SITE_KEY i TURNSTILE_SECRET; bez njih se preskače.
export const turnstileOn = (env) => !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET);
export async function turnstileOk(env, token, ip) {
  if (!turnstileOn(env)) return true;
  if (!token) return false;
  const fd = new FormData();
  fd.set('secret', env.TURNSTILE_SECRET);
  fd.set('response', token);
  if (ip) fd.set('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: fd });
    return !!(await r.json()).success;
  } catch { return false; }
}

// ---------- Moderacija (OpenAI, besplatna) ----------
// Tekst kupca (opis, natpis, dorada) i fotografija za probu prije slanja modelu za slike.
// Ako moderacija ne radi, ne blokiramo kupca (greška se samo zapiše).
export async function flagged(env, { text = '', image = null } = {}) {
  if (!env.OPENAI_API_KEY || (!String(text).trim() && !image)) return false;
  const input = [];
  if (String(text).trim()) input.push({ type: 'text', text: String(text).slice(0, 2000) });
  if (image) input.push({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.b64}` } });
  const api = env.DEV_MODE === '1' && env.OPENAI_BASE ? env.OPENAI_BASE : 'https://api.openai.com';
  try {
    const r = await fetch(`${api}/v1/moderations`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input }),
    });
    if (!r.ok) { console.error('moderation', r.status); return false; }
    return !!(await r.json()).results?.some((x) => x.flagged);
  } catch (e) { console.error('moderation', e.message); return false; }
}
export const FLAG_MESSAGE = "We can't create a preview for that request. Please describe your piece differently.";

// ---------- Stvarni tip slike (po sadržaju, ne po onome što browser kaže) ----------
export async function sniffImage(file) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

// ---------- Sigurnosna zaglavlja ----------
const FONTS = 'https://fonts.googleapis.com';
const TS = 'https://challenges.cloudflare.com';
const csp = (frameAncestors, { turnstile = false } = {}) => [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  `style-src 'self' 'unsafe-inline' ${FONTS}`,
  'font-src https://fonts.gstatic.com',
  `script-src 'self'${turnstile ? ` ${TS}` : ''}`,
  `frame-src 'self'${turnstile ? ` ${TS}` : ''}`,
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
  `frame-ancestors ${frameAncestors}`,
].join('; ');

// Stranice: builder, admin i portal se ne smiju ugraditi nigdje; forma samo na dozvoljenim sajtovima (ili svuda).
export function withSecurity(res, { page = null, ancestors = "'none'", turnstile = false } = {}) {
  const h = new Headers(res.headers);
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'strict-origin-when-cross-origin');
  h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  if (page) {
    h.set('content-security-policy', csp(ancestors, { turnstile }));
    h.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (ancestors === "'none'") h.set('x-frame-options', 'DENY');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
