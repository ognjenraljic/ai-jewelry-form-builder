// Auth regression checks. Local QA only; no AI calls or production mutations.
// BASE=http://127.0.0.1:8809 QA_ADMIN_TOKEN=qa-local-only QA_STATE=/tmp/jewelrylead-style-qa node scripts/portal-links-check.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { sealPortalToken, openPortalToken, activePortalSession } from '../src/portal-links.js';

const base = process.env.BASE || 'http://127.0.0.1:8797';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local QA server required.');
const admin = process.env.QA_ADMIN_TOKEN || readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
let checks = 0;
const check = (value, message) => { assert.ok(value, message); console.log(`OK ${++checks} ${message}`); };
async function request(path, { method = 'GET', body, admin: asAdmin = false, portal, cookie } = {}) {
  const options = { method, headers: { ...(asAdmin ? { 'x-admin-token': admin } : {}), ...(portal ? { 'x-portal-token': portal } : {}), ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) };
  let r;
  try { r = await fetch(base + path, options); }
  catch (e) {
    if (method !== 'GET') throw e;
    // Local Wrangler may reset a pooled connection while the SQL fixture is applied.
    r = await fetch(base + path, options);
  }
  return { status: r.status, headers: r.headers, data: await r.json() };
}
const post = (path, body = {}, extra = {}) => request(path, { method: 'POST', body, admin: true, ...extra });
const get = (path) => request(path, { admin: true });
const tokenOf = (link) => new URL(link.url).hash.slice(3);
const pathOf = (id) => `/api/admin/clients/${id}/portal-link`;
async function client(name) { const r = await post('/api/admin/clients', { name: `${name} ${Date.now().toString(36)}` }); assert.equal(r.status, 200); return r.data.client.id; }

const env = { PORTAL_LINK_KEY: 'independent-local-encryption-key-for-qa' };
const session = { id: 'session-a', client_id: 'client-a' };
const original = 'q'.repeat(40);
const cipher = await sealPortalToken(env, session, original);
check(!cipher.includes(original) && cipher !== await sealPortalToken(env, session, original), 'token is encrypted with a fresh nonce');
check(await openPortalToken(env, { ...session, token_cipher: cipher }) === original, 'encrypted token can be recovered');
await assert.rejects(openPortalToken(env, { ...session, client_id: 'other', token_cipher: cipher }));
check(true, 'ciphertext cannot be moved to another client');
await assert.rejects(openPortalToken({ PORTAL_LINK_KEY: 'different-key' }, { ...session, token_cipher: cipher }));
check(true, 'wrong encryption key cannot reveal the token');
check(activePortalSession({ kind: 'client', expires_at: 0 }, Date.now() + 100 * 365 * 86400_000), 'owner link has no expiry');
check(!activePortalSession({ kind: 'view-as', expires_at: 0 }) && !activePortalSession({ kind: 'view-as', expires_at: Date.now() - 1 }), 'admin view always requires a future expiry');
check(!activePortalSession({ kind: 'client', expires_at: 0, ended_at: Date.now() }), 'revoked permanent link is rejected');

