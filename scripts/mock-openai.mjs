// Lažni OpenAI Image API za lokalne provjere bez troška. Worker ga koristi samo uz DEV_MODE=1 i OPENAI_BASE.
// Pokretanje: node scripts/mock-openai.mjs [port] [izlaz.json]
// Vraća jednu od slika iz galerije i u izlaz.json upisuje šta je stiglo (slike, maska, prompt).
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const port = +(process.argv[2] || 8899);
const out = process.argv[3] || 'mock-openai-log.json';
const pics = ['grillz-top8', 'halo-ring', 'cuban-chain'].map((n) => readFileSync(new URL(`../public/site/gallery/${n}.webp`, import.meta.url)).toString('base64'));
const log = [];
let k = 0;

// Grubo čitanje multipart tijela: imena polja, imena fajlova i veličine.
function parts(buf, type) {
  const boundary = type.match(/boundary=(.+)$/)?.[1];
  if (!boundary) return [];
  const text = buf.toString('latin1');
  return text.split(`--${boundary}`).slice(1, -1).map((chunk) => {
    const [head, ...rest] = chunk.split('\r\n\r\n');
    const body = rest.join('\r\n\r\n').replace(/\r\n$/, '');
    return { name: head.match(/name="([^"]+)"/)?.[1], file: head.match(/filename="([^"]+)"/)?.[1] || null, size: Buffer.byteLength(body, 'latin1'), sha256: head.includes('filename=') ? createHash('sha256').update(Buffer.from(body, 'latin1')).digest('hex') : null, value: head.includes('filename=') ? null : body };
  });
}

createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    let entry = { path: req.url, auth: !!req.headers.authorization };
    // Moderacija: tekst sa "FLAGME" je označen, sve ostalo prolazi.
    if (req.url === '/v1/moderations') {
      const body = buf.toString();
      log.push({ path: req.url, flagged: body.includes('FLAGME'), images: (body.match(/image_url/g) || []).length });
      writeFileSync(out, JSON.stringify(log, null, 2));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ results: [{ flagged: body.includes('FLAGME') }] }));
      return;
    }
    // Brojanje zuba: MOCK_CAPS="9,6;8,6" vraća redom te brojeve (zadnji se ponavlja); bez njega greška (provjera se preskače).
    if (req.url === '/v1/responses') {
      const list = (process.env.MOCK_CAPS || '').split(';').filter(Boolean);
      const caps = list[Math.min(log.filter((x) => x.path === '/v1/responses').length, list.length - 1)];
      const j = JSON.parse(buf.toString() || '{}');
      log.push({ path: req.url, model: j.model, images: JSON.stringify(j).split('input_image').length - 1, caps: caps || null });
      writeFileSync(out, JSON.stringify(log, null, 2));
      if (!caps) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'mock: MOCK_CAPS not set' } })); return; }
      const [top, bottom] = caps.split(',').map(Number);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ top, bottom }) }] }], usage: { input_tokens: 900, output_tokens: 120 } }));
      return;
    }
    if (req.url === '/v1/images/edits') {
      const p = parts(buf, req.headers['content-type'] || '');
      const mask = p.find((x) => x.name === 'mask');
      entry = { ...entry, images: p.filter((x) => x.name === 'image[]').length, imageHashes: p.filter((x) => x.name === 'image[]').map((x) => x.sha256), model: p.find((x) => x.name === 'model')?.value, quality: p.find((x) => x.name === 'quality')?.value, size: p.find((x) => x.name === 'size')?.value, mask: mask ? mask.size : 0, prompt: p.find((x) => x.name === 'prompt')?.value || '' };
    } else {
      const j = JSON.parse(buf.toString() || '{}');
      entry = { ...entry, images: 0, mask: 0, model: j.model, quality: j.quality, prompt: j.prompt || '' };
    }
    log.push(entry);
    writeFileSync(out, JSON.stringify(log, null, 2));
    // MOCK_REJECT_MODEL=<id>: taj model dobija 404 kao nalog koji ga nema (provjera rezervnog modela).
    if (process.env.MOCK_REJECT_MODEL && entry.model === process.env.MOCK_REJECT_MODEL) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `The model '${entry.model}' does not exist or you do not have access to it.` } }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: [{ b64_json: pics[k++ % pics.length] }], usage: { input_tokens: 1200, output_tokens: 4160, input_tokens_details: { image_tokens: 1000 } } }));
  });
}).listen(port, '127.0.0.1', () => console.log(`mock OpenAI na http://127.0.0.1:${port}, log: ${out}`));
