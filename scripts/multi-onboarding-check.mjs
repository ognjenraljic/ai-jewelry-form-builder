// Više onboardinga po projektu (svaki za svoju formu), telefon i ponuđeni odgovori. Lokalno, bez AI poziva.
// node scripts/multi-onboarding-check.mjs   (server mora raditi; token iz .dev.vars)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { COUNTRIES, formatNational, parsePhone, phoneValid, phoneValue } from '../public/phone.js';
import { SUGGESTED, answersFor, suggestOptions, notTaken } from '../public/option-suggestions.js';

const base = process.env.BASE || 'http://127.0.0.1:8797';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Run this check only against a local QA server.');
const token = process.env.QA_ADMIN_TOKEN || readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
let count = 0;
const check = (value, message) => { assert.ok(value, message); console.log(`OK ${++count} ${message}`); };
async function req(path, { method = 'GET', body, portal, admin = false } = {}) {
  const r = await fetch(base + path, { method, headers: { ...(admin ? { 'x-admin-token': token } : {}), ...(portal ? { 'x-portal-token': portal } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const admin = (path, body, method = 'POST') => req(path, { method, body, admin: true });

// Telefon
check(COUNTRIES[0].dial === '1' && COUNTRIES.length > 200 && new Set(COUNTRIES.map((c) => c.iso)).size === COUNTRIES.length, 'all countries listed once, +1 first');
check(formatNational('1', '5551234567') === '(555) 123-4567', '+1 number is formatted');
check(formatNational('1', '555123') === '(555) 123', 'partial +1 number is formatted');
check(parsePhone('+387 65 123 456').country.iso === 'BA', 'pasted number picks its country');
check(parsePhone('5551234567').country.iso === 'US', '+1 is the default');
check(phoneValid(phoneValue(COUNTRIES[0], '5551234567')) && !phoneValid(phoneValue(COUNTRIES[0], '555123')), 'US number needs 10 digits');
check(phoneValid('+387 651 234 56') && !phoneValid('+387 12') && !phoneValid('5551234567'), 'other countries: length and code are checked');

// Ponuđeni odgovori
check(suggestOptions('metal').includes('Sterling Silver') && suggestOptions('chain_length').includes('18"'), 'answers follow the question category');
check(answersFor('Finish').includes('Matte') && !answersFor('Zzz').length, 'known question brings its answers');
check(suggestOptions('whatever', 'Zzz').length === 3, 'unknown question still offers answers');
check(notTaken(['Ruby', 'Opal'], ['ruby']).join() === 'Opal', 'what is already there is not offered again');
for (const [k, v] of Object.entries(SUGGESTED)) if (k !== 'styles') for (const x of v) assert.ok(String(x.label ?? x).length <= 60, `${k}: too long`);
for (const list of Object.values(SUGGESTED.styles)) for (const x of list) assert.ok(x.length <= 40);
check(true, 'every suggestion fits its limit');

// Dva otvorena onboardinga istog projekta
const run = Date.now().toString(36);
const client = (await admin('/api/admin/clients', { name: `Multi onboarding ${run}` })).data.client;
const a = (await admin(`/api/admin/clients/${client.id}/onboarding`, { fresh: true, name: 'Grillz page' })).data;
const b = (await admin(`/api/admin/clients/${client.id}/onboarding`, { fresh: true, name: 'Rings page' })).data;
check(a.onboarding.id !== b.onboarding.id, 'each new form gets its own onboarding');
const portal = new URL(a.url).hash.slice(3);
check(new URL(a.url).pathname === new URL(b.url).pathname && new URL(a.url).hash === new URL(b.url).hash, 'one project, one permanent portal link');
const again = (await admin(`/api/admin/clients/${client.id}/onboarding`, { id: a.onboarding.id })).data;
check(again.onboarding.id === a.onboarding.id, 'same link again does not open a new one');
const list = () => req('/api/admin/onboardings', { admin: true }).then((r) => r.data.onboardings.filter((o) => o.client_id === client.id));
check((await list()).map((o) => o.form_name).sort().join() === 'Grillz page,Rings page', 'admin sees both, by form name');
const me = (id) => req(`/api/portal/me?onboarding=${id}`, { portal }).then((r) => r.data);
check((await me(a.onboarding.id)).onboarding.id === a.onboarding.id && (await me(b.onboarding.id)).onboarding.id === b.onboarding.id, 'the link opens the right onboarding');
const other = (await admin('/api/admin/clients', { name: `Other ${run}` })).data.client;
const foreign = (await admin(`/api/admin/clients/${other.id}/onboarding`, { fresh: true })).data;
check((await me(foreign.onboarding.id)).onboarding === null, "another client's onboarding id gives nothing");
check((await admin(`/api/admin/clients/${client.id}/onboarding`, { id: foreign.onboarding.id })).status === 404, 'cannot reuse an onboarding of another client');

// Slanje jednog ne dira drugi, forma nosi ime
const base1 = (await me(a.onboarding.id));
const defaults = base1.onboardingDefaults;
const data = { ...base1.onboarding.data, store: { ...base1.onboarding.data.store, name: 'Multi QA', accent: '#35d0c4', theme: 'dark' }, pieces: [{ uid: 'p1', value: 'chain', label: 'Chain', image: '', styles: defaults.styles.chain.slice(0, 2).map((s, k) => ({ ...s, uid: `s${k}`, keep: true, custom: false })), metals: ['yellow-gold'], karats: ['14K'], stones: ['none'], budgets: ['$1,500 - $2,500'], specs: {}, questions: [], required: { styles: true, materials: true, details: false } }] };
const sent = await req(`/api/portal/onboarding/submit?onboarding=${a.onboarding.id}`, { method: 'POST', body: { data, rev: base1.onboarding.rev }, portal });
check(sent.status === 200 && sent.data.status === 'submitted', 'first onboarding sent');
check((await me(b.onboarding.id)).onboarding.status === 'draft', 'the other onboarding stays open');
check((await req(`/api/admin/onboardings/${a.onboarding.id}`, { method: 'DELETE', admin: true })).status === 409, 'a sent onboarding cannot be removed');
const built = await admin(`/api/admin/onboardings/${a.onboarding.id}/build`);
check(built.status === 200 && built.data.form.name === 'Grillz page', 'the form keeps the name it was sent with');
check((await list()).find((o) => o.id === a.onboarding.id).form_id === built.data.form.id, 'onboarding points at its form');
check((await req(`/api/admin/onboardings/${b.onboarding.id}`, { method: 'DELETE', admin: true })).status === 200 && (await list()).length === 1, 'an unsent onboarding can be removed');
console.log(`\nAll ${count} checks passed`);
