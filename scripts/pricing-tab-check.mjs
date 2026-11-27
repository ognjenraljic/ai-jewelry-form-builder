// Pricing tab 27.11.2026: tabela dijamanata, pravila, ostali rad i cjenovnik sata se čuvaju i vraćaju (API, bez pregledača).
//   BASE=http://127.0.0.1:8871 node scripts/pricing-tab-check.mjs   (token iz .dev.vars; na kraju ispiše PORTAL= link)
import { readFileSync } from 'node:fs';
import { SUGGESTED_PRICING, DISTRICT_DIAMOND_CHART } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8871';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

const tag = Date.now().toString(36).slice(-4);
const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: `Pricing Tab Jewelers ${tag}` }) }).then(j)).body.client;
await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) });
await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'grillz' }) });
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };

const put = await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: C, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, markup: 30 } }) }).then(j);
ok(put.status === 200, `Save cijena (${put.status} ${put.body.error || ''})`);
const pr = put.body.pricing || {};
ok(pr.diamonds?.on === true && Object.keys(pr.diamonds.chart || {}).length === 91, `tabela dijamanata sačuvana: ${Object.keys(pr.diamonds?.chart || {}).length} redova`);
ok(pr.diamonds?.chart?.m10?.ct === 0.005 && pr.diamonds?.chart?.m26?.ct === 0.07, 'karat na 4 decimale (1.0 mm = 0.005 ct)');
ok(JSON.stringify(pr.diamonds.chart) === JSON.stringify(DISTRICT_DIAMOND_CHART), 'svih 91 red identičan Excelu');
ok(pr.watch?.moissanite?.full === 2500 && pr.watch.moissanite.all === 2500 && pr.watch.moissanite.face === 800, 'cjenovnik sata sačuvan');
ok(pr.diamondRules?.vvs === 20 && pr.diamondRules?.paveMin === 75, 'pravila sačuvana');
ok(Object.keys(pr.settingExtra || {}).length === 8, 'ostali rad ugradnje sačuvan (8)');

// Isključena tabela i čudni ključevi
const off = await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: C, body: JSON.stringify({ pricing: { ...pr, diamonds: { on: false, chart: { ...pr.diamonds.chart, bad: { natural: 1 }, m999x: { lab: 2 } } } } }) }).then(j);
ok(off.body.pricing?.diamonds?.on === false && !off.body.pricing.diamonds.chart.bad && Object.keys(off.body.pricing.diamonds.chart).length === 91, 'prekidač isključen se čuva, nepoznati ključevi odbijeni');
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: C, body: JSON.stringify({ pricing: pr }) });

const me = await fetch(`${BASE}/api/portal/me`, { headers: C }).then(j);
ok(me.body.pricing?.diamonds?.on === true && me.body.pricing?.watch?.moissanite?.half === 1400, '/me vraća tabelu i sat');
console.log(fails ? `${fails} FAILED` : 'Pricing tab checks passed.');
console.log(`PORTAL=${link}`);
process.exit(fails ? 1 : 0);
