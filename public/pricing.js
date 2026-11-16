// Kalkulator cijene za portal zlatara (District 16.11.2026): (a) procjena po izabranim specifikacijama i
// (b) "middle ground": najbliže specifikacije koje stanu u budžet, polazeći od izabranih.
// Računa ISKLJUČIVO iz tabele cijena koju zlatar sam unese (cijena metala se stalno mijenja); bez tabele nema broja.
// Ključevi tabele su natpisi izbora malim slovima (isti kroz sve forme), pokrivenost je accents / half / full.

// Početne cijene (16.11.2026) dok zlatar ne upiše svoje: metal po današnjoj berzi (zlato $124/g čisto, platina $47/g,
// srebro $1,5/g), a rad i kamenje po zubu podešeni da pogode dvije prave Districtove ponude:
// 16 zuba 10K potpuno okovano moissanitom ~ $15.000 i 20 zuba 10K natural akcenti ~ $13.000. Zlatar mijenja sve.
export const SUGGESTED_PRICING = {
  goldSpot: 124, markup: 30,
  metals: { platinum: 50, silver: 2, 'sterling silver': 2, 'dental gold': 45 },
  grams: { grillz: 2, pendant: 12, ring: 6, chain: 25, bracelet: 20, earrings: 4 },
  labor: { grillz: 100, pendant: 250, ring: 200, chain: 150, bracelet: 150, earrings: 120 },
  stones: {
    moissanite: { accents: 120, half: 300, full: 520 },
    'lab-grown diamonds': { accents: 200, half: 500, full: 900 },
    'natural diamonds': { accents: 300, half: 750, full: 1400 },
    default: { accents: 200, half: 500, full: 900 },
  },
  cuts: { polished: 0, solid: 0, 'open face': 15, 'diamond cut': 25, 'rose cut': 35, 'nugget cut': 25, 'perm cut': 15, 'weed cut': 30, 'pineapple cut': 30, 'starburst cut': 30, 'diamond cut n dust': 35 },
};
export const PURITY = { '10k': 10 / 24, '14k': 14 / 24, '18k': 18 / 24, '22k': 22 / 24, '24k': 1 };
export const LEVELS = ['accents', 'half', 'full'];
export const PIECES = ['grillz', 'pendant', 'chain', 'ring', 'bracelet', 'earrings', 'watch'];
export const key = (s) => String(s ?? '').trim().toLowerCase();
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
export { money };

// "$2,500 - $5,000", "Under $1,500", "$20,000+", "2k-5k" -> { low, high } (high = Infinity za "+").
export function parseBudget(label) {
  const t = String(label || '');
  const nums = [...t.matchAll(/(\d[\d,.]*)\s*(k\b)?/gi)].map((m) => parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1)).filter((n) => n >= 50);
  if (!nums.length) return null;
  const open = /\+|\bover\b|\babove\b|\band up\b/i.test(t);
  const under = /\bunder\b|\bup to\b|\bbelow\b/i.test(t);
  return { low: under ? 0 : Math.min(...nums), high: open ? Infinity : Math.max(...nums) };
}

// Cijena metala po gramu: upisana za taj metal (i karat), inače zlato = cijena čistog zlata po gramu x finoća karata.
export function metalPerGram(pricing, metal, karat) {
  const m = key(metal);
  const own = pricing?.metals?.[`${m}|${key(karat)}`] ?? pricing?.metals?.[m];
  if (num(own)) return num(own);
  const purity = PURITY[key(karat)];
  if (/gold|two.?tone/.test(m) && !/dental/.test(m) && num(pricing?.goldSpot) && purity) return pricing.goldSpot * purity;
  return null;
}

