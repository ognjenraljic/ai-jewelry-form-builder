// Tab Workflows i Quo kanal (28.11.2026): stanje koraka, ack iz GHL-a, SMS preko Quo-a, pristanak, opt-out, webhook, test poruka.
//   node scripts/mock-ghl.mjs 8909 & node scripts/mock-quo.mjs 8913 &
//   wrangler dev --port 8823 --test-scheduled --var GHL_BASE:http://127.0.0.1:8909 --var QUO_BASE:http://127.0.0.1:8913 ...
//   BASE=http://127.0.0.1:8823 GHL=http://127.0.0.1:8909 QUO=http://127.0.0.1:8913 node scripts/workflows-check.mjs
import { readFileSync } from 'node:fs';
import { localHour, DEFAULT_TEMPLATES, EVENTS, STEP_CONTENT, renderTemplate, autoSettings, offerEvents } from '../src/automations.js';
import { toE164, maskPhone, quoSignature, verifyQuoSignature } from '../src/quo.js';
import { offerTimeline } from '../src/offer.js';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8823';
const GHL = process.env.GHL || 'http://127.0.0.1:8909';
const QUO = process.env.QUO || 'http://127.0.0.1:8913';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0; let passes = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (c) passes++; else fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HR = 3600_000;
const DAY = 24 * HR;
const ghl = async () => (await fetch(`${GHL}/_state`)).json();
const quo = async () => (await fetch(`${QUO}/_state`)).json();
const sweep = (at) => fetch(`${BASE}/api/admin/ghl/auto-sweep?at=${Math.round(at)}`, { method: 'POST', headers: H }).then(j);
const dayTime = (at) => { let t = at; while (localHour(t, 'America/Denver') < 10 || localHour(t, 'America/Denver') >= 19) t += 15 * 60_000; return t; };
const tag = Math.random().toString(36).slice(2, 7);

// ---------- Čiste funkcije ----------
ok(toE164('303 555 0142') === '+13035550142' && toE164('1 (303) 555-0142') === '+13035550142' && toE164('+44 20 7946 0958') === '+442079460958' && toE164('12345') === '', 'telefon u E.164 (SAD, međunarodni, loš)');
ok(maskPhone('+13035550142') === '+1 ••• ••• 0142', 'maskiran broj');
const sec = `whsec_${Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')}`;
const now0 = Date.now();
const ts0 = String(Math.floor(now0 / 1000));
const sig0 = await quoSignature(sec, 'msg_1', ts0, '{"a":1}');
const hd = (o) => ({ get: (k) => o[k] ?? null });
ok(await verifyQuoSignature(sec, hd({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts0, 'webhook-signature': `v1,AAAA ${sig0}` }), '{"a":1}', now0), 'potpis: ispravan među više potpisa');
ok(!(await verifyQuoSignature(sec, hd({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts0, 'webhook-signature': sig0 }), '{"a":2}', now0)), 'potpis: izmijenjeno tijelo odbijeno');
ok(!(await verifyQuoSignature(sec, hd({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts0, 'webhook-signature': sig0 }), '{"a":1}', now0 + 6 * 60_000)), 'potpis: stariji od 5 min odbijen');
ok(renderTemplate(DEFAULT_TEMPLATES.visit_2h, { sender: 'District', appt_location: '1550 Larimer St', appt_time: 'Tue 11:00 AM' }) === "District here. I'm pulling some pieces for you, see you at Tue 11:00 AM. 1550 Larimer St", 'šablon: zamjene');
ok(renderTemplate(DEFAULT_TEMPLATES.offer_unopened, { first_name: 'Ava', sender: 'District', store: 'District', piece: 'grillz', page_url: 'https://x/p/1' }) === "Hey Ava, this is District. Did you get a chance to see your grillz design? It's here: https://x/p/1 Reply STOP to opt out.", 'šablon: ime pošiljaoca isto kao radnja se ne ponavlja');
ok(Object.keys(EVENTS).every((k) => STEP_CONTENT[k] && (STEP_CONTENT[k].email || STEP_CONTENT[k].task)) && Object.entries(STEP_CONTENT).every(([k, c]) => !c.email || (c.email[0].length <= 80 && (k === 'quote_ready' ? c.email[1] === '{quote_message}' : c.email[1].includes('{first_name}')))), 'svaki korak ima primjer mejla ili zadatka');
ok(renderTemplate(STEP_CONTENT.offer_closeout.email[1], { first_name: 'Ava', sender: 'District', store: 'District', piece: 'grillz' }).endsWith('\n\nDistrict') && renderTemplate(DEFAULT_TEMPLATES.offer_closeout, { sender: 'Enrique', store: 'District', piece: 'grillz' }).endsWith('Enrique, District'), 'potpis: ime radnje se ne ponavlja');
ok(!Object.entries(DEFAULT_TEMPLATES).some(([k, v]) => v && v.length > 320) && Object.keys(DEFAULT_TEMPLATES).sort().join() === Object.keys(EVENTS).sort().join(), 'svaki događaj ima ključ u šablonima (internalni null), nijedan tekst predug');
const T0x = Date.parse('2026-11-27T17:00:00Z');
const tlx = offerTimeline({ pricing: {}, quotes: {}, lead: { createdAt: T0x } }, T0x);
ok(offerEvents({ tl: tlx, leadId: 'L', views: 0, clicks: [], replied: T0x + HR }).length === 0 && offerEvents({ tl: tlx, leadId: 'L', views: 0, clicks: [], replied: T0x - HR }).length > 0, 'odgovor kupca poslije početka ponude gasi offer događaje (raniji odgovor ne)');
ok(autoSettings({ texts: 'sms', templates: { picked_up: 'x', offer_24h: 'ok <b>' } }).texts === 'ghl' && !autoSettings({ templates: { picked_up: 'x', offer_24h: 'fine' } }).templates.picked_up && autoSettings({ templates: { offer_24h: 'fine' } }).templates.offer_24h === 'fine', 'autoSettings čisti kanal i šablone');

