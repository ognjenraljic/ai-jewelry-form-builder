// Izbor zuba kroz server: loš zapis se odbija, dobar ide u lead i prompt. RENDER=1 pravi i jedan render.
const BASE = process.env.BASE || 'http://127.0.0.1:8797';
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

async function lead(answers) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: 'demo', name: 'Teeth Test', email: 'teeth@example.com', phone: '555 010 0009', consent: 'yes' })) fd.set(k, v);
  fd.set('answers', JSON.stringify(answers));
  const res = await fetch(`${BASE}/api/leads`, { method: 'POST', body: fd });
  return { status: res.status, data: await res.json() };
}

const base = { type: 'grillz', style: 'other', metal: 'yellow-gold', karat: '14K', stones: 'moissanite', coverage: 'full', budget: '$1,500 - $2,500' };
for (const bad of ['T11,T3', 'T3,T3', 'X1', '']) {
  const r = await lead({ ...base, teeth: bad });
  ok(r.status === 400, `odbijeno: "${bad}" -> ${r.data.error}`);
}
const r = await lead({ ...base, teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8' });
ok(r.status === 200 && r.data.leadId, 'dobar izbor (6 on 6) prihvaćen');
const preset = await lead({ ...base, style: 'top6', teeth: 'B5,B6' });
const saved = preset.data.leadId && await fetch(`${BASE}/api/leads/${preset.data.leadId}`, { headers: { 'x-lead-token': preset.data.token } }).then(r => r.json());
ok(preset.status === 200 && saved.answers.teeth === 'B5,B6', 'zubi koje je kupac promijenio poslije Top 6 ostaju kako ih je izabrao');
const marked = await lead({ ...base, style: 'top6', teeth: undefined });
const markedSaved = marked.data.leadId && await fetch(`${BASE}/api/leads/${marked.data.leadId}`, { headers: { 'x-lead-token': marked.data.token } }).then(r => r.json());
ok(marked.status === 200 && markedSaved.answers.teeth === 'T3,T4,T5,T6,T7,T8', 'bez ručnog izbora Top 6 sam označi svoje zube');

if (process.env.RENDER === '1' && r.data.leadId) {
  const res = await fetch(`${BASE}/api/leads/${r.data.leadId}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: r.data.token, model: process.env.MODEL || 'auto' }) });
  const d = await res.json();
  ok(!!d.url, `render ${d.dev?.model} ${(d.dev?.ms / 1000).toFixed(1)} s $${d.dev?.costUsd?.toFixed(3)} ${d.url || d.dev?.error || d.error}`);
  ok(d.dev?.prompt.includes('Exactly 12 teeth'), 'prompt nosi tačan broj zuba');
  console.log(d.dev?.prompt);
}
