// Automations za GHL workflowe (27.11.2026): čiste funkcije + cijeli tok na lokalnom serveru sa lažnim GHL-om.
//   node scripts/mock-ghl.mjs 8899 &
//   wrangler dev --port 8812 --test-scheduled --var GHL_BASE:http://127.0.0.1:8899
//   BASE=http://127.0.0.1:8812 GHL=http://127.0.0.1:8899 node scripts/ghl-auto-check.mjs
// Sat se pomjera preko /api/admin/ghl/auto-sweep?at= (samo DEV_MODE), pa se dani ponude i termina prođu za minut.
import { readFileSync } from 'node:fs';
import { offerEvents, apptEvents, reviewEvents, dueNow, inHoldout, localHour, autoSettings, EVENTS } from '../src/automations.js';
import { offerTimeline } from '../src/offer.js';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8812';
const GHL = process.env.GHL || 'http://127.0.0.1:8899';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HR = 3600_000;
const DAY = 24 * HR;

// ---------- Čiste funkcije ----------
const T0 = Date.parse('2026-11-27T17:00:00Z'); // 10:00 u Denveru
const tl = offerTimeline({ pricing: {}, quotes: {}, lead: { createdAt: T0 } }, T0);
const ev = offerEvents({ tl, leadId: 'L1', views: 0, clicks: [] });
const keys = ev.map((e) => e.ev);
ok(keys.join(',') === 'offer_unopened,offer_24h,offer_final,offer_expired,offer_closeout', `ponuda 48 h: ${keys.join(', ')}`);
ok(ev[0].at === T0 + 4 * HR && ev[1].at === T0 + 24 * HR && ev[2].at === T0 + 42 * HR && ev[3].at === T0 + 48 * HR, 'vremena: +4 h, 24 h prije kraja, 6 h prije kraja, istek');
ok(offerEvents({ tl, leadId: 'L1', views: 2, clicks: [] })[0].ev === 'offer_saved' && offerEvents({ tl, leadId: 'L1', views: 2, clicks: [] })[0].key === ev[0].key, 'otvorio stranicu: "saved" umjesto "not opened", isti ključ (nikad obje)');
ok(offerEvents({ tl, leadId: 'L1', views: 1, clicks: [], booked: true }).length === 0, 'zakazan termin gasi poruke ponude');
ok(offerEvents({ tl, leadId: 'L1', views: 1, clicks: [T0 + HR], paid: true }).length === 0, 'plaćen depozit gasi sve');
const dc = offerEvents({ tl, leadId: 'L1', views: 1, clicks: [T0 + HR, T0 + 2 * HR], booked: true });
ok(dc.length === 1 && dc[0].ev === 'deposit_click' && dc[0].at === T0 + HR + 20 * 60_000, 'klik na depozit: jednom, 20 min poslije prvog klika (i kad je zakazan termin)');
const tlR = offerTimeline({ pricing: {}, quotes: { refresh: { at: T0 + 50 * HR, status: 'ready', readyAt: T0 + 62 * HR } }, lead: { createdAt: T0 } }, T0 + 63 * HR);
const er = offerEvents({ tl: tlR, leadId: 'L1', views: 1, clicks: [] }).map((e) => e.ev);
ok(er.includes('refresh_ready') && !er.includes('offer_expired') && !er.includes('offer_closeout'), 'traženo osvježenje: refresh_ready, bez "expired" i "closeout"');
ok(offerEvents({ tl: offerTimeline({ pricing: { offerHours: 24 }, quotes: {}, lead: { createdAt: T0 } }, T0), leadId: 'L', views: 0, clicks: [] }).map((e) => e.ev).join(',') === 'offer_final,offer_expired,offer_closeout', 'ponuda 24 h: bez +4 h i bez "24h left"');
// Prozor dana: poruka u 2 ujutru čeka 10:00 po kupčevom satu, ali ne poslije roka.
const night = { ev: 'offer_saved', key: 'k', at: Date.parse('2026-11-28T09:00:00Z'), until: Date.parse('2026-11-28T23:00:00Z') }; // 02:00 Denver
ok(dueNow([night], { now: night.at, tz: 'America/Denver' }).length === 0 && dueNow([night], { now: Date.parse('2026-11-28T17:05:00Z'), tz: 'America/Denver' }).length === 1, 'noću ne, u 10:05 da');
ok(dueNow([night], { now: Date.parse('2026-11-28T17:05:00Z'), tz: 'America/Denver', since: night.at + 1 }).length === 0, 'događaj prije uključenja se ne šalje');
ok(dueNow([night], { now: Date.parse('2026-11-28T17:05:00Z'), tz: 'America/Denver', done: () => true }).length === 0, 'već poslat se ne šalje');
ok(localHour(Date.parse('2026-11-28T17:05:00Z'), 'America/New_York') === 12, 'sat po zoni kupca');
// Termini.
const S = T0 + 5 * DAY;
const va = apptEvents({ id: 'a1', kind: 'visit', start: S, end: S + 30 * 60_000, created: T0, status: 'booked' }).map((e) => e.ev);
ok(va.join(',') === 'appt_booked,visit_3d,visit_24h,visit_2h', `studio za 5 dana: ${va.join(', ')}`);
ok(apptEvents({ id: 'a1', kind: 'visit', start: T0 + 20 * HR, end: T0 + 21 * HR, created: T0, status: 'booked' }).map((e) => e.ev).join(',') === 'appt_booked,visit_2h', 'studio za 20 h: bez 3 dana i bez 24 h');
ok(apptEvents({ id: 'a2', kind: 'online', start: T0 + 3 * HR, end: T0 + 3.2 * HR, created: T0, status: 'booked' }).map((e) => e.ev).join(',') === 'appt_booked,call_1h,call_10m', 'poziv za 3 h: potvrda, 1 h, 10 min');
const k1 = apptEvents({ id: 'a1', kind: 'visit', start: S, end: S + 1, created: T0, status: 'booked' })[2].key;
const k2 = apptEvents({ id: 'a1', kind: 'visit', start: S + DAY, end: S + DAY + 1, created: T0, status: 'booked' })[2].key;
ok(k1 !== k2, 'pomjeren termin = novi podsjetnici za novo vrijeme');
ok(apptEvents({ id: 'a1', kind: 'visit', start: S, end: S + 1, created: T0, updated: S + HR, status: 'done' }, false).map((e) => e.ev).join(',') === 'appt_showed'
  && apptEvents({ id: 'a1', kind: 'visit', start: S, end: S + 1, created: T0, updated: S + HR, status: 'done' }, true).length === 0, 'Done bez depozita: poruka 2 h kasnije; sa depozitom ništa');
