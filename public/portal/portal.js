import { createLeadStore } from './leads.js';
import { estimate, stoneLayout, applyMarket, isLive, MARKET_METALS, middleGround, LEVELS, PIECES, SUGGESTED_PRICING, GRILLZ_COLS, ICED_COLS, key as pkey, money, leadSpecFrom, isGold, isDental, rowsOf, coverLabel, specDiff, quoteBody, iceKey, iceFields } from '/pricing.js';
import { artFor, optionArt, styleArt } from '/option-art.js';
import { onboardingProblems } from '/onboarding-check.js';
import { SUGGESTED, suggestOptions } from '/option-suggestions.js';

// Portal klijenta: njegovi upiti, aktivne forme i odvojeni onboarding.
// Prijava: link klijenta (/portal#k=...) ili admin pregled (/portal#v=...) se jednom zamijeni za HttpOnly kolačić
// i odmah obriše iz adrese. Token se više ne čuva u browseru niti ide u adrese slika.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (fn) => { try { return fn(); } catch { return null; } };

const STATUSES = [['new', 'New'], ['contacted', 'Contacted'], ['quoted', 'Quoted'], ['won', 'Won'], ['lost', 'Lost']];
const P = { me: null, bookings: null, leads: [], tab: 'leads', form: '', piece: '', pieces: {}, video: '', videoModels: [], status: '', q: '', next: null, counts: {}, days: {}, day: '', range: 'last14', shift: 0, loadingMore: false, loading: false, loadError: '', onboardingFlow: false };
const day = (t) => new Date(t).toLocaleDateString('en-US', { dateStyle: 'medium' });
// Dan upita u zoni pregledača (isto kao server sa ?tz=), da zlatar prati koliko mu dolazi dnevno.
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const keyDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const dayTitle = (k) => {
  const today = dayKey(Date.now());
  const yest = dayKey(Date.now() - 864e5);
  const name = keyDate(k).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return k === today ? `Today · ${name}` : k === yest ? `Yesterday · ${name}` : name;
};
// Broj po danu: sa servera dok nisu učitani svi upiti, inače iz liste (tada važe i filteri bez servera).
function dayCounts(list) {
  if (P.next || P.day || Object.keys(P.days || {}).length) return Object.fromEntries(Object.entries(P.days || {}).map(([k, byForm]) => [k, Object.entries(byForm).reduce((n, [fid, c]) => n + (!P.form || P.form === fid ? c : 0), 0)]));
  const out = {};
  for (const l of list) { const k = dayKey(l.created_at); out[k] = (out[k] || 0) + 1; }
  return out;
}
// Period trake: zadnjih 14 dana, ova sedmica (pon-ned) ili ovaj mjesec; stubci su uvijek dani (Ognjen 16.11).
const RANGES = [['last14', 'Last 14 days'], ['week', 'This week'], ['month', 'This month']];
// P.shift: koliko perioda unazad (strelice lijevo/desno: okt, nov, dec...); 0 = sadašnji.
function rangeKeys(range, shift = P.shift) {
  const now = new Date();
  if (range === 'week') {
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - 7 * shift);
    return Array.from({ length: 7 }, (_, i) => dayKey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)));
  }
  if (range === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth() - shift, 1);
    const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => dayKey(new Date(first.getFullYear(), first.getMonth(), i + 1)));
  }
  return Array.from({ length: 14 }, (_, i) => dayKey(Date.now() - (13 - i + 14 * shift) * 864e5));
}
// Početak prikazanog perioda (ms) kad je stariji od 90 dana: server tad šalje dane i za njega.
const rangeFrom = () => { const k = rangeKeys(P.range)[0]; const t = keyDate(k).getTime(); return t < Date.now() - 85 * 864e5 ? String(t) : ''; };
function rangeTitle(keys) {
  const a = keyDate(keys[0]);
  const b = keyDate(keys[keys.length - 1]);
  if (P.range === 'month') return a.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const f = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(a)} – ${f(b)}${b.getFullYear() !== new Date().getFullYear() ? `, ${b.getFullYear()}` : ''}`;
}
function daysChart(counts) {
  const keys = rangeKeys(P.range);
  const today = dayKey(Date.now());
  const max = Math.max(1, ...keys.map((k) => counts[k] || 0));
  const total = keys.reduce((n, k) => n + (counts[k] || 0), 0);
  const label = P.shift ? `in ${rangeTitle(keys)}` : RANGES.find(([v]) => v === P.range)?.[1].toLowerCase() || 'last 14 days';
  const nav = `<div class="dnav"><button type="button" class="dnav-btn" data-shift="1" aria-label="Previous period">‹</button><span class="dnav-title">${esc(rangeTitle(keys))}</span><button type="button" class="dnav-btn" data-shift="-1" aria-label="Next period" ${P.shift ? '' : 'disabled'}>›</button></div>`;
  const many = keys.length > 14;
  // Klik na dan prikazuje samo leadove tog dana (District 16.11: umjesto beskonačnog skrolanja); stariji dan iz kalendara.
  return `<div class="days14 ${many ? 'many' : ''}" aria-label="Leads per day, ${esc(label)}"><div class="days14-head"><span>Leads per day · tap a day to see only its leads</span><span class="drange" role="group" aria-label="Period">${RANGES.map(([v, l]) => `<button type="button" class="chip ${P.range === v ? 'on' : ''}" data-range="${v}" aria-pressed="${P.range === v}">${l}</button>`).join('')}</span><b>${total} ${esc(label)}</b></div>${nav}<div class="days14-bars" style="--n:${keys.length}">${keys.map((k) => {
    const n = counts[k] || 0;
    const d = keyDate(k);
    const future = k > today;
    return `<button type="button" class="dbar ${n ? '' : 'zero'} ${P.day === k ? 'on' : ''} ${future ? 'future' : ''}" data-day="${k}" aria-pressed="${P.day === k}" ${future ? 'disabled' : ''} title="${esc(dayTitle(k))}: ${n} lead${n === 1 ? '' : 's'}"><b>${n || ''}</b><i style="height:${Math.round((n / max) * 100)}%"></i><span>${many ? '' : `${esc(d.toLocaleDateString('en-US', { weekday: 'narrow' }))}<br />`}${d.getDate()}</span></button>`;
  }).join('')}</div><div class="days14-foot"><label class="dpick"><span>Another day</span><input class="in" type="date" data-pick-day value="${esc(P.day)}" max="${today}" /></label>${P.day ? `<span class="day-on">Showing <b>${esc(dayTitle(P.day))}</b></span><button type="button" class="chip" data-act="all-days">All days</button>` : ''}</div></div>`;
}

// Koliko se generisalo: ikonica sata i sekunde (slika iz renders.ms, video koliko je Pika radila).
const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const secs = (ms) => (ms > 0 ? `${(ms / 1000).toFixed(ms < 60_000 ? 1 : 0)} s` : '–');
const genTime = (ms, what = 'Made in') => (ms > 0 ? `<span class="gen" title="${what} ${secs(ms)}">${CLOCK}${secs(ms)}</span>` : '');

// ---------- Kalkulator cijene (desno od leada) ----------
// Lijevo: procjena za ono što je kupac izabrao. Desno: "Fits the budget" kao radni sto zlatara (18.11.2026):
// polazi od prijedloga u budžet, zlatar mijenja metal, karat, led, kamen, čistoću, rez i broj zuba, cijena se
// odmah preračunava, pa "Generate quote message" piše poruku za kupca (Cloudflare Workers AI) sa konačnim izborima.
function leadSpec(l) {
  return leadSpecFrom(P.me.formSpecs?.[l.formId], l.answers || {});
}
// Broj zuba u redu: zadržava kupčeve zube kad se broj ne mijenja, inače centrirano (5 i 6 su srednji).
const rowIds = (k, n, keep) => (keep.length === n ? keep : Array.from({ length: n }, (_, i) => `${k}${6 - Math.ceil(n / 2) + i}`));

// Stanje quote radnog stola po ključu: `${id}` = Fits the budget, `${id}|p` = Estimated price.
// Od 22.11.2026 obje ponude se podešavaju (izbori + konačna cijena sliderom) i to se čuva uz lead, pa stranica kupca
// pokazuje tačno ono što je zlatar namjestio.
const Q = {};
// Cijene za račun: zlatareve + žive cijene metala gdje je Live (22.11.2026).
const PR = () => applyMarket(P.me.pricing, P.me.market);
const qkLead = (key) => String(key).split('|')[0];
const slotOf = (key) => (String(key).endsWith('|p') ? 'picked' : 'fit');
const sigOf = (q) => JSON.stringify([q.spec, q.price ?? null]);
// Konačna cijena: zlatarova (slider ili upis) ili iz cjenovnika.
const finalTotal = (q, est) => (q.price != null ? q.price : est.total);
function quoteState(l, ls, key) {
  const q = (Q[key] ||= {});
  if (!q.spec) {
    const slot = slotOf(key);
    if (slot === 'picked') q.suggested = { ...ls.spec };
    else {
      const high = ls.budget?.high;
      const mg = Number.isFinite(high) && P.me.pricing ? middleGround(PR(), ls.spec, high, ls.choices) : null;
      q.suggested = { ...(mg?.spec || ls.spec) };
    }
    // Sačuvano (19.11 poruka, 22.11 izbori i cijena): radni sto se vraća na ono što je zlatar ostavio.
    const saved = l.quotes?.[slot];
    q.spec = saved?.spec && saved.spec.type === ls.spec.type ? { ...ls.spec, ...saved.spec } : { ...q.suggested };
    q.price = saved?.price ?? null;
    restoreQuote(q, saved);
  }
  return q;
}
// Poruka iz baze ide u stanje samo jednom (dok se stranica ne osvježi važi ono što je u polju).
function restoreQuote(q, saved) {
  if (q.restored) return;
  q.restored = true;
  if (!saved?.msg || q.msg != null) return;
  Object.assign(q, { msg: saved.msg, source: saved.source, edited: saved.edited, savedAt: saved.at, msgFor: saved.msgFor || sigOf(q) });
}
// Traka budžeta: raspon kupca osjenčen, tačka je cijena (ispred raspona = ispod, iza = preko).
function budgetMeter(total, b, label) {
  if (!b || total == null) return '';
  const top = Number.isFinite(b.high) ? b.high : b.low * 1.6;
  const max = Math.max(top * 1.25, total * 1.08, 1);
  const pct = (v) => Math.max(0, Math.min(100, (v / max) * 100));
  const over = Number.isFinite(b.high) && total > b.high;
  const under = total < b.low;
  const note = over ? `${money(total - b.high)} over` : under ? `${money(b.low - total)} under` : 'In budget';
  return `<div class="bm ${over ? 'is-over' : under ? 'is-under' : 'is-in'}" role="img" aria-label="Price ${money(total)}, budget ${esc(label)}: ${note}">
    <div class="bm-track"><span class="bm-band" style="left:${pct(b.low)}%;width:${Math.max(2, (Number.isFinite(b.high) ? pct(b.high) : 100) - pct(b.low))}%"></span><span class="bm-dot" style="left:${pct(total)}%"></span></div>
    <div class="bm-legend"><span>Budget ${esc(label)}</span><b>${note}</b></div></div>`;
}
// Razrada cijene; zlatarova korekcija je zaseban red, pa zbir uvijek odgovara konačnoj cijeni.
function adjusted(est, q) {
  if (est.total == null || q.price == null || Math.round(q.price) === Math.round(est.total)) return est;
  return { ...est, lines: [...est.lines, { label: 'Your price adjustment', amount: q.price - est.total }], total: q.price };
}
const breakdown = (est, open = false) => `<details class="calc-more" ${open ? 'open' : ''}><summary>How it's priced</summary><ul class="calc-lines">${est.lines.map((x) => `<li><span>${esc(x.label)}</span><b>${x.amount < 0 ? '−' : ''}${money(Math.abs(x.amount))}</b></li>`).join('')}</ul>${(est.notes || []).length ? `<ul class="calc-notes">${est.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</details>`;

// Konačna cijena: broj koji se upiše ili slider od pola do 1,6 x izračunate (korak $10 / $25 / $50 po veličini).
const priceStep = (v) => (v < 2000 ? 10 : v < 10000 ? 25 : 50);
function priceRange(calc, fin) {
  const step = priceStep(calc);
  const lo = Math.max(step, Math.floor(Math.min(calc * 0.5, fin) / step) * step);
  const hi = Math.ceil(Math.max(calc * 1.6, fin) / step) * step;
  return { step, lo, hi };
}
function priceFoot(calc, fin, q) {
  const diff = fin - calc;
  return `<span>${diff ? `Calculated ${money(calc)} · ${diff > 0 ? '+' : '−'}${money(Math.abs(diff))}` : q.price != null ? 'Locked at this price' : 'Calculated from your price list'}</span>${q.price != null ? '<button type="button" class="qlink" data-act="price-reset">Use calculated</button>' : ''}`;
}
function priceControl(key, q, est) {
  if (est.total == null) return '';
  const calc = Math.round(est.total);
  const fin = Math.round(finalTotal(q, est));
  const { step, lo, hi } = priceRange(calc, fin);
  const pct = ((fin - lo) / Math.max(1, hi - lo)) * 100;
  return `<div class="qprice" data-qk="${esc(key)}">
    <div class="qprice-top"><span class="qf-l">Your price</span><label class="qprice-in"><span aria-hidden="true">$</span><input type="number" inputmode="numeric" min="1" max="5000000" step="1" value="${fin}" data-qprice="${esc(key)}" aria-label="Final price in dollars" /></label></div>
    <input type="range" class="qrange" min="${lo}" max="${hi}" step="${step}" value="${fin}" data-qrange="${esc(key)}" style="--p:${pct.toFixed(2)}%" aria-label="Adjust the final price" />
    <div class="qprice-foot">${priceFoot(calc, fin, q)}</div></div>`;
}

// Izbori kao čipovi; mnogo opcija (metali, rezovi) ide u padajuću listu (stakleni meni ispod polja, glass-select.js).
function qChips(key, field, label, options, cur) {
  if (!options.length) return '';
  if (options.length > 6) return `<label class="qf"><span class="qf-l">${label}</span><select class="in qsel" data-q="${esc(key)}" data-qf="${field}">${options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  return `<div class="qf" role="group" aria-label="${esc(label)}"><span class="qf-l">${label}</span><div class="qchips">${options.map(([v, t]) => `<button type="button" class="qchip ${String(v) === String(cur) ? 'on' : ''}" aria-pressed="${String(v) === String(cur)}" data-q="${esc(key)}" data-qf="${field}" data-qv="${esc(v)}">${esc(t)}</button>`).join('')}</div></div>`;
}
function qStepper(key, field, label, n) {
  return `<div class="qf qstep"><span class="qf-l">${label}</span><div class="qstepper"><button type="button" data-q="${esc(key)}" data-qf="${field}" data-qd="-1" ${n ? '' : 'disabled'} aria-label="Fewer ${label.toLowerCase()} teeth">&minus;</button><b aria-live="polite">${n}</b><button type="button" data-q="${esc(key)}" data-qf="${field}" data-qd="1" ${n < 10 ? '' : 'disabled'} aria-label="More ${label.toLowerCase()} teeth">+</button></div></div>`;
}

function quoteControls(key, ls, spec) {
  const metals = ls.choices.metals.map((m) => [m, m]);
  const karats = ls.choices.karats.filter((k) => !/silver|925/i.test(k)).map((k) => [k, k]);
  const iceOpts = [['', 'Not iced'], ...ls.opts.coverage];
  const stones = ls.choices.stones.map((x) => [x, x]);
  const clar = ls.opts.clarity.map((x) => [x, x]);
  const cuts = ls.opts.cut.map((x) => [x, x]);
  const grillz = spec.type === 'grillz';
  const r = rowsOf(spec.teeth);
  return `<div class="qgrid">
    ${qChips(key, 'metal', 'Metal', metals, spec.metal)}
    ${isGold(spec.metal) ? qChips(key, 'karat', 'Karat', karats, spec.karat) : ''}
    ${grillz ? `<div class="qrow2">${qStepper(key, 'top', 'Top', r.top)}${qStepper(key, 'bottom', 'Bottom', r.bottom)}</div>` : ''}
    ${!isDental(spec.metal) && ls.opts.coverage.length ? qChips(key, 'coverage', 'How iced', iceOpts, iceKey(spec)) : ''}
    ${spec.coverage && stones.length ? qChips(key, 'stones', 'Stones', stones, spec.stones) : ''}
    ${spec.coverage && /natural/i.test(spec.stones) && clar.length ? qChips(key, 'clarity', 'Clarity', clar, spec.clarity) : ''}
    ${grillz && !spec.coverage && cuts.length ? qChips(key, 'cut', 'Cut', cuts, spec.cut || cuts[0][0]) : ''}
  </div>`;
}

function quoteMessageView(l, q, key) {
  if (q.busy) return `<div class="qgen" role="status" aria-live="polite"><div class="qgen-orb" aria-hidden="true"><i></i><i></i><i></i></div><p class="qgen-step">${esc(q.step || 'Reading the specs')}</p><div class="qgen-lines" aria-hidden="true"><span></span><span></span><span></span><span></span></div></div>`;
  if (q.error) return `<p class="qerr" role="alert">${esc(q.error)}</p>`;
  if (q.msg == null) return '';
  const stale = q.msgFor && q.msgFor !== sigOf(q);
  const words = q.reveal ? q.msg.split(/(\s+)/).map((w, k) => (/^\s+$/.test(w) ? w.replace(/\n/g, '<br>') : `<span class="qw" style="--d:${Math.min(k, 160) * 14}ms">${esc(w)}</span>`)).join('') : '';
  return `<div class="qout ${q.reveal ? 'revealing' : ''}" data-qk="${esc(key)}">
    <div class="qout-head"><span>Quote message</span>${q.edited ? '<em>edited</em>' : q.source === 'template' ? '<em title="The AI writer was not available, so this is the standard message.">standard</em>' : '<em>written by AI</em>'}</div>
    ${q.reveal ? `<div class="qreveal" aria-hidden="true">${words}</div>` : ''}
    <textarea class="in qtext" data-qmsg="${esc(key)}" rows="7" ${q.reveal ? 'hidden' : ''} aria-label="Quote message for ${esc(l.name)}">${esc(q.msg)}</textarea>
    ${stale ? '<p class="qstale">Specs changed after this message. Generate again to update it.</p>' : ''}
    <div class="qacts"><button type="button" class="btn small" data-act="quote-copy" data-qk="${esc(key)}">Copy</button><span class="qcopied" role="status"></span><span class="qsaved" data-qsaved="${esc(key)}" aria-live="polite">${esc(savedLabel(q))}</span></div>
  </div>`;
}

// Jedna ponuda (kartica): broj, budžet, konačna cijena, izmjene, izbori, razrada, poruka.
function offerBox(l, ls, key) {
  const pricing = PR();
  const q = quoteState(l, ls, key);
  const picked = slotOf(key) === 'picked';
  const est = estimate(pricing, q.spec);
  const fin = est.total == null ? null : finalTotal(q, est);
  const diff = specDiff(ls, q.spec);
  const changed = JSON.stringify(q.spec) !== JSON.stringify(q.suggested) || q.price != null;
  const title = picked ? 'Estimated price' : Number.isFinite(ls.budget?.high) ? 'Fits the budget' : 'Your quote';
  const badge = picked ? (diff.length ? 'Adjusted' : '') : diff.length ? 'Suggested' : 'As picked';
  const sub = picked ? (diff.length ? 'Adjusted from what the customer picked' : 'What the customer picked') : diff.length ? `${diff.length} change${diff.length === 1 ? '' : 's'} from the customer's picks` : 'Same as the customer picked';
  const head = `<div class="calc-head"><p class="calc-sub">${sub}</p>${changed ? `<button type="button" class="qreset" data-act="quote-reset" data-q="${esc(key)}">Reset</button>` : badge ? `<span class="qbadge">${badge}</span>` : ''}</div>`;
  const num = est.total == null
    ? `<p class="calc-empty">Missing in your prices: ${est.missing.map(esc).join(', ')}.</p>${picked ? '<button type="button" class="btn small" data-tab="pricing">Set prices</button>' : ''}`
    : `<p class="calc-num" data-qk="${esc(key)}" data-count="${Math.round(fin)}" data-from="${Math.round(q.animFrom ?? fin)}">${money(q.animFrom ?? fin)}</p><div class="bm-wrap">${budgetMeter(fin, ls.budget, ls.budgetLabel) || (ls.budgetLabel ? `<p class="calc-diff">Budget ${esc(ls.budgetLabel)}</p>` : '')}</div>${priceControl(key, q, est)}`;
  const tags = diff.length ? `<ul class="qdiff" aria-label="Changed from the customer's picks">${diff.map((c) => `<li><span>${esc(c.what)}</span>${esc(c.from)} <i aria-hidden="true">→</i> <b>${esc(c.to)}</b></li>`).join('')}</ul>` : '';
  const controls = quoteControls(key, ls, q.spec);
  const gen = est.total != null || q.msg != null || q.busy
    ? `<button type="button" class="btn qgo" data-act="quote-gen" data-qk="${esc(key)}" ${est.total == null || q.busy ? 'disabled' : ''}><span class="qgo-spark" aria-hidden="true"></span>${q.msg != null ? 'Generate again' : 'Generate quote message'}</button><div class="qmsg-wrap" data-qk="${esc(key)}">${quoteMessageView(l, q, key)}</div>`
    : '';
  // Cijela kartica je sklopljena (Ognjen 22.11.2026): u zaglavlju naslov, cijena i stanje budžeta, klik je otvara.
  // Otvorena ostaje otvorena dok se stranica ne osvježi (i kroz ponovno crtanje kartice).
  const bn = fin == null ? null : budgetNote(fin, ls.budget);
  const sum = `<summary class="calc-fold-sum"><span class="calc-fold-t"><span class="calc-title">${title}</span>${q.msg != null ? '<span class="calc-fold-tag">Message ready</span>' : ''}</span>
    <span class="calc-fold-r">${fin == null ? '<em>Missing prices</em>' : `<b>${money(fin)}</b>${bn ? `<em class="${bn.cls}">${bn.text}</em>` : ''}`}</span><i class="calc-fold-x" aria-hidden="true"></i></summary>`;
  return `<details class="calc-box calc-fold${picked ? '' : ' quote'}" data-qbox="${esc(key)}" ${q.boxOpen ? 'open' : ''}>${sum}<div class="calc-fold-body">${head}${num}${tags}${controls}${est.total != null ? breakdown(adjusted(est, q)) : ''}${gen}</div></details>`;
}
// Stanje budžeta za zaglavlje sklopljene kartice (isti račun kao traka budžeta).
function budgetNote(total, b) {
  if (!b) return null;
  if (Number.isFinite(b.high) && total > b.high) return { cls: 'is-over', text: `${money(total - b.high)} over` };
  if (total < b.low) return { cls: 'is-under', text: `${money(b.low - total)} under` };
  return { cls: 'is-in', text: 'In budget' };
}

