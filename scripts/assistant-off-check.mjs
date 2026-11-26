// Asistent na stranici kupca ISKLJUČEN glavnim prekidačem (PAGE_ASSISTANT=0, 26.11.2026): ni kad je u bazi sačuvano "page: true"
// nema widgeta, odgovora ni podešavanja, a asistent portala radi i ne pominje stranicu kupca.
//   BASE=http://127.0.0.1:8823 node scripts/assistant-off-check.mjs   (server sa PAGE_ASSISTANT=0 u .dev.vars)
import { readFileSync } from 'node:fs';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Assistant Off Jewelers' }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: C, body: JSON.stringify({ pricing: SUGGESTED_PRICING }) });
const fd = new FormData();
for (const [k, v] of Object.entries({ formId: form.id, name: 'Off Check', email: 'off@example.com', phone: '+1 (720) 555-0142', consent: 'yes' })) fd.set(k, v);
fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }));
const lead = (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
const L = (await fetch(`${BASE}/api/portal/leads`, { headers: C }).then(j)).body.leads.find((x) => x.id === lead.leadId);
const key = L.page.url.split('/p/')[1];

// Postavka u bazi nije dovoljna: upisujemo "page: true" direktno u klijentove podatke, kao da je ranije bila uključena.
const settings = (await fetch(`${BASE}/api/portal/assistant/settings`, { headers: C }).then(j)).body;
ok(settings.available === false, 'podešavanje javlja available: false');
ok((await fetch(`${BASE}/api/portal/assistant/settings`, { method: 'PUT', headers: C, body: JSON.stringify({ settings: { page: true } }) })).status === 403, 'zlatar ne može uključiti asistenta na stranici kupca');
ok((await fetch(`${BASE}/api/page/${key}/chat`).then(j)).body.on === false, 'GET chat: on false');
const post = await fetch(`${BASE}/api/page/${key}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'How much is it?' }) }).then(j);
ok(post.body.on === false && !post.body.reply, 'POST chat: nema odgovora, model se ne zove');
const html = await fetch(`${BASE}/p/${key}`).then((r) => r.text());
ok(!html.includes('pc-fab') && !html.includes('page-chat'), 'stranica kupca bez widgeta i bez skripte');
const lp = (await fetch(`${BASE}/api/portal/leads`, { headers: C }).then(j)).body.leads.find((x) => x.id === lead.leadId);
ok(!lp.chat, 'kartica leada bez razgovora');

// Asistent portala radi.
const pa = async (q) => (await fetch(`${BASE}/api/portal/assistant`, { method: 'POST', headers: C, body: JSON.stringify({ message: q }) }).then(j)).body;
const a1 = await pa('How many leads do I have in total?');
console.log(`\n  A: ${a1.reply}\n`);
ok(/\b1\b|one/i.test(a1.reply || ''), 'portal asistent radi i broji (1 lead)');
const a2 = await pa('How do I turn on the chat assistant on my customers\' pages?');
console.log(`\n  A: ${a2.reply}\n`);
ok(!/Assistant on customer pages/i.test(a2.reply || '') && !(a2.tags || []).includes('tab:bookings'), 'portal asistent ne vodi na nepostojeće podešavanje');

const off = (await fetch(`${BASE}/api/portal/chatbot/chats`, { headers: C }).then(j)).body;
ok(off.items.length === 0 && off.counts.all === 0, 'popis razgovora prazan dok je prekidač isključen');
ok((await fetch(`${BASE}/api/portal/chatbot/teach`, { method: 'POST', headers: C, body: JSON.stringify({ q: 'a', a: 'b' }) })).status === 403, 'Teach the bot nedostupan dok je prekidač isključen');
ok((await fetch(`${BASE}/api/portal/me`, { headers: C }).then(j)).body.pageAssistant === false, '/me: pageAssistant false (tab AI chatbot se ne vidi)');
ok((await fetch(`${BASE}/api/portal/chatbot/test`, { method: 'POST', headers: C, body: JSON.stringify({ message: 'hi' }) })).status === 403, 'probni chat nedostupan dok je prekidač isključen');
ok((await fetch(`${BASE}/api/portal/chatbot/test`, { headers: C }).then(j)).body.messages.length === 0, 'istorija probnog chata prazna dok je prekidač isključen');
console.log(fails ? `${fails} FAILED` : 'Assistant OFF checks passed.');
process.exit(fails ? 1 : 0);