ok(apptEvents({ id: 'a1', kind: 'visit', start: S, end: S + 1, created: T0, updated: T0 + HR, status: 'cancelled', replaced: true }).length === 0, 'zamijenjen termin (pomjeren) ne šalje "cancelled"');
// Preuzimanje i recenzija.
const st = autoSettings({});
ok(reviewEvents({ leadId: 'L', readyAt: T0, pickedAt: null }, st).map((e) => e.ev).join(',') === 'order_ready', 'gotovo, nije preuzeto: samo "ready"');
const rv = reviewEvents({ leadId: 'L', readyAt: T0, pickedAt: T0 + DAY }, st);
ok(rv.map((e) => e.ev).join(',') === 'picked_up,review_request' && rv[1].at === T0 + 2 * DAY, 'preuzeto: zahvala odmah, recenzija dan kasnije');
ok(reviewEvents({ leadId: 'L', pickedAt: T0, grillz: true }, st)[1].at === T0 + 3 * DAY, 'grillz: recenzija 3 dana poslije');
ok(reviewEvents({ leadId: 'L', pickedAt: T0, gift: true }, st).map((e) => e.ev).join(',') === 'picked_up', 'poklon bez datuma prilike: zahtjev čeka');
ok(reviewEvents({ leadId: 'L', pickedAt: T0, gift: true, occasion: '2026-12-24' }, st, 'America/Denver')[1].at > Date.parse('2026-12-26T00:00:00Z'), 'poklon: 2 dana poslije prilike');
ok(reviewEvents({ leadId: 'L', pickedAt: T0, remake: true }, st).map((e) => e.ev).join(',') === 'picked_up', 'otvorena prepravka odgađa zahtjev');
const share = Array.from({ length: 2000 }, (_, i) => inHoldout(`lead${i}x`, 10)).filter(Boolean).length;
ok(share > 150 && share < 250 && inHoldout('abc', 10) === inHoldout('abc', 10), `kontrolna grupa ~10% i stalna (${share}/2000)`);
ok(new Set(Object.values(EVENTS).map((e) => e[0])).size === Object.keys(EVENTS).length, 'svaki događaj ima svoj tag');