function calcView(l) {
  const ls = leadSpec(l);
  if (!ls) return '';
  if (!P.me.pricing) {
    return `<aside class="calc" data-calc="${esc(l.id)}"><div class="calc-box"><p class="calc-title">Estimated price</p><p class="calc-empty">Add your prices and the estimate for every lead appears here.</p><button type="button" class="btn small" data-tab="pricing">Set prices</button></div>
      <div class="calc-box"><p class="calc-title">Fits the budget</p><p class="calc-empty">Specs that fit the customer's budget, which you can adjust and turn into a quote message.</p></div></aside>`;
  }
  return `<aside class="calc" data-calc="${esc(l.id)}">${offerBox(l, ls, `${l.id}|p`)}${offerBox(l, ls, l.id)}</aside>`;
}

// Samo kalkulator tog leada se crta ponovo (bez skoka stranice), brojevi klize od stare do nove cijene.
function renderCalc(id) {
  const l = P.leads.find((x) => x.id === id);
  const el = app.querySelector(`aside[data-calc="${CSS.escape(id)}"]`);
  if (!l || !el) return;
  const a = document.activeElement;
  const focus = a?.closest?.(`aside[data-calc="${CSS.escape(id)}"]`) ? ['q', 'qf', 'qv', 'qd', 'qrange', 'qprice'].filter((k) => a.dataset[k] != null).map((k) => `[data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${CSS.escape(a.dataset[k])}"]`).join('') : '';
  el.outerHTML = calcView(l);
  const box = app.querySelector(`aside[data-calc="${CSS.escape(id)}"]`);
  if (focus) box?.querySelector(focus)?.focus();
  for (const n of box?.querySelectorAll('[data-count]') || []) {
    if (Q[n.dataset.qk]) delete Q[n.dataset.qk].animFrom;
    countTo(n, Number(n.dataset.from), Number(n.dataset.count), () => {});
  }
  for (const k of [id, `${id}|p`]) if (Q[k]?.reveal) finishReveal(k);
}
function countTo(el, from, to, done) {
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = money(to); done(); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.max(0, Math.min(1, (t - t0) / 420));
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = money(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step); else done();
  };
  el.classList.add('ticking');
  setTimeout(() => el.classList.remove('ticking'), 450);
  requestAnimationFrame(step);
}
function finishReveal(key) {
  const q = Q[key];
  const sel = `aside[data-calc="${CSS.escape(qkLead(key))}"] .qout[data-qk="${CSS.escape(key)}"]`;
  const first = app.querySelector(sel);
  if (!q || !first) return;
  const words = first.querySelectorAll('.qw').length;
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.min(words, 160) * 14 + 650;
  clearTimeout(q.revealTimer);
  q.revealTimer = setTimeout(() => {
    q.reveal = false;
    const box = app.querySelector(sel);
    if (!box) return;
    const r = box.querySelector('.qreveal');
    const ta = box.querySelector('.qtext');
    if (r) r.remove();
    if (ta) { ta.hidden = false; ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; }
    box.classList.remove('revealing');
  }, ms);
}

function quoteEdit(key, field, value, delta) {
  const id = qkLead(key);
  const l = P.leads.find((x) => x.id === id);
  const ls = l && leadSpec(l);
  const q = Q[key];
  if (!ls || !q) return;
  const s = { ...q.spec };
  if (field === 'top' || field === 'bottom') {
    const r = rowsOf(s.teeth);
    const n = Math.max(0, Math.min(10, (field === 'top' ? r.top : r.bottom) + Number(delta)));
    if ((field === 'top' ? n + r.bottom : r.top + n) === 0) return;
    const orig = rowsOf(ls.spec.teeth);
    const top = field === 'top' ? rowIds('T', n, orig.topIds) : rowIds('T', r.top, r.topIds);
    const bottom = field === 'bottom' ? rowIds('B', n, orig.bottomIds) : rowIds('B', r.bottom, r.bottomIds);
    s.teeth = [...top, ...bottom].join(',');
    s.units = top.length + bottom.length;
  } else s[field] = value;
  if (field === 'metal') {
    if (isDental(value)) { s.coverage = ''; s.stones = ''; s.karat = ''; }
    else if (isGold(value) && !s.karat) s.karat = ls.choices.karats.find((k) => !/silver|925/i.test(k)) || '';
    else if (!isGold(value)) s.karat = '';
  }
  if (field === 'coverage') {
    // Izbor leda iz forme: nivo za račun + dijelovi sata (bezel, face, bracelet) i tačan naziv za poruku.
    const o = ls.opts.ice?.[value];
    Object.assign(s, value ? (o ? iceFields(o) : { coverage: value, ice: '', iceParts: '' }) : { coverage: '', ice: '', iceParts: '' });
    if (value && !s.stones) s.stones = ls.choices.stones[0] || 'default';
    if (!value) { s.stones = ''; s.clarity = ''; }
  }
  if (field === 'stones' && !/natural/i.test(value)) s.clarity = '';
  if (field === 'stones' && /natural/i.test(value) && !s.clarity) s.clarity = ls.opts.clarity[0] || '';
  const prev = estimate(PR(), q.spec);
  if (prev.total != null) q.animFrom = Math.round(finalTotal(q, prev));
  q.spec = s;
  // Nove specifikacije = nova izračunata cijena; ručna cijena se ne prenosi na drugi komad.
  q.price = null;
  queueAdjSave(key);
  renderCalc(id);
}
function quoteReset(key) {
  const q = Q[key];
  if (!q) return;
  const prev = estimate(PR(), q.spec);
  if (prev.total != null) q.animFrom = Math.round(finalTotal(q, prev));
  q.spec = { ...q.suggested };
  q.price = null;
  queueAdjSave(key);
  renderCalc(qkLead(key));
}

// ---------- Konačna cijena (slider i upis, 22.11.2026) ----------
// Dok se vuče, mijenjaju se samo broj, traka budžeta i natpis; pri puštanju se kartica crta ponovo, izmjena se
// sačuva, a stara cijena u gotovoj poruci se zamijeni novom (i u poruci Fits the budget kad se mijenja Estimated price).
function priceLive(key, value) {
  const id = qkLead(key);
  const l = P.leads.find((x) => x.id === id);
  const ls = l && leadSpec(l);
  const q = Q[key];
  if (!ls || !q) return;
  const est = estimate(PR(), q.spec);
  if (est.total == null) return;
  const calc = Math.round(est.total);
  const v = Math.max(1, Math.min(5e6, Math.round(Number(value) || 0)));
  if (q.priceFrom == null) q.priceFrom = Math.round(finalTotal(q, est));
  q.price = v === calc ? null : v;
  const box = app.querySelector(`.qprice[data-qk="${CSS.escape(key)}"]`)?.closest('.calc-box');
  if (!box) return;
  const n = box.querySelector(`.calc-num[data-qk="${CSS.escape(key)}"]`);
  if (n) n.textContent = money(v);
  const meter = box.querySelector('.bm-wrap');
  if (meter && ls.budget) meter.innerHTML = budgetMeter(v, ls.budget, ls.budgetLabel);
  const range = box.querySelector('[data-qrange]');
  const input = box.querySelector('[data-qprice]');
  if (range && document.activeElement !== range) range.value = v;
  if (range) range.style.setProperty('--p', `${((Number(range.value) - range.min) / Math.max(1, range.max - range.min)) * 100}%`);
  if (input && document.activeElement !== input) input.value = v;
  const foot = box.querySelector('.qprice-foot');
  if (foot) foot.innerHTML = priceFoot(calc, v, q);
}
function priceCommit(key) {
  const q = Q[key];
  if (!q) return;
  const est = estimate(PR(), q.spec);
  if (est.total == null) return;
  const from = q.priceFrom;
  delete q.priceFrom;
  const to = Math.round(finalTotal(q, est));
  if (from != null && from !== to) {
    swapPrice(key, from, to);
    if (slotOf(key) === 'picked') swapPrice(qkLead(key), from, to, true);
  }
  queueAdjSave(key);
  renderCalc(qkLead(key));
}
// Gotova poruka: "$2,500" postaje nova cijena (samo ako je stara cijena tačno u tekstu); ostale izmjene traže Generate again.
function swapPrice(key, from, to, other = false) {
  const q = Q[key];
  if (!q || q.msg == null || q.busy) return;
  const a = money(from);
  const b = money(to);
  if (!q.msg.includes(a)) return;
  q.msg = q.msg.split(a).join(b);
  if (!other) q.msgFor = sigOf(q);
  if (q.savedAt) queueQuoteSave(key);
}

