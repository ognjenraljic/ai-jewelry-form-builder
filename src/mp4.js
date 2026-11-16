// Video komada bez zvuka (Ognjen 16.11: "bez muzike"). Pika H3 Flex uvijek pravi i zvuk, a nema polje da ga isključi,
// pa pri čuvanju u R2 izbacimo audio traku iz MP4 fajla. Worker nema ffmpeg: radimo direktno nad kutijama (box) fajla.
// Uklanja se svaki `trak` čiji je hdlr 'soun'. Kad je `moov` ispred `mdat` (faststart), pomaci komada (stco/co64)
// preostalih traka se umanje za izbačene bajtove. Fragmentiran MP4 ili nešto neočekivano: vraća se original (null).

const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const put32 = (b, o, v) => { b[o] = (v >>> 24) & 255; b[o + 1] = (v >>> 16) & 255; b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255; };
const type = (b, o) => String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);

// Kutije unutar [start, end): { type, start, size, head } (head = 8 ili 16 bajtova zaglavlja).
function boxes(b, start, end) {
  const out = [];
  let o = start;
  while (o + 8 <= end) {
    let size = u32(b, o);
    let head = 8;
    if (size === 1) {
      const hi = u32(b, o + 8);
      const lo = u32(b, o + 12);
      size = hi * 2 ** 32 + lo;
      head = 16;
    } else if (size === 0) size = end - o;
    if (size < head || o + size > end) return null;
    out.push({ type: type(b, o), start: o, size, head });
    o += size;
  }
  return o === end ? out : null;
}
const child = (b, box, name) => (boxes(b, box.start + box.head, box.start + box.size) || []).find((x) => x.type === name);

function handler(b, trak) {
  const mdia = child(b, trak, 'mdia');
  const hdlr = mdia && child(b, mdia, 'hdlr');
  // hdlr: zaglavlje + verzija/flags (4) + pre_defined (4), pa handler_type.
  return hdlr ? String.fromCharCode(...b.subarray(hdlr.start + hdlr.head + 8, hdlr.start + hdlr.head + 12)) : '';
}

// Pomaci komada u preostalim trakama (stco 32-bit, co64 64-bit) umanjeni za `shift`.
function shiftOffsets(b, trak, shift) {
  const mdia = child(b, trak, 'mdia');
  const minf = mdia && child(b, mdia, 'minf');
  const stbl = minf && child(b, minf, 'stbl');
  if (!stbl) return false;
  for (const box of boxes(b, stbl.start + stbl.head, stbl.start + stbl.size) || []) {
    const base = box.start + box.head + 4; // verzija/flags
    if (box.type === 'stco') {
      const n = u32(b, base);
      for (let i = 0; i < n; i++) put32(b, base + 4 + i * 4, u32(b, base + 4 + i * 4) - shift);
    } else if (box.type === 'co64') {
      const n = u32(b, base);
      for (let i = 0; i < n; i++) {
        const o = base + 4 + i * 8;
        const v = u32(b, o) * 2 ** 32 + u32(b, o + 4) - shift;
        put32(b, o, Math.floor(v / 2 ** 32));
        put32(b, o + 4, v % 2 ** 32);
      }
    }
  }
  return true;
}

// bytes: Uint8Array MP4. Vraća novi Uint8Array bez zvuka, ili null kad nema šta (ili ne smije) da se mijenja.
export function stripAudio(bytes) {
  const b = new Uint8Array(bytes);
  const top = boxes(b, 0, b.length);
  if (!top) return null;
  if (top.some((x) => x.type === 'moof')) return null; // fragmentiran MP4: ne diramo
  const moov = top.find((x) => x.type === 'moov');
  const mdat = top.find((x) => x.type === 'mdat');
  if (!moov || !mdat || moov.head !== 8) return null;
  const kids = boxes(b, moov.start + moov.head, moov.start + moov.size);
  if (!kids) return null;
  const traks = kids.filter((x) => x.type === 'trak');
  const sound = traks.filter((t) => handler(b, t) === 'soun');
  if (!sound.length || sound.length === traks.length) return null;
  const removed = sound.reduce((n, t) => n + t.size, 0);
  const out = b.slice();
  if (moov.start < mdat.start) for (const t of traks) if (!sound.includes(t) && !shiftOffsets(out, t, removed)) return null;
  put32(out, moov.start, moov.size - removed);
  const parts = [];
  let o = 0;
  for (const t of sound.sort((x, y) => x.start - y.start)) { parts.push(out.subarray(o, t.start)); o = t.start + t.size; }
  parts.push(out.subarray(o));
  const res = new Uint8Array(out.length - removed);
  let p = 0;
  for (const part of parts) { res.set(part, p); p += part.length; }
  return res;
}