const cid = await client('Permanent portal QA'), path = pathOf(cid);
check((await request(path)).status === 403, 'retrieval requires admin authentication');
check((await get(path)).data.active === false, 'GET does not create a link');
const created = await post(path), link = created.data, token = tokenOf(link);
check(created.status === 200 && link.expiresAt === null, 'new owner link has no expiry');
const recovered = await get(path);
check(recovered.data.url === link.url && /no-store/.test(recovered.headers.get('cache-control')), 'same link is retrieved without caching');
check((await post(path)).data.url === link.url, 'ordinary create request reuses an active link');
check(!(await request('/api/portal/me', { portal: token })).data.token_cipher, 'owner API never exposes ciphertext');
check((await request(path, { portal: token })).status === 403, 'owner cannot call admin link retrieval');
const login = await post('/api/portal/session', { token }, { admin: false });
check(login.status === 200 && /HttpOnly/.test(login.headers.get('set-cookie')) && /Max-Age=2592000/.test(login.headers.get('set-cookie')), 'permanent link uses a bounded HttpOnly device cookie');
const cookie = login.headers.get('set-cookie').split(';')[0];
const me = await request('/api/portal/me', { cookie });
check(me.status === 200 && me.data.session.expiresAt === null, 'owner cookie signs into a non-expiring portal link');
const onboarding = await post(`/api/admin/clients/${cid}/onboarding`);
const resend = await post(`/api/admin/clients/${cid}/onboarding`);
check(onboarding.data.url === link.url && resend.data.url === link.url && resend.data.onboarding.id === onboarding.data.onboarding.id, 'onboarding and resend preserve the same link');
const view = (await post(`/api/admin/clients/${cid}/view-as`)).data;
check(view.expiresAt > Date.now() + 55 * 60000 && (await request(path, { portal: view.token })).status === 403, 'view-as still lasts one hour and cannot retrieve owner links');
const replacement = (await post(path, { replace: true })).data;
check(replacement.url !== link.url && (await request('/api/portal/me', { portal: token })).status === 401, 'explicit replacement revokes the old link');
check((await request('/api/portal/me', { cookie })).status === 401, 'replacement also revokes the old device cookie');
check((await request('/api/portal/me', { portal: tokenOf(replacement) })).status === 200, 'replacement link works');
await request(path, { method: 'DELETE', admin: true });
check((await get(path)).data.active === false && (await request('/api/portal/me', { portal: tokenOf(replacement) })).status === 401, 'turn off revokes access and removes the retrievable link');

const concurrentId = await client('Portal link UI QA');
const simultaneous = await Promise.all(Array.from({ length: 5 }, () => post(pathOf(concurrentId))));
check(simultaneous.every((r) => r.status === 200 && r.data.url === simultaneous[0].data.url), 'concurrent creation returns one stable link');
check((await get('/api/admin/overview')).data.links[concurrentId], 'overview counts permanent links as active');
check(!JSON.stringify((await get('/api/admin/overview')).data).includes(tokenOf(simultaneous[0].data)), 'overview does not expose owner tokens');

if (process.env.QA_STATE) {
  const sql = (statement) => execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'konfigurator', '--local', '--persist-to', process.env.QA_STATE, '--command', statement], { stdio: 'pipe', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  const legacyId = await client('Legacy portal QA'), legacyPath = pathOf(legacyId), old = (await post(legacyPath)).data;
  sql(`UPDATE portal_sessions SET token_cipher = NULL, expires_at = ${Date.now() + 86400_000} WHERE client_id = '${legacyId}' AND kind = 'client';`);
  const before = await get(legacyPath);
  check(before.data.active && before.data.legacy && !before.data.url, 'old hash-only link remains active without pretending to recover it');
  check((await post(legacyPath)).status === 409 && (await post(`/api/admin/clients/${legacyId}/onboarding`)).status === 409, 'unrecoverable legacy link is never silently replaced');
  check((await request('/api/portal/me', { portal: tokenOf(old) })).status === 200, 'existing owner visit still works and upgrades its link');
  const after = (await get(legacyPath)).data;
  check(after.url === old.url && after.expiresAt === null, 'legacy visit makes the exact same URL retrievable without expiry');
  sql(`UPDATE portal_sessions SET token_cipher = NULL, expires_at = ${Date.now() - 1000} WHERE client_id = '${legacyId}' AND kind = 'client';`);
  check((await request('/api/portal/me', { portal: tokenOf(old) })).status === 401, 'expired legacy links are not revived');
}
await post(`/api/admin/clients/${cid}/portal-link`);
const beforeArchive = (await get(path)).data;
await post(`/api/admin/clients/${cid}/archive`, { archived: true });
check((await get(path)).status === 409 && (await request('/api/portal/me', { portal: tokenOf(beforeArchive) })).status === 401, 'archiving a client revokes its permanent link');
await post(`/api/admin/clients/${cid}/archive`, { archived: false });
check((await get(path)).data.active === false, 'restoring a client does not revive revoked credentials');

writeFileSync('/tmp/jewelrylead-persistent-link-qa.json', JSON.stringify({ base, clientId: concurrentId, url: simultaneous[0].data.url }), { mode: 0o600 });
console.log(`\n${checks} portal link checks passed. No AI calls.`);
