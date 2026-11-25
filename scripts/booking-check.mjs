// Kalendar na stranici kupca, depozit i koraci poslije depozita (25.11.2026).
//   node scripts/mock-ghl.mjs 8899 &   (lažni GHL)
//   wrangler dev --port 8812 --test-scheduled --var GHL_BASE:http://127.0.0.1:8899
//   BASE=http://127.0.0.1:8812 GHL=http://127.0.0.1:8899 node scripts/booking-check.mjs
import { readFileSync } from 'node:fs';
import { bookingSettings, cleanBooking, nativeSlots, zonedToUtc, ghlSlotsToDays, cleanFulfillment, depositLink, icsFor } from '../src/booking.js';
import { hookPayload } from '../src/ghl.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8812';
const GHL = process.env.GHL || 'http://127.0.0.1:8899';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Čiste funkcije ----------
const cfg = bookingSettings({ enabled: true });
ok(new Date(zonedToUtc('2026-11-28', '10:00', 'America/Denver')).toISOString() === '2026-11-28T17:00:00.000Z', 'Denver zimi: 10:00 = 17:00 UTC');
ok(new Date(zonedToUtc('2026-07-01', '10:00', 'America/Denver')).toISOString() === '2026-07-01T16:00:00.000Z', 'Denver ljeti: 10:00 = 16:00 UTC');
const now = Date.parse('2026-11-25T17:40:00Z'); // srijeda 10:40 u Denveru
const days = nativeSlots(cfg, 'online', [{ start: Date.parse('2026-11-26T17:00:00Z'), end: Date.parse('2026-11-26T17:30:00Z') }], now);
ok(days.length === 14 && days[0].slots[0] === Date.parse('2026-11-25T19:45:00Z'), 'prvi termin danas poštuje 2 h unaprijed (12:45)');
ok(days[1].slots[0] === Date.parse('2026-11-26T17:45:00Z'), 'zauzeto 10:00-10:30 + pauza 5 min: prvi slobodan 10:45');
ok(days.find((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === 0).slots.length === 0, 'nedjelja zatvoreno');
const closed = bookingSettings({ enabled: true, closed: ['2026-11-27'] });
ok(nativeSlots(closed, 'online', [], now)[2].slots.length === 0, 'zatvoren dan (praznik) bez termina');
ok(cleanBooking({ tz: 'Mars/Base', step: 7, hours: { mon: ['18:00', '10:00'] }, kinds: { online: { minutes: 999, video: 'http://x.com' } } }).tz === 'America/Denver', 'nepoznata zona odbijena');
const cb = cleanBooking({ step: 7, hours: { mon: ['18:00', '10:00'] }, kinds: { online: { minutes: 999, video: 'http://x.com' } } });
ok(cb.step === 15 && cb.hours.mon === null && cb.kinds.online.minutes === 60 && cb.kinds.online.video === '', 'loši unosi: korak, obrnuto radno vrijeme, dužina, http link');
const gd = ghlSlotsToDays({ '2026-11-26': { slots: ['2026-11-26T11:00:00-07:00', '2026-11-26T11:30:00-07:00'] }, traceId: 'x' }, cfg, now);
ok(gd[1].slots.length === 2 && gd[1].slots[0] === Date.parse('2026-11-26T18:00:00Z'), 'GHL free-slots u isti oblik');
ok(cleanFulfillment({ local: true }, {}).error && cleanFulfillment({ local: false, method: 'visit' }, { grillz: true }).error, 'bez načina ili adrese = greška');
const ff = cleanFulfillment({ local: false, address: { line1: '1 Main', city: 'Phoenix', state: 'AZ', zip: '85001' } }, { grillz: true });
ok(ff.method === 'ship' && ff.kit === true && ff.address.city === 'Phoenix', 'van regije = slanje, grillz dobija kit');
ok(/prefilled_email=a%40b.com/.test(depositLink('https://buy.stripe.com/x', { email: 'a@b.com' })) && /first_name=Ana&last_name=Li&email=/.test(depositLink('https://link.fastpaydirect.com/p/1', { name: 'Ana Li', email: 'a@b.com' })), 'link depozita sa podacima kupca (Stripe i GHL)');
ok(/DTSTART:20261128T170000Z/.test(icsFor({ id: 'x', kind: 'visit', start: Date.parse('2026-11-28T17:00:00Z'), end: Date.parse('2026-11-28T17:30:00Z') }, { name: 'S', address: 'A' })), '.ics termin');
const hp = hookPayload({ contact_id: 'c1', email: 'A@B.com', customData: { amount: '$500.00' } });
ok(hp.contactId === 'c1' && hp.email === 'a@b.com' && hp.amount === 500 && hp.event === 'deposit', 'webhook: kontakt, mejl, iznos');

// ---------- Server ----------
const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: `Calendar Check ${Date.now() % 100000}` }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const viewAs = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const V = { 'x-portal-token': viewAs, 'content-type': 'application/json' };
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: C, body: JSON.stringify({ pricing: { depositUrl: 'https://link.fastpaydirect.com/payment-link/test', quoteInfo: 'Calendar Check\n1 Main St, Denver' } }) });
const mk = async (name, type = 'grillz') => {
  const fd = new FormData();
  const email = `${name.split(' ')[0].toLowerCase()}${Date.now() % 1e6}@example.com`;
  for (const [k, v] of Object.entries({ formId: form.id, name, email, phone: '303 555 0101', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify(type === 'grillz' ? { type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' } : { type: 'ring', style: 'halo', metal: 'white-gold', karat: '14K', stones: 'lab', coverage: 'accents', budget: '$1,500 - $2,500' }));
  return { ...(await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body, email };
};
const a = await mk('Ava Calendar');
const b = await mk('Ben Ring', 'ring');
await sleep(400);
const leads = (await fetch(`${BASE}/api/portal/leads`, { headers: C }).then(j)).body.leads;
const keyOf = (id) => leads.find((l) => l.id === id)?.page?.url.slice(3);
const ka = keyOf(a.leadId);
const kb = keyOf(b.leadId);
ok(ka && kb, 'oba leada imaju stranicu');

let html = await (await fetch(`${BASE}/p/${ka}`)).text();
ok(!html.includes('data-action="book"') && html.includes('data-action="appointment"'), 'kalendar isključen: dugme radi kao ranije');
const off = await fetch(`${BASE}/api/page/${ka}/slots?kind=online`).then(j);
ok(off.status === 400, 'slotovi odbijeni dok je kalendar isključen');

const allDay = Object.fromEntries(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => [d, ['00:00', '23:45']]));
const bad = await fetch(`${BASE}/api/portal/booking`, { method: 'PUT', headers: C, body: JSON.stringify({ settings: { enabled: true, hours: {} } }) }).then(j);
ok(bad.status === 400, 'uključenje bez radnog vremena odbijeno');
const put = await fetch(`${BASE}/api/portal/booking`, { method: 'PUT', headers: C, body: JSON.stringify({ settings: { enabled: true, notice: 0, days: 7, hours: allDay, region: 'Colorado', kinds: { online: { on: true, minutes: 10, video: 'https://meet.google.com/abc-defg-hij' }, visit: { on: true, minutes: 30 } } } }) }).then(j);
ok(put.status === 200 && put.body.settings.enabled && put.body.settings.region === 'Colorado', 'kalendar uključen i sačuvan');

html = await (await fetch(`${BASE}/p/${ka}`)).text();
ok(html.includes('data-action="book"') && html.includes('id="bk-data"') && html.includes('id="sched"'), 'stranica: Book otvara kalendar');
ok(!html.includes('id="next"'), 'pitanja poslije depozita se ne vide prije depozita');

const s1 = await fetch(`${BASE}/api/page/${ka}/slots?kind=online`).then(j);
const first = s1.body.days?.find((d) => d.slots.length)?.slots[0];
ok(s1.status === 200 && s1.body.source === 'store' && first && s1.body.video === true, `slobodni termini iz radnog vremena (${s1.body.days?.reduce((n, d) => n + d.slots.length, 0)})`);
const bk1 = await fetch(`${BASE}/api/page/${ka}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online', start: first, via: 'video', option: 'picked', note: 'After 5 is best' }) }).then(j);
ok(bk1.status === 200 && bk1.body.appointment?.via === 'video' && /meet\.google/.test(bk1.body.appointment.video), 'online konsultacija zakazana (video)');
const taken = await fetch(`${BASE}/api/page/${kb}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'visit', start: first }) }).then(j);
ok(taken.status === 409, 'drugi kupac ne može u isto vrijeme (ni druga vrsta termina)');
const sB = await fetch(`${BASE}/api/page/${kb}/slots?kind=visit`).then(j);
ok(!sB.body.days.some((d) => d.slots.some((t) => t < first + 10 * 60_000 + 5 * 60_000 && t + 30 * 60_000 + 5 * 60_000 > first)), 'zauzeto vrijeme (sa pauzom) nestaje iz tuđih termina');
const odd = await fetch(`${BASE}/api/page/${ka}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online', start: first + 7 * 60_000 }) }).then(j);
ok(odd.status === 409, 'vrijeme van ponuđenih termina odbijeno');
const second = s1.body.days.flatMap((d) => d.slots).find((t) => t >= first + 60 * 60_000);
const bk2 = await fetch(`${BASE}/api/page/${ka}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online', start: second }) }).then(j);
const cur = (await fetch(`${BASE}/api/page/${ka}/slots?kind=online`).then(j)).body.current;
ok(bk2.status === 200 && cur.length === 1 && cur[0].start === second, 'promjena vremena: stari termin otkazan, ostaje jedan');
const ics = await fetch(`${BASE}${bk2.body.appointment.ics}`);
ok(ics.status === 200 && /text\/calendar/.test(ics.headers.get('content-type')) && /BEGIN:VEVENT/.test(await ics.text()), '.ics za kalendar kupca');
const page2 = await (await fetch(`${BASE}/p/${ka}`)).text();
ok(page2.includes('Your appointment') && page2.includes('Online consultation'), 'stranica pokazuje zakazani termin');

const pb = (await fetch(`${BASE}/api/portal/bookings`, { headers: C }).then(j)).body;
const ap = pb.appointments?.find((x) => x.id === bk2.body.appointment.id);
ok(ap && ap.status === 'booked' && ap.isNew && pb.unseen >= 1 && pb.appointments.some((x) => x.status === 'cancelled'), 'portal Bookings: novi termin i otkazani stari');
const leads2 = (await fetch(`${BASE}/api/portal/leads`, { headers: C }).then(j)).body.leads;
ok(leads2.find((l) => l.id === a.leadId)?.appt?.kind === 'online', 'kartica leada nosi termin');
const roPatch = await fetch(`${BASE}/api/portal/appointments/${ap.id}`, { method: 'PATCH', headers: V, body: JSON.stringify({ status: 'done' }) }).then(j);
ok(roPatch.status === 403, 'admin pregled ne mijenja status termina');
const done = await fetch(`${BASE}/api/portal/appointments/${ap.id}`, { method: 'PATCH', headers: C, body: JSON.stringify({ status: 'done' }) }).then(j);
ok(done.status === 200, 'zlatar označi termin kao Done');
const notif = (await fetch(`${BASE}/api/portal/notifications`, { headers: C }).then(j)).body;
ok(notif.items?.some((x) => x.type === 'appointment_booked' && x.meta.kind === 'online'), 'obavještenje o zakazanom terminu');

// Depozit: klik vodi na GHL link sa podacima i ostavlja kolačić za povratak.
const dep = await fetch(`${BASE}/api/page/${ka}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'deposit', option: 'picked' }) });
const depBody = await dep.json();
const cookie = dep.headers.get('set-cookie') || '';
ok(/first_name=Ava/.test(depBody.redirect) && /email=ava/.test(depBody.redirect) && /jl_dep=/.test(cookie) && /SameSite=Lax/.test(cookie), 'Deposit: link sa podacima kupca + kolačić za povratak');
const back = await fetch(`${BASE}/deposit/done`, { headers: { cookie: cookie.split(';')[0] }, redirect: 'manual' });
ok(back.status === 302 && back.headers.get('location') === `/p/${ka}?deposit=1#next`, 'povratak sa plaćanja vodi na stranicu kupca');
const noCookie = await fetch(`${BASE}/deposit/done`, { redirect: 'manual' });
ok(noCookie.status === 200, 'povratak bez kolačića: zahvalnica');
html = await (await fetch(`${BASE}/p/${ka}?deposit=1`)).text();
ok(html.includes('id="next"') && html.includes('Are you in Colorado?') && html.includes('Mail me a mold kit'), 'pitanja poslije depozita (Colorado, kit za grillz)');

// Odgovori poslije depozita: posjeta sa terminom.
const visitSlot = (await fetch(`${BASE}/api/page/${ka}/slots?kind=visit&for=next`).then(j)).body.days.flatMap((d) => d.slots).find((t) => t > second + 3600_000);
const nx = await fetch(`${BASE}/api/page/${ka}/next`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ local: true, method: 'visit', start: visitSlot, note: 'Weekends' }) }).then(j);
ok(nx.status === 200 && nx.body.appointment?.purpose === 'mold' && /mold/.test(nx.body.text), 'u Coloradu: dolazi na otisak, termin zakazan');
const nxShip = await fetch(`${BASE}/api/page/${kb}/next`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ local: false, address: { line1: '9 Elm St', city: 'Phoenix', state: 'AZ', zip: '85001' } }) }).then(j);
ok(nxShip.status === 200 && nxShip.body.fulfillment.method === 'ship' && nxShip.body.fulfillment.kit === false && /Ship the finished piece/.test(nxShip.body.text), 'van države, prsten: šaljemo komad na adresu');
const nxBad = await fetch(`${BASE}/api/page/${kb}/next`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ local: false, address: { line1: '9 Elm St' } }) }).then(j);
ok(nxBad.status === 400, 'nepotpuna adresa odbijena');

