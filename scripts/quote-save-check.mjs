// Quote poruka ostaje uz lead (19.11.2026): generisana se sačuva, izmjena zlatara zamijeni tekst, lista je vraća.
//   BASE=http://127.0.0.1:8796 node scripts/quote-save-check.mjs   (server mora raditi; token iz .dev.vars)
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

async function setup(name) {
  const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name }) }).then(j)).body.client;
  const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form.id, name: 'Jordan Save', email: 'save@example.com', phone: '555 010 0011', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '10K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'none', budget: '$1,500 - $2,500' }));
  await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd });
  const token = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
  const P = { 'x-portal-token': token, 'content-type': 'application/json' };
  const list = async () => (await fetch(`${BASE}/api/portal/leads`, { headers: P }).then(j)).body.leads[0];
  return { P, list, id: (await list()).id };
}
const A = await setup('Save Check A');
const B = await setup('Save Check B');
const url = (id) => `${BASE}/api/portal/leads/${id}/quote`;
const spec = { type: 'grillz', metal: 'Yellow Gold', karat: '10K', stones: '', coverage: '', cut: '', units: 12, teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', clarity: '', style: 'set' };
const body = { piece: 'grillz', metal: 'Yellow Gold', karat: '10K', teeth: { top: 6, bottom: 6 }, total: 1500, lines: [{ label: 'Molding fee', amount: 100 }] };

ok((await A.list()).quotes && !Object.keys((await A.list()).quotes).length, 'novi lead nema sačuvanih poruka');
ok((await fetch(url(A.id), { method: 'PUT', headers: A.P, body: JSON.stringify({ slot: 'picked', message: 'x' }) })).status === 404, 'izmjena prije generisanja = 404');

const g = await fetch(url(A.id), { method: 'POST', headers: A.P, body: JSON.stringify({ ...body, slot: 'picked', spec }) }).then(j);
ok(g.status === 200 && g.body.saved?.msg === g.body.message, `generisana poruka sačuvana (${g.body.source})`);
let l = await A.list();
ok(l.quotes.picked?.msg === g.body.message && l.quotes.picked.edited === false, 'lista vraća sačuvanu poruku (poslije osvježavanja)');
ok(l.quotes.picked.spec?.teeth === spec.teeth && l.quotes.picked.spec.units === 12, 'sačuvani su i izbori za koje je pisana');

const edited = `${g.body.message}\n\nPS: we can start this week.`;
const e = await fetch(url(A.id), { method: 'PUT', headers: A.P, body: JSON.stringify({ slot: 'picked', message: edited }) }).then(j);
ok(e.status === 200 && e.body.at > 0, 'izmjena sačuvana');
l = await A.list();
ok(l.quotes.picked.msg === edited && l.quotes.picked.edited === true && l.quotes.picked.source === g.body.source, 'lista vraća najnoviju verziju, označenu kao izmijenjenu');
const e2 = await fetch(url(A.id), { method: 'PUT', headers: A.P, body: JSON.stringify({ slot: 'picked', message: 'Kratko.' }) }).then(j);
l = await A.list();
ok(e2.status === 200 && l.quotes.picked.msg === 'Kratko.', 'svaka nova izmjena zamijeni prethodnu');
ok(!l.quotes.fit, 'Fits the budget poruka je odvojena (još ne postoji)');

const f = await fetch(url(A.id), { method: 'POST', headers: A.P, body: JSON.stringify({ ...body, total: 900, slot: 'fit', spec: { ...spec, metal: 'Silver', karat: '' }, mode: 'fit', originalTotal: 1500, changes: [{ what: 'Metal', from: 'Yellow Gold', to: 'Silver' }] }) }).then(j);
l = await A.list();
ok(f.status === 200 && l.quotes.fit?.msg === f.body.message && l.quotes.fit.spec.metal === 'Silver', 'Fits the budget poruka i njeni izbori sačuvani');
ok(l.quotes.picked.msg === 'Kratko.', 'Estimated price poruka ostaje netaknuta');
const regen = await fetch(url(A.id), { method: 'POST', headers: A.P, body: JSON.stringify({ ...body, slot: 'picked', spec }) }).then(j);
l = await A.list();
ok(l.quotes.picked.msg === regen.body.message && l.quotes.picked.edited === false, 'Generate again zamijeni izmijenjenu poruku novom');

ok((await fetch(url(A.id), { method: 'PUT', headers: B.P, body: JSON.stringify({ slot: 'picked', message: 'hack' }) })).status === 404, 'drugi klijent ne može mijenjati tuđu poruku');
ok((await fetch(url(A.id), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slot: 'picked', message: 'hack' }) })).status === 401, 'bez portal sesije = 401');
ok((await fetch(url(A.id), { method: 'PUT', headers: A.P, body: JSON.stringify({ slot: 'other', message: 'x' }) })).status === 400, 'nepoznat okvir = 400');
ok((await fetch(url(A.id), { method: 'PUT', headers: A.P, body: JSON.stringify({ slot: "picked', '$.x', 'y", message: 'x' }) })).status === 400, 'okvir se ne može ubaciti u JSON putanju');
ok((await A.list()).quotes.picked.msg === regen.body.message, 'neuspjeli pokušaji ništa nisu promijenili');
ok(!(await B.list()).quotes.picked, 'poruka klijenta A se ne vidi kod klijenta B');
if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Quote save checks passed.');
