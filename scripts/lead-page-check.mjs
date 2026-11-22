// Stranica kupca /p/<key> i automatska prva poruka (19.11.2026).
//   BASE=http://127.0.0.1:8796 node scripts/lead-page-check.mjs   (server sa lažnim OpenAI-jem; token iz .dev.vars)
import { readFileSync } from 'node:fs';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setup(name, pricing) {
  const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name }) }).then(j)).body.client;
  const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
  const token = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
  const P = { 'x-portal-token': token, 'content-type': 'application/json' };
  if (pricing) await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: P, body: JSON.stringify({ pricing }) });
  const lead = async (nm, answers) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ formId: form.id, name: nm, email: 'page@example.com', phone: '555 010 0011', consent: 'yes' })) fd.set(k, v);
    fd.set('answers', JSON.stringify(answers));
    return (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
  };
  const list = async () => (await fetch(`${BASE}/api/portal/leads`, { headers: P }).then(j)).body.leads;
  return { client, form, P, lead, list };
}
const GRILLZ = { type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' };

const A = await setup('Page Check Jewelers', { ...SUGGESTED_PRICING, quoteInfo: 'Page Check Jewelers\n1 Main St' });
const l1 = await A.lead('Myla <script>alert(1)</script>', GRILLZ);
let row;
for (let i = 0; i < 20 && !row?.quotes?.picked; i++) { await sleep(500); row = (await A.list()).find((x) => x.id === l1.leadId); }
ok(row?.quotes?.picked?.msg, `prva poruka napisana sama sa upitom (${row?.quotes?.picked?.source})`);
ok(row?.page?.url && /^\/p\/[a-z0-9]{24}$/.test(row.page.url), `upit ima link stranice (${row?.page?.url})`);
ok(row?.quotes?.picked?.msg.includes(`/p/${row.page.url.slice(3)}`) && row.quotes.picked.msg.endsWith('1 Main St'), 'poruka nosi link stranice, pa store info');
ok(/\$7,900/.test(row?.quotes?.picked?.msg || ''), 'prva poruka ima cijenu iz cjenovnika ($7,900)');

const page = await fetch(`${BASE}${row.page.url}`);
const html = await page.text();
ok(page.status === 200 && /noindex/.test(page.headers.get('x-robots-tag') || ''), 'stranica se otvara, noindex');
ok(/content-security-policy/i.test([...page.headers.keys()].join(' ')) && /frame-ancestors 'none'/.test(page.headers.get('content-security-policy')), 'stranica ima CSP i ne ugrađuje se');
ok(!html.includes('<script>alert(1)</script>') && html.includes('Myla'), 'ime kupca je bezbjedno ispisano');
ok(html.includes('$7,900') && html.includes('Your design') && !html.includes('Option 2'), 'jedna ponuda dok zlatar ne napravi Fits the budget');
ok(html.includes('data-action="deposit"') && html.includes('data-action="appointment"'), 'dugmad Deposit i Book appointment');
ok(html.includes('Styles and finishes we make') && html.includes('1 Main St'), 'stilovi radnje i store info');

// Zlatar napravi Fits the budget: stranica pokazuje dvije ponude sa uštedom.
const fitSpec = { ...GRILLZ, type: 'grillz', metal: 'Yellow Gold', karat: '14K', stones: 'Moissanite', coverage: 'full', teeth: GRILLZ.teeth, units: 12, cut: '', clarity: '', style: 'set' };
// 22.11.2026: Option 2 ide na stranicu tek uz "Show on sales page".
await fetch(`${BASE}/api/portal/leads/${l1.leadId}/quote`, { method: 'PUT', headers: A.P, body: JSON.stringify({ slot: 'fit', show: true }) });
const f = await fetch(`${BASE}/api/portal/leads/${l1.leadId}/quote`, { method: 'POST', headers: A.P, body: JSON.stringify({ piece: 'grillz', total: 2500, lines: [], slot: 'fit', spec: fitSpec, mode: 'fit', originalTotal: 7900, changes: [{ what: 'Stones', from: 'Lab-grown diamonds', to: 'Moissanite' }] }) }).then(j);
ok(f.status === 200 && /See both options side by side: http/.test(f.body.message), 'Fits the budget poruka nosi link "both options"');
const html2 = await (await fetch(`${BASE}${row.page.url}`)).text();
ok(html2.includes('Option 2') && html2.includes('$2,500') && /You save \$5,400/.test(html2) && html2.includes('Moissanite'), 'stranica: druga ponuda $2,500, ušteda $5,400, šta se mijenja');

// Posjete: kupac se broji, zlatarev pregled i roboti za preglede linkova ne.
await fetch(`${BASE}${row.page.url}?preview=1`);
await fetch(`${BASE}${row.page.url}`, { headers: { 'user-agent': 'facebookexternalhit/1.1' } });
await fetch(`${BASE}${row.page.url}`, { method: 'HEAD' });
await sleep(400);
row = (await A.list()).find((x) => x.id === l1.leadId);
ok(row.page.views === 2 && row.page.lastView > 0, `posjete kupca: 2 (pregled zlatara, robot i HEAD se ne broje), ima ${row.page.views}`);

// Dugmad: bez linka zabilježi zahtjev; sa https linkom vrati link; http link se ne prihvata.
const act = (b) => fetch(`${BASE}/api/page/${row.page.url.slice(3)}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(j);
const d1 = await act({ action: 'deposit', option: 'fit' });
ok(d1.status === 200 && d1.body.redirect === null, 'Deposit bez linka radnje: zahtjev zabilježen, bez preusmjeravanja');
ok((await act({ action: 'delete', option: 'fit' })).status === 400, 'nepoznata akcija = 400');
ok((await fetch(`${BASE}/api/page/nemaga1234567890ab/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"deposit"}' })).status === 404, 'nepostojeća stranica = 404');
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: A.P, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, depositUrl: 'https://pay.example.com/deposit', bookingUrl: 'http://insecure.example.com/book' } }) });
const d2 = await act({ action: 'deposit', option: 'picked' });
const d3 = await act({ action: 'appointment', option: '' });
ok(d2.body.redirect === 'https://pay.example.com/deposit', 'Deposit sa linkom radnje vodi na njega');
ok(d3.body.redirect === null, 'http link za booking se ne prihvata (samo https)');
row = (await A.list()).find((x) => x.id === l1.leadId);
ok(row.page.actions.length === 3 && row.page.actions[0].action === 'deposit' && row.page.actions[0].option === 'fit', 'portal vidi sva tri klika sa opcijom');

ok((await fetch(`${BASE}/p/nemaga1234567890abcdef12`)).status === 404, 'pogrešan link stranice = 404');

// Zlatar bez cijena: nema automatske poruke, stranica kaže da se cijena priprema.
const B = await setup('Page Check No Prices', null);
const l2 = await B.lead('Jordan Free', GRILLZ);
await sleep(2500);
const r2 = (await B.list()).find((x) => x.id === l2.leadId);
ok(!r2.quotes?.picked, 'bez cjenovnika nema automatske poruke');
const html3 = await (await fetch(`${BASE}${r2.page.url}`)).text();
ok(html3.includes('Your price is being prepared') && html3.includes('data-action="deposit"'), 'stranica bez cijena: "price is being prepared" i dugmad');
if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Lead page checks passed.');