// ---------- GHL: kalendar, webhook depozita, SMS ----------
await fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: C, body: JSON.stringify({ token: 'pit-0123456789abcdef0123456789abcdef', locationId: 'loc1234567890' }) });
const cals = await fetch(`${BASE}/api/portal/ghl/calendars`, { method: 'POST', headers: C, body: '{}' }).then(j);
ok(cals.body.calendars?.length === 2, `GHL kalendari učitani ${cals.body.error || ''}`);
const g1 = await fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: C, body: JSON.stringify({ enabled: true, calendars: { online: 'calOnline01', visit: '' }, smsNext: true, hook: 'create' }) }).then(j);
ok(g1.body.calendars?.online === 'calOnline01' && /\/api\/hooks\/ghl\/[a-z0-9]{32}$/.test(g1.body.hookUrl || '') && g1.body.smsNext, 'kalendar, SMS i webhook adresa sačuvani');
const c = await mk('Cara Ghl');
await sleep(1500);
const kc = (await fetch(`${BASE}/api/portal/leads`, { headers: C }).then(j)).body.leads.find((l) => l.id === c.leadId)?.page?.url.slice(3);
const gs = await fetch(`${BASE}/api/page/${kc}/slots?kind=online`).then(j);
const gt = gs.body.days?.flatMap((d) => d.slots)[0];
ok(gs.body.source === 'ghl' && gt, 'slobodni termini iz GHL kalendara');
const gb = await fetch(`${BASE}/api/page/${kc}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online', start: gt }) }).then(j);
await sleep(1200);
let st = await fetch(`${GHL}/_state`).then((r) => r.json());
const ev = Object.values(st.appointments).find((x) => Date.parse(x.startTime) === gt);
ok(gb.status === 200 && ev?.calendarId === 'calOnline01' && ev.contactId, 'termin upisan u GHL kalendar na kontakt');
const cc = st.contacts[ev?.contactId];
ok(cc?.tags?.includes('jewelrylead online consultation') && cc.notes.some((n) => /Online consultation \(phone call\) booked/.test(n)), 'kontakt: tag i bilješka o terminu');
await fetch(`${BASE}/api/page/${kc}/appointments/${gb.body.appointment.id}/cancel`, { method: 'POST' });
await sleep(1000);
st = await fetch(`${GHL}/_state`).then((r) => r.json());
ok(st.appointments[ev.id]?.appointmentStatus === 'cancelled', 'otkazivanje sa stranice otkazuje i u GHL-u');

const hook = g1.body.hookUrl.replace(/^https?:\/\/[^/]+/, BASE);
const miss = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.com', customData: { amount: 500 } }) }).then(j);
ok(miss.status === 200 && miss.body.matched === false, 'webhook za nepoznatog kupca: 200, bez leada');
const wrong = await fetch(`${BASE}/api/hooks/ghl/${'x'.repeat(32)}`, { method: 'POST', body: '{}' });
ok(wrong.status === 404, 'pogrešna webhook adresa: 404');
const hit = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contact_id: ev.contactId, email: c.email, phone: '+13035550101', customData: { amount: '500', event: 'deposit' } }) }).then(j);
await sleep(1200);
st = await fetch(`${GHL}/_state`).then((r) => r.json());
ok(hit.body.matched === true, 'webhook depozita nađe lead (GHL kontakt ili mejl)');
ok(st.messages.some((m) => m.type === 'SMS' && m.contactId === ev.contactId && m.message.includes(`/p/${kc}?next=1`)), 'SMS kupcu sa linkom na sljedeći korak');
const again = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contact_id: ev.contactId, email: c.email }) }).then(j);
await sleep(600);
const st2 = await fetch(`${GHL}/_state`).then((r) => r.json());
ok(again.body.matched && st2.messages.length === st.messages.length, 'ponovljen webhook ne šalje drugi SMS');
html = await (await fetch(`${BASE}/p/${kc}`)).text();
ok(html.includes('Deposit received · $500') && html.includes('btn done'), 'stranica: Deposit received, dugme depozita zamijenjeno');
const nx3 = await fetch(`${BASE}/api/page/${kc}/next`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ local: false, address: { line1: '5 Oak Ave', line2: 'Apt 2', city: 'Austin', state: 'TX', zip: '73301' } }) }).then(j);
await sleep(1200);
st = await fetch(`${GHL}/_state`).then((r) => r.json());
const c3 = st.contacts[ev.contactId];
ok(nx3.status === 200 && c3.tags.includes('jewelrylead ship mold kit') && c3.tags.includes('jewelrylead out of state') && c3.city === 'Austin' && c3.postalCode === '73301', 'GHL: tagovi za slanje kita i adresa na kontaktu');
const pb2 = (await fetch(`${BASE}/api/portal/bookings`, { headers: C }).then(j)).body;
const d3 = pb2.deposits.find((x) => x.leadId === c.leadId);
ok(d3?.paidAt && d3.amount === 500 && d3.smsAt && /mold kit/.test(d3.fulfillment?.text || ''), 'portal: depozit plaćen, SMS poslat, odgovor upisan');

console.log(fails ? `\n${fails} FAIL` : '\nSve prošlo.');
process.exit(fails ? 1 : 0);
