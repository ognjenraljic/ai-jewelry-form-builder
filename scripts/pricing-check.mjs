// Kalkulator cijene (portal): procjena iz tabele zlatara, middle ground u budžet, bez tabele nema broja.
//   node scripts/pricing-check.mjs
import { estimate, middleGround, parseBudget, metalPerGram, DISTRICT_GRILLZ } from '../public/pricing.js';

let fails = 0;
const ok = (c, name) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${name}`); if (!c) fails++; };
// Probna tabela (izmišljeni brojevi samo za provjeru računa, ne prave cijene).
const pricing = {
  goldSpot: 100, markup: 20,
  metals: { 'dental gold': 30, 'white gold': 70 },
  grams: { grillz: 2, ring: 6 }, labor: { grillz: 50, ring: 200 },
  stones: { moissanite: { accents: 20, half: 60, full: 120 }, 'natural diamonds': { accents: 100, half: 300, full: 600 }, default: { full: 150 } },
  cuts: { 'weed cut': 25 },
};
ok(Math.abs(metalPerGram(pricing, 'Yellow Gold', '14K') - 100 * 14 / 24) < 1e-9, 'zlato = cijena čistog zlata × finoća karata');
ok(metalPerGram(pricing, 'Dental Gold', '') === 30, 'dental gold ima svoju cijenu');
ok(metalPerGram({}, 'Yellow Gold', '14K') === null, 'bez tabele nema cijene metala');

// Komadi van grillza: metal po gramu + rad + kamenje + markup.
const ring = { type: 'ring', metal: 'Yellow Gold', karat: '14K', stones: 'Natural diamonds', coverage: 'full' };
const e = estimate(pricing, ring);
const expect = (6 * (100 * 14 / 24) + 200 + 600) * 1.2;
ok(Math.abs(e.total - expect) < 0.01, `procjena prstena = ${Math.round(e.total)} (metal + rad + kamenje + 20%)`);
ok(estimate({}, ring).total === null && estimate({}, ring).missing.length >= 2, 'prazna tabela: nema broja, piše šta fali');
ok(estimate(pricing, { ...ring, stones: 'default', coverage: 'full' }).total > 0, 'led bez izabranog kamena koristi Default red');

// Grillz po Districtovom cjenovniku (18.11.2026): svaki broj mora biti tačno njihov + molding.
const G = { grillz: DISTRICT_GRILLZ };
const row = (k, from, n) => Array.from({ length: n }, (_, i) => `${k}${from + i}`).join(',');
const set = (n) => `${row('T', 6 - n / 2, n)},${row('B', 6 - n / 2, n)}`;
const gz = (o) => estimate(G, { type: 'grillz', ...o });
const eq = (o, want, name) => { const r = gz(o); ok(r.total === want, `${name}: ${r.total} (treba ${want})`); return r; };
eq({ metal: 'Yellow Gold', karat: '10K', teeth: set(6) }, 1400 + 100, 'set 6x6 10K');
eq({ metal: 'White Gold', karat: '14K', teeth: set(8) }, 2500 + 100, 'set 8x8 14K');
eq({ metal: 'Rose Gold', karat: '18K', teeth: set(10) }, 6200 + 100, 'set 10x10 18K');
eq({ metal: 'Silver', karat: '', teeth: set(6) }, 700 + 100, 'set 6x6 srebro (Silver u formi)');
eq({ metal: 'Yellow Gold', karat: '925 Silver', teeth: set(8) }, 900 + 100, 'karat 925 Silver = srebrna kolona');
eq({ metal: 'Platinum', karat: '', teeth: set(10) }, 2400 + 100, 'set 10x10 platina');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: row('T', 3, 6) }, 680 + 100, 'samo gore 6 zuba 10K');
eq({ metal: 'Yellow Gold', karat: '14K', teeth: 'B5,B6' }, 520 + 100, 'dole 2 zuba zajedno 14K');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: 'T3,T8', style: 'fangs' }, 440 + 100, '2 fangs & backbar 10K');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: row('T', 3, 5) }, 680 + 100, '5 zuba = cijena za 6 (sljedeća veličina)');
eq({ metal: 'Silver', karat: '', teeth: 'T5,T6' }, 230 + 100, 'srebro nema 2 zuba: cijena za 3');
eq({ metal: 'Platinum', karat: '', teeth: row('T', 4, 4) }, 725 + 100, 'platina počinje od 6 zuba');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: `${row('T', 2, 8)},${row('B', 3, 6)}` }, (1800 + 1400) / 2 + 100, '8 gore + 6 dole = pola 8x8 + pola 6x6');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: `${row('T', 4, 4)},${row('B', 4, 4)}` }, 450 * 2 + 100, '4 + 4 nije set: dva reda po 4');
eq({ metal: 'Dental Gold', karat: '', teeth: set(6) }, 350 + 50, 'dental gold set 6 on 6 + molding $50');
eq({ metal: 'Dental Gold', karat: '', teeth: row('B', 2, 8), cut: 'Rose Cut' }, 200 + 8 * 5 + 50, 'dental 8 dole + Rose Cut $5 po zubu');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: set(6), cut: 'Rose Cut' }, 1400 + 12 * 15 + 100, 'zlato + Rose Cut $15 po zubu');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: set(6), cut: 'Polished' }, 1400 + 100, 'Polished bez doplate');
const weed = eq({ metal: 'Yellow Gold', karat: '10K', teeth: set(6), cut: 'Weed Cut' }, 1400 + 100, 'Weed Cut nije na listi: ne ulazi');
ok(weed.notes.some((x) => /Weed Cut/.test(x)), 'Weed Cut: napomena da nema cijenu');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: 'T5', coverage: 'full', stones: 'Lab-grown diamonds' }, 500 + 100, 'lab dijamant 1 zub 10K');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: set(8), coverage: 'full', stones: 'Lab-grown diamonds' }, 16 * 500 + 100, '16 zuba lab 10K = $8.000 + molding');
eq({ metal: 'Yellow Gold', karat: '14K', teeth: 'T5', coverage: 'full', stones: 'Natural diamonds', clarity: 'SI' }, 1000 + 100, 'natural SI1 14K po zubu');
eq({ metal: 'Silver', karat: '', teeth: 'T5', coverage: 'full', stones: 'Natural diamonds', clarity: 'VVS' }, 900 + 100, 'natural VVS1 srebro po zubu');
eq({ metal: 'Silver', karat: '', teeth: set(8), coverage: 'full', stones: 'Moissanite' }, 1250 + 100, 'moissanite srebrni pave set 8x8');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: set(6), coverage: 'full', stones: 'Moissanite' }, 1200 + (1400 - 700) + 100, 'moissanite na 10K = srebrni set + razlika 10K i srebra');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: set(6), coverage: 'half', stones: 'Lab-grown diamonds' }, (1400 + 12 * 500) / 2 + 100, 'half iced = pola puta između običnog i okovanog');
eq({ metal: 'Yellow Gold', karat: '10K', teeth: set(6), coverage: 'accents', stones: 'Lab-grown diamonds' }, 1400 + (12 * 500 - 1400) / 4 + 100, 'accents = četvrtina puta od običnog do okovanog');
ok(gz({ metal: 'Yellow Gold', karat: '10K', teeth: '' }).total === null, 'bez zuba nema broja');
ok(estimate({}, { type: 'grillz', metal: 'Yellow Gold', karat: '10K', teeth: set(6) }).total === null, 'zlatar bez grillz cjenovnika: nema broja');
const spec = { type: 'grillz', metal: 'Yellow Gold', karat: '14K', stones: 'Natural diamonds', coverage: 'full', clarity: 'VVS', teeth: set(8) };

const b = parseBudget('$2,500 - $5,000');
ok(b.low === 2500 && b.high === 5000, 'budžet raspon');
ok(parseBudget('$20,000+').high === Infinity && parseBudget('Under $1,500').high === 1500, 'budžet + i Under');

const choices = { stones: ['Moissanite', 'Natural diamonds'], karats: ['10K', '14K', '18K'], coverages: ['accents', 'half', 'full'], metals: ['Yellow Gold', 'Dental Gold'] };
const mg = middleGround(G, spec, 12000, choices);
ok(mg && mg.fits && mg.total <= 12000, `middle ground stane u $12,000: ${Math.round(mg?.total)}`);
ok(mg.changes[0]?.what === 'Stones' && mg.changes[0]?.to === 'Moissanite', 'prvo jeftiniji kamen (moissanite umjesto dijamanata)');
const tight = middleGround(G, spec, 1500, choices);
ok(tight.changes.some((c) => c.what === 'Metal' && /dental/i.test(c.to)) || !tight.fits, 'kad ni to ne stane: dental gold (bez kamenja) ili javi da ne staje');
ok(middleGround(G, { ...spec, stones: '', coverage: '', karat: '10K', teeth: 'T5,T6' }, 5000, choices).changes.length === 0, 'kad već stane, nema izmjena');
if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Pricing checks passed.');
