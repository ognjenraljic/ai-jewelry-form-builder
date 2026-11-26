// Metal movement (26.11.2026, Ognjen): tab u portalu sa grafikom (1D, 1W, 1M, 1Y, 5Y, Custom) i upozorenjima u Notifications
// kad se cijena zlata, srebra ili platine pomakne za podešen procenat.
//
// Izvori: live (spot) cijena sa gold-api.com, ista kao "Live price" u Pricing tabu; istorija sa Yahoo Finance (COMEX terminske
// cijene GC=F, SI=F, PL=F; neslužbeni javni endpoint, bez ključa). Istorija se kešira u D1 (zajednička za sve radnje), a
// svaka serija se skalira tako da završava na današnjoj spot cijeni (terminska cijena je ~1-2% iznad spot), pa su brojevi
// u grafiku isti kao u Pricing tabu; procenat promjene se skaliranjem ne mijenja.
// Upozorenja: cron svakih 5 min poredi spot cijenu sa osnovicom (cijena pri uključenju ili zadnjem upozorenju); kad razlika
// pređe prag (npr. 5%) upiše se upozorenje, a osnovica postaje nova cijena, pa sljedeće stiže tek poslije novih 5%.
export const OZ = 31.1035; // grama u troy unci
export const METALS = [
  { key: 'gold', label: 'Gold', symbol: 'GC=F', spot: 'XAU' },
  { key: 'silver', label: 'Silver', symbol: 'SI=F', spot: 'XAG' },
  { key: 'platinum', label: 'Platinum', symbol: 'PL=F', spot: 'XPT' },
];
const KEYS = METALS.map((m) => m.key);
const DAY = 86_400_000;
const UA = 'Mozilla/5.0 (compatible; JewelryLead/1.0)';
export const THRESHOLDS = [1, 2, 3, 5, 7.5, 10, 15, 20];
export const RANGES = {
  '1d': { range: '1d', interval: '5m', ttl: 120 },
  '1w': { range: '5d', interval: '15m', ttl: 600 },
  '1m': { range: '1mo', interval: '1h', ttl: 1800 },
  '1y': { range: '1y', interval: '1d', ttl: 21600 },
  '5y': { range: '5y', interval: '1d', ttl: 43200 },
};
const MAX_POINTS = 500;

// ---------- Raspon ----------
const parseDay = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return Number.isNaN(t) ? null : t; };
// Custom raspon: Yahoo daje 15 min samo za zadnjih 60 dana i sat za zadnje 2 godine, pa interval zavisi od starosti i dužine.
export function customRange(from, to, now = Date.now()) {
  const f = parseDay(from);
  const t = parseDay(to);
  if (f == null || t == null) return { error: 'Pick both dates.' };
  if (f < Date.UTC(2000, 0, 1)) return { error: 'The earliest date is 2000-01-01.' };
  const end = Math.min(t + DAY, now);
  if (end - f < DAY - 1) return { error: 'Pick at least one day, and not in the future.' };
  const span = (end - f) / DAY;
  const age = (now - f) / DAY;
  const interval = age <= 58 && span <= 7 ? '15m' : age <= 700 && span <= 58 ? '1h' : '1d';
  return { p1: Math.floor(f / 1000), p2: Math.floor(end / 1000), interval, ttl: 3600, key: `c${Math.floor(f / 1000)}-${Math.floor(end / 1000)}-${interval}` };
}
export function rangeParams(range, from, to, now = Date.now()) {
  if (RANGES[range]) return { ...RANGES[range], key: range };
  if (range === 'custom') return customRange(from, to, now);
  return { error: 'Unknown range.' };
}

