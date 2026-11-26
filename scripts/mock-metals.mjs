// Lazni izvor cijena metala za lokalne testove (26.11.2026): isti oblik odgovora kao gold-api.com (/price/XAU) i Yahoo Finance
// (/v8/finance/chart/GC=F). Cijene se mijenjaju sa /set?XAU=3700, /set?fail=1 gasi istoriju, /stats broji pozive istorije.
//   node scripts/mock-metals.mjs 8898
//   u .dev.vars:  MARKET_BASE=http://127.0.0.1:8898   YAHOO_BASE=http://127.0.0.1:8898
import http from 'node:http';

const PORT = Number(process.argv[2]) || 8898;
const price = { XAU: 3500, XAG: 40, XPT: 1250 };
const FUT = { 'GC=F': 'XAU', 'SI=F': 'XAG', 'PL=F': 'XPT' };
let fail = false;
let charts = 0;

const STEP = { '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '1d': 86_400_000 };
const SPAN = { '1d': 86_400_000, '5d': 5 * 86_400_000, '1mo': 30 * 86_400_000, '1y': 365 * 86_400_000, '5y': 1825 * 86_400_000 };
// Deterministican "random walk": isti upit daje iste tacke.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function chart(sym, q) {
  const spot = price[FUT[sym]];
  if (!spot) return { chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } } };
  const step = STEP[q.get('interval')] || 86_400_000;
  const end = q.get('period2') ? Number(q.get('period2')) * 1000 : Date.now();
  const span = q.get('period1') ? end - Number(q.get('period1')) * 1000 : SPAN[q.get('range')] || 30 * 86_400_000;
  const n = Math.min(2000, Math.max(2, Math.floor(span / step)));
  const r = rng([...sym + (q.get('range') || q.get('period1')) + q.get('interval')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const ts = []; const close = [];
  let v = 1;
  const vals = [];
  for (let i = 0; i < n; i++) { v *= 1 + (r() - 0.48) * 0.012; vals.push(v); }
  const fut = spot * 1.015; // terminska cijena je malo iznad spot
  const k = fut / vals[n - 1];
  for (let i = 0; i < n; i++) { ts.push(Math.floor((end - (n - 1 - i) * step) / 1000)); close.push(i % 97 === 5 ? null : Math.round(vals[i] * k * 1000) / 1000); }
  return { chart: { result: [{ meta: { symbol: sym, currency: 'USD' }, timestamp: ts, indicators: { quote: [{ close }] } }], error: null } };
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  let m;
  if ((m = u.pathname.match(/^\/price\/(XAU|XAG|XPT)$/))) return send(200, { currency: 'USD', name: m[1], price: price[m[1]], symbol: m[1], updatedAt: new Date().toISOString() });
  if (u.pathname === '/set') {
    for (const k of Object.keys(price)) if (u.searchParams.has(k)) price[k] = Number(u.searchParams.get(k));
    if (u.searchParams.has('fail')) fail = u.searchParams.get('fail') === '1';
    return send(200, { price, fail });
  }
  if (u.pathname === '/stats') return send(200, { charts, price, fail });
  if ((m = u.pathname.match(/^\/v8\/finance\/chart\/(.+)$/))) {
    charts++;
    if (fail) return send(500, { chart: { result: null, error: { code: 'Internal', description: 'boom' } } });
    return send(200, chart(decodeURIComponent(m[1]), u.searchParams));
  }
  send(404, { error: 'not found' });
}).listen(PORT, '127.0.0.1', () => console.log(`mock metals on ${PORT}`));
