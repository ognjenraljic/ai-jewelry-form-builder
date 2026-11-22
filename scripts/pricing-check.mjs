// Kalkulator cijene (portal): procjena iz tabele zlatara, middle ground u budžet, bez tabele nema broja.
//   node scripts/pricing-check.mjs
import { estimate, middleGround, parseBudget, metalPerGram, DISTRICT_GRILLZ, stoneLayout, leadSpecFrom, dimKey } from '../public/pricing.js';

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

// ---------- 22.11.2026: moissanite po zubu i kamenje po površini ----------
{
  const P2 = { grillz: { ...DISTRICT_GRILLZ, iced: { ...DISTRICT_GRILLZ.iced, moissanite: { '10k': 300, '14k': 400, silver: 150 } } } };
  const sp = { type: 'grillz', metal: 'White Gold', karat: '14K', stones: 'Moissanite', coverage: 'full', teeth: 'T3,T4,T5,T6,T7,T8,B3,B4,B5,B6,B7,B8', units: 12 };
  const e2 = estimate(P2, sp);
  ok(e2.total === 12 * 400 + DISTRICT_GRILLZ.molding.metal, `moissanite red u tabeli zuba: 12 × $400 + molding = ${e2.total}`);
  ok(estimate({ grillz: DISTRICT_GRILLZ }, sp).lines[0].label.startsWith('Moissanite pave set'), 'bez moissanite reda ostaje račun preko seta');
  const e18 = estimate(P2, { ...sp, karat: '18K' });
  ok(e18.total != null && /14K/.test(e18.lines[0].label), '18K moissanite = 14K po zubu + razlika metala');
}
{
  const chain = stoneLayout({ type: 'chain', lengthIn: 20, widthMm: 10, coverage: 'full' });
  ok(chain.d === 1.8 && chain.count > 800 && chain.count < 1200 && chain.ct > 18 && chain.ct < 30, `lanac 20" × 10 mm fully iced: ${chain.count} kamenova, ${chain.ct} ct`);
  const half = stoneLayout({ type: 'chain', lengthIn: 20, widthMm: 10, coverage: 'half' });
  ok(Math.abs(half.count - chain.count / 2) <= 1, 'half iced = pola kamenova');
  ok(stoneLayout({ type: 'chain', lengthIn: 24, widthMm: 10, coverage: 'full' }).count > chain.count, 'duži lanac = više kamenova');
  ok(stoneLayout({ type: 'ring', ringSize: 12, coverage: 'full' }).count > stoneLayout({ type: 'ring', ringSize: 6, coverage: 'full' }).count, 'veći prsten = više kamenova');
  const w = stoneLayout({ type: 'watch', caseMm: 40, coverage: 'full' });
  const wl = stoneLayout({ type: 'watch', caseMm: 40, coverage: 'full', band: 'Leather strap' });
  ok(w.ct > 12 && w.ct < 25 && wl.count < w.count / 2, `sat 40 mm bust-down ${w.ct} ct, kožni kaiš bez narukvice ${wl.ct} ct`);
  const PS = { goldSpot: 100, grams: { chain: 25, ring: 6 }, labor: { chain: 150, ring: 200 }, stones: { 'lab-grown diamonds': { ct: 150, center: 400 }, 'natural diamonds': { ct: 600, center: 4000 }, default: { ct: 150 } }, setting: 2 };
  const ec = estimate(PS, { type: 'chain', metal: 'Yellow Gold', karat: '14K', stones: 'Lab-grown diamonds', coverage: 'full', lengthIn: 20, widthMm: 10 });
  const stoneLine = ec.lines.find((x) => x.label.startsWith('Stones'));
  const setLine = ec.lines.find((x) => x.label.startsWith('Setting'));
  ok(Math.abs(stoneLine.amount - chain.ct * 150) < 0.01 && setLine.amount === chain.count * 2, 'kamenje = karati × $/ct + ugradnja po kamenu');
  const vvs = estimate(PS, { type: 'ring', metal: 'Yellow Gold', karat: '14K', stones: 'Natural diamonds', clarity: 'VVS', coverage: 'half', ringSize: 9, centerCt: 1 });
  ok(vvs.lines.some((x) => /^Center stone: 1 ct × \$6,000\/ct/.test(x.label)), 'centralni kamen 1 ct prirodni VVS = $4,000 × 1.5');
  ok(estimate(PS, { type: 'ring', metal: 'Yellow Gold', karat: '14K', stones: 'Moissanite', coverage: 'full' }).missing.some((m) => /per carat/.test(m)), 'bez cijene po karatu: piše šta fali');
  // Veličina iz odgovora: sirovi ključ forme (portal) i očišćeni (server) daju isto.
  const fs = { type: [{ value: 'chain', label: 'Chain' }], metal: [], karat: [], stones: [], coverage: [], clarity: [], budget: [], cut: [],
    dims: { length: [{ value: '20', label: '20"' }], width: [{ value: '10-mm', label: '10 mm' }] } };
  const raw = leadSpecFrom(fs, { type: 'chain', chain_length: '20', chain_width: '10-mm' });
  const clean = leadSpecFrom(fs, { type: 'chain', d_length: '20', d_width: '10-mm' });
  ok(raw.spec.lengthIn === 20 && raw.spec.widthMm === 10 && clean.spec.lengthIn === 20 && clean.spec.widthMm === 10, 'dužina i širina lanca iz odgovora');
  ok(dimKey('ring_ring_size') === 'ring_size' && dimKey('earrings_stone_size_for_stud_and_drop_ea') === 'stone_size' && dimKey('grillz_grill_cut') === null, 'ključevi veličine bez prefiksa komada');
}
// ---------- 22.11.2026: Districtovi izbori leda po dijelu sata, izbori po komadu ----------
{
  const { coverLabel, quoteBody, iceKey } = await import('../public/pricing.js');
  const o = (value, label) => ({ value, label });
  const only = { grillz: ['full', 'none'], earrings: ['full', 'none'], bracelet: ['full', 'none'], chain: ['full', 'none'], ring: ['full', 'none'], pendant: ['full', 'none'] };
  const fs = { type: [o('grillz', 'Grillz'), o('watch', 'Watch')], metal: [o('yellow-gold', 'Yellow Gold'), o('silver', 'Silver')], karat: [o('14K', '14K')],
    stones: [o('moissanite', 'Moissanite'), o('lab', 'Lab-grown diamonds')], clarity: [], budget: [o('b', '$5,000 - $10,000')], cut: [],
    coverage: [o('full', 'Fully iced'), o('half', 'Bezel iced-out'), o('face-iced-out', 'Face iced-out'), o('bracelet-iced-out', 'Bracelet iced-out'), o('face-bezel-iced-out', 'Face + Bezel iced-out'), o('none', 'None')],
    dims: { case_size: [o('40-mm', '40 mm')], band: [o('bracelet', 'Metal bracelet')] }, per: { coverage: only } };
  const g = leadSpecFrom(fs, { type: 'grillz', metal: 'silver', coverage: 'full', stones: 'moissanite', teeth: 'T5,T6' });
  ok(JSON.stringify(g.opts.coverage) === '[["full","Fully iced"]]', 'grillz nudi samo Fully iced (Bezel iced-out je samo za sat)');
  const w = (cov) => leadSpecFrom(fs, { type: 'watch', metal: 'yellow-gold', karat: '14K', coverage: cov, stones: 'lab', budget: 'b', watch_case_size: '40-mm', watch_band: 'bracelet' });
  const fb = w('face-bezel-iced-out');
  ok(fb.opts.coverage.length === 5 && fb.spec.coverage === 'half' && fb.spec.ice === 'face-bezel-iced-out' && fb.spec.iceParts === 'bezel,face', 'sat: Face + Bezel = dijelovi bezel i brojčanik');
  ok(coverLabel(iceKey(fb.spec), fb) === 'Face + Bezel iced-out' && quoteBody(fb, fb.spec, { total: 1, lines: [] }).ice === 'Face + Bezel iced-out', 'poruka i oznake pišu tačan naziv izbora');
  const n = (cov) => stoneLayout(w(cov).spec).count;
  ok(n('half') < n('face-bezel-iced-out') && n('face-iced-out') < n('face-bezel-iced-out') && n('bracelet-iced-out') > n('half') && n('full') > n('face-bezel-iced-out'), `sat: bezel ${n('half')}, face ${n('face-iced-out')}, face+bezel ${n('face-bezel-iced-out')}, bracelet ${n('bracelet-iced-out')}, full ${n('full')} kamenova`);
  ok(w('half').spec.ice === 'half' && coverLabel(iceKey(w('half').spec), w('half')) === 'Bezel iced-out', '"Bezel iced-out" (vrijednost half) ide kao bezel, ne kao pola sata');
  const PS = { goldSpot: 110, grams: { watch: 120 }, labor: { watch: 300 }, stones: { 'lab-grown diamonds': { ct: 150 }, moissanite: { ct: 40 } }, setting: 1.5 };
  const full = w('full');
  const mg = middleGround(PS, full.spec, 9000, full.choices);
  ok(mg && mg.total < estimate(PS, full.spec).total && (mg.spec.ice || mg.spec.coverage), `middle ground za sat bira jeftiniji izbor (${mg?.spec.ice || mg?.spec.coverage}, ${mg?.spec.stones}, $${Math.round(mg?.total)})`);
}
// ---------- 22.11.2026: žive cijene metala, Live / Custom ----------
{
  const { applyMarket } = await import('../public/pricing.js');
  const mk = { gold: 113.78, silver: 1.32, platinum: 41.35 };
  const base = { goldSpot: 124, metals: { silver: 2, 'sterling silver': 2, platinum: 50, 'dental gold': 45 } };
  const live = applyMarket(base, mk);
  ok(live.goldSpot === 113.78 && live.metals.silver === 1.32 && live.metals['sterling silver'] === 1.22 && live.metals.platinum === 41.35, 'Live: zlato, srebro, sterling (92,5%) i platina iz tržišta');
  ok(live.metals['dental gold'] === 45 && base.goldSpot === 124, 'dental gold ostaje zlatarev, original se ne mijenja');
  const custom = applyMarket({ ...base, live: { gold: false, silver: true, platinum: false } }, mk);
  ok(custom.goldSpot === 124 && custom.metals.platinum === 50 && custom.metals.silver === 1.32, 'Custom: zlatarev broj ostaje za taj metal');
  ok(applyMarket(base, { gold: null }).goldSpot === 124 && applyMarket(base, null) === base, 'bez žive cijene računa sa zlatarevim brojem');
  ok(applyMarket({ goldSpot: 100 }, { silver: 1.5 }).metals.silver === 1.5, 'srebro se doda i kad ga zlatar nije upisao');
}
if (fails) { console.log(`${fails} FAIL`); process.exit(1); }
console.log('Pricing checks passed.');
