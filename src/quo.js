// Quo (ranije OpenPhone) kao kanal za SMS dok broj radnje nije u GoHighLevel-u (28.11.2026).
// Poruke ide iz našeg Workera preko Quo API-ja; ključ radnje je šifrovan (isti tajni ključ kao GHL token, AD "quo:<clientId>").
// Dokumentacija (provjereno 28.11.2026): auth je sirov ključ u Authorization (bez Bearer), slanje POST /v1/messages (202),
// brojevi GET /v1/phone-numbers, webhookovi POST /webhooks sa zaglavljem Quo-Api-Version, potpis po Standard Webhooks.

import { sealSecret, openSecret } from './ghl.js';

export const QUO_BASE = 'https://api.quo.com';
export const QUO_WEBHOOK_VERSION = '2026-03-30';
export const QUO_WEBHOOK_EVENTS = ['message.received', 'message.delivered', 'message.failed', 'message.undelivered'];

export const sealQuoKey = (env, clientId, key) => sealSecret(env, `quo:${clientId}`, key);
export const openQuoKey = (env, clientId, sealed) => openSecret(env, `quo:${clientId}`, sealed);

// Jedan poziv prema Quo-u; fetchFn se mijenja u provjerama (lažni server preko QUO_BASE).
export async function quoCall(key, method, path, body, fetchFn = fetch, headers = {}) {
  const res = await fetchFn(QUO_BASE + path, {
    method,
    headers: { Authorization: key, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(quoMessage(data.code, res.status, data.message));
    e.status = res.status;
    e.code = data.code || null;
    throw e;
  }
  return data;
}

// Greška iz Quo-a prevedena u rečenicu koju zlatar razumije.
export function quoMessage(code, status, raw) {
  const m = {
    '0201400': 'This customer opted out of texts.',
    '0206400': 'Quo says your A2P registration is not approved yet. Finish the registration in Quo, then texts can go out.',
    '0202400': 'That phone number is not valid.',
    '0203400': 'That number cannot be reached by text.',
    '0200402': 'Your Quo credits ran out. Add credits in Quo to send texts.',
    '0201402': 'Your Quo subscription expired. Renew it in Quo to send texts.',
    '0202402': 'Your Quo messaging allowance is used up. Add credits in Quo.',
    '0202403': 'This API key is not a user of the selected Quo number.',
  };
  if (m[code]) return m[code];
  if (status === 401) return 'Quo did not accept the API key. Create a new key in Quo and connect again.';
  if (status === 403) return 'Quo says this key is not allowed to do that.';
  if (status === 429) return 'Quo is rate limiting us. The text will be tried again shortly.';
  return `Quo: ${String(raw || `HTTP ${status}`).slice(0, 160)}`;
}

// Brojevi radnje u Quo-u: [{ id, name, number }].
export async function quoNumbers(key, fetchFn = fetch) {
  const d = await quoCall(key, 'GET', '/v1/phone-numbers', null, fetchFn);
  return (d.data || []).map((n) => ({ id: String(n.id || ''), name: String(n.name || '').slice(0, 60), number: String(n.number || '') })).filter((n) => n.id && n.number);
}

// SMS: vraća { id, status }. from = "PN..." id (ili E.164), to = E.164 kupca.
export async function quoSend(key, from, to, content, fetchFn = fetch) {
  const d = await quoCall(key, 'POST', '/v1/messages', { content: String(content).slice(0, 1600), from, to: [to] }, fetchFn);
  return { id: String(d.data?.id || ''), status: String(d.data?.status || 'queued') };
}

// Webhook pravimo sami (radnja ne kopira ništa): poruke i potvrde isporuke za izabrani broj.
export async function quoCreateWebhook(key, url, numberId, fetchFn = fetch) {
  const d = await quoCall(key, 'POST', '/webhooks', { url, events: QUO_WEBHOOK_EVENTS, resourceIds: [numberId], label: 'JewelryLead' }, fetchFn, { 'Quo-Api-Version': QUO_WEBHOOK_VERSION });
  return { id: String(d.data?.id || ''), key: String(d.data?.key || '') };
}
export async function quoDeleteWebhook(key, id, fetchFn = fetch) {
  await quoCall(key, 'DELETE', `/webhooks/${encodeURIComponent(id)}`, null, fetchFn, { 'Quo-Api-Version': QUO_WEBHOOK_VERSION });
}

// Telefon -> E.164. 10 cifara (ili 11 sa vodećom 1) je SAD; ostalo samo ako već ima + i izgleda kao međunarodni broj.
export function toE164(raw) {
  const s = String(raw ?? '').trim();
  const d = s.replace(/\D/g, '');
  if (s.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(`+${d}`) ? `+${d}` : '';
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === '1') return `+${d}`;
  return '';
}
export const isUsNumber = (e164) => /^\+1[2-9]\d{9}$/.test(String(e164 || ''));
export const maskPhone = (e164) => { const d = String(e164 || '').replace(/\D/g, ''); return d.length >= 4 ? `${d.length === 11 && d[0] === '1' ? '+1 ' : '+'}••• ••• ${d.slice(-4)}` : ''; };
export const STOP_WORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
export const START_WORDS = ['START', 'UNSTOP'];

// Potpis webhooka (Standard Webhooks): HMAC-SHA256 nad `${id}.${timestamp}.${body}`, ključ je base64 poslije "whsec_".
const b64bytes = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
async function hmacKey(secret, usage) {
  const raw = b64bytes(String(secret).replace(/^whsec_/, ''));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}
export async function quoSignature(secret, id, ts, body) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), new TextEncoder().encode(`${id}.${ts}.${body}`));
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}
// true samo kad se bilo koji v1 potpis poklapa (poređenje u konstantnom vremenu preko verify) i nije stariji od 5 min.
export async function verifyQuoSignature(secret, headers, body, now = Date.now()) {
  try {
    const id = headers.get('webhook-id') || '';
    const ts = headers.get('webhook-timestamp') || '';
    const sigs = (headers.get('webhook-signature') || '').split(' ').filter(Boolean);
    if (!id || !ts || !sigs.length || !secret) return false;
    if (!Number.isFinite(Number(ts)) || Math.abs(now / 1000 - Number(ts)) > 300) return false;
    const key = await hmacKey(secret, ['verify']);
    const data = new TextEncoder().encode(`${id}.${ts}.${body}`);
    for (const s of sigs) {
      const [v, b] = s.split(',');
      if (v !== 'v1' || !b) continue;
      let sig;
      try { sig = b64bytes(b); } catch { continue; }
      if (await crypto.subtle.verify('HMAC', key, sig, data)) return true;
    }
  } catch { /* loš potpis ili ključ */ }
  return false;
}
