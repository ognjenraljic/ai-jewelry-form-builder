// Obavještenje radnji, automatska prva poruka kupcu i dnevnik koraka (21.11.2026).
//   node scripts/mock-openai.mjs 8893 & node scripts/mock-mail.mjs 8897 &
//   npx wrangler dev --port 8796 --test-scheduled --var OPENAI_API_KEY:mock-local --var OPENAI_BASE:http://127.0.0.1:8893 \
//     --var RESEND_API_KEY:mock --var "MAIL_FROM:JewelryLead <leads@jewelrylead.com>" --var MAIL_API_BASE:http://127.0.0.1:8897 --var NOTIFY_TEST_DELAY_MS:0
//   BASE=http://127.0.0.1:8796 MAIL=http://127.0.0.1:8897 node scripts/alerts-check.mjs
import { readFileSync } from 'node:fs';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8796';
const MAIL = process.env.MAIL || 'http://127.0.0.1:8897';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mails = async () => (await fetch(`${MAIL}/__log`).then((r) => r.json()));
const cron = () => fetch(`${BASE}/__scheduled?cron=${encodeURIComponent('*/5 * * * *')}`);
const tag = Date.now().toString(36);

async function shop(name, notify) {
  const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name }) }).then(j)).body.client;
  const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
  const V = { 'x-portal-token': (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token, 'content-type': 'application/json' };
  const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
  const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
  const saved = (await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: V, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, ...notify } }) }).then(j)).body.pricing;
  return { client, form, V, C, saved };
}
async function lead(form, name) {
  const fd = new FormData();
  const email = `${name.split(' ')[0].toLowerCase()}.${tag}@example.com`;
  for (const [k, v] of Object.entries({ formId: form.id, name, email, phone: '555 010 0011', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500', vision: 'Iced top six with a gold bottom row' }));
  const r = (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
  return { ...r, email };
}
const leadOf = async (P, id) => (await fetch(`${BASE}/api/portal/leads`, { headers: P }).then(j)).body.leads.find((l) => l.id === id);
const to = (m, addr) => (m.to || []).includes(addr);

// 1) Podešavanja: nevažeće adrese se izbace, uključenje pamti vrijeme.
const A = await shop(`Alerts Check ${tag}`, { alertEmails: ['owner@example.com', 'not-an-email', 'SALES@example.com'], replyTo: 'shop@example.com', autoSend: true });
ok(JSON.stringify(A.saved.alertEmails) === JSON.stringify(['owner@example.com', 'sales@example.com']), `adrese očišćene (${A.saved.alertEmails})`);
ok(A.saved.replyTo === 'shop@example.com' && A.saved.autoSend === true && A.saved.autoSendSince > 0, 'reply-to, autoSend i vrijeme uključenja sačuvani');
const me = (await fetch(`${BASE}/api/portal/me`, { headers: A.C }).then(j)).body;
ok(me.mail === true && me.speed && me.speed.leads === 0 && me.speed.medianMin === null, 'portal zna da je mejl uključen; statistika prazna');
const since = A.saved.autoSendSince;
const again = (await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: A.V, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, alertEmails: ['owner@example.com', 'sales@example.com'], replyTo: 'shop@example.com', autoSend: true } }) }).then(j)).body.pricing;
ok(again.autoSendSince === since, 'ponovno čuvanje ne pomjera vrijeme uključenja');

// 2) Novi lead: radnja dobija mejl odmah (waitUntil), sa porukom i stranicom; odgovor ide kupcu.
const before = (await mails()).length;
const ava = await lead(A.form, 'Ava Alert');
let alert;
for (let i = 0; i < 40 && !alert; i++) { await sleep(250); alert = (await mails()).slice(before).find((m) => to(m, 'owner@example.com') && m.reply_to === ava.email); }
ok(!!alert, 'radnja dobila mejl o novom leadu');
ok(alert && to(alert, 'sales@example.com') && alert.reply_to === ava.email, 'obje adrese, reply-to = kupac');
ok(alert && /Ready-to-send quote message/.test(alert.text) && /\/p\/[a-z0-9]+\?preview=1/.test(alert.text) && /\/portal/.test(alert.text) && alert.html.includes('<a href='), 'mejl ima poruku, stranicu kupca, portal i HTML linkove');
ok(alert && /^Alerts Check .* leads <leads@jewelrylead\.com>$/.test(alert.from), `pošiljalac: ${alert?.from}`);
ok(!!(await leadOf(A.C, ava.leadId)).alertedAt, 'lead ima alertedAt');

