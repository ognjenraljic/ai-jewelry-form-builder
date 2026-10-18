// Prompt iz šablona: napomene po opciji, ai:false pitanja, isključeni koraci, dodatni tekst.
import { fromTemplate } from '../src/forms.js';
import { buildPrompt } from '../src/prompt.js';
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

const g = fromTemplate('grillz', { id: 'g', brand: 'Northstar', clientId: 'n' });
g.steps.find((s) => s.id === 'fit').fields.push({ id: 'occasion', type: 'chips', label: 'Occasion', options: [{ value: 'party', label: 'Party' }], followup: 'text' });
let p = buildPrompt(g, { type: 'grillz', style: 'top8', metal: 'yellow-gold', karat: '14K', stones: 'moissanite', coverage: 'full', grill_cut: 'open-face', mold: 'yes', budget: '$2,500 - $5,000', occasion: 'party', occasion__more: 'my birthday' }, { style: { shape: 'top 8' } });
ok(p.includes('open face grill'), 'napomena opcije (open face) u promptu');
ok(!p.includes('molds') && !p.includes('2,500'), 'kalupi i budžet (ai:false) nisu u promptu');
ok(p.includes('Occasion: Party (customer adds: "my birthday")'), 'custom pitanje sa dodatnim tekstom');
ok(p.includes('ONE row'), 'grillz top 8 = jedan red');

const r = fromTemplate('ring', { id: 'r', brand: 'Northstar', clientId: 'n' });
p = buildPrompt(r, { type: 'ring', style: 'halo', center_shape: 'oval', carat: '1.5ct', metal: 'white-gold', karat: '18K', band: 'pave', stones: 'lab', engraving: 'SECRET', budget: 'x' }, { style: { shape: 'halo' } });
ok(p.includes('oval cut center stone') && p.includes('about 1.5 carat') && p.includes('pavé band'), 'ring: oblik, karat i traka kroz napomene');
ok(!p.includes('SECRET'), 'gravura iznutra (ai:false) nije u promptu');

const c = fromTemplate('custom-enquiry', { id: 'c', brand: 'Northstar', clientId: 'n' });
c.steps.find((s) => s.id === 'design').fields[0].options.push({ value: 'black-gold', label: 'Black Gold' });
c.steps.find((s) => s.id === 'design').fields.find((f) => f.id === 'clarity').enabled = false;
p = buildPrompt(c, { type: 'chain', style: 'cuban', metal: 'black-gold', karat: '14K', stones: 'lab', coverage: 'full', clarity: 'VVS' }, {});
ok(p.includes('polished black gold'), 'nova opcija metala ide po natpisu');
ok(!p.includes('exceptionally clear'), 'isključeno pitanje (clarity) se ignoriše');

const b = fromTemplate('blank', { id: 'b', brand: 'Northstar', clientId: 'n' });
p = buildPrompt(b, { type: 'custom', vision: 'a silver cufflink shaped like a compass' }, {});
ok(p.includes('custom piece of fine jewelry') && !p.includes('Metal:') && !p.includes('No stones'), 'prazna forma: bez metala i kamenja koji nisu pitani');

// Izbor zuba: tačni zubi imaju prednost nad stilom.
p = buildPrompt(g, { type: 'grillz', style: 'top8', teeth: 'T3,T4,T5,T6,T7,T8', metal: 'yellow-gold', karat: '14K', stones: 'none' }, { style: { shape: 'top 8' } });
ok(p.includes('Top row: exactly 6 teeth (upper), six front teeth, canine to canine') && p.includes('Exactly 6 teeth') && !p.includes('Exactly 8') && !p.includes('top 8'), 'zubi: Classic 6 pobjeđuje stil Top 8');
p = buildPrompt(g, { type: 'grillz', style: 'set', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', metal: 'yellow-gold', karat: '14K', stones: 'none' }, {});
ok(p.includes('both the top and the bottom row') && p.includes('Bottom row: exactly 6 teeth (lower)') && p.includes('Exactly 12 teeth'), 'zubi: 6 on 6');
p = buildPrompt(g, { type: 'grillz', style: 'top6', teeth: 'T5', metal: 'yellow-gold', karat: '14K', stones: 'none' }, {});
ok(p.includes('one-tooth grill') && p.includes("upper central incisor (viewer's left)") && !p.includes('ONE row'), 'zubi: jedan zub = jedna kapica');
p = buildPrompt(g, { type: 'grillz', style: 'top6', teeth: 'T3,T8', metal: 'yellow-gold', karat: '14K', stones: 'none' }, {});
ok(p.includes("upper canine (viewer's left), upper canine (viewer's right)"), 'zubi: dva očnjaka po imenu');
p = buildPrompt(c, { type: 'grillz', style: 'top6', teeth: 'B5,B6', metal: 'yellow-gold', karat: '14K', stones: 'none' }, {});
ok(p.includes('bottom (lower) row') && p.includes('both central incisors'), 'zubi u opštoj formi: donja dva');
