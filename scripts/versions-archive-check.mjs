// Lokalna provjera: istorija verzija, arhiva forme i klijenta, zahtjevi za demo "obrađeno".
// Pokretanje: ./dev.sh pa node scripts/versions-archive-check.mjs (BASE za drugi port).
import { readFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const TOKEN = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)[1].trim();
const H = { 'x-admin-token': TOKEN, 'content-type': 'application/json' };
const call = async (method, p, body, headers = H) => {
  const r = await fetch(`${BASE}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) fail++; };

// Klijent i forma samo za ovu provjeru
const c = (await call('POST', '/api/admin/clients', { name: `Versions Check ${Date.now() % 100000}` })).data.client;
const f = (await call('POST', '/api/admin/forms', { clientId: c.id, template: 'custom-enquiry', piece: 'pendant' })).data.form;
ok(f?.id, `forma ${f?.id}`);

const v2 = { ...structuredClone(f), name: 'Pendant v2' };
await call('PUT', `/api/admin/forms/${f.id}`, { form: v2 });
const v3 = structuredClone(v2);
v3.name = 'Pendant v3';
[v3.steps[1], v3.steps[2]] = [v3.steps[2], v3.steps[1]];
await call('PUT', `/api/admin/forms/${f.id}`, { form: v3 });
await call('PUT', `/api/admin/forms/${f.id}`, { form: v3 }); // isto: bez nove verzije
const vers = (await call('GET', `/api/admin/forms/${f.id}/versions`)).data.versions;
ok(vers.length === 2, `2 verzije (bez duplikata kad se sačuva isto): ${vers.length}`);
ok(vers[0].name === 'Pendant v2' && vers[1].name === f.name, `redoslijed: najnovija prva (${vers.map((v) => v.name).join(', ')})`);
ok(vers[0].steps.join() !== v3.steps.map((s) => s.label).join(), 'verzija pamti stari red koraka');
const old = (await call('GET', `/api/admin/forms/${f.id}/versions/${vers[1].id}`)).data.form;
ok(old?.name === f.name, 'učitavanje stare verzije');
ok((await call('GET', `/api/admin/forms/${f.id}/versions`, null, {})).status === 403, 'verzije bez tokena: 403');

ok((await call('POST', `/api/admin/forms/${f.id}/archive`, { archived: true })).status === 200, 'arhiviranje forme');
ok((await fetch(`${BASE}/api/forms/${f.id}`)).status === 404, 'arhivirana forma: kupac dobija 404');
const fd = new FormData();
for (const [k, v] of Object.entries({ formId: f.id, name: 'Test', email: 't@example.com', phone: '5551234567', consent: 'yes', answers: '{}' })) fd.set(k, v);
ok((await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd })).status === 404, 'arhivirana forma ne prima upit');
ok((await call('GET', `/api/admin/forms/${f.id}`)).status === 200, 'admin i dalje otvara arhiviranu formu');
await call('POST', `/api/admin/forms/${f.id}/archive`, { archived: false });
ok((await fetch(`${BASE}/api/forms/${f.id}`)).status === 200, 'vraćena forma radi');
const demoArch = await call('POST', '/api/admin/forms/demo/archive', { archived: true });
if (demoArch.status === 200) await call('POST', '/api/admin/forms/demo/archive', { archived: false }); // demo je sačuvan u bazi: vrati ga
ok(demoArch.status === 404 ? /Save the built-in demo/.test(demoArch.data.error) : demoArch.status === 200, `demo forma: ${demoArch.status === 404 ? 'ugrađena se ne arhivira dok nije sačuvana' : 'sačuvana, arhivira se i vraća'}`);

const f2 = (await call('POST', '/api/admin/forms', { clientId: c.id, template: 'ring' })).data.form;
await call('POST', `/api/admin/forms/${f2.id}/archive`, { archived: true }); // već arhivirana prije klijenta
await call('POST', `/api/admin/clients/${c.id}/portal-link`);
await call('POST', `/api/admin/clients/${c.id}/archive`, { archived: true });
let list = (await call('GET', '/api/admin/forms')).data;
ok(list.clients.find((x) => x.id === c.id)?.archivedAt, 'klijent arhiviran');
ok(list.forms.find((x) => x.id === f.id)?.archivedAt, 'forme klijenta arhivirane');
ok(!(await call('GET', '/api/admin/overview')).data.links[c.id], 'portal link ugašen');
await call('POST', `/api/admin/clients/${c.id}/archive`, { archived: false });
list = (await call('GET', '/api/admin/forms')).data;
ok(!list.clients.find((x) => x.id === c.id)?.archivedAt && !list.forms.find((x) => x.id === f.id)?.archivedAt, 'vraćanje klijenta vraća njegove forme');
ok(list.forms.find((x) => x.id === f2.id)?.archivedAt, 'forma arhivirana ranije ostaje arhivirana');

const demos = (await call('GET', '/api/admin/leads')).data.demos;
if (demos.length) {
  const d = demos[0];
  ok((await call('POST', `/api/admin/demo-requests/${d.id}/handled`, { handled: true })).status === 200, 'demo zahtjev: obrađeno');
  ok((await call('GET', '/api/admin/leads')).data.demos.find((x) => x.id === d.id)?.handled_at, 'handled_at upisan');
  await call('POST', `/api/admin/demo-requests/${d.id}/handled`, { handled: false });
  ok(!(await call('GET', '/api/admin/leads')).data.demos.find((x) => x.id === d.id)?.handled_at, 'vraćeno u neobrađene');
  ok((await call('POST', `/api/admin/demo-requests/${d.id}/handled`, { handled: true }, {})).status === 403, 'bez tokena: 403');
} else console.log('---- nema demo zahtjeva lokalno, preskačem');

console.log(fail ? `\n${fail} palo` : '\nsve prošlo');
process.exit(fail ? 1 : 0);
