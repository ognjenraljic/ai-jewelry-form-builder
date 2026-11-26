// Tab "Metal movement" u portalu (26.11.2026): grafik cijena zlata, srebra i platine (1D, 1W, 1M, 1Y, 5Y, Custom) i
// podešavanje upozorenja koja stižu u Notifications kad se cijena pomakne za izabran procenat.
// Cijene stižu u USD po troy unci; ovdje se prikazuju po gramu (kao u Pricing tabu) ili po unci.
let C = null; // { api, esc, readOnly, rerender, app, P }
const OZ = 31.1035;
const METALS = [['gold', 'Gold'], ['silver', 'Silver'], ['platinum', 'Platinum']];
const RANGES = [['1d', '1D'], ['1w', '1W'], ['1m', '1M'], ['1y', '1Y'], ['5y', '5Y'], ['custom', 'Custom']];
const QUICK = [1, 2, 3, 5, 10];
const UP = '#3ccf91';
const DOWN = '#ef6a6a';
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
  const first = !M.data;
  if (first) { M.loading = true; C.rerender(); }
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
const money = (oz) => `$${conv(oz).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const unitLabel = () => (M.unit === 'g' ? 'per gram' : 'per troy oz');
const pct = (v) => `${v > 0 ? '+' : ''}${v.toFixed(Math.abs(v) < 10 ? 2 : 1)}%`;
const dir = (v) => (v >= 0 ? UP : DOWN);
function xLabel(t, span) {
  const d = new Date(t);
  const DAY = 86_400_000;
  if (span <= 1.6 * DAY) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (span <= 10 * DAY) return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  if (span <= 400 * DAY) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
const fullDate = (t, span) => new Date(t).toLocaleString('en-US', span <= 10 * 86_400_000 ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' });

// ---------- Grafik (SVG) ----------
function chart(s) {
  const pts = s.points;
  const W = M.w || 900; const H = W < 520 ? 270 : 340; const L = W < 520 ? 56 : 66; const R = 12; const T = 14; const B = 30;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => conv(p[1]));
  const x0 = xs[0]; const x1 = xs[xs.length - 1];
  let lo = Math.min(...ys); let hi = Math.max(...ys);
  const pad = (hi - lo) * 0.1 || hi * 0.01;
  lo -= pad; hi += pad;
  const X = (t) => L + ((t - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const color = dir(s.changePct);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join('');
  const area = `${line}L${X(x1).toFixed(1)},${H - B}L${X(x0).toFixed(1)},${H - B}Z`;
  const span = x1 - x0;
  const yt = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const xt = Array.from({ length: 5 }, (_, i) => x0 + (span * i) / 4);
  const fmtY = (v) => (v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2));
  M.geo = { xs, ys, x0, x1, span, L, R, W, H, T, B, lo, hi };
  return `<div class="mm-chart-wrap"><svg class="mm-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Price chart" data-mm-chart>
      <defs><linearGradient id="mmfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      ${yt.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="mm-grid"/><text x="${L - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="mm-ax">$${fmtY(v)}</text>`).join('')}
      ${xt.map((t, i) => `<text x="${X(t).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" class="mm-ax">${xLabel(t, span)}</text>`).join('')}
      <path d="${area}" fill="url(#mmfill)"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <g data-mm-hover hidden><line class="mm-cross" y1="${T}" y2="${H - B}"/><circle r="5" fill="${color}" stroke="var(--panel)" stroke-width="2"/></g></svg>
      <div class="mm-tip" data-mm-tip hidden></div></div>`;
}
// Grafik se crta u stvarnoj sirini (viewBox = pikseli), da tekst ostane ostar i na telefonu.
function fitChart() {
  const box = C && C.app.querySelector('.mm-main');
  const s = M.data && M.data.metals && M.data.metals[M.sel];
  if (!box || !s || s.error || C.P.tab !== 'metals') return;
  const w = Math.round(Math.max(300, Math.min(1200, box.clientWidth)));
  if (Math.abs(w - (M.w || 0)) <= 8) return;
  M.w = w;
  const wrap = box.querySelector('.mm-chart-wrap');
  if (wrap) wrap.outerHTML = chart(s);
}
function hideHover() {
  const g = C?.app.querySelector('[data-mm-hover]');
  if (g) g.setAttribute('hidden', '');
  C?.app.querySelector('[data-mm-tip]')?.setAttribute('hidden', '');
}
function onMove(e) {
  const svg = e.target.closest?.('[data-mm-chart]');
  if (!svg || !M.geo) return;
  const g = M.geo;
  const r = svg.getBoundingClientRect();
  const vx = ((e.clientX - r.left) / r.width) * g.W;
  const t = g.x0 + ((vx - g.L) / (g.W - g.L - g.R)) * g.span;
  let lo = 0; let hi = g.xs.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (g.xs[mid] < t) lo = mid; else hi = mid; }
  const i = Math.abs(g.xs[lo] - t) <= Math.abs(g.xs[hi] - t) ? lo : hi;
  const px = g.L + ((g.xs[i] - g.x0) / (g.span || 1)) * (g.W - g.L - g.R);
  const py = g.T + (1 - (g.ys[i] - g.lo) / (g.hi - g.lo || 1)) * (g.H - g.T - g.B);
  const grp = svg.querySelector('[data-mm-hover]');
  grp.removeAttribute('hidden');
  grp.querySelector('line').setAttribute('x1', px); grp.querySelector('line').setAttribute('x2', px);
  const c = grp.querySelector('circle'); c.setAttribute('cx', px); c.setAttribute('cy', py);
  const tip = C.app.querySelector('[data-mm-tip]');
  tip.innerHTML = `<b>$${g.ys[i].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b><span>${C.esc(fullDate(g.xs[i], g.span))}</span>`;
  tip.removeAttribute('hidden');
  const left = (px / g.W) * 100;
  tip.style.left = `${Math.min(86, Math.max(14, left))}%`;
  tip.style.top = `${Math.max(0, (py / g.H) * 100 - 16)}%`;
}

