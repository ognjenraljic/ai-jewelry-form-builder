// Mejl (21.11.2026): obavještenje radnji o novom leadu i prva poruka kupcu.
// Slanje preko Resend HTTP API-ja. Bez RESEND_API_KEY i MAIL_FROM (Worker secret / variable) ništa se ne šalje,
// pa deploy sam po sebi nikome ne piše. MAIL_API_BASE (lažni server za provjere) važi samo uz DEV_MODE=1.
//   MAIL_FROM primjer: "JewelryLead <leads@jewelrylead.com>" (domen mora biti potvrđen kod Resenda)
const API = 'https://api.resend.com';
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

export function mailOn(env) {
  return !!(env.RESEND_API_KEY && fromAddress(env));
}

export function validEmail(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return s.length <= 120 && EMAIL_RE.test(s) ? s : '';
}

export function emailList(v, max = 5) {
  const parts = Array.isArray(v) ? v : String(v ?? '').split(/[\s,;]+/);
  return [...new Set(parts.map(validEmail).filter(Boolean))].slice(0, max);
}

// Adresa iz MAIL_FROM ("Ime <a@b.com>" ili samo "a@b.com").
function fromAddress(env) {
  const raw = String(env.MAIL_FROM || '').trim();
  return validEmail(raw.match(/<([^>]+)>/)?.[1] || raw);
}

// Ime pošiljaoca bez znakova koji lome zaglavlje.
const displayName = (s) => String(s || '').replace(/[\r\n"<>]/g, '').trim().slice(0, 60);

export async function sendMail(env, { to, subject, text, html, replyTo, fromName }) {
  if (!mailOn(env)) return { skipped: 'not configured' };
  const recipients = emailList(to, 10);
  if (!recipients.length) return { skipped: 'no recipient' };
  const addr = fromAddress(env);
  const name = displayName(fromName) || displayName(String(env.MAIL_FROM).match(/^([^<]+)</)?.[1]);
  const base = env.DEV_MODE === '1' && env.MAIL_API_BASE ? env.MAIL_API_BASE : API;
  const res = await fetch(`${base}/emails`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: name ? `${name} <${addr}>` : addr,
      to: recipients,
      subject: String(subject || '').replace(/[\r\n]+/g, ' ').slice(0, 180),
      text,
      ...(html ? { html } : {}),
      ...(validEmail(replyTo) ? { reply_to: validEmail(replyTo) } : {}),
    }),
  });
  if (!res.ok) throw new Error(`mail ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const j = await res.json().catch(() => ({}));
  return { id: j.id || null };
}
