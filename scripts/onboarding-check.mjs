// Lokalni E2E: upload -> preview -> finalno slanje -> obavještenje -> stvarna forma.
// Ne poziva AI. BASE=http://127.0.0.1:8807 QA_ADMIN_TOKEN=qa-local-only
// QA_STATE=/tmp/jewelrylead-ux-qa node scripts/onboarding-check.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const base = process.env.BASE || 'http://127.0.0.1:8797';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Run this check only against a local QA server.');
const token = process.env.QA_ADMIN_TOKEN || readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
let count = 0;
function check(value, message) { assert.ok(value, message); console.log(`OK ${++count} ${message}`); }
async function req(path, { method = 'GET', body, portal, admin = false } = {}) {
  const form = body instanceof FormData;
  const r = await fetch(base + path, { method, headers: { ...(admin ? { 'x-admin-token': token } : {}), ...(portal ? { 'x-portal-token': portal } : {}), ...(body && !form ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: form ? body : JSON.stringify(body) } : {}) });
  return { status: r.status, data: await r.json() };
}
const post = (path, body, extra = {}) => req(path, { method: 'POST', body, ...extra });
const run = Date.now().toString(36);
const client = (await post('/api/admin/clients', { name: `Onboarding QA ${run}` }, { admin: true })).data.client;
check(client?.id, 'test client created');
const start = await post(`/api/admin/clients/${client.id}/onboarding`, {}, { admin: true });
const portal = new URL(start.data.url).hash.slice(3);
const obId = start.data.onboarding.id;
const obPath = `/api/admin/onboardings/${obId}`;
const stored = async () => (await req(obPath, { admin: true })).data.onboarding;
const before = await stored();
const me = (await req('/api/portal/me', { portal })).data;
check(me.onboarding?.status === 'draft', 'client sees draft onboarding');
const defaults = me.onboardingDefaults;
check(defaults.pieces.find((p) => p.value === 'chain').image === '/site/gallery/chain-category-v2.webp', 'new chain category image');
check((await req('/api/portal/onboarding/preview')).status === 401, 'preview requires client session');
for (const path of ['/api/portal/onboarding/preview', '/api/portal/onboarding/submit']) {
  const malformed = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-portal-token': portal }, body: 'null' });
  check(malformed.status === 400, `${path.split('/').pop()}: invalid body gives a useful error instead of 500`);
}

const fd = new FormData();
fd.set('file', new Blob([readFileSync(new URL('../public/site/gallery/chain-category-v2.webp', import.meta.url))], { type: 'image/webp' }), 'chain.webp');
const photo = await post('/api/portal/onboarding/upload', fd, { portal });
check(photo.status === 200 && photo.data.url.startsWith(`/media/onboarding/${client.id}/`), 'photo uploaded to own onboarding folder');
check((await fetch(base + photo.data.url, { headers: { 'x-portal-token': portal } })).status === 200, 'uploaded photo is readable by its owner');
const invalidPhoto = new FormData(); invalidPhoto.set('file', new Blob(['not an image'], { type: 'image/jpeg' }), 'fake.jpg');
check((await post('/api/portal/onboarding/upload', invalidPhoto, { portal })).status === 400, 'invalid photo receives a clear validation error');
const data = {
  store: { name: 'Aurora QA', website: 'https://aurora.example', logo: photo.data.url, accent: '#9b8cff', theme: 'light' },
  pieces: [{ uid: 'piece1', value: 'chain', label: 'Chain', styles: [{ ...defaults.styles.chain[0], uid: 'style1', image: photo.data.url, keep: true }, { uid: 'style2', label: 'Hidden style', keep: false }] }],
  metals: ['yellow-gold', 'custom-silver'], customMetals: [{ value: 'custom-silver', label: 'Silver', swatch: '#8b9ca8' }],
  stones: ['none', 'custom-ruby'], customStones: [{ value: 'custom-ruby', label: 'Ruby' }],
  budgets: ['$500 - $1,000', '$1,000+'], notes: 'Private note for the team', questions: 'Legacy request: ring size', step: 5,
};
const preview = await post('/api/portal/onboarding/preview', { data }, { portal });
check(preview.status === 200, 'live preview built from unsaved draft');
const p = preview.data.form;
const fields = (f) => f.steps.flatMap((s) => s.fields);
const labels = (f, id) => fields(f).find((x) => x.id === id).options.map((x) => x.label);
check(p.brand.name === data.store.name && p.brand.logo === photo.data.url, 'preview uses current store name and logo');
check(p.theme.accent === '#9b8cff' && p.theme.bg === '#faf7f2', 'preview uses selected color and light theme');
check(labels(p, 'metal').join() === 'Yellow Gold,Silver', 'custom metal appears as an actual customer choice');
check(fields(p).find((f) => f.id === 'metal').options.find((o) => o.label === 'Silver').swatch === '#8b9ca8', 'custom metal color reaches live preview');
const unsafeSwatch = await post('/api/portal/onboarding/preview', { data: { ...data, customMetals: [{ ...data.customMetals[0], swatch: 'url(https://example.com)' }] } }, { portal });
check(fields(unsafeSwatch.data.form).find((f) => f.id === 'metal').options.find((o) => o.label === 'Silver').swatch === '#c0c4c8', 'invalid material color is replaced by a safe default');
check(labels(p, 'stones').join() === 'No stones,Ruby', 'custom stone appears as an actual customer choice');
check(p.styles.chain.length === 1 && p.styles.chain[0].image === photo.data.url, 'disabled style excluded and replacement photo used');
check(!JSON.stringify(p).includes('Private note') && !JSON.stringify(p).includes('Legacy request'), 'team notes and legacy requests stay out of customer form');
check((await stored()).rev === before.rev, 'preview does not autosave or change revision');

