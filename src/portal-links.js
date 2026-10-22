// Retrievable owner links are encrypted at rest; authentication still uses only their hash.
// PORTAL_LINK_KEY is independent of the admin credential and must survive deployments.
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function key(env) {
  const secret = env.PORTAL_LINK_KEY || (env.DEV_MODE === '1' ? env.ADMIN_TOKEN : '');
  if (!secret) throw new Error('PORTAL_LINK_KEY is not configured.');
  const material = await crypto.subtle.digest('SHA-256', enc.encode(`JewelryLead/portal-links/v1:${secret}`));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const context = (session) => enc.encode(`portal-link:v1:${session.client_id}:${session.id}`);
export async function sealPortalToken(env, session, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context(session) }, await key(env), enc.encode(token));
  return `v1.${b64(iv)}.${b64(ciphertext)}`;
}

export async function openPortalToken(env, session) {
  const [version, iv, ciphertext] = String(session.token_cipher || '').split('.');
  if (version !== 'v1' || !iv || !ciphertext) throw new Error('Portal link has not been retained yet.');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: context(session) }, await key(env), unb64(ciphertext));
  return new TextDecoder().decode(plaintext);
}

export function activePortalSession(session, now = Date.now()) {
  return !!session && !session.ended_at && ((session.kind === 'client' && session.expires_at === 0) || session.expires_at > now);
}