// Izbori i cijena se čuvaju sami (pola sekunde poslije zadnje izmjene); stranica kupca ih čita odatle.
const adjTimers = {};
function queueAdjSave(key) {
  clearTimeout(adjTimers[key]);
  adjTimers[key] = setTimeout(() => saveAdjNow(key), 500);
}
async function saveAdjNow(key, { keepalive = false } = {}) {
  clearTimeout(adjTimers[key]);
  delete adjTimers[key];
  const q = Q[key];
  if (!q?.spec) return;
  const id = qkLead(key);
  const slot = slotOf(key);
  const body = { slot, spec: q.spec, price: q.price ?? null };
  try {
    const res = await fetch(`/api/portal/leads/${encodeURIComponent(id)}/quote`, { method: 'PUT', credentials: 'same-origin', keepalive, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('save');
    rememberQuote(id, slot, { spec: q.spec, price: q.price ?? null });
  } catch {
    adjTimers[key] = setTimeout(() => saveAdjNow(key), 4000);
  }
}

// Poruka: server je piše (Workers AI) iz konačnih izbora i konačne cijene; animacija traje bar ~1,4 s.
const GEN_STEPS = ['Reading the specs', 'Checking the price', 'Writing the message', 'Polishing the wording'];
async function quoteGenerate(key) {
  const id = qkLead(key);
  const l = P.leads.find((x) => x.id === id);
  const ls = l && leadSpec(l);
  const q = Q[key];
  if (!ls || !q || q.busy) return;
  const spec = q.spec;
  const est = estimate(PR(), spec);
  if (est.total == null) return;
  const fin = finalTotal(q, est);
  Object.assign(q, { busy: true, error: '', step: GEN_STEPS[0] });
  renderCalc(id);
  let k = 0;
  const tick = setInterval(() => {
    k = Math.min(k + 1, GEN_STEPS.length - 1);
    q.step = GEN_STEPS[k];
    const el = app.querySelector(`aside[data-calc="${CSS.escape(id)}"] .qmsg-wrap[data-qk="${CSS.escape(key)}"] .qgen-step`);
    if (el) { el.classList.remove('swap'); void el.offsetWidth; el.textContent = q.step; el.classList.add('swap'); }
  }, 900);
  const slot = slotOf(key);
  // Poruka zaključava cijenu (žive cijene metala ne mijenjaju već poslatu ponudu); "Use calculated" je otključava.
  const priceBefore = q.price;
  if (q.price == null) q.price = Math.round(fin);
  const body = { ...quoteBody(ls, spec, adjusted(est, q)), slot, spec, price: q.price, msgFor: sigOf(q) };
  body.total = Math.round(fin);
  // "Fits the budget" sa izmjenama: poruka kaže šta se mijenja u odnosu na Estimated price (kako je zlatar ostavi)
  // i novu cijenu naspram njene konačne cijene.
  if (slot === 'fit') {
    const pq = Q[`${id}|p`] || quoteState(l, ls, `${id}|p`);
    const pe = estimate(PR(), pq.spec);
    const orig = pe.total == null ? null : finalTotal(pq, pe);
    body.changes = specDiff({ ...ls, spec: pq.spec }, spec);
    if (body.changes.length && orig != null && Math.round(orig) !== body.total) Object.assign(body, { mode: 'fit', originalTotal: Math.round(orig), inBudget: !Number.isFinite(ls.budget?.high) || fin <= ls.budget.high });
  }
  const t0 = Date.now();
  try {
    const res = await api(`/api/portal/leads/${encodeURIComponent(id)}/quote`, { method: 'POST', body: JSON.stringify(body), json: true });
    await new Promise((ok) => setTimeout(ok, Math.max(0, 1400 - (Date.now() - t0))));
    Object.assign(q, { msg: res.message, source: res.source, msgFor: sigOf(q), reveal: true, edited: false, savedAt: res.saved?.at || null, saveError: '' });
    if (res.saved) rememberQuote(id, slot, res.saved);
  } catch (err) {
    q.error = err.message || 'Could not write the message. Try again.';
    q.price = priceBefore;
  } finally {
    clearInterval(tick);
    q.busy = false;
    renderCalc(id);
  }
}

// ---------- Čuvanje izmjena poruke (19.11.2026) ----------
// Svaka izmjena u polju se sačuva sama (pola sekunde poslije kucanja, odmah kad polje izgubi fokus ili se stranica zatvori).
const SAVE_DELAY = 600;
const saveTimers = {};
function savedLabel(q) {
  if (q.saving) return 'Saving…';
  if (q.saveError) return q.saveError;
  if (!q.savedAt) return '';
  return `${q.edited ? 'Edited' : 'Saved'} ${new Date(q.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}
function showSaved(key) {
  const el = app.querySelector(`[data-qsaved="${CSS.escape(key)}"]`);
  if (el && Q[key]) el.textContent = savedLabel(Q[key]);
}
function rememberQuote(id, slot, saved) {
  const l = P.leads.find((x) => x.id === id);
  if (!l) return;
  l.quotes = { ...(l.quotes || {}), [slot]: { ...(l.quotes?.[slot] || {}), ...saved } };
  leadStore.update(id, { quotes: l.quotes }, P.counts);
}
function queueQuoteSave(key) {
  const q = Q[key];
  if (!q) return;
  q.dirty = true;
  clearTimeout(saveTimers[key]);
  saveTimers[key] = setTimeout(() => saveQuoteNow(key), SAVE_DELAY);
}
async function saveQuoteNow(key, { keepalive = false } = {}) {
  clearTimeout(saveTimers[key]);
  const q = Q[key];
  if (!q || !q.dirty || q.msg == null || !q.savedAt) return;
  const id = qkLead(key);
  const slot = key.endsWith('|p') ? 'picked' : 'fit';
  const msg = q.msg;
  q.dirty = false;
  q.saving = true;
  showSaved(key);
  try {
    const res = await fetch(`/api/portal/leads/${encodeURIComponent(id)}/quote`, { method: 'PUT', credentials: 'same-origin', keepalive, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slot, message: msg, msgFor: q.msgFor || undefined }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not save');
    Object.assign(q, { edited: true, savedAt: data.at, saveError: '' });
    rememberQuote(id, slot, { msg, edited: true, at: data.at, msgFor: q.msgFor });
  } catch (err) {
    q.dirty = true;
    q.saveError = 'Not saved, retrying…';
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(() => saveQuoteNow(key), 4000);
  } finally {
    q.saving = false;
    showSaved(key);
    const head = app.querySelector(`.qout[data-qk="${CSS.escape(key)}"] .qout-head em`);
    if (head && q.edited) head.textContent = 'edited';
  }
}
// Zatvaranje taba ili odlazak sa stranice: nesačuvana izmjena ide odmah (keepalive preživi zatvaranje).
const flushQuotes = () => {
  for (const k of Object.keys(Q)) if (Q[k]?.dirty) saveQuoteNow(k, { keepalive: true });
  for (const k of Object.keys(adjTimers)) saveAdjNow(k, { keepalive: true });
};
// Otvorena kartica ponude ostaje otvorena kroz ponovno crtanje.
app.addEventListener('toggle', (e) => { const k = e.target.dataset?.qbox; if (k && Q[k]) Q[k].boxOpen = e.target.open; }, true);
addEventListener('pagehide', flushQuotes);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushQuotes(); });

// ---------- Bookings (19.11.2026) ----------
// Kupci koji su na svojoj stranici kliknuli Reserve with a deposit ili Book an appointment. Obavještenje u portalu:
// broj novih na tabu i traka na vrhu; provjera svakih 60 s, otvaranje taba ih označi kao viđene.
async function loadBookings() {
  try { P.bookings = await api('/api/portal/bookings'); } catch { P.bookings = P.bookings || null; }
}
async function pollBookings() {
  const before = P.bookings?.unseen || 0;
  const lastBefore = P.bookings?.items?.[0]?.lastAt || 0;
  await loadBookings();
  const changed = (P.bookings?.unseen || 0) !== before || (P.bookings?.items?.[0]?.lastAt || 0) !== lastBefore;
  if (!changed) return;
  // Bez ponovnog crtanja cijele stranice (zlatar možda kuca poruku): samo tab i traka.
  const nav = app.querySelector('nav.tabs');
  if (nav) nav.outerHTML = portalTabs();
  const al = app.querySelector('.bk-alert');
  const html = bookingAlert();
  if (al) al.outerHTML = html || '<span hidden></span>';
  else if (html) app.querySelector('nav.tabs')?.insertAdjacentHTML('afterend', html);
  if (P.tab === 'bookings' && !app.querySelector('.bk-list textarea:focus')) render();
}
async function openBookings() {
  await loadBookings();
  render();
  if (!P.bookings?.unseen || readOnly()) return;
  try { await api('/api/portal/bookings/seen', { method: 'POST' }); } catch {}
}
const BK_LABEL = { deposit: 'Reserve with a deposit', appointment: 'Book an appointment' };
const OPTION_LABEL = { picked: 'Option 1 · Their design', fit: 'Option 2 · Fits the budget' };
function bookingAlert() {
  const n = P.bookings?.unseen || 0;
  if (!n || P.tab === 'bookings') return '';
  const first = P.bookings.items.find((x) => x.isNew);
  const what = first?.actions[0]?.action === 'appointment' ? 'wants to book an appointment' : 'wants to reserve with a deposit';
  return `<div class="bk-alert" role="status"><span class="bk-dot" aria-hidden="true"></span><p><b>${n === 1 ? `${esc(first.name)} ${what}` : `${n} new booking requests`}</b><span>${n === 1 ? 'They pressed the button on their page. Contact them with the next steps.' : `Latest: ${esc(first.name)} ${what}.`}</span></p><button type="button" class="btn small" data-act="see-bookings">View bookings</button></div>`;
}
function bookingsView() {
  const b = P.bookings;
  if (!b) return '<p class="empty" role="status">Loading bookings…</p>';
  const intro = '<p class="note bk-intro">Customers who pressed <b>Reserve with a deposit</b> or <b>Book an appointment</b> on their page. They were told you will contact them with further details.</p>';
  if (!b.items.length) return `${intro}<p class="empty">No requests yet. They show up here as soon as a customer presses one of the buttons on their page.</p>`;
  const rows = b.items.map((x) => {
    const acts = x.actions.slice(0, 6).map((a) => `<li class="${a.at > b.seenAt ? 'is-new' : ''}"><b>${esc(BK_LABEL[a.action] || a.action)}</b>${a.option ? `<span>${esc(OPTION_LABEL[a.option] || a.option)}${a.total ? ` · ${money(a.total)}` : ''}</span>` : ''}<time>${esc(when(a.at))}</time>${a.at > b.seenAt ? '<em>New</em>' : ''}</li>`).join('');
    return `<article class="bk${x.isNew ? ' is-new' : ''}">
      <div class="bk-img">${x.img ? `<img src="${esc(x.img)}" alt="" width="96" height="96" loading="lazy" data-zoom tabindex="0" />` : '<span>No picture</span>'}</div>
      <div class="bk-main">
        <div class="bk-top"><h3>${esc(x.name)}</h3><span class="pill">${esc(x.piece ? x.piece[0].toUpperCase() + x.piece.slice(1) : 'Piece')}</span><span class="pill s-${esc(x.status)}">${esc((STATUSES.find(([v]) => v === x.status) || [, x.status])[1])}</span></div>
        <div class="contact"><span class="cpair"><a href="mailto:${esc(x.email)}">${esc(x.email)}</a>${copyBtn(x.email, 'email', x.id, 'email')}</span><span class="cpair"><a href="tel:${esc(String(x.phone).replace(/[^\d+]/g, ''))}">${esc(x.phone)}</a>${copyBtn(x.phone, 'phone number', x.id, 'phone')}</span></div>
        <ul class="bk-acts">${acts}</ul>
        <div class="bk-links"><button type="button" class="btn small" data-see-lead="${esc(x.email)}">See lead</button>${x.page ? `<a class="btn small ghost" href="${esc(x.page)}?preview=1" target="_blank" rel="noopener">Open their page ↗</a>` : ''}<span class="bk-views">${x.views ? `Page viewed ${x.views}×` : ''}</span></div>
      </div>
    </article>`;
  }).join('');
  return `${intro}<div class="bk-list">${rows}</div>`;
}

// ---------- Tab Pricing: tabela cijena zlatara ----------
// Primjer računa kamenja u Pricing tabu (22.11.2026): bira se komad i kamen, račun ide iz cijena upisanih u polja
// (i prije Save), korak po korak kao u "How it's priced".
const PEX_PIECES = [
  { key: 'chain', label: 'Chain 20" × 10 mm', spec: { type: 'chain', lengthIn: 20, widthMm: 10, coverage: 'full' } },
  { key: 'ring', label: 'Ring size 8, 1 ct center', spec: { type: 'ring', ringSize: 8, coverage: 'half', centerCt: 1 } },
  { key: 'pendant', label: 'Pendant 2"', spec: { type: 'pendant', sizeIn: 2, coverage: 'full' } },
  { key: 'watch', label: 'Watch 40 mm bust-down', spec: { type: 'watch', caseMm: 40, coverage: 'full' } },
];
const PEX = { piece: 'chain', stone: null };
function pexPrice(path) {
  const el = app.querySelector(`[data-price="${CSS.escape(path)}"]`);
  const v = el ? Number(el.value) : path.split('.').reduce((o, k) => o?.[k], P.me.pricing || {});
  return Number.isFinite(v) && v > 0 ? v : null;
}
const pexStones = () => [...new Map(Object.values(P.me.formSpecs || {}).flatMap((s) => (s.stones || []).filter((o) => o.value !== 'none').map((o) => o.label)).filter(Boolean).map((x) => [pkey(x), x])).values()];
function stoneExample(stones) {
  const list = stones.length ? stones : ['Lab-grown diamonds'];
  const stone = list.find((x) => x === PEX.stone) || list.find((x) => /lab/i.test(x)) || list[0];
  const piece = PEX_PIECES.find((x) => x.key === PEX.piece) || PEX_PIECES[0];
  const sk = pkey(stone);
  const lay = stoneLayout(piece.spec);
  const each = 0.0042 * lay.d ** 3;
  const perCt = pexPrice(`stones.${sk}.ct`);
  const center = pexPrice(`stones.${sk}.center`);
  const setting = pexPrice('setting');
  const cover = { full: 'fully iced', half: 'half iced', accents: 'accents' }[piece.spec.coverage];
  const n = lay.count.toLocaleString('en-US');
  const rows = [
    ['Surface to cover', `${piece.label}, ${cover}`, `${lay.area.toLocaleString('en-US')} mm²`],
    ['Stones that fit', `${lay.d} mm round stones, packed with room for the prongs`, `${n} stones`],
    ['Carats', `${n} × ${each.toFixed(4)} ct`, `${lay.ct} ct`],
  ];
  let total = 0;
  const priced = (label, how, v) => { if (v == null) rows.push([label, how, '<i>add a price</i>']); else { total += Math.round(v); rows.push([label, how, money(v)]); } };
  priced(stone, perCt ? `${lay.ct} ct × ${money(perCt)}/ct` : 'price per carat is empty', perCt ? lay.ct * perCt : null);
  priced('Setting', setting ? `${n} stones × $${setting}` : 'setting price is empty', setting ? lay.count * setting : null);
  if (piece.spec.centerCt) priced('Center stone', center ? `${piece.spec.centerCt} ct × ${money(center)}/ct` : 'center stone price is empty', center ? piece.spec.centerCt * center : null);
  return `<p class="pex-title">Example: how an estimate is worked out</p>
    <div class="qchips pex-chips" role="group" aria-label="Example piece">${PEX_PIECES.map((x) => `<button type="button" class="qchip ${x.key === piece.key ? 'on' : ''}" aria-pressed="${x.key === piece.key}" data-pex-piece="${x.key}">${esc(x.label)}</button>`).join('')}</div>
    <div class="qchips pex-chips" role="group" aria-label="Example stone">${list.map((x) => `<button type="button" class="qchip ${x === stone ? 'on' : ''}" aria-pressed="${x === stone}" data-pex-stone="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <ol class="pex-steps">${rows.map(([a, b, c]) => `<li><span class="pex-a">${esc(a)}</span><span class="pex-b">${esc(b)}</span><b>${c}</b></li>`).join('')}</ol>
    <p class="pex-total"><span>Stones in this estimate</span><b>${money(total)}</b></p>
    <p class="hint">Metal, labor and your markup come on top, from the other cards. Natural diamonds are SI here; VS, VVS and Flawless multiply the price per carat.</p>`;
}
function renderStoneExample() {
  const el = app.querySelector('[data-pex]');
  if (el) el.innerHTML = stoneExample(pexStones());
}

// ---------- Žive cijene metala u Pricing tabu (22.11.2026) ----------
// Polje sa data-mkt je zaključano dok je Live (pokazuje današnju cijenu); zlatarev broj ostaje u data-custom.
const mktOf = (label) => (/platinum/i.test(label) ? 'platinum' : /silver|925/i.test(label) ? 'silver' : null);
const mktGram = (k, factor = 1) => (P.me.market?.[k] > 0 ? Math.round(P.me.market[k] * factor * 100) / 100 : null);
function mktInp(k, path, custom, factor = 1) {
  const live = isLive(P.me.pricing, k) && mktGram(k) != null;
  const v = live ? mktGram(k, factor) : custom;
  return `<input class="in pin ${live ? 'is-live' : ''}" type="number" min="0" step="0.01" inputmode="decimal" data-price="${esc(path)}" data-mkt="${k}" data-factor="${factor}" data-custom="${custom ?? ''}" value="${v ?? ''}" ${live ? 'disabled title="Live market price. Switch to Custom to enter your own."' : ''} />`;
}
function mktNote(k) {
  const m = P.me.market;
  if (!(m?.[k] > 0)) return '<span class="pmkt-off">Live price not available right now; your custom price is used.</span>';
  const at = m[`${k}At`] ? new Date(m[`${k}At`]).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  return `Today $${Number(m[`${k}Oz`]).toLocaleString('en-US', { maximumFractionDigits: 2 })}/oz = <b>$${mktGram(k).toFixed(2)}/g</b>${at ? ` · ${esc(at)}` : ''}`;
}
function mktRow(m, pr) {
  const live = isLive(pr, m.key);
  const seg = `<div class="pseg" role="group" aria-label="${esc(m.label)} price source"><button type="button" class="${live ? 'on' : ''}" aria-pressed="${live}" data-live="${m.key}" data-on="1">Live</button><button type="button" class="${live ? '' : 'on'}" aria-pressed="${!live}" data-live="${m.key}" data-on="0">Custom</button></div>`;
  const input = m.key === 'gold' ? mktInp('gold', 'goldSpot', pr.goldSpot) : '';
  return `<div class="pmkt" data-mkt-row="${m.key}"><div class="pmkt-top"><span class="pmkt-l">${esc(m.label)}, $ per gram</span>${seg}</div>
    ${input ? `<div class="pmkt-in">${input}</div>` : `<p class="pmkt-where">${live ? 'Live price is used for every metal with this name.' : 'Enter your price in "Metal price per gram".'}</p>`}
    <p class="pmkt-note">${mktNote(m.key)}</p></div>`;
}
function setLive(k, on) {
  if (!P.me.pricing) P.me.pricing = {};
  P.me.pricing.live = { ...(P.me.pricing.live || {}), [k]: on };
  for (const b of app.querySelectorAll(`[data-live="${k}"]`)) { const me = (b.dataset.on === '1') === on; b.classList.toggle('on', me); b.setAttribute('aria-pressed', String(me)); }
  for (const el of app.querySelectorAll(`[data-mkt="${k}"]`)) {
    const live = on && mktGram(k) != null;
    if (live) { if (!el.disabled) el.dataset.custom = el.value; el.value = mktGram(k, Number(el.dataset.factor) || 1); }
    else if (el.disabled) el.value = el.dataset.custom || '';
    el.disabled = live;
    el.classList.toggle('is-live', live);
  }
  const where = app.querySelector(`[data-mkt-row="${k}"] .pmkt-where`);
  if (where) where.textContent = on ? 'Live price is used for every metal with this name.' : 'Enter your price in "Metal price per gram".';
}

function pricingView() {
  const pr = P.me.pricing || {};
  const specs = Object.values(P.me.formSpecs || {});
  const uniq = (list) => [...new Map(list.filter(Boolean).map((x) => [pkey(x), x])).values()];
  const metals = uniq(specs.flatMap((s) => (s.metal || []).map((o) => o.label)));
  const stones = uniq(specs.flatMap((s) => (s.stones || []).filter((o) => o.value !== 'none').map((o) => o.label)));
  const cuts = uniq(specs.flatMap((s) => (s.cut || []).map((o) => o.label)));
  const allPieces = uniq(specs.flatMap((s) => (s.type || []).map((o) => o.value))).filter((x) => PIECES.includes(x));
  const pieces = allPieces.filter((x) => x !== 'grillz');
  const ro = '';
  const inp = (path, v, ph = '') => `<input class="in pin" type="number" min="0" step="0.01" inputmode="decimal" data-price="${esc(path)}" value="${v ?? ''}" placeholder="${esc(ph)}" ${ro} />`;
  const per = () => 'per piece';
  const g = pr.grillz || {};
  const colName = { '10k': '10K', '14k': '14K', '18k': '18K', silver: 'Silver', platinum: 'Platinum' };
  const grid = (title, hint, rows, path, cols, rowName) => `<div class="pcard2 pwide"><h3>${title}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}<div class="ptable" style="grid-template-columns: minmax(0, 1.3fr) repeat(${cols.length}, minmax(0, 1fr))"><span></span>${cols.map((c) => `<span>${esc(colName[c] || c)}</span>`).join('')}
      ${rows.map((r) => `<span>${esc(rowName(r))}</span>${cols.map((c) => inp(`${path}.${r}.${c}`, g[path.split('.')[1]]?.[r]?.[c])).join('')}`).join('')}</div></div>`;
  const list = (title, hint, keys, path, label) => `<div class="pcard2"><h3>${title}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}${keys.map((k) => `<label class="prow"><span>${esc(label ? label(k) : k)}</span>${inp(`${path}.${pkey(k)}`, path.split('.').slice(1).reduce((o, x) => o?.[x], g)?.[pkey(k)])}</label>`).join('')}</div>`;
  const addKeys = uniq([...cuts.filter((c) => !/^(polished|solid)$/i.test(c)), ...Object.keys(g.additions || {}), ...Object.keys(SUGGESTED_PRICING.grillz.additions)]);
  // Svaki rez koji forma nudi ima red i za dental gold (District 19.11.2026: falili Pineapple Cut i Weed Cut); prazno = ne računa se.
  const dentalKeys = uniq([...Object.keys(g.designs || {}), ...Object.keys(SUGGESTED_PRICING.grillz.designs), 'pineapple cut', 'weed cut', ...cuts.filter((c) => !/^(polished|solid|open face)$/i.test(c))]);
  const cap = (k) => k.replace(/\b\w/g, (m) => m.toUpperCase()).replace(/\b3d\b/i, '3D');
  const grillzCards = allPieces.includes('grillz') ? `
    <h2 class="psec">Grillz price list</h2>
    <p class="hint">Final prices, no markup. Sets are top and bottom with 6 or more teeth on each row; anything else is priced row by row from "Bottom or top only". A count that is not on the list is priced at the next size up. Leave a box empty where you do not offer it.</p>
    <div class="pgrid2">
      ${grid('Sets (top and bottom), $', '', ['6', '8', '10', '12'], 'grillz.sets', GRILLZ_COLS, (r) => `${r} x ${r}`)}
      ${grid('Bottom or top only, $', '', ['fangs', '2', '3', '4', '6', '8', '10', '12'], 'grillz.row', GRILLZ_COLS, (r) => (r === 'fangs' ? '2 fangs & backbar' : `${r} teeth`))}
      ${grid('Diamond iced teeth, $ per tooth', 'Price for one iced tooth. 18K and platinum use the 14K price plus the metal difference. Leave Moissanite empty to price moissanite from the pave sets below.', ['lab', 'natural si1', 'natural vvs1', 'moissanite'], 'grillz.iced', ICED_COLS, (r) => (r === 'lab' ? 'Lab diamond' : r === 'natural si1' ? 'Natural diamond SI1' : r === 'natural vvs1' ? 'Natural diamond VVS1' : 'Moissanite'))}
      <div class="pcard2"><h3>Moissanite & silver iced out sets, pave, $</h3>${['6', '8', '10'].map((r) => `<label class="prow"><span>${r} x ${r}</span>${inp(`grillz.moissanite.${r}`, g.moissanite?.[r])}</label>`).join('')}</div>
      <div class="pcard2"><h3>Dental gold (non-precious), $</h3>${['6', '8', '10'].map((r) => `<div class="prow2"><b>${r} teeth</b><label><span>Set ${r} on ${r}</span>${inp(`grillz.dental.set.${r}`, g.dental?.set?.[r])}</label><label><span>Bottom or top</span>${inp(`grillz.dental.row.${r}`, g.dental?.row?.[r])}</label></div>`).join('')}</div>
      <div class="pcard2"><h3>Molding fee, $</h3><label class="prow"><span>Gold, silver, platinum</span>${inp('grillz.molding.metal', g.molding?.metal)}</label><label class="prow"><span>Dental gold</span>${inp('grillz.molding.dental', g.molding?.dental)}</label></div>
      ${list('Additions, $ per tooth', '', addKeys, 'grillz.additions', cap)}
      ${list('Dental gold designs, $ per tooth', '', dentalKeys, 'grillz.designs', cap)}
    </div>
    <h2 class="psec">Other pieces</h2>` : '';
  return `<section class="pricing">
    <p class="note">Your prices for the estimate next to every lead. Only you see them. Change any price at any time; metal prices move, so update the gold price when it does.</p>
    <div class="pfill"><button type="button" class="btn small" data-act="fill-pricing">Fill suggested prices</button><span class="hint">Fills only empty fields with starting prices (grillz from the District price list of Nov 2026, other pieces from gold at $124/g on Nov 16, 2026). Then press Save.</span></div>
    ${grillzCards}
    <div class="pgrid2">
      <div class="pcard2 pmkt-card"><h3>Metal prices and markup</h3>
        <p class="hint">Live = today's market price per gram (updates on its own); Custom = your own price. Grillz use your price list above, not these.</p>
        ${MARKET_METALS.map((m) => mktRow(m, pr)).join('')}
        <p class="hint">Gold metals use the gold price × karat purity (10K, 14K, 18K) unless you set their own price in the next card.</p>
        <label class="prow"><span>Markup, %</span>${inp('markup', pr.markup)}</label></div>
      <div class="pcard2"><h3>Metal price per gram, $</h3>${metals.map((m) => { const mk = mktOf(m); return `<label class="prow"><span>${esc(m)}</span>${mk ? mktInp(mk, `metals.${pkey(m)}`, pr.metals?.[pkey(m)], /sterling|925/i.test(m) ? 0.925 : 1) : inp(`metals.${pkey(m)}`, pr.metals?.[pkey(m)], /gold|two.?tone/i.test(m) && !/dental/i.test(m) ? 'from gold' : '')}</label>`; }).join('') || '<p class="hint">No metals in your forms.</p>'}</div>
      <div class="pcard2"><h3>Weight and labor</h3>${pieces.includes('watch') ? '<p class="hint">Watch: leave grams empty when you ice the customer\'s own watch (no metal in the price); labor covers opening, prep, polish and reassembly.</p>' : ''}${pieces.map((pc) => `<div class="prow2"><b>${esc(pc[0].toUpperCase() + pc.slice(1))}</b><label><span>Grams ${per(pc)}</span>${inp(`grams.${pc}`, pr.grams?.[pc], pc === 'watch' ? 'own watch' : '')}</label><label><span>Labor ${per(pc)}, $</span>${inp(`labor.${pc}`, pr.labor?.[pc])}</label></div>`).join('')}</div>
      <div class="pcard2 pwide pstones"><h3>Stones${allPieces.includes('grillz') ? ' (not grillz)' : ''}, $ per carat</h3>
        <p class="hint">The estimate works out how many stones cover the piece at its size (ring size, pendant size, chain length and width, watch case), how big they are and how many carats that makes, then uses your price per carat. Center stone = the ring's center stone and stud earrings.</p>
        <div class="pst-grid"><div class="pst-table">
          <div class="ptable" style="grid-template-columns: minmax(0, 1.3fr) repeat(2, minmax(0, 1fr))"><span></span><span>Small stones</span><span>Center stone</span>
          ${[...stones, 'Default (no stone type chosen)'].map((st) => { const k = /^default/i.test(st) ? 'default' : pkey(st); return `<span>${esc(st)}</span>${inp(`stones.${k}.ct`, pr.stones?.[k]?.ct)}${inp(`stones.${k}.center`, pr.stones?.[k]?.center)}`; }).join('')}
          <span>Setting, $ per stone</span>${inp('setting', pr.setting)}<span></span></div>
          <p class="hint">Natural diamonds: VS is × 1.25, VVS × 1.5 and Flawless × 2 of the price per carat.</p></div>
          <div class="pex" data-pex aria-live="polite">${stoneExample(stones)}</div></div></div>
    </div>
    <div class="pcard2 pwide pinfo"><h3>Store info under every quote message</h3><p class="hint">Address, hours, turnaround, out of state terms. It is added word for word at the end of every quote message.</p>
      <textarea class="in" rows="8" data-quote-info maxlength="1200" placeholder="Your store, address, hours, turnaround times…">${esc(pr.quoteInfo || '')}</textarea>
      <h3 class="plinks-h">Buttons on customer pages</h3><p class="hint">Where "Reserve with a deposit" and "Book an appointment" go (for example a payment link or your booking page). Leave empty and the customer's request shows on the lead, so you can contact them.</p>
      <label class="prow"><span>Deposit link</span><input class="in" type="url" data-link="depositUrl" placeholder="https://" value="${esc(pr.depositUrl || '')}" /></label>
      <label class="prow"><span>Booking link</span><input class="in" type="url" data-link="bookingUrl" placeholder="https://" value="${esc(pr.bookingUrl || '')}" /></label></div>
    <div class="pcard2 pwide pinfo palerts"><h3>New lead alerts and first message</h3>
      ${P.me.mail ? '' : '<p class="hint pwarn">Email sending is not switched on yet. Your JewelryLead team turns it on; what you save here starts working then.</p>'}
      <label class="prow"><span>Email me about every new lead</span><input class="in" type="text" data-notify="alertEmails" placeholder="you@store.com, sales@store.com" value="${esc((pr.alertEmails || []).join(', '))}" /></label>
      <p class="hint">Up to 5 addresses, separated by commas. Each alert has the customer's details, their design page and the ready quote message. Reply to the alert to answer the customer directly.</p>
      <label class="prow"><span>Customer replies go to</span><input class="in" type="email" data-notify="replyTo" placeholder="you@store.com" value="${esc(pr.replyTo || '')}" /></label>
      <label class="pcheck"><input type="checkbox" data-notify="autoSend" ${pr.autoSend ? 'checked' : ''} /><span>Email the Estimated price message to every new customer automatically, a few minutes after they send the form, nights and weekends included. Only new leads nobody has answered yet. Needs the reply address above.</span></label></div>
    <div class="pfoot"><button class="btn gold" data-act="save-pricing">Save changes</button><span class="psaved" role="status"></span></div>
  </section>`;
}
function readPricing() {
  const out = { metals: {}, grams: {}, labor: {}, stones: {}, cuts: { ...(P.me.pricing?.cuts || {}) }, grillz: {} };
  for (const el of app.querySelectorAll('[data-price]')) {
    // Live polje: čuva se zlatarev broj (za Custom), ne današnja cijena.
    if (el.disabled && el.dataset.mkt) { if (el.dataset.custom === '') continue; }
    else if (el.value === '') continue;
    const parts = el.dataset.price.split('.');
    let o = out;
    for (const k of parts.slice(0, -1)) o = o[k] ||= {};
    o[parts[parts.length - 1]] = Number(el.disabled && el.dataset.mkt ? el.dataset.custom : el.value);
  }
  out.live = Object.fromEntries(MARKET_METALS.map((m) => [m.key, isLive(P.me.pricing, m.key)]));
  const info = app.querySelector('[data-quote-info]');
  out.quoteInfo = info ? info.value : P.me.pricing?.quoteInfo || '';
  for (const el of app.querySelectorAll('[data-link]')) out[el.dataset.link] = el.value.trim();
  // Obavještenja i prva poruka (21.11.2026); bez kartice (npr. drugi tab) ostaju sačuvana podešavanja.
  const ae = app.querySelector('[data-notify="alertEmails"]');
  out.alertEmails = ae ? ae.value.split(/[\s,;]+/).filter(Boolean) : P.me.pricing?.alertEmails || [];
  const rt = app.querySelector('[data-notify="replyTo"]');
  out.replyTo = rt ? rt.value.trim() : P.me.pricing?.replyTo || '';
  const as = app.querySelector('[data-notify="autoSend"]');
  out.autoSend = as ? as.checked : P.me.pricing?.autoSend === true;
  return out;
}

const readOnly = () => P.me?.session.kind === 'view-as';

const leadStore = createLeadStore(api);
let leadRequest = 0;
JLUI.watchLimits();
boot();
async function boot() {
  app.innerHTML = '<div class="center"><p class="faint">Loading your portal…</p></div>';
  // Token iz adrese (ili starog načina čuvanja u browseru) se zamijeni za kolačić pa nestane.
  const hash = location.hash;
  const legacyView = safe(() => JSON.parse(sessionStorage.getItem('aik_portal') || 'null'))?.token || safe(() => JSON.parse(localStorage.getItem('aik_view_as') || 'null'))?.token;
  const token = hash.match(/[#&]k=([a-z0-9]{20,})/)?.[1] || hash.match(/[#&]v=([a-z0-9]{20,})/)?.[1] || legacyView || safe(() => localStorage.getItem('aik_client'));
  // Link nosi id onboardinga (svaka forma ima svoj); stari linkovi imaju samo onboarding=1.
  const onboardingParam = new URLSearchParams(location.search).get('onboarding');
  const onboardingRequested = !!onboardingParam;
  if (onboardingParam && onboardingParam !== '1') P.obQuery = `?onboarding=${encodeURIComponent(onboardingParam)}`;
  if (hash) history.replaceState(null, '', location.pathname + location.search);
  safe(() => { sessionStorage.removeItem('aik_portal'); localStorage.removeItem('aik_view_as'); localStorage.removeItem('aik_client'); });
  if (token) {
    try { await api('/api/portal/session', { method: 'POST', body: JSON.stringify({ token }), json: true }); }
    catch (e) { return ended('This link no longer works', 'Ask your JewelryLead team for a new portal link.'); }
  }
  try {
    P.me = await api(`/api/portal/me${P.obQuery || ''}`);
  } catch (e) {
    return ended('Your portal', 'Open the portal link your JewelryLead team sent you.');
  }
  // A new setup draft must not hide a client's existing forms or enquiries.
  P.onboardingFlow = hasDraftOnboarding() && (onboardingRequested || (!P.me.forms.length && !P.me.stats.leads));
  P.tab = P.onboardingFlow ? 'onboarding' : 'leads';
  await Promise.all([loadLeads(), loadBookings()]);
  document.title = `${P.me.client.name} · JewelryLead`;
  render();
  setInterval(tick, 30_000);
  setInterval(pollBookings, 60_000);
}

const obUrl = (path) => path + (P.obQuery || '');
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, credentials: 'same-origin', headers: { ...(opts.json ? { 'content-type': 'application/json' } : {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}

// Render the selected filter immediately; only its current request may update the cards.
async function loadLeads(more = false) {
  const seq = ++leadRequest;
  P.loading = !more;
  P.loadingMore = more;
  P.loadError = '';
  const result = leadStore.load({ status: P.status, q: P.q, day: P.day, dfrom: rangeFrom(), piece: P.piece, video: P.video, before: more ? P.next : null, previous: P.leads });
  if (P.me) render();
  try {
    const r = await result;
    if (seq !== leadRequest || !r) return false;
    P.leads = r.leads;
    P.next = r.next;
    P.counts = r.counts;
    P.days = r.days || {};
    if (r.pieces && Object.keys(r.pieces).length) P.pieces = r.pieces;
    if (r.videoModels?.length) P.videoModels = r.videoModels;
  } catch (error) {
    if (seq !== leadRequest) return false;
    P.loadError = 'Could not load leads. Please try again.';
  }
  if (seq !== leadRequest) return false;
  P.loading = P.loadingMore = false;
  return true;
}

function ended(title, text) {
  app.innerHTML = `<div class="center"><div><h1>${esc(title)}</h1><p style="color:var(--ink-faint)">${esc(text)}</p></div></div>`;
}

const minsLeft = () => Math.max(0, Math.round((P.me.session.expiresAt - Date.now()) / 60000));
function tick() {
  if (P.me.session.expiresAt && Date.now() > P.me.session.expiresAt) {
    return P.me.session.kind === 'client' ? ended('This link has expired', 'Ask your JewelryLead team for a new portal link.') : ended('Session ended', 'The admin view lasts one hour. Open it again from the builder.');
  }
  const el = document.getElementById('left');
  if (el) el.textContent = `${minsLeft()} min`;
}

// Slike kupaca: pristup preko kolačića portala (bez tokena u adresi).
const media = (key) => `/media/${key}`;

const hasDraftOnboarding = () => P.me.onboarding?.status === 'draft';
function portalTabs() {
  const unseen = P.bookings?.unseen || 0;
  const tabs = [['leads', 'Leads'], ['forms', 'Forms'], ['pricing', 'Pricing'], ['bookings', `Bookings${unseen ? ` <span class="tab-badge" aria-label="${unseen} new">${unseen}</span>` : ''}`], ...(P.onboardingFlow && hasDraftOnboarding() ? [['onboarding', 'Store setup']] : [])];
  return `<nav class="tabs" aria-label="Client portal">${tabs.map(([key, label]) => `<button class="tab ${P.tab === key ? 'on' : ''}" data-tab="${key}" ${P.tab === key ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</nav>`;
}

function render() {
  const { client, forms, stats, session } = P.me;
  if (!hasDraftOnboarding()) {
    P.onboardingFlow = false;
    if (new URLSearchParams(location.search).has('onboarding')) {
      const url = new URL(location.href); url.searchParams.delete('onboarding'); history.replaceState(null, '', url.pathname + url.search);
    }
  }
  if (P.onboardingFlow && hasDraftOnboarding() && P.tab === 'onboarding') return renderOnboarding();
  if (P.tab === 'onboarding') P.tab = 'forms';
  const banner = session.kind === 'view-as'
    ? `<div class="viewas"><div class="wrap"><span>Admin view</span><span class="grow">Viewing as <b>${esc(client.name)}</b>, read-only. Ends in <b id="left">${minsLeft()} min</b>.</span><button class="btn warn" data-act="exit">Exit view</button></div></div>`
    : '';
  app.innerHTML = `
    ${banner}
    <header class="head"><div class="wrap">
      <div class="client">${client.logo ? `<img src="${esc(client.logo)}" alt="" />` : ''}<div><h1>${esc(client.name)}</h1><small>${esc(client.website || 'Client portal')}</small></div></div>
      <span class="powered">Powered by <a href="https://jewelrylead.com/" target="_blank" rel="noopener">JewelryLead</a></span>
      ${session.kind === 'client' ? '<button class="btn" data-act="signout" title="Remove the portal from this device">Sign out</button>' : ''}
    </div></header>
    <main class="wrap ${P.tab === 'leads' ? 'wide' : ''}">
      ${portalTabs()}
      ${bookingAlert()}
      <div class="stats">
        <div class="stat">Leads<b>${stats.leads}</b></div>
        <div class="stat">Last 30 days<b>${stats.recent}</b></div>
        <div class="stat">AI renders<b>${stats.renders}</b></div>
        <div class="stat">Videos<b>${stats.films || 0}</b></div>
        <div class="stat">Avg picture time<b>${secs(stats.renderMs)}</b></div>
        <div class="stat">Avg video time<b>${secs(stats.filmMs)}</b></div>
        ${speedTile(P.me.speed)}
      </div>
      ${usageView()}
      ${P.me.onboarding?.status === 'submitted' || P.me.onboarding?.status === 'building' ? `<div class="ob-sent"><b>Thank you, we have your answers.</b> We are building your form now and it will appear under Forms. Your leads will show up here as soon as customers use it.</div>` : ''}
      ${P.tab === 'leads' ? leadsView() : P.tab === 'pricing' ? pricingView() : P.tab === 'bookings' ? bookingsView() : formsView()}
      <p class="note">Want to change a form, add styles or questions? Contact your JewelryLead team.</p>
    </main>`;
}

// AI potrošnja ovog mjeseca naspram mjesečnog budžeta (vidi je i zlatar; trošak po formi ne).
function usageView() {
  const u = P.me.usage;
  if (!u) return '';
  const money = (n) => `$${(n || 0).toFixed(2)}`;
  const pct = Math.min(100, (u.spent / u.limit) * 100);
  const over = u.spent >= u.limit;
  const resets = new Date(u.resetsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `
    <div class="usage ${over ? 'over' : pct >= 80 ? 'near' : ''}">
      <div class="usage-top"><span>AI usage this month</span><b>${money(u.spent)} <small>of ${money(u.limit)}</small></b></div>
      <div class="usage-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${u.limit}" aria-valuenow="${u.spent}" aria-label="AI usage this month"><i style="width:${pct.toFixed(1)}%"></i></div>
      <small>${over ? 'Your monthly allowance is used up. Your form keeps working; your JewelryLead team will reach out.' : `${money(u.limit - u.spent)} left · resets ${esc(resets)}`}</small>
    </div>`;
}

function leadsView() {
  const total = Object.values(P.counts).reduce((a, b) => a + b, 0);
  if (!total && !P.q && !P.piece && !P.video && !P.loading && !P.loadError) return '<p class="empty">No leads yet. They appear here as soon as a customer finishes one of your forms.</p>';
  const forms = P.me.forms.filter((f) => f.leads);
  const statusChips = `<div class="chips" role="group" aria-label="Filter by status"><button class="chip ${P.status ? '' : 'on'}" data-status="">All <span>${total}</span></button>${STATUSES.map(([v, l]) => `<button class="chip ${P.status === v ? 'on' : ''}" data-status="${v}">${l} <span>${P.counts[v] || 0}</span></button>`).join('')}</div>`;
  const formChips = forms.length > 1
    ? `<div class="chips" role="group" aria-label="Filter by form"><button class="chip ${P.form ? '' : 'on'}" data-form="">All forms</button>${forms.map((f) => `<button class="chip ${P.form === f.id ? 'on' : ''}" data-form="${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div>`
    : '';
  // Filter po komadu (District 19.11.2026): grillz, privjesci, prstenje... sa brojem upita.
  const PIECE_NAMES = { grillz: 'Grillz', pendant: 'Pendants', ring: 'Rings', chain: 'Chains', bracelet: 'Bracelets', earrings: 'Earrings', watch: 'Watches' };
  const pieceList = Object.entries(P.pieces || {}).sort((a, b) => b[1] - a[1]);
  const pieceChips = pieceList.length > 1 || P.piece
    ? `<div class="chips" role="group" aria-label="Filter by piece"><button class="chip ${P.piece ? '' : 'on'}" data-piece="" aria-pressed="${!P.piece}">All pieces</button>${pieceList.map(([v, n]) => `<button class="chip ${P.piece === v ? 'on' : ''}" data-piece="${esc(v)}" aria-pressed="${P.piece === v}">${esc(PIECE_NAMES[v] || v[0].toUpperCase() + v.slice(1))} <span>${n}</span></button>`).join('')}</div>`
    : '';
  // Filter po video modelu (22.11.2026): svaki upit ima do tri videa (kupčev + dva za poređenje); čip pokazuje broj, a title vrijeme i cijenu.
  const vm = P.videoModels || [];
  const videoChips = vm.length > 1 || P.video
    ? `<div class="chips" role="group" aria-label="Filter by video model"><button class="chip ${P.video ? '' : 'on'}" data-video="" aria-pressed="${!P.video}">All videos</button>${vm.map((m) => `<button class="chip ${P.video === m.key ? 'on' : ''}" data-video="${esc(m.key)}" aria-pressed="${P.video === m.key}" title="${esc(`${m.label}${m.customer ? ', the video your customer sees' : ', only in your portal'}${m.ms ? `, about ${secs(m.ms)} to make` : ''}, about $${Number(m.cost).toFixed(2)} per video`)}">${esc(m.label)}${m.customer ? ' (customer)' : ''} <span>${m.count}</span></button>`).join('')}</div>`
    : '';
  const search = `<label class="search"><span class="sr-only">Search leads</span><input class="in" type="search" data-search placeholder="Search name, email or phone" value="${esc(P.q)}" /></label>`;
  const list = P.form ? P.leads.filter((l) => l.formId === P.form) : P.leads;
  const perDay = dayCounts(list);
  let lastDay = '';
  const cards = P.loading ? '<p class="empty" role="status">Loading leads…</p>' : P.loadError ? `<p class="empty" role="alert">${esc(P.loadError)} <button class="btn" data-act="retry-leads">Try again</button></p>` : list.map((l) => {
    const k = dayKey(l.created_at);
    const head = k !== lastDay ? `<h3 class="day-head"><span>${esc(dayTitle(k))}</span><b>${perDay[k] || 1} lead${(perDay[k] || 1) === 1 ? '' : 's'}</b></h3>` : '';
    lastDay = k;
    const last = l.renders[l.renders.length - 1];
    const photos = l.photos.map((p) => `<figure><img src="${media(p.key)}" alt="${esc(p.label)}" width="64" height="64" loading="lazy" data-zoom tabindex="0" /><figcaption>${esc(p.label)}</figcaption></figure>`).join('');
    // Izmjene koje je kupac tražio: sličica nosi broj, a cijeli tekst stoji ispod (ranije se vidio samo početak).
    const capOf = (r, k) => (k === 0 ? 'First render' : r.tweak ? `Change ${k}: ${r.tweak}` : `Render ${k + 1}`);
    const strip = l.renders.length > 1 ? l.renders.map((r, k) => `<figure><img src="${esc(r.url)}" alt="${esc(capOf(r, k))}" data-caption="${esc(capOf(r, k))}" width="64" height="64" loading="lazy" data-zoom tabindex="0" /><figcaption>${k === 0 ? 'First render' : r.tweak ? `Change ${k}` : `Render ${k + 1}`}</figcaption>${genTime(r.ms)}</figure>`).join('') : '';
    const changes = l.renders.map((r, k) => (k && r.tweak ? `<li><b>Change ${k}</b>${esc(r.tweak)}</li>` : '')).join('');
    const sel = `<select class="status-sel s-${esc(l.status)}" data-lead-status="${esc(l.id)}" aria-label="Status of ${esc(l.name)}" ${readOnly() ? 'disabled title="Admin view is read-only. The client changes the status in their own portal."' : ''}>${STATUSES.map(([v, t]) => `<option value="${v}" ${l.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    return `${head}
      <article class="lead has-calc">
        <div class="shot-col"><div class="shot ${last ? '' : 'none'}">${last ? `<img src="${esc(last.url)}" alt="AI render for ${esc(l.name)}" width="220" height="220" loading="lazy" data-zoom tabindex="0" />` : 'No render yet'}</div>${last ? genTime(last.ms, 'Picture made in') : ''}${pageBox(l)}</div>
        <div>
          <div class="lead-top"><h2>${esc(l.name)}</h2><span class="when">${esc(new Date(l.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))} · <span class="pill">${esc(l.form)}</span></span>${sel}</div>
          <div class="contact"><span class="cpair"><a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${copyBtn(l.email, 'email', l.id, 'email')}</span><span class="cpair"><a href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}">${esc(l.phone)}</a>${copyBtn(l.phone, 'phone number', l.id, 'phone')}</span></div>
          ${replyLine(l)}
          <div class="tags">${l.details.map((d) => `<span class="tag">${esc(d.label)}: <b>${esc(d.value)}</b></span>`).join('')}</div>
          ${l.vision ? `<p class="vision">"${esc(l.vision)}"</p>` : ''}
          <div class="thumbs">${strip}${photos}</div>
          ${changes ? `<div class="changes"><p class="changes-title">Changes the customer asked for</p><ol>${changes}</ol></div>` : ''}
          ${(l.films || []).length ? `<div class="films">${l.films.map((f) => (f.url ? `<figure><button type="button" class="film-tile" data-film="${esc(f.url)}" data-poster="${esc(last?.url || '')}" aria-label="Play the highlight video of ${esc(l.name)}"><video src="${esc(f.url)}" ${last ? `poster="${esc(last.url)}"` : ''} muted loop playsinline preload="none" tabindex="-1" aria-hidden="true"></video><span class="film-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span></button><figcaption><span class="film-model ${f.customer ? 'cust' : ''}">${esc(f.label || 'Video')}${f.customer ? ' · customer' : ''}</span>${f.cost != null ? ` · $${Number(f.cost).toFixed(2)}` : ''} · <a href="${esc(f.url)}" download>Download</a></figcaption>${genTime(f.ms, 'Video made in')}</figure>` : `<p class="film-wait"><span class="film-model ${f.customer ? 'cust' : ''}">${esc(f.label || 'Video')}</span> is being made. It appears here in a few minutes.</p>`)).join('')}</div>` : ''}
          <label class="lead-note"><span class="sr-only">Note</span><textarea class="in" rows="1" data-lead-note="${esc(l.id)}" placeholder="Add a note (quote sent, follow up Friday…)" ${readOnly() ? 'disabled' : ''}>${esc(l.note)}</textarea></label>
        </div>
        ${calcView(l)}
      </article>`;
  }).join('') || `<p class="empty">${P.day ? `No leads on ${esc(dayTitle(P.day))}.` : 'No leads match.'}</p>`;
  const more = P.next && !P.loading && !P.loadError ? `<div class="more"><button class="btn" data-act="more" ${P.loadingMore ? 'disabled' : ''}>${P.loadingMore ? 'Loading…' : 'Show older leads'}</button></div>` : '';
  // Traka ostaje i kad izabrani dan nema leadova, da se može izabrati drugi dan ili "All days".
  const chart = !P.loading && !P.loadError && (list.length || P.day) ? daysChart(perDay) : '';
  return `<div class="filters">${search}${statusChips}${pieceChips}${videoChips}${formChips}</div>${chart}${cards}${more}`;
}

// Stranica kupca (19.11.2026): link ispod slike, otvaranje bez brojanja posjete, posjete i klikovi na Deposit / Book.
const ACTION_LABEL = { deposit: 'Asked to place a deposit', appointment: 'Asked for an appointment' };
const when = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function pageBox(l) {
  const pg = l.page;
  if (!pg?.url) return '';
  const full = `${location.origin}${pg.url}`;
  const acts = (pg.actions || []).slice(-3).reverse().map((a) => `<li><b>${esc(ACTION_LABEL[a.action] || a.action)}</b>${a.option === 'fit' ? ' · Option 2' : a.option === 'picked' ? ' · Option 1' : ''}<span>${esc(when(a.at))}</span></li>`).join('');
  return `<div class="lpage"><p class="lpage-t">Customer page</p>
    <div class="lpage-row"><a class="lpage-link" href="${esc(pg.url)}?preview=1" target="_blank" rel="noopener" title="${esc(full)}">Open page ↗</a>${copyBtn(full, 'customer page link')}</div>
    <p class="lpage-v">${pg.views ? `Viewed ${pg.views}× · last ${esc(when(pg.lastView))}` : 'Not opened yet'}</p>
    ${acts ? `<ul class="lpage-acts">${acts}</ul>` : ''}</div>`;
}

// Copy pored mejla i telefona (District 19.11.2026): jedan klik kopira, ikonica se na trenutak pretvori u kvačicu.
const COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const DONE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// lead + kind: kopiranje mejla ili telefona se bilježi kao korak (21.11.2026, dokaz brzine odgovora).
const copyBtn = (v, what, lead = '', kind = '') => (v ? `<button type="button" class="copy-btn" data-copy="${esc(v)}" ${lead ? `data-copy-lead="${esc(lead)}" data-copy-what="${esc(kind)}"` : ''} data-label="Copy ${what}" aria-label="Copy ${what}" title="Copy ${what}">${COPY_ICON}</button>` : '');
// Korak iz portala za dnevnik leada; admin pregled se ne broji, greška ne smeta zlataru.
const track = (id, body) => { if (readOnly() || !id) return; api(`/api/portal/leads/${encodeURIComponent(id)}/events`, { method: 'POST', body: JSON.stringify(body), json: true }).catch(() => {}); };
// Vrijeme do prvog odgovora (statistika na vrhu i red na kartici leada).
const mins = (m) => (m < 1 ? '< 1 min' : m < 60 ? `${Math.round(m)} min` : m < 48 * 60 ? `${Math.round((m / 60) * 10) / 10} h` : `${Math.round(m / 1440)} days`);
function speedTile(sp) {
  if (!sp) return '';
  return `<div class="stat" title="Time from a new lead to the first reply: a copied quote message, status Contacted, Quoted or Won, or the automatic first email. Last 30 days.">First reply, median<b>${esc(sp.medianMin == null ? 'Not yet' : mins(sp.medianMin))}</b><small class="stat-sub">${sp.replied} of ${sp.leads} lead${sp.leads === 1 ? '' : 's'} answered${sp.auto ? ` · ${sp.auto} automatically` : ''}</small></div>`;
}
function replyLine(l) {
  const bits = [];
  if (l.autoSentAt) bits.push(`First message emailed automatically ${when(l.autoSentAt)}`);
  else if (l.firstReplyAt) bits.push(`First reply ${when(l.firstReplyAt)} (${mins((l.firstReplyAt - l.created_at) / 60_000)} after the lead)`);
  if (l.alertedAt) bits.push(`Alert emailed to you ${when(l.alertedAt)}`);
  return bits.length ? `<p class="reply-line">${bits.map(esc).join(' · ')}</p>` : '';
}
async function copyText(btn, text) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
  }
  if (!ok) return false;
  clearTimeout(btn._t);
  btn.classList.add('done'); btn.innerHTML = DONE_ICON; btn.setAttribute('aria-label', 'Copied'); btn.title = 'Copied';
  btn._t = setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = COPY_ICON; btn.setAttribute('aria-label', btn.dataset.label || 'Copy'); btn.title = btn.dataset.label || 'Copy'; }, 1400);
  return true;
}

function formsView() {
  return P.me.forms.map((f) => {
    return `
      <div class="form-card">
        <div class="row"><h2>${esc(f.name)}</h2><span class="pill">${esc(f.label)}</span><span class="pill">Active</span><a class="btn" href="/f/${esc(f.id)}" target="_blank" rel="noopener">Open form ↗</a></div>
        <div class="fstats"><span><b>${f.leads}</b> lead${f.leads === 1 ? '' : 's'}</span><span><b>${f.renders}</b> AI render${f.renders === 1 ? '' : 's'}</span><span>Last lead: <b>${f.lastLead ? esc(day(f.lastLead)) : 'none yet'}</b></span>${f.leads ? `<button class="btn" data-see="${esc(f.id)}">See leads</button>` : ''}</div>
      </div>`;
  }).join('') || '<p class="empty">No forms yet.</p>';
}

function zoom(src, caption = '') {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Image');
  box.tabIndex = -1;
  box.innerHTML = `<figure><img src="${esc(src)}" alt="" />${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  box.onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.appendChild(box);
  box.focus();
}

// Video komada (19.11.2026): u listi je mala pločica (na prelaz mišem se pusti), klik ga otvara veliko i pušta u petlji.
// Ranije je bio mali <video controls> od 160 px, pa se pokret skoro nije vidio ("slika stoji").
function zoomVideo(src, poster = '') {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Highlight video');
  box.tabIndex = -1;
  box.innerHTML = `<figure><video src="${esc(src)}" ${poster ? `poster="${esc(poster)}"` : ''} autoplay muted loop playsinline controls preload="auto"></video><figcaption>Highlight video · <a href="${esc(src)}" download>Download</a></figcaption></figure>`;
  const close = () => { box.querySelector('video')?.pause(); box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  box.onclick = (e) => { if (!e.target.closest('video, a')) close(); };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(box);
  box.focus();
  box.querySelector('video').play().catch(() => {});
}
app.addEventListener('mouseover', (e) => {
  const t = e.target.closest?.('.film-tile');
  if (t && !t.contains(e.relatedTarget)) { const v = t.querySelector('video'); v.play().catch(() => {}); t.classList.add('playing'); }
});
app.addEventListener('mouseout', (e) => {
  const t = e.target.closest?.('.film-tile');
  if (t && !t.contains(e.relatedTarget)) { const v = t.querySelector('video'); v.pause(); t.classList.remove('playing'); }
});

let searchTimer;
app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.qmsg && Q[el.dataset.qmsg]) { Q[el.dataset.qmsg].msg = el.value; el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; queueQuoteSave(el.dataset.qmsg); return; }
  if (el.dataset.qrange) { priceLive(el.dataset.qrange, el.value); return; }
  if (el.dataset.price && /^(stones\.|setting$)/.test(el.dataset.price)) renderStoneExample();
  if (el.dataset.qprice) { if (Number(el.value) > 0) priceLive(el.dataset.qprice, el.value); return; }
  if (el.dataset.search !== undefined) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => { P.q = el.value.trim(); if (!await loadLeads()) return; render(); const s = app.querySelector('[data-search]'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }, 350);
  }
});
app.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.qmsg) { saveQuoteNow(el.dataset.qmsg); return; }
  if (el.dataset.qrange) { priceCommit(el.dataset.qrange); return; }
  if (el.dataset.qprice) { if (Number(el.value) > 0) { priceLive(el.dataset.qprice, el.value); priceCommit(el.dataset.qprice); } else renderCalc(qkLead(el.dataset.qprice)); return; }
  if (el.dataset.q && el.dataset.qf) { quoteEdit(el.dataset.q, el.dataset.qf, el.value); return; }
  if (el.dataset.pickDay !== undefined) { P.day = el.value || ''; if (await loadLeads()) render(); return; }
  if (el.dataset.leadStatus) {
    const id = el.dataset.leadStatus;
    const prev = P.leads.find((l) => l.id === id)?.status;
    try {
      await api(`/api/portal/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status: el.value }), json: true });
      const l = P.leads.find((x) => x.id === id);
      if (l) { P.counts[prev] = Math.max(0, (P.counts[prev] || 1) - 1); P.counts[el.value] = (P.counts[el.value] || 0) + 1; l.status = el.value; }
      leadStore.update(id, { status: el.value }, P.counts);
      if (await loadLeads()) render();
      el.className = `status-sel s-${el.value}`;
    } catch (err) { JLUI.alert(err.message); el.value = prev; }
  }
  if (el.dataset.leadNote) {
    try { await api(`/api/portal/leads/${el.dataset.leadNote}`, { method: 'PATCH', body: JSON.stringify({ note: el.value }), json: true }); const l = P.leads.find((x) => x.id === el.dataset.leadNote); if (l) l.note = el.value; leadStore.update(el.dataset.leadNote, { note: el.value }, P.counts); el.classList.add('saved'); setTimeout(() => el.classList.remove('saved'), 1200); }
    catch (err) { JLUI.alert(err.message); }
  }
});
app.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.zoom !== undefined) { e.preventDefault(); zoom(e.target.src, e.target.dataset.caption); }
});

