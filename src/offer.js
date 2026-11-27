// Tok ponude na stranici kupca (District, 27.11.2026, Ognjenova skica):
//   1. Ponuda važi 48 h od zadnje poslate ponude.
//   1a. Ako je cijena daleko iznad budžeta, opcija u budžetu stoji zamućena ("we might have something cooking for you")
//       i otkriva se sama poslije 8 h.
//   2. 24 h prije kraja: žuto (podsjetnik). 3. 12 h prije kraja: crveno. 4. Zadnjih 60 minuta.
//   Istekla ponuda: ponude zaključane, kupac traži osvježenu ponudu; ona se otključa za 12 h ako se cijena metala nije
//   bitno pomjerila i važi samo 24 h (uz opcioni popust da se posao zatvori). Ako se metal pomjerio, zlatar šalje novu.
// Sve vrijednosti se mijenjaju u Pricing → Quote & alerts (pricing.offer, ključevi malim slovima zbog cleanPricing).
export const OFFER_DEFAULTS = { reveal: 8, far: 1.5, autoreveal: 1, refreshwait: 12, refreshhours: 24, metalmove: 3, discount: 0 };
const H = 3600_000;

export function offerSettings(pricing) {
  const o = { ...OFFER_DEFAULTS, ...(pricing?.offer || {}) };
  const hoursRaw = pricing?.offerHours;
  const hours = hoursRaw != null && hoursRaw !== '' && Number.isFinite(Number(hoursRaw)) ? Number(hoursRaw) : 48;
  return { ...o, hours };
}

// Faza odbrojavanja: pragovi se skraćuju za kraće ponude (osvježena ponuda od 24 h: žuto na 12 h, crveno na 6 h).
export function stageThresholds(hours) {
  return { yellow: Math.min(24, hours / 2) * H, red: Math.min(12, hours / 4) * H, last: Math.min(1, hours / 8) * H };
}
export function offerStage(left, hours) {
  const t = stageThresholds(hours);
  if (left <= 0) return 'expired';
  if (left <= t.last) return 'last';
  if (left <= t.red) return 'red';
  if (left <= t.yellow) return 'yellow';
  return 'fresh';
}
export const STAGE_TEXT = {
  fresh: (h) => [`Reserved for you for ${h} hours`, 'Your price and design are held until the timer ends. After that we re-quote at that day\'s metal price, which can go up or down.'],
  yellow: (h) => [h > 24 ? 'Less than 24 hours left' : 'Less than half of your time left', 'Reserve now to keep this price.'],
  red: (h) => [h > 24 ? 'Final 12 hours on your price' : 'Final hours on your price', 'When the timer ends, we re-quote at that day\'s metal price.'],
  last: () => ['Last hour to keep this price', 'Reserve now, before the timer runs out.'],
  expired: () => ['This offer has expired', 'Request a refreshed quote below.'],
};

// Stanje ponude u trenutku "now": rok, faza, osvježena ponuda. quotes.refresh = { at, spot, status, readyAt }.
// Nova poruka zlatara (quotes.picked.at poslije zahtjeva) poništava stari zahtjev: kreće nova ponuda od 48 h.
export function offerTimeline(d, now = Date.now()) {
  const s = offerSettings(d.pricing);
  const q = d.quotes || {};
  const from = Math.max(Number(q.picked?.at) || 0, q.fit?.show ? Number(q.fit.showAt || q.fit.at) || 0 : 0) || Number(d.lead?.createdAt) || now;
  const r = q.refresh && Number(q.refresh.at) > from ? q.refresh : null;
  let hours = s.hours;
  let start = from;
  let refresh = null;
  if (r) {
    const unlockAt = Number(r.at) + s.refreshwait * H;
    if (r.status === 'ready' || (r.status === 'pending' && now >= unlockAt && r.moved === false)) {
      start = Number(r.readyAt) || unlockAt;
      hours = s.refreshhours;
      refresh = { status: 'ready', at: Number(r.at), unlockAt, discount: Number(s.discount) || 0 };
    } else if (r.status === 'moved' || (r.status === 'pending' && now >= unlockAt && r.moved === true)) {
      refresh = { status: 'moved', at: Number(r.at), unlockAt };
    } else {
      refresh = { status: 'pending', at: Number(r.at), unlockAt };
    }
  }
  const deadline = hours > 0 ? start + hours * H : 0;
  const left = deadline ? deadline - now : Infinity;
  let stage = deadline ? offerStage(left, hours) : 'none';
  if (refresh && refresh.status !== 'ready') stage = refresh.status === 'pending' ? 'requested' : 'moved';
  return { settings: s, from, start, hours, deadline, left, stage, refresh, now, locked: ['expired', 'requested', 'moved'].includes(stage) };
}

// Opcija u budžetu (1a): kad je cijena daleko iznad gornje granice budžeta, a zlatar je nije sam pokazao.
export function farOverBudget(total, budgetHigh, s) {
  return Number.isFinite(budgetHigh) && budgetHigh > 0 && total > budgetHigh * (Number(s.far) || OFFER_DEFAULTS.far);
}
export const revealAt = (tl) => tl.from + (Number(tl.settings.reveal) || 0) * H;

// Da li je cijena metala ostala u granici od zahtjeva do otključavanja (procenat promjene zlata).
export function metalMoved(spotAtRequest, spotNow, s) {
  if (!(spotAtRequest > 0) || !(spotNow > 0)) return false;
  return (Math.abs(spotNow - spotAtRequest) / spotAtRequest) * 100 > (Number(s.metalmove) || OFFER_DEFAULTS.metalmove);
}
