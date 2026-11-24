// Pravila iz District feedbacka 24.11.2026: bez leda iznutra (i na vidljivoj unutrašnjoj strani petlje narukvice,
// lanca i prstena) i split shank uvijek sa 2 manja dijamanta (i uz How iced? = None). Bez servera i bez troška.
// node scripts/inside-split-check.mjs
import { buildPrompt, buildTweakPrompt } from '../src/prompt.js';
import { TEMPLATES, fromTemplate } from '../src/forms.js';

let fails = 0;
const ok = (name, cond) => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}`); if (!cond) fails++; };
const tpl = 'ring';
const form = fromTemplate(tpl, { id: 'check-rules', brand: 'Check' });
const fields = form.steps.flatMap((s) => s.fields);
const band = fields.find((f) => f.id === 'band');
ok(`šablon ${tpl} ima pitanje Band sa Split shank`, !!band?.options?.some((o) => o.value === 'split'));

// Kao Districtova forma: Custom Enquiry + pitanje ring_band (How iced? = None postoji samo tu).
const ce = fromTemplate('custom-enquiry', { id: 'check-ce', brand: 'Check' });
ce.steps[ce.steps.length - 1].fields.push({ id: 'ring_band', label: 'Band', type: 'choice', options: band.options.map((o) => ({ value: o.value, label: o.label })) });
const p1 = buildPrompt(ce, { type: 'ring', metal: 'yellow-gold', karat: '18K', coverage: 'none', ring_band: 'split' }, { realism: 'ultra' });
ok('split shank + Not iced: pravilo 2 manja dijamanta', /exactly 2 smaller diamonds in the split shank/.test(p1));
ok('split shank + Not iced: izuzetak u Not iced', /only exception: the 2 smaller diamonds/.test(p1));
const p2 = buildPrompt(form, { type: 'ring', metal: 'yellow-gold', karat: '18K', coverage: 'full', stones: 'moissanite', band: 'split' }, { realism: 'ultra' });
ok('split shank + iced: pravilo stoji', /2 smaller diamonds/.test(p2) && /NO ICE ON THE INSIDE/.test(p2));
const p3 = buildPrompt(form, { type: 'ring', metal: 'yellow-gold', karat: '18K', coverage: 'none', band: 'plain' }, { realism: 'ultra' });
ok('plain band: nema split pravila', !/split shank/i.test(p3.replace(/Split shank band\b/g, '')) && !/2 smaller diamonds/.test(p3));
// Prilagođena forma: pitanje "Band" sa natpisom "Split Shank" i drugim value.
const custom = JSON.parse(JSON.stringify(form));
const cb = custom.steps.flatMap((s) => s.fields).find((f) => f.id === 'band');
cb.options = cb.options.map((o) => (o.value === 'split' ? { ...o, value: 'split-shank-x', note: '' } : o));
const p4 = buildPrompt(custom, { type: 'ring', metal: 'white-gold', coverage: 'none', band: 'split-shank-x' }, { realism: 'ultra' });
ok('split shank po natpisu (drugi value)', /2 smaller diamonds/.test(p4));

const p5 = buildPrompt(ce, { type: 'bracelet', metal: 'yellow-gold', karat: '18K', coverage: 'full', stones: 'moissanite', inscription: 'ENRIQUE' }, { realism: 'ultra' });
ok('narukvica: unutrašnja strana petlje bez leda (i daleka strana)', /FAR half of the loop/.test(p5) && /NO ICE ON THE INSIDE/.test(p5) && /only that face/.test(p5));
const p6 = buildPrompt(form, { type: 'chain', metal: 'yellow-gold', coverage: 'full', stones: 'lab' }, { realism: 'ultra' });
ok('lanac: poleđina karika bez leda', /back side faces the camera/.test(p6));
ok('dorada narukvice nosi pravilo', /inner face of every link/.test(buildTweakPrompt('more ice', { type: 'bracelet' })));
const p7 = buildPrompt(ce, { type: 'bracelet', metal: 'yellow-gold', coverage: 'none' }, { realism: 'ultra' });
ok('narukvica bez leda nema završnu provjeru leda', !/FINAL INSIDE CHECK/.test(p7));
console.log(fails ? `${fails} FAILED` : 'Inside and split shank checks passed.');
process.exit(fails ? 1 : 0);