app.addEventListener('click', async (e) => {
  const t = e.target.closest('button, img[data-zoom]') || e.target;
  if (t.dataset?.film) { zoomVideo(t.dataset.film, t.dataset.poster); return; }
  if (t.dataset?.copy != null) { if ((await copyText(t, t.dataset.copy)) && t.dataset.copyLead) track(t.dataset.copyLead, { type: 'contact_copied', what: t.dataset.copyWhat }); return; }
  // Quote radni sto (Fits the budget): izbori, reset, poruka.
  if (t.tagName === 'BUTTON' && t.dataset.q && t.dataset.qf) { quoteEdit(t.dataset.q, t.dataset.qf, t.dataset.qv, t.dataset.qd); return; }
  if (t.dataset?.act === 'quote-reset') { quoteReset(t.dataset.q); return; }
  if (t.dataset?.live) { setLive(t.dataset.live, t.dataset.on === '1'); return; }
  if (t.dataset?.pexPiece) { PEX.piece = t.dataset.pexPiece; renderStoneExample(); return; }
  if (t.dataset?.pexStone) { PEX.stone = t.dataset.pexStone; renderStoneExample(); return; }
  if (t.dataset?.act === 'price-reset') { const key = t.closest('.qprice')?.dataset.qk; const q = Q[key]; if (q) { const e = estimate(PR(), q.spec); if (e.total != null) priceLive(key, Math.round(e.total)); priceCommit(key); } return; }
  if (t.dataset?.act === 'quote-gen') { quoteGenerate(t.dataset.qk); return; }
  if (t.dataset?.act === 'quote-copy') {
    const id = t.dataset.qk;
    const l = P.leads.find((x) => x.id === qkLead(id));
    const msg = app.querySelector(`[data-qmsg="${CSS.escape(id)}"]`)?.value ?? Q[id]?.msg ?? '';
    if (!l || !msg) return;
    {
      const note = t.parentElement.querySelector('.qcopied');
      try { await navigator.clipboard.writeText(msg); track(l.id, { type: 'quote_copied', slot: id.includes('|') ? 'picked' : 'fit' }); if (note) { note.textContent = 'Copied'; setTimeout(() => { note.textContent = ''; }, 1600); } }
      catch { const ta = app.querySelector(`[data-qmsg="${CSS.escape(id)}"]`); ta?.select(); if (note) note.textContent = 'Press Cmd+C to copy'; }
    }
    return;
  }
  if (t.dataset.tab) { P.tab = t.dataset.tab; render(); if (P.tab === 'bookings') openBookings(); }
  if (t.dataset.act === 'see-bookings') { P.tab = 'bookings'; render(); openBookings(); return; }
  if (t.dataset.seeLead) { P.tab = 'leads'; P.q = t.dataset.seeLead; P.status = ''; P.piece = ''; P.video = ''; P.day = ''; if (await loadLeads()) render(); return; }
  if (t.dataset.form !== undefined) { P.form = t.dataset.form; render(); }
  if (t.dataset.piece !== undefined) { P.piece = t.dataset.piece; if (await loadLeads()) render(); }
  if (t.dataset.video !== undefined) { P.video = t.dataset.video; if (await loadLeads()) render(); }
  if (t.dataset.status !== undefined) { P.status = t.dataset.status; if (await loadLeads()) render(); }
  if (t.dataset.range) { P.range = t.dataset.range; P.shift = 0; if (await loadLeads()) render(); }
  if (t.dataset.shift) { P.shift = Math.max(0, P.shift + Number(t.dataset.shift)); if (await loadLeads()) render(); }
  if (t.dataset.day) { P.day = P.day === t.dataset.day ? '' : t.dataset.day; if (await loadLeads()) render(); }
  if (t.dataset.act === 'all-days') { P.day = ''; if (await loadLeads()) render(); }
  if (t.dataset.act === 'fill-pricing') {
    for (const el of app.querySelectorAll('[data-price]')) {
      if (el.value !== '') continue;
      const v = el.dataset.price.split('.').reduce((o, k) => (o == null ? undefined : o[k]), SUGGESTED_PRICING);
      if (typeof v === 'number') el.value = v;
    }
    const note = app.querySelector('.psaved'); if (note) note.textContent = 'Suggested prices filled in, not saved yet.';
  }
  if (t.dataset.act === 'save-pricing') {
    const note = app.querySelector('.psaved');
    try { const r = await api('/api/portal/pricing', { method: 'PUT', body: JSON.stringify({ pricing: readPricing() }), json: true }); P.me.pricing = r.pricing; if (note) note.textContent = r.pricing.autoSend && !r.pricing.replyTo ? 'Saved. Add the reply address to start the automatic first message.' : 'Saved'; }
    catch (err) { if (note) note.textContent = err.message || 'Could not save.'; }
  }
  if (t.dataset.see) { P.tab = 'leads'; P.form = t.dataset.see; render(); }
  if (t.dataset.act === 'more' || t.dataset.act === 'retry-leads') { if (await loadLeads(t.dataset.act === 'more')) render(); }
  if (t.dataset.act === 'signout') {
    if (!(await JLUI.confirm('Sign out on this device? You can come back with your portal link.'))) return;
    try { await api('/api/portal/logout', { method: 'POST' }); } catch {}
    ended('Signed out', 'Open your portal link again to come back.');
  }
  if (t.dataset.act === 'exit') {
    try { await api('/api/portal/exit', { method: 'POST' }); } catch {}
    ended('Admin view closed', 'You can close this tab.');
  }
  if (t.dataset.zoom !== undefined) zoom(t.src, t.dataset.caption);
});

