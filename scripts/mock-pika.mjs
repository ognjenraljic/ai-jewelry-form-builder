// Lažni Pika API za lokalne provjere bez troška. Worker ga koristi samo uz DEV_MODE=1 i PIKA_BASE.
// Pokretanje: node scripts/mock-pika.mjs [port] [video.mp4] [slika]
// Bilježi poslove i upload na GET /__log; POST /__fail obori sljedeći video posao.
// MOCK_IMAGE_POLLS i MOCK_VIDEO_POLLS produže čekanje (npr. za snimak forme sa animacijom čekanja).
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = +(process.argv[2] || 8898);
const video = process.argv[3] ? readFileSync(process.argv[3]) : Buffer.alloc(4096, 7);
const image = readFileSync(process.argv[4] || new URL('../public/site/gallery/halo-ring.webp', import.meta.url));
const self = `http://127.0.0.1:${port}`;
const jobs = new Map();
const log = { uploads: 0, jobs: [], keys: [] };
let failNext = false;
let n = 0;
const polls = { image: +(process.env.MOCK_IMAGE_POLLS || 0), video: +(process.env.MOCK_VIDEO_POLLS || 1) };

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const url = req.url;
    if (url === '/__log') return send(res, 200, log);
    if (url === '/__fail') { failNext = true; return send(res, 200, { ok: true }); }
    if (url === '/file/image.png') return send(res, 200, image, 'image/png');
    if (url === '/file/video.mp4') return send(res, 200, video, 'video/mp4');
    if (req.method === 'PUT') { log.uploads++; return send(res, 200, {}); }
    if (req.headers['x-api-key'] !== 'mock-local') return send(res, 401, { message: 'no key' });
    if (url === '/v1/media/uploads') return send(res, 200, { upload_url: `${self}/put/${++n}`, url: `https://cdn.mock/${n}`, headers: {} });
    const m = url.match(/^\/v1\/media\/jobs\/(.+)$/);
    if (m) {
      const j = jobs.get(m[1]);
      if (!j) return send(res, 404, { message: 'no job' });
      if (j.polls-- > 0) return send(res, 200, { id: j.id, status: 'running' });
      if (j.fail) return send(res, 200, { id: j.id, status: 'failed', error: { code: 'provider_error', message: 'mock' }, billing: { state: 'settled', charge_micro_usd: 0 } });
      const output = j.kind === 'video' ? { media_type: 'video', video: { url: `${self}/file/video.mp4`, content_type: 'video/mp4' } } : { media_type: 'image', images: [{ url: `${self}/file/image.png`, content_type: 'image/png' }] };
      return send(res, 200, { id: j.id, status: 'completed', output, usage: { input_tokens: 200, image_output_tokens: 1120 }, billing: { state: 'settled', charge_micro_usd: j.kind === 'video' ? 785000 : 139000 } });
    }
    if (req.method === 'POST' && url.startsWith('/v1/media/')) {
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      const kind = url.includes('to-video') ? 'video' : 'image';
      const key = req.headers['idempotency-key'];
      log.keys.push(key);
      log.jobs.push({ path: url, kind, body });
      const job = { id: `media_${++n}`, kind, polls: polls[kind], fail: kind === 'video' && failNext };
      if (kind === 'video') failNext = false;
      jobs.set(job.id, job);
      return send(res, 200, { id: job.id, status: 'running' });
    }
    send(res, 404, { message: 'unknown' });
  });
}).listen(port, '127.0.0.1', () => console.log(`mock pika on ${port}`));
