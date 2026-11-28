// GHL workflowi (27.11.2026, Ognjen: "šabloni su okej, pripremi sve u JewelryLead sistemu da radi kako treba").
// Istraživanja: projects/jewelrylead/research/{abandoned-quote,appointment,review}-workflows-2026-11-27.md u Ignisu.
//
// Podjela posla: JewelryLead zna stanje (ponuda i njen sat, posjete stranici, klik na depozit, uplata, termin, Done /
// No-show, faza narudžbe, preuzimanje) i zato ON odlučuje KAD ide koja poruka. GHL samo šalje: za svaki događaj
// JewelryLead upiše polja kontakta (jl_*, za tekst poruke), skine pa doda tag događaja, a GHL workflow sa okidačem
// "Contact Tag Added" pošalje SMS ili mejl i na kraju skine tag. Tako u GHL-u nema čekanja, uslova ni računanja datuma,
// a isti događaj nikad ne ide dvaput (ključ u tabeli ghl_events).
//
// Sve ovdje je čisto računanje (bez baze i mreže), da se provjerava skriptom scripts/ghl-auto-check.mjs.

const M = 60_000;
const H = 60 * M;
const D = 24 * H;

export const AUTO_DEFAULTS = { on: false, offer: true, appts: true, reviews: true, holdout: 10, reviewDays: 1, grillzReviewDays: 3, texts: 'ghl', quoteMode: 'approve' };

// Događaj -> [tag u GHL-u, grupa, kada (za portal i uputstvo)]. Imena tagova se ne mijenjaju: na njih su vezani workflowi.
export const EVENTS = {
  quote_ready: ['jl quote ready', 'offer', 'The quote was sent to the customer (after you approve it, or right away)'],
  deposit_click: ['jl deposit click', 'offer', 'Clicked "Reserve with a deposit" and did not pay within 20 minutes'],
  offer_saved: ['jl offer saved', 'offer', '4 hours after the quote: opened their page, no deposit or booking'],
  offer_unopened: ['jl offer not opened', 'offer', '4 hours after the quote: has not opened their page yet'],
  offer_24h: ['jl offer 24h left', 'offer', '24 hours before the price hold ends'],
  offer_final: ['jl offer final hours', 'offer', '6 hours before the price hold ends'],
  offer_expired: ['jl offer expired', 'offer', 'The price hold ended (offers are locked on their page)'],
  offer_closeout: ['jl offer closeout', 'offer', '6 days after the hold ended, no refreshed quote asked'],
  refresh_ready: ['jl refresh ready', 'offer', 'Their refreshed price unlocked (metal steady), held 24 hours'],
  refresh_moved: ['jl refresh needs quote', 'offer', 'Metal moved too much: the store sends the new price (internal)'],
  appt_booked: ['jl appt booked', 'appts', 'Booked a studio visit or online consultation (confirmation)'],
  visit_3d: ['jl visit 3 days', 'appts', 'Studio visit in 3 days (only when booked more than 3.5 days ahead)'],
  visit_24h: ['jl visit 24h', 'appts', 'Studio visit tomorrow (24 hours before)'],
  visit_2h: ['jl visit 2h', 'appts', 'Studio visit in 2 hours'],
  call_1h: ['jl call 1h', 'appts', 'Online consultation in 1 hour'],
  call_10m: ['jl call 10 min', 'appts', 'Online consultation in 10 minutes'],
  appt_noshow: ['jl appt no show', 'appts', 'Marked No-show (portal or GoHighLevel)'],
  appt_showed: ['jl appt showed no deposit', 'appts', 'Marked Done, still no deposit 2 hours later'],
  appt_cancelled: ['jl appt cancelled', 'appts', 'Cancelled (not moved to another time)'],
  order_ready: ['jl order ready', 'reviews', 'Order moved to "Ready for pick up"'],
  picked_up: ['jl picked up', 'reviews', 'Marked "Picked up" on the order'],
  review_request: ['jl review request', 'reviews', 'Day after pick up (grillz 3 days; gifts 2 days after the occasion)'],
};
export const EVENT_TAGS = Object.values(EVENTS).map((e) => e[0]);
// Poruke koje se šalju samo danju po kupčevom satu (prodaja i recenzija); podsjetnici za termin idu kad treba.
const WINDOW = {
  offer_saved: 'day', offer_unopened: 'day', offer_expired: 'day', offer_closeout: 'day', refresh_ready: 'day', deposit_click: 'wide',
  offer_24h: 'wide', offer_final: 'wide', order_ready: 'day', picked_up: 'wide', review_request: 'day', appt_showed: 'day',
};
const WINDOWS = { day: [10, 19], wide: [9, 21] };

