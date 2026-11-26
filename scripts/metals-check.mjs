// Metal movement (26.11.2026): rasponi grafika, keš, rezerva kad izvor istorije ne radi, upozorenja i Notifications.
// Traži lazni izvor cijena:  node scripts/mock-metals.mjs 8898   i u .dev.vars MARKET_BASE i YAHOO_BASE na http://127.0.0.1:8898
//   BASE=http://127.0.0.1:8825 node scripts/metals-check.mjs   (token iz .dev.vars)
import { readFileSync } from 'node:fs';
import { evaluate, customRange, downsample, scaleToSpot, statsOf, cleanMetalSettings, metalSettings } from '../src/metals.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const MOCK = process.env.MOCK || 'http://127.0.0.1:8898';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const mock = (q) => fetch(`${MOCK}/set?${q}`).then((r) => r.json());
const charts = async () => (await fetch(`${MOCK}/stats`).then((r) => r.json())).charts;

// ---- Čiste funkcije ----
const A = { on: true, threshold: 5, metals: { gold: true, silver: true, platinum: false } };
let ev = evaluate(A, {}, { gold: 100, silver: 20, platinum: 50 });
ok(ev.changed && !ev.fired.length && ev.base.gold === 100 && ev.base.silver === 20 && ev.base.platinum === undefined, 'prva provjera postavlja osnovicu (platina isključena)');
ev = evaluate(A, ev.base, { gold: 104.9, silver: 20, platinum: 99 });
ok(!ev.changed && !ev.fired.length, 'ispod praga nema upozorenja, isključen metal se ne gleda');
ev = evaluate(A, ev.base, { gold: 105, silver: 18.9, platinum: 99 });
ok(ev.fired.length === 2 && ev.fired.find((f) => f.metal === 'gold').pct === 5 && ev.fired.find((f) => f.metal === 'silver').pct === -5.5 && ev.base.gold === 105 && ev.base.silver === 18.9, 'tačno na pragu: upozorenje, pad i rast, nova osnovica');
ok(evaluate({ ...A, threshold: 1 }, { gold: 100 }, { gold: 99 }).fired[0].pct === -1, 'prag 1%: pad od 1% javlja');
ok(customRange('2025-01-01', '2025-03-01', Date.UTC(2026, 10, 26)).interval === '1d' && customRange('2026-11-20', '2026-11-25', Date.UTC(2026, 10, 26)).interval === '15m' && customRange('2026-10-01', '2026-11-10', Date.UTC(2026, 10, 26)).interval === '1h', 'custom raspon: interval po starosti i dužini');
ok(customRange('2026-11-30', '2026-12-05', Date.UTC(2026, 10, 26)).error && customRange('1999-01-01', '2000-02-01').error && customRange('', '2025-01-01').error && customRange('2026-11-26', '2026-11-26', Date.UTC(2026, 10, 26, 12)).error, 'custom raspon: budućnost, prije 2000, prazno i manje od dana se odbijaju');
ok(downsample(Array.from({ length: 1261 }, (_, i) => [i, i]), 500).length <= 501 && downsample([[1, 1], [2, 2]], 500).length === 2, 'downsample');
const sc = scaleToSpot([[1, 100], [2, 101.5]], 100);
ok(sc.scaled && Math.abs(sc.points[1][1] - 100) < 0.01 && Math.abs(sc.points[0][1] - 98.52) < 0.02 && !scaleToSpot([[1, 100], [2, 200]], 100).scaled, 'skala terminske serije na spot (samo u razumnim granicama)');
const st = statsOf([[1, 10], [2, 14], [3, 8], [4, 11]]);
ok(st.first === 10 && st.last === 11 && st.high === 14 && st.low === 8 && Math.abs(st.changePct - 10) < 1e-9, 'statistika: start, kraj, high, low, promjena %');
ok(cleanMetalSettings({ threshold: 0 }).error && cleanMetalSettings({ threshold: 51 }).error && cleanMetalSettings({ threshold: 'x' }).error && cleanMetalSettings({ threshold: 2.26 }).threshold === 2.3, 'prag: 0.5 do 50, zaokruženo na jednu decimalu');
ok(metalSettings({}).alerts.on === true && metalSettings({}).alerts.threshold === 5, 'podrazumijevano: uključeno, 5%');

