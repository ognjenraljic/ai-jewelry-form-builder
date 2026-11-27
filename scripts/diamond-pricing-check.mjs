// Districtova tabela dijamanata i cjenovnik sata (27.11.2026), čista provjera kalkulatora (bez servera).
//   node scripts/diamond-pricing-check.mjs
import { estimate, middleGround, SUGGESTED_PRICING, DISTRICT_DIAMOND_CHART, watchFlat, diamondRows, rowByMm, rowByCt, stoneLayout } from '../public/pricing.js';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const pr = { ...SUGGESTED_PRICING, metals: { ...SUGGESTED_PRICING.metals, '14k yellow gold': 70 }, markup: 30 };
const line = (e, re) => e.lines.find((l) => re.test(l.label));

// 1) Sat, moissanite: gotov cjenovnik
const w = (o) => estimate(pr, { type: 'watch', metal: 'Stainless steel', stones: 'Moissanite', caseMm: 40, ...o });
ok(w({ coverage: 'full' }).total === 2500, `sat moissanite fully iced = $2500 (${w({ coverage: 'full' }).total})`);
ok(w({ coverage: 'half' }).total === 1400, `sat moissanite half iced = $1400 (${w({ coverage: 'half' }).total})`);
ok(w({ coverage: 'half', iceParts: 'face' }).total === 800, 'samo face = $800');
ok(w({ coverage: 'half', iceParts: 'bezel' }).total === 500, 'samo bezel = $500');
ok(w({ coverage: 'half', iceParts: 'bracelet' }).total === 1200, 'samo bracelet = $1200');
ok(w({ coverage: 'half', iceParts: 'face,bezel' }).total === 1300, 'face + bezel = $1300');
ok(w({ coverage: 'full', iceParts: 'bezel,face,bracelet' }).total === 2500, 'sva tri = $2500 (ne 2500 zbir 2500, nego All 3)');
ok(!line(w({ coverage: 'full' }), /markup/i) && !line(w({ coverage: 'full' }), /^Labor/), 'bez markupa i bez posebnog rada (cijena sve uključuje)');
ok(watchFlat({}, { type: 'watch', stones: 'Moissanite', coverage: 'full' }) === null, 'bez cjenovnika sata nema gotove cijene');

// 2) Sat, lab i natural: po tabeli dijamanata + rad sata
const wl = w({ stones: 'Lab-grown diamonds', coverage: 'full' });
const lay = stoneLayout({ type: 'watch', caseMm: 40, coverage: 'full' });
const row = rowByMm(diamondRows(pr), lay.d);
ok(line(wl, /diamond chart/) && Math.round(line(wl, /diamond chart/).amount) === Math.round(lay.count * row.lab), `sat lab: ${lay.count} kamenova × $${row.lab} (${row.mm} mm) iz tabele`);
ok(!line(wl, /Pavé setting/) && line(wl, /Setting and labor/)?.amount === 2500 && !line(wl, /^Labor/), 'sat sa dijamantima: ugradnja i rad iz cjenovnika sata ($2500 za fully), bez pavé $15 po kamenu');
ok(Math.round(wl.total) === Math.round(lay.count * row.lab + 2500), `sat lab fully = kamenje + $2500 (${Math.round(wl.total)})`);
const wlh = w({ stones: 'Lab-grown diamonds', coverage: 'half' });
ok(line(wlh, /Setting and labor/)?.amount === 1400, `sat lab half: rad $1400 (ukupno ${Math.round(wlh.total)})`);
const wlp = w({ stones: 'Lab-grown diamonds', coverage: 'half', iceParts: 'bezel' });
ok(line(wlp, /Setting and labor/)?.amount === 500, `sat lab samo bezel: rad $500 (ukupno ${Math.round(wlp.total)})`);
const wn = w({ stones: 'Natural diamonds', coverage: 'full' });
ok(wn.total > wl.total * 3, `sat natural (${Math.round(wn.total)}) mnogo skuplji od lab (${Math.round(wl.total)})`);

