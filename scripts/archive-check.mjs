// Arhiviranje leada (24.11.2026): nestaje iz liste, brojeva, statistike, obavještenja i Bookings; vraća se iz Archived.
//   BASE=http://127.0.0.1:8811 node scripts/archive-check.mjs   (server sa lažnim OpenAI-jem; token iz .dev.vars)
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

const client = (await fetch(`${BASE}/api/admin/clients`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Archive Check Jewelers' }) }).then(j)).body.client;
const form = (await fetch(`${BASE}/api/admin/forms`, { method: 'POST', headers: H, body: JSON.stringify({ clientId: client.id, template: 'custom-enquiry' }) }).then(j)).body.form;
const viewAs = (await fetch(`${BASE}/api/admin/clients/${client.id}/view-as`, { method: 'POST', headers: H }).then(j)).body.token;
const V = { 'x-portal-token': viewAs, 'content-type': 'application/json' };
const link = (await fetch(`${BASE}/api/admin/clients/${client.id}/portal-link`, { method: 'POST', headers: H, body: '{}' }).then(j)).body.url;
const C = { 'x-portal-token': link.match(/k=([a-z0-9]+)/)[1], 'content-type': 'application/json' };
const lead = async (name) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: form.id, name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone: '+1 (303) 555-0101', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }));
  return (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd }).then(j)).body;
};
const a = await lead('Ana Keep');
const b = await lead('Bo Archive');
const get = (q = '') => fetch(`${BASE}/api/portal/leads${q}`, { headers: C }).then(j).then((r) => r.body);
const patch = (id, body, h = C) => fetch(`${BASE}/api/portal/leads/${id}`, { method: 'PATCH', headers: h, body: JSON.stringify(body) }).then(j);
await patch(b.leadId, { tags: ['VIP'] });

let l = await get();
ok(l.leads.length === 2 && l.archived === 0 && l.leads.every((x) => x.archivedAt === null), 'dva aktivna leada, 0 arhiviranih');
ok((await patch(b.leadId, { archived: true }, V)).status === 403, 'admin pregled ne arhivira');
const r = await patch(b.leadId, { archived: true });
ok(r.status === 200 && r.body.archivedAt > 0, 'zlatar arhivira lead');
l = await get();
ok(l.leads.length === 1 && l.leads[0].id === a.leadId && l.archived === 1, 'arhivirani nije u listi, brojač Archived = 1');
ok(Object.values(l.counts).reduce((x, y) => x + y, 0) === 1 && l.pieces.grillz === 1 && !l.tags.VIP, 'brojevi po statusu, komadu i tagu bez arhiviranog');
ok(Object.values(l.days).reduce((n, d) => n + Object.values(d).reduce((x, y) => x + y, 0), 0) === 1, 'traka po danima bez arhiviranog');
const arch = await get('?archived=1');
ok(arch.leads.length === 1 && arch.leads[0].id === b.leadId && arch.leads[0].archivedAt > 0, 'filter Archived pokazuje samo arhivirane');
const me = (await fetch(`${BASE}/api/portal/me`, { headers: C }).then(j)).body;
ok(me.stats.leads === 1 && me.forms[0].leads === 1, `brojevi na vrhu i po formi bez arhiviranog (${me.stats.leads}, ${me.forms[0].leads})`);
const st = (await fetch(`${BASE}/api/portal/stats`, { headers: C }).then(j)).body;
ok(st.leads.length === 1 && st.leads[0].id === a.leadId, 'Stats bez arhiviranog');
const nt = (await fetch(`${BASE}/api/portal/notifications`, { headers: C }).then(j)).body;
ok(!nt.items.some((x) => x.lead === b.leadId) && nt.items.some((x) => x.lead === a.leadId), 'Notifications bez arhiviranog');
ok((await get('?q=bo')).leads.length === 0, 'pretraga ne nalazi arhiviranog u običnoj listi');
// vraćanje
ok((await patch(b.leadId, { archived: false })).body.archivedAt === null, 'zlatar vraća lead');
await patch(b.leadId, { archived: true });
const back = await patch(b.leadId, { archived: false, status: 'quoted' });
l = await get();
ok(back.status === 200 && l.leads.find((q) => q.id === b.leadId)?.status === 'quoted' && l.archived === 0 && l.counts.quoted === 1, 'vraćanje pravo u izabrani status (Quoted)');
l = await get();
ok(l.leads.length === 2 && l.archived === 0 && l.tags.VIP === 1, 'vraćeni lead je opet u listi sa svojim tagom');
ok(JSON.stringify((await patch(a.leadId, { note: 'x' })).body) === '{"ok":true}', 'bilješka i dalje radi (arhiviranje se ne dira bez polja archived)');

console.log(fails ? `${fails} FAILED` : 'Archive checks passed.');
console.log(`PORTAL=${link}`);
process.exit(fails ? 1 : 0);
