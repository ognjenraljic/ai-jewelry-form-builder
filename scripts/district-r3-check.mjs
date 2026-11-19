// District runda 3 (19.11.2026): filter po komadu u portalu, natpis kupca umjesto "Name" sa slike stila,
// Fits the budget poruka sa poređenjem (od-do, nova i stara cijena).
//   node scripts/mock-openai.mjs 8893 &   (lažni OpenAI, bez troška)
//   npx wrangler dev --port 8796 --var OPENAI_BASE:http://127.0.0.1:8893
//   BASE=http://127.0.0.1:8796 MOCK_LOG=mock-openai-log.json node scripts/district-r3-check.mjs
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const MOCK_LOG = process.env.MOCK_LOG || 'mock-openai-log.json';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'R3 Check Jewelers' }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const lead = async (name, answers) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form.id, name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone: '555 010 0011', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify(answers));
  return (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
};
const g1 = await lead('Myla Grill', { type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '10K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'none', budget: '$1,500 - $2,500' });
await lead('Ayo Grill', { type: 'grillz', style: 'top6', metal: 'white-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8', stones: 'none', budget: '$1,500 - $2,500' });
const p1 = await lead('Chance Craven', { type: 'pendant', style: 'script', metal: 'yellow-gold', karat: '14K', stones: 'none', budget: '$1,500 - $2,500', inscription: 'Layna' });
const p2 = await lead('Test Flow', { type: 'pendant', style: 'block', metal: 'white-gold', karat: '10K', stones: 'none', budget: '$1,500 - $2,500' });
ok(g1.leadId && p1.leadId && p2.leadId, 'četiri upita napravljena');

// --- Natpis: slika stila sa "Name" ne ide modelu kad kupac upiše svoj natpis; bez natpisa ide.
const render = async (l) => fetch(`${BASE}/api/leads/${l.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: l.token }) }).then(j);
const before = (() => { try { return JSON.parse(readFileSync(MOCK_LOG, 'utf8')).length; } catch { return 0; } })();
const r1 = await render(p1);
const r2 = await render(p2);
ok(r1.status === 200 && r2.status === 200, `oba rendera prošla (${r1.status}, ${r2.status})`);
const imgs = JSON.parse(readFileSync(MOCK_LOG, 'utf8')).slice(before).filter((x) => /images\/(edits|generations)/.test(x.path));
const imageCount = (e) => e.images ?? 0;
const promptOf = (e) => (e.parts || []).find((p) => p.name === 'prompt')?.value || e.prompt || '';
const e1 = imgs.find((e) => promptOf(e).includes('Layna'));
const e2 = imgs.find((e) => !promptOf(e).includes('Layna'));
ok(e1 && imageCount(e1) === 0, `Layna: bez slike stila sa "Name" (slika: ${e1 ? imageCount(e1) : '?'}, ${e1?.path})`);
ok(e1 && /must read "Layna"/.test(promptOf(e1)) && /never "Name"/.test(promptOf(e1)), 'Layna: prompt kaže da je "Name" samo zamjena');
ok(e2 && imageCount(e2) === 1, `bez natpisa: slika stila ide kao referenca (slika: ${e2 ? imageCount(e2) : '?'})`);
ok(e2 && /placeholder for the customer's own name/.test(promptOf(e2)), 'bez natpisa: "NAME" sa slike je samo zamjena');

// --- Filter po komadu
const token = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const P = { 'x-portal-token': token, 'content-type': 'application/json' };
const all = (await fetch(`${BASE}/api/portal/leads`, { headers: P }).then(j)).body;
ok(all.pieces?.grillz === 2 && all.pieces?.pendant === 2, `brojevi po komadu ${JSON.stringify(all.pieces)}`);
const pend = (await fetch(`${BASE}/api/portal/leads?piece=pendant`, { headers: P }).then(j)).body;
ok(pend.leads.length === 2 && pend.leads.every((l) => l.answers.type === 'pendant'), 'piece=pendant vraća samo privjeske');
ok(Object.values(pend.counts).reduce((a, b) => a + b, 0) === 2 && pend.pieces.grillz === 2, 'statusi prate komad, brojevi komada ostaju za sve');
const bad = await fetch(`${BASE}/api/portal/leads?piece=${encodeURIComponent("x' OR 1=1 --")}`, { headers: P }).then(j);
ok(bad.status === 200 && bad.body.leads.length === 4, 'neispravan komad se ignoriše (nema SQL ubacivanja)');

// --- Fits the budget poruka
const leadId = all.leads.find((l) => l.name === 'Myla Grill').id;
const q = (b) => fetch(`${BASE}/api/portal/leads/${leadId}/quote`, { method: 'POST', headers: P, body: JSON.stringify(b) }).then(j);
const fit = await q({
  piece: 'grillz', metal: 'Silver', karat: '', teeth: { top: 6, bottom: 6 }, total: 880, budget: '$500 - $1,000',
  lines: [{ label: 'Silver set 6 x 6', amount: 780 }, { label: 'Molding fee', amount: 100 }],
  changes: [{ what: 'Metal', from: 'Yellow Gold', to: 'Silver' }, { what: 'Karat', from: '10K', to: 'none' }, { what: 'Stones', from: 'Lab-grown diamonds', to: 'Moissanite' }],
  mode: 'fit', originalTotal: 2899,
});
const m = fit.body.message || '';
ok(fit.status === 200 && m.includes('$880') && m.includes('$2,899'), `fit poruka: nova $880 i stara $2,899 (${fit.body.source})`);
ok(/Yellow Gold to Silver/i.test(m) && /Lab-grown diamonds to Moissanite/i.test(m), 'fit poruka nabraja izmjene od-do');
ok(!/10K to none|Karat/i.test(m), 'karat koji nestaje uz prelaz u srebro se ne nabraja');
ok(/budget/i.test(m) && !/—/.test(m), 'fit poruka govori o budžetu, bez em dash');
const amounts = (m.match(/\$\d[\d,]*/g) || []).map((a) => a.replace(/,$/, ''));
ok(amounts.every((a) => a === '$880' || a === '$2,899'), `nema drugih iznosa (${amounts.join(' ')})`);
const over = await q({ piece: 'grillz', metal: 'Yellow Gold', karat: '10K', teeth: { top: 6, bottom: 6 }, total: 1625, budget: 'Under $1,500', lines: [], mode: 'fit', originalTotal: 7900, inBudget: false, changes: [{ what: 'Karat', from: '14K', to: '10K' }, { what: 'Stones', from: 'Lab-grown diamonds', to: 'Moissanite' }] });
ok(over.status === 200 && /closer to your budget/i.test(over.body.message) && !/to fit your budget/i.test(over.body.message), `predlog i dalje preko budžeta = "closer to your budget" (${over.body.source})`);
const plain = await q({ piece: 'grillz', metal: 'Silver', teeth: { top: 6, bottom: 6 }, total: 880, lines: [], mode: 'fit', originalTotal: 880, changes: [{ what: 'Metal', from: 'Yellow Gold', to: 'Silver' }] });
ok(plain.status === 200 && !/instead of/.test(plain.body.message) && !plain.body.message.includes('to Silver'), 'ista cijena kao izabrano = obična poruka');
const forged = await q({ piece: 'grillz', total: 880, lines: [], mode: 'fit', originalTotal: 'abc', changes: [{ what: 'Metal', from: 'Gold', to: 'Silver' }] });
ok(forged.status === 200 && !/instead of/.test(forged.body.message), 'neispravna stara cijena = obična poruka');
console.log(`\n${m}\n`);
if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('District r3 checks passed.');
