// Provjera rutiranja: prvi render bez izbora modela mora ići na FIRST_MODEL, dorada na TWEAK_MODEL.
const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const fd = new FormData();
for (const [k, v] of Object.entries({ formId: 'demo', name: 'Rutiranje test', email: 'routing@example.com', phone: '555 010 0001', consent: 'yes' })) fd.set(k, v);
fd.set('answers', JSON.stringify({ type: 'ring', metal: 'two-tone', karat: '14K', stones: 'none', budget: 'Under $1,500', vision: 'Simple signet ring with a flat oval top' }));
const l = await (await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd })).json();
const call = async (body) => (await fetch(`${BASE}/api/leads/${l.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: l.token, ...body }) })).json();
const first = await call({});
console.log('prvi:', first.dev?.model, first.url || first.error);
const tweak = await call({ tweak: 'engrave a small star on the oval top' });
console.log('dorada:', tweak.dev?.model, tweak.url || tweak.error);