// 3) Prsten: centralni kamen po karatu + pavé po tabeli
const ring = estimate(pr, { type: 'ring', metal: '14K Yellow Gold', karat: '', stones: 'Natural diamonds', coverage: 'half', ringSize: 8, centerCt: 1 });
const r1 = rowByCt(diamondRows(pr), 1);
ok(line(ring, /Center stone/) && line(ring, /Center stone/).amount === r1.natural && r1.mm === 6.2, `centralni 1 ct = 6.2 mm, $${r1.natural}`);
ok(line(ring, /Prong setting/) && line(ring, /Prong setting/).amount === Math.max(r1.prong, 50), 'prong ugradnja centralnog kamena');
const vvs = estimate(pr, { type: 'ring', metal: '14K Yellow Gold', stones: 'Natural diamonds', coverage: 'half', ringSize: 8, centerCt: 1, clarity: 'VVS1' });
ok(Math.round(line(vvs, /Center stone/).amount) === Math.round(r1.natural * 1.2), 'VVS +20% na cijenu iz tabele');
const si2 = estimate(pr, { type: 'ring', metal: '14K Yellow Gold', stones: 'Natural diamonds', coverage: 'half', ringSize: 8, centerCt: 1, clarity: 'SI2' });
ok(Math.round(line(si2, /Center stone/).amount) === Math.round(r1.natural * 0.85), 'SI2 -15%');
const plat = estimate(pr, { type: 'ring', metal: 'Platinum', stones: 'Lab-grown diamonds', coverage: 'full', ringSize: 8 });
ok(/platinum \+25%/.test(line(plat, /Pavé setting/).label), 'platina +25% na rad ugradnje');

// 4) Minimum rada po komadu
const cheap = { ...pr, diamonds: { on: true, chart: Object.fromEntries(Object.entries(DISTRICT_DIAMOND_CHART).map(([k, v]) => [k, { ...v, pave: 1 }])) } };
const studs = estimate(cheap, { type: 'earrings', metal: '14K Yellow Gold', stones: 'Lab-grown diamonds', coverage: 'accents', earSize: 'small' });
ok(/minimum \$75/.test(line(studs, /Pavé setting/).label) && line(studs, /Pavé setting/).amount === 75, 'mali iznos rada: pavé minimum $75 po komadu');

// 5) Moissanite van sata i isključena tabela ostaju po karatu
const pm = estimate(pr, { type: 'pendant', metal: '14K Yellow Gold', stones: 'Moissanite', coverage: 'full', sizeIn: 2 });
ok(/\/ct/.test(line(pm, /^Stones/).label), 'moissanite privjesak i dalje po $/ct');
const off = estimate({ ...pr, diamonds: { ...pr.diamonds, on: false } }, { type: 'pendant', metal: '14K Yellow Gold', stones: 'Lab-grown diamonds', coverage: 'full', sizeIn: 2 });
ok(/\/ct/.test(line(off, /^Stones/).label), 'isključena tabela = staro računanje po karatu');

// 6) Fits the budget radi i sa novim računom (lab -> moissanite na satu)
const mg = middleGround(pr, { type: 'watch', metal: 'Stainless steel', stones: 'Lab-grown diamonds', coverage: 'full', caseMm: 40 }, 3000, { stones: ['Lab-grown diamonds', 'Moissanite'], coverages: ['accents', 'half', 'full'] });
ok(mg && mg.total <= 3000, `Fits the budget nađe sat do $3000 (${mg && Math.round(mg.total)}: ${mg && mg.changes.map((c) => c.label || c).join(', ')})`);
ok(Object.keys(DISTRICT_DIAMOND_CHART).length === 91 && DISTRICT_DIAMOND_CHART.m30.natural === 290 && DISTRICT_DIAMOND_CHART.m100.lab === 13600, 'tabela: 91 red, 3.0 mm natural $290, 10 mm lab $13,600');

console.log(fails ? `${fails} FAILED` : 'Diamond pricing checks passed.');
process.exit(fails ? 1 : 0);