// ---------- Server ----------
const ghl = async () => (await fetch(`${GHL}/_state`)).json();
const sweep = (at) => fetch(`${BASE}/api/admin/ghl/auto-sweep?at=${Math.round(at)}`, { method: 'POST', headers: H }).then(j);
const tag = Math.random().toString(36).slice(2, 7);
const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: `Auto Check ${tag}` }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: C, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, quoteInfo: 'Auto Check Jewelers\n1550 Larimer St, Denver, CO' } }) });
await fetch(`${BASE}/api/portal/booking`, { method: 'PUT', headers: C, body: JSON.stringify({ settings: { enabled: true, tz: 'America/Denver', kinds: { online: { on: true, minutes: 10, video: '', meet: true }, visit: { on: true, minutes: 30 } } } }) });
const put = (body) => fetch(`${BASE}/api/portal/ghl`, { method: 'PUT', headers: C, body: JSON.stringify(body) }).then(j);
let g = (await put({ token: 'pit-local-test-token-1234567890', locationId: 'LOC1234567890ab', pipelineId: 'pipe1', stages: { new: 'st-new', won: 'st-won' }, enabled: true, calendars: { online: 'calOnline01', visit: 'calVisit001' } })).body;
ok(g.connected && g.enabled, 'GHL povezan');
const fieldsRes = await fetch(`${BASE}/api/portal/ghl/fields`, { method: 'POST', headers: C, body: '{}' }).then(j);
ok(Object.keys(fieldsRes.body.fields || {}).length === 15 && fieldsRes.body.fields.jl_page_url === 'contact.jl_page_url', `JL polja napravljena (${Object.keys(fieldsRes.body.fields || {}).length})`);
const again = await fetch(`${BASE}/api/portal/ghl/fields`, { method: 'POST', headers: C, body: '{}' }).then(j);
ok((await ghl()).fields.filter((f) => f.name.startsWith('JL ')).length >= 15 && Object.keys(again.body.fields).length === 15, 'ponovni klik ne pravi duplikate polja');
g = (await put({ auto: { on: true, holdout: 0 } })).body;
ok(g.auto?.on && g.auto.since > 0 && g.auto.holdout === 0, 'Automations uključene');

