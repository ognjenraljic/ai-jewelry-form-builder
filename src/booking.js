// Kalendar na stranici kupca i koraci poslije depozita (District 25.11.2026: "Sales page add calendar scheduling for an
// online consultation - Book an appointment, 5-10 minute call to evaluate everything the lead provided and close the sale";
// "deposits online through GHL, then a workflow on the deposit: are they in Colorado, store visit, or ship the mold / product").
//
// Termini se računaju iz radnog vremena koje zlatar upiše u portalu (Bookings → Calendar), u vremenskoj zoni radnje.
// Kad je GoHighLevel kalendar izabran za tu vrstu termina, slobodna mjesta daje GHL (njegova dostupnost, tim, Google
// sync), a termin se upisuje i tamo. Sve funkcije ovdje su čiste (bez baze i mreže), da se mogu provjeriti same.

export const KINDS = ['online', 'visit'];
export const KIND_LABEL = { online: 'Online consultation', visit: 'Studio visit' };
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const TIMEZONES = [
  ['America/New_York', 'Eastern Time (New York)'], ['America/Chicago', 'Central Time (Chicago)'], ['America/Denver', 'Mountain Time (Denver)'],
  ['America/Phoenix', 'Arizona Time (Phoenix)'], ['America/Los_Angeles', 'Pacific Time (Los Angeles)'], ['America/Anchorage', 'Alaska Time'],
  ['Pacific/Honolulu', 'Hawaii Time'], ['America/Toronto', 'Eastern Time (Toronto)'], ['Europe/London', 'UK Time (London)'],
];
const TZ_SET = new Set(TIMEZONES.map(([k]) => k));
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const clampInt = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };

export const BOOKING_DEFAULTS = {
  enabled: false,
  tz: 'America/Denver',
  kinds: { online: { on: true, minutes: 10, video: '' }, visit: { on: true, minutes: 30 } },
  hours: { sun: null, mon: ['10:00', '18:00'], tue: ['10:00', '18:00'], wed: ['10:00', '18:00'], thu: ['10:00', '18:00'], fri: ['10:00', '18:00'], sat: ['10:00', '17:00'] },
  closed: [],      // dani kad radnja ne radi (YYYY-MM-DD)
  step: 15,        // razmak između početaka termina, minuta
  buffer: 5,       // pauza između dva termina, minuta
  notice: 2,       // najranije za koliko sati od sada
  days: 14,        // koliko dana unaprijed
  region: '',      // "Are you in <region>?" poslije depozita (npr. Colorado); prazno = "near the studio"
  moldKit: true,   // grillz van regije: kit za otisak poštom
};

function httpsOrEmpty(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' && s.length <= 400 ? u.href : ''; } catch { return ''; }
}

