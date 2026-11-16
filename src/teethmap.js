// Mapa zuba za grillz render: ravan crtež usta spreda, izabrani zubi popunjeni bojom metala, ostali samo obris.
// Ide modelu kao referentna slika uz prompt: raspored koji vidi prati mnogo bolje nego broj napisan riječima
// (Ognjen 16.11.2026: bez brojanja zuba poslije rendera, prompt mora sam pogoditi broj).
// Pravi se na serveru iz odgovora (ne šalje je kupac), čist PNG bez canvasa: Worker nema canvas.
import { parseTeeth } from './teeth.js';

const W = 768;
const H = 432;
// Pozicije 1-10 slijeva nadesno kako ih gledamo spreda (5 i 6 centralni sjekutići), širina i visina u pikselima.
const UPPER = { w: [50, 54, 58, 56, 76, 76, 56, 58, 54, 50], h: [74, 82, 96, 88, 104, 104, 88, 96, 82, 74] };
const LOWER = { w: [48, 48, 48, 40, 37, 37, 40, 48, 48, 48], h: [66, 70, 84, 78, 74, 74, 78, 84, 70, 66] };
const GAP = 6;
const FILL = { yellow: [214, 170, 66], white: [218, 222, 227], rose: [219, 156, 134] };
const BG = [12, 12, 12];
const LINE = [92, 92, 92];

// Zaobljen pravougaonik: unutra, ivica (za obris) ili van.
function inRound(x, y, r) {
  const rx = Math.min(r.rad, r.w / 2);
  const cx = Math.max(r.x + rx, Math.min(x, r.x + r.w - rx));
  const cy = Math.max(r.y + rx, Math.min(y, r.y + r.h - rx));
  return Math.hypot(x - cx, y - cy) <= rx;
}

function rowRects(spec, top, alignBottom) {
  const total = spec.w.reduce((a, b) => a + b, 0) + GAP * 9;
  let x = (W - total) / 2;
  return spec.w.map((w, i) => {
    const h = spec.h[i];
    const r = { pos: i + 1, x, y: alignBottom ? top - h : top, w, h, rad: Math.round(w * 0.32) };
    x += w + GAP;
    return r;
  });
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (bytes) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set([...type].map((ch) => ch.charCodeAt(0)), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
async function zlib(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// family: 'yellow' | 'white' | 'rose' (boja metala). Vraća { mime, b64 } ili null kad zubi nisu izabrani.
export async function teethMapImage(teeth, family = 'yellow') {
  const t = parseTeeth(teeth);
  if (!t || (!t.top.length && !t.bottom.length)) return null;
  const fill = FILL[family] || FILL.yellow;
  const upper = rowRects(UPPER, 96, false).map((r) => ({ ...r, on: t.top.includes(r.pos) }));
  const lower = rowRects(LOWER, 340, true).map((r) => ({ ...r, on: t.bottom.includes(r.pos) }));
  const all = [...upper, ...lower];
  const raw = new Uint8Array((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < W; x++) {
      let c = BG;
      for (const r of all) {
        if (x < r.x - 1 || x > r.x + r.w + 1 || y < r.y - 1 || y > r.y + r.h + 1) continue;
        const inside = inRound(x + 0.5, y + 0.5, r);
        if (r.on && inside) {
          // Blago sjenčenje odozgo nadolje, da se vidi oblik kape, bez detalja koje bi model prepisao.
          const k = 1.08 - 0.22 * ((y - r.y) / r.h);
          c = fill.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
        } else if (!r.on && inside && !inRound(x + 0.5, y + 0.5, { ...r, x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4, rad: r.rad - 2 })) c = LINE;
        break;
      }
      raw.set(c, row + 1 + x * 3);
    }
  }
  const head = new Uint8Array(13);
  const dv = new DataView(head.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  head.set([8, 2, 0, 0, 0], 8); // 8 bita, RGB
  const png = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', await zlib(raw)), chunk('IEND', new Uint8Array())];
  const bytes = new Uint8Array(png.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of png) { bytes.set(p, o); o += p.length; }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mime: 'image/png', b64: btoa(bin), top: t.top.length, bottom: t.bottom.length };
}
