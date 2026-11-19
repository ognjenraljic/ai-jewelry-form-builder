// Kalkulator cijene za portal zlatara (District 16.11.2026): (a) procjena po izabranim specifikacijama i
// (b) "middle ground": najbliže specifikacije koje stanu u budžet, polazeći od izabranih.
// Računa ISKLJUČIVO iz tabele cijena koju zlatar sam unese (cijena metala se stalno mijenja); bez tabele nema broja.
// Ključevi tabele su natpisi izbora malim slovima (isti kroz sve forme), pokrivenost je accents / half / full.

// Početne cijene za komade van grillza (16.11.2026): metal po berzi (zlato $124/g čisto, platina $47/g, srebro $1,5/g),
// rad i kamenje po komadu. Zlatar mijenja sve.
// Grillz (18.11.2026) ide po Districtovom pravom cjenovniku (docs/district-price-list): gotove cijene po broju zuba i
// metalu, led po zubu, moissanite srebrni setovi, dodaci po zubu, molding. Te cijene su konačne (bez markupa).
// Ključevi kolona: 10k, 14k, 18k, silver, platinum. Redovi: broj zuba ("fangs" = 2 fangs & backbar).
export const GRILLZ_COLS = ['10k', '14k', '18k', 'silver', 'platinum'];
export const ICED_COLS = ['10k', '14k', 'silver'];
export const DISTRICT_GRILLZ = {
  sets: {
    6: { '10k': 1400, '14k': 1900, '18k': 3700, silver: 700, platinum: 1450 },
    8: { '10k': 1800, '14k': 2500, '18k': 4800, silver: 900, platinum: 1900 },
    10: { '10k': 2400, '14k': 3200, '18k': 6200, silver: 1200, platinum: 2400 },
    12: { '10k': 2900, '14k': 3800, '18k': 7400, silver: 1400, platinum: 2900 },
  },
  row: {
    fangs: { '10k': 440, '14k': 585, '18k': 750, silver: 250 },
    2: { '10k': 390, '14k': 520, '18k': 650 },
    3: { '10k': 420, '14k': 500, '18k': 670, silver: 230 },
    4: { '10k': 450, '14k': 620, '18k': 1050, silver: 300 },
    6: { '10k': 680, '14k': 910, '18k': 1900, silver: 400, platinum: 725 },
    8: { '10k': 780, '14k': 1250, '18k': 2400, silver: 500, platinum: 950 },
    10: { '10k': 1200, '14k': 1600, '18k': 3200, silver: 600, platinum: 1200 },
    12: { '10k': 1400, '14k': 1900, '18k': 3800, silver: 700, platinum: 1450 },
  },
  dental: { set: { 6: 350, 8: 400, 10: 500 }, row: { 6: 175, 8: 200, 10: 250 } },
  iced: {
    lab: { '10k': 500, '14k': 650, silver: 300 },
    'natural si1': { '10k': 850, '14k': 1000, silver: 500 },
    'natural vvs1': { '10k': 1250, '14k': 1400, silver: 900 },
  },
  moissanite: { 6: 1200, 8: 1250, 10: 1300 },
  molding: { metal: 100, dental: 50 },
  additions: {
    'diamond cut': 5, 'diamond dust': 5, 'diamond cut n dust': 10, 'nugget cut': 10, 'perm cut': 5, 'starburst cut': 10,
    'open face': 50, 'heart open face': 50, 'rose cut': 15, 'extended fang': 25, plating: 50, enamel: 20, anodizing: 65,
    'laser engraving': 150, 'custom 3d printed mold': 300, dripping: 80, 'leaf cut': 30, 'pineapple cut': 30,
  },
  designs: { 'diamond cut': 5, 'diamond dust': 5, 'diamond cut n dust': 10, 'perm cut': 5, 'princess cut': 5, 'nugget cut': 5, 'rose cut': 5 },
};
export const SUGGESTED_PRICING = {
  goldSpot: 124, markup: 30,
  metals: { platinum: 50, silver: 2, 'sterling silver': 2, 'dental gold': 45 },
  grams: { pendant: 12, ring: 6, chain: 25, bracelet: 20, earrings: 4 },
  labor: { pendant: 250, ring: 200, chain: 150, bracelet: 150, earrings: 120 },
  stones: {
    moissanite: { accents: 120, half: 300, full: 520 },
    'lab-grown diamonds': { accents: 200, half: 500, full: 900 },
    'natural diamonds': { accents: 300, half: 750, full: 1400 },
    default: { accents: 200, half: 500, full: 900 },
  },
  grillz: DISTRICT_GRILLZ,
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

// ---------- Grillz po cjenovniku zlatara ----------
// Zubi kao u formi: "T3,T4,B5" (T gore, B dole, 1-10 slijeva nadesno spreda, 3 i 8 očnjaci).
export function teethRows(teeth, units) {
  const list = String(teeth || '').split(',').map((x) => x.trim().toUpperCase()).filter((x) => /^[TB]\d+$/.test(x));
  const top = list.filter((x) => x[0] === 'T');
  const bottom = list.filter((x) => x[0] === 'B');
  if (!list.length && units > 0) return { top: units, bottom: 0, topIds: [], bottomIds: [] };
  return { top: top.length, bottom: bottom.length, topIds: top, bottomIds: bottom };
}
// Kolona cjenovnika za metal i karat kupca; dental gold ima svoju tabelu.
export function grillzColumn(metal, karat) {
  const m = key(metal);
  const k = key(karat);
  if (/dental/.test(m)) return { col: 'dental' };
  if (/platinum/.test(m)) return { col: 'platinum' };
  if (/silver|stainless|steel|925/.test(m) || /silver|925/.test(k)) return { col: 'silver' };
  if (/gold|two.?tone/.test(m)) {
    if (['10k', '14k', '18k'].includes(k)) return { col: k };
    if (['22k', '24k'].includes(k)) return { col: '18k', note: `${karat} is not on the price list, priced as 18K` };
    return { col: '10k', note: 'No karat picked, priced as 10K' };
  }
  return { col: null };
}
const sizes = (table) => Object.keys(table || {}).filter((x) => /^\d+$/.test(x)).map(Number).sort((a, b) => a - b);
// Najmanja veličina sa liste koja pokriva n zuba i ima cijenu u toj koloni (npr. 5 zuba -> cijena za 6).
function sizeUp(table, n, col) {
  for (const sz of sizes(table)) if (sz >= n && num(col == null ? table[sz] : table[sz]?.[col])) return sz;
  return null;
}
const COL_NAME = { '10k': '10K', '14k': '14K', '18k': '18K', silver: 'Silver', platinum: 'Platinum', dental: 'Dental gold' };
const asSize = (n, sz) => (sz !== n ? ` (priced as ${sz})` : '');

// Neiced cijena po kolonama: komplet (oba reda po 6+ zuba) ili svaki red posebno ("bottom or top only").
function plainGrillz(g, rows, col, fangs) {
  const dental = col === 'dental';
  const setT = dental ? g?.dental?.set : g?.sets;
  const rowT = dental ? g?.dental?.row : g?.row;
  const cell = (t, sz) => num(dental ? t?.[sz] : t?.[sz]?.[col]);
  const name = COL_NAME[col] || col;
  const minSet = sizes(setT)[0] ?? 6;
  if (rows.top && rows.bottom && rows.top >= minSet && rows.bottom >= minSet) {
    const a = sizeUp(setT, rows.top, dental ? null : col);
    const b = sizeUp(setT, rows.bottom, dental ? null : col);
    if (!a || !b) return { missing: `${name} set price for ${rows.top} x ${rows.bottom}` };
    if (a === b) return { amount: cell(setT, a), label: `${name} set ${rows.top} x ${rows.bottom}${a !== rows.top || b !== rows.bottom ? ` (priced as ${a} x ${a})` : ''}` };
    // Nejednaki redovi: pola cijene seta za svaki red (8 gore + 6 dole = pola 8x8 + pola 6x6).
    return { amount: (cell(setT, a) + cell(setT, b)) / 2, label: `${name} set ${rows.top} top + ${rows.bottom} bottom (half of the ${a} x ${a} and ${b} x ${b} sets)` };
  }
  let amount = 0;
  const parts = [];
  for (const [n, ids, where] of [[rows.top, rows.topIds, 'top'], [rows.bottom, rows.bottomIds, 'bottom']]) {
    if (!n) continue;
    const isFangs = n === 2 && (fangs || (ids.length === 2 && ids.every((x) => /\d+$/.test(x) && ['3', '8'].includes(x.slice(1)))));
    if (!dental && isFangs && num(rowT?.fangs?.[col])) { amount += num(rowT.fangs[col]); parts.push(`2 fangs & backbar ${where}`); continue; }
    const sz = sizeUp(rowT, n, dental ? null : col);
    if (!sz) return { missing: `${name} price for ${n} ${where} teeth` };
    amount += cell(rowT, sz);
    parts.push(`${n} ${where}${asSize(n, sz)}`);
  }
  return { amount, label: `${name}, ${parts.join(' + ')}` };
}

// Led: cijena po zubu iz tabele (zub sa kamenjem, metal uključen). Moissanite = srebrni pave setovi.
function icedGrillz(g, rows, col, spec, plain) {
  const n = rows.top + rows.bottom;
  const st = key(spec.stones);
  const notes = [];
  const name = COL_NAME[col] || col;
  if (/moissanite/.test(st)) {
    const set = g?.moissanite;
    const one = (r) => { const sz = sizeUp(set, r, null); return sz ? { v: num(set[sz]) / 2, sz } : null; };
    const a = rows.top ? one(rows.top) : { v: 0 };
    const b = rows.bottom ? one(rows.bottom) : { v: 0 };
    if (!a || !b) return { missing: `moissanite pave set price for ${rows.top} x ${rows.bottom}` };
    let amount = a.v + b.v;
    let label = rows.top && rows.bottom && a.sz === b.sz ? `Moissanite pave set ${rows.top} x ${rows.bottom}${a.sz !== rows.top || b.sz !== rows.bottom ? ` (priced as ${a.sz} x ${a.sz})` : ''}` : `Moissanite pave, half of the set price per row`;
    if (!(rows.top && rows.bottom)) notes.push('One row only: half of the moissanite set price');
    if (col !== 'silver') {
      // Moissanite setovi su srebrni: za drugi metal dodaje se razlika metala iz obične tabele.
      const silver = plainGrillz(g, rows, 'silver', spec.style === 'fangs');
      if (silver.amount == null || plain.amount == null) return { missing: `${name} moissanite price` };
      amount += plain.amount - silver.amount;
      label += ` + ${name} instead of silver`;
      notes.push(`Moissanite sets are silver on the price list; ${name} adds the plain ${name} vs silver difference`);
    }
    return { amount, label, notes };
  }
  let row = 'lab';
  if (/natural/.test(st)) {
    const c = key(spec.clarity);
    row = /vvs|flawless/.test(c) ? 'natural vvs1' : 'natural si1';
    if (c === 'vs') row = 'vs';
    if (!c) notes.push('No clarity picked, priced as SI1');
    if (c === 'flawless') notes.push('Flawless is priced as VVS1');
  } else if (!/lab/.test(st)) notes.push('No stone type picked, priced as lab diamonds');
  const per = (c) => (row === 'vs'
    ? (num(g?.iced?.['natural si1']?.[c]) && num(g?.iced?.['natural vvs1']?.[c]) ? (g.iced['natural si1'][c] + g.iced['natural vvs1'][c]) / 2 : null)
    : num(g?.iced?.[row]?.[c]));
  const rowName = row === 'lab' ? 'lab diamonds' : row === 'vs' ? 'natural VS (between SI1 and VVS1)' : row.replace('natural ', 'natural diamonds ').toUpperCase().replace('NATURAL DIAMONDS', 'natural diamonds');
  if (per(col)) return { amount: per(col) * n, label: `Iced, ${rowName}: ${n} × ${money(per(col))} (${name})`, notes };
  // 18K i platina nemaju led u tabeli: 14K led + razlika metala iz obične tabele.
  const plain14 = plainGrillz(g, rows, '14k', spec.style === 'fangs');
  if (per('14k') && plain.amount != null && plain14.amount != null) {
    notes.push(`No iced ${name} price on the list: 14K iced price + the plain ${name} vs 14K difference`);
    return { amount: per('14k') * n + (plain.amount - plain14.amount), label: `Iced, ${rowName}: ${n} × ${money(per('14k'))} (14K) + ${name} difference`, notes };
  }
  return { missing: `iced price per tooth for ${rowName} in ${name}` };
}

export function estimateGrillz(pricing, spec) {
  const g = pricing?.grillz;
  const lines = [];
  const notes = [];
  const missing = [];
  const rows = teethRows(spec.teeth, spec.units);
  const n = rows.top + rows.bottom;
  if (!n) return { total: null, lines, missing: ['teeth (none selected)'], notes };
  const { col, note } = grillzColumn(spec.metal, spec.karat);
  if (note) notes.push(note);
  if (!col) return { total: null, lines, missing: [`grillz price for ${spec.metal || 'this metal'}`], notes };
  const fangs = /fang/i.test(spec.style || '');
  const plain = plainGrillz(g, rows, col, fangs);
  const iced = col !== 'dental' && spec.coverage && spec.coverage !== 'none';
  if (plain.missing) missing.push(plain.missing);
  if (!iced) { if (plain.amount != null) lines.push({ label: plain.label, amount: plain.amount }); }
  else {
    const ice = icedGrillz(g, rows, col, spec, plain);
    if (ice.missing) missing.push(ice.missing);
    else {
      notes.push(...(ice.notes || []));
      if (spec.coverage === 'full') lines.push({ label: ice.label, amount: ice.amount });
      else if (plain.amount != null) {
        // Cjenovnik ima samo potpuno okovane zube: half iced = pola puta, accents = četvrtina puta od običnog do okovanog
        // (pitanje za zlatara kako on to računa).
        const share = spec.coverage === 'accents' ? 0.25 : 0.5;
        lines.push({ label: `${spec.coverage === 'accents' ? 'Accents: a quarter' : 'Half iced: halfway'} between plain (${money(plain.amount)}) and fully iced (${money(ice.amount)})`, amount: plain.amount + (ice.amount - plain.amount) * share });
      }
    }
  }
  const cutK = key(spec.cut);
  if (cutK && !/^(polished|solid|none)$/.test(cutK)) {
    const list = col === 'dental' ? g?.designs : g?.additions;
    const c = num(list?.[cutK]);
    if (c) lines.push({ label: `${spec.cut}: ${n} × ${money(c)}`, amount: c * n });
    else notes.push(`${spec.cut}: no price on the ${col === 'dental' ? 'dental gold ' : ''}list, not included`);
  }
  const mold = num(g?.molding?.[col === 'dental' ? 'dental' : 'metal']);
  if (mold) lines.push({ label: 'Molding fee', amount: mold });
  if (missing.length) return { total: null, lines, missing, notes };
  return { total: lines.reduce((s, l) => s + l.amount, 0), lines, missing, notes };
}

// spec: { type, metal, karat, stones, coverage, cut, units } (natpisi; units = broj zuba kod grillza, inače 1).
// Vraća { total, lines, missing } ; total je null dok nešto što je potrebno nije upisano.
export function estimate(pricing, spec) {
  if (spec.type === 'grillz') return estimateGrillz(pricing, spec);
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

// ---------- Specifikacija leada (portal i server, 19.11.2026) ----------
// Isti račun u portalu i na serveru: server sam napiše prvu poruku čim stigne upit i pokaže cijene na stranici kupca.
// fs = izbori forme kao natpisi (pricingSpec u workeru), a = odgovori kupca.
export function leadSpecFrom(fs, a = {}) {
  if (!fs || !a?.type) return null;
  const lab = (list, v) => (list || []).find((o) => o.value === v)?.label || '';
  const iced = LEVELS.includes(a.coverage);
  return {
    spec: {
      type: a.type, metal: lab(fs.metal, a.metal) || a.metal || '', karat: lab(fs.karat, a.karat) || a.karat || '',
      stones: iced ? (a.stones && a.stones !== 'none' ? lab(fs.stones, a.stones) || a.stones : 'default') : '', coverage: iced ? a.coverage : '',
      cut: iced ? '' : lab(fs.cut, a.cut) || a.cut || '', units: String(a.teeth || '').split(',').filter(Boolean).length || 1,
      teeth: a.teeth || '', clarity: a.clarity || '', style: a.style || '',
    },
    budget: parseBudget(lab(fs.budget, a.budget) || a.budget),
    budgetLabel: lab(fs.budget, a.budget) || a.budget || '',
    choices: { stones: (fs.stones || []).filter((o) => o.value !== 'none').map((o) => o.label), karats: (fs.karat || []).map((o) => o.label), coverages: (fs.coverage || []).map((o) => o.value).filter((v) => LEVELS.includes(v)), metals: (fs.metal || []).map((o) => o.label) },
    opts: {
      coverage: (fs.coverage || []).filter((o) => LEVELS.includes(o.value)).map((o) => [o.value, o.label]),
      clarity: (fs.clarity || []).map((o) => o.label), cut: (fs.cut || []).map((o) => o.label),
    },
  };
}


export const isGold = (m) => /gold|two.?tone/i.test(m || '') && !/dental/i.test(m || '');
export const isDental = (m) => /dental/i.test(m || '');
export const rowsOf = (teeth) => { const t = String(teeth || '').split(',').filter(Boolean); const top = t.filter((x) => x[0] === 'T'); return { top: top.length, bottom: t.length - top.length, topIds: top, bottomIds: t.filter((x) => x[0] === 'B') }; };
export const coverLabel = (v, ls) => (!v ? 'Not iced' : ls.opts.coverage.find(([x]) => x === v)?.[1] || ({ accents: 'Accents', half: 'Half iced', full: 'Fully iced' }[v] || v));

// Šta se razlikuje od kupčevog izbora (za tagove i za poruku).
export function specDiff(ls, spec) {
  const a = ls.spec;
  const out = [];
  const add = (what, from, to) => { if (String(from || '') !== String(to || '')) out.push({ what, from: from || 'none', to: to || 'none' }); };
  add('Metal', a.metal, spec.metal);
  if (isGold(a.metal) || isGold(spec.metal)) add('Karat', isGold(a.metal) ? a.karat : '', isGold(spec.metal) ? spec.karat : '');
  add('Ice', coverLabel(a.coverage, ls), coverLabel(spec.coverage, ls));
  if (a.coverage || spec.coverage) add('Stones', a.coverage ? a.stones : '', spec.coverage ? spec.stones : '');
  if (/natural/i.test(spec.stones) || /natural/i.test(a.stones)) add('Clarity', /natural/i.test(a.stones) && a.coverage ? a.clarity : '', /natural/i.test(spec.stones) && spec.coverage ? spec.clarity : '');
  if (a.type === 'grillz') {
    const ra = rowsOf(a.teeth), rb = rowsOf(spec.teeth);
    add('Teeth', `${ra.top} top + ${ra.bottom} bottom`, `${rb.top} top + ${rb.bottom} bottom`);
    add('Cut', a.coverage ? '' : a.cut, spec.coverage ? '' : spec.cut);
  }
  return out;
}

// Tijelo zahtjeva za quote poruku iz konačnih izbora i procjene.
export function quoteBody(ls, spec, est) {
  const r = rowsOf(spec.teeth);
  return {
    piece: spec.type, metal: spec.metal, karat: isGold(spec.metal) ? spec.karat : '',
    ice: spec.coverage ? coverLabel(spec.coverage, ls) : '', stones: spec.coverage ? spec.stones : '', clarity: spec.coverage && /natural/i.test(spec.stones) ? spec.clarity : '',
    cut: spec.type === 'grillz' && !spec.coverage ? spec.cut : '', teeth: spec.type === 'grillz' ? { top: r.top, bottom: r.bottom } : null,
    total: Math.round(est.total), lines: est.lines.map((x) => ({ label: x.label, amount: Math.round(x.amount) })),
    budget: ls.budgetLabel, changes: specDiff(ls, spec),
  };
}