const fd = new FormData();
const email = `ava-${tag}@example.com`;
for (const [k, v] of Object.entries({ formId: form.id, name: 'Ava Auto', email, phone: '303 555 0199', consent: 'yes', sms_consent: 'yes' })) fd.set(k, v);
fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }));
const lead = (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
const t0 = Date.now();
let contact;
for (let i = 0; i < 30 && !contact; i++) { await sleep(1000); contact = Object.values((await ghl()).contacts).find((c) => c.email === email); }
ok(contact, 'lead je kontakt u GHL-u');
const leads = (await fetch(`${BASE}/api/portal/leads`, { headers: C }).then(j)).body.leads;
const key = leads.find((l) => l.id === lead.leadId)?.page?.url.slice(3);
const tagsFor = async () => (await ghl()).tagLog.filter((x) => x.contact === contact.id && x.op === 'add').map((x) => x.tags[0]);
const fieldsNow = async () => { const c = (await ghl()).contacts[contact.id]; const defs = (await ghl()).fields; return Object.fromEntries((c.customFields || []).map((f) => [defs.find((d) => d.id === f.id)?.fieldKey.slice(8), f.field_value])); };
// Prvo slobodno vrijeme u dnevnom prozoru (10-19 Denver) od "at" naviše.
const dayTime = (at) => { let t = at; while (localHour(t, 'America/Denver') < 10 || localHour(t, 'America/Denver') >= 19) t += 15 * 60_000; return t; };

await sweep(t0 + 60_000);
ok(!(await tagsFor()).some((x) => x.startsWith('jl offer')), 'odmah poslije upita: ništa');
await sweep(dayTime(t0 + 4 * HR + 5 * 60_000));
let tg = await tagsFor();
ok(tg.includes('jl offer not opened'), `+4 h, stranica nije otvorena: "jl offer not opened" (${tg.join(', ')})`);
let fv = await fieldsNow();
ok(fv.jl_page_url?.endsWith(`/p/${key}`) && !fv.jl_page_url.includes('preview') && fv.jl_piece === 'grillz' && fv.jl_lead_id?.startsWith('L-') && fv.jl_offer_expires, `polja prije taga: link bez preview, komad, ID, rok (${fv.jl_page_url})`);
ok((await ghl()).tagLog.filter((x) => x.contact === contact.id && x.op === 'remove' && x.tags[0] === 'jl offer not opened').length === 1, 'tag se prvo skine pa doda (da workflow krene i drugi put)');
await fetch(`${BASE}/p/${key}`);
await sweep(dayTime(t0 + 5 * HR));
ok((await tagsFor()).filter((x) => x === 'jl offer saved' || x === 'jl offer not opened').length === 1, 'poslije otvaranja ne ide i "saved" (jedna od dvije)');
await sweep(t0 + 24 * HR + 10 * 60_000 + (localHour(t0 + 24 * HR, 'America/Denver') < 9 || localHour(t0 + 24 * HR, 'America/Denver') >= 21 ? 0 : 0));
await sweep(dayTime(t0 + 24 * HR + 10 * 60_000));
ok((await tagsFor()).includes('jl offer 24h left'), '24 h prije kraja: "jl offer 24h left"');
const n1 = (await tagsFor()).length;
await sweep(dayTime(t0 + 24 * HR + 20 * 60_000));
ok((await tagsFor()).length === n1, 'isti krug dvaput: bez duplikata');

// Klik na depozit bez uplate: obavještenje zlataru i tag poslije 20 min.
await fetch(`${BASE}/api/page/${key}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'deposit', option: 'picked', tz: 'America/New_York' }) });
const click = Date.now();
await sweep(click + 10 * 60_000);
ok(!(await tagsFor()).includes('jl deposit click'), 'klik prije 10 min: još ništa');
await sweep(click + 21 * 60_000 + (localHour(click + 21 * 60_000, 'America/New_York') < 9 || localHour(click + 21 * 60_000, 'America/New_York') >= 21 ? 0 : 0));
const nt = (await fetch(`${BASE}/api/portal/notifications`, { headers: C }).then(j)).body.items || [];
ok(nt.some((x) => x.type === 'deposit_unpaid'), 'zlatar u portalu: klik na depozit bez uplate');
const wideNY = (t) => { let x = t; while (localHour(x, 'America/New_York') < 9 || localHour(x, 'America/New_York') >= 21) x += 15 * 60_000; return x; };
if (!(await tagsFor()).includes('jl deposit click')) await sweep(wideNY(click + 21 * 60_000));
ok((await tagsFor()).includes('jl deposit click'), '"jl deposit click" (po satu kupca iz pregledača)');
ok((await ghl()).contacts[contact.id].timezone === 'America/New_York', 'zona kupca upisana na GHL kontakt');

// Studio visit: potvrda sa adresom, podsjetnik 2 h prije, ponuda staje.
const slots = (await fetch(`${BASE}/api/page/${key}/slots?kind=visit`).then(j)).body.days.flatMap((d) => d.slots);
const S1 = slots.find((s) => s > Date.now() + 30 * HR) || slots[0];
const bk = await fetch(`${BASE}/api/page/${key}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'visit', start: S1, option: 'picked', tz: 'America/New_York' }) }).then(j);
ok(bk.status === 200, `studio zakazan (${new Date(S1).toISOString()})`);
await sleep(1500);
const ev1 = Object.values((await ghl()).appointments).find((a) => a.contactId === contact.id && a.calendarId === 'calVisit001');
ok(ev1 && /1550 Larimer St/.test(ev1.address || ''), `GHL termin za studio ima adresu radnje (${ev1?.address})`);
await sweep(Date.now() + 60_000);
ok((await tagsFor()).includes('jl appt booked'), 'potvrda: "jl appt booked"');
fv = await fieldsNow();
ok(fv.jl_appt_type === 'Studio visit' && /1550 Larimer/.test(fv.jl_appt_location) && fv.jl_appt_time && fv.jl_reschedule_url?.endsWith('#appts'), `polja termina: ${fv.jl_appt_type} · ${fv.jl_appt_time} · ${fv.jl_appt_location}`);
await sweep(dayTime(t0 + 42 * HR + 10 * 60_000));
ok(!(await tagsFor()).includes('jl offer final hours'), 'zakazan termin: nema "final hours"');
// Enrique pomjeri termin u GHL-u za dan: kod nas novo vrijeme i novi podsjetnik.
const S2 = S1 + DAY;
const iso = (ms) => new Date(ms).toISOString();
await fetch(`${GHL}/_appt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ev1.id, patch: { startTime: iso(S2), endTime: iso(S2 + 30 * 60_000) } }) });
await fetch(`${BASE}/__scheduled?cron=${encodeURIComponent('*/5 * * * *')}`);
await sleep(4000);
const cur = (await fetch(`${BASE}/api/page/${key}/slots?kind=visit`).then(j)).body.current || [];
ok(cur.some((a) => a.kind === 'visit' && a.start === S2), 'termin pomjeren u GHL-u: novo vrijeme i na stranici kupca');
await sweep(S2 - 2 * HR + 5 * 60_000);
ok((await tagsFor()).includes('jl visit 2h'), 'podsjetnik 2 h prije za NOVO vrijeme');
fv = await fieldsNow();
ok(fv.jl_appt_time && fv.jl_appt_time === (await fieldsNow()).jl_appt_time, `vrijeme u polju: ${fv.jl_appt_time}`);

// Online + Google Meet.
const os = (await fetch(`${BASE}/api/page/${key}/slots?kind=online`).then(j)).body;
ok(os.video === true, 'Meet uključen: kupac može izabrati video poziv');
const bo = await fetch(`${BASE}/api/page/${key}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online', start: os.days.flatMap((d) => d.slots)[0], via: 'video' }) }).then(j);
await sleep(1500);
const ev2 = Object.values((await ghl()).appointments).find((a) => a.contactId === contact.id && a.calendarId === 'calOnline01');
ok(ev2 && ev2.meetingLocationType === 'gmeet' && ev2.overrideLocationConfig === true && !('address' in ev2 && !/meet\.google/.test(ev2.address)) && ev2.assignedUserId === 'userOwner001', 'GHL termin: gmeet, bez adrese, sa domaćinom');
const meetCur = (await fetch(`${BASE}/api/page/${key}/slots?kind=online`).then(j)).body.current.find((a) => a.kind === 'online');
ok(/^https:\/\/meet\.google\.com\//.test(meetCur?.video || ''), `kupac vidi Meet link (${meetCur?.video})`);
await sweep(Date.now() + 2 * 60_000);
fv = await fieldsNow();
ok((await tagsFor()).filter((x) => x === 'jl appt booked').length === 3 && /meet\.google/.test(fv.jl_meet_link || '') && fv.jl_appt_type === 'Online consultation (video call)', 'potvrde: studio, studio pomjeren u GHL-u (novo vrijeme), online poziv sa Meet linkom u polju');

// Done u portalu: GHL "showed", pa bez depozita poruka 2 h kasnije.
const bks = (await fetch(`${BASE}/api/portal/bookings`, { headers: C }).then(j)).body.appointments || [];
const ap = bks.find((x) => x.kind === 'visit' && x.status === 'booked');
await fetch(`${BASE}/api/portal/appointments/${ap.id}`, { method: 'PATCH', headers: C, body: JSON.stringify({ status: 'done' }) });
await sleep(1500);
ok((await ghl()).appointments[ev1.id].appointmentStatus === 'showed', 'Done u portalu = Showed u GHL kalendaru');
await sweep(dayTime(Date.now() + 2 * HR + 5 * 60_000));
ok((await tagsFor()).includes('jl appt showed no deposit'), 'bio na terminu, bez depozita: "jl appt showed no deposit"');

// Won, gotovo, preuzeto, recenzija (grillz: 3 dana).
await fetch(`${BASE}/api/portal/leads/${lead.leadId}`, { method: 'PATCH', headers: C, body: JSON.stringify({ status: 'won' }) });
const o1 = await fetch(`${BASE}/api/portal/leads/${lead.leadId}/order`, { method: 'PATCH', headers: C, body: JSON.stringify({ picked: true }) }).then(j);
ok(o1.status === 409, 'Picked up prije "Ready for pick up" odbijen');
await fetch(`${BASE}/api/portal/leads/${lead.leadId}/order`, { method: 'PATCH', headers: C, body: JSON.stringify({ stage: 5 }) });
await sweep(dayTime(Date.now() + 60_000));
ok((await tagsFor()).includes('jl order ready'), '"jl order ready"');
const o2 = await fetch(`${BASE}/api/portal/leads/${lead.leadId}/order`, { method: 'PATCH', headers: C, body: JSON.stringify({ picked: true }) }).then(j);
ok(o2.body.order?.pickedAt > 0, 'Mark picked up');
const picked = o2.body.order.pickedAt;
await sweep(Date.now() + 60_000 + (localHour(Date.now(), 'America/New_York') < 9 || localHour(Date.now(), 'America/New_York') >= 21 ? 0 : 0));
if (!(await tagsFor()).includes('jl picked up')) await sweep(wideNY(Date.now() + 60_000));
ok((await tagsFor()).includes('jl picked up'), '"jl picked up"');
fv = await fieldsNow();
ok(fv.jl_order_status === 'Picked up' && /-/.test(fv.jl_order_no || ''), `polja narudžbe: ${fv.jl_order_no} · ${fv.jl_order_status}`);
const nyDay = (t) => { let x = t; while (localHour(x, 'America/New_York') < 10 || localHour(x, 'America/New_York') >= 19) x += 15 * 60_000; return x; };
await sweep(nyDay(picked + 1 * DAY + HR));
ok(!(await tagsFor()).includes('jl review request'), 'grillz: dan poslije još nema zahtjeva');
await sweep(nyDay(picked + 3 * DAY + 5 * 60_000));
ok((await tagsFor()).includes('jl review request'), 'grillz: 3 dana poslije "jl review request"');

const pg = (await fetch(`${BASE}/api/portal/ghl`, { headers: C }).then(j)).body;
ok(pg.events?.length >= 10 && pg.events.every((e) => e.status === 'sent'), `portal: zadnji događaji (${pg.events?.length}), svi poslati`);
g = (await put({ auto: { on: false } })).body;
const before = (await tagsFor()).length;
await sweep(nyDay(picked + 10 * DAY));
ok(!g.auto.on && (await tagsFor()).length === before, 'isključeno: nema novih tagova');
ok((await ghl()).calls.filter((c) => /^\/(calendars|conversations)\//.test(c.path)).every((c) => c.version === '2021-04-15'), 'kalendarski pozivi na 2021-04-15');

console.log(fails ? `${fails} FAILED` : 'GHL automation checks passed.');
process.exit(fails ? 1 : 0);
