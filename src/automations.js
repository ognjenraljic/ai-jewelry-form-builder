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

export const AUTO_DEFAULTS = { on: false, offer: true, appts: true, reviews: true, holdout: 10, reviewDays: 1, grillzReviewDays: 3 };

// Događaj -> [tag u GHL-u, grupa, kada (za portal i uputstvo)]. Imena tagova se ne mijenjaju: na njih su vezani workflowi.
export const EVENTS = {
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
  ['jl_occasion_date', 'JL Occasion Date'],
];

export function autoSettings(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const int = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);
  return {
    on: a.on === true, since: Number(a.since) || 0, offer: a.offer !== false, appts: a.appts !== false, reviews: a.reviews !== false,
    holdout: [0, 10, 20].includes(Number(a.holdout)) ? Number(a.holdout) : AUTO_DEFAULTS.holdout,
    reviewDays: int(a.reviewDays, 0, 14, AUTO_DEFAULTS.reviewDays), grillzReviewDays: int(a.grillzReviewDays, 0, 14, AUTO_DEFAULTS.grillzReviewDays),
  };
}

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