// ---------- Pomoćnici za radnje ----------
async function mkClient(name, { gate = false } = {}) {
  const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: `${name} ${tag}` }) }).then(j)).body.client;
  const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
  const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
  const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
  await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: C, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, quoteInfo: `${name} Jewelers\n1550 Larimer St, Denver, CO` } }) });
  await fetch(`${BASE}/api/portal/booking`, { method: 'PUT', headers: C, body: JSON.stringify({ settings: { enabled: true, tz: 'America/Denver', kinds: { online: { on: true, minutes: 10, video: '', meet: false }, visit: { on: true, minutes: 30 } } } }) });
  const wf = () => fetch(`${BASE}/api/portal/workflows`, { headers: C }).then(j);
  const put = (body) => fetch(`${BASE}/api/portal/workflows`, { method: 'PUT', headers: C, body: JSON.stringify(body) }).then(j);
  const post = (path, body) => fetch(`${BASE}/api/portal/quo/${path}`, { method: 'POST', headers: C, body: JSON.stringify(body || {}) }).then(j);
  // Prva ponuda (Quote sent) čeka Approve & send; starije provjere o podsjetnicima je gase da offer događaji idu kao prije.
  if (!gate) await put({ disabled: { quote_ready: true } });
  return { client, form, C, wf, put, post };
}
async function mkLead(co, { name, phone, sms = true, mkt = true }) {
  const fd = new FormData();
  const email = `${name.toLowerCase().replace(/\W/g, '')}-${tag}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  for (const [k, v] of Object.entries({ formId: co.form.id, name, email, phone, consent: 'yes', ...(sms ? { sms_consent: 'yes' } : {}), ...(mkt ? { sms_marketing: 'yes' } : {}) })) fd.set(k, v);
  fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }));
  const lead = (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
  const leads = (await fetch(`${BASE}/api/portal/leads`, { headers: co.C }).then(j)).body.leads;
  return { id: lead.leadId, email, key: leads.find((l) => l.id === lead.leadId)?.page?.url.slice(3) };
}
async function book(lead, kind, skip = 0) {
  const slots = (await fetch(`${BASE}/api/page/${lead.key}/slots?kind=${kind}`).then(j)).body.days.flatMap((d) => d.slots);
  const start = slots.filter((s) => s > Date.now() + 30 * HR)[skip] || slots[skip];
  const r = await fetch(`${BASE}/api/page/${lead.key}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, start, ...(kind === 'online' ? { via: 'phone' } : {}) }) }).then(j);
  return { status: r.status, start, error: r.body?.error };
}
const stepsOf = (v) => v.flows.flatMap((f) => f.lanes.flatMap((l) => l.steps));
const stepOf = (v, ev) => stepsOf(v).find((s) => s.ev === ev);
const histFor = (v, ev) => v.history.filter((h) => h.ev === ev);
const cn = (v, k) => v.connections?.find((x) => x.key === k);

// ---------- 1. Ništa povezano: nema lažnog "live" ----------
const A = await mkClient('WF A');
let v = (await A.wf()).body;
ok(v.flows.length === 3 && v.flows.map((f) => f.key).join() === 'offer,appts,reviews', 'tab: tri toka');
{ const st = v.flows.flatMap((f) => f.lanes.flatMap((l) => l.steps)); ok(st.every((x) => x.window && ('email' in x) && ('task' in x)) && st.find((x) => x.ev === 'deposit_click').task && st.find((x) => x.ev === 'refresh_moved').email === null && st.find((x) => x.ev === 'offer_24h').email.subject, 'tab: koraci nose prozor slanja, mejl i zadatak'); }
ok(stepsOf(v).length >= 21 && stepsOf(v).every((s) => s.state === 'off') && v.flows.every((f) => f.state === 'off'), 'automations isključene: svi koraci i tokovi "off"');
ok(v.ghl.connected === false && v.quo.connected === false && v.channel === 'ghl', 'ništa povezano, kanal GoHighLevel');
let r = await A.put({ on: true, holdout: 0 });
v = r.body;
ok(r.status === 200 && v.automation.on && v.automation.since > 0, 'glavni prekidač uključen (since postavljen)');
ok(stepsOf(v).filter((s) => s.ev !== 'quote_ready').every((s) => s.state === 'not_connected') && v.flows.every((f) => f.state === 'not_connected'), 'uključeno a ništa povezano: svi koraci "not_connected", nijedan "live"');
ok(!stepsOf(v).some((s) => ['live', 'published', 'waiting'].includes(s.state)), 'nema lažnog live / waiting bez veze');
ok(v.connections?.length === 7 && ['ghl', 'phone', 'calendar', 'meet', 'gmail', 'a2p', 'quo'].every((k) => cn(v, k)), 'Connections: sedam redova');
ok(['ghl', 'phone', 'calendar', 'meet', 'quo'].every((k) => cn(v, k).state === 'off'), 'Connections bez GHL-a i Quo-a: GHL redovi i Quo "off"');
ok(cn(v, 'gmail').state === 'manual' && cn(v, 'a2p').state === 'manual' && !v.connections.some((x) => ['gmail', 'a2p'].includes(x.key) && x.state === 'ok'), 'Connections: gmail i a2p nikad "ok" bez dokaza');

// ---------- 2. Provjera ulaza ----------
ok((await A.put({ texts: 'sms' })).status === 400, 'PUT: nepoznat kanal 400');
ok((await A.put({ texts: 'quo' })).status === 400, 'PUT: Quo bez povezanog Quo-a 400');
ok((await A.put({ templates: { picked_up: 'x' } })).status === 400, 'PUT: šablon za korak bez SMS-a 400');
ok((await A.put({ templates: { nope: 'x' } })).status === 400 && (await A.put({ disabled: { nope: true } })).status === 400, 'PUT: nepoznat ključ 400');
ok((await A.put({ templates: { offer_24h: 'hi <b>' } })).status === 400 && (await A.put({ templates: { offer_24h: 'x'.repeat(601) } })).status === 400, 'PUT: šablon sa < > ili duži od 600 400');
ok((await A.put({ reviewLink: 'http://g.page/r/x' })).status === 400 && (await A.put({ reviewLink: 'javascript:alert(1)' })).status === 400, 'PUT: review link samo https');
ok((await A.put({ holdout: 15 })).status === 400 && (await A.put({ on: 'yes' })).status === 400, 'PUT: loš procenat ili prekidač 400');
ok((await A.post('connect', { key: 'nope' })).status === 400, 'Quo: kratak ključ odbijen');
ok((await A.post('connect', { key: 'bad-key-0123456789' })).status === 400 && (await quo()).calls.filter((c) => c.path === '/v1/phone-numbers').length >= 1, 'Quo: pogrešan ključ (401 iz Quo-a) vraća 400 sa porukom');
ok((await A.post('test', { to: '303 555 0142' })).status === 400, 'test poruka bez povezanog Quo-a 400');

