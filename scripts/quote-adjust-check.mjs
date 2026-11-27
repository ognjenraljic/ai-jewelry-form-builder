// Podešene ponude (22.11.2026): zlatar u Estimated price i Fits the budget mijenja izbore i konačnu cijenu (slider),
// to se čuva uz lead i stranica kupca pokazuje baš to; poruka i dalje radi uz podešen slot.
//   BASE=http://127.0.0.1:8796 node scripts/quote-adjust-check.mjs   (server sa lažnim OpenAI-jem; token iz .dev.vars)
import { readFileSync } from 'node:fs';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Adjust Check Jewelers' }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const token = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const P = { 'x-portal-token': token, 'content-type': 'application/json' };
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: P, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, quoteInfo: 'Adjust Check\n2 Main St' } }) });
const lead = async (answers) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form.id, name: 'Kaden Adjust', email: 'adj@example.com', phone: '555 010 0099', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify(answers));
  return (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
};
const list = async () => (await fetch(`${BASE}/api/portal/leads`, { headers: P }).then(j)).body.leads;
const GRILLZ = { type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' };
const l1 = await lead(GRILLZ);
let row;
for (let i = 0; i < 20 && !row?.quotes?.picked?.msg; i++) { await sleep(500); row = (await list()).find((x) => x.id === l1.leadId); }
ok(/\$7,900/.test(row?.quotes?.picked?.msg || ''), 'prva poruka: $7,900 iz cjenovnika');
const url = `${BASE}${row.page.url}`;
if (process.env.SHOW_URL) console.log("PAGE", url);

// 1) Estimated price: zlatar spusti cijenu sliderom; stranica kupca pokazuje novu cijenu, poruka ostaje.
const put = (b) => fetch(`${BASE}/api/portal/leads/${l1.leadId}/quote`, { method: 'PUT', headers: P, body: JSON.stringify(b) }).then(j);
const r1 = await put({ slot: 'picked', spec: row.quotes.picked.spec || {}, price: 7400 });
ok(r1.status === 200 && r1.body.price === 7400, 'cijena Estimated price sačuvana ($7,400)');
row = (await list()).find((x) => x.id === l1.leadId);
ok(row.quotes.picked.price === 7400 && /\$7,900/.test(row.quotes.picked.msg), 'portal dobija cijenu, poruka ostaje dok se ne zamijeni');
let html = await (await fetch(url)).text();
ok(html.includes('$7,400') && !html.includes('$7,900'), 'stranica kupca: Option 1 = $7,400');

// 2) Fits the budget samo podešen (bez poruke): moissanite + svoja cijena; stranica pokazuje drugu ponudu.
const fitSpec = { type: 'grillz', metal: 'Yellow Gold', karat: '14K', stones: 'Moissanite', coverage: 'full', teeth: GRILLZ.teeth, units: 12, cut: '', clarity: '', style: 'set' };
const r2 = await put({ slot: 'fit', spec: fitSpec, price: 2400 });
ok(r2.status === 200, 'Fits the budget podešen bez poruke');
row = (await list()).find((x) => x.id === l1.leadId);
ok(row.quotes.fit && row.quotes.fit.msg === null && row.quotes.fit.price === 2400 && row.quotes.fit.spec.stones === 'Moissanite', 'portal vraća podešen slot bez poruke');
html = await (await fetch(url)).text();
// Prava kartica Option 2 (ne zamućena najava daleko iznad budžeta, 27.11.2026) se ne vidi dok zlatar ne uključi prikaz.
ok(!/class="offer fit(?! teaser)[^"]*"/.test(html), 'Fits the budget je skriven sa stranice dok se ne uključi "Show on sales page"');
const s1 = await put({ slot: 'fit', show: true });
row = (await list()).find((x) => x.id === l1.leadId);
ok(s1.status === 200 && row.quotes.fit.show === true, '"Show on sales page" sačuvan');
html = await (await fetch(url)).text();
ok(html.includes('Option 2') && html.includes('$2,400') && /You save \$5,000/.test(html), 'stranica: Option 2 $2,400, ušteda od $7,400 = $5,000');
ok(/class="validity v-fresh"/.test(html) && /<small>Hours<\/small>/.test(html) && /<small>Minutes<\/small>/.test(html) && /<small>Seconds<\/small>/.test(html) && /class="v-bar"/.test(html), 'odbrojavanje: pločice Hours/Minutes/Seconds, traka i faza fresh');
ok(/data-deadline="\d+"/.test(html) && /Reserved for you for 48 hours/.test(html), 'stranica ima rok ponude od 48 h sa odbrojavanjem');

// 3) Izmjena teksta poruke traži da poruka postoji; generisana poruka čuva cijenu i izbore.
ok((await put({ slot: 'fit', message: 'Hi' })).status === 404, 'tekst bez generisane poruke se ne čuva');
const g = await fetch(`${BASE}/api/portal/leads/${l1.leadId}/quote`, { method: 'POST', headers: P, body: JSON.stringify({ piece: 'grillz', total: 2400, price: 2400, lines: [], slot: 'fit', spec: fitSpec, mode: 'fit', originalTotal: 7400, changes: [{ what: 'Stones', from: 'Lab-grown diamonds', to: 'Moissanite' }] }) }).then(j);
ok(g.status === 200 && /\$2,400/.test(g.body.message) && g.body.saved.price === 2400, 'generisana poruka: $2,400, cijena sačuvana uz nju');
const e1 = await put({ slot: 'fit', message: g.body.message.replace('$2,400', '$2,350') });
ok(e1.status === 200, 'izmjena teksta radi uz podešen slot');
const r3 = await put({ slot: 'fit', spec: fitSpec, price: 2350 });
row = (await list()).find((x) => x.id === l1.leadId);
ok(r3.status === 200 && row.quotes.fit.price === 2350 && /\$2,350/.test(row.quotes.fit.msg) && row.quotes.fit.edited, 'nova cijena i izmijenjena poruka ostaju zajedno');

// 4) "Use calculated": cijena null = opet iz cjenovnika.
await put({ slot: 'picked', spec: row.quotes.picked.spec || {}, price: null });
row = (await list()).find((x) => x.id === l1.leadId);
html = await (await fetch(url)).text();
ok(row.quotes.picked.price === null && html.includes('$7,900'), 'bez ručne cijene stranica opet računa iz cjenovnika ($7,900)');

// 5) Loši unosi i tuđi lead.
ok((await put({ slot: 'nope', price: 5 })).status === 400, 'nepoznat slot = 400');
const r4 = await put({ slot: 'picked', price: -50 });
row = (await list()).find((x) => x.id === l1.leadId);
ok(r4.status === 200 && row.quotes.picked.price === null, 'negativna cijena se ne čuva');
const other = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Adjust Other' }) }).then(j)).body.client;
const ot = (await fetch(`${BASE}/api/admin/clients/${other.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const foreign = await fetch(`${BASE}/api/portal/leads/${l1.leadId}/quote`, { method: 'PUT', headers: { 'x-portal-token': ot, 'content-type': 'application/json' }, body: JSON.stringify({ slot: 'picked', price: 1 }) });
ok(foreign.status === 404, 'tuđi lead = 404');

// 6) Ostali nakit: forma dobije korak sa dužinom i širinom lanca (kao forme iz onboardinga: chain_length, chain_width).
const fg = (await fetch(`${BASE}/api/admin/forms/${form.id}`, { headers: H }).then(j)).body;
const opt = (value, label) => ({ value, label });
fg.form.steps.splice(fg.form.steps.length - 2, 0, { id: 'd-chain', title: 'Chain details', fields: [
  { id: 'chain_length', type: 'chips', label: 'Length', showIf: { field: 'type', in: ['chain'] }, options: [opt('18', '18"'), opt('20', '20"')] },
  { id: 'chain_width', type: 'chips', label: 'Width', showIf: { field: 'type', in: ['chain'] }, options: [opt('8-mm', '8 mm'), opt('10-mm', '10 mm')] }] });
const fput = await fetch(`${BASE}/api/admin/forms/${form.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ form: fg.form, updated_at: fg.updated_at }) }).then(j);
ok(fput.status === 200, `forma dobila korak za lanac (${fput.status} ${fput.body.error || ''})`);
const l2 = await lead({ type: 'chain', style: 'cuban', metal: 'yellow-gold', karat: '14K', stones: 'lab', coverage: 'full', budget: '$5,000 - $10,000', chain_length: '20', chain_width: '10-mm' });
let r5;
for (let i = 0; i < 20 && !r5?.quotes?.picked?.msg; i++) { await sleep(500); r5 = (await list()).find((x) => x.id === l2.leadId); }
ok(r5?.answers?.d_length && r5?.answers?.d_width, `portal dobija veličinu lanca (${r5?.answers?.d_length}, ${r5?.answers?.d_width})`);
ok(/\$\d/.test(r5?.quotes?.picked?.msg || ''), 'lanac: prva poruka ima cijenu');

if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Quote adjust checks passed.');
