// Proba hiperrealizma (Ognjen 23.11.2026): isti model kao produkcija (GPT Image 2.6 Flare), isti ulaz (slika stila iz
// biblioteke + prompt iz buildPrompt), samo prompt sa { realism: 'hyper' }. Za svaki primjer pravi par: sadašnji i hiperrealni.
//
//   node scripts/hyperreal-test.mjs                 samo ispiše promptove (bez troška)
//   node scripts/hyperreal-test.mjs --run           pravi slike preko Pike (PIKA_API_KEY iz .dev.vars), ~0,15-0,25 $ po slici
//   node scripts/hyperreal-test.mjs --run --only hyper --pick pendant
//
// Forma: Districtova sa /api/forms/<id> (ili --form putanja.json). Slike idu u ~/Desktop/jewelrylead-hyperreal/.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildPrompt } from '../src/prompt.js';
import { teethMapImage } from '../src/teethmap.js';

const arg = (k, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RUN = process.argv.includes('--run');
const ONLY = arg('--only');            // 'now' | 'hyper' | 'ultra' (zarezom više)
const PICK = arg('--pick');            // ime primjera
const MODEL = arg('--model', 'openai/gpt-image-2.6-flare');
const OUT = join(homedir(), 'Desktop', 'jewelrylead-hyperreal');
const FORM_ID = 'district-jewelers-denver-enrique-gon-cus';

const SAMPLES = {
  pendant: { type: 'pendant', style: 'script-name', metal: 'yellow-gold', karat: '14K', coverage: 'full', stones: 'moissanite', clarity: 'VVS', stone_setting: 'prong', inscription: 'Kenny', font: 'classic-script', pendant_size: '2' },
  ring: { type: 'ring', style: 'halo', metal: 'white-gold', karat: '14K', coverage: 'full', stones: 'lab', clarity: 'VS', stone_setting: 'prong', ring_center_shape: 'oval', ring_carat: '2ct', ring_band: 'pave' },
  grillz: { type: 'grillz', style: 'top', metal: 'yellow-gold', karat: '14K', coverage: 'full', stones: 'moissanite', clarity: 'VVS', stone_setting: 'prong', teeth: 'T3,T4,T5,T6,T7,T8', grillz_grill_cut: 'solid' },
  chain: { type: 'chain', style: 'miami-cuban', metal: 'yellow-gold', karat: '14K', coverage: 'full', stones: 'moissanite', clarity: 'VVS', chain_length: '22', chain_width: '12-mm' },
};

async function loadForm() {
  const file = arg('--form');
  const d = file ? JSON.parse(readFileSync(file, 'utf8')) : await (await fetch(`https://jewelrylead.com/api/forms/${FORM_ID}`)).json();
  return d.form || d;
}

function devVar(name) {
  if (process.env[name]) return process.env[name];
  if (!existsSync('.dev.vars')) return '';
  const m = readFileSync('.dev.vars', 'utf8').match(new RegExp(`^${name}\\s*=\\s*"?([^"\\n]+)"?`, 'm'));
  return m ? m[1].trim() : '';
}

async function pika(path, opts = {}) {
  const res = await fetch(`https://api.pika.art${path}`, {
    ...opts,
    headers: { 'x-api-key': devVar('PIKA_API_KEY'), accept: 'application/json', ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Pika ${res.status}: ${data.message || data.error?.message || ''}`);
  return data;
}

async function upload(bytes, mime) {
  const u = await pika('/v1/media/uploads', { method: 'POST', body: JSON.stringify({ content_type: mime, size_bytes: bytes.length }) });
  const r = await fetch(u.upload_url, { method: 'PUT', body: bytes, headers: u.headers || {} });
  if (!r.ok) throw new Error(`upload ${r.status}`);
  return u.url;
}

async function render(prompt, styleImage, extra = null) {
  const body = { prompt, num_images: 1, output_format: 'jpeg', size: '1024x1024', quality: 'high' };
  let api = `${MODEL}/text-to-image`;
  const imgs = [];
  if (styleImage) imgs.push(await upload(readFileSync(join('public', styleImage)), 'image/webp'));
  if (extra) imgs.push(await upload(extra.bytes, extra.mime));
  if (imgs.length) { body.image_urls = imgs; api = `${MODEL}/image-to-image`; }
  let job = await pika(`/v1/media/${api}`, { method: 'POST', body: JSON.stringify(body), headers: { 'idempotency-key': crypto.randomUUID() } });
  const t0 = Date.now();
  while (job.status !== 'completed' && job.status !== 'failed') {
    if (Date.now() - t0 > 180_000) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 2500));
    job = await pika(`/v1/media/jobs/${job.id}`);
  }
  if (job.status === 'failed') throw new Error(`failed: ${job.error?.message || ''}`);
  const f = job.output?.image || job.output?.images?.[0] || job.output;
  const img = await fetch(f.url);
  return { buf: Buffer.from(await img.arrayBuffer()), cost: job.billing?.charge_micro_usd ? job.billing.charge_micro_usd / 1e6 : null, ms: Date.now() - t0 };
}

const form = await loadForm();
if (RUN) mkdirSync(OUT, { recursive: true });
const report = [];
for (const [name, answers] of Object.entries(SAMPLES)) {
  if (PICK && PICK !== name) continue;
  const style = (form.styles?.[answers.type] || []).find((s) => s.value === answers.style) || null;
  // Isto kao produkcija: slika stila sa probnom riječi se ne šalje kad kupac ima svoj natpis.
  const sendStyle = style?.image && !(answers.inscription && /script|block|name/.test(style.image)) ? style.image.replace(/^\/library-light\//, '/library/') : '';
  // Grillz kao produkcija: bez slike stila (tačni zubi), sa mapom zuba kao referencom.
  const grillz = answers.type === 'grillz';
  const map = grillz ? await teethMapImage(answers.teeth, 'yellow') : null;
  const refs = grillz ? ['teethmap'] : sendStyle ? ['style'] : [];
  for (const variant of ['now', 'hyper', 'ultra']) {
    if (ONLY && !ONLY.split(',').includes(variant)) continue;
    const prompt = buildPrompt(form, answers, { refs, style, realism: variant === 'now' ? '' : variant });
    if (!RUN) { console.log(`\n===== ${name} / ${variant} (${prompt.length} znakova, stil: ${sendStyle || 'bez slike'}) =====\n${prompt}`); continue; }
    try {
      const r = await render(prompt, grillz ? '' : sendStyle, map ? { bytes: Buffer.from(map.b64, 'base64'), mime: map.mime } : null);
      const file = join(OUT, `${name}-${variant}-pika26.jpg`);
      writeFileSync(file, r.buf);
      writeFileSync(join(OUT, `${name}-${variant}-pika26.txt`), prompt);
      report.push({ name, variant, file, cost: r.cost, s: Math.round(r.ms / 1000) });
      console.log(`${name}/${variant}: ${file} (${r.cost ?? '?'} $, ${Math.round(r.ms / 1000)} s)`);
    } catch (e) {
      console.log(`${name}/${variant}: GREŠKA ${e.message}`);
      report.push({ name, variant, error: e.message });
      if (/402|balance|insufficient/i.test(e.message)) break;
    }
  }
}
if (RUN) writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
