// Tok ponude na stranici kupca (27.11.2026): faze odbrojavanja, zamućena opcija u budžetu, zaključavanje i osvježena ponuda.
//   BASE=http://127.0.0.1:8873 node scripts/offer-stages-check.mjs   (DEV_MODE, token iz .dev.vars; ispiše PAGE= link)
import { readFileSync } from 'node:fs';
import { SUGGESTED_PRICING } from '../public/pricing.js';
import { offerStage, offerTimeline, metalMoved, OFFER_DEFAULTS } from '../src/offer.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8873';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const HR = 3600_000;

// 1) Čista logika faza
ok(offerStage(30 * HR, 48) === 'fresh' && offerStage(23 * HR, 48) === 'yellow' && offerStage(11 * HR, 48) === 'red' && offerStage(0.5 * HR, 48) === 'last' && offerStage(-1, 48) === 'expired', '48 h: zlatno, žuto ispod 24 h, crveno ispod 12 h, zadnji sat, isteklo');
ok(offerStage(13 * HR, 24) === 'fresh' && offerStage(11 * HR, 24) === 'yellow' && offerStage(5 * HR, 24) === 'red', 'osvježena ponuda 24 h: žuto ispod 12 h, crveno ispod 6 h');
ok(!metalMoved(100, 102.5, OFFER_DEFAULTS) && metalMoved(100, 103.5, OFFER_DEFAULTS), 'zlato do 3% = osvježava se samo, preko 3% = zlatar šalje novu cijenu');
const t0 = Date.UTC(2026, 10, 27);
const tlr = offerTimeline({ pricing: {}, quotes: { picked: { at: t0 }, refresh: { at: t0 + 50 * HR, status: 'pending' } }, lead: {} }, t0 + 55 * HR);
ok(tlr.stage === 'requested' && tlr.refresh.unlockAt === t0 + 62 * HR, 'zahtjev: čeka otključavanje 12 h poslije zahtjeva');
const q2 = { picked: { at: t0 }, refresh: { at: t0 + 50 * HR, status: 'ready', readyAt: t0 + 62 * HR } };
const tlok = offerTimeline({ pricing: {}, quotes: q2, lead: {} }, t0 + 70 * HR);
ok(tlok.stage === 'fresh' && tlok.hours === 24 && tlok.deadline === t0 + 86 * HR, 'osvježena ponuda važi 24 h od otključavanja');
ok(offerTimeline({ pricing: {}, quotes: q2, lead: {} }, t0 + 81 * HR).stage === 'red' && offerTimeline({ pricing: {}, quotes: q2, lead: {} }, t0 + 87 * HR).stage === 'expired', 'osvježena: 5 h prije kraja crveno, poslije kraja opet zaključano');
const tlnew = offerTimeline({ pricing: {}, quotes: { picked: { at: t0 + 60 * HR }, refresh: { at: t0 + 50 * HR, status: 'pending' } }, lead: {} }, t0 + 61 * HR);
ok(tlnew.stage === 'fresh' && tlnew.hours === 48, 'nova poruka zlatara poništava stari zahtjev (nova ponuda 48 h)');

// 2) Stranica: probna radnja, grillz $7,900 uz budžet do $2,500 (daleko iznad budžeta)
const tag = Date.now().toString(36).slice(-4);
const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: `Offer Stages Jewelers ${tag}` }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const view = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const P = { 'x-portal-token': view, 'content-type': 'application/json' };
await fetch(`${BASE}/api/portal/pricing`, { method: 'PUT', headers: P, body: JSON.stringify({ pricing: { ...SUGGESTED_PRICING, quoteInfo: 'Offer Stages Jewelers\n1 Main St, Denver CO' } }) });
const fd = new FormData();
for (const [k, v] of Object.entries({ formId: form.id, name: 'Jordan Reyes', email: 'jordan@example.com', phone: '555 010 0012', consent: 'yes' })) fd.set(k, v);
fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }));
const lead = (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
let row;
for (let i = 0; i < 20 && !row?.page?.url; i++) { await new Promise((r) => setTimeout(r, 400)); row = (await fetch(`${BASE}/api/portal/leads`, { headers: P }).then(j)).body.leads?.find((x) => x.id === lead.leadId); }
const url = `${BASE}${row.page.url}`;
const page = async (q) => (await fetch(`${url}?preview=1&${q}`)).text();
let h = await page('sim_elapsed=1');
ok(h.includes('We might have something cooking for you') && h.includes('data-reveal="1"') && !h.includes('Unlocked for you'), '1 h: zamućena opcija u budžetu sa odbrojavanjem do otkrivanja');
ok(h.includes('v-fresh') && h.includes('Reserved for you for 48 hours'), '1 h: zlatno "Reserved for you for 48 hours"');
h = await page('sim_elapsed=9');
ok(h.includes('Unlocked for you') && h.includes('Option 2') && !h.includes('something cooking'), '9 h: opcija u budžetu otkrivena');
ok((await page('sim_elapsed=25')).includes('v-yellow'), '25 h: žuto (manje od 24 h)');
ok((await page('sim_elapsed=37')).includes('v-red'), '37 h: crveno (manje od 12 h)');
ok((await page('sim_elapsed=47.5')).includes('v-last'), '47,5 h: zadnji sat');
h = await page('sim_elapsed=49');
ok(h.includes('Your offer has expired') && h.includes('data-refresh="1"') && h.includes('offers locked') && !h.includes('class="validity'), 'isteklo: ponude zaključane, dugme za osvježenu ponudu');
h = await page('sim_elapsed=50&sim_refresh=pending');
ok(h.includes('Your new price is on its way') && h.includes('data-unlock="1"'), 'zahtjev poslat: odbrojavanje do otključavanja');
h = await page('sim_elapsed=64&sim_refresh=ready&sim_discount=5');
ok(h.includes('Refreshed price') && h.includes('5% off') && h.includes('data-refreshed="1"'), 'osvježena ponuda sa 5% popusta i novim odbrojavanjem');
h = await page('sim_elapsed=63&sim_refresh=moved');
ok(h.includes('Metal prices moved') && h.includes('We are updating your price'), 'metal se pomjerio: radnja šalje novu cijenu');
// Simulacija ne radi bez DEV_MODE-a (provjerava se kodom: pageData čita sim_* samo uz DEV_MODE=1)

// 3) Pravi zahtjev za osvježenu ponudu: dok je ponuda aktivna = 409
const key = row.page.url.slice(3);
const early = await fetch(`${BASE}/api/page/${key}/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
ok(early.status === 409, `zahtjev dok ponuda važi je odbijen (${early.status})`);
console.log(fails ? `${fails} FAILED` : 'Offer stage checks passed.');
console.log(`PAGE=${url}`);
process.exit(fails ? 1 : 0);
