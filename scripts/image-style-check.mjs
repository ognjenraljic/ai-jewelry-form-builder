// Picture style (Studio Dark / Studio Light): every library picture has a light twin, the onboarding choice
// reaches the form, the public form carries it, and the builder only saves the two known styles.
// Optional live part: BASE=http://127.0.0.1:8798 node scripts/image-style-check.mjs
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formFromOnboarding, publicForm, validateFormDef, ONBOARDING_DEFAULTS, IMAGE_STYLES } from '../src/forms.js';

const pub = fileURLToPath(new URL('../public/', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
let n = 0;
const ok = (v, msg) => { assert.ok(v, msg); n++; };

// 1. Svaka webp slika biblioteke (osim makro kadrova) ima svijetli par na istoj putanji.
const dark = walk(join(pub, 'library')).filter((p) => p.endsWith('.webp') && !p.includes('/details/')).map((p) => relative(join(pub, 'library'), p)).sort();
const EXTRA = ['pieces/chain-category.webp']; // svijetli par slike Chain iz galerije sajta (LIGHT_EXTRA u form.js)
const light = new Set(walk(join(pub, 'library-light')).map((p) => relative(join(pub, 'library-light'), p)));
const missing = dark.filter((p) => !light.has(p));
ok(!missing.length, `every library picture has a Studio Light twin (missing: ${missing.slice(0, 5).join(', ')})`);
const stray = [...light].filter((p) => !dark.includes(p) && !EXTRA.includes(p));
ok(!stray.length && EXTRA.every((p) => light.has(p)), `no stray light pictures (${light.size} light, ${dark.length} dark + ${EXTRA.length} extra)`);

// 2. Onboarding: izbor ide u formu, podrazumijevano ostaje tamno.
const ob = (imageStyle) => ({ ...structuredClone(ONBOARDING_DEFAULTS), formName: 'Style QA', store: { name: 'Style QA', theme: 'dark', accent: '#35d0c4', ...(imageStyle ? { imageStyle } : {}) }, pieces: [{ uid: 'p1', value: 'ring', label: 'Ring' }] });
const lightForm = formFromOnboarding(ob('light'), { id: 'style-qa', clientId: 'c1', brand: 'Style QA' });
const darkForm = formFromOnboarding(ob(), { id: 'style-qa', clientId: 'c1', brand: 'Style QA' });
ok(lightForm.imageStyle === 'light', 'Studio Light from onboarding is saved on the form');
ok(darkForm.imageStyle == null, 'no choice keeps Studio Dark');
validateFormDef(lightForm, 'style-qa');
ok(true, 'a Studio Light form passes validation');

// 3. Javna forma nosi stil samo kad je svijetli.
ok(publicForm(lightForm).imageStyle === 'light', 'public form tells the browser to use Studio Light');
ok(!('imageStyle' in publicForm(darkForm)), 'public Studio Dark form has no extra field');

// 4. Builder čuva samo poznate stilove.
ok(IMAGE_STYLES.join() === 'dark,light', 'two picture styles');
validateFormDef({ ...darkForm, imageStyle: 'dark' }, 'style-qa');
assert.throws(() => validateFormDef({ ...darkForm, imageStyle: 'neon' }, 'style-qa'), /Picture style/);
ok(true, 'unknown picture style is refused');

// 5. Uživo (lokalni server): svijetla slika se servira kao webp.
if (process.env.BASE) {
  const base = process.env.BASE;
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Use a local server.');
  for (const p of ['ring/solitaire.webp', 'options/metal/ring/rose-gold.webp', 'options/carat/earrings/1-ct.webp']) {
    const r = await fetch(`${base}/library-light/${p}`);
    ok(r.ok && r.headers.get('content-type') === 'image/webp', `served: /library-light/${p}`);
  }
}
console.log(`Picture style checks passed (${n}).`);
