// GoHighLevel priprema (24.11.2026): pozivi prema LeadConnector API-ju sa lažnim fetch-om (bez mreže i bez pravog GHL-a).
//   node scripts/ghl-check.mjs
import { ghlPushLead, ghlPushStatus, ghlPushTags, ghlPipelines, guessStages, ghlNoteText, sealGhlToken, openGhlToken, ghlPublic, validLocationId, GHL_BASE, GHL_VERSION } from '../src/ghl.js';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const calls = [];
const fake = (responses = {}) => async (url, init) => {
  const path = url.replace(GHL_BASE, '');
  calls.push({ path, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
  const key = `${init.method} ${path.split('?')[0]}`;
  const r = Object.entries(responses).find(([k]) => key.startsWith(k))?.[1] ?? {};
  if (r.status) return new Response(JSON.stringify(r.body || {}), { status: r.status });
  return new Response(JSON.stringify(r), { status: 200 });
};

const cfg = { locationId: 'LOC1234567890', pipelineId: 'pipe1', stages: { new: 's-new', quoted: 's-quoted', won: 's-won', lost: 's-lost' }, tags: ['jewelrylead'], pieceTag: true, note: true };
const lead = { name: 'Ava Marie Stone', email: 'ava@example.com', phone: '+1 (480) 465-7783', piece: 'grillz', form: 'District Custom', details: [{ label: 'Metal', value: 'Yellow Gold' }], vision: 'six on top', area: 'Phoenix East Valley, AZ', pageUrl: 'https://jewelrylead.com/p/abc?preview=1', price: 2499.6, quoteMsg: 'Hi Ava', tags: ['Friend'] };

const done = await ghlPushLead('pit-token', cfg, lead, {}, fake({ 'POST /contacts/upsert': { contact: { id: 'c1' }, new: true }, 'POST /opportunities/': { opportunity: { id: 'o1' } } }));
ok(done.contactId === 'c1' && done.oppId === 'o1' && done.tagged && done.noted, 'kontakt, tagovi, bilješka i opportunity');
ok(calls.map((c) => `${c.method} ${c.path}`).join(' | ') === 'POST /contacts/upsert | POST /contacts/c1/tags | POST /contacts/c1/notes | POST /opportunities/', `redoslijed poziva (${calls.map((c) => c.path).join(', ')})`);
ok(calls.every((c) => c.headers.Authorization === 'Bearer pit-token' && c.headers.Version === GHL_VERSION), 'token i Version zaglavlje na svakom pozivu');
const up = calls[0].body;
ok(up.firstName === 'Ava' && up.lastName === 'Marie Stone' && up.locationId === cfg.locationId && !('tags' in up), 'upsert: ime razdvojeno, bez tags (ne briše postojeće)');
ok(JSON.stringify(calls[1].body.tags) === JSON.stringify(['jewelrylead', 'jewelrylead grillz', 'friend']), `tagovi (${JSON.stringify(calls[1].body.tags)})`);
ok(/Metal: Yellow Gold/.test(calls[2].body.body) && /Phoenix East Valley/.test(calls[2].body.body) && /\$2,500/.test(calls[2].body.body), 'bilješka ima izbore, grad po broju i cijenu');
const opp = calls[3].body;
ok(opp.pipelineStageId === 's-new' && opp.monetaryValue === 2500 && opp.contactId === 'c1' && opp.status === 'open', 'opportunity u fazi New sa vrijednošću');

// Ponovni pokušaj poslije greške ne pravi duplikat kontakta.
calls.length = 0;
let err = null;
const half = await ghlPushLead('pit-token', cfg, lead, {}, fake({ 'POST /contacts/upsert': { contact: { id: 'c2' } }, 'POST /contacts/c2/notes': { status: 422, body: { message: ['body too long'] } } })).catch((e) => { err = e; return null; });
ok(!half && /GHL 422: body too long/.test(err?.message), 'greška GHL-a se vraća čitljivo');
calls.length = 0;
const again = await ghlPushLead('pit-token', cfg, lead, { contactId: 'c2', tagged: true }, fake({ 'POST /opportunities/': { opportunity: { id: 'o2' } } }));
ok(again.oppId === 'o2' && !calls.some((c) => c.path === '/contacts/upsert' || c.path.endsWith('/tags')), 'nastavak od mjesta gdje je stalo');

// Postojeći lead (slanje unazad) ulazi u fazu svog statusa; Won je odmah zatvoren.
calls.length = 0;
await ghlPushLead('pit-token', cfg, { ...lead, status: 'quoted' }, {}, fake({ 'POST /contacts/upsert': { contact: { id: 'c9' } }, 'POST /opportunities/': { opportunity: { id: 'o9' } } }));
ok(calls.at(-1).body.pipelineStageId === 's-quoted' && calls.at(-1).body.status === 'open', 'postojeći Quoted lead ide u fazu Quoted');
calls.length = 0;
await ghlPushLead('pit-token', cfg, { ...lead, status: 'won' }, {}, fake({ 'POST /contacts/upsert': { contact: { id: 'c8' } }, 'POST /opportunities/': { opportunity: { id: 'o8' } } }));
ok(calls.at(-1).body.pipelineStageId === 's-won' && calls.at(-1).body.status === 'won', 'postojeći Won lead je zatvoren kao won');
calls.length = 0;
await ghlPushLead('pit-token', cfg, { ...lead, status: 'contacted' }, {}, fake({ 'POST /contacts/upsert': { contact: { id: 'c7' } }, 'POST /opportunities/': { opportunity: { id: 'o7' } } }));
ok(calls.at(-1).body.pipelineStageId === 's-new', 'status bez mapirane faze ide u fazu New');

// Bez pipeline-a: samo kontakt.
calls.length = 0;
await ghlPushLead('pit-token', { ...cfg, pipelineId: '' }, lead, {}, fake({ 'POST /contacts/upsert': { contact: { id: 'c3' } } }));
ok(!calls.some((c) => c.path.startsWith('/opportunities')), 'bez pipeline-a nema opportunity-ja');

// Status i tagovi.
calls.length = 0;
await ghlPushStatus('pit-token', cfg, { oppId: 'o1' }, 'won', 3100, fake());
ok(calls[0].method === 'PUT' && calls[0].path === '/opportunities/o1' && calls[0].body.status === 'won' && calls[0].body.pipelineStageId === 's-won' && calls[0].body.monetaryValue === 3100, 'Won zatvara opportunity');
calls.length = 0;
await ghlPushStatus('pit-token', cfg, { oppId: 'o1' }, 'contacted', 0, fake());
ok(calls[0].body.status === 'open' && !calls[0].body.pipelineStageId, 'faza bez mapiranja ostaje, status open');
ok((await ghlPushStatus('pit-token', cfg, {}, 'won', 0, fake())) === false, 'bez opportunity-ja nema poziva');
calls.length = 0;
await ghlPushTags('pit-token', { contactId: 'c1' }, ['VIP', 'Returning customer'], fake());
ok(JSON.stringify(calls[0].body.tags) === '["vip","returning customer"]', 'novi tagovi na kontakt');

// Pipeline-i i prijedlog faza.
const pipes = await ghlPipelines('pit-token', cfg.locationId, fake({ 'GET /opportunities/pipelines': { pipelines: [{ id: 'p1', name: 'Sales', stages: [{ id: 'a', name: 'New Lead' }, { id: 'b', name: 'Contacted' }, { id: 'c', name: 'Proposal Sent' }, { id: 'd', name: 'Closed Won' }, { id: 'e', name: 'Closed Lost' }] }] } }));
ok(JSON.stringify(guessStages(pipes[0])) === JSON.stringify({ new: 'a', contacted: 'b', quoted: 'c', won: 'd', lost: 'e' }), 'faze pogođene po imenu');

// Token šifrovan, portal ga nikad ne dobija.
const env = { DEV_MODE: '1', ADMIN_TOKEN: 'local-admin' };
const sealed = await sealGhlToken(env, 'district', 'pit-abcdefghijklmnopqrstuv');
ok(sealed.startsWith('v1.') && !sealed.includes('pit-') && (await openGhlToken(env, 'district', sealed)) === 'pit-abcdefghijklmnopqrstuv', 'token šifrovan i otvara se');
ok(await openGhlToken(env, 'other-client', sealed).then(() => false, () => true), 'token drugog klijenta se ne otvara');
ok(!('token' in ghlPublic({ token: sealed, locationId: 'LOC1234567890', enabled: true })) && ghlPublic({ token: sealed, locationId: 'LOC1234567890' }).connected, 'portal vidi samo stanje, ne token');
ok(validLocationId('LOC1234567890') && !validLocationId('bad id'), 'Location ID provjera');
ok(ghlNoteText({ name: 'x', piece: 'ring' }).startsWith('JewelryLead: new custom ring request'), 'bilješka bez praznih redova');

console.log(fails ? `${fails} FAILED` : 'GoHighLevel checks passed.');
process.exit(fails ? 1 : 0);