// 3) Kupac dobija prvu poruku iz crona (slika gotova), samo jednom; računa se kao prvi odgovor.
await fetch(`${BASE}/api/leads/${ava.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: ava.token }) });
await cron(); await sleep(1500);
let first = (await mails()).filter((m) => to(m, ava.email));
ok(first.length === 1 && first[0].reply_to === 'shop@example.com' && first[0].subject.startsWith('Your custom grillz design from'), `kupac dobio prvu poruku (${first.length}), odgovor ide radnji`);
ok(first[0] && /\/p\/[a-z0-9]+/.test(first[0].text) && !first[0].text.includes('preview=1'), 'kupčeva poruka ima njegovu stranicu (bez preview)');
await cron(); await sleep(1500);
first = (await mails()).filter((m) => to(m, ava.email));
ok(first.length === 1, 'drugi krug crona ne šalje ponovo');
const avaL = await leadOf(A.C, ava.leadId);
ok(avaL.autoSentAt && avaL.firstReplyAt === avaL.autoSentAt, 'autoSentAt = firstReplyAt');
ok((await mails()).filter((m) => to(m, 'owner@example.com') && m.reply_to === ava.email).length === 1, 'radnja dobila samo jedno obavještenje za Avu');

// 4) Zlatar odgovorio sam (Copy poruke): kupac ne dobija automatsku poruku.
const ben = await lead(A.form, 'Ben Copied');
await sleep(3000);
const evView = (await fetch(`${BASE}/api/portal/leads/${ben.leadId}/events`, { method: 'POST', headers: A.V, body: JSON.stringify({ type: 'quote_copied', slot: 'picked' }) }).then(j)).body;
ok(evView.readOnly === true, 'admin pregled: Copy se ne broji');
ok(!(await leadOf(A.C, ben.leadId)).firstReplyAt, 'poslije admin pregleda još nema odgovora');
ok((await fetch(`${BASE}/api/portal/leads/${ben.leadId}/events`, { method: 'POST', headers: A.C, body: JSON.stringify({ type: 'bogus' }) })).status === 400, 'nepoznat korak odbijen');
ok((await fetch(`${BASE}/api/portal/leads/${ben.leadId}/events`, { method: 'POST', headers: A.C, body: JSON.stringify({ type: 'quote_copied', slot: 'picked' }) }).then(j)).body.ok, 'zlatar kopirao poruku');
ok(!!(await leadOf(A.C, ben.leadId)).firstReplyAt, 'Copy = prvi odgovor');
await cron(); await sleep(1500);
ok(!(await mails()).some((m) => to(m, ben.email)), 'Ben ne dobija automatsku poruku');

// 5) Status Contacted je odgovor; lead sa statusom ne dobija automatsku poruku.
const cal = await lead(A.form, 'Cal Status');
await sleep(2500);
ok((await fetch(`${BASE}/api/portal/leads/${cal.leadId}`, { method: 'PATCH', headers: A.V, body: JSON.stringify({ status: 'contacted' }) })).status === 403, 'admin pregled ne mijenja status');
ok((await fetch(`${BASE}/api/portal/leads/${cal.leadId}`, { method: 'PATCH', headers: A.C, body: JSON.stringify({ status: 'contacted' }) })).status === 200, 'zlatar: Contacted');
ok(!!(await leadOf(A.C, cal.leadId)).firstReplyAt, 'Contacted = prvi odgovor');
await cron(); await sleep(1500);
ok(!(await mails()).some((m) => to(m, cal.email)), 'Cal ne dobija automatsku poruku');
ok((await fetch(`${BASE}/api/portal/leads/nonexistent1/events`, { method: 'POST', headers: A.C, body: JSON.stringify({ type: 'contact_copied', what: 'email' }) })).status === 404, 'tuđi/nepostojeći lead: 404');

// 6) Pad slanja: obavještenje se ponovi u sljedećem krugu; kupčeva poruka se ne ponavlja.
await fetch(`${MAIL}/__fail`, { method: 'POST' });
const dan = await lead(A.form, 'Dan Retry');
await sleep(3000);
ok(!(await leadOf(A.C, dan.leadId)).alertedAt, 'pao prvi mejl radnji: alertedAt prazan');
await cron(); await sleep(2000);
const danMails = (await mails()).filter((m) => to(m, 'owner@example.com') && m.reply_to === dan.email);
ok(danMails.length === 1 && !!(await leadOf(A.C, dan.leadId)).alertedAt, 'cron ponovio obavještenje, stiglo jednom');

// 7) Radnja bez adresa i bez autoSend: ništa ne ide; uključenje kasnije ne šalje starim leadovima.
const B = await shop(`Quiet Shop ${tag}`, { replyTo: 'quiet@example.com' });
ok(B.saved.autoSend === false && B.saved.autoSendSince === null && (B.saved.alertEmails || []).length === 0, 'bez obavještenja i bez automatske poruke');
const eve = await lead(B.form, 'Eve Quiet');
await sleep(2500);
await fetch(`${BASE}/api/leads/${eve.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: eve.token }) });
await cron(); await sleep(1500);
ok(!(await mails()).some((m) => to(m, eve.email) || m.reply_to === eve.email), 'tiha radnja: nijedan mejl');
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: B.V, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, replyTo: 'quiet@example.com', autoSend: true } }) });
await cron(); await sleep(1500);
ok(!(await mails()).some((m) => to(m, eve.email)), 'uključenje poslije leada: stari lead ne dobija poruku');

// 8) Bez reply adrese automatska poruka ne ide.
const Cn = await shop(`No Reply ${tag}`, { autoSend: true });
const fay = await lead(Cn.form, 'Fay Noreply');
await sleep(2500);
await cron(); await sleep(1500);
ok(!(await mails()).some((m) => to(m, fay.email)), 'bez reply adrese: kupac ne dobija poruku');

// 9) Statistika prvog odgovora u portalu (Ava i Dan automatski, Ben Copy, Cal Contacted).
const sp = (await fetch(`${BASE}/api/portal/me`, { headers: A.C }).then(j)).body.speed;
ok(sp.leads === 4 && sp.replied === 4 && sp.auto === 2 && sp.medianMin != null && sp.medianMin < 5, `prvi odgovor: ${sp.replied} od ${sp.leads}, automatski ${sp.auto}, medijana ${sp.medianMin} min`);

// 10) Stranica kupca: posjeta i klik se bilježe kao koraci (provjera u bazi poslije gašenja servera, vidi README).
const key = avaL.page.url.slice(3);
await fetch(`${BASE}/p/${key}`, { headers: { 'user-agent': 'Mozilla/5.0 test' } });
await fetch(`${BASE}/api/page/${key}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'deposit', option: 'picked' }) });
console.log(`LEADS ${ava.leadId} ${ben.leadId} ${cal.leadId} ${dan.leadId}`);
console.log(fails ? `\n${fails} FAIL` : '\nSve prošlo');
process.exit(fails ? 1 : 0);