// Podešavanje iz portala -> sačuvano podešavanje (sve van dozvoljenog se odbacuje ili vraća na podrazumijevano).
export function cleanBooking(input, cur = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const base = bookingSettings(cur);
  const out = { ...base };
  if ('enabled' in b) out.enabled = b.enabled === true;
  if ('tz' in b && TZ_SET.has(b.tz)) out.tz = b.tz;
  if (b.kinds && typeof b.kinds === 'object') {
    const k = b.kinds;
    out.kinds = {
      online: { on: k.online?.on !== false, minutes: clampInt(k.online?.minutes, 5, 60, base.kinds.online.minutes), video: 'video' in (k.online || {}) ? httpsOrEmpty(k.online.video) : base.kinds.online.video,
        meet: 'meet' in (k.online || {}) ? k.online.meet === true : base.kinds.online.meet },
      visit: { on: k.visit?.on !== false, minutes: clampInt(k.visit?.minutes, 10, 120, base.kinds.visit.minutes) },
    };
  }
  if (b.hours && typeof b.hours === 'object') {
    out.hours = Object.fromEntries(DAY_KEYS.map((d) => {
      const r = b.hours[d];
      return [d, Array.isArray(r) && HM.test(r[0]) && HM.test(r[1]) && r[0] < r[1] ? [r[0], r[1]] : null];
    }));
  }
  if (Array.isArray(b.closed)) out.closed = [...new Set(b.closed.map((x) => String(x).trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)))].sort().slice(-60);
  if ('step' in b) out.step = [5, 10, 15, 20, 30, 60].includes(Number(b.step)) ? Number(b.step) : base.step;
  if ('buffer' in b) out.buffer = clampInt(b.buffer, 0, 60, base.buffer);
  if ('notice' in b) out.notice = clampInt(b.notice, 0, 72, base.notice);
  if ('days' in b) out.days = clampInt(b.days, 1, 60, base.days);
  if ('region' in b) out.region = String(b.region ?? '').replace(/[^\p{L} .'-]/gu, '').trim().slice(0, 30);
  if ('moldKit' in b) out.moldKit = b.moldKit !== false;
  return out;
}
// Sačuvano (ili ništa) -> potpuno podešavanje sa podrazumijevanim vrijednostima.
export function bookingSettings(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const d = BOOKING_DEFAULTS;
  return {
    enabled: s.enabled === true,
    tz: TZ_SET.has(s.tz) ? s.tz : d.tz,
    kinds: {
      online: { on: s.kinds?.online?.on !== false, minutes: clampInt(s.kinds?.online?.minutes, 5, 60, d.kinds.online.minutes), video: httpsOrEmpty(s.kinds?.online?.video), meet: s.kinds?.online?.meet === true },
      visit: { on: s.kinds?.visit?.on !== false, minutes: clampInt(s.kinds?.visit?.minutes, 10, 120, d.kinds.visit.minutes) },
    },
    hours: s.hours && typeof s.hours === 'object' ? Object.fromEntries(DAY_KEYS.map((k) => [k, Array.isArray(s.hours[k]) ? s.hours[k] : null])) : { ...d.hours },
    closed: Array.isArray(s.closed) ? s.closed : [],
    step: [5, 10, 15, 20, 30, 60].includes(Number(s.step)) ? Number(s.step) : d.step,
    buffer: clampInt(s.buffer, 0, 60, d.buffer),
    notice: clampInt(s.notice, 0, 72, d.notice),
    days: clampInt(s.days, 1, 60, d.days),
    region: typeof s.region === 'string' ? s.region : d.region,
    moldKit: s.moldKit !== false,
  };
}
export const kindsOn = (cfg) => (cfg?.enabled ? KINDS.filter((k) => cfg.kinds?.[k]?.on) : []);

// ---------- Vremenske zone bez biblioteka (Intl) ----------
const dtfCache = new Map();
function dtf(tz) {
  if (!dtfCache.has(tz)) dtfCache.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  return dtfCache.get(tz);
}
function parts(ms, tz) {
  return Object.fromEntries(dtf(tz).formatToParts(new Date(ms)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
}
// Koliko je zona ispred UTC-a u tom trenutku (ms).
export function tzOffset(ms, tz) {
  const p = parts(ms, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}
// Datum i sat u zoni radnje -> UTC ms (i oko prelaska na ljetno vrijeme).
export function zonedToUtc(ymd, hm, tz) {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - tzOffset(guess, tz);
  return guess - tzOffset(first, tz);
}
export function zonedYmd(ms, tz) {
  const p = parts(ms, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const weekday = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

// Slobodni termini iz radnog vremena: busy = [{ start, end }] već zakazani termini radnje (bilo koje vrste).
export function nativeSlots(cfg, kind, busy, now = Date.now()) {
  const k = cfg.kinds[kind];
  const dur = k.minutes * 60_000;
  const step = cfg.step * 60_000;
  const buf = cfg.buffer * 60_000;
  const earliest = now + cfg.notice * 3600_000;
  const today = zonedYmd(now, cfg.tz);
  const days = [];
  for (let i = 0; i < cfg.days; i++) {
    const ymd = addDays(today, i);
    const range = cfg.closed.includes(ymd) ? null : cfg.hours[DAY_KEYS[weekday(ymd)]];
    const slots = [];
    if (range) {
      const open = zonedToUtc(ymd, range[0], cfg.tz);
      const close = zonedToUtc(ymd, range[1], cfg.tz);
      for (let t = open; t + dur <= close; t += step) {
        if (t < earliest) continue;
        if (busy.some((b) => t < b.end + buf && t + dur + buf > b.start)) continue;
        slots.push(t);
      }
    }
    days.push({ date: ymd, slots });
  }
  return days;
}

// GHL free-slots odgovor ({ "2026-11-28": { slots: ["2026-11-28T10:00:00-07:00", ...] }, traceId }) -> isti oblik.
export function ghlSlotsToDays(data, cfg, now = Date.now()) {
  const earliest = now + cfg.notice * 3600_000;
  const today = zonedYmd(now, cfg.tz);
  const byDay = new Map();
  for (const [key, v] of Object.entries(data || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(v?.slots)) continue;
    for (const s of v.slots) {
      const t = Date.parse(s);
      if (!Number.isFinite(t) || t < earliest) continue;
      const ymd = zonedYmd(t, cfg.tz);
      if (!byDay.has(ymd)) byDay.set(ymd, []);
      byDay.get(ymd).push(t);
    }
  }
  return Array.from({ length: cfg.days }, (_, i) => {
    const ymd = addDays(today, i);
    return { date: ymd, slots: [...new Set(byDay.get(ymd) || [])].sort((a, b) => a - b) };
  });
}

// Lijep zapis vremena u zoni radnje: "Fri, Nov 28 · 10:15 AM MST".
export function whenText(ms, tz) {
  const date = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(ms));
  const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(ms));
  return `${date} · ${time}`;
}

// Termin za kalendar kupca (.ics), bez ličnih podataka osim imena radnje.
const icsDate = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
export function icsFor(appt, store) {
  const title = appt.kind === 'online' ? `${KIND_LABEL.online} with ${store.name}` : `${KIND_LABEL.visit} at ${store.name}`;
  const desc = appt.kind === 'online'
    ? (appt.via === 'video' && appt.video ? `Video call: ${appt.video}` : `${store.name} will call you at this time.`)
    : (store.info || store.name);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JewelryLead//Appointments//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${appt.id}@jewelrylead.com`, `DTSTAMP:${icsDate(Date.now())}`, `DTSTART:${icsDate(appt.start)}`, `DTEND:${icsDate(appt.end)}`,
    `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(desc)}`,
    ...(appt.kind === 'visit' && store.address ? [`LOCATION:${icsText(store.address)}`] : appt.via === 'video' && appt.video ? [`URL:${appt.video}`] : []),
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

// ---------- Poslije depozita: kako kupac dobija komad ----------
// local: u regiji radnje (npr. Colorado); method: 'visit' (dolazi u radnju) | 'ship' (šaljemo); kit: grillz otisak poštom.
const US_STATE = /^[A-Za-z .]{2,30}$/;
export function cleanFulfillment(b, { grillz = false, moldKit = true } = {}) {
  if (!b || typeof b !== 'object') return { error: 'Missing answers.' };
  const local = b.local === true ? true : b.local === false ? false : null;
  if (local == null) return { error: 'Tell us if you are near the studio.' };
  let method = ['visit', 'ship'].includes(b.method) ? b.method : null;
  if (!local) method = 'ship';
  if (!method) return { error: 'Choose how you want to receive your piece.' };
  const kit = grillz && method === 'ship' && moldKit;
  const out = { local, method, kit, note: String(b.note ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500), at: Date.now() };
  if (method === 'ship') {
    const a = b.address && typeof b.address === 'object' ? b.address : {};
    const s = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
    const addr = { line1: s(a.line1, 120), line2: s(a.line2, 80), city: s(a.city, 60), state: s(a.state, 30), zip: s(a.zip, 12) };
    if (!addr.line1 || !addr.city || !US_STATE.test(addr.state) || !/^[A-Za-z0-9 -]{3,12}$/.test(addr.zip)) return { error: 'Add the full shipping address: street, city, state and ZIP code.' };
    out.address = addr;
  }
  return out;
}
export function fulfillmentText(f, { grillz = false, region = '' } = {}) {
  if (!f) return '';
  const where = f.local ? `In ${region || 'the area'}` : `Outside ${region || 'the area'}`;
  const how = f.method === 'visit' ? (grillz ? 'Comes to the studio for the mold' : 'Picks it up at the studio') : f.kit ? 'Ship a mold kit, then ship the finished grillz' : 'Ship the finished piece';
  const addr = f.address ? [f.address.line1, f.address.line2, `${f.address.city}, ${f.address.state} ${f.address.zip}`].filter(Boolean).join(', ') : '';
  return [where, how, addr ? `Ship to: ${addr}` : '', f.note ? `Note: ${f.note}` : ''].filter(Boolean).join(' · ');
}

// Link za depozit (GHL payment link / Stripe): ime, mejl i telefon kupca unaprijed upisani, ID leada uz uplatu.
export function depositLink(url, lead) {
  let u;
  try { u = new URL(url); } catch { return url; }
  const [first, ...rest] = String(lead.name || '').trim().split(/\s+/);
  if (/(^|\.)stripe\.com$/i.test(u.hostname)) {
    if (lead.email) u.searchParams.set('prefilled_email', lead.email);
    if (lead.ref) u.searchParams.set('client_reference_id', lead.ref);
    return u.href;
  }
  const set = (k, v) => { if (v && !u.searchParams.has(k)) u.searchParams.set(k, v); };
  set('first_name', first);
  set('last_name', rest.join(' '));
  set('email', lead.email);
  set('phone', lead.phone);
  return u.href;
}
