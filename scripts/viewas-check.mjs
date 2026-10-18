// "View as client": sesija samo za jednog klijenta, izolacija leadova i fotografija, izlaz, log.
// node scripts/viewas-check.mjs   (server mora raditi; token iz .dev.vars; bez rendera)
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const portal = (path, token, opts = {}) => fetch(`${BASE}${path}`, { ...opts, headers: { 'x-portal-token': token } }).then(j);
const viewAs = (cid) => fetch(`${BASE}/api/admin/clients/${cid}/view-as`, { method: 'POST', headers: H }).then(j);

async function leadWithPhoto(formId, answers) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId, name: 'Isolation Test', email: 'iso@example.com', phone: '555 010 0004', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify(answers));
  fd.set('file_reference', new Blob([await (await fetch(`${BASE}/library/ring/halo.webp`)).arrayBuffer()], { type: 'image/webp' }), 'r.webp');
  return fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j);
}

ok((await fetch(`${BASE}/api/admin/clients/platform-jewelers/view-as`, { method: 'POST' })).status === 403, 'view-as bez admin tokena = 403');
ok((await viewAs('nema-ga')).status === 404, 'view-as za nepostojećeg klijenta = 404');

// dva klijenta, svaki sa svojim leadom i fotografijom
const A = 'platform-jewelers';
const other = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Other Jewelers' }) }).then(j)).body.client;
const otherForm = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: other.id, template: 'ring' }) }).then(j)).body.form;
const ringAnswers = { style: 'halo', center_shape: 'oval', metal: 'white-gold', karat: '18K', stones: 'lab', budget: '$5,000 - $10,000' };
const la = await leadWithPhoto('platform-jewelers-ring', ringAnswers);
const lb = await leadWithPhoto(otherForm.id, ringAnswers);
ok(la.status === 200 && lb.status === 200, 'lead sa fotografijom za oba klijenta');

const sa = await viewAs(A);
ok(sa.status === 200 && sa.body.token?.length >= 40 && sa.body.expiresAt - Date.now() > 55 * 60000, 'sesija za klijenta A, traje 1 sat');
const tA = sa.body.token;
const tB = (await viewAs(other.id)).body.token;

const me = await portal('/api/portal/me', tA);
ok(me.status === 200 && me.body.client.id === A, `portal/me: ${me.body.client?.name}`);
ok(me.body.forms.every((f) => f.id.startsWith('platform-jewelers')), `portal/me: samo forme klijenta A (${me.body.forms.length})`);
ok(!JSON.stringify(me.body).includes(TOKEN), 'portal ne vraća admin token');

const leadsA = (await portal('/api/portal/leads', tA)).body.leads;
const leadsB = (await portal('/api/portal/leads', tB)).body.leads;
ok(leadsA.some((l) => l.id === la.body.leadId) && !leadsA.some((l) => l.id === lb.body.leadId), 'A vidi svoj lead, ne vidi lead klijenta B');
ok(leadsB.some((l) => l.id === lb.body.leadId) && !leadsB.some((l) => l.id === la.body.leadId), 'B vidi svoj lead, ne vidi lead klijenta A');
const myLead = leadsA.find((l) => l.id === la.body.leadId);
ok(myLead.details.some((d) => d.label === 'Shape' && d.value === 'Oval'), 'odgovori su čitljivi (Shape: Oval, ne center_shape: oval)');

const photoA = myLead.photos[0]?.key;
const photoB = leadsB.find((l) => l.id === lb.body.leadId).photos[0]?.key;
const mediaStatus = (key, t) => fetch(`${BASE}/media/${key}${t ? `?t=${encodeURIComponent(t)}` : ''}`).then((r) => r.status);
ok((await mediaStatus(photoA, tA)) === 200, 'A otvara fotografiju svog kupca');
ok((await mediaStatus(photoB, tA)) === 403, 'A ne može otvoriti fotografiju kupca klijenta B');
ok((await mediaStatus(photoA)) === 403, 'fotografija kupca bez tokena = 403');

ok((await portal('/api/portal/me', 'x'.repeat(40))).status === 401, 'izmišljen token = 401');
ok((await portal('/api/portal/exit', tA, { method: 'POST' })).status === 200, 'izlaz iz sesije');
ok((await portal('/api/portal/me', tA)).status === 401, 'poslije izlaza token više ne radi');
ok((await mediaStatus(photoA, tA)) === 403, 'poslije izlaza ni fotografija');

const log = (await fetch(`${BASE}/api/admin/view-as-log`, { headers: H }).then(j)).body.sessions;
ok(log.some((x) => x.client_id === A && x.ended_at) && log.some((x) => x.client_id === other.id && !x.ended_at), 'log: obje sesije, A zatvorena');

console.log(`\nTOKEN_B=${tB}`);
console.log(fails ? `\n${fails} FAIL` : '\nsve prošlo');
process.exit(fails ? 1 : 0);
