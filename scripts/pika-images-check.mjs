// Slike preko Pike na ISTIM GPT Image modelima (26.11.2026, Ognjen: "skroz na Piku, isti model kao u OpenAI").
// Bez troška: lažni Pika server.  node scripts/mock-pika.mjs 8899, pa u .dev.vars radne kopije:
//   PIKA_API_KEY=mock-local  PIKA_BASE=http://127.0.0.1:8899  PIKA_IMAGES=1   (lokalno Pika samo uz izričito PIKA_IMAGES=1)
//   BASE=http://127.0.0.1:8851 PIKA=http://127.0.0.1:8899 node scripts/pika-images-check.mjs
const base = process.env.BASE || 'http://127.0.0.1:8851';
const pika = process.env.PIKA || 'http://127.0.0.1:8899';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('samo lokalno');
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const post = async (path, body) => {
  const multipart = body instanceof FormData;
  const r = await fetch(base + path, { method: 'POST', headers: multipart ? {} : { 'content-type': 'application/json' }, body: multipart ? body : JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const images = async () => (await (await fetch(`${pika}/__log`)).json()).jobs.filter((j) => j.kind === 'image');

const lead = async (answers, email) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ formId: 'demo', name: 'Pika QA', email, phone: '555 010 0011', consent: 'yes', answers: JSON.stringify(answers) })) fd.set(k, v);
  return (await post('/api/leads', fd)).data;
};
const tag = Date.now().toString(36);
const before = (await images()).length;

// 1) Prsten: prvi render i dorada idu na GPT Image 2.6 Flare preko Pike.
const l1 = await lead({ type: 'ring', style: 'other', metal: 'yellow-gold', karat: '14K', stones: 'natural', coverage: 'accents', budget: '$1,500 - $2,500' }, `pk1-${tag}@example.com`);
const r1 = await post(`/api/leads/${l1.leadId}/renders`, { token: l1.token });
ok(r1.status === 200 && r1.data.url, `prvi render gotov (${r1.status} ${r1.data.error || ''})`);
let j = (await images()).pop();
ok(j && j.path.startsWith('/v1/media/openai/gpt-image-2.6-flare/'), `prvi render: GPT Image 2.6 Flare preko Pike (${j?.path})`);
ok(j && j.body.size === '1024x1024' && j.body.quality === 'high' && !j.body.aspect_ratio && !j.body.resolution, 'veličina 1024x1024 i kvalitet high, kao na OpenAI-ju');
ok(j && !j.body.prompt.includes('Pure black seamless background') && /MAXIMUM PHOTOREALISM|real photo/i.test(j.body.prompt), 'isti hiperrealni prompt kao na OpenAI-ju, bez filmske scene');
const t1 = await post(`/api/leads/${l1.leadId}/renders`, { token: l1.token, tweak: 'make the band thinner' });
j = (await images()).pop();
ok(t1.status === 200 && j.path === '/v1/media/openai/gpt-image-2.6-flare/image-to-image', `dorada: isti model, image-to-image (${j.path})`);
ok(Array.isArray(j.body.image_urls) && j.body.image_urls.length >= 1, 'dorada šalje prethodnu sliku');

// 2) Grillz: isti model kao prvi render (FIRST_MODEL), preko Pike.
const l2 = await lead({ type: 'grillz', style: 'set', metal: 'yellow-gold', karat: '14K', teeth: 'T3,T4,T5,T6,T7,T8', stones: 'lab', coverage: 'full', budget: '$1,500 - $2,500' }, `pk2-${tag}@example.com`);
const r2 = await post(`/api/leads/${l2.leadId}/renders`, { token: l2.token });
j = (await images()).pop();
ok(r2.status === 200 && j.path.startsWith('/v1/media/openai/gpt-image-2.6-flare/'), `grillz: GPT Image 2.6 Flare preko Pike (${j.path})`);

ok((await images()).length - before === 3, 'tačno tri slike na Piki, nijedna na OpenAI-ju (lokalno OpenAI ključ i ne postoji)');
console.log(fails ? `${fails} FAILED` : 'Pika images checks passed.');
process.exit(fails ? 1 : 0);
