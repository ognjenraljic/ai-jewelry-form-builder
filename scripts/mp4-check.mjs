// Video bez zvuka: stripAudio izbaci audio traku, a slika ostaje ispravna (ffprobe + puno dekodiranje).
// Treba ffmpeg/ffprobe lokalno: node scripts/mp4-check.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripAudio } from '../src/mp4.js';

const dir = mkdtempSync(join(tmpdir(), 'mp4-'));
let fails = 0;
const ok = (c, name) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const streams = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', f]).toString()).streams;
for (const [name, extra] of [['moov ispred (faststart)', ['-movflags', '+faststart']], ['moov iza mdat', []]]) {
  const src = join(dir, `in-${extra.length}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x320:rate=24:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', ...extra, src]);
  const before = streams(src);
  const out = stripAudio(readFileSync(src));
  ok(out && out.length < readFileSync(src).length, `${name}: audio traka izbačena`);
  const dst = join(dir, `out-${extra.length}.mp4`);
  writeFileSync(dst, out);
  const after = streams(dst);
  ok(before.some((s) => s.codec_type === 'audio') && !after.some((s) => s.codec_type === 'audio'), `${name}: nema zvuka`);
  ok(after.length === 1 && after[0].nb_frames === before.find((s) => s.codec_type === 'video').nb_frames, `${name}: ista slika, ${after[0]?.nb_frames} kadrova`);
  let clean = true;
  try { const err = execFileSync('ffmpeg', ['-v', 'error', '-i', dst, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); clean = !err.trim(); } catch { clean = false; }
  ok(clean, `${name}: dekodira se bez greške`);
}
// Video bez zvuka ostaje kakav jeste.
const silent = join(dir, 'silent.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=160x160:rate=24:duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', silent]);
ok(stripAudio(readFileSync(silent)) === null, 'video bez zvuka se ne dira');
ok(stripAudio(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])) === null, 'pokvaren fajl se ne dira');
if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('MP4 audio strip checks passed.');