// Polja kontakta u GHL-u (pravi ih dugme u portalu). GHL pravi ključ iz imena ("JL Appt Time" -> contact.jl_appt_time),
// pa su imena izabrana da ključ bude tačno naš; portal ipak pokazuje ključ koji je GHL stvarno dao.
export const FIELDS = [
  ['jl_lead_id', 'JL Lead ID'], ['jl_piece', 'JL Piece'], ['jl_page_url', 'JL Page URL'], ['jl_render_url', 'JL Render URL'],
  ['jl_price', 'JL Price'], ['jl_option_2_price', 'JL Option 2 Price'], ['jl_offer_expires', 'JL Offer Expires'],
  ['jl_appt_type', 'JL Appt Type'], ['jl_appt_time', 'JL Appt Time'], ['jl_appt_location', 'JL Appt Location'],
  ['jl_meet_link', 'JL Meet Link'], ['jl_reschedule_url', 'JL Reschedule URL'], ['jl_order_no', 'JL Order No'], ['jl_order_status', 'JL Order Status'],
  ['jl_occasion_date', 'JL Occasion Date'], ['jl_quote_message', 'JL Quote Message', 'LARGE_TEXT'],
];

// Postavke (clients.data.automation; stari zapis ghl.auto se čita dok novi ne postoji). Sve što dođe spolja se čisti ovdje.
export function autoSettings(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const int = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);
  const templates = {};
  for (const [k, v] of Object.entries(a.templates && typeof a.templates === 'object' ? a.templates : {})) if (k in DEFAULT_TEMPLATES && DEFAULT_TEMPLATES[k] && cleanTemplate(v)) templates[k] = String(v).trim();
  const disabled = {};
  for (const [k, v] of Object.entries(a.disabled && typeof a.disabled === 'object' ? a.disabled : {})) if (k in EVENTS && v === true) disabled[k] = true;
  return {
    on: a.on === true, since: Number(a.since) || 0, offer: a.offer !== false, appts: a.appts !== false, reviews: a.reviews !== false,
    holdout: [0, 10, 20].includes(Number(a.holdout)) ? Number(a.holdout) : AUTO_DEFAULTS.holdout,
    reviewDays: int(a.reviewDays, 0, 14, AUTO_DEFAULTS.reviewDays), grillzReviewDays: int(a.grillzReviewDays, 0, 14, AUTO_DEFAULTS.grillzReviewDays),
    texts: a.texts === 'quo' ? 'quo' : 'ghl', quoteMode: a.quoteMode === 'auto' ? 'auto' : 'approve', reviewLink: cleanReviewLink(a.reviewLink) || '', sender: /^[^<>]{1,40}$/.test(String(a.sender || '').trim()) ? String(a.sender).trim() : '',
    templates, disabled,
  };
}
export const cleanReviewLink = (v) => { const t = String(v || '').trim(); return /^https:\/\/[^\s<>"']{4,280}$/.test(t) ? t : ''; };
// Tekst poruke: do 600 znakova, bez < i >.
export const cleanTemplate = (v) => { const t = String(v ?? '').trim(); return t.length > 0 && t.length <= 600 && !/[<>]/.test(t) ? t : ''; };

// Kontrolna grupa (istraživanje: jedini način da se zna stvarni efekat podsjetnika): stalno ista za isti lead.
export function inHoldout(leadId, pct) {
  if (!pct) return false;
  let h = 2166136261;
  for (const c of String(leadId)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h % 100 < pct;
}

export function localHour(ms, tz) {
  try { return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', hourCycle: 'h23', hour: '2-digit' }).format(new Date(ms))) % 24; } catch { return new Date(ms).getUTCHours(); }
}
const inWindow = (ev, now, tz) => {
  const w = WINDOWS[WINDOW[ev]];
  if (!w) return true;
  const h = localHour(now, tz);
  return h >= w[0] && h < w[1];
};

// Ponuda (tok "napuštena ponuda"). s = { tl (offerTimeline), leadId, views, clicks: [ms klika na depozit], paid, booked, closed }.
export function offerEvents(s) {
  const out = [];
  const tl = s.tl;
  if (!tl || s.closed || s.paid) return out;
  // Kupac je odgovorio (SMS preko Quo-a) poslije početka ponude: razgovor je počeo, automatske poruke staju.
  if (s.replied && s.replied >= tl.from) return out;
  const set = tl.settings || {};
  const from = tl.from;
  const hours = Number(set.hours) || 0;
  const fd = hours > 0 ? from + hours * H : 0;
  const add = (ev, cycle, at, until) => out.push({ ev, key: `${ev}:${s.leadId}:${cycle}`, at, until });
  // Klik na depozit bez uplate: jednom po ponudi, 20 min poslije prvog klika u toj ponudi.
  const click = (s.clicks || []).filter((c) => c >= from).sort((a, b) => a - b)[0];
  if (click) add('deposit_click', from, click + 20 * M, click + D);
  if (s.booked) return out;
  const asked = !!tl.refresh;
  // Jedna od dvije poruke (otvorio / nije otvorio), zajednički ključ da kupac ne dobije obje.
  if (!fd || hours >= 30) out.push({ ev: s.views ? 'offer_saved' : 'offer_unopened', key: `offer_first:${s.leadId}:${from}`, at: from + 4 * H, until: from + 20 * H });
  if (fd) {
    if (hours >= 36) add('offer_24h', from, fd - 24 * H, fd - 12 * H);
    if (hours >= 12) add('offer_final', from, fd - 6 * H, fd - 1 * H);
    if (!asked) {
      add('offer_expired', from, fd, fd + 2 * D);
      add('offer_closeout', from, fd + 6 * D, fd + 9 * D);
    }
  }
  if (tl.refresh?.status === 'ready') add('refresh_ready', tl.refresh.at, tl.refresh.unlockAt, tl.refresh.unlockAt + 20 * H);
  if (tl.refresh?.status === 'moved') add('refresh_moved', tl.refresh.at, tl.refresh.unlockAt, tl.refresh.unlockAt + 3 * D);
  return out;
}

// Termin. a = { id, kind, start, end, created, updated, status, replaced }, paid = depozit plaćen.
export function apptEvents(a, paid = false) {
  const out = [];
  const add = (ev, cycle, at, until) => out.push({ ev, key: `${ev}:${a.id}:${cycle}`, at, until, appt: a.id });
  const lead = a.start - a.created;
  if (a.status === 'booked') {
    add('appt_booked', a.start, a.created, a.start);
    if (a.kind === 'visit') {
      if (lead >= 84 * H) add('visit_3d', a.start, a.start - 72 * H, a.start - 48 * H);
      if (lead >= 26 * H) add('visit_24h', a.start, a.start - 24 * H, a.start - 3 * H);
      if (lead >= 150 * M) add('visit_2h', a.start, a.start - 2 * H, a.start - 30 * M);
    } else {
      if (lead >= 75 * M) add('call_1h', a.start, a.start - H, a.start - 20 * M);
      if (lead >= 15 * M) add('call_10m', a.start, a.start - 10 * M, a.start);
    }
  }
  const upd = Number(a.updated) || a.end;
  if (a.status === 'noshow') add('appt_noshow', 0, upd, upd + 2 * D);
  if (a.status === 'done' && !paid) add('appt_showed', 0, upd + 2 * H, upd + 3 * D);
  if (a.status === 'cancelled' && !a.replaced && upd < a.start) add('appt_cancelled', 0, upd, upd + D);
  return out;
}

// Preuzimanje i recenzija. o = { leadId, readyAt, pickedAt, gift, occasion (YYYY-MM-DD), remake, grillz }.
export function reviewEvents(o, st = AUTO_DEFAULTS, tz = 'UTC') {
  const out = [];
  const add = (ev, at, until) => out.push({ ev, key: `${ev}:${o.leadId}`, at, until });
  if (o.readyAt && !o.pickedAt) add('order_ready', o.readyAt, o.readyAt + 3 * D);
  if (o.pickedAt) {
    add('picked_up', o.pickedAt, o.pickedAt + 3 * D);
    // Poklon: pita se tek poslije prilike (prosidba, rođendan), da slika uz recenziju ne otkrije iznenađenje.
    let at = o.pickedAt + (o.grillz ? st.grillzReviewDays : st.reviewDays) * D;
    if (o.gift) at = o.occasion ? Math.max(at, dayStart(o.occasion, tz) + 2 * D + 12 * H) : null;
    // Otvorena prepravka (objektivan događaj) samo odgađa zahtjev; ne otkazuje ga i ne zavisi od raspoloženja kupca.
    if (at && !o.remake) add('review_request', at, at + 21 * D);
  }
  return out;
}

// Ponoć datuma u zoni radnje.
export function dayStart(ymd, tz) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return NaN;
  const guess = Date.UTC(y, m - 1, d);
  const h = localHour(guess, tz);
  const off = h > 12 ? h - 24 : h;
  return guess - off * H;
}

// Koji su događaji sada za slanje: u svom roku, u dozvoljenom satu, poslije uključenja i još neposlati.
// done(key) = true ako je već poslat (ili je u kontrolnoj grupi / pokušan 3 puta).
export function dueNow(list, { now = Date.now(), since = 0, tz = 'UTC', done = () => false } = {}) {
  return list.filter((e) => e.at != null && Number.isFinite(e.at) && e.at >= since && now >= e.at && now <= e.until && inWindow(e.ev, now, tz) && !done(e.key));
}

// ---------- Prikaz toka u portalu i tekstovi poruka (28.11.2026, tab Workflows) ----------
// Kratki nazivi koraka i kada se šalju (za dijagram). needsMkt = prodajna poruka: traži pristanak na marketinške poruke.
export const STEP_INFO = {
  quote_ready: { name: 'Quote sent', when: 'When you approve it', mkt: false },
  deposit_click: { name: 'Deposit click', when: '20 min after the click', mkt: true },
  offer_unopened: { name: 'Not opened', when: '4 h after quote', mkt: false },
  offer_saved: { name: 'Opened, no deposit', when: '4 h after quote', mkt: true },
  offer_24h: { name: '24 h left', when: '24 h before the hold ends', mkt: true },
  offer_final: { name: 'Final hours', when: '6 h before the hold ends', mkt: true },
  offer_expired: { name: 'Hold ended', when: 'When the hold ends', mkt: true },
  offer_closeout: { name: 'Closeout', when: '6 days after the hold ended', mkt: true },
  refresh_ready: { name: 'Refreshed price', when: 'When their new price unlocks', mkt: true },
  refresh_moved: { name: 'Metal moved', when: 'You send the new price', mkt: false },
  appt_booked: { name: 'Booked', when: 'Right after booking', mkt: false },
  visit_3d: { name: 'Studio visit −3 days', when: '3 days before', mkt: false },
  visit_24h: { name: 'Studio visit −24 h', when: '24 h before', mkt: false },
  visit_2h: { name: 'Studio visit −2 h', when: '2 h before', mkt: false },
  call_1h: { name: 'Consultation −1 h', when: '1 h before', mkt: false },
  call_10m: { name: 'Consultation −10 min', when: '10 min before', mkt: false },
  appt_noshow: { name: 'No-show', when: 'When marked No-show', mkt: false },
  appt_showed: { name: 'Done, no deposit', when: '2 h after marked Done', mkt: true },
  appt_cancelled: { name: 'Cancelled', when: 'When cancelled', mkt: false },
  order_ready: { name: 'Order ready', when: 'Ready for pick up', mkt: false },
  picked_up: { name: 'Picked up', when: 'When marked Picked up', mkt: false },
  review_request: { name: 'Review request', when: 'Day after pick up', mkt: false },
};
export const FLOWS = [
  { key: 'offer', title: 'Quote follow-ups', lanes: [
    { label: 'After the quote', evs: ['quote_ready', 'offer_unopened', 'offer_saved', 'offer_24h', 'offer_final', 'offer_expired', 'offer_closeout'] },
    { label: 'Along the way', evs: ['deposit_click', 'refresh_ready', 'refresh_moved'] },
  ] },
  { key: 'appts', title: 'Appointments', lanes: [
    { label: 'Studio visit', evs: ['appt_booked', 'visit_3d', 'visit_24h', 'visit_2h'] },
    { label: 'Online consultation', evs: ['appt_booked', 'call_1h', 'call_10m'] },
    { label: 'After the appointment', evs: ['appt_noshow', 'appt_showed', 'appt_cancelled'] },
  ] },
  { key: 'reviews', title: 'Pick up & review', lanes: [
    { label: 'Order to review', evs: ['order_ready', 'picked_up', 'review_request'] },
  ] },
];
// Tekstovi za SMS preko Quo-a (iz docs/ghl-workflows-en.md, sekcija 6). null = nema SMS teksta (interni / zahvala u GHL-u).
export const DEFAULT_TEMPLATES = {
  quote_ready: "Hey {first_name}, this is {sender} from {store}. Your custom {piece} design and price are ready: {page_url} Reply STOP to opt out.",
  deposit_click: "Hi {first_name}, this is {sender} from {store}. I saw you opened the deposit for your {piece}. Anything I can help with? I can hold it with a smaller deposit or set up a quick call.",
  offer_unopened: "Hey {first_name}, this is {sender} from {store}. Did you get a chance to see your {piece} design? It's here: {page_url} Reply STOP to opt out.",
  offer_saved: 'Hey {first_name}, your {piece} design is saved here: {page_url} Price held until {offer_expires}. Questions? Just reply. Reply STOP to opt out.',
  offer_24h: '{first_name}, {sender} here. Your {piece} is on hold until {offer_expires}. Want me to walk you through it on a quick 10-min call? {page_url}',
  offer_final: "Last few hours on your {piece} price. After that I re-quote at that day's gold price, which can go up or down. {page_url}",
  offer_expired: "Your price hold ended. Want today's price? Tap 'Request a refreshed quote' on your page: {page_url}",
  offer_closeout: 'Should I keep your {piece} design on file, or close it out for now? Either is totally fine. {sender}, {store}',
  refresh_ready: 'Your refreshed price is ready and held for 24 hours: {page_url}',
  refresh_moved: null,
  appt_booked: "Hey {first_name}, this is {sender} from {store}. You're booked: {appt_type}, {appt_time}. {appt_location}. Need another time? {reschedule_url} Reply STOP to opt out.",
  visit_3d: 'See you {appt_time} at the studio, {first_name}. Need another time? {reschedule_url}',
  visit_24h: 'See you tomorrow, {appt_time}. {appt_location}. Need another time? {reschedule_url}',
  visit_2h: "{sender} here. I'm pulling some pieces for you, see you at {appt_time}. {appt_location}",
  call_1h: 'Your consultation with {store} is in 1 hour ({appt_time}). {appt_location}',
  call_10m: 'Your consultation with {store} starts in 10 minutes. {appt_location}',
  appt_noshow: 'We missed you today, no worries. Want to pick another time? {reschedule_url}',
  appt_showed: "Great meeting you, {first_name}. Here's your {piece} with the price: {page_url} I'm holding it for you.",
  appt_cancelled: 'Got it, want to pick another time? {reschedule_url}',
  order_ready: 'Your {piece} is ready for pick up! Order {order_no}. Reply to set a time.',
  picked_up: null,
  review_request: "Hey {first_name}, this is {sender} from {store}. Hope you're loving the {piece}! If you have a minute, an honest Google review helps us a lot: {review_link} Reply STOP to opt out.",
};
// Ostali kanali po koraku (28.11.2026, Ognjen: "primjeri poruka, šta se kada šalje, oznake za kanale"). Mejl je predlog za
// GHL workflow (kupac bez SMS pristanka dobija mejl; GHL sam dodaje link za odjavu). task = zadatak / obavještenje za radnju.
const sig = '\n\n{sender}, {store}';
export const STEP_CONTENT = {
  quote_ready: { email: ['Your custom {piece} design from {store}', '{quote_message}'] },
  deposit_click: { email: ['Your {piece} deposit', "Hi {first_name},\n\nI saw you started the deposit for your {piece}. If anything held you up, just reply here. I can hold it with a smaller deposit or set up a quick call.\n\nYour design: {page_url}" + sig], task: 'Call or text {first_name}: opened the deposit for the {piece} and did not pay. Their page: {page_url}' },
  offer_unopened: { email: ['Your {piece} design is ready', 'Hi {first_name},\n\nYour {piece} design and price are ready: {page_url}\n\nTake a look when you have a minute. Questions? Just reply.' + sig] },
  offer_saved: { email: ['Your {piece} design is saved', 'Hi {first_name},\n\nYour {piece} design is saved here: {page_url}\n\nYour price is held until {offer_expires}. Questions? Just reply.' + sig] },
  offer_24h: { email: ['Your {piece} price is held until {offer_expires}', 'Hi {first_name},\n\nYour {piece} is on hold until {offer_expires}. Want me to walk you through it on a quick 10-minute call? Reply with a good time, or book one on your page: {page_url}' + sig] },
  offer_final: { email: ['Last hours on your {piece} price', "Hi {first_name},\n\nYour {piece} price is held until {offer_expires}. After that I re-quote at that day's gold price, which can go up or down.\n\nYour design: {page_url}" + sig] },
  offer_expired: { email: ['Your price hold ended', "Hi {first_name},\n\nThe price hold on your {piece} ended. Want today's price? Tap \"Request a refreshed quote\" on your page: {page_url}" + sig] },
  offer_closeout: { email: ['Keep your {piece} design on file?', 'Hi {first_name},\n\nShould I keep your {piece} design on file, or close it out for now? Either is totally fine, just reply.' + sig] },
  refresh_ready: { email: ['Your refreshed price is ready', 'Hi {first_name},\n\nYour refreshed price for the {piece} is ready and held for 24 hours: {page_url}' + sig] },
  refresh_moved: { task: 'Metal moved: send {first_name} a new price for the {piece}. Their page: {page_url}' },
  appt_booked: { email: ["You're booked: {appt_type}, {appt_time}", "Hi {first_name},\n\nYou're booked: {appt_type}, {appt_time}.\n{appt_location}\n\nNeed another time? {reschedule_url}" + sig] },
  visit_3d: { email: ['See you {appt_time}', 'Hi {first_name},\n\nLooking forward to seeing you at the studio, {appt_time}.\n{appt_location}\n\nNeed another time? {reschedule_url}' + sig] },
  visit_24h: { email: ['See you tomorrow at {store}', 'Hi {first_name},\n\nSee you tomorrow, {appt_time}.\n{appt_location}\n\nNeed another time? {reschedule_url}' + sig] },
  visit_2h: { email: ['See you at {appt_time}', "Hi {first_name},\n\nI'm pulling some pieces for you. See you at {appt_time}.\n{appt_location}" + sig] },
  call_1h: { email: ['Your consultation is in 1 hour', 'Hi {first_name},\n\nYour consultation with {store} is in 1 hour ({appt_time}).\n{appt_location}' + sig] },
  call_10m: { email: ['Starting in 10 minutes', 'Hi {first_name},\n\nYour consultation with {store} starts in 10 minutes.\n{appt_location}' + sig] },
  appt_noshow: { email: ['We missed you today', 'Hi {first_name},\n\nWe missed you today, no worries. Want to pick another time? {reschedule_url}' + sig] },
  appt_showed: { email: ['Your {piece}, as we discussed', "Hi {first_name},\n\nGreat meeting you. Here's your {piece} with the price: {page_url}\n\nI'm holding it for you." + sig] },
  appt_cancelled: { email: ['Want to pick another time?', 'Hi {first_name},\n\nGot it, your appointment is cancelled. Want to pick another time? {reschedule_url}' + sig] },
  order_ready: { email: ['Your {piece} is ready for pick up', 'Hi {first_name},\n\nYour {piece} is ready for pick up! Order {order_no}.\n\nReply to set a time that works for you.' + sig] },
  picked_up: { email: ['Thank you, {first_name}', 'Hi {first_name},\n\nThank you for picking up your {piece}. Enjoy it, and if it ever needs a touch-up, just reply here.' + sig] },
  review_request: { email: ["How's your {piece}?", "Hi {first_name},\n\nHope you're loving the {piece}! If you have a minute, an honest Google review helps us a lot: {review_link}" + sig] },
};
// Kad poruka smije izaći (po kupčevom satu); podsjetnici za termin idu tačno na vrijeme.
export function sendWindow(ev) {
  const w = WINDOW[ev];
  return w === 'day' ? "10 am to 7 pm, customer's time" : w === 'wide' ? "9 am to 9 pm, customer's time" : ev === 'refresh_moved' ? 'Right away' : 'Exactly on time';
}
export const TEMPLATE_VARS = ['first_name', 'piece', 'page_url', 'price', 'offer_expires', 'appt_type', 'appt_time', 'appt_location', 'meet_link', 'reschedule_url', 'order_no', 'store', 'review_link', 'sender', 'quote_message'];
// Zamjena {var}; nepoznata promjenljiva ostaje, prazna vrijednost nestaje a razmaci se sređuju.
export function renderTemplate(tpl, vars) {
  let t = String(tpl || '').replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m));
  t = t.replace(/[ \t]+/g, ' ').replace(/ ([.,!?])/g, '$1').replace(/\.\s*\./g, '.').trim();
  // Ime pošiljaoca isto kao ime radnje: "this is District from District" -> "this is District".
  // Potpis "{sender}, {store}" kad je ime pošiljaoca isto kao radnja: samo jednom.
  const st = String(vars.store || '').trim();
  if (st && String(vars.sender || '').trim() === st) t = t.split(`${st}, ${st}`).join(st);
  return t.replace(/\b(it's|It's|this is|This is) (.{1,80}?) from \2(?=$|[\s.,!?])/, '$1 $2').trim();
}
export const exampleVars = (store = 'Your Store') => ({
  first_name: 'Ava', piece: 'grillz', page_url: 'https://jewelrylead.com/p/abc123', price: '$1,850', offer_expires: 'Mon, Dec 1, 5:00 PM', appt_type: 'Studio visit',
  appt_time: 'Tue, Dec 2, 11:00 AM', appt_location: '1550 Larimer St, Denver', meet_link: '', reschedule_url: 'https://jewelrylead.com/p/abc123#appts', order_no: 'DJ-7K4Q9',
  store, review_link: 'https://g.page/r/your-review-link', sender: store,
  quote_message: `Hey Ava, your custom grillz design and price are ready.\n\nSee your design and quote: https://jewelrylead.com/p/abc123\n\n${store}`,
});
