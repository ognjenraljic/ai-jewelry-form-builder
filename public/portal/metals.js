// Tab "Metal movement" u portalu (26.11.2026, redizajn isti dan): grafik cijena zlata, srebra i platine (1D, 1W, 1M, 1Y, 5Y,
// Custom) i podešavanje upozorenja koja stižu u Notifications kad se cijena pomakne za izabran procenat.
// Cijene stižu u USD po troy unci; prikazuju se po gramu (kao u Pricing tabu) ili po unci.
// Grafik ide po tačkama (ne po kalendaru), pa vikendi i noći bez trgovanja ne prave ravne crte.
let C = null; // { api, esc, readOnly, rerender, app, P }
const OZ = 31.1035;
const METALS = [['gold', 'Gold', 'Au'], ['silver', 'Silver', 'Ag'], ['platinum', 'Platinum', 'Pt']];
const RANGES = [['1d', '1D', 'today'], ['1w', '1W', 'past week'], ['1m', '1M', 'past month'], ['1y', '1Y', 'past year'], ['5y', '5Y', 'past 5 years'], ['custom', 'Custom', '']];
const QUICK = [1, 2, 3, 5, 10];
const UP = '#3ccf91';
const DOWN = '#ef6a6a';
const DAY = 86_400_000;
const M = { w: 0, range: '1m', from: '', to: '', unit: 'g', sel: 'gold', data: null, loading: false, error: '', cfg: null, draft: null, dirty: false, msg: '', saving: false, geo: null };

export function initMetals(ctx) {
  C = ctx;
  C.app.addEventListener('click', onClick);
  C.app.addEventListener('input', onInput);
  C.app.addEventListener('change', onChange);
  C.app.addEventListener('pointermove', onMove);
  C.app.addEventListener('pointerleave', hideHover, true);
  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(fitChart, 120); });
  // Dan se osvježava dok je tab otvoren.
  setInterval(() => { if (C.P.tab === 'metals' && M.range === '1d' && !M.loading && document.visibilityState === 'visible') load(true); }, 60_000);
}

// ---------- Podaci ----------
export async function openMetals() {
  if (!M.data) { M.loading = true; C.rerender(); }
  await Promise.all([load(true), loadSettings()]);
  C.rerender();
}
async function load(quiet = false) {
  if (M.range === 'custom' && !(M.from && M.to)) { M.data = null; M.loading = false; if (!quiet) C.rerender(); return; }
  M.loading = true; M.error = '';
  if (!quiet) C.rerender();
  try {
    const q = new URLSearchParams({ range: M.range });
    if (M.range === 'custom') { q.set('from', M.from); q.set('to', M.to); }
    M.data = await C.api(`/api/portal/metals?${q}`);
  } catch (err) { M.error = err.message || 'Could not load prices.'; M.data = null; }
  M.loading = false;
  if (C.P.tab === 'metals') C.rerender();
}
async function loadSettings() {
  try {
    M.cfg = await C.api('/api/portal/metals/settings');
    if (!M.dirty) M.draft = JSON.parse(JSON.stringify(M.cfg.settings.alerts));
  } catch (err) { M.error = err.message; }
}