// ---------- Izvor istorije (Yahoo) sa D1 keširanjem ----------
function parseYahoo(j) {
  const r = j?.chart?.result?.[0];
  const ts = r?.timestamp;
  const close = r?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(close)) throw new Error(j?.chart?.error?.description || 'No data');
  const out = [];
  for (let i = 0; i < ts.length; i++) if (Number(close[i]) > 0) out.push([ts[i] * 1000, Math.round(close[i] * 1000) / 1000]);
  if (out.length < 2) throw new Error('Not enough data');
  return out;
}
async function history(env, metal, params) {
  const k = `${metal.key}|${params.key}|${params.interval}`;
  const now = Date.now();
  const row = await env.DB.prepare('SELECT at, data FROM metal_cache WHERE k = ?').bind(k).first().catch(() => null);
  if (row && now - row.at < params.ttl * 1000) return { points: JSON.parse(row.data), cached: true };
  const base = env.YAHOO_BASE || 'https://query1.finance.yahoo.com';
  const qs = params.range ? `range=${params.range}&interval=${params.interval}` : `period1=${params.p1}&period2=${params.p2}&interval=${params.interval}`;
  try {
    const res = await fetch(`${base}/v8/finance/chart/${encodeURIComponent(metal.symbol)}?${qs}`, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const points = parseYahoo(await res.json());
    await env.DB.prepare('INSERT INTO metal_cache (k, at, data) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET at = excluded.at, data = excluded.data').bind(k, now, JSON.stringify(points)).run().catch(() => {});
    return { points, cached: false };
  } catch (e) {
    console.log('metal history', metal.symbol, params.key, e.message);
    if (row) return { points: JSON.parse(row.data), cached: true, stale: true }; // stari odgovor je bolji od praznog grafika
    throw e;
  }
}
// Rezerva: naši uzorci (spot svakih 5 min) kad izvor istorije ne radi.
async function ownHistory(env, metal, fromMs) {
  const rows = (await env.DB.prepare(`SELECT at, ${metal.key} AS p FROM metal_samples WHERE at >= ? AND ${metal.key} > 0 ORDER BY at`).bind(fromMs).all().catch(() => ({ results: [] }))).results;
  return rows.length >= 2 ? rows.map((r) => [r.at, r.p]) : null;
}

// ---------- Serija za grafik ----------
export function downsample(points, max = MAX_POINTS) {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = points.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}
export function statsOf(points) {
  let hi = points[0];
  let lo = points[0];
  for (const p of points) { if (p[1] > hi[1]) hi = p; if (p[1] < lo[1]) lo = p; }
  const first = points[0][1];
  const last = points[points.length - 1][1];
  return { first, last, change: last - first, changePct: first ? ((last - first) / first) * 100 : 0, high: hi[1], highAt: hi[0], low: lo[1], lowAt: lo[0] };
}
// Skala terminske serije na spot: faktor = spot / zadnja cijena serije (ako je u razumnim granicama).
export function scaleToSpot(points, spotOz) {
  const last = points[points.length - 1][1];
  const f = spotOz > 0 && last > 0 ? spotOz / last : 1;
  if (f < 0.9 || f > 1.1 || Math.abs(f - 1) < 1e-6) return { points, scaled: false };
  return { points: points.map(([t, p]) => [t, Math.round(p * f * 100) / 100]), scaled: true };
}
export async function metalSeries(env, metal, params, spotOz, now = Date.now()) {
  let h;
  try { h = await history(env, metal, params); }
  catch (e) {
    const own = await ownHistory(env, metal, params.range === '1d' ? now - DAY : params.range === '5d' ? now - 7 * DAY : params.p1 ? params.p1 * 1000 : now - 30 * DAY);
    if (!own) return { error: 'The price history is not available right now. Try again in a minute.' };
    h = { points: own, own: true };
  }
  const { points, scaled } = h.own ? { points: h.points, scaled: false } : scaleToSpot(h.points, spotOz);
  const st = statsOf(points);
  return { points: downsample(points), ...st, scaled, stale: !!h.stale, own: !!h.own, spot: spotOz || null };
}

// ---------- Podešavanja i upozorenja ----------
export function metalSettings(clientData) {
  const m = clientData?.metals || {};
  const a = m.alerts || {};
  const th = Number(a.threshold);
  return {
    alerts: {
      on: a.on !== false, // podrazumijevano uključeno, 5%
      threshold: th >= 0.5 && th <= 50 ? Math.round(th * 10) / 10 : 5,
      metals: Object.fromEntries(KEYS.map((k) => [k, a.metals?.[k] !== false])),
    },
    base: m.base && typeof m.base === 'object' ? m.base : {},
  };
}
export function cleanMetalSettings(b = {}, prev = {}) {
  const th = Number(b.threshold);
  if (!(th >= 0.5 && th <= 50)) return { error: 'Pick a percentage between 0.5 and 50.' };
  return { on: b.on !== false, threshold: Math.round(th * 10) / 10, metals: Object.fromEntries(KEYS.map((k) => [k, b.metals?.[k] !== false])) };
}
// Jedna provjera: koja upozorenja se pale i koja je nova osnovica. Čista funkcija (testira se bez baze).
export function evaluate(alerts, base, spot) {
  const next = { ...base };
  const fired = [];
  let changed = false;
  for (const k of KEYS) {
    const price = Number(spot?.[k]);
    if (!alerts.metals[k] || !(price > 0)) continue;
    const b = Number(next[k]);
    if (!(b > 0)) { next[k] = price; changed = true; continue; }
    const pct = ((price - b) / b) * 100;
    if (Math.abs(pct) >= alerts.threshold) { fired.push({ metal: k, from: b, to: price, pct: Math.round(pct * 100) / 100 }); next[k] = price; changed = true; }
  }
  return { base: next, fired, changed };
}
// Spot cijene direktno sa izvora (bez keša): cron mora vidjeti stvarno stanje.
export async function fetchSpot(env) {
  const base = env.MARKET_BASE || 'https://api.gold-api.com';
  const out = {};
  await Promise.all(METALS.map(async (m) => {
    try {
      const r = await fetch(`${base}/price/${m.spot}`, { signal: AbortSignal.timeout(4000) });
      const j = await r.json();
      if (Number(j.price) > 0) out[m.key] = Number(j.price);
    } catch (e) { console.log('metal spot', m.spot, e.message); }
  }));
  return out;
}
// Cron svakih 5 min: uzorak + upozorenja za sve radnje.
export async function metalSweep(env, now = Date.now(), spot = null) {
  const s = spot || (await fetchSpot(env));
  if (!KEYS.some((k) => s[k] > 0)) return { skipped: true, fired: 0 };
  await env.DB.prepare('INSERT OR REPLACE INTO metal_samples (at, gold, silver, platinum) VALUES (?,?,?,?)').bind(Math.floor(now / 300_000) * 300_000, s.gold || null, s.silver || null, s.platinum || null).run();
  if (new Date(now).getUTCMinutes() < 5) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM metal_samples WHERE at < ?').bind(now - 10 * DAY),
      env.DB.prepare('DELETE FROM metal_cache WHERE at < ?').bind(now - 30 * DAY),
      env.DB.prepare('DELETE FROM metal_alerts WHERE at < ?').bind(now - 400 * DAY),
    ]);
  }
  const clients = (await env.DB.prepare('SELECT id, data FROM clients WHERE archived_at IS NULL').all()).results;
  let fired = 0;
  for (const c of clients) {
    let d;
    try { d = JSON.parse(c.data || '{}'); } catch { continue; }
    const st = metalSettings(d);
    if (!st.alerts.on) continue;
    const r = evaluate(st.alerts, st.base, s);
    if (!r.changed) continue;
    d.metals = { ...(d.metals || {}), base: r.base };
    const batch = [env.DB.prepare('UPDATE clients SET data = ? WHERE id = ?').bind(JSON.stringify(d), c.id)];
    for (const f of r.fired) batch.push(env.DB.prepare('INSERT INTO metal_alerts (client_id, metal, from_price, to_price, pct, at) VALUES (?,?,?,?,?,?)').bind(c.id, f.metal, f.from, f.to, f.pct, now));
    await env.DB.batch(batch);
    fired += r.fired.length;
  }
  return { sampled: true, clients: clients.length, fired };
}
export async function recentAlerts(env, clientId, limit = 20) {
  return (await env.DB.prepare('SELECT id, metal, from_price, to_price, pct, at FROM metal_alerts WHERE client_id = ? ORDER BY at DESC LIMIT ?').bind(clientId, limit).all()).results
    .map((r) => ({ id: r.id, metal: r.metal, from: r.from_price, to: r.to_price, pct: r.pct, at: r.at }));
}