// ---- Probna radnja ----
await mock('XAU=3500&XAG=40&XPT=1250&fail=0');
const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Metal Check Jewelers' }) }).then(j)).body.client;
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
const V = { 'x-portal-token': (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token, 'content-type': 'application/json' };
const get = (path, h = C) => fetch(`${BASE}${path}`, { headers: h }).then(j);
const put = (b, h = C) => fetch(`${BASE}/api/portal/metals/settings`, { method: 'PUT', headers: h, body: JSON.stringify(b) }).then(j);
const sweep = (at) => fetch(`${BASE}/api/admin/metals/sweep${at ? `?at=${at}` : ''}`, { method: 'POST', headers: H }).then(j);

ok((await fetch(`${BASE}/api/admin/metals/sweep`, { method: 'POST', headers: { 'content-type': 'application/json' } })).status === 403, 'sweep bez admin prijave: 403');
ok((await fetch(`${BASE}/api/portal/metals`).then(j)).status === 401, 'grafik bez prijave: 401');
const s0 = (await get('/api/portal/metals/settings')).body;
ok(s0.settings.alerts.on && s0.settings.alerts.threshold === 5 && Object.values(s0.settings.alerts.metals).every(Boolean) && s0.thresholds.includes(5) && s0.spot.gold === 3500, 'postavke: uključeno 5%, sva tri metala, spot sa izvora');

// Rasponi
for (const r of ['1d', '1w', '1m', '1y', '5y']) {
  const d = (await get(`/api/portal/metals?range=${r}`)).body;
  const g = d.metals?.gold;
  ok(g && !g.error && g.points.length >= 2 && g.points.length <= 501 && g.high >= g.low && Number.isFinite(g.changePct) && Math.abs(g.last - d.spot.gold) < 0.02 && g.scaled === true, `raspon ${r}: ${g?.points?.length} tačaka, kraj = spot, skalirano`);
  ok(['silver', 'platinum'].every((k) => d.metals[k]?.points?.length >= 2 && Math.abs(d.metals[k].last - d.spot[k]) < 0.02), `raspon ${r}: srebro i platina`);
}
const y5 = (await get('/api/portal/metals?range=5y')).body.metals.gold.points;
ok(y5[y5.length - 1][0] - y5[0][0] > 4.5 * 365 * 864e5 && y5.every((p, i) => !i || p[0] > y5[i - 1][0]), '5Y: pet godina, tačke rastu po vremenu');
ok(!(await get('/api/portal/metals?range=1m')).body.metals.gold.points.some((p) => p[1] === null), 'prazne tačke izvora (null) su izbačene');

// Keš: isti raspon dva puta = jedan poziv izvora po metalu
const before = await charts();
await get('/api/portal/metals?range=1y');
await get('/api/portal/metals?range=1y');
ok((await charts()) === before, 'keš: ponovljen raspon ne zove izvor istorije');
const day = (n) => new Date(Date.UTC(2023, 0, 1) + n * 864e5).toISOString().slice(0, 10);
const off = Math.floor(Date.now() / 1000) % 600; // novi raspon pri svakom pokretanju (keš traje sat)
const cu = `/api/portal/metals?range=custom&from=${day(off)}&to=${day(off + 60)}`;
const c1 = await get(cu);
const after1 = await charts();
await get(cu);
ok(c1.status === 200 && c1.body.metals.gold.points.length > 30 && after1 === before + 3 && (await charts()) === after1, `custom ${day(off)}..${day(off + 60)}: ${c1.body.metals?.gold?.points?.length} tačaka, keš po rasponu`);
ok((await get('/api/portal/metals?range=custom&from=2026-12-01&to=2026-12-09')).status === 400 && (await get('/api/portal/metals?range=custom&from=2025-05-01')).status === 400 && (await get('/api/portal/metals?range=custom&from=1998-01-01&to=2001-01-01')).status === 400 && (await get('/api/portal/metals?range=nope')).status === 400, 'custom i nepoznat raspon: 400 sa porukom');

// Rezerva: izvor istorije ne radi
await mock('fail=1');
const noOwn = await get('/api/portal/metals?range=custom&from=2024-02-01&to=2024-04-01');
ok(noOwn.status === 200 && ((noOwn.body.metals.gold.error && /not available/i.test(noOwn.body.metals.gold.error)) || noOwn.body.metals.gold.own === true), 'izvor ne radi, nema uzoraka: jasna poruka umjesto praznog grafika (ili naši uzorci iz ranijih pokretanja)');
const t0 = Date.now() - 3 * 3_600_000;
for (let i = 0; i < 4; i++) { await mock(`XAU=${3500 + i * 10}`); await sweep(t0 + i * 300_000); }
const own = await get('/api/portal/metals?range=custom&from=2024-03-01&to=2024-05-01');
ok(own.body.metals.gold.own === true && own.body.metals.gold.points.length >= 4, 'izvor ne radi, ima uzoraka: grafik iz naših provjera na 5 minuta');
const staleKey = '/api/portal/metals?range=5y';
const st5 = (await get(staleKey)).body.metals.gold;
ok(!st5.error && st5.points.length > 100, 'izvor ne radi, ima keša: pokazuje keširano');
await mock('fail=0&XAU=3500');

// ---- Upozorenja ----
ok((await put({ alerts: { on: true, threshold: 0, metals: {} } })).status === 400 && (await put({ alerts: { on: true, threshold: 99 } })).status === 400, 'prag izvan 0.5-50: 400');
ok((await put({ alerts: { on: true, threshold: 5, metals: { gold: true, silver: true, platinum: false } } }, V)).status === 403, 'admin pregled ne mijenja upozorenja');
const sv = (await put({ alerts: { on: true, threshold: 5, metals: { gold: true, silver: true, platinum: false } } })).body;
ok(sv.settings.alerts.metals.platinum === false && sv.settings.base.gold === 3500 && sv.settings.base.silver === 40 && !sv.settings.base.platinum, 'Save: osnovica = današnja cijena samo za izabrane metale');
await mock('XAU=3600&XAG=40.4&XPT=2000'); // zlato +2.86%, srebro +1%, platina isključena
await sweep();
ok((await get('/api/portal/metals/settings')).body.alerts.length === 0, 'ispod 5%: nema upozorenja (ni za isključenu platinu koja je skočila 60%)');
await mock('XAU=3700'); // +5.71% od 3500
await sweep();
let a1 = (await get('/api/portal/metals/settings')).body;
ok(a1.alerts.length === 1 && a1.alerts[0].metal === 'gold' && a1.alerts[0].pct > 5.7 && a1.alerts[0].pct < 5.72 && a1.alerts[0].from === 3500 && a1.alerts[0].to === 3700 && a1.settings.base.gold === 3700, 'zlato +5.71%: jedno upozorenje, nova osnovica 3700');
await mock('XAU=3800'); await sweep(); // +2.7% od nove osnovice
ok((await get('/api/portal/metals/settings')).body.alerts.length === 1, 'poslije upozorenja se broji od nove cijene (+2.7% nije dovoljno)');
await mock('XAU=3300'); await sweep(); // -13.2% od 3800? osnovica je ostala 3700: -10.8%
a1 = (await get('/api/portal/metals/settings')).body;
ok(a1.alerts.length === 2 && a1.alerts[0].pct < -10 && a1.alerts[0].to === 3300, `pad ${a1.alerts[0]?.pct}%: drugo upozorenje`);
const n1 = (await get('/api/portal/notifications')).body;
const mm = n1.items.filter((x) => x.type === 'metal_move');
ok(mm.length === 2 && mm[0].lead === null && mm[0].meta.metal === 'gold' && mm[0].at >= mm[1].at && n1.unseen >= 2, 'upozorenja ulaze u Notifications (najnovije prvo, broje se kao nepročitana)');
await fetch(`${BASE}/api/portal/notifications/seen`, { method: 'POST', headers: C });
ok((await get('/api/portal/notifications')).body.unseen === 0, 'otvaranje Notifications ih označi pročitanim');

// Prag 2%, isključeno, ponovo uključeno
await put({ alerts: { on: true, threshold: 2, metals: { gold: true, silver: true, platinum: false } } });
ok((await get('/api/portal/metals/settings')).body.settings.base.gold === 3300, 'promjena praga: osnovica kreće od današnje cijene');
await mock('XAU=3380'); await sweep(); // +2.42%
ok((await get('/api/portal/metals/settings')).body.alerts.length === 3, 'prag 2%: +2.42% javlja');
await put({ alerts: { on: false, threshold: 2, metals: { gold: true, silver: true, platinum: false } } });
await mock('XAU=5000'); await sweep();
ok((await get('/api/portal/metals/settings')).body.alerts.length === 3, 'isključeno: ni skok od 48% ne javlja');
await put({ alerts: { on: true, threshold: 2, metals: { gold: true, silver: true, platinum: false } } });
ok((await get('/api/portal/metals/settings')).body.settings.base.gold === 5000, 'ponovo uključeno: osnovica = trenutna cijena (nema starog upozorenja)');
const pl = (await put({ alerts: { on: true, threshold: 2, metals: { gold: true, silver: true, platinum: true } } })).body;
ok(pl.settings.base.platinum === 2000, 'dodat metal: njegova osnovica = trenutna cijena');
const jsRes = await fetch(`${BASE}/portal/metals.js`);
ok(jsRes.status === 200 && (await jsRes.text()).includes('Metal movement'), 'portal/metals.js se servira');

console.log(fails ? `${fails} FAILED` : 'Metal movement checks passed.');
console.log(`PORTAL=${link}`);
process.exit(fails ? 1 : 0);