// ---------- Onboarding (vodič za zlatara) ----------
// Zlatar popuni radnju i komade, pa svaki komad redom (stilovi, materijali i budžet, detalji), proizvode iz radnje i napomene.
// Sve se čuva samo; Send šalje adminu. Korak je ključ ('store', 'p:<uid>:materials'...), ne redni broj.
const OB_PIECE_STEPS = [['styles', 'Styles'], ['materials', 'Materials & budget'], ['details', 'Details']];
function obSteps() {
  const out = [['store', 'Your store'], ['pieces', 'What you make']];
  for (const pc of OB.d.pieces) for (const [k, l] of OB_PIECE_STEPS) out.push([`p:${pc.uid}:${k}`, l]);
  out.push(['products', 'Shop products'], ['extras', 'Notes for our team'], ['send', 'Review & send']);
  return out;
}
const obIdx = () => Math.max(0, obSteps().findIndex(([k]) => k === OB.step));
// Komad na kojem je zlatar (null van koraka komada).
const obPiece = () => { const m = /^p:([^:]+):/.exec(OB.step); const i = m ? OB.d.pieces.findIndex((pc) => pc.uid === m[1]) : -1; return i < 0 ? null : { i, pc: OB.d.pieces[i], sub: OB.step.split(':')[2] }; };
const obGo = (key) => { OB.step = obSteps().some(([k]) => k === key) ? key : 'pieces'; };
const ACCENTS = ['#35d0c4', '#d8b46a', '#e7a9a0', '#9b8cff', '#5aa9ff', '#ef6f6f', '#f2f2f2'];
const OB = { fixing: false, d: null, step: 'store', timer: null, saving: false, savedAt: 0, err: '', dirty: false, rev: 0, inflight: null, retry: null, uploads: new Map(), submitting: false, previewBg: null, previewTimer: null, previewSeq: 0, previewStep: -1 };
// Stabilan id za komade i stilove: slika se upiše u pravi stil i kad se u međuvremenu doda ili ukloni neki drugi.
const uid = () => Math.random().toString(36).slice(2, 10);