const foreign = await post('/api/portal/onboarding/preview', { data: { ...data, store: { ...data.store, logo: '/media/onboarding/another-store/logo.webp' } } }, { portal });
check(!foreign.data.form.brand.logo, 'preview rejects another client photo');
const view = await post(`/api/admin/clients/${client.id}/view-as`, {}, { admin: true });
const viewToken = view.data.token;
check((await post('/api/portal/onboarding/preview', { data }, { portal: viewToken })).status === 200, 'admin view can preview without saving');
check((await req('/api/portal/onboarding', { method: 'PUT', body: { data, rev: 0 }, portal: viewToken })).status === 403, 'admin view cannot edit client answers');

const save = await req('/api/portal/onboarding', { method: 'PUT', body: { data, rev: 0 }, portal });
check(save.status === 200 && save.data.rev === 1, 'answers autosaved with version');
check((await post('/api/portal/onboarding/submit', { data, rev: 0 }, { portal })).status === 409, 'stale submission rejected without overwriting answers');
check((await stored()).status === 'draft', 'conflict leaves onboarding open');

// Prisilni kvar obavještenja: dokaz da status i finalni odgovori ostaju draft, pa je Retry bezbjedan.
if (process.env.QA_STATE) {
  const sql = (statement) => execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'konfigurator', '--local', '--persist-to', process.env.QA_STATE, '--command', statement], { stdio: 'pipe', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  const trigger = `qa_fail_notice_${run}`;
  try {
    sql(`CREATE TRIGGER ${trigger} BEFORE INSERT ON notifications WHEN NEW.ref = '${obId}' BEGIN SELECT RAISE(ABORT, 'QA notification failure'); END;`);
    const failed = await post('/api/portal/onboarding/submit', { data: { ...data, notes: 'Final unsaved note' }, rev: 1 }, { portal });
    check(failed.status === 500, 'injected database failure returned as failure');
    const rollback = await stored();
    check(rollback.status === 'draft' && rollback.rev === 1 && rollback.data.notes === data.notes, 'transaction rolls back answers, version and status together');
  } finally { sql(`DROP TRIGGER IF EXISTS ${trigger};`); }
}
const finalData = { ...data, notes: 'Final unsaved note' };
const results = await Promise.all([post('/api/portal/onboarding/submit', { data: finalData, rev: 1 }, { portal }), post('/api/portal/onboarding/submit', { data: finalData, rev: 1 }, { portal })]);
check(results.every((x) => x.status === 200), 'concurrent retry succeeds without duplicate submission');
const submitted = await stored();
check(submitted.status === 'submitted' && submitted.data.notes === 'Final unsaved note', 'final unsaved answers included in submission');
const notices = (await req('/api/admin/notifications', { admin: true })).data.items.filter((n) => n.ref === obId);
check(notices.length === 1, 'admin receives exactly one notification');
const built = await post(`${obPath}/build`, {}, { admin: true });
check(built.status === 200, 'admin builds real form from submitted onboarding');
const publicForm = (await req(`/api/forms/${built.data.form.id}`)).data;
check(publicForm.theme.accent === p.theme.accent && publicForm.theme.bg === p.theme.bg, 'published-form theme matches preview');
check(labels(publicForm, 'metal').join() === labels(p, 'metal').join() && labels(publicForm, 'stones').join() === labels(p, 'stones').join(), 'real custom choices match preview');
check(fields(publicForm).find((f) => f.id === 'metal').options.find((o) => o.label === 'Silver').swatch === '#8b9ca8', 'custom material color survives saving, submission and form creation');
check(publicForm.styles.chain[0].image.startsWith(`/media/forms/${publicForm.id}/`), 'onboarding photos copied into real form');
check(!JSON.stringify(publicForm).includes('Final unsaved note'), 'internal notes never become customer-facing fields');
const savedClient = (await req('/api/admin/forms', { admin: true })).data.clients.find((c) => c.id === client.id);
check(savedClient.notes.includes('Final unsaved note') && savedClient.notes.includes('Legacy request'), 'team notes and earlier question requests are retained for admin');
check((await post(`${obPath}/build`, {}, { admin: true })).status === 409, 'second build cannot create a duplicate form');
console.log(`Passed ${count} onboarding checks. No AI calls.`);