// ---------- Prikaz ----------
export function metalsView() {
  const { esc } = C;
  setTimeout(fitChart, 0);
  const ro = C.readOnly();
  const d = M.data;
  const chips = RANGES.map(([k, l]) => `<button type="button" class="chip ${M.range === k ? 'on' : ''}" data-mm="range" data-r="${k}" aria-pressed="${M.range === k}">${l}</button>`).join('');
  const units = [['g', 'Per gram'], ['oz', 'Per oz']].map(([k, l]) => `<button type="button" class="chip ${M.unit === k ? 'on' : ''}" data-mm="unit" data-u="${k}" aria-pressed="${M.unit === k}">${l}</button>`).join('');
  const custom = M.range === 'custom' ? `<div class="mm-custom"><label>From<input class="in" type="date" data-no-count data-mm-from value="${esc(M.from)}" max="${new Date().toISOString().slice(0, 10)}" min="2000-01-01" /></label><label>To<input class="in" type="date" data-no-count data-mm-to value="${esc(M.to)}" max="${new Date().toISOString().slice(0, 10)}" min="2000-01-01" /></label><button type="button" class="btn small" data-mm="apply" ${M.from && M.to ? '' : 'disabled'}>Show</button></div>` : '';
  const cards = METALS.map(([k, label]) => {
    const s = d?.metals?.[k];
    const now = s && !s.error ? s.last : d?.spot?.[k];
    return `<button type="button" class="mm-card ${M.sel === k ? 'on' : ''}" data-mm="metal" data-m="${k}" aria-pressed="${M.sel === k}">
      <span class="mm-card-n">${label}</span>
      <b>${now ? money(now) : '—'}</b><small>${unitLabel()}</small>
      ${s && !s.error ? `<span class="mm-chg" style="color:${dir(s.changePct)}">${s.changePct >= 0 ? '▲' : '▼'} ${pct(s.changePct)}</span>` : '<span class="mm-chg faint">—</span>'}</button>`;
  }).join('');
  const s = d?.metals?.[M.sel];
  let body;
  if (M.loading && !d) body = '<div class="mm-skel" aria-busy="true" role="status"><span>Loading prices…</span></div>';
  else if (M.error) body = `<div class="mm-empty" role="alert"><p>${esc(M.error)}</p><button type="button" class="btn small" data-mm="retry">Try again</button></div>`;
  else if (M.range === 'custom' && !d) body = '<div class="mm-empty"><p>Pick a start and an end date, then press Show.</p></div>';
  else if (!s) body = '<div class="mm-empty"><p>No data.</p></div>';
  else if (s.error) body = `<div class="mm-empty" role="alert"><p>${esc(s.error)}</p><button type="button" class="btn small" data-mm="retry">Try again</button></div>`;
  else {
    body = `${chart(s)}<div class="mm-stats">
      <div><span>Start</span><b>${money(s.first)}</b></div><div><span>Now</span><b>${money(s.last)}</b></div>
      <div><span>High</span><b>${money(s.high)}</b><small>${esc(fullDate(s.highAt, s.points[s.points.length - 1][0] - s.points[0][0]))}</small></div>
      <div><span>Low</span><b>${money(s.low)}</b><small>${esc(fullDate(s.lowAt, s.points[s.points.length - 1][0] - s.points[0][0]))}</small></div>
      <div><span>Change</span><b style="color:${dir(s.changePct)}">${pct(s.changePct)}</b><small>${s.change >= 0 ? '+' : '−'}${money(Math.abs(s.change))}</small></div></div>
      <p class="mm-foot">${s.own ? 'Built from our own price checks every 5 minutes.' : 'History follows COMEX futures, scaled to today\'s live price so it matches your Pricing tab.'}${s.stale ? ' Showing the last saved data; the source did not answer just now.' : ''}</p>`;
  }
  return `<section class="mm-top">
      <div class="mm-bar"><div class="chips mm-ranges" role="group" aria-label="Range">${chips}</div><div class="chips mm-units" role="group" aria-label="Unit">${units}</div></div>
      ${custom}
      <div class="mm-cards">${cards}</div>
      <div class="mm-main ${M.loading && d ? 'is-loading' : ''}">${body}</div></section>
    ${alertsView(ro)}`;
}
function alertsView(ro) {
  const { esc } = C;
  if (!M.cfg || !M.draft) return '';
  const a = M.draft;
  const saved = M.cfg.settings;
  const spot = M.cfg.spot || {};
  const prog = METALS.filter(([k]) => saved.alerts.on && saved.alerts.metals[k] && saved.base[k] > 0 && spot[k] > 0).map(([k, label]) => {
    const ch = ((spot[k] - saved.base[k]) / saved.base[k]) * 100;
    const w = Math.min(100, (Math.abs(ch) / saved.alerts.threshold) * 100);
    return `<div class="mm-prog"><div class="mm-prog-t"><b>${label}</b><span>from ${money(saved.base[k])} to ${money(spot[k])} <em style="color:${dir(ch)}">${pct(ch)}</em></span></div><div class="mm-bar-track"><i style="width:${w.toFixed(0)}%;background:${dir(ch)}"></i></div><small>Alert at ±${saved.alerts.threshold}%</small></div>`;
  }).join('');
  const rec = (M.cfg.alerts || []).map((x) => {
    const label = METALS.find(([k]) => k === x.metal)?.[1] || x.metal;
    return `<li><span class="mm-dot" style="background:${dir(x.pct)}"></span><b>${label}</b> <em style="color:${dir(x.pct)}">${pct(x.pct)}</em> <span>${money(x.from)} → ${money(x.to)} ${unitLabel()}</span><time>${esc(new Date(x.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</time></li>`;
  }).join('');
  return `<section class="form-card mm-alerts" data-mm-alerts>
    <div class="row"><h2>Price alerts</h2><span class="pill ${saved.alerts.on ? 'on' : ''}">${saved.alerts.on ? 'On' : 'Off'}</span></div>
    <p class="faint">Get a notification when a metal has moved by a set percentage since the last alert. You see it in the Notifications tab, with a number on the tab. After an alert, the new price becomes the starting point for the next one.</p>
    <label class="ghl-on"><input type="checkbox" data-mm-on ${a.on ? 'checked' : ''} ${ro ? 'disabled' : ''} /><span><b>Alert me about metal movement</b><em>Checked every 5 minutes, day and night.</em></span></label>
    <div class="mm-set ${a.on ? '' : 'off'}">
      <div class="mm-field"><span class="mm-lab">Alert me every</span><div class="mm-th">${QUICK.map((q) => `<button type="button" class="chip ${a.threshold === q ? 'on' : ''}" data-mm="th" data-v="${q}" ${ro ? 'disabled' : ''}>${q}%</button>`).join('')}<label class="mm-thin"><input class="in" type="number" data-no-count data-mm-th min="0.5" max="50" step="0.5" value="${esc(a.threshold)}" ${ro ? 'readonly' : ''} /><span>%</span></label></div></div>
      <div class="mm-field"><span class="mm-lab">Metals</span><div class="mm-mets">${METALS.map(([k, l]) => `<label class="pcheck"><input type="checkbox" data-mm-met="${k}" ${a.metals[k] ? 'checked' : ''} ${ro ? 'disabled' : ''} /><span>${l}</span></label>`).join('')}</div></div>
    </div>
    ${ro ? '' : `<div class="pfoot"><button type="button" class="btn gold" data-mm="save" ${M.dirty && !M.saving ? '' : 'disabled'}>${M.saving ? 'Saving…' : 'Save alerts'}</button><span class="psaved" data-mm-msg role="status">${M.dirty ? 'Unsaved changes.' : esc(M.msg)}</span></div>`}
    ${prog ? `<h3 class="bks-h">Progress to the next alert</h3><div class="mm-progs">${prog}</div>` : ''}
    <h3 class="bks-h">Recent alerts</h3>${rec ? `<ul class="mm-recent">${rec}</ul>` : '<p class="faint">No alerts yet. They show up here and in Notifications.</p>'}
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
    if (M.range === 'custom') { if (!M.to) { M.to = new Date().toISOString().slice(0, 10); M.from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10); } C.rerender(); load(); }
    else load();
  }
  else if (a === 'unit') { M.unit = t.dataset.u; C.rerender(); }
  else if (a === 'metal') { M.sel = t.dataset.m; C.rerender(); }
  else if (a === 'apply') load();
  else if (a === 'retry') load();
  else if (a === 'th') { M.draft.threshold = Number(t.dataset.v); M.dirty = true; M.msg = ''; C.rerender(); }
  else if (a === 'save') save();
}
function onInput(e) {
  if (C.P.tab !== 'metals') return;
  const t = e.target;
  if (t.hasAttribute?.('data-mm-th')) { const v = Number(t.value); if (v >= 0.5 && v <= 50) { M.draft.threshold = Math.round(v * 10) / 10; M.dirty = true; M.msg = ''; markDirty(); } }
}
function onChange(e) {
  if (C.P.tab !== 'metals') return;
  const t = e.target;
  if (t.hasAttribute?.('data-mm-from')) { M.from = t.value; markApply(); }
  else if (t.hasAttribute?.('data-mm-to')) { M.to = t.value; markApply(); }
  else if (t.hasAttribute?.('data-mm-on')) { M.draft.on = t.checked; M.dirty = true; M.msg = ''; C.rerender(); }
  else if (t.dataset?.mmMet) { M.draft.metals[t.dataset.mmMet] = t.checked; M.dirty = true; M.msg = ''; C.rerender(); }
  else if (t.hasAttribute?.('data-mm-th')) C.rerender();
}
function markApply() { const b = C.app.querySelector('[data-mm="apply"]'); if (b) b.disabled = !(M.from && M.to); }
function markDirty() {
  const b = C.app.querySelector('[data-mm="save"]'); if (b) b.disabled = false;
  const m = C.app.querySelector('[data-mm-msg]'); if (m) m.textContent = 'Unsaved changes.';
}
async function save() {
  if (M.saving || !M.dirty) return;
  M.saving = true; M.error = ''; C.rerender();
  try {
    M.cfg = await C.api('/api/portal/metals/settings', { method: 'PUT', body: JSON.stringify({ alerts: M.draft }), json: true });
    M.draft = JSON.parse(JSON.stringify(M.cfg.settings.alerts));
    M.dirty = false;
    M.msg = M.cfg.settings.alerts.on ? `Saved. You will be alerted at every ±${M.cfg.settings.alerts.threshold}% move.` : 'Saved. Alerts are off.';
  } catch (err) { M.msg = err.message || 'Could not save.'; }
  M.saving = false;
  C.rerender();
}