function obInit() {
  const defs = P.me.onboardingDefaults;
  const d = structuredClone(P.me.onboarding.data || {});
  d.store = { name: P.me.client.name, website: P.me.client.website || '', accent: '#35d0c4', theme: 'dark', ...(d.store || {}) };
  d.pieces = Array.isArray(d.pieces) ? d.pieces : [];
  d.metals = Array.isArray(d.metals) ? d.metals : defs.metals.map((m) => m.value);
  d.stones = Array.isArray(d.stones) ? d.stones : defs.stones.map((s) => s.value);
  d.budgets = Array.isArray(d.budgets) ? d.budgets : [...defs.budgets];
  d.customMetals = Array.isArray(d.customMetals) ? d.customMetals.map((m) => ({ ...m, uid: m.uid || uid(), swatch: /^#[0-9a-f]{6}$/i.test(m.swatch || '') ? m.swatch : '#c0c4c8' })) : [];
  d.customStones = Array.isArray(d.customStones) ? d.customStones.map((m) => ({ ...m, uid: m.uid || uid() })) : [];
  d.customKarats = Array.isArray(d.customKarats) ? d.customKarats : [];
  // Ranije upisani "Other metals" postaju prave opcije, bez gubitka podataka.
  for (const label of String(d.metalsOther || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const value = `custom-${uid()}`;
    d.customMetals.push({ uid: uid(), value, label: label.slice(0, 40), swatch: '#c0c4c8' }); d.metals.push(value);
  }
  d.metalsOther = '';
  for (const pc of d.pieces) { pc.uid ||= uid(); for (const st of pc.styles || []) st.uid ||= uid(); obPieceDefaults(pc, d); }
  d.products = Array.isArray(d.products) ? d.products : [];
  for (const x of d.products) { x.uid ||= uid(); x.pieces = Array.isArray(x.pieces) ? x.pieces : []; }
  OB.d = d;
  OB.rev = P.me.onboarding.rev || 0;
  // Stariji nacrt pamti redni broj koraka (0 radnja ... 5 slanje).
  let st = d.step;
  if (typeof st === 'number' || /^\d+$/.test(String(st ?? ''))) {
    const k = ['store', 'pieces', 'styles', 'materials', 'extras', 'send'][+st] || 'store';
    st = ['styles', 'materials'].includes(k) ? (d.pieces[0] ? `p:${d.pieces[0].uid}:${k}` : 'pieces') : k;
  }
  OB.step = 'store';
  if (st) obGo(st);
}
// Svaki komad ima svoje metale, karate, kamenje, budžet, specifikacije i pitanja. Početno: zajedničke liste.
function obPieceDefaults(pc, d = OB.d) {
  const defs = P.me.onboardingDefaults;
  pc.styles ||= [];
  pc.metals ||= [...d.metals];
  pc.karats ||= [...defs.karats];
  pc.stones ||= [...d.stones];
  pc.budgets ||= [...d.budgets];
  pc.specs = pc.specs && typeof pc.specs === 'object' && !Array.isArray(pc.specs) ? pc.specs : {};
  pc.questions = Array.isArray(pc.questions) ? pc.questions : [];
  for (const q of pc.questions) q.uid ||= uid();
  pc.customSpecs = pc.customSpecs && typeof pc.customSpecs === 'object' && !Array.isArray(pc.customSpecs) ? pc.customSpecs : {};
  for (const list of Object.values(pc.customSpecs)) for (const c of list) c.uid ||= uid();
  // Required step: stilovi i materijali su podrazumijevano obavezni za kupca, detalji nisu.
  pc.required = { styles: true, materials: true, details: false, ...(pc.required || {}) };
}

const obGet = (path) => path.split('.').reduce((x, k) => x?.[k], OB.d);
function obSet(path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  const t = ks.reduce((x, k) => x[k], OB.d);
  t[last] = v;
}

function obSave(now = false) {
  if (readOnly() || OB.submitting || !OB.d) return; // admin pregled ne mijenja klijentove odgovore
  OB.dirty = true;
  clearTimeout(OB.timer);
  clearTimeout(OB.retry);
  const go = async () => {
    if (OB.submitting || !OB.d) return;
    if (OB.saving) { OB.timer = setTimeout(go, 300); return; }
    OB.saving = true;
    OB.dirty = false;
    obStatus();
    OB.inflight = (async () => {
      try {
        const r = await api(obUrl('/api/portal/onboarding'), { method: 'PUT', body: JSON.stringify({ data: { ...OB.d, step: OB.step }, rev: OB.rev }), json: true });
        OB.rev = r.rev;
        OB.savedAt = Date.now();
        OB.err = '';
      } catch (e) {
        // Drugi uređaj je sačuvao novije odgovore: preuzmi ih umjesto da ih prepišeš.
        if (e.data?.conflict && e.data.data) {
          OB.rev = e.data.rev;
          OB.d = null;
          P.me.onboarding.data = e.data.data;
          P.me.onboarding.rev = e.data.rev;
          renderOnboarding();
          JLUI.alert('Your answers were updated on another device. You now see the latest version.');
          return;
        }
        OB.err = e.message;
        OB.dirty = true;
        OB.retry = setTimeout(() => obSave(true), 5000); // mreža: pokušaj ponovo za 5 s
      } finally {
        OB.saving = false;
        obStatus();
      }
    })();
    await OB.inflight;
  };
  if (now) go(); else OB.timer = setTimeout(go, 700);
}
function obStatus() {
  const el = document.getElementById('ob-status');
  if (!el) return;
  el.className = `ob-status ${OB.err ? 'err' : ''}`;
  el.textContent = OB.err ? `Not saved: ${OB.err}` : OB.saving || OB.dirty ? 'Saving…' : OB.savedAt ? 'All changes saved' : 'Saves automatically';
}
// Zatvaranje taba usred kucanja: pošalji zadnje izmjene.
addEventListener('pagehide', () => {
  if (!OB.d || !OB.dirty || readOnly()) return;
  const body = JSON.stringify({ data: { ...OB.d, step: OB.step }, rev: OB.rev });
  if (body.length > 60_000) return; // keepalive prima najviše 64 KB; ostalo je već sačuvano usput
  try { fetch(obUrl('/api/portal/onboarding'), { method: 'PUT', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body }); } catch {}
});
addEventListener('beforeunload', (e) => { if (OB.d && (OB.dirty || OB.saving) && !readOnly()) { e.preventDefault(); e.returnValue = ''; } });

function renderOnboarding() {
  // Late saves and uploads may finish after the client has opened another tab.
  if (P.tab !== 'onboarding' || !P.onboardingFlow || !hasDraftOnboarding()) return;
  if (!OB.d) obInit();
  if (!document.getElementById('ob-editor')) app.innerHTML = '<div id="ob-editor"></div><div class="wrap" id="ob-preview-host"></div>';
  const editor = document.getElementById('ob-editor');
  const restoreImages = JLUI.images(editor);
  const { client, session } = P.me;
  const banner = session.kind === 'view-as' ? `<div class="viewas"><div class="wrap"><span>Admin view</span><span class="grow">Viewing <b>${esc(client.name)}</b>'s onboarding, read-only: nothing you change here is saved.</span><button class="btn warn" data-act="exit">Exit view</button></div></div>` : '';
  // Gornja traka: radnja, komadi, pa svaki izabrani komad kao svoja grupa (stilovi, materijali, detalji), pa ostalo.
  if (!obSteps().some(([k]) => k === OB.step)) obGo(OB.step);
  const groups = [['store', 'Your store'], ['pieces', 'What you make'], ...OB.d.pieces.map((pc) => [`p:${pc.uid}:`, pc.label || 'Piece']), ['products', 'Shop products'], ['extras', 'Notes'], ['send', 'Review & send']];
  const g = groups.findIndex(([k]) => OB.step === k || (k.endsWith(':') && OB.step.startsWith(k)));
  const open = obCan('store') && obCan('pieces');
  const bad = OB.fixing || OB.step === 'send' ? new Set(obProblems().map((x) => x.step.replace(/^(p:[^:]+:).*/, '$1'))) : new Set();
  const steps = groups.map(([k, l], i) => `<button class="ob-dot ${bad.has(k) ? 'bad' : ''} ${k.endsWith(':') ? 'piece' : ''} ${i === g ? 'now' : i < g ? 'done' : ''}" data-ob-go="${esc(k.endsWith(':') ? `${k}styles` : k)}" ${i > g && !open ? 'disabled' : ''}><span>${i + 1}</span>${esc(l)}</button>`).join('');
  editor.innerHTML = `
    ${banner}
    <header class="head"><div class="wrap">
      <div class="client">${client.logo || OB.d.store.logo ? `<img src="${esc(OB.d.store.logo || client.logo)}" alt="" />` : ''}<div><h1 data-store-heading>${esc(OB.d.store.name || client.name)}</h1><small>Store setup</small></div></div>
      <span class="ob-status" id="ob-status"></span>
    </div></header>
    <main class="wrap ob">
      ${portalTabs()}
      <nav class="ob-steps">${steps}</nav>
      <div id="ob-fix"></div>
      <section class="ob-card">${obStepView()}</section>
      <div class="ob-nav">
        ${obIdx() > 0 ? '<button class="btn" data-ob-act="back">Back</button>' : '<span></span>'}
        ${obIdx() < obSteps().length - 1 ? `<button class="btn primary" data-ob-act="next" ${obCan(OB.step) ? '' : 'disabled'}>${obNextLabel()}</button>` : ''}
      </div>
      <p class="note">Everything saves automatically. You can close this page and come back with the same link.</p>
    </main>`;
  restoreImages();
  obLimits(editor);
  if (!document.getElementById('ob-preview-frame')) document.getElementById('ob-preview-host').innerHTML = `
      <section class="ob-preview" aria-label="Live form preview">
        <div class="ob-preview-bar"><div><h2>Your customer form</h2><p>Updates as you make choices. Notes to our team stay private.</p></div><label class="ob-bg"><span>Your website background</span><input type="color" data-preview-bg value="${esc(obPreviewBackground())}" /></label></div>
        <p class="ob-preview-hint">Try a background like your website. This setting only changes this preview.</p>
        <div class="ob-preview-stage" id="ob-preview-stage" style="background:${esc(obPreviewBackground())}"><iframe id="ob-preview-frame" src="/f/onboarding-preview?preview=1&onboarding=${esc(new URLSearchParams(P.obQuery || '').get('onboarding') || '1')}" title="Your live customer form"></iframe></div>
        <p class="ob-err" id="ob-preview-error" role="status"></p>
      </section>`;
  syncPreviewBackground();
  queueOnboardingPreview();
  obStatus();
  obMarkProblems();
}

// Šta još ne valja: zlatar vidi poruku, ide tačno na to polje i ne može poslati dok nije ispravljeno (isto pravilo provjerava i server).
const obProblems = () => (OB.d ? onboardingProblems(OB.d) : []);
function obFix(problem) {
  OB.fixing = true;
  obGo(problem.step);
  obSave(true);
  renderOnboarding();
  const el = problem.field ? document.querySelector(`[data-ob="${problem.field}"]`) : null;
  (el || document.getElementById('ob-fix'))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el?.focus({ preventScroll: true });
}
function obMarkProblems() {
  const box = document.getElementById('ob-fix');
  if (!box) return;
  document.querySelectorAll('.ob-invalid').forEach((x) => x.classList.remove('ob-invalid'));
  document.querySelectorAll('.ob-field-err').forEach((x) => x.remove());
  if (!OB.fixing) { box.innerHTML = ''; return; }
  const all = obProblems();
  const here = all.filter((x) => x.step === OB.step);
  for (const x of here) {
    const el = x.field && document.querySelector(`[data-ob="${x.field}"]`);
    if (!el) continue;
    el.classList.add('ob-invalid');
    const note = document.createElement('p');
    note.className = 'ob-field-err';
    note.textContent = x.message;
    (el.closest('.ob-custom') || el).after(note);
  }
  const next = all[0];
  box.innerHTML = `<div class="ob-fix ${here.length ? '' : 'ok'}" role="status"><div><b>${here.length ? esc(here[0].message) : all.length ? 'Fixed here.' : 'Everything is fixed.'}</b>${here.length ? '<small>Fix this to continue sending.</small>' : ''}</div>
    ${here.length ? (all.length > 1 ? `<span class="ob-fix-count">${all.length} left</span>` : '') : `<button class="btn primary" data-ob-act="${next ? 'fix-next' : 'fix-done'}">${next ? `Next fix (${all.length} left)` : 'Back to Review & send'}</button>`}</div>`;
}

// Dugme dalje kaže kuda vodi kad se prelazi na sljedeći komad.
function obNextLabel() {
  const next = obSteps()[obIdx() + 1]?.[0] || '';
  const here = obPiece();
  const m = /^p:([^:]+):styles$/.exec(next);
  if (m && here?.pc.uid !== m[1]) return `Continue to ${esc(OB.d.pieces.find((pc) => pc.uid === m[1])?.label || 'next piece')}`;
  return 'Continue';
}

function obPreviewBackground() {
  return OB.previewBg || (OB.d?.store.theme === 'light' ? '#faf7f2' : '#070b0c');
}
function syncPreviewBackground() {
  const color = obPreviewBackground();
  const stage = document.getElementById('ob-preview-stage');
  if (stage) stage.style.background = color;
  const picker = document.querySelector('[data-preview-bg]');
  if (picker) picker.value = color;
}

function queueOnboardingPreview() {
  clearTimeout(OB.previewTimer);
  const seq = ++OB.previewSeq;
  OB.previewTimer = setTimeout(async () => {
    if (!OB.d) return;
    try {
      const { form } = await api(obUrl('/api/portal/onboarding/preview'), { method: 'POST', body: JSON.stringify({ data: OB.d }), json: true });
      if (seq !== OB.previewSeq || !OB.d) return;
      const jump = {};
      if (OB.previewStep !== OB.step) {
        // Pregled prati komad na kojem je zlatar: njegovi stilovi, materijali ili detalji.
        const types = form.steps.find((s) => s.id === 'type')?.fields.find((f) => f.id === 'type')?.options || [];
        const here = obPiece();
        const k = here ? OB.d.pieces.filter((pc) => String(pc.label || '').trim()).indexOf(here.pc) : 0;
        const type = types[Math.max(0, k)]?.value;
        const target = { styles: (s) => s.id === 'style', materials: (s) => s.id === 'design', details: (s) => s.fields.some((f) => f.showIf?.field === 'type' && f.showIf.in?.includes(type)) }[here?.sub] || ((s) => s.id === 'type');
        const step = form.steps.findIndex(target);
        if (OB.step === 'products') jump.products = true;
        else if (step >= 0) jump.step = step;
        if (type) jump.answers = { type };
        OB.previewStep = OB.step;
      }
      // Prelazak na drugi korak (i komad) nije "mekan": pregled pređe na taj komad.
      document.getElementById('ob-preview-frame')?.contentWindow.postMessage({ type: 'aik:preview', form, admin: false, soft: !jump.answers, ...jump }, location.origin);
      const err = document.getElementById('ob-preview-error'); if (err) err.textContent = '';
    } catch { const err = document.getElementById('ob-preview-error'); if (err) err.textContent = 'Preview could not update. Your answers are still here; keep editing to retry.'; }
  }, 220);
}
addEventListener('message', (e) => {
  const frame = document.getElementById('ob-preview-frame');
  if (!frame || e.origin !== location.origin || e.source !== frame.contentWindow) return;
  if (e.data?.type === 'aik:preview-ready') { OB.previewStep = -1; queueOnboardingPreview(); }
  if (e.data?.type === 'aik:resize' && Number.isFinite(e.data.height) && e.data.height > 0) frame.style.height = `${Math.max(640, Math.ceil(e.data.height) + 2)}px`;
});

// Može dalje: radnja treba ime, a "What you make" bar jedan komad.
function obCan(key) {
  if (key === 'store') return !!String(OB.d.store.name || '').trim();
  if (key === 'pieces') return OB.d.pieces.length > 0;
  return true;
}

const obPick = (path, { label = 'Upload photo', cls = '' } = {}) => {
  const v = obGet(path);
  const owner = path === 'store.logo' ? '' : obGet(path.replace(/\.image$/, ''))?.uid || '';
  const busy = OB.uploads.has(owner || path);
  return `<label class="ob-photo ${cls} ${v ? 'has' : ''} ${busy ? 'jl-uploading' : ''}" title="${v ? 'Change photo or drop a new one' : 'Upload or drop a photo'}">${v ? `<img src="${esc(v)}" alt="" />` : `<span><b>${esc(label)}</b><small>or drag & drop here</small></span>`}<input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp" data-ob-file="${path}" data-uid="${esc(owner)}" ${readOnly() || busy ? 'disabled' : ''} />${busy ? '<span class="jl-upload-progress" role="status"><span class="jl-spinner"></span>Uploading photo…</span>' : ''}</label>`;
};

// Isti limiti kao cleanOnboarding na serveru: polje ne pusti više nego što se čuva, a brojač se vidi dok se kuca.
const OB_LIMITS = [
  [/^store\.name$/, 60], [/^store\.website$/, 200], [/^pieces\.\d+\.label$/, 60], [/\.styles\.\d+\.label$/, 40], [/\.styles\.\d+\.note$/, 300],
  [/\.budgets\.\d+$/, 40], [/\.questions\.\d+\.label$/, 120], [/\.questions\.\d+\.options$/, 600],
  [/^products\.\d+\.name$/, 80], [/^products\.\d+\.price$/, 30], [/^products\.\d+\.url$/, 500], [/^products\.\d+\.description$/, 300],
  [/^notes$/, 2000], [/^questions$/, 2000],
];
const obLimits = (root) => root.querySelectorAll('input[data-ob], textarea[data-ob]').forEach((el) => {
  const max = OB_LIMITS.find(([re]) => re.test(el.dataset.ob))?.[1];
  if (max) el.maxLength = max;
});

// Brzo dodavanje: opcije koje imamo u biblioteci i one koje su dodale ranije radnje (samo natpisi, nikad tuđe fotografije).
function obSuggest(kind, items, taken, attrs = '') {
  const have = new Set(taken.map((x) => String(x ?? '').trim().toLowerCase()));
  const left = (items || []).filter((x) => !have.has(String(x.label ?? x).toLowerCase())).slice(0, 16);
  if (!left.length) return '';
  return `<div class="ob-suggest"><small>Quick add</small>${left.map((x) => `<button class="ob-chip small add" data-ob-suggest="${kind}" data-label="${esc(x.label ?? x)}" data-swatch="${esc(x.swatch || '')}" ${attrs}>+ ${esc(x.label ?? x)}</button>`).join('')}</div>`;
}
// Vlastite opcije zlatara: fotografija (nije obavezna, a kupac je vidi na izboru) i uklanjanje.
const obOwn = (items, base, del) => (items.length ? `<div class="ob-own">${items.map((c, k) => `<div class="ob-own-item">${base ? obPick(`${base}.${k}.image`, { label: 'Photo', cls: 'mini' }) : ''}<span>${esc(c.label ?? c)}</span><button class="link" data-ob-del-own="${esc(del)}" data-k="${k}">Remove</button></div>`).join('')}</div>` : '');

function obAddCustom(kind, i, label, swatch) {
  const d = OB.d;
  const clean = label.trim().slice(0, 40);
  if (!clean) return;
  const pc = d.pieces[i];
  if (kind === 'karats') {
    const existing = [...P.me.onboardingDefaults.karats, ...d.customKarats].find((x) => x.toLowerCase() === clean.toLowerCase());
    if (!existing) d.customKarats.push(clean);
    if (pc && !pc.karats.includes(existing || clean)) pc.karats.push(existing || clean);
    return;
  }
  const listKey = kind === 'metals' ? 'customMetals' : 'customStones';
  const existing = [...P.me.onboardingDefaults[kind], ...d[listKey]].find((x) => x.label.toLowerCase() === clean.toLowerCase());
  const value = existing ? existing.value : `custom-${uid()}`;
  // Nova opcija ide u katalog radnje (vide je i ostali komadi) i odmah je izabrana za ovaj komad.
  if (!existing) { d[listKey].push({ uid: uid(), value, label: clean, image: '', ...(kind === 'metals' ? { swatch: swatch || '#c0c4c8' } : {}) }); d[kind].push(value); }
  if (pc && !pc[kind].includes(value)) pc[kind].push(value);
}
function obAddSpec(i, id, label) {
  const pc = OB.d.pieces[i];
  const sp = P.me.onboardingDefaults.specs[pc.value]?.find((x) => x.id === id);
  const clean = label.trim().slice(0, 40);
  if (!sp || !clean) return;
  const list = (pc.customSpecs[id] ||= []);
  const known = [...sp.options, ...list].find((o) => o.label.toLowerCase() === clean.toLowerCase());
  const value = known ? known.value : `custom-${uid()}`;
  if (!known) { if (list.length >= 12) return JLUI.alert('You can add up to 12 of your own options here.'); list.push({ uid: uid(), value, label: clean, image: '' }); }
  pc.specs[id] = [...new Set([...obSpecPicked(pc, sp), value])];
}

function obStepView() {
  const d = OB.d;
  const defs = P.me.onboardingDefaults;
  const key = OB.step;
  if (key === 'store') {
    return `
      <h2>Welcome! Let's set up your design form.</h2>
      <p class="ob-lead">A few questions about your store and what you make. It takes about 10 minutes, and we turn your answers into the form your customers will use.</p>
      <div class="ob-grid2">
        <label class="ob-f"><span>Store name</span><input class="in" data-ob="store.name" value="${esc(d.store.name)}" placeholder="Northstar Jewelers" /></label>
        <label class="ob-f"><span>Website</span><input class="in" data-ob="store.website" value="${esc(d.store.website)}" placeholder="northstarjewelers.com" /></label>
      </div>
      <div class="ob-f"><span>Logo</span>${obPick('store.logo', { label: 'Upload logo', cls: 'logo' })}<p class="hint ob-logo-hint">PNG with a transparent background looks best. It shows at the top of your form.</p></div>
      <div class="ob-f"><span>Brand color</span><div class="ob-row">${ACCENTS.map((c) => `<button class="ob-swatch ${d.store.accent.toLowerCase() === c ? 'on' : ''}" style="background:${c}" data-ob-accent="${c}" aria-label="${c}"></button>`).join('')}<label class="ob-swatch custom" title="Your own color"><input type="color" aria-label="Your own color" data-ob="store.accent" value="${esc(d.store.accent)}" /></label></div></div>
      <div class="ob-f"><span>Look</span><div class="ob-row">
        ${[['dark', 'Dark', 'Elegant, like a jewelry case'], ['light', 'Light', 'Bright and clean']].map(([v, l, h]) => `<button class="ob-theme ${d.store.theme === v ? 'on' : ''} ${v}" data-ob-theme="${v}"><i style="--a:${esc(d.store.accent)}"></i><b>${l}</b><small>${h}</small></button>`).join('')}
      </div></div>
      <div class="ob-f"><span>Picture style</span><div class="ob-row">
        ${[['dark', 'Studio Dark', 'Pieces on a dark studio backdrop', '/library/ring/solitaire.webp'], ['light', 'Studio Light', 'Pieces on a soft ivory backdrop', '/library-light/ring/solitaire.webp']].map(([v, l, h, src]) => `<button class="ob-theme ob-pics ${(d.store.imageStyle || 'dark') === v ? 'on' : ''}" data-ob-pics="${v}" aria-pressed="${(d.store.imageStyle || 'dark') === v}"><img src="${src}" alt="" /><b>${l}</b><small>${h}</small></button>`).join('')}
      </div><p class="hint">The pictures customers see on every choice in your form.</p></div>`;
  }
  if (key === 'pieces') {
    const on = new Set(d.pieces.map((p) => p.value).filter(Boolean));
    const lib = defs.pieces.map((p) => `<button class="ob-piece ${on.has(p.value) ? 'on' : ''}" data-ob-piece="${p.value}" aria-pressed="${on.has(p.value)}"><img src="${esc(p.image || defs.styles[p.value]?.[0]?.image || '')}" alt="" /><b>${esc(p.label)}</b>${on.has(p.value) ? '<i class="ob-selected" aria-hidden="true">✓</i>' : ''}</button>`).join('');
    const custom = d.pieces.map((p, i) => (p.value ? '' : `<div class="ob-custom">${obPick(`pieces.${i}.image`, { label: 'Photo', cls: 'mini' })}<input class="in" data-ob="pieces.${i}.label" value="${esc(p.label)}" /><button class="btn small" data-ob-del-piece="${i}">Remove</button></div>`)).join('');
    return `
      <h2>What do you make?</h2>
      <p class="ob-lead">Pick everything customers can order from you. Then we go through them one by one: styles, materials and budget, and details for each piece.</p>
      <div class="ob-pieces">${lib}</div>
      ${custom ? `<h3>Your own pieces</h3>${custom}` : ''}
      <button class="btn" data-ob-act="add-piece">+ Add another piece (e.g. Belt buckle)</button>
      ${obSuggest('piece', P.me.onboardingSuggestions?.pieces, d.pieces.map((p) => p.label))}`;
  }
  if (key === 'products') return obProductsView();
  const here = obPiece();
  if (here) return obPieceView(here);
  if (key === 'extras') {
    return `
      <h2>Notes for our team</h2>
      <p class="ob-lead">Optional. Tell our team anything we should keep in mind. These notes will not appear in your customer form.</p>
      ${d.questions ? `<p class="hint">Your earlier question requests are saved for our team: ${esc(d.questions)}</p>` : ''}
      <label class="ob-f"><span>Notes for our team</span><textarea class="in" rows="4" data-ob="notes" placeholder="e.g. We don't do platinum grillz. Our minimum order is $800.">${esc(d.notes || '')}</textarea></label>`;
  }
  const kept = (p) => (p.styles || []).filter((s) => s.keep !== false && s.label);
  const name = (list, v) => list.find((x) => x.value === v)?.label || v;
  const metals = [...defs.metals, ...d.customMetals];
  const stones = [...defs.stones, ...d.customStones];
  const pieceRow = (pc) => {
    const specs = (defs.specs[pc.value] || []).map((sp) => [sp, obSpecPicked(pc, sp)]).filter(([, v]) => v.length).map(([sp, v]) => `${esc(sp.label)} (${v.length})`);
    const qs = pc.questions.filter((q) => q.label.trim()).map((q) => esc(q.label));
    return `<dt>${esc(pc.label)}</dt><dd>
      <b>Styles:</b> ${kept(pc).map((s) => esc(s.label)).join(', ') || '<span class="faint">none, customers describe their idea</span>'}<br />
      <b>Metals:</b> ${esc(pc.metals.map((v) => name(metals, v)).join(', ') || 'not asked')}${pc.metals.some((v) => v !== 'platinum') ? ` · ${esc(pc.karats.join(', ') || 'no karat question')}` : ''}<br />
      <b>Stones:</b> ${esc(pc.stones.map((v) => name(stones, v)).join(', ') || 'not asked')}<br />
      <b>Budgets:</b> ${esc(pc.budgets.filter(Boolean).join(' · ') || 'not asked')}
      ${specs.length || qs.length ? `<br /><b>Details:</b> ${[...specs, ...qs].join(', ')}` : ''}
      <br /><b>Required steps:</b> ${esc(OB_PIECE_STEPS.filter(([k]) => pc.required[k]).map(([, l]) => l).join(', ') || 'none')}</dd>`;
  };
  const prods = d.products.filter((x) => x.name.trim());
  const problems = obProblems();
  return `
    <h2>Review & send</h2>
    <p class="ob-lead">Check everything once. After you send it, we build your form and it appears in this portal.</p>
    <dl class="ob-review">
      <dt>Store</dt><dd>${esc(d.store.name)}${d.store.website ? ` · ${esc(d.store.website)}` : ''} · ${d.store.theme === 'light' ? 'Light' : 'Dark'} look · ${d.store.imageStyle === 'light' ? 'Studio Light' : 'Studio Dark'} pictures <i class="ob-dotc" style="background:${esc(d.store.accent)}"></i></dd>
      ${d.pieces.map(pieceRow).join('')}
      <dt>Shop products</dt><dd>${prods.length ? prods.map((x) => `${esc(x.name)}${x.price ? ` (${esc(x.price)})` : ''}`).join(', ') : '<span class="faint">none, nothing is recommended under the preview</span>'}</dd>
      ${d.notes ? `<dt>Notes</dt><dd>${esc(d.notes)}</dd>` : ''}
    </dl>
    ${problems.length ? `<div class="ob-problems" role="alert"><b>${problems.length === 1 ? '1 thing needs' : `${problems.length} things need`} fixing before you can send</b><ul>${problems.map((x, k) => `<li><span>${esc(x.message)}</span><button class="btn small" data-ob-fix="${k}">Fix this</button></li>`).join('')}</ul></div>` : ''}
    ${OB.err ? `<p class="ob-err">${esc(OB.err)}</p>` : ''}
    <button class="btn primary big" data-ob-act="send" ${readOnly() || OB.uploads.size || OB.submitting ? 'disabled' : ''}>${OB.submitting ? '<span class="jl-spinner"></span> Sending…' : OB.uploads.size ? 'Waiting for photo upload…' : problems.length ? 'Fix the problems first' : 'Send to our team'}</button>`;
}

// Specifikacija komada: izabrane opcije (prazno = ne pita se). Bez odluke zlatara važi podrazumijevano iz kataloga.
const obSpecPicked = (pc, sp) => (Array.isArray(pc.specs[sp.id]) ? pc.specs[sp.id] : sp.on ? sp.options.map((o) => o.value) : []);
// Oznaka koraka: bez njega kupac ne može dalje (za ovaj komad).
const obRequired = (i, pc, key) => `<label class="ob-required"><input type="checkbox" data-ob-req="${i}.${key}" ${pc.required[key] ? 'checked' : ''} /><span><b>Required step</b><small>${pc.required[key] ? 'Customers must complete this before they can continue.' : 'Customers can skip this.'}</small></span></label>`;

// Jedan komad: zaglavlje "Piece 2 of 3", pod-koraci i sadržaj izabranog pod-koraka.
function obPieceView({ i, pc, sub }) {
  const d = OB.d;
  const defs = P.me.onboardingDefaults;
  const n = d.pieces.length;
  const tabs = OB_PIECE_STEPS.map(([k, l], j) => `<button class="ob-sub ${k === sub ? 'on' : ''}" data-ob-go="p:${esc(pc.uid)}:${k}" aria-current="${k === sub ? 'step' : 'false'}"><span>${j + 1}</span>${l}</button>`).join('');
  const head = `<div class="ob-piece-head"><small>Piece ${i + 1} of ${n}</small><h2>${esc(pc.label || 'Piece')}</h2><nav class="ob-subs">${tabs}</nav></div>`;
  const P_ = `pieces.${i}`;
  if (sub === 'styles') {
    const cards = pc.styles.map((s, j) => {
      const path = `${P_}.styles.${j}`;
      return `
        <div class="ob-style ${s.keep === false ? 'off' : ''}">
          ${obPick(`${path}.image`, { label: 'Add photo' })}
          <input class="in" data-ob="${path}.label" value="${esc(s.label)}" placeholder="Style name" />
          ${s.custom ? `<textarea class="in" data-ob="${path}.note" rows="2" placeholder="What makes it special? (shape, details)">${esc(s.note || '')}</textarea>` : ''}
          <div class="ob-style-foot">
            <label class="ob-check"><span>Offer this</span><input type="checkbox" data-ob-keep="${path}" ${s.keep === false ? '' : 'checked'} /><span class="ob-selected" aria-hidden="true">✓</span></label>
            ${s.custom ? `<button class="link" data-ob-del-style="${i}.${j}">Remove</button>` : ''}
          </div>
        </div>`;
    }).join('');
    return `${head}
      <p class="ob-lead">The shapes customers pick from for a ${esc(pc.label.toLowerCase())}. Keep the ones you make, rename them, swap in photos of your own work, or add your signature styles. Your photos also guide the AI, so the previews look like your pieces.</p>
      ${obRequired(i, pc, 'styles')}
      <div class="ob-styles">${cards}<button class="ob-style add" data-ob-add-style="${i}"><span>+</span>Add a style</button></div>
      ${obSuggest('style', P.me.onboardingSuggestions?.styles?.[pc.value], pc.styles.map((s) => s.label), `data-i="${i}"`)}`;
  }
  if (sub === 'materials') {
    const chip = (k, v, label, src = '', sw = '') => { const on = pc[k].includes(v); return `<button class="ob-chip ${src ? 'pic' : ''} ${on ? 'on' : 'off'}" data-ob-ptoggle="${i}.${k}" data-v="${esc(v)}" aria-pressed="${on}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" />` : sw ? `<i style="background:${esc(sw)}"></i>` : ''}${esc(label)}${on ? '<span class="ob-selected" aria-hidden="true">✓</span>' : ''}</button>`; };
    const sugg = P.me.onboardingSuggestions || {};
    const others = d.pieces.filter((x) => x !== pc && x.budgets.some(Boolean));
    return `${head}
      <p class="ob-lead">Only what you offer for a ${esc(pc.label.toLowerCase())} shows to customers who design one. Untick everything in a row and that question is skipped for this piece.</p>
      ${obRequired(i, pc, 'materials')}
      <div class="ob-f"><span>Metals</span><div class="ob-chips pics">${[...defs.metals, ...d.customMetals].map((m) => chip('metals', m.value, m.label, m.image || artFor('metal', m.label, pc.value), m.swatch)).join('')}<button class="ob-chip add" data-ob-add-option="metals" data-i="${i}">+ Add new</button></div>
        ${obSuggest('metals', sugg.metals, [...defs.metals, ...d.customMetals].map((m) => m.label), `data-i="${i}"`)}${obOwn(d.customMetals, 'customMetals', 'metals')}</div>
      <div class="ob-f"><span>Karat</span><div class="ob-chips pics">${[...defs.karats, ...d.customKarats].map((k) => chip('karats', k, k, artFor('karat', k))).join('')}<button class="ob-chip add" data-ob-add-option="karats" data-i="${i}">+ Add new</button></div><p class="hint">Not asked when the customer picks platinum.</p>
        ${obSuggest('karats', sugg.karats, [...defs.karats, ...d.customKarats], `data-i="${i}"`)}${obOwn(d.customKarats, '', 'karats')}</div>
      <div class="ob-f"><span>Stones</span><div class="ob-chips pics">${[...defs.stones, ...d.customStones].map((st) => chip('stones', st.value, st.label, st.image || artFor('stones', st.label, pc.value))).join('')}<button class="ob-chip add" data-ob-add-option="stones" data-i="${i}">+ Add new</button></div>
        ${obSuggest('stones', sugg.stones, [...defs.stones, ...d.customStones].map((m) => m.label), `data-i="${i}"`)}${obOwn(d.customStones, 'customStones', 'stones')}</div>
      <div class="ob-f"><span>Budget ranges for a ${esc(pc.label.toLowerCase())}</span>
        ${pc.budgets.map((b, k) => { const src = artFor('budget', b, pc.value); return `<div class="ob-custom">${src ? `<img class="ob-thumb" src="${esc(src)}" alt="" loading="lazy" />` : ''}<input class="in" data-ob="${P_}.budgets.${k}" value="${esc(b)}" /><button class="btn small" data-ob-del-budget="${i}.${k}">Remove</button></div>`; }).join('') || '<p class="hint">No budget question for this piece.</p>'}
        <div class="ob-row"><button class="btn small" data-ob-add-budget="${i}">+ Add range</button>${others.map((x) => `<button class="btn small" data-ob-copy-budget="${i}.${d.pieces.indexOf(x)}">Same as ${esc(x.label)}</button>`).join('')}</div>
        ${obSuggest('budget', sugg.budgets, pc.budgets, `data-i="${i}"`)}</div>`;
  }
  const specs = (defs.specs[pc.value] || []).map((sp) => {
    const picked = obSpecPicked(pc, sp);
    const on = picked.length > 0;
    const own = pc.customSpecs[sp.id] || [];
    return `
      <div class="ob-spec ${on ? '' : 'off'}">
        <label class="ob-spec-head"><input type="checkbox" data-ob-spec-on="${i}.${sp.id}" ${on ? 'checked' : ''} /><b>${esc(sp.label)}</b><small>${on ? 'Asked' : 'Not asked'}</small></label>
        ${on ? `<div class="ob-chips pics">${[...sp.options, ...own].map((o) => { const sel = picked.includes(o.value); const src = o.image || artFor(sp.id, o.label, pc.value); return `<button class="ob-chip ${src ? 'pic' : ''} ${sel ? 'on' : 'off'}" data-ob-spec="${i}.${sp.id}" data-v="${esc(o.value)}" aria-pressed="${sel}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" />` : ''}${esc(o.label)}${sel ? '<span class="ob-selected" aria-hidden="true">✓</span>' : ''}</button>`; }).join('')}<button class="ob-chip add" data-ob-add-spec="${i}.${sp.id}">+ Add new</button></div>
          ${obSuggest('spec', [...suggestOptions(sp.id, sp.label), ...(P.me.onboardingSuggestions?.specs?.[`${pc.value}.${sp.id}`] || [])], [...sp.options, ...own].map((o) => o.label), `data-i="${i}" data-spec="${sp.id}"`)}${obOwn(own, `${P_}.customSpecs.${sp.id}`, `spec:${i}:${sp.id}`)}` : ''}
      </div>`;
  }).join('');
  const qs = pc.questions.map((q, k) => `
    <div class="ob-q">
      <input class="in" data-ob="${P_}.questions.${k}.label" value="${esc(q.label)}" placeholder="Question, e.g. Which finish do you like?" />
      <input class="in" data-ob="${P_}.questions.${k}.options" value="${esc(q.options || '')}" placeholder="Answers, separated by commas (empty = customer types an answer)" />
      <button class="btn small" data-ob-del-question="${i}.${k}">Remove</button>
    </div>`).join('');
  return `${head}
    ${obRequired(i, pc, 'details')}
    <p class="ob-lead">${specs ? `The specifics you ask about a ${esc(pc.label.toLowerCase())}. Customers only see these when they design one. Turn off what you don't ask and untick sizes you don't make.` : `Anything you need to know about a ${esc(pc.label.toLowerCase())}? Add your own questions; customers only see them when they design one.`}</p>
    ${specs}
    <div class="ob-f"><span>Your own questions${specs ? ' (optional)' : ''}</span>${qs}
      ${pc.questions.length < 6 ? `<button class="btn small" data-ob-add-question="${i}">+ Add a question</button>${obSuggest('question', SUGGESTED.questions, pc.questions.map((q) => q.label), `data-i="${i}"`)}` : ''}</div>`;
}

// Proizvodi iz radnje: kupac ih vidi ispod svog AI pregleda, prvo oni za komad koji je dizajnirao.
function obProductsView() {
  const d = OB.d;
  const cards = d.products.map((x, k) => {
    const path = `products.${k}`;
    const pcs = d.pieces.map((pc) => { const on = x.pieces.includes(pc.uid); return `<button class="ob-chip small ${on ? 'on' : 'off'}" data-ob-prod-piece="${k}" data-v="${esc(pc.uid)}" aria-pressed="${on}">${esc(pc.label)}${on ? '<span class="ob-selected" aria-hidden="true">✓</span>' : ''}</button>`; }).join('');
    return `
      <div class="ob-product">
        ${obPick(`${path}.image`, { label: 'Product photo' })}
        <div class="ob-product-body">
          <div class="ob-grid2">
            <label class="ob-f"><span>Name</span><input class="in" data-ob="${path}.name" value="${esc(x.name)}" placeholder="Miami Cuban chain 18&quot;" /></label>
            <label class="ob-f"><span>Price</span><input class="in" data-ob="${path}.price" value="${esc(x.price)}" placeholder="$1,250" /></label>
          </div>
          <label class="ob-f"><span>Link to the product in your shop</span><input class="in" type="url" data-ob="${path}.url" value="${esc(x.url)}" placeholder="https://yourstore.com/products/..." /></label>
          <label class="ob-f"><span>Short description</span><textarea class="in" rows="2" data-ob="${path}.description" placeholder="14K yellow gold, 8 mm, lifetime warranty">${esc(x.description)}</textarea></label>
          <div class="ob-f"><span>Recommend it with</span><div class="ob-chips">${pcs}</div><p class="hint">${x.pieces.length ? 'Shown only to customers who design one of these.' : 'Nothing selected: shown with every piece.'}</p></div>
          <button class="link" data-ob-del-product="${k}">Remove product</button>
        </div>
      </div>`;
  }).join('');
  return `
    <h2>Shop products</h2>
    <p class="ob-lead">Optional. Add pieces from your online shop. When a customer finishes the form, they see them under their AI preview with the price and a link to your shop, matched to the piece they designed.</p>
    ${cards}
    ${d.products.length < 24 ? '<button class="btn" data-ob-act="add-product">+ Add a product</button>' : ''}`;
}

// Fotografija: smanji u browseru (logo 600 px PNG, ostalo 1200 px WebP), pa u R2.
async function obUpload(input) {
  const file = input.files[0];
  if (!file || readOnly() || OB.submitting) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return JLUI.alert('Please choose a JPG, PNG or WebP photo.');
  if (file.size > 20 * 1024 * 1024) return JLUI.alert('Please choose a photo smaller than 20 MB.');
  const isLogo = input.dataset.obFile === 'store.logo';
  const label = input.closest('.ob-photo');
  const owner = input.dataset.uid || input.dataset.obFile;
  if (OB.uploads.has(owner)) return;
  OB.uploads.set(owner, true);
  input.disabled = true;
  JLUI.uploadBusy(label, true);
  try {
    let blob = file;
    try {
      const bmp = await createImageBitmap(file);
      const max = isLogo ? 600 : 1200;
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      blob = (await new Promise((r) => c.toBlob(r, isLogo ? 'image/png' : 'image/webp', 0.86))) || file;
    } catch {}
    const fd = new FormData();
    fd.set('file', blob, isLogo ? 'logo.png' : 'photo.webp');
    const res = await fetch(obUrl('/api/portal/onboarding/upload'), { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    // decode() u tabu u pozadini ne završava nikad; najviše 1,5 s čekanja da slika ne trepne, pa dalje.
    const loaded = new Image(); loaded.src = data.url;
    try { await Promise.race([loaded.decode(), new Promise((r) => setTimeout(r, 1500))]); } catch {}
    // Slika ide stilu po njegovom id-ju (ne po rednom broju, koji se može promijeniti dok slika putuje).
    const id = input.dataset.uid;
    if (!id) obSet('store.logo', data.url);
    else {
      const st = [...(OB.d?.pieces.flatMap((pc) => [pc, ...(pc.styles || []), ...Object.values(pc.customSpecs || {}).flat()]) || []), ...(OB.d?.products || []), ...(OB.d?.customMetals || []), ...(OB.d?.customStones || [])].find((x) => x.uid === id);
      if (st) st.image = data.url;
    }
    obSave(true);
  } catch (e) {
    JLUI.alert(e.message);
  } finally { OB.uploads.delete(owner); JLUI.uploadBusy(label, false); input.disabled = readOnly(); input.value = ''; if (OB.d) { const y = scrollY; renderOnboarding(); scrollTo(0, y); } }
}

app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.previewBg !== undefined) { OB.previewBg = el.value; syncPreviewBackground(); return; }
  if (!OB.d || !el.dataset.ob) return;
  if (readOnly() || OB.submitting) return;
  obSet(el.dataset.ob, el.value);
  if (el.dataset.ob === 'store.accent') document.querySelectorAll('.ob-swatch.on').forEach((x) => x.classList.remove('on'));
  if (el.dataset.ob === 'store.name') { const heading = document.querySelector('[data-store-heading]'); if (heading) heading.textContent = el.value || P.me.client.name; }
  if (el.dataset.ob === 'store.name' || el.dataset.ob === 'store.accent') { const n = document.querySelector('[data-ob-act="next"]'); if (n) n.disabled = !obCan(OB.step); }
  obSave();
  queueOnboardingPreview();
  obMarkProblems();
});
app.addEventListener('change', (e) => {
  const el = e.target;
  if (!OB.d) return;
  if (el.dataset.obFile) obUpload(el);
  if (el.dataset.obReq && !readOnly() && !OB.submitting) {
    const [i, key] = el.dataset.obReq.split('.');
    OB.d.pieces[+i].required[key] = el.checked;
    obSave(); const y = scrollY; renderOnboarding(); scrollTo(0, y);
  }
  if (el.dataset.obSpecOn && !readOnly() && !OB.submitting) {
    const [i, id] = el.dataset.obSpecOn.split('.');
    const sp = P.me.onboardingDefaults.specs[OB.d.pieces[+i].value]?.find((x) => x.id === id);
    if (sp) { OB.d.pieces[+i].specs[id] = el.checked ? [...sp.options, ...(OB.d.pieces[+i].customSpecs[id] || [])].map((o) => o.value) : []; obSave(); const y = scrollY; renderOnboarding(); scrollTo(0, y); }
  }
  if (el.dataset.obKeep && !readOnly() && !OB.submitting) { obSet(`${el.dataset.obKeep}.keep`, el.checked); el.closest('.ob-style')?.classList.toggle('off', !el.checked); obSave(); queueOnboardingPreview(); }
});
app.addEventListener('click', async (e) => {
  if (!OB.d) return;
  const t = e.target.closest('button');
  if (!t) return;
  if (OB.submitting) return;
  if (readOnly() && !['next', 'back', 'fix-next', 'fix-done'].includes(t.dataset.obAct) && t.dataset.obGo === undefined && t.dataset.obFix === undefined) return;
  const d = OB.d;
  const defs = P.me.onboardingDefaults;
  const redraw = () => { obSave(); const y = scrollY; renderOnboarding(); scrollTo(0, y); };
  if (t.dataset.obGo !== undefined) { obGo(t.dataset.obGo); obSave(true); renderOnboarding(); scrollTo(0, 0); return; }
  const act = t.dataset.obAct;
  if (t.dataset.obFix !== undefined) { const x = obProblems()[+t.dataset.obFix]; if (x) obFix(x); return; }
  if (act === 'fix-next') { const x = obProblems()[0]; if (x) obFix(x); return; }
  if (act === 'fix-done') { OB.fixing = false; OB.step = 'send'; obSave(true); renderOnboarding(); scrollTo(0, 0); return; }
  if (act === 'next' && obCan(OB.step)) { OB.step = obSteps()[obIdx() + 1][0]; obSave(true); renderOnboarding(); scrollTo(0, 0); }
  if (act === 'back') { OB.step = obSteps()[Math.max(0, obIdx() - 1)][0]; obSave(true); renderOnboarding(); scrollTo(0, 0); }
  if (t.dataset.obAccent) { d.store.accent = t.dataset.obAccent; redraw(); }
  if (t.dataset.obTheme) { d.store.theme = t.dataset.obTheme; redraw(); }
  if (t.dataset.obPics) { d.store.imageStyle = t.dataset.obPics; redraw(); }
  if (t.dataset.obAddOption) {
    const kind = t.dataset.obAddOption;
    const answer = kind === 'metals'
      ? await JLUI.material('Name the metal and choose its circle color.', { title: 'Add a metal' })
      : await JLUI.prompt(kind === 'karats' ? 'Karat or purity (e.g. 22K)' : 'Name of the stone (e.g. Ruby)', { title: kind === 'karats' ? 'Add a karat' : 'Add a stone', max: 40 });
    const label = typeof answer === 'string' ? answer : answer?.label;
    if (!label) return;
    const count = kind === 'karats' ? d.customKarats.length : d[kind === 'metals' ? 'customMetals' : 'customStones'].length;
    if (count >= 12) return JLUI.alert('You can add up to 12 of your own options here.');
    obAddCustom(kind, +t.dataset.i, label, answer?.swatch);
    redraw();
  }
  if (t.dataset.obAddSpec) {
    const [i, id] = t.dataset.obAddSpec.split('.');
    const label = await JLUI.prompt('Name of the option', { title: 'Add an option', max: 40 });
    if (!label) return;
    obAddSpec(+i, id, label);
    redraw();
  }
  if (t.dataset.obSuggest) {
    const kind = t.dataset.obSuggest;
    const label = t.dataset.label;
    const i = +t.dataset.i;
    if (kind === 'piece') { const pc = { uid: uid(), value: '', label, image: optionArt('type', { label }), styles: [] }; obPieceDefaults(pc); d.pieces.push(pc); }
    if (kind === 'style') d.pieces[i].styles.push({ uid: uid(), value: '', label, image: styleArt(d.pieces[i].value, label), note: '', custom: true, keep: true });
    if (kind === 'budget') d.pieces[i].budgets.push(label);
    if (kind === 'question') d.pieces[i].questions.push({ uid: uid(), label, options: SUGGESTED.questions.find((q) => q.label === label)?.options || '' });
    if (kind === 'spec') obAddSpec(i, t.dataset.spec, label);
    if (['metals', 'stones', 'karats'].includes(kind)) obAddCustom(kind, i, label, t.dataset.swatch);
    redraw();
  }
  if (t.dataset.obDelOwn) {
    const k = +t.dataset.k;
    const [kind, i, id] = t.dataset.obDelOwn.split(':');
    if (kind === 'spec') {
      const pc = d.pieces[+i];
      const [gone] = pc.customSpecs[id].splice(k, 1);
      if (Array.isArray(pc.specs[id])) pc.specs[id] = pc.specs[id].filter((v) => v !== gone.value);
    } else if (kind === 'karats') {
      const [gone] = d.customKarats.splice(k, 1);
      for (const pc of d.pieces) pc.karats = pc.karats.filter((v) => v !== gone);
    } else {
      const [gone] = d[kind === 'metals' ? 'customMetals' : 'customStones'].splice(k, 1);
      d[kind] = d[kind].filter((v) => v !== gone.value);
      for (const pc of d.pieces) pc[kind] = pc[kind].filter((v) => v !== gone.value);
    }
    redraw();
  }
  if (t.dataset.obPiece) {
    const v = t.dataset.obPiece;
    const i = d.pieces.findIndex((p) => p.value === v);
    if (i >= 0) {
      const custom = (d.pieces[i].styles || []).some((s) => s.custom || (s.image && !s.image.startsWith('/library/')));
      if (custom && !(await JLUI.confirm('Remove this piece and the styles and photos you added for it?'))) return;
      const [gone] = d.pieces.splice(i, 1);
      for (const x of d.products) x.pieces = x.pieces.filter((u) => u !== gone.uid);
    } else {
      const p = defs.pieces.find((x) => x.value === v);
      const pc = { uid: uid(), value: v, label: p.label, styles: (defs.styles[v] || []).map((s) => ({ ...s, uid: uid(), keep: true })) };
      obPieceDefaults(pc);
      d.pieces.push(pc);
    }
    redraw();
  }
  if (act === 'add-piece') {
    const name = await JLUI.prompt('What is the piece called? (e.g. Belt buckle)');
    if (!name?.trim()) return;
    const pc = { uid: uid(), value: '', label: name.trim().slice(0, 60), styles: [] };
    obPieceDefaults(pc);
    d.pieces.push(pc);
    redraw();
  }
  if (t.dataset.obDelPiece) { const [gone] = d.pieces.splice(+t.dataset.obDelPiece, 1); for (const x of d.products) x.pieces = x.pieces.filter((u) => u !== gone.uid); redraw(); }
  if (t.dataset.obAddStyle !== undefined) {
    const p = d.pieces[+t.dataset.obAddStyle];
    (p.styles ||= []).push({ uid: uid(), value: '', label: '', image: '', note: '', custom: true, keep: true });
    redraw();
    const inputs = document.querySelectorAll(`[data-ob^="pieces.${t.dataset.obAddStyle}.styles."][data-ob$=".label"]`);
    inputs[inputs.length - 1]?.focus();
  }
  if (t.dataset.obDelStyle) { const [i, j] = t.dataset.obDelStyle.split('.').map(Number); d.pieces[i].styles.splice(j, 1); redraw(); }
  const flip = (list, v) => { const k = list.indexOf(v); if (k >= 0) list.splice(k, 1); else list.push(v); };
  if (t.dataset.obPtoggle) { const [i, k] = t.dataset.obPtoggle.split('.'); flip(d.pieces[+i][k], t.dataset.v); redraw(); }
  if (t.dataset.obSpec) {
    const [i, id] = t.dataset.obSpec.split('.');
    const pc = d.pieces[+i];
    const sp = defs.specs[pc.value]?.find((x) => x.id === id);
    if (!sp) return;
    pc.specs[id] = [...obSpecPicked(pc, sp)];
    flip(pc.specs[id], t.dataset.v);
    redraw();
  }
  if (t.dataset.obAddBudget !== undefined) { const i = +t.dataset.obAddBudget; d.pieces[i].budgets.push(''); redraw(); document.querySelectorAll(`[data-ob^="pieces.${i}.budgets."]`).forEach((x, k, all) => k === all.length - 1 && x.focus()); }
  if (t.dataset.obDelBudget) { const [i, k] = t.dataset.obDelBudget.split('.').map(Number); d.pieces[i].budgets.splice(k, 1); redraw(); }
  if (t.dataset.obCopyBudget) { const [i, from] = t.dataset.obCopyBudget.split('.').map(Number); d.pieces[i].budgets = [...d.pieces[from].budgets]; redraw(); }
  if (t.dataset.obAddQuestion !== undefined) {
    const i = +t.dataset.obAddQuestion;
    if (d.pieces[i].questions.length >= 6) return;
    d.pieces[i].questions.push({ uid: uid(), label: '', options: '' });
    redraw();
    document.querySelectorAll(`[data-ob^="pieces.${i}.questions."][data-ob$=".label"]`).forEach((x, k, all) => k === all.length - 1 && x.focus());
  }
  if (t.dataset.obDelQuestion) { const [i, k] = t.dataset.obDelQuestion.split('.').map(Number); d.pieces[i].questions.splice(k, 1); redraw(); }
  if (act === 'add-product') {
    if (d.products.length >= 24) return;
    d.products.push({ uid: uid(), name: '', price: '', url: '', description: '', image: '', pieces: [] });
    redraw();
    document.querySelectorAll('[data-ob^="products."][data-ob$=".name"]').forEach((x, k, all) => k === all.length - 1 && x.focus());
  }
  if (t.dataset.obDelProduct !== undefined) {
    const x = d.products[+t.dataset.obDelProduct];
    if ((x.name || x.image) && !(await JLUI.confirm('Remove this product?'))) return;
    d.products.splice(+t.dataset.obDelProduct, 1);
    redraw();
  }
  if (t.dataset.obProdPiece !== undefined) { flip(d.products[+t.dataset.obProdPiece].pieces, t.dataset.v); redraw(); }
  if (act === 'send') {
    const problems = obProblems();
    if (problems.length) return obFix(problems[0]);
    if (OB.uploads.size) return JLUI.alert('Wait for your photos to finish uploading before sending.');
    if (!(await JLUI.confirm('Send your answers to our team? You won\'t be able to edit them here after that, but you can always message us changes.'))) return;
    OB.submitting = true;
    OB.err = '';
    t.disabled = true;
    t.innerHTML = '<span class="jl-spinner"></span> Sending…';
    try {
      // Prvo sačekaj čuvanje koje je već krenulo, pa pošalji zadnju verziju, pa tek onda Send.
      clearTimeout(OB.timer);
      clearTimeout(OB.retry);
      if (OB.inflight) await OB.inflight;
      const r = await api(obUrl('/api/portal/onboarding/submit'), { method: 'POST', body: JSON.stringify({ data: { ...OB.d, step: OB.step }, rev: OB.rev }), json: true });
      OB.rev = r.rev ?? OB.rev;
      OB.dirty = false;
      clearTimeout(OB.timer); clearTimeout(OB.retry); clearTimeout(OB.previewTimer);
      P.me.onboarding.status = r.status || 'submitted';
      OB.d = null;
      render();
      scrollTo(0, 0);
    } catch (err) {
      // Izgubljen odgovor poslije uspješnog upisa: provjeri status prije nego ponudimo ponovno slanje.
      try {
        const me = await api('/api/portal/me');
        if (me.onboarding?.status && me.onboarding.status !== 'draft') { P.me = me; OB.dirty = false; OB.d = null; render(); return; }
      } catch {}
      OB.err = err.message === 'Something went wrong. Please try again.' ? 'Your answers are still here. We could not send them just now. Please try Send again.' : err.message;
      OB.submitting = false;
      renderOnboarding();
    } finally { OB.submitting = false; }
  }
});
