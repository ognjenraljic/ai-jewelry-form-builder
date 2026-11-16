// Kalkulator cijene (portal): procjena iz tabele zlatara, middle ground u budžet, bez tabele nema broja.
//   node scripts/pricing-check.mjs
import { estimate, middleGround, parseBudget, metalPerGram } from '../public/pricing.js';

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

const spec = { type: 'grillz', metal: 'Yellow Gold', karat: '14K', stones: 'Natural diamonds', coverage: 'full', units: 16 };
const e = estimate(pricing, spec);
const expect = (2 * 16 * (100 * 14 / 24) + 50 * 16 + 600 * 16) * 1.2;
ok(Math.abs(e.total - expect) < 0.01, `procjena 16 zuba = ${Math.round(e.total)} (metal + rad + kamenje + 20%)`);
ok(estimate({}, spec).total === null && estimate({}, spec).missing.length >= 2, 'prazna tabela: nema broja, piše šta fali');
ok(estimate(pricing, { ...spec, stones: 'default', coverage: 'full' }).total > 0, 'led bez izabranog kamena koristi Default red');
ok(Math.abs(estimate(pricing, { type: 'grillz', metal: 'Yellow Gold', karat: '10K', cut: 'Weed Cut', units: 6 }).total - (2 * 6 * (100 * 10 / 24) + 50 * 6 + 25 * 6) * 1.2) < 0.01, 'rez se naplaćuje po zubu');

const b = parseBudget('$2,500 - $5,000');
ok(b.low === 2500 && b.high === 5000, 'budžet raspon');
ok(parseBudget('$20,000+').high === Infinity && parseBudget('Under $1,500').high === 1500, 'budžet + i Under');

const choices = { stones: ['Moissanite', 'Natural diamonds'], karats: ['10K', '14K', '18K'], coverages: ['accents', 'half', 'full'], metals: ['Yellow Gold', 'Dental Gold'] };
const mg = middleGround(pricing, spec, 5000, choices);
ok(mg && mg.fits && mg.total <= 5000, `middle ground stane u $5,000: ${Math.round(mg?.total)}`);
ok(mg.changes[0]?.what === 'Stones' && mg.changes[0]?.to === 'Moissanite', 'prvo jeftiniji kamen (moissanite umjesto dijamanata)');
const tight = middleGround(pricing, spec, 1500, choices);
ok(tight.changes.some((c) => c.what === 'Metal' && /dental/i.test(c.to)) || !tight.fits, 'kad ni to ne stane: dental gold (bez kamenja) ili javi da ne staje');
ok(middleGround(pricing, { ...spec, stones: 'Moissanite', coverage: 'accents', karat: '10K', units: 2 }, 5000, choices).changes.length === 0, 'kad već stane, nema izmjena');
if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Pricing checks passed.');