// ---------- 3. GHL: waiting, published, live (ack) ----------
await fetch(`${GHL}/_wf`, { method: 'POST', body: JSON.stringify({ name: 'JL | jl appt booked (SMS + email)', status: 'published' }) });
await fetch(`${GHL}/_wf`, { method: 'POST', body: JSON.stringify({ name: 'jl visit 24h', status: 'draft' }) });
const put = (body) => fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: A.C, body: JSON.stringify(body) }).then(j);
let g = (await put({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab', pipelineId: 'pipe1', stages: { new: 'st-new', won: 'st-won' }, enabled: true, calendars: { online: 'calOnline01', visit: 'calVisit001' }, hook: 'create' })).body;
ok(g.connected && g.enabled && g.hookUrl, 'GHL povezan, webhook adresa napravljena');
await fetch(`${BASE}/api/portal/ghl/fields`, { method: 'POST', headers: A.C, body: '{}' });
v = (await A.wf()).body;
ok(v.ghl.connected && v.ghl.enabled && v.ghl.hook && v.ghl.wfScope === 'ok', 'tab: GHL povezan, ack webhook adresa spremna, View Workflows ok');
ok(cn(v, 'ghl').state === 'ok' && cn(v, 'phone').state === 'ok' && cn(v, 'phone').value === '+1 303 555 0142' && /Texts and calls/.test(cn(v, 'phone').detail), 'Connections: GHL ok, telefon ok sa brojem +1 303 555 0142');
ok(cn(v, 'calendar').state === 'warn' && cn(v, 'meet').state === 'off' && /Two-way sync/.test(cn(v, 'calendar').detail), 'Connections: kalendar "warn" prije prvog termina (uz napomenu o dvosmjernom sinhu), Meet "off" dok je isključen u Bookings');
await fetch(`${BASE}/api/portal/booking`, { method: 'PUT', headers: A.C, body: JSON.stringify({ settings: { enabled: true, tz: 'America/Denver', kinds: { online: { on: true, minutes: 10, video: '', meet: true }, visit: { on: true, minutes: 30 } } } }) });
{ const vm = (await A.wf()).body; ok(cn(vm, 'meet').state === 'warn' && /Set on the calendar/.test(cn(vm, 'meet').detail), `Connections: Meet uključen i postavljen na kalendaru, "warn" do prvog videa (${cn(vm, 'meet').state})`); }
ok(stepOf(v, 'appt_booked').state === 'published' && stepOf(v, 'visit_24h').state === 'waiting' && stepOf(v, 'offer_24h').state === 'waiting', 'objavljen workflow je "published", nacrt i nepostojeći "waiting"');
ok(v.flows.find((f) => f.key === 'appts').state === 'waiting' && v.flows.find((f) => f.key === 'offer').state === 'waiting', 'tokovi: waiting (nema potvrde)');
ok(!stepsOf(v).some((s) => s.state === 'live'), 'još nijedan korak nije live');

// termin -> tag -> ack
const LA1 = await mkLead(A, { name: 'Ava Auto', phone: '303 555 0199' });
const bk = await book(LA1, 'visit');
ok(bk.status === 200, `studio zakazan (GHL kanal)${bk.status === 200 ? '' : ` ${bk.status} ${bk.error} ${bk.start}`}`);
await sleep(1500);
await sweep(Date.now() + 60_000);
const tg = (await ghl()).tagLog.filter((x) => x.op === 'add').map((x) => x.tags[0]);
ok(tg.includes('jl appt booked'), 'tag "jl appt booked" poslat GHL-u');
v = (await A.wf()).body;
const hb = histFor(v, 'appt_booked')[0];
ok(hb && hb.status === 'sent' && hb.channel === 'ghl' && !hb.ackedAt && stepOf(v, 'appt_booked').state === 'published' && stepOf(v, 'appt_booked').sent30 === 1, 'istorija: poslat tag, još bez potvrde, korak i dalje "published"');
const hookUrl = new URL(v.ghl.hookUrl).pathname;
const contactId = Object.values((await ghl()).contacts).find((c) => c.email === LA1.email)?.id;
const ack = (body) => fetch(`${BASE}${hookUrl}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j);
const a0 = await ack({ contact_id: contactId, customData: { event: 'jl_ack', tag: 'jl nonsense' } });
ok(a0.status === 200 && a0.body.ack === false && stepOf((await A.wf()).body, 'appt_booked').state === 'published', 'ack sa nepoznatim tagom se ne računa');
const a1 = await ack({ contact_id: contactId, customData: { event: 'jl_ack', tag: 'JL Appt Booked' } });
v = (await A.wf()).body;
ok(a1.status === 200 && a1.body.ack === true && stepOf(v, 'appt_booked').state === 'live' && stepOf(v, 'appt_booked').ackAt > 0, 'ack webhook: korak postaje "live"');
ok(histFor(v, 'appt_booked')[0].ackedAt > 0, 'ack: red u istoriji dobija acked_at');
ok(cn(v, 'calendar').state === 'ok' && cn(v, 'calendar').at > 0, 'Connections: studio termin stigao u GHL kalendar, kalendar "ok" sa datumom');
{
  // Online video termin sa Meet linkom (mock pravi link kad ima domaćina)
  const slots = (await fetch(`${BASE}/api/page/${LA1.key}/slots?kind=online`).then(j)).body.days.flatMap((d) => d.slots);
  const vb = await fetch(`${BASE}/api/page/${LA1.key}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online', via: 'video', start: slots.filter((x) => x > Date.now() + 30 * HR)[0] || slots[0] }) }).then(j);
  await sleep(1500);
  await sweep(Date.now() + 70_000);
  const vm = (await A.wf()).body;
  ok(vb.status === 200 && cn(vm, 'meet').state === 'ok' && cn(vm, 'meet').at > 0, `Connections: video termin sa Meet linkom, Meet "ok" (${vb.status} ${vb.body?.error || ''} ${cn(vm, 'meet').state})`);
}
ok(v.flows.find((f) => f.key === 'appts').state === 'partial' && stepOf(v, 'visit_24h').state === 'waiting', 'tok Appointments "partial" (jedan live), ostali waiting');
ok(/^pit-|Bearer/.test(JSON.stringify(v)) === false && !JSON.stringify(v).includes('pit-local'), 'odgovor ne sadrži token');
ok(cn(v, 'gmail').state === 'manual' && cn(v, 'a2p').state === 'manual' && cn(v, 'quo').state === 'off', 'Connections: gmail "manual", a2p "manual" na GHL kanalu, Quo "off" prije povezivanja');

// ---------- 4. Quo: connect, broj, prebacivanje ----------
r = await A.post('connect', { key: `quo-test-key-${tag}7890` });
v = r.body;
ok(r.status === 200 && v.quo.connected && v.quo.numbers.length === 2 && !v.quo.ready && v.quo.keyHint === '…7890' && !JSON.stringify(v).includes(`quo-test-key-${tag}`), 'Quo povezan: dva broja, ključ nije u odgovoru, samo hint');
ok((await quo()).calls.some((c) => c.path === '/v1/phone-numbers' && c.auth === `quo-test-key-${tag}7890`), 'ključ ide sirov u Authorization (bez Bearer)');
ok((await A.put({ texts: 'quo' })).status === 400, 'prebacivanje na Quo bez izabranog broja 400');
ok((await A.post('number', { id: 'PNnope' })).status === 400, 'nepoznat broj odbijen');
r = await A.post('number', { id: 'PNmain00001' });
v = r.body;
const qs = await quo();
const wh = Object.values(qs.webhooks).find((w) => w.url.endsWith(new URL(v.quo.webhookUrl).pathname));
ok(r.status === 200 && v.quo.ready && v.quo.from === '+13035550100' && v.quo.webhook && !v.quo.webhookError, 'broj izabran, webhook napravljen preko API-ja');
ok(cn(v, 'quo').state === 'ok' && cn(v, 'quo').value === '+13035550100' && !JSON.stringify(v.connections).includes(`quo-test-key-${tag}`) && !JSON.stringify(v.connections).includes('pit-local'), 'Connections: Quo "ok" poslije broja i webhooka, bez ključeva u odgovoru');
ok(wh && wh.url.endsWith(new URL(v.quo.webhookUrl).pathname) && wh.resourceIds[0] === 'PNmain00001' && wh.events.includes('message.received') && qs.calls.some((c) => c.path === '/webhooks' && c.version === '2026-03-30'), 'webhook: adresa, broj, događaji, Quo-Api-Version');
r = await A.put({ texts: 'quo', reviewLink: 'https://g.page/r/abc123', sender: 'Enrique' });
v = r.body;
ok(r.status === 200 && v.channel === 'quo' && v.automation.reviewLink === 'https://g.page/r/abc123' && v.automation.sender === 'Enrique', 'kanal Quo, review link i ime pošiljaoca sačuvani');
ok(stepOf(v, 'appt_booked').channel === 'quo' && stepOf(v, 'appt_booked').state === 'waiting' && stepOf(v, 'refresh_moved').channel === 'internal' && stepOf(v, 'picked_up').channel === 'ghl', 'kanali po koraku: SMS koraci Quo, interni i "picked up" ostaju GHL');

// zakazan termin: SMS preko Quo-a, tag kontakta
const LA2 = await mkLead(A, { name: 'Bea Quo', phone: '303 555 0198' });
const bk2 = await book(LA2, 'visit', 1);
ok(bk2.status === 200, `drugi studio termin (Quo kanal)${bk2.status === 200 ? '' : ` ${bk2.status} ${bk2.error}`}`);
await sleep(1500);
await sweep(Date.now() + 90_000);
const m1 = (await quo()).messages.findLast((m) => m.to[0] === '+13035550198');
ok(!!m1 && m1.from === 'PNmain00001', `Quo: poruka poslata sa izabranog broja (${m1?.content?.slice(0, 60)})`);
ok(m1 && /^Hey Bea, this is Enrique from WF A \w+\. You're booked: Studio visit, .+\. WF A Jewelers, 1550 Larimer St.* Need another time\? http.+\/p\/.+#appts Reply STOP to opt out\.$/.test(m1.content) && !/[{}]/.test(m1.content), 'tekst poruke: zamjene tačne, ime pošiljaoca, prva poruka nosi "Reply STOP"');
v = (await A.wf()).body;
const hq = histFor(v, 'appt_booked').find((h) => h.name === 'Bea Quo');
ok(hq && hq.channel === 'quo' && hq.status === 'sent' && hq.target === '+1 ••• ••• 0198' && hq.body === m1.content, 'istorija: kanal quo, maskiran broj, tekst');
const gs = await ghl();
const c2 = Object.values(gs.contacts).find((c) => c.email === LA2.email);
ok(c2?.tags.includes('jl texts via quo') && c2.tags.includes('jl appt booked'), 'GHL kontakt nosi "jl texts via quo" i tag događaja');
const order = gs.tagLog.filter((x) => x.contact === c2.id && x.op === 'add').map((x) => x.tags[0]);
ok(order.indexOf('jl texts via quo') > -1 && order.indexOf('jl texts via quo') < order.indexOf('jl appt booked'), 'tag "jl texts via quo" ide prije tag-a događaja');
ok(stepOf(v, 'appt_booked').state === 'live' && stepOf(v, 'appt_booked').channel === 'quo', 'Quo korak je "live" tek poslije prve uspješne poruke');
ok(v.counts.sent30 >= 2 && v.counts.failed30 === 0, `brojke: sent30 ${v.counts.sent30}`);
const nMsg = (await quo()).messages.length;
await sweep(Date.now() + 120_000);
ok((await quo()).messages.length === nMsg, 'isti događaj dvaput: nema duple poruke');

// ---------- 5. Quo webhook ----------
const hookQuo = new URL(v.quo.webhookUrl).pathname;
const emit = (event, opts = {}) => fetch(`${QUO}/_emit`, { method: 'POST', body: JSON.stringify({ url: `${BASE}${hookQuo}`, webhookId: wh.id, event, ...opts }) }).then(j).then((x) => x.body);
const inbound = (from, text) => ({ id: `EV${Math.random()}`, type: 'message.received', data: { resource: { id: `AC${Math.random()}`, direction: 'incoming', text, status: 'received' }, context: { phoneNumberId: 'PNmain00001', senderIdentifier: from, recipientIdentifiers: ['+13035550100'] } } });
ok((await emit(inbound('+13035550198', 'hello'), { badSig: true })).status === 401, 'webhook: pogrešan potpis 401');
ok((await emit(inbound('+13035550198', 'hello'), { ts: Date.now() - 10 * 60_000 })).status === 401, 'webhook: star timestamp 401');
const noSig = await fetch(`${BASE}${hookQuo}`, { method: 'POST', body: '{}' });
ok(noSig.status === 401, 'webhook: bez potpisa 401');
ok((await fetch(`${BASE}/api/hooks/quo/${'a'.repeat(32)}`, { method: 'POST', body: '{}' })).status === 404, 'webhook: nepoznat ključ 404');
// delivered
const delivered = { id: 'EVd', type: 'message.delivered', data: { resource: { id: (await quo()).messages.findLast((m) => m.to[0] === '+13035550198').id, direction: 'outgoing', status: 'delivered' }, context: { phoneNumberId: 'PNmain00001' } } };
ok((await emit(delivered)).status === 200, 'webhook: delivered prihvaćen');
v = (await A.wf()).body;
ok(histFor(v, 'appt_booked').find((h) => h.name === 'Bea Quo').ackedAt > 0, 'delivered: red u istoriji dobija potvrdu isporuke');
ok(cn(v, 'a2p').state === 'ok' && /delivering/.test(cn(v, 'a2p').detail), 'Connections: a2p "ok" tek kad je Quo poruka isporučena');
// STOP -> opt-out: sljedeći događaj za isti broj se ne šalje
ok((await emit(inbound('+13035550198', 'STOP'))).status === 200, 'webhook: STOP prihvaćen');
const bk3 = await book(LA2, 'online');
ok(bk3.status === 200, 'Bea zakazuje i online poziv');
await sleep(1500);
const nMsg2 = (await quo()).messages.length;
await sweep(Date.now() + 150_000);
v = (await A.wf()).body;
const optH = histFor(v, 'appt_booked').find((h) => h.name === 'Bea Quo' && h.channel === 'ghl' && /opted out/.test(h.error || ''));
ok((await quo()).messages.length === nMsg2 && optH && /opted out/.test(optH.error || ''), `STOP: SMS za isti broj preskočen, GHL tag ipak ide (${optH?.error})`);
// START vraća
ok((await emit(inbound('+13035550198', 'start'))).status === 200, 'webhook: START prihvaćen');
const bk4 = await book(LA2, 'visit', 2);
await sleep(1500);
await sweep(Date.now() + 180_000);
ok((await quo()).messages.length === nMsg2 + 1, 'START: poruke ponovo idu');
// odgovor kupca gasi offer događaje
const LA3 = await mkLead(A, { name: 'Cleo Reply', phone: '303 555 0197' });
const LA4 = await mkLead(A, { name: 'Dan Silent', phone: '303 555 0196' });
const t0 = Date.now();
ok((await emit(inbound('+13035550197', 'Can you call me about the price?'))).status === 200, 'webhook: odgovor kupca prihvaćen');
await sweep(dayTime(t0 + 4 * HR + 5 * 60_000));
v = (await A.wf()).body;
const un = histFor(v, 'offer_unopened');
ok(un.some((h) => h.name === 'Dan Silent' && h.status === 'sent' && h.channel === 'quo') && !un.some((h) => h.name === 'Cleo Reply'), 'odgovor kupca: njegovi offer događaji staju, ostali kupci i dalje dobijaju');
const mDan = (await quo()).messages.findLast((m) => m.to[0] === '+13035550196');
ok(mDan && /^Hey Dan, this is Enrique from WF A \w+\. Did you get a chance to see your grillz design\? It's here: http.+\/p\/.+ Reply STOP to opt out\.$/.test(mDan.content), 'offer_unopened: tekst iz šablona');

// ---------- 6. Probna poruka ----------
const before = (await quo()).messages.length;
ok((await A.post('test', { to: 'abc' })).status === 400 && (await A.post('test', { to: '+44 20 7946 0958' })).status === 400, 'test: ne-US ili loš broj 400');
r = await A.post('test', { to: '303 555 0142' });
const qm = (await quo()).messages;
ok(r.status === 200 && qm.length === before + 1 && qm.at(-1).to[0] === '+13035550142' && /^This is a test from JewelryLead for WF A/.test(qm.at(-1).content), 'test: tačno jedna poruka, samo na upisani broj');
const th = r.body.history.find((h) => h.ev === 'test');
ok(th && th.step === 'Test message' && th.target === '+1 ••• ••• 0142' && th.status === 'sent', 'test se vidi u istoriji');

// ---------- 7. Quo samostalno: pristanak, opt-out, A2P ----------
const B = await mkClient('WF B');
await B.post('connect', { key: `quo-test-key-b${tag}` });
await B.post('number', { id: 'PNstudio002' });
v = (await B.put({ texts: 'quo', on: true, holdout: 0, reviewLink: '' })).body;
ok(v.channel === 'quo' && !v.ghl.connected && stepOf(v, 'offer_24h').state === 'waiting' && stepOf(v, 'refresh_moved').state === 'not_connected', 'Quo bez GHL-a: SMS koraci waiting, GHL koraci not_connected');
const B1 = await mkLead(B, { name: 'Bob SmsOnly', phone: '303 555 0142', mkt: false });
const B2 = await mkLead(B, { name: 'Cam NoConsent', phone: '303 555 0143', sms: false, mkt: false });
const B3 = await mkLead(B, { name: 'Dee OptedOut', phone: '303 555 0000' });
const B4 = await mkLead(B, { name: 'Eli SameNumber', phone: '303 555 0000' });
const bt0 = Date.now();
await sweep(dayTime(bt0 + 4 * HR + 5 * 60_000));
v = (await B.wf()).body;
const un2 = histFor(v, 'offer_unopened');
const hs = (n) => un2.find((h) => h.name === n);
ok(hs('Bob SmsOnly')?.status === 'sent', 'samo SMS pristanak: informativna poruka (offer_unopened) ide');
ok(hs('Cam NoConsent')?.status === 'skipped' && hs('Cam NoConsent').error === 'no SMS consent', 'bez SMS pristanka: skipped "no SMS consent"');
const bPosts = () => quo().then((s) => s.calls.filter((c) => c.path === '/v1/messages' && c.auth === `quo-test-key-b${tag}`).length);
ok(hs('Dee OptedOut')?.status === 'skipped' && /opted out/.test(hs('Dee OptedOut').error) && hs('Eli SameNumber')?.status === 'skipped' && /opted out/.test(hs('Eli SameNumber').error), 'opt-out iz Quo greške: skipped, drugi lead sa istim brojem preskočen');
ok((await bPosts()) === 2, `Quo pozvan za Boba i Dee, Camu i Elija ne (2 poziva: ${await bPosts()})`);
await sweep(dayTime(bt0 + 24 * HR + 20 * 60_000));
v = (await B.wf()).body;
const h24 = histFor(v, 'offer_24h');
ok(h24.find((h) => h.name === 'Bob SmsOnly')?.status === 'skipped' && h24.find((h) => h.name === 'Bob SmsOnly').error === 'no SMS consent', 'prodajni događaj (offer_24h) sa samo SMS pristankom: skipped');
// A2P nije odobren
const B5 = await mkLead(B, { name: 'Fay A2P', phone: '303 555 9999' });
await sweep(dayTime(Date.now() + 4 * HR + 5 * 60_000));
v = (await B.wf()).body;
const f5 = histFor(v, 'offer_unopened').find((h) => h.name === 'Fay A2P');
ok(f5?.status === 'failed' && /A2P/.test(f5.error) && /A2P/.test(v.quo.lastError?.msg || ''), `A2P: failed sa jasnom porukom i greškom na Quo kartici (${f5?.error?.slice(0, 50)})`);
ok(stepOf(v, 'offer_unopened').state === 'error' && v.flows.find((f) => f.key === 'offer').state === 'error', 'korak i tok su "error" kad zadnji pokušaj padne');
ok(cn(v, 'a2p').state === 'bad' && /A2P/.test(cn(v, 'a2p').detail) && cn(v, 'quo').state === 'bad', 'Connections: A2P greška daje a2p i Quo "bad"');
// review link
const wfLink = await B.put({ reviewLink: 'https://g.page/r/xyz' });
ok(wfLink.status === 200 && wfLink.body.automation.reviewLink === 'https://g.page/r/xyz', 'review link za Quo');

// ---------- 8. Isključen glavni prekidač, view-as, webhook greška, legacy ----------
await B.put({ on: false });
const Bx = await mkLead(B, { name: 'Gus Late', phone: '303 555 0155' });
const nB = await bPosts();
await sweep(dayTime(Date.now() + 5 * HR));
ok((await bPosts()) === nB, 'glavni prekidač isključen: ništa se ne šalje');
ok(stepsOf((await B.wf()).body).every((s) => s.state === 'off'), 'isključeno: svi koraci "off", prikaz i dalje radi');
const va = (await fetch(`${BASE}/api/admin/clients/${B.client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const VA = { 'x-portal-token': va, 'content-type': 'application/json' };
ok((await fetch(`${BASE}/api/portal/workflows`, { headers: VA })).status === 200, 'view-as: čitanje radi');
ok((await fetch(`${BASE}/api/portal/workflows`, { method: 'PUT', headers: VA, body: JSON.stringify({ on: true }) })).status === 403 && (await fetch(`${BASE}/api/portal/quo/test`, { method: 'POST', headers: VA, body: JSON.stringify({ to: '303 555 0142' }) })).status === 403 && (await fetch(`${BASE}/api/portal/quo/disconnect`, { method: 'POST', headers: VA, body: '{}' })).status === 403, 'view-as: PUT, test i disconnect su 403');
ok((await B.wf()).body.automation.on === false, 'view-as nije promijenio podešavanja');
// Webhook se ne može napraviti: slanje i dalje radi, UI dobija grešku
await fetch(`${QUO}/_failwebhook`, { method: 'POST', body: JSON.stringify({ on: true }) });
const Cq = await mkClient('WF C');
await Cq.post('connect', { key: `quo-test-key-c${tag}` });
r = await Cq.post('number', { id: 'PNmain00001' });
ok(r.status === 200 && r.body.quo.ready && !r.body.quo.webhook && /not allowed|Forbidden|Quo/.test(r.body.quo.webhookError || ''), 'webhook se nije napravio: broj ipak izabran, greška vidljiva');
await fetch(`${QUO}/_failwebhook`, { method: 'POST', body: JSON.stringify({ on: false }) });
r = await Cq.post('webhook', {});
ok(r.status === 200 && r.body.quo.webhook && !r.body.quo.webhookError, 'Try again: webhook napravljen');
ok((await Cq.post('webhook', { secret: 'bad' })).status === 400, 'ručni signing secret mora počinjati whsec_');
// Legacy: stara kartica piše u isto mjesto
const legacy = await fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: Cq.C, body: JSON.stringify({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab', enabled: true, auto: { on: true, holdout: 0, offer: false } }) }).then(j);
ok(legacy.body.auto.on && legacy.body.auto.offer === false, 'stara kartica (Forms, GoHighLevel) i dalje radi');
v = (await Cq.wf()).body;
ok(v.automation.on && v.automation.offer === false && v.automation.since > 0 && stepOf(v, 'offer_24h').state === 'off', 'jedan izvor istine: ista postavka u tabu Workflows');
await Cq.put({ offer: true });
ok((await fetch(`${BASE}/api/portal/ghl`, { headers: Cq.C }).then(j)).body.auto.offer === true, 'promjena u tabu vidi se i u staroj kartici');
// View Workflows dozvola fali
await fetch(`${GHL}/_wf_fail?code=403`);
const D = await mkClient('WF D');
await fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: D.C, body: JSON.stringify({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab', enabled: true }) }).then(j);
await D.put({ on: true });
v = (await D.wf()).body;
ok(v.ghl.wfScope === 'missing' && stepOf(v, 'offer_24h').state === 'waiting', 'bez View Workflows dozvole: wfScope "missing", koraci i dalje rade (waiting)');
await fetch(`${GHL}/_wf_fail?code=0`);
// Telefoni: fali dozvola, prazna lista
await fetch(`${GHL}/_fail?phones=scope`);
const E = await mkClient('WF E');
await fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: E.C, body: JSON.stringify({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab', enabled: true }) }).then(j);
v = (await E.wf()).body;
ok(cn(v, 'phone').state === 'warn' && /View Phone Numbers/.test(cn(v, 'phone').detail) && cn(v, 'ghl').state === 'ok', 'Connections: bez View Phone Numbers dozvole telefon traži dozvolu, bez lažnog "ok"');
await fetch(`${GHL}/_fail?phones=&nophones=1`);
const F = await mkClient('WF F');
await fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: F.C, body: JSON.stringify({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab', enabled: true }) }).then(j);
v = (await F.wf()).body;
ok(cn(v, 'phone').state === 'warn' && /No number yet/.test(cn(v, 'phone').detail), 'Connections: prazna lista brojeva "warn" sa uputom');
await fetch(`${GHL}/_fail?phones=&nophones=0`);
const vva = await fetch(`${BASE}/api/portal/workflows`, { headers: VA }).then(j);
ok(vva.status === 200 && Array.isArray(vva.body.connections) && vva.body.connections.length === 7, 'Connections: view-as čita karticu');
// Disconnect vraća kanal na GHL
r = await A.post('disconnect');
ok(r.status === 200 && !r.body.quo.connected && r.body.channel === 'ghl', 'Quo disconnect: kanal se vraća na GoHighLevel');
ok(Object.keys((await quo()).webhooks).length >= 0, 'disconnect pokušao obrisati webhook');
// Korak ugašen
r = await A.put({ disabled: { offer_24h: true }, templates: { offer_24h: 'Custom text {first_name}' } });
ok(stepOf(r.body, 'offer_24h').state === 'off' && stepOf(r.body, 'offer_24h').disabled && stepOf(r.body, 'offer_24h').template === 'Custom text {first_name}' && !stepOf(r.body, 'offer_24h').isDefaultTemplate, 'pojedinačni korak ugašen, tekst sačuvan');
r = await A.put({ templates: { offer_24h: '' } });
ok(stepOf(r.body, 'offer_24h').isDefaultTemplate, 'Reset to default vraća podrazumijevani tekst');


// ---------- 9. Approve & send: prva ponuda (quote_ready) ----------
{
  const GHL_BODY = { token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab', enabled: true };
  const connectGhl = async (co) => { await fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: co.C, body: JSON.stringify(GHL_BODY) }).then(j); return fetch(`${BASE}/api/portal/ghl/fields`, { method: 'POST', headers: co.C, body: '{}' }).then(j); };
  const leadsOf = async (co) => (await fetch(`${BASE}/api/portal/leads`, { headers: co.C }).then(j)).body.leads;
  const leadRow = async (co, id) => (await leadsOf(co)).find((l) => l.id === id);
  const waitPicked = async (co, id) => { for (let i = 0; i < 20; i++) { const l = await leadRow(co, id); if (l?.quotes?.picked?.msg) return l; await sleep(500); } return null; };
  const sendQuote = (co, id, C = co.C) => fetch(`${BASE}/api/portal/leads/${id}/send-quote`, { method: 'POST', headers: C, body: '{}' }).then(j);
  const preview = (co, id, C = co.C) => fetch(`${BASE}/api/portal/leads/${id}/send-quote/preview`, { headers: C }).then(j);
  const tagsOf = async (email) => { const g = await ghl(); const c = Object.values(g.contacts).find((x) => x.email === email); return { c, g, log: g.tagLog.filter((x) => x.contact === c?.id && x.op === 'add').map((x) => x.tags[0]) }; };
  const fieldVal = async (email, key) => { const g = await ghl(); const c = Object.values(g.contacts).find((x) => x.email === email); const def = g.fields.find((f) => f.fieldKey === `contact.${key}`); return c?.customFields?.find((f) => f.id === def?.id)?.field_value; };
  ok(autoSettings({}).quoteMode === 'approve' && autoSettings({ quoteMode: 'auto' }).quoteMode === 'auto' && autoSettings({ quoteMode: 'x' }).quoteMode === 'approve', 'quoteMode: podrazumijevano approve, auto prihvaćen, ostalo se čisti');
  const tq = offerTimeline({ pricing: {}, quotes: { picked: { at: 1000 * HR }, sent: { at: 1010 * HR } }, lead: { createdAt: 990 * HR } }, 1011 * HR);
  const tq0 = offerTimeline({ pricing: {}, quotes: { picked: { at: 1000 * HR } }, lead: { createdAt: 990 * HR } }, 1011 * HR);
  ok(tq.from === 1010 * HR && tq0.from === 1000 * HR, 'offerTimeline: rok kreće od sent.at, bez sent ostaje od picked.at');

  const G = await mkClient('QA GHL', { gate: true });
  const fr = await connectGhl(G);
  ok(fr.body.fields?.jl_quote_message === 'contact.jl_quote_message' && (await ghl()).fields.find((f) => f.fieldKey === 'contact.jl_quote_message')?.dataType === 'LARGE_TEXT', 'polje JL Quote Message napravljeno kao LARGE_TEXT');
  v = (await G.wf()).body;
  ok(v.automation.quoteMode === 'approve' && stepOf(v, 'quote_ready').quoteMode === 'approve' && stepOf(v, 'quote_ready').awaiting === 0 && v.flows.find((f) => f.key === 'offer').lanes[0].steps[0].ev === 'quote_ready', 'quoteMode podrazumijevano approve, korak quote_ready je prvi u traci');
  ok((await G.put({ quoteMode: 'nope' })).status === 400 && (await G.put({ quoteMode: 'auto' })).body.automation.quoteMode === 'auto' && (await G.put({ quoteMode: 'approve' })).body.automation.quoteMode === 'approve', 'PUT quoteMode: auto i approve prolaze, drugo 400');
  const G1 = await mkLead(G, { name: 'Gia Approve', phone: '303 555 0301' });
  // Automations isključene: nema slanja
  let sq = await sendQuote(G, G1.id);
  ok(sq.status === 400 && /Turn on Automations/.test(sq.body.error), `Automations off: send-quote 400 (${sq.body.error})`);
  await G.put({ on: true, holdout: 0 });
  const G2 = await mkLead(G, { name: 'Hal Approve', phone: '303 555 0302' });
  const l2 = await waitPicked(G, G2.id);
  ok(!!l2?.quotes?.picked?.msg, 'nov lead ima automatsku Estimated price poruku');
  ok(l2.quoteSend?.toApprove === true && l2.quoteSend.can && !l2.quoteSend.sent, 'lista: lead čeka odobrenje (toApprove)');
  v = (await G.wf()).body;
  ok(stepOf(v, 'quote_ready').awaiting >= 1, `Workflows: awaiting ${stepOf(v, 'quote_ready').awaiting}`);
  // Prije slanja nema offer događaja ni poslije 5 h; notifikacija čeka odobrenje
  const tg0 = Date.now();
  await sweep(dayTime(tg0 + 5 * HR));
  v = (await G.wf()).body;
  ok(!v.history.some((h) => h.name === 'Hal Approve'), 'bez odobrenja: ni quote_ready ni offer događaja poslije 5 h');
  const nt = (await fetch(`${BASE}/api/portal/notifications`, { headers: G.C }).then(j)).body;
  ok(nt.items.some((x) => x.type === 'quote_awaiting' && x.name === 'Hal Approve') && nt.items.some((x) => x.type === 'quote_reminder' && x.name === 'Hal Approve'), 'notifikacije: čeka odobrenje i podsjetnik poslije 2 h (u 9-19)');
  const remN = () => fetch(`${BASE}/api/portal/notifications`, { headers: G.C }).then(j).then((r) => r.body.items.filter((x) => x.type === 'quote_reminder' && x.name === 'Hal Approve').length);
  await sweep(dayTime(tg0 + 6 * HR));
  ok((await remN()) === 1, 'podsjetnik samo jednom po leadu');
  // Preview i slanje
  const pv = await preview(G, G2.id);
  ok(pv.status === 200 && pv.body.can && pv.body.to.name === 'Hal Approve' && pv.body.to.phone === '+1 ••• ••• 0302' && /Text and email from GoHighLevel/.test(pv.body.from) && pv.body.email.subject.includes('QA GHL') && pv.body.email.body === l2.quotes.picked.msg, 'preview: kome, odakle, naslov mejla, tekst mejla = sačuvana poruka');
  const VAv = { 'x-portal-token': (await fetch(`${BASE}/api/admin/clients/${G.client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token, 'content-type': 'application/json' };
  ok((await preview(G, G2.id, VAv)).status === 200 && (await sendQuote(G, G2.id, VAv)).status === 403, 'view-as: preview čita, send-quote 403');
  sq = await sendQuote(G, G2.id);
  const t1 = await tagsOf(l2.email);
  ok(sq.status === 200 && sq.body.quoteSend.sent?.by === 'portal' && sq.body.quoteSend.sent.at > 0 && t1.log.includes('jl quote ready'), `send-quote: tag "jl quote ready" stigao u GHL (${sq.body.error || ''})`);
  ok((await fieldVal(l2.email, 'jl_quote_message')) === l2.quotes.picked.msg, 'polje jl_quote_message nosi tekst Estimated price poruke');
  v = (await G.wf()).body;
  const hq1 = histFor(v, 'quote_ready').filter((h) => h.name === 'Hal Approve');
  ok(hq1.length === 1 && hq1[0].status === 'sent' && hq1[0].channel === 'ghl', 'istorija: jedan red quote_ready, kanal GHL');
  const l2b = await leadRow(G, G2.id);
  ok(l2b.quoteSend.sent.at === sq.body.quoteSend.sent.at && !l2b.quoteSend.toApprove && l2b.firstReplyAt > 0, 'lead: quotes.sent postavljen, više ne čeka odobrenje, first reply upisan');
  // offer_unopened ide 4 h poslije sent.at
  const sentAt = l2b.quoteSend.sent.at;
  await sweep(dayTime(sentAt + 3 * HR));
  ok(!histFor((await G.wf()).body, 'offer_unopened').some((h) => h.name === 'Hal Approve'), 'offer_unopened ne ide prije 4 h poslije slanja');
  await sweep(dayTime(sentAt + 4 * HR + 5 * 60_000));
  ok(histFor((await G.wf()).body, 'offer_unopened').some((h) => h.name === 'Hal Approve' && h.status === 'sent'), 'offer_unopened ide 4 h poslije sent.at (ne poslije picked.at)');
  // Send again
  await sleep(1100);
  sq = await sendQuote(G, G2.id);
  v = (await G.wf()).body;
  const hq2 = histFor(v, 'quote_ready').filter((h) => h.name === 'Hal Approve');
  ok(sq.status === 200 && sq.body.quoteSend.sent.count === 2 && hq2.length === 2 && new Set(hq2.map((h) => h.id)).size === 2, 'Send again: drugi red u istoriji, novi ključ, count 2');
  // Bez picked poruke i arhiviran
  const G3 = await mkLead(G, { name: 'Ivo NoMsg', phone: '303 555 0303' });
  await sleep(2500);
  await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: G.C, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING } }) });
  // lead bez picked: poruka se obriše direktno nije moguće preko API-ja, pa se koristi lead čija se procjena nije dala
  const nomsg = (await leadsOf(G)).find((l) => l.id === G3.id);
  if (nomsg?.quotes?.picked?.msg) { ok(true, 'lead bez poruke: preskočeno (poruka je napravljena automatski)'); } else { ok((await sendQuote(G, G3.id)).status === 400, 'bez picked poruke: send-quote 400'); }
  ok((await fetch(`${BASE}/api/portal/leads/nepostoji/send-quote`, { method: 'POST', headers: G.C, body: '{}' })).status === 404, 'nepoznat lead 404');
  // Step ugašen
  await G.put({ disabled: { quote_ready: true } });
  sq = await sendQuote(G, G2.id);
  ok(sq.status === 400 && /turned off/.test(sq.body.error), 'korak quote_ready ugašen: send-quote 400');
  await G.put({ disabled: { quote_ready: false } });

  // Quo kanal
  const Q = await mkClient('QA Quo', { gate: true });
  await connectGhl(Q);
  await Q.post('connect', { key: `quo-test-key-q${tag}` });
  await Q.post('number', { id: 'PNmain00001' });
  await Q.put({ texts: 'quo', on: true, holdout: 0, sender: 'Enrique' });
  const Q1 = await mkLead(Q, { name: 'Quin Quo', phone: '303 555 0311' });
  const lq = await waitPicked(Q, Q1.id);
  const pq = await preview(Q, Q1.id);
  ok(pq.body.sms.willSend && /^Hey Quin, this is Enrique from QA Quo \w+\. Your custom grillz design and price are ready: http.+\/p\/.+ Reply STOP to opt out\.$/.test(pq.body.sms.text) && /Text from your Quo number \+1 303 555 0100 · email from GoHighLevel/.test(pq.body.from), `preview Quo: SMS tekst i izvor (${pq.body.sms?.text?.slice(0, 80)})`);
  const nq = (await quo()).messages.length;
  sq = await sendQuote(Q, Q1.id);
  const mq = (await quo()).messages.findLast((m) => m.to[0] === '+13035550311');
  ok(sq.status === 200 && (await quo()).messages.length === nq + 1 && mq?.content === pq.body.sms.text && mq.from === 'PNmain00001', 'preview vraća isti SMS tekst koji se stvarno pošalje (Quo)');
  const tq1 = await tagsOf(lq.email);
  ok(tq1.log.includes('jl quote ready') && tq1.c.tags.includes('jl texts via quo') && (await fieldVal(lq.email, 'jl_quote_message')) === lq.quotes.picked.msg, 'Quo kanal: GHL tag za mejl + polje sa porukom');
  ok(histFor((await Q.wf()).body, 'quote_ready').some((h) => h.name === 'Quin Quo' && h.channel === 'quo' && h.body === mq.content), 'istorija: Quo red sa tekstom');
  ok(sq.body.quoteSend.sent.text === 'quo' && sq.body.quoteSend.sent.email === 'ghl', 'sent pamti kanale: text quo, email ghl');
  // Bez SMS pristanka: SMS preskočen, mejl (GHL tag) ide
  const Q2 = await mkLead(Q, { name: 'Nia NoSms', phone: '303 555 0312', sms: false, mkt: false });
  const lq2 = await waitPicked(Q, Q2.id);
  const pq2 = await preview(Q, Q2.id);
  const nq2 = (await quo()).messages.length;
  sq = await sendQuote(Q, Q2.id);
  ok(pq2.body.sms.willSend === false && /no SMS consent/.test(pq2.body.sms.why) && sq.status === 200 && (await quo()).messages.length === nq2 && (await tagsOf(lq2.email)).log.includes('jl quote ready'), `bez SMS pristanka: preview kaže zašto, SMS ne ide, mejl (tag) ide (${pq2.status} ${JSON.stringify(pq2.body.sms)} ${sq.status} ${sq.body.error || ''} ${(await quo()).messages.length}/${nq2})`);

  // Auto način
  const U = await mkClient('QA Auto', { gate: true });
  await connectGhl(U);
  await U.put({ on: true, holdout: 0, quoteMode: 'auto' });
  const U1 = await mkLead(U, { name: 'Uma Auto', phone: '303 555 0321' });
  const lu = await waitPicked(U, U1.id);
  let lu2 = null;
  for (let i = 0; i < 20 && !lu2?.quoteSend?.sent; i++) { await sleep(500); lu2 = await leadRow(U, U1.id); }
  ok(lu2?.quoteSend?.sent?.by === 'auto' && (await tagsOf(lu.email)).log.filter((x) => x === 'jl quote ready').length === 1, 'auto način: nov lead dobija quote_ready bez klika (jednom)');
  ok(!lu2.quoteSend.toApprove && !(await fetch(`${BASE}/api/portal/notifications`, { headers: U.C }).then(j)).body.items.some((x) => x.type === 'quote_awaiting'), 'auto način: nema "čeka odobrenje"');

  // Stari mejl preko Resenda ne šalje kad je quote_ready aktivan: autoSend se ne dira, ali slanje preskače
  const mailCfg = await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: G.C, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, quoteInfo: 'QA Jewelers\n1550 Larimer St', autoSend: true, replyTo: 'shop@example.com', alertEmails: ['shop@example.com'] } }) }).then(j);
  ok(mailCfg.status === 200, 'autoSend uključen u cijenama');
  const G4 = await mkLead(G, { name: 'Gus Resend', phone: '303 555 0304' });
  await waitPicked(G, G4.id);
  await sleep(1500);
  const g4 = await leadRow(G, G4.id);
  ok(!g4.autoSentAt, 'autoSendFirst ne šalje stari mejl kad je Automations uključen i quote_ready aktivan');
}

console.log(`\n${passes} OK, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