// spec: { type, metal, karat, stones, coverage, cut, units } (natpisi; units = broj zuba kod grillza, inače 1).
// Vraća { total, lines, missing } ; total je null dok nešto što je potrebno nije upisano.
export function estimate(pricing, spec) {
  const missing = [];
  const lines = [];
  const units = spec.type === 'grillz' ? Math.max(1, spec.units || 0) : 1;
  const per = spec.type === 'grillz' ? ' per tooth' : '';
  const grams = num(pricing?.grams?.[spec.type]);
  const ppg = metalPerGram(pricing, spec.metal, spec.karat);
  if (!grams) missing.push(`grams${per} for ${spec.type}`);
  if (!ppg) missing.push(`price per gram of ${spec.metal || 'the metal'}${spec.karat ? ` ${spec.karat}` : ''}`);
  if (grams && ppg) lines.push({ label: `Metal: ${+(grams * units).toFixed(1)} g × ${money(ppg)}/g`, amount: grams * units * ppg });
  const labor = num(pricing?.labor?.[spec.type]);
  if (labor) lines.push({ label: `Labor${units > 1 ? `: ${units} × ${money(labor)}` : ''}`, amount: labor * units });
  else missing.push(`labor${per} for ${spec.type}`);
  if (spec.stones && spec.coverage) {
    const s = num(pricing?.stones?.[key(spec.stones)]?.[spec.coverage]);
    if (s) lines.push({ label: `Stones: ${spec.stones}, ${spec.coverage}${units > 1 ? ` × ${units}` : ''}`, amount: s * units });
    else missing.push(`${spec.stones} (${spec.coverage})${per}`);
  }
  if (spec.cut) {
    const c = pricing?.cuts?.[key(spec.cut)];
    if (num(c)) lines.push({ label: `Cut: ${spec.cut}${units > 1 ? ` × ${units}` : ''}`, amount: num(c) * units });
  }
  if (missing.length) return { total: null, lines, missing };
  const sub = lines.reduce((n, l) => n + l.amount, 0);
  const markup = Number(pricing?.markup) > 0 ? Number(pricing.markup) : 0;
  if (markup) lines.push({ label: `Markup ${markup}%`, amount: (sub * markup) / 100 });
  return { total: sub * (1 + markup / 100), lines, missing };
}

// Middle ground: korak po korak najmanje vidljive izmjene dok cijena ne stane u gornju granicu budžeta.
// Redoslijed: vrsta kamena (jeftinija), karat (niži), pokrivenost (manja), metal (jeftiniji, npr. dental gold, bez kamenja).
// choices: izbori koje forma nudi { stones: [natpisi], karats: [...], coverages: ['accents','half','full'], metals: [...] }.
export function middleGround(pricing, spec, budgetHigh, choices = {}) {
  const start = estimate(pricing, spec);
  if (start.total == null || !Number.isFinite(budgetHigh)) return null;
  if (start.total <= budgetHigh) return { spec, total: start.total, changes: [], fits: true };
  let cur = { ...spec };
  let total = start.total;
  const changes = [];
  const priced = (s) => estimate(pricing, s).total;
  const steps = [
    () => cur.stones && (choices.stones || []).filter((x) => key(x) !== key(cur.stones)).map((x) => ({ ...cur, stones: x })),
    () => cur.karat && (choices.karats || []).filter((x) => PURITY[key(x)] && PURITY[key(x)] < (PURITY[key(cur.karat)] || 0)).map((x) => ({ ...cur, karat: x })),
    () => cur.coverage && LEVELS.slice(0, LEVELS.indexOf(cur.coverage)).filter((x) => !choices.coverages || choices.coverages.includes(x)).map((x) => ({ ...cur, coverage: x })),
    () => (choices.metals || []).filter((x) => key(x) !== key(cur.metal)).map((x) => (/dental/i.test(x) ? { ...cur, metal: x, karat: '', stones: '', coverage: '' } : { ...cur, metal: x })),
  ];
  const label = { stones: 'Stones', karat: 'Karat', coverage: 'How iced', metal: 'Metal' };
  for (const step of steps) {
    if (total <= budgetHigh) break;
    // Najbliži izbor koji stane, a ako nijedan ne stane, najjeftiniji (pa idući korak nastavlja od njega).
    const opts = (step() || []).map((s) => ({ s, t: priced(s) })).filter((o) => o.t != null && o.t < total);
    if (!opts.length) continue;
    const fit = opts.filter((o) => o.t <= budgetHigh).sort((a, b) => b.t - a.t)[0] || opts.sort((a, b) => a.t - b.t)[0];
    for (const f of ['stones', 'karat', 'coverage', 'metal']) if (key(fit.s[f]) !== key(cur[f])) changes.push({ what: label[f], from: cur[f] || 'none', to: fit.s[f] || 'none' });
    cur = fit.s;
    total = fit.t;
  }
  return { spec: cur, total, changes, fits: total <= budgetHigh };
}
