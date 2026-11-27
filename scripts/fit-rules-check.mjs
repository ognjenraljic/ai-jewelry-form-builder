// Pravila opcije bliže budžetu (District 27.11.2026): boja metala se ne mijenja (žuto -> dental gold, nikad srebro),
// led ostaje (prirodni -> lab / moissanite, tek onda jedan nivo manje leda), nikad "bez kamenja".
//   node scripts/fit-rules-check.mjs
import { middleGround, metalTone, SUGGESTED_PRICING as P } from '../public/pricing.js';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const ch = { stones: ['Moissanite', 'Lab-grown diamonds', 'Natural diamonds'], karats: ['10K', '14K', '18K'], clarities: ['SI', 'VS', 'VVS', 'Flawless'], coverages: ['accents', 'half', 'full'],
  metals: ['Yellow Gold', 'White Gold', 'Rose Gold', 'Platinum', '925 Silver', '925 Silver White Gold', 'Dental Gold'] };
const teeth = [...Array(10)].map((_, i) => `T${i + 1}`).concat([...Array(10)].map((_, i) => `B${i + 1}`)).join(',');
const g = (o) => ({ type: 'grillz', units: 20, teeth, style: 'set', karat: '', stones: '', clarity: '', coverage: '', ice: '', iceParts: '', ...o });
const what = (r, w) => r.changes.find((c) => c.what === w);

ok(metalTone('Yellow Gold') === 'yellow' && metalTone('Dental Gold') === 'yellow' && metalTone('925 Silver White Gold') === 'white' && metalTone('925 Silver Yellow Gold') === 'yellow' && metalTone('Rose Gold') === 'rose', 'boje metala');

let r = middleGround(P, g({ metal: '925 Silver White Gold', stones: 'Natural diamonds', clarity: 'Flawless', coverage: 'full' }), 1500, ch);
ok(!what(r, 'Metal') && what(r, 'Stones')?.to === 'Moissanite' && !what(r, 'How iced') && !what(r, 'Clarity'), `bijeli metal, prirodni Flawless, fully iced: samo moissanite, metal i led ostaju (${JSON.stringify(r.changes)})`);

r = middleGround(P, g({ metal: 'Yellow Gold', karat: '14K', stones: 'Natural diamonds', clarity: 'VVS', coverage: 'full' }), 1500, ch);
ok(!what(r, 'Metal') && what(r, 'How iced')?.to === 'half' && r.spec.coverage, `žuto zlato iced, daleko iznad: bez promjene boje i bez dental golda (dental ne može iced), led najviše jedan nivo manje (${JSON.stringify(r.changes)})`);

r = middleGround(P, g({ metal: 'Yellow Gold', karat: '14K' }), 800, ch);
ok(what(r, 'Metal')?.to === 'Dental Gold' && !ch.metals.filter((m) => metalTone(m) !== 'yellow').includes(r.spec.metal), `žuto zlato bez leda: dental gold, nikad srebro (${JSON.stringify(r.changes)})`);

r = middleGround(P, g({ metal: 'White Gold', karat: '18K' }), 1400, ch);
ok(metalTone(r.spec.metal) === 'white', `bijelo zlato: ostaje bijelo (${r.spec.metal})`);

r = middleGround(P, g({ metal: 'Rose Gold', karat: '18K' }), 800, ch);
ok(metalTone(r.spec.metal) === 'rose', `rose zlato: ostaje rose (${r.spec.metal}, ${r.spec.karat})`);

for (const m of ['Yellow Gold', 'White Gold', '925 Silver']) {
  r = middleGround(P, g({ metal: m, karat: /gold/i.test(m) ? '14K' : '', stones: 'Lab-grown diamonds', coverage: 'full' }), 300, ch);
  ok(r.spec.coverage && r.spec.stones, `${m}, nemoguć budžet: i dalje iced sa kamenjem (${r.spec.coverage}, ${r.spec.stones})`);
}

console.log(fails ? `${fails} FAILED` : 'Fit rules checks passed.');
process.exit(fails ? 1 : 0);