// ---------- Brojevi ----------
const conv = (oz) => (M.unit === 'g' ? oz / OZ : oz);
const num = (v, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (oz) => `$${num(conv(oz))}`;
const signedMoney = (oz) => `${oz >= 0 ? '+' : '−'}$${num(Math.abs(conv(oz)))}`;
const unitShort = () => (M.unit === 'g' ? '/g' : '/oz');
const unitLabel = () => (M.unit === 'g' ? 'per gram' : 'per troy oz');
const pct = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(Math.abs(v) < 10 ? 2 : 1)}%`;
const dir = (v) => (v >= 0 ? UP : DOWN);
const badge = (v) => `<span class="mm-badge ${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(Math.abs(v) < 10 ? 2 : 1)}%</span>`;
const fmtDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const rangeLabel = () => (M.range === 'custom' ? (M.from && M.to ? `${fmtDay(M.from)} to ${fmtDay(M.to)}` : 'custom range') : RANGES.find(([k]) => k === M.range)[2]);
function xLabel(t, span) {
  const d = new Date(t);
  if (span <= 1.6 * DAY) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (span <= 10 * DAY) return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  if (span <= 400 * DAY) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
const fullDate = (t, span) => new Date(t).toLocaleString('en-US', span <= 10 * DAY ? { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' });

// ---------- Grafici (SVG) ----------
function spark(s) {
  const pts = s.points;
  const n = pts.length;
  const W = 140; const H = 40;
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys); const hi = Math.max(...ys);
  const step = Math.max(1, Math.floor(n / 70));
  const parts = [];
  for (let i = 0; i < n; i += step) parts.push(i);
  if (parts[parts.length - 1] !== n - 1) parts.push(n - 1);
  const d = parts.map((i, k) => `${k ? 'L' : 'M'}${((i / (n - 1 || 1)) * W).toFixed(1)},${(3 + (1 - (ys[i] - lo) / (hi - lo || 1)) * (H - 6)).toFixed(1)}`).join('');
  return `<svg class="mm-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${dir(s.changePct)}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
function chart(s) {
  const pts = s.points;
  const n = pts.length;
  const W = M.w || 900; const narrow = W < 560;
  const H = narrow ? 250 : 330; const L = 8; const R = narrow ? 60 : 74; const T = 18; const B = 30;
  const ys = pts.map((p) => conv(p[1]));
  let lo = Math.min(...ys); let hi = Math.max(...ys);
  const pad = (hi - lo) * 0.12 || hi * 0.01;
  lo -= pad; hi += pad;
  const X = (i) => L + (i / (n - 1 || 1)) * (W - L - R);
  const Y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const color = dir(s.changePct);
  const line = ys.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const area = `${line}L${X(n - 1).toFixed(1)},${H - B}L${X(0).toFixed(1)},${H - B}Z`;
  const span = pts[n - 1][0] - pts[0][0];
  const yt = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 5);
  const xn = narrow ? 3 : 5;
  const xi = Array.from({ length: xn }, (_, k) => Math.round((k * (n - 1)) / (xn - 1)));
  const fmtY = (v) => (v >= 1000 ? num(v, 0) : num(v));
  const last = ys[n - 1];
  M.geo = { pts, ys, n, L, R, W, H, T, B, lo, hi, span, first: ys[0] };
  const name = METALS.find(([k]) => k === M.sel)[1];
  return `<div class="mm-chart-wrap"><svg class="mm-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${C.esc(name)} price chart, ${C.esc(rangeLabel())}" data-mm-chart>
      <defs><linearGradient id="mmfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      ${yt.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="mm-grid"/><text x="${W - R + 10}" y="${(Y(v) + 4).toFixed(1)}" class="mm-ax">${fmtY(v)}</text>`).join('')}
      ${xi.map((i, k) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="${k === 0 ? 'start' : k === xi.length - 1 ? 'end' : 'middle'}" class="mm-ax">${C.esc(xLabel(pts[i][0], span))}</text>`).join('')}
      <path d="${area}" fill="url(#mmfill)"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <line x1="${L}" x2="${W - R}" y1="${Y(last).toFixed(1)}" y2="${Y(last).toFixed(1)}" class="mm-last"/>
      <g transform="translate(${W - R + 4},${(Y(last) - 11).toFixed(1)})"><rect width="${R - 6}" height="22" rx="6" fill="${color}"/><text x="${(R - 6) / 2}" y="15" text-anchor="middle" class="mm-last-t">${fmtY(last)}</text></g>
      <g data-mm-hover style="display:none"><line class="mm-cross" y1="${T}" y2="${H - B}"/><circle r="5" fill="${color}" stroke="#0d1416" stroke-width="2.5"/></g></svg>
      <div class="mm-tip" data-mm-tip hidden></div></div>`;
}
// Grafik se crta u stvarnoj širini (viewBox = pikseli), da tekst ostane oštar i na telefonu.
function fitChart() {
  const box = C && C.app.querySelector('.mm-plot');
  const s = M.data && M.data.metals && M.data.metals[M.sel];
  if (!box || !s || s.error || C.P.tab !== 'metals') return;
  const w = Math.round(Math.max(300, Math.min(1400, box.clientWidth)));
  if (Math.abs(w - (M.w || 0)) <= 8) return;
  M.w = w;
  const wrap = box.querySelector('.mm-chart-wrap');
  if (wrap) wrap.outerHTML = chart(s);
}
function hideHover() {
  const g = C?.app.querySelector('[data-mm-hover]');
  if (g) g.style.display = 'none';
  C?.app.querySelector('[data-mm-tip]')?.setAttribute('hidden', '');
}
function onMove(e) {
  const svg = e.target.closest?.('[data-mm-chart]');
  if (!svg || !M.geo) return;
  const g = M.geo;
  const r = svg.getBoundingClientRect();
  const vx = ((e.clientX - r.left) / r.width) * g.W;
  const i = Math.max(0, Math.min(g.n - 1, Math.round(((vx - g.L) / (g.W - g.L - g.R)) * (g.n - 1))));
  const px = g.L + (i / (g.n - 1 || 1)) * (g.W - g.L - g.R);
  const py = g.T + (1 - (g.ys[i] - g.lo) / (g.hi - g.lo || 1)) * (g.H - g.T - g.B);
  const grp = svg.querySelector('[data-mm-hover]');
  grp.style.display = '';
  const ln = grp.querySelector('line'); ln.setAttribute('x1', px); ln.setAttribute('x2', px);
  const c = grp.querySelector('circle'); c.setAttribute('cx', px); c.setAttribute('cy', py);
  const ch = g.first ? ((g.ys[i] - g.first) / g.first) * 100 : 0;
  const tip = C.app.querySelector('[data-mm-tip]');
  tip.innerHTML = `<b>$${num(g.ys[i])}<small>${unitShort()}</small></b><em style="color:${dir(ch)}">${pct(ch)} from start</em><span>${C.esc(fullDate(g.pts[i][0], g.span))}</span>`;
  tip.removeAttribute('hidden');
  tip.style.left = `${Math.min(86, Math.max(14, (px / g.W) * 100))}%`;
  tip.style.top = `${Math.max(0, (py / g.H) * 100)}%`;
  tip.classList.toggle('below', py / g.H < 0.3);
}

// ---------- Prikaz ----------
export function metalsView() {
  const { esc } = C;
  setTimeout(fitChart, 0);
  const d = M.data;
  const seg = (items, cur, act, key, label) => `<div class="mm-seg" role="group" aria-label="${label}">${items.map(([k, l]) => `<button type="button" class="${cur === k ? 'on' : ''}" data-mm="${act}" data-${key}="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
  const today = new Date().toISOString().slice(0, 10);
  const custom = M.range === 'custom' ? `<div class="mm-custom"><label><span>From</span><input class="in" type="date" data-no-count data-mm-from value="${esc(M.from)}" min="2000-01-01" max="${today}" /></label><label><span>To</span><input class="in" type="date" data-no-count data-mm-to value="${esc(M.to)}" min="2000-01-01" max="${today}" /></label><button type="button" class="btn small" data-mm="apply" ${M.from && M.to ? '' : 'disabled'}>Show</button></div>` : '';
  const updated = d?.at ? new Date(d.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  const cards = METALS.map(([k, label, sym]) => {
    const s = d?.metals?.[k];
    const ok = s && !s.error;
    const now = ok ? s.last : d?.spot?.[k];
    return `<button type="button" class="mm-card m-${k} ${M.sel === k ? 'on' : ''}" data-mm="metal" data-m="${k}" aria-pressed="${M.sel === k}">
      <span class="mm-card-top"><span class="mm-sym">${sym}</span><span class="mm-card-n">${label}</span>${ok ? badge(s.changePct) : ''}</span>
      <span class="mm-card-p">${now ? money(now) : M.loading ? '<i class="mm-sk"></i>' : '—'}<small>${unitShort()}</small></span>
      ${ok ? spark(s) : '<span class="mm-spark-empty"></span>'}</button>`;
  }).join('');
  const s = d?.metals?.[M.sel];
  const selLabel = METALS.find(([k]) => k === M.sel)[1];
  const box = (inner) => `<div class="mm-plot">${inner}</div>`;
  let panel;
  if (M.loading && !d) panel = box('<div class="mm-skel" role="status" aria-busy="true"><span>Loading prices…</span></div>');
  else if (M.error) panel = box(`<div class="mm-empty" role="alert"><p>${esc(M.error)}</p><button type="button" class="btn small" data-mm="retry">Try again</button></div>`);
  else if (M.range === 'custom' && !d) panel = box('<div class="mm-empty"><p>Pick a start and an end date, then press Show.</p></div>');
  else if (!s || s.error) panel = box(`<div class="mm-empty" role="alert"><p>${esc(s?.error || 'No data for this range.')}</p><button type="button" class="btn small" data-mm="retry">Try again</button></div>`);
  else {
    const spanMs = s.points[s.points.length - 1][0] - s.points[0][0];
    const range = s.high && s.low ? ((s.high - s.low) / s.low) * 100 : 0;
    panel = `<div class="mm-panel-head">
        <div><p class="mm-kick"><span class="mm-sym sm m-${M.sel}">${METALS.find(([k]) => k === M.sel)[2]}</span>${esc(selLabel)} · ${unitLabel()}</p>
          <p class="mm-big">${money(s.last)}</p>
          <p class="mm-chg"><b style="color:${dir(s.changePct)}">${signedMoney(s.change)} (${pct(s.changePct)})</b><span>${esc(rangeLabel())}</span></p></div>
        <p class="mm-upd"><i class="mm-dot ${s.own || s.stale ? '' : 'live'}"></i>${s.own ? 'From our 5-minute price checks' : s.stale ? 'Showing saved data' : `Live spot${updated ? ` · updated ${esc(updated)}` : ''}`}</p></div>
      <div class="mm-plot ${M.loading ? 'is-loading' : ''}">${chart(s)}</div>
      <dl class="mm-kpis">
        <div><dt>Open</dt><dd>${money(s.first)}</dd><small>start of range</small></div>
        <div><dt>High</dt><dd>${money(s.high)}</dd><small>${esc(fullDate(s.highAt, spanMs))}</small></div>
        <div><dt>Low</dt><dd>${money(s.low)}</dd><small>${esc(fullDate(s.lowAt, spanMs))}</small></div>
        <div><dt>Range</dt><dd>${range.toFixed(1)}%</dd><small>high vs low</small></div>
        <div><dt>Change</dt><dd style="color:${dir(s.changePct)}">${pct(s.changePct)}</dd><small>${signedMoney(s.change)}${unitShort()}</small></div>
      </dl>`;
  }
  return `<section class="mm">
      <header class="mm-head"><div><h2>Metal movement</h2><p>Gold, silver and platinum spot prices, the same prices your Pricing tab uses.</p></div>
        <div class="mm-ctrl">${seg(RANGES.map(([k, l]) => [k, l]), M.range, 'range', 'r', 'Time range')}${seg([['g', 'Per gram'], ['oz', 'Per oz']], M.unit, 'unit', 'u', 'Unit')}</div></header>
      ${custom}
      <div class="mm-cards">${cards}</div>
      <section class="mm-panel">${panel}</section>
      ${s && !s.error && !s.own ? '<p class="mm-foot">History follows COMEX futures, scaled to today’s spot price so it matches your Pricing tab. Markets close on weekends, so those hours are skipped.</p>' : ''}
      ${alertsView()}
    </section>`;
}
function alertsView() {
  const { esc } = C;
  if (!M.cfg || !M.draft) return '';
  const ro = C.readOnly();
  const a = M.draft;
  const saved = M.cfg.settings;
  const spot = M.cfg.spot || {};
  const isQuick = QUICK.includes(a.threshold);
  const prog = METALS.map(([k, label, sym]) => {
    const watching = saved.alerts.on && saved.alerts.metals[k];
    const on = watching && saved.base[k] > 0 && spot[k] > 0;
    if (!on) return `<div class="mm-prog off"><span class="mm-sym sm m-${k}">${sym}</span><div class="mm-prog-b"><div class="mm-prog-t"><b>${label}</b><span>${watching ? 'Starts with the next price check' : 'Not watched'}</span></div><div class="mm-track"><i style="width:0"></i></div></div></div>`;
    const ch = ((spot[k] - saved.base[k]) / saved.base[k]) * 100;
    const w = Math.min(100, (Math.abs(ch) / saved.alerts.threshold) * 100);
    return `<div class="mm-prog"><span class="mm-sym sm m-${k}">${sym}</span><div class="mm-prog-b"><div class="mm-prog-t"><b>${label}</b><span><em style="color:${dir(ch)}">${pct(ch)}</em> of ±${saved.alerts.threshold}% · from ${money(saved.base[k])}</span></div><div class="mm-track"><i style="width:${w.toFixed(0)}%;background:${dir(ch)}"></i></div></div></div>`;
  }).join('');
  const rows = (M.cfg.alerts || []).map((x) => {
    const m = METALS.find(([k]) => k === x.metal) || [x.metal, x.metal, '?'];
    return `<tr><td><span class="mm-sym sm m-${esc(m[0])}">${m[2]}</span>${esc(m[1])}</td><td>${badge(x.pct)}</td><td>${money(x.from)} → ${money(x.to)}<small>${unitShort()}</small></td><td>${esc(new Date(x.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td></tr>`;
  }).join('');
  return `<section class="mm-alerts" data-mm-alerts>
    <div class="mm-al-head"><div><h3>Price alerts</h3><p>Get a notification when a metal moves by your chosen percentage. Prices are checked every 5 minutes; after an alert, that price becomes the new starting point.</p></div>
      <label class="mm-switch"><input type="checkbox" data-mm-on ${a.on ? 'checked' : ''} ${ro ? 'disabled' : ''} /><span aria-hidden="true"></span><b>${a.on ? 'On' : 'Off'}</b></label></div>
    <div class="mm-al-grid">
      <div class="mm-al-set ${a.on ? '' : 'off'}">
        <div class="mm-field"><span class="mm-lab">Alert me at every</span>
          <div class="mm-th"><div class="mm-seg" role="group" aria-label="Threshold">${QUICK.map((q) => `<button type="button" class="${a.threshold === q ? 'on' : ''}" data-mm="th" data-v="${q}" ${ro ? 'disabled' : ''}>${q}%</button>`).join('')}</div>
            <label class="mm-thin ${isQuick ? '' : 'on'}"><span>Custom</span><input class="in" type="number" data-no-count data-mm-th min="0.5" max="50" step="0.5" value="${esc(a.threshold)}" ${ro ? 'readonly' : ''} /><span>%</span></label></div></div>
        <div class="mm-field"><span class="mm-lab">Watch</span>
          <div class="mm-mets">${METALS.map(([k, l, sym]) => `<button type="button" class="mm-met ${a.metals[k] ? 'on' : ''}" data-mm="met" data-m="${k}" aria-pressed="${!!a.metals[k]}" ${ro ? 'disabled' : ''}><span class="mm-sym sm m-${k}">${sym}</span>${l}<i class="mm-check" aria-hidden="true"></i></button>`).join('')}</div></div>
        ${ro ? '<p class="hint">Admin view is read-only.</p>' : `<div class="mm-save"><button type="button" class="btn gold" data-mm="save" ${M.dirty && !M.saving ? '' : 'disabled'}>${M.saving ? 'Saving…' : 'Save alerts'}</button><span class="psaved" data-mm-msg role="status">${M.dirty ? 'Unsaved changes.' : esc(M.msg)}</span></div>`}
      </div>
      <div class="mm-al-prog"><span class="mm-lab">Progress to the next alert</span>${prog}</div>
    </div>
    <div class="mm-al-recent"><span class="mm-lab">Recent alerts</span>${rows ? `<div class="mm-table-wrap"><table class="mm-table"><thead><tr><th>Metal</th><th>Move</th><th>Price</th><th>When</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="mm-none">No alerts yet. They also show in Notifications, with a number on the tab.</p>'}</div>
  </section>`;
}

// ---------- Rukovanje ----------
function onClick(e) {
  if (C.P.tab !== 'metals') return;
  const t = e.target.closest('[data-mm]');
  if (!t) return;
  const a = t.dataset.mm;
  if (a === 'range') {
    M.range = t.dataset.r;
    if (M.range === 'custom' && !M.to) { M.to = new Date().toISOString().slice(0, 10); M.from = new Date(Date.now() - 90 * DAY).toISOString().slice(0, 10); }
    load();
  }
  else if (a === 'unit') { M.unit = t.dataset.u; M.w = 0; C.rerender(); }
  else if (a === 'metal') { M.sel = t.dataset.m; M.w = 0; C.rerender(); }
  else if (a === 'apply' || a === 'retry') load();
  else if (a === 'th') { M.draft.threshold = Number(t.dataset.v); dirty(true); }
  else if (a === 'met') { M.draft.metals[t.dataset.m] = !M.draft.metals[t.dataset.m]; dirty(true); }
  else if (a === 'save') save();
}
function dirty(rerender) { M.dirty = true; M.msg = ''; if (rerender) C.rerender(); }
function onInput(e) {
  if (C.P.tab !== 'metals') return;
  const t = e.target;
  if (!t.hasAttribute?.('data-mm-th')) return;
  const v = Number(t.value);
  if (!(v >= 0.5 && v <= 50)) return;
  M.draft.threshold = Math.round(v * 10) / 10; dirty(false);
  const b = C.app.querySelector('[data-mm="save"]'); if (b) b.disabled = false;
  const m = C.app.querySelector('[data-mm-msg]'); if (m) m.textContent = 'Unsaved changes.';
  C.app.querySelectorAll('[data-mm="th"]').forEach((el) => el.classList.toggle('on', Number(el.dataset.v) === M.draft.threshold));
  t.closest('.mm-thin')?.classList.toggle('on', !QUICK.includes(M.draft.threshold));
}
function onChange(e) {
  if (C.P.tab !== 'metals') return;
  const t = e.target;
  if (t.hasAttribute?.('data-mm-from')) { M.from = t.value; markApply(); }
  else if (t.hasAttribute?.('data-mm-to')) { M.to = t.value; markApply(); }
  else if (t.hasAttribute?.('data-mm-on')) { M.draft.on = t.checked; dirty(true); }
}
function markApply() { const b = C.app.querySelector('[data-mm="apply"]'); if (b) b.disabled = !(M.from && M.to); }
async function save() {
  if (M.saving || !M.dirty) return;
  M.saving = true; C.rerender();
  try {
    M.cfg = await C.api('/api/portal/metals/settings', { method: 'PUT', body: JSON.stringify({ alerts: M.draft }), json: true });
    M.draft = JSON.parse(JSON.stringify(M.cfg.settings.alerts));
    M.dirty = false;
    M.msg = M.cfg.settings.alerts.on ? `Saved. You will get an alert at every ±${M.cfg.settings.alerts.threshold}% move.` : 'Saved. Alerts are off.';
  } catch (err) { M.msg = err.message || 'Could not save.'; }
  M.saving = false;
  C.rerender();
}
