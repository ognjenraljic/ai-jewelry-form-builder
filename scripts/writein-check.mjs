// "Other" sa poljem za upis, opisi rezova za AI i slike po boji metala (District 16.11.2026). Bez servera.
//   node scripts/writein-check.mjs
import { buildPrompt, choiceNote } from '../src/prompt.js';
import { optionsOf, validateFormDef, fromTemplate } from '../src/forms.js';
import { withArt, metalArt } from '../public/option-art.js';

let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}`); if (!cond) fails++; };

const form = fromTemplate('grillz', { id: 'wi-check', brand: 'Check' });
const steps = form.steps;
const medical = { id: 'grillz_medical', type: 'chips', label: 'Any medical or dental conditions?', required: false, writeIn: true, options: [{ value: 'none', label: 'None' }, { value: 'crowding', label: 'Crowding' }] };
steps[steps.length - 2].fields.push(medical);

ok(optionsOf(medical, { type: 'grillz' }, form).at(-1).value === 'other', 'Other je zadnji izbor');
ok(optionsOf({ ...medical, writeInLabel: 'Something else' }, {}, form).at(-1).label === 'Something else', 'Other se može preimenovati');
const defErr = (f) => { try { validateFormDef(f, f.id); return ''; } catch (e) { return e.message; } };
ok(!defErr(form), `forma sa Other prolazi provjeru ${defErr(form)}`);
const bad = structuredClone(form);
bad.steps.at(-2).fields.at(-1).options.push({ value: 'other', label: 'Other' });
ok(defErr(bad).includes('"other"'), 'opcija sa ID-jem "other" uz Other se odbija');

const p = buildPrompt(form, { type: 'grillz', style: 'top6', metal: 'yellow-gold', grillz_medical: 'other', grillz_medical__more: 'two implants on the left' });
ok(p.includes('two implants on the left'), 'upisan tekst stiže do AI-ja');
ok(!/: other[;.]/i.test(p), 'AI ne dobija samo "other"');
const metal = buildPrompt({ ...form, steps: form.steps.map((s) => ({ ...s, fields: s.fields.map((f) => (f.id === 'metal' ? { ...f, writeIn: true } : f)) })) }, { type: 'grillz', style: 'top6', metal: 'other', metal__more: 'Black rhodium' });
ok(/Metal: polished black rhodium/.test(metal), 'Other na metalu postaje metal');

ok(choiceNote({ id: 'grillz_grill_cut', label: 'Cut' }, { label: 'Weed Cut' }).includes('upwards leaf'), 'Weed Cut ima Rickyjev opis');
ok(choiceNote({ id: 'stone_setting', label: 'Stone setting' }, { label: 'Invisible' }).includes('no visible prongs'), 'Invisible setting ima opis');
ok(choiceNote({ id: 'grillz_grill_cut', label: 'Cut' }, { label: 'Weed Cut', note: 'svoj' }) === 'svoj', 'zlatareva napomena ima prednost');
const cutPrompt = buildPrompt({ ...form, steps: form.steps.map((s) => ({ ...s, fields: s.fields.map((f) => (f.id === 'grill_cut' ? { ...f, options: [{ value: 'weed-cut', label: 'Weed Cut' }] } : f)) })) }, { type: 'grillz', style: 'top6', metal: 'yellow-gold', grill_cut: 'weed-cut' });
ok(cutPrompt.includes('upwards leaf cut pattern'), 'opis reza ide u prompt');

const fams = metalArt('grillz_grill_cut', 'Weed Cut').grillz || {};
ok(fams.yellow && fams.white && fams.rose, 'Weed Cut ima sliku u sva tri metala');
const lib = withArt({ id: 'grillz_grill_cut', label: 'Cut' }, { value: 'weed-cut', label: 'Weed Cut', image: '/library/options/cut/weed-cut.webp' });
ok(lib.metalArt?.grillz?.rose?.includes('/grillz/rose/'), 'slika iz biblioteke dobija boje metala');
const own = withArt({ id: 'grillz_grill_cut', label: 'Cut' }, { value: 'weed-cut', label: 'Weed Cut', image: '/media/forms/x.jpg' });
ok(!own.metalArt, 'zlatareva fotografija ostaje svoja');
const pave = withArt({ id: 'stone_setting', label: 'Stone setting' }, { value: 'prong', label: 'Pave', noImage: true });
ok(pave.metalArt?.grillz?.white && !pave.image, 'Pave bez opšte slike dobija grillz slike po metalu');
ok(Object.keys(metalArt('grillz_grill_cut', 'Polished').grillz || {}).length === 3 && Object.keys(metalArt('grillz_grill_cut', 'Solid').grillz || {}).length === 3, 'Polished i Solid');

if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Write-in, cut notes and metal art checks passed.');
