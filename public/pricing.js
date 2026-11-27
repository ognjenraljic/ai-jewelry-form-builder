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
// ---------- Districtova tabela dijamanata (Enrique, 27.11.2026) ----------
// Maloprodajna cijena po JEDNOM kamenu (round brilliant, G-H, VS2-SI1) za svaku veličinu od 1.0 do 10.0 mm, i rad
// ugradnje po kamenu (pavé, prong, bezel). Komad sa više kamenova = cijena po kamenu × broj + rad × broj.
// Kolone: [mm, karat, natural $/kamen, lab $/kamen, pavé rad, prong rad, bezel rad]. U pricing-u: diamonds.chart.m30 = 3.0 mm.
export const DISTRICT_DIAMONDS = [
  [1, 0.005, 18, 6, 15, 25, 35],
  [1.1, 0.007, 22, 6, 15, 25, 35],
  [1.2, 0.008, 26, 7, 15, 25, 35],
  [1.3, 0.01, 30, 7, 15, 25, 35],
  [1.4, 0.012, 35, 8, 15, 25, 35],
  [1.5, 0.015, 42, 9, 15, 25, 35],
  [1.6, 0.017, 48, 10, 15, 25, 35],
  [1.7, 0.02, 55, 11, 15, 25, 35],
  [1.8, 0.025, 65, 12, 15, 25, 35],
  [1.9, 0.028, 75, 13, 15, 25, 35],
  [2, 0.035, 90, 15, 15, 25, 35],
  [2.1, 0.039, 100, 16, 18, 25, 35],
  [2.2, 0.041, 110, 17, 18, 25, 35],
  [2.3, 0.05, 130, 19, 18, 25, 35],
  [2.4, 0.052, 140, 20, 18, 25, 35],
  [2.5, 0.059, 160, 22, 18, 25, 35],
  [2.6, 0.07, 185, 25, 18, 25, 35],
  [2.7, 0.07, 195, 26, 18, 25, 35],
  [2.8, 0.085, 225, 30, 18, 25, 35],
  [2.9, 0.095, 250, 33, 18, 25, 35],
  [3, 0.11, 290, 38, 18, 25, 35],
  [3.1, 0.12, 320, 42, 25, 55, 65],
  [3.2, 0.14, 360, 48, 25, 55, 65],
  [3.3, 0.15, 400, 54, 25, 55, 65],
  [3.4, 0.16, 440, 60, 25, 55, 65],
  [3.5, 0.18, 500, 68, 25, 55, 65],
  [3.6, 0.19, 550, 76, 25, 55, 65],
  [3.7, 0.21, 620, 86, 25, 55, 65],
  [3.8, 0.23, 700, 98, 25, 55, 65],
  [3.9, 0.25, 780, 110, 25, 55, 65],
  [4, 0.27, 880, 125, 25, 55, 65],
  [4.1, 0.29, 970, 140, 35, 55, 65],
  [4.2, 0.31, 1080, 158, 35, 55, 65],
  [4.3, 0.33, 1200, 175, 35, 55, 65],
  [4.4, 0.36, 1350, 195, 35, 55, 65],
  [4.5, 0.4, 1550, 225, 35, 55, 65],
  [4.6, 0.42, 1700, 250, 35, 55, 65],
  [4.7, 0.45, 1900, 280, 35, 55, 65],
  [4.8, 0.48, 2100, 310, 35, 55, 65],
  [4.9, 0.5, 2300, 340, 35, 55, 65],
  [5, 0.52, 2550, 375, 35, 55, 65],
  [5.1, 0.55, 2800, 410, 65, 95, 125],
  [5.2, 0.58, 3100, 450, 65, 95, 125],
  [5.3, 0.62, 3400, 495, 65, 95, 125],
  [5.4, 0.65, 3700, 540, 65, 95, 125],
  [5.5, 0.7, 4100, 600, 65, 95, 125],
  [5.6, 0.73, 4400, 640, 65, 95, 125],
  [5.7, 0.77, 4800, 690, 65, 95, 125],
  [5.8, 0.82, 5300, 750, 65, 95, 125],
  [5.9, 0.86, 5800, 810, 65, 95, 125],
  [6, 0.9, 6400, 880, 65, 95, 125],
  [6.1, 0.95, 7000, 950, 65, 95, 125],
  [6.2, 1, 7700, 1020, 65, 95, 125],
  [6.3, 1.05, 8400, 1100, 65, 95, 125],
  [6.4, 1.1, 9100, 1180, 65, 95, 125],
  [6.5, 1.15, 9900, 1270, 65, 95, 125],
  [6.6, 1.2, 10800, 1370, 125, 175, 225],
  [6.7, 1.25, 11800, 1480, 125, 175, 225],
  [6.8, 1.3, 12900, 1600, 125, 175, 225],
  [6.9, 1.35, 14000, 1720, 125, 175, 225],
  [7, 1.4, 15200, 1850, 125, 175, 225],
  [7.1, 1.5, 16800, 2000, 125, 175, 225],
  [7.2, 1.55, 18200, 2150, 125, 175, 225],
  [7.3, 1.6, 19600, 2300, 125, 175, 225],
  [7.4, 1.65, 21200, 2460, 125, 175, 225],
  [7.5, 1.75, 23200, 2650, 125, 175, 225],
  [7.6, 1.8, 25000, 2820, 125, 175, 225],
  [7.7, 1.9, 27000, 3000, 125, 175, 225],
  [7.8, 2, 29200, 3200, 125, 175, 225],
  [7.9, 2.1, 31500, 3400, 125, 175, 225],
  [8, 2.15, 33800, 3600, 125, 175, 225],
  [8.1, 2.25, 36500, 3850, 175, 250, 325],
  [8.2, 2.35, 39200, 4100, 175, 250, 325],
  [8.3, 2.45, 42000, 4380, 175, 250, 325],
  [8.4, 2.55, 45000, 4680, 175, 250, 325],
  [8.5, 2.7, 49000, 5050, 175, 250, 325],
  [8.6, 2.8, 52500, 5400, 175, 250, 325],
  [8.7, 2.9, 56000, 5750, 175, 250, 325],
  [8.8, 3, 60000, 6150, 175, 250, 325],
  [8.9, 3.1, 64000, 6550, 175, 250, 325],
  [9, 3.2, 68500, 7000, 175, 250, 325],
  [9.1, 3.35, 73500, 7500, 175, 250, 325],
  [9.2, 3.5, 79000, 8000, 175, 250, 325],
  [9.3, 3.6, 84500, 8550, 175, 250, 325],
  [9.4, 3.75, 90500, 9150, 175, 250, 325],
  [9.5, 3.9, 97000, 9800, 175, 250, 325],
  [9.6, 4.05, 103500, 10450, 175, 250, 325],
  [9.7, 4.2, 110500, 11150, 175, 250, 325],
  [9.8, 4.35, 118000, 11900, 175, 250, 325],
  [9.9, 4.5, 126000, 12700, 175, 250, 325],
  [10, 4.7, 135000, 13600, 175, 250, 325],
];
export const DIAMOND_COLS = ['ct', 'natural', 'lab', 'pave', 'prong', 'bezel'];
const mmKey = (mm) => `m${Math.round(mm * 10)}`;
export const DISTRICT_DIAMOND_CHART = Object.fromEntries(DISTRICT_DIAMONDS.map(([mm, ...v]) => [mmKey(mm), Object.fromEntries(DIAMOND_COLS.map((c, i) => [c, v[i]]))]));
// Pravila uz tabelu (iz Districtovih napomena): ocjena kamena, oblik, složen rad, platina, kupčevo kamenje, minimumi.
export const DISTRICT_DIAMOND_RULES = { vvs: 20, si2: 15, fancy: 10, complex: 35, platinum: 25, customerStone: 10, paveMin: 75, paveMinLarge: 100, prongMin: 50, bezelMin: 50 };
// Ostali rad ugradnje (Setting Labor Guide), po kamenu osim gdje piše; asistent i zlatar ih koriste za ručne ponude.
export const DISTRICT_SETTING_EXTRA = { 'channel, stones up to 3 mm': 30, 'channel, stones 3 to 5 mm': 50, 'channel, minimum per row': 100, 'invisible or tension (quote per job)': 250, 'flush or gypsy, up to 3 mm': 20, 'flush, minimum per piece': 75, 're-tipping, per prong': 25, 'stone removal, per stone': 10 };
// Sat od nerđajućeg čelika okovan moissanitom: gotove cijene (District 27.11.2026), bez markupa.
export const DISTRICT_WATCH = { moissanite: { full: 2500, half: 1400, face: 800, bezel: 500, bracelet: 1200, all: 2500 } };

export const SUGGESTED_PRICING = {
  goldSpot: 124, markup: 30,
  metals: { platinum: 50, silver: 2, 'sterling silver': 2, 'dental gold': 45 },
  grams: { pendant: 12, ring: 6, chain: 25, bracelet: 20, earrings: 4 },
  // Sat: rad za bust-down (otvaranje, priprema površine za kamenje, poliranje, sklapanje); kamenje i ugradnja posebno.
  labor: { pendant: 250, ring: 200, chain: 150, bracelet: 150, earrings: 120, watch: 450 },
  // Kamenje van grillza (22.11.2026): $ po karatu za sitno kamenje i za centralni kamen, ugradnja po kamenu.
  stones: {
    moissanite: { ct: 40, center: 150 },
    'lab-grown diamonds': { ct: 150, center: 350 },
    'natural diamonds': { ct: 600, center: 4000 },
    default: { ct: 150, center: 350 },
  },
  setting: 1.5,
  grillz: DISTRICT_GRILLZ,
  diamonds: { on: true, chart: DISTRICT_DIAMOND_CHART },
  diamondRules: DISTRICT_DIAMOND_RULES,
  settingExtra: DISTRICT_SETTING_EXTRA,
  watch: DISTRICT_WATCH,
};

// ---------- Računanje po tabeli dijamanata (27.11.2026) ----------
// Prirodni i lab dijamanti (i na satu) idu po tabeli kad je uključena; moissanite i dalje po karatu.
export const diamondKind = (stones) => (/natural/i.test(stones || '') ? 'natural' : /lab/i.test(stones || '') ? 'lab' : null);
export function diamondRows(pricing) {
  const d = pricing?.diamonds;
  if (!d || d.on === false || !d.chart) return null;
  const rows = Object.entries(d.chart).map(([k, v]) => ({ mm: Number(k.slice(1)) / 10, ...v })).filter((r) => r.mm > 0).sort((a, b) => a.mm - b.mm);
  return rows.length ? rows : null;
}
export const rowByMm = (rows, mm) => rows.reduce((best, r) => (Math.abs(r.mm - mm) < Math.abs(best.mm - mm) ? r : best), rows[0]);
export const rowByCt = (rows, ct) => rows.filter((r) => r.ct > 0).reduce((best, r) => (Math.abs(r.ct - ct) < Math.abs(best.ct - ct) ? r : best), rows[0]);
const RULES = (pricing) => ({ ...DISTRICT_DIAMOND_RULES, ...(pricing?.diamondRules || {}) });
// Ocjena kamena: tabela je G-H / VS2-SI1; D-F ili VVS/IF/Flawless više, SI2/I1 manje (Districtove napomene).
function gradeFactor(pricing, spec) {
  const c = key(spec.clarity);
  const r = RULES(pricing);
  if (/vvs|flawless|^if$|^fl$|d-f|d/.test(c)) return { k: 1 + r.vvs / 100, note: `${spec.clarity}: chart price +${r.vvs}% (chart is G-H, VS2-SI1)` };
  if (/si2|i1|i2|i3|i-j/.test(c)) return { k: 1 - r.si2 / 100, note: `${spec.clarity}: chart price -${r.si2}% (chart is G-H, VS2-SI1)` };
  return { k: 1 };
}
const isPlatinum = (spec) => /platinum/i.test(spec.metal || '');
// Rad ugradnje po kamenu sa minimumom po komadu; platina +X% na rad.
function settingLabor(pricing, row, count, kind = 'pave', spec = {}) {
  const r = RULES(pricing);
  const each = (Number(row[kind]) || 0) * (isPlatinum(spec) ? 1 + r.platinum / 100 : 1);
  const min = kind === 'pave' ? (row.mm > 4 ? r.paveMinLarge : r.paveMin) : kind === 'prong' ? r.prongMin : r.bezelMin;
  const raw = each * count;
  return { each, total: Math.max(raw, min || 0), min: raw < (min || 0) ? min : 0 };
}
// Sat sa moissanitom: gotov cjenovnik po nivou ili po dijelu (face, bezel, bracelet); sva tri = cijena "All 3".
export function watchFlat(pricing, spec) {
  if (spec.type !== 'watch' || !/moissanite/i.test(spec.stones || '')) return null;
  const w = pricing?.watch?.moissanite;
  if (!w) return null;
  const n = (v) => (Number(v) > 0 ? Number(v) : null);
  const parts = String(spec.iceParts || '').split(',').filter(Boolean);
  if (parts.length) {
    const vals = parts.map((p) => n(w[p]));
    if (vals.some((v) => v == null)) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    const all = parts.length === 3 && n(w.all) ? Math.min(sum, n(w.all)) : sum;
    const what = `${parts.map((p) => (p === 'face' ? 'face (dial)' : p)).join(' + ')}${parts.length === 3 && n(w.all) ? ', all 3' : ''}`;
    return { amount: all, what, label: `Moissanite on the ${what} (watch price list)` };
  }
  const lvl = spec.coverage === 'full' ? 'full' : spec.coverage === 'half' ? 'half' : null;
  if (!lvl || !n(w[lvl])) return null;
  const what = lvl === 'full' ? 'fully iced' : 'half iced';
  return { amount: n(w[lvl]), what, label: `Moissanite ${what} (watch price list)` };
}
// ---------- Žive cijene metala (22.11.2026) ----------
// Spot cijene po troy unci (api.gold-api.com, bez ključa) postaju cijene po gramu. Zlatar po metalu bira Live
// (podrazumijevano) ili Custom (njegov broj iz Pricing taba); bez žive cijene ostaje njegov broj.
export const OZ = 31.1034768;
export const MARKET_METALS = [
  { key: 'gold', symbol: 'XAU', label: 'Pure gold (24K)' },
  { key: 'silver', symbol: 'XAG', label: 'Silver' },
  { key: 'platinum', symbol: 'XPT', label: 'Platinum' },
];
export const isLive = (pricing, k) => pricing?.live?.[k] !== false;
const r2 = (x) => Math.round(x * 100) / 100;
export function applyMarket(pricing, market) {
  if (!pricing || !market) return pricing;
  const out = { ...pricing, metals: { ...(pricing.metals || {}) } };
  if (isLive(pricing, 'gold') && market.gold > 0) out.goldSpot = r2(market.gold);
  for (const [k, re] of [['silver', /silver|925/], ['platinum', /platinum/]]) {
    if (!isLive(pricing, k) || !(market[k] > 0)) continue;
    const keys = Object.keys(out.metals).filter((m) => re.test(m) && !m.includes('|'));
    if (!keys.includes(k)) keys.push(k);
    // Sterling / 925 je 92,5% srebra; ostali ključevi tog metala dobijaju čistu spot cijenu.
    for (const m of keys) out.metals[m] = r2(market[k] * (k === 'silver' && /sterling|925/.test(m) ? 0.925 : 1));
  }
  return out;
}

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
  // Moissanite po zubu (22.11.2026, Ognjen): kad zlatar upiše red u tabelu zuba, ide kao ostalo kamenje po zubu;
  // bez tog reda ostaje stari račun preko srebrnih pave setova.
  // Srebro bez svoje cijene u moissanite redu ide preko srebrnih pave setova (ti setovi su baš srebro), nikad preko
  // 14K reda (District 22.11.2026: srebrni grillz je pisao "(14K) + Silver difference").
  const moiss = g?.iced?.moissanite;
  const moissPerTooth = /moissanite/.test(st) && (num(moiss?.[col]) || (col !== 'silver' && num(moiss?.['14k'])));
  if (/moissanite/.test(st) && !moissPerTooth) {
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
  let row = moissPerTooth ? 'moissanite' : 'lab';
  if (moissPerTooth) { /* moissanite red iz tabele zuba */ } else if (/natural/.test(st)) {
    const c = key(spec.clarity);
    row = /vvs|flawless/.test(c) ? 'natural vvs1' : 'natural si1';
    if (c === 'vs') row = 'vs';
    if (!c) notes.push('No clarity picked, priced as SI1');
    if (c === 'flawless') notes.push('Flawless is priced as VVS1');
  } else if (!/lab/.test(st)) notes.push('No stone type picked, priced as lab diamonds');
  const per = (c) => (row === 'vs'
    ? (num(g?.iced?.['natural si1']?.[c]) && num(g?.iced?.['natural vvs1']?.[c]) ? (g.iced['natural si1'][c] + g.iced['natural vvs1'][c]) / 2 : null)
    : num(g?.iced?.[row]?.[c]));
  const rowName = row === 'moissanite' ? 'moissanite' : row === 'lab' ? 'lab diamonds' : row === 'vs' ? 'natural VS (between SI1 and VVS1)' : row.replace('natural ', 'natural diamonds ').toUpperCase().replace('NATURAL DIAMONDS', 'natural diamonds');
  if (per(col)) return { amount: per(col) * n, label: `Iced, ${rowName}: ${n} × ${money(per(col))} (${name})`, notes };
  // 18K i platina nemaju led u tabeli: 14K led + razlika metala iz obične tabele.
  const plain14 = plainGrillz(g, rows, '14k', spec.style === 'fangs');
  if (per('14k') && plain.amount != null && plain14.amount != null) {
    const diff = plain.amount - plain14.amount;
    notes.push(`No ${name} price in the iced ${rowName} row: the 14K price per tooth ${diff < 0 ? 'minus' : 'plus'} the plain ${name} vs 14K difference. Add a ${name} price to that row to use your own.`);
    return { amount: per('14k') * n + diff, label: `Iced, ${rowName}: ${n} × ${money(per('14k'))} (14K row) ${diff < 0 ? '−' : '+'} ${money(Math.abs(diff))} for ${name}`, notes };
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
  // Lanac i narukvica (25.11.2026): grami iz 14K kataloga po stilu, širini i dužini kad je katalog uključen.
  const cwAll = chainWeight(pricing, spec);
  const cw = cwAll && !cwAll.out ? cwAll : null;
  const grams = cw ? cw.grams : num(pricing?.grams?.[spec.type]);
  const ppg = metalPerGram(pricing, spec.metal, spec.karat);
  // Sat (22.11.2026): bez grama se okiva kupčev sat, pa nema metala; grami se upisuju samo za novo kućište ili narukvicu.
  const ownWatch = spec.type === 'watch' && !grams;
  if (!grams && !ownWatch) missing.push(`grams${per} for ${spec.type}`);
  if (!ppg && !ownWatch) missing.push(`price per gram of ${spec.metal || 'the metal'}${spec.karat ? ` ${spec.karat}` : ''}`);
  if (grams && ppg) lines.push({ label: cw ? `Metal: ${cw.text}, ${grams} g × ${money(ppg)}/g` : `Metal: ${+(grams * units).toFixed(1)} g × ${money(ppg)}/g`, amount: grams * units * ppg });
  const notes = [];
  // Sat sa moissanitom po gotovom cjenovniku: cijena već uključuje rad, kamenje i ugradnju.
  const flat = spec.stones && spec.coverage ? watchFlat(pricing, spec) : null;
  const labor = num(pricing?.labor?.[spec.type]);
  // Sat sa prirodnim ili lab dijamantima (27.11.2026): kamenje po tabeli dijamanata, a ugradnja i rad po cjenovniku sata
  // (isti posao kao moissanite). Tabela sama bi računala pavé $15 × ~1.600 kamenova, što nije cijena bust-downa.
  const watchWork = !flat && spec.type === 'watch' && spec.coverage && diamondKind(spec.stones) && diamondRows(pricing) ? watchFlat(pricing, { ...spec, stones: 'Moissanite' }) : null;
  if (flat) { lines.push({ label: flat.label, amount: flat.amount, retail: true }); notes.push('Watch price list (stainless steel): includes stones, setting and labor, no markup.'); }
  else if (watchWork) { lines.push({ label: `Setting and labor, ${watchWork.what} (watch price list)`, amount: watchWork.amount, retail: true }); notes.push('Diamond watch: stones from the diamond chart, setting and labor from the watch price list (the same work as a moissanite watch).'); }
  else if (labor) lines.push({ label: `Labor${units > 1 ? `: ${units} × ${money(labor)}` : ''}`, amount: labor * units });
  else missing.push(`labor${per} for ${spec.type}`);
  const dia = diamondKind(spec.stones) ? diamondRows(pricing) : null;
  const kind = diamondKind(spec.stones);
  if (cwAll) notes.push(cw ? `Weight from the chain catalog: ${cw.note}` : cwAll.note);
  if (ownWatch) notes.push("Customer's own watch: no metal included. Add grams for watches in Weight and labor to price a new case or bracelet.");
  if (flat) { /* kamenje je u cijeni sata */ }
  else if (spec.stones && spec.coverage && dia) {
    // Po Districtovoj tabeli: cijena po kamenu za tu veličinu × broj kamenova, plus rad ugradnje po kamenu (maloprodaja, bez markupa).
    const lay = stoneLayout(spec);
    const row = rowByMm(dia, lay.d);
    const g = gradeFactor(pricing, spec);
    if (g.note) notes.push(g.note);
    const per = (Number(row[kind]) || 0) * g.k;
    const name = kind === 'natural' ? 'natural diamonds' : 'lab diamonds';
    lines.push({ label: `Stones: about ${lay.count.toLocaleString('en-US')} × ${row.mm} mm ${name} × ${money(per)} each (diamond chart)`, amount: lay.count * per, retail: true });
    const lab = settingLabor(pricing, row, lay.count, 'pave', spec);
    if (!watchWork) lines.push({ label: lab.min ? `Pavé setting: minimum ${money(lab.min)} per piece` : `Pavé setting: ${lay.count.toLocaleString('en-US')} × ${money(lab.each)}${isPlatinum(spec) ? ' (platinum +' + RULES(pricing).platinum + '%)' : ''}`, amount: lab.total, retail: true });
    notes.push(lay.note);
  } else if (spec.stones && spec.coverage) {
    const row = pricing?.stones?.[key(spec.stones)];
    const perCt = num(row?.ct);
    if (perCt) {
      // Kamenje po površini (22.11.2026): koliko kamenova stane na taj komad te veličine, koliko je to karata, pa $/ct.
      const lay = stoneLayout(spec);
      const mult = clarityFactor(spec);
      if (mult.note) notes.push(mult.note);
      lines.push({ label: `Stones: about ${lay.count.toLocaleString('en-US')} × ${lay.d} mm ${stoneName(spec.stones)} (≈ ${lay.ct} ct) × ${money(perCt * mult.k)}/ct`, amount: lay.ct * perCt * mult.k });
      const setting = num(pricing?.setting);
      if (setting) lines.push({ label: `Setting: ${lay.count.toLocaleString('en-US')} stones × $${setting}`, amount: lay.count * setting });
      notes.push(lay.note);
    } else {
      const s = num(row?.[spec.coverage]);
      if (s) lines.push({ label: `Stones: ${spec.stones}, ${spec.coverage}${units > 1 ? ` × ${units}` : ''}`, amount: s * units });
      else missing.push(`${spec.stones} ${row ? `(${spec.coverage})` : 'price per carat'}${per}`);
    }
  }
  // Centralni kamen (prsten, minđuše na šraf): karati koje je kupac izabrao × $/ct za centralne kamenove.
  const center = centerStones(spec);
  if (center && dia) {
    // Centralni kamen po tabeli: red sa najbližim karatom, cijena po kamenu + prong ugradnja.
    const count = spec.type === 'earrings' ? 2 : 1;
    const each = round2(center.ct / count);
    const row = rowByCt(dia, each);
    const g = gradeFactor(pricing, spec);
    const per = (Number(row[kind]) || 0) * g.k;
    lines.push({ label: `${center.label}: ${count > 1 ? `2 × ` : ''}${row.ct} ct (${row.mm} mm) × ${money(per)} (diamond chart)`, amount: per * count, retail: true });
    const lab = settingLabor(pricing, row, count, 'prong', spec);
    lines.push({ label: `Prong setting: ${count} × ${money(lab.each)}${lab.min ? `, minimum ${money(lab.min)}` : ''}`, amount: lab.total, retail: true });
  } else if (center) {
    const row = pricing?.stones?.[key(spec.stones)] || pricing?.stones?.default;
    const perCt = num(row?.center);
    const k = clarityFactor(spec).k;
    if (perCt) lines.push({ label: `${center.label}: ${center.ct} ct × ${money(perCt * k)}/ct`, amount: center.ct * perCt * k });
    else notes.push(`${center.label} (${center.ct} ct) not priced: add a center stone price per carat`);
  }
  if (spec.cut) {
    const c = pricing?.cuts?.[key(spec.cut)];
    if (num(c)) lines.push({ label: `Cut: ${spec.cut}${units > 1 ? ` × ${units}` : ''}`, amount: num(c) * units });
  }
  if (missing.length) return { total: null, lines, missing, notes };
  const sub = lines.reduce((n, l) => n + l.amount, 0);
  // Tabela dijamanata i cjenovnik sata su već maloprodajne cijene: markup ide samo na metal i rad.
  const base = lines.filter((l) => !l.retail).reduce((n, l) => n + l.amount, 0);
  const markup = Number(pricing?.markup) > 0 ? Number(pricing.markup) : 0;
  const mk = (base * markup) / 100;
  if (markup && mk > 0) lines.push({ label: base < sub ? `Markup ${markup}% (metal and labor)` : `Markup ${markup}%`, amount: mk });
  return { total: sub + mk, lines, missing, notes };
}

// ---------- Težine lanaca iz 14K kataloga (District 25.11.2026) ----------
// Lanac i narukvica: grami se ne uzimaju "po komadu" nego iz kataloga dobavljača (14K yellow gold, stil × širina ×
// dužina). Širina između dva reda = linearno između njih; šire/uže od kataloga = najbliži red × (širina/širina)²;
// dužina koje nema u redu = grami po inču × dužina. Drugi metal/karat = ista zapremina × gustina (10K lakši, 18K teži).
// Uključuje se u Pricing tabu (pricing.chainWeights.on); zlatar bira koji red kataloga ide uz koji stil iz forme.
const L3 = (a, b, c, d, e, f) => ({ [a]: b, [c]: d, [e]: f });
const CHART_LENS = [8, 16, 18, 20, 22, 24, 26, 28, 30];
const chart = (mm, ...g) => ({ mm, w: Object.fromEntries(CHART_LENS.map((l, i) => [l, g[i]])) });
export const CHAIN_CATALOG = [
  { key: 'cuban-solid', label: 'Solid Miami Cuban', image: 'miami-cuban-solid', code: 'CH4', rows: [
    { mm: 12, w: L3(24, 252.0, 26, 273.0, 28, 294.0) }, { mm: 10, w: L3(24, 172.8, 26, 187.2, 28, 201.6) }, { mm: 9, w: L3(24, 151.2, 26, 163.8, 28, 176.4) },
    { mm: 8, w: L3(22, 107.8, 24, 117.6, 26, 127.4) }, { mm: 7, w: L3(22, 81.4, 24, 88.8, 26, 96.2) }, { mm: 6, w: L3(22, 57.2, 24, 62.4, 26, 67.6) },
    { mm: 5, w: L3(20, 38.0, 22, 41.8, 24, 45.6) }, { mm: 4, w: L3(20, 25.6, 22, 28.2, 24, 30.7) }, { mm: 3.5, w: L3(20, 18.0, 22, 19.8, 24, 21.6) },
    { mm: 3, w: L3(18, 10.4, 20, 11.6, 22, 12.8) }, { mm: 2, w: L3(16, 5.6, 18, 6.3, 20, 7.0) }] },
  { key: 'cuban-hollow', label: 'Hollow Miami Cuban', image: 'miami-cuban-hollow', code: 'CH5', rows: [
    { mm: 13, w: L3(24, 110.4, 26, 119.6, 28, 128.8) }, { mm: 11, w: L3(24, 79.9, 26, 86.6, 28, 93.2) }, { mm: 9.5, w: L3(24, 60.5, 26, 65.5, 28, 70.6) },
    { mm: 8, w: L3(22, 31.0, 24, 33.8, 26, 36.7) }, { mm: 7, w: L3(22, 25.7, 24, 28.1, 26, 30.4) }, { mm: 6, w: L3(20, 21.0, 22, 23.1, 24, 25.2) },
    // 5 mm 24" piše 13.1 g u katalogu (manje od 22"), očito greška štampe: ostaje samo 20" i 22".
    { mm: 5, w: { 20: 13.4, 22: 14.7 } }, { mm: 4, w: L3(20, 8.2, 22, 9.0, 24, 9.8) }, { mm: 3, w: L3(18, 4.5, 20, 5.0, 22, 5.5) },
    { mm: 2.5, w: L3(16, 3.0, 18, 3.4, 20, 3.8) }] },
  { key: 'rope', label: 'Rope', image: 'rope', code: 'CH1', rows: [
    { mm: 12, w: L3(24, 218.4, 26, 236.6, 28, 254.8) }, { mm: 10, w: L3(24, 151.2, 26, 163.8, 28, 176.4) }, { mm: 8, w: L3(22, 105.2, 24, 114.7, 26, 124.3) },
    { mm: 7, w: L3(22, 82.5, 24, 90.0, 26, 97.5) }, { mm: 6, w: L3(22, 57.9, 24, 63.1, 26, 68.4) }, { mm: 5, w: L3(22, 41.4, 24, 45.1, 26, 48.9) },
    { mm: 4, w: L3(20, 25.4, 22, 27.9, 24, 30.5) }, { mm: 3.5, w: L3(20, 20.4, 22, 22.4, 24, 24.5) }, { mm: 3, w: L3(20, 15.9, 22, 17.5, 24, 19.1) },
    { mm: 2.5, w: L3(16, 7.6, 18, 8.6, 20, 9.5) }, { mm: 2, w: L3(16, 6.0, 18, 6.8, 20, 7.5) }, { mm: 1.5, w: L3(16, 3.2, 18, 3.6, 20, 4.0) }] },
  { key: 'milano', label: 'Milano Figarope', image: 'milano-figarope', code: 'CH3', rows: [
    { mm: 10, w: L3(24, 165.8, 26, 179.7, 28, 193.5) }, { mm: 8, w: L3(22, 114.0, 24, 124.3, 26, 134.7) }, { mm: 7, w: L3(22, 82.9, 24, 90.5, 26, 98.0) },
    { mm: 6, w: L3(22, 48.4, 24, 52.8, 26, 57.2) }, { mm: 5, w: L3(22, 35.2, 24, 38.4, 26, 41.6) }, { mm: 4, w: L3(20, 22.6, 22, 24.9, 24, 27.1) },
    { mm: 3, w: L3(18, 13.5, 20, 15.0, 22, 16.5) }] },
  { key: 'milano-heavy', label: 'Milano Figarope, heavy', image: 'milano-figarope', code: 'CH2', rows: [
    { mm: 10, w: L3(24, 176.4, 26, 191.1, 28, 205.8) }, { mm: 7.5, w: L3(22, 112.2, 24, 122.4, 26, 132.6) }, { mm: 6.5, w: L3(22, 86.2, 24, 94.1, 26, 101.9) },
    { mm: 5, w: L3(22, 59.6, 24, 65.0, 26, 70.5) }] },
  { key: 'curb', label: 'Curb link', image: 'curb', code: 'Chart', rows: [
    chart(16.5, 70.0, 140.0, 157.5, 175.0, 192.5, 210.0, 227.5, 245.0, 262.5), chart(13.5, 38.0, 76.0, 85.5, 95.0, 104.5, 114.0, 123.5, 133.0, 142.5),
    chart(11, 29.6, 59.2, 66.6, 74.0, 81.4, 88.8, 96.2, 103.6, 111.0), chart(10, 17.2, 34.4, 38.7, 43.0, 47.3, 51.6, 55.9, 60.2, 64.5),
    chart(8, 12.2, 24.3, 27.4, 30.4, 33.4, 36.5, 39.5, 42.6, 45.6), chart(7, 9.4, 18.9, 21.2, 23.6, 26.0, 28.3, 30.7, 33.0, 35.4),
    chart(6, 6.9, 13.8, 15.5, 17.2, 18.9, 20.6, 22.4, 24.1, 25.8), chart(5, 5.0, 9.9, 11.2, 12.4, 13.6, 14.9, 16.1, 17.4, 18.6),
    chart(4, 3.0, 6.0, 6.8, 7.5, 8.3, 9.0, 9.8, 10.6, 11.3), chart(3, 2.3, 4.6, 5.2, 5.8, 6.4, 7.0, 7.5, 8.1, 8.7),
    chart(2.5, 1.8, 3.7, 4.1, 4.6, 5.1, 5.5, 6.0, 6.4, 6.9)] },
  { key: 'curb-light', label: 'Cuban / Curb, light', image: 'curb', code: 'CH6', rows: [
    { mm: 7.5, w: L3(22, 26.4, 24, 29.0, 26, 31.4) }, { mm: 6, w: L3(22, 18.4, 24, 20.1, 26, 21.8) }, { mm: 5, w: L3(20, 12.3, 22, 13.5, 24, 14.7) },
    { mm: 4, w: L3(20, 7.6, 22, 8.4, 24, 9.2) }, { mm: 3, w: L3(18, 4.8, 20, 5.3, 22, 5.8) }, { mm: 2, w: L3(16, 2.3, 18, 2.6, 20, 2.9) }] },
  { key: 'figaro', label: 'Figaro', image: 'figaro', code: 'Chart', rows: [
    chart(12, 43.2, 86.4, 97.2, 108.0, 118.8, 129.6, 140.4, 151.2, 162.0), chart(10, 33.4, 66.7, 75.1, 83.4, 91.7, 100.1, 108.4, 116.8, 125.1),
    chart(8, 21.0, 42.1, 47.3, 52.6, 57.9, 63.1, 68.4, 73.6, 78.9), chart(7, 14.6, 29.1, 32.8, 36.4, 40.0, 43.7, 47.3, 51.0, 54.6),
    chart(6, 10.1, 20.2, 22.7, 25.2, 27.7, 30.2, 32.8, 35.3, 37.8), chart(5, 8.4, 16.8, 18.9, 21.0, 23.1, 25.2, 27.3, 29.4, 31.5),
    chart(4, 5.8, 11.7, 13.1, 14.6, 16.1, 17.5, 19.0, 20.4, 21.9), chart(3.5, 3.9, 7.8, 8.8, 9.8, 10.8, 11.8, 12.7, 13.7, 14.7),
    chart(3, 2.9, 5.8, 6.5, 7.2, 7.9, 8.6, 9.4, 10.1, 10.8)] },
  { key: 'figaro-light', label: 'Figaro, light', image: 'figaro', code: 'CH7', rows: [
    { mm: 6, w: L3(22, 23.3, 24, 25.4, 26, 27.5) }, { mm: 5, w: L3(20, 15.0, 22, 16.5, 24, 18.0) }, { mm: 4, w: L3(20, 9.0, 22, 9.9, 24, 10.8) },
    { mm: 3, w: L3(18, 6.0, 20, 6.6, 22, 7.2) }, { mm: 2.5, w: L3(16, 3.3, 18, 3.7, 20, 4.1) }] },
  { key: 'franco', label: 'Franco', image: 'franco', code: 'CH9', rows: [
    { mm: 4, w: L3(22, 47.5, 24, 51.8, 26, 56.2) }, { mm: 3.2, w: L3(22, 29.0, 24, 31.7, 26, 34.3) }, { mm: 2.9, w: L3(22, 21.9, 24, 23.7, 26, 25.6) },
    { mm: 2.1, w: L3(20, 11.7, 22, 12.8, 24, 13.9) }, { mm: 1.8, w: L3(20, 7.7, 22, 8.5, 24, 9.2) }, { mm: 1.4, w: L3(18, 3.9, 20, 4.3, 22, 4.7) },
    { mm: 1.2, w: L3(16, 2.8, 18, 3.2, 20, 3.6) }, { mm: 1.0, w: L3(16, 2.3, 18, 2.6, 20, 2.9) }] },
  { key: 'valentino', label: 'Valentino', image: 'valentino', code: 'CH8', rows: [
    { mm: 4, w: L3(20, 7.3, 22, 8.1, 24, 8.9) }, { mm: 3, w: L3(18, 4.6, 20, 5.1, 22, 5.6) }, { mm: 2.5, w: L3(16, 2.5, 18, 2.9, 20, 3.3) },
    { mm: 1.5, w: L3(16, 1.3, 18, 1.5, 20, 1.7) }] },
  { key: 'box', label: 'Box', image: 'box', code: 'CH10', rows: [
    { mm: 1.3, w: L3(18, 5.3, 20, 5.9, 22, 6.5) }, { mm: 0.9, w: L3(16, 1.9, 18, 2.1, 20, 2.4) }, { mm: 0.6, w: L3(16, 1.0, 18, 1.1, 20, 1.2) }] },
  { key: 'cable', label: 'Cable / Tiffany / Rollo', image: 'cable', code: 'CH11', rows: [
    { mm: 1.8, w: L3(18, 3.4, 20, 3.8, 22, 4.2) }, { mm: 1.5, w: L3(16, 2.2, 18, 2.5, 20, 2.8) }, { mm: 1.2, w: L3(16, 1.8, 18, 2.0, 20, 2.2) }] },
];
export const chainLine = (k) => CHAIN_CATALOG.find((x) => x.key === k) || null;
// Stil iz forme (vrijednost ili natpis) -> red kataloga, dok zlatar ne izabere drugi. Flat Cuban, Tennis, Byzantine... nemaju red.
export function defaultChainLine(style) {
  const s = String(style || '').toLowerCase();
  if (!s || /flat|tennis|byzant|gucci|rolex|herring|anchor|mariner|turkish|paper|bangle|cuff|hermes|van.?cleef|charm|bead|snake|wheat|singapore|id\b/.test(s)) return '';
  if (/hollow/.test(s)) return 'cuban-hollow';
  if (/cuban|miami/.test(s)) return 'cuban-solid';
  if (/milano|figarope/.test(s)) return 'milano';
  if (/rope/.test(s)) return 'rope';
  if (/figaro/.test(s)) return 'figaro';
  if (/curb/.test(s)) return 'curb';
  if (/franco/.test(s)) return 'franco';
  if (/valentino/.test(s)) return 'valentino';
  if (/\bbox\b/.test(s)) return 'box';
  if (/cable|rol+o|tiffany/.test(s)) return 'cable';
  return '';
}
// Gustina u g/cm³ (katalog je 14K yellow gold): ista zapremina u drugom metalu.
const DENSITY = { '10k': 11.57, '14k': 13.07, '18k': 15.58, '22k': 17.8, '24k': 19.32, silver: 10.36, platinum: 21.45, palladium: 12.0 };
export function chainMetalFactor(metal, karat) {
  const m = key(metal);
  if (/platinum/.test(m)) return { k: DENSITY.platinum / DENSITY['14k'], name: 'platinum' };
  if (/silver|925/.test(m)) return { k: DENSITY.silver / DENSITY['14k'], name: 'silver' };
  if (/palladium/.test(m)) return { k: DENSITY.palladium / DENSITY['14k'], name: 'palladium' };
  if (/gold|two.?tone/.test(m) && !/dental/.test(m)) {
    const kt = key(karat).replace(/\s/g, '');
    if (DENSITY[kt]) return { k: DENSITY[kt] / DENSITY['14k'], name: kt.toUpperCase() };
    return { k: 1, name: '14K' };
  }
  return { k: 1, name: '' };
}
const perInch = (row) => { const e = Object.entries(row.w).filter(([l]) => Number(l) >= 16); const use = e.length ? e : Object.entries(row.w); return use.reduce((s, [l, g]) => s + g / Number(l), 0) / use.length; };
const r1 = (x) => Math.round(x * 10) / 10;
// Grami za lanac/narukvicu iz kataloga, ili null (isključeno, nepoznat stil, drugi komad).
export function chainWeight(pricing, spec) {
  const cw = pricing?.chainWeights;
  if (!cw?.on || !['chain', 'bracelet'].includes(spec?.type)) return null;
  const st = key(spec.style);
  const lk = cw.map && Object.prototype.hasOwnProperty.call(cw.map, st) ? cw.map[st] : defaultChainLine(st);
  const line = chainLine(lk);
  if (!line) return null;
  const def = DIM_DEFAULTS[spec.type];
  const w = Number(spec.widthMm) > 0 ? Number(spec.widthMm) : def.widthMm;
  const len = Number(spec.lengthIn) > 0 ? Number(spec.lengthIn) : def.lengthIn;
  const rows = [...line.rows].sort((a, b) => a.mm - b.mm);
  let g14; let how;
  const exact = rows.find((r) => Math.abs(r.mm - w) < 0.01);
  if (exact) {
    g14 = exact.w[len] ?? perInch(exact) * len;
    how = exact.w[len] != null ? `${line.code} ${w} mm, ${len}" in the catalog` : `${line.code} ${w} mm at ${r1(perInch(exact))} g per inch`;
  } else if (w > rows[0].mm && w < rows[rows.length - 1].mm) {
    const hi = rows.findIndex((r) => r.mm > w);
    const a = rows[hi - 1]; const b = rows[hi];
    const t = (w - a.mm) / (b.mm - a.mm);
    g14 = (perInch(a) + (perInch(b) - perInch(a)) * t) * len;
    how = `between ${a.mm} mm and ${b.mm} mm in the catalog`;
  } else {
    const near = w < rows[0].mm ? rows[0] : rows[rows.length - 1];
    // Daleko van kataloga (npr. Box 8 mm, katalog do 1,3 mm) razvlačenje izmišlja broj: grami po komadu, uz razlog.
    if (w / near.mm > 1.5 || w / near.mm < 0.6) {
      return { out: true, label: line.label, note: `${line.label} ${w} mm is outside the chart (${rows[0].mm} to ${rows[rows.length - 1].mm} mm), so grams per piece from Weight and labor are used.` };
    }
    g14 = perInch(near) * (w / near.mm) ** 2 * len;
    how = `scaled from the catalog's ${w < near.mm ? 'thinnest' : 'widest'} (${near.mm} mm)`;
  }
  const f = chainMetalFactor(spec.metal, spec.karat);
  const grams = r1(g14 * f.k);
  return {
    grams, grams14: r1(g14), line: line.key, label: line.label, widthMm: w, lengthIn: len, factor: f.k,
    text: `${line.label} ${w} mm × ${len}"`,
    note: `${line.label} ${w} mm × ${len}": ${r1(g14)} g in 14K (${how})${f.k !== 1 ? `, × ${f.k.toFixed(2)} for ${f.name || spec.metal}` : ''}.`,
  };
}

// ---------- Kamenje po površini (komadi van grillza, 22.11.2026) ----------
// Površina koja se okiva iz veličine komada (prsten po broju, privjesak po visini, lanac i narukvica dužina × širina,
// sat kućište + narukvica, minđuše po veličini), veličina kamena po komadu, kamenovi u gustom saću sa razmakom za
// krapne, karati okruglog briljanta ≈ 0.0042 × prečnik³ (1.3 mm ≈ 0.01 ct, 1.8 mm ≈ 0.025 ct). Procjena za ponudu,
// ne CAD; zlatar podešava cijenu po karatu i ugradnju.
const IN = 25.4;
const COVER_SHARE = { accents: 0.12, half: 0.5, full: 1 };
const COVER_NAME = { accents: 'accents', half: 'half iced', full: 'fully iced' };
const round2 = (x) => Math.round(x * 100) / 100;
const stoneName = (s) => (/^default$/i.test(s || '') ? 'diamonds' : String(s).toLowerCase());
function linkStone(w) { return w <= 4 ? 1.1 : w <= 6 ? 1.3 : w <= 9 ? 1.5 : w <= 11 ? 1.8 : 2; }
export const DIM_DEFAULTS = { ring: { ringSize: 8 }, pendant: { sizeIn: 2 }, chain: { lengthIn: 20, widthMm: 8 }, bracelet: { lengthIn: 7.5, widthMm: 8 }, watch: { caseMm: 40, band: 'metal bracelet' }, earrings: { earSize: 'medium' } };
export function stoneLayout(spec) {
  const t = spec.type;
  const def = DIM_DEFAULTS[t] || {};
  const v = (k) => (Number(spec[k]) > 0 ? Number(spec[k]) : def[k]);
  const share = COVER_SHARE[spec.coverage] ?? 1;
  let area = 0; let d = 1.3; let what = '';
  if (t === 'ring') {
    const size = v('ringSize');
    const inner = 11.63 + 0.8128 * size; // US veličina u unutrašnji prečnik (mm)
    area = (Math.PI * (inner + 3) * 5 + 90) * share; // spoljašnja strana šine 5 mm + vrh
    what = `size ${size} ring`;
  } else if (t === 'pendant') {
    const h = v('sizeIn');
    area = (h * IN) ** 2 * 0.55 * share; d = 1.5;
    what = `${h}" pendant`;
  } else if (t === 'chain' || t === 'bracelet') {
    const len = v('lengthIn') + (t === 'bracelet' ? 0.5 : 0);
    const w = v('widthMm');
    area = len * IN * w * 0.7 * share; d = linkStone(w); // gornja strana karika
    what = `${v('lengthIn')}" × ${w} mm ${t}`;
  } else if (t === 'watch') {
    const c = v('caseMm');
    const r = c / 2;
    const bezel = Math.PI * (r * r - (r - 4.5) ** 2);
    const sides = 2.4 * c * 7; // kućište i ušice
    const dial = Math.PI * (r - 4.5) ** 2 * 0.6;
    const metalBand = !/leather|rubber|strap/i.test(spec.band || def.band);
    const band = metalBand ? 160 * r * 0.7 : 0;
    const parts = String(spec.iceParts || '').split(',').filter(Boolean);
    if (parts.length) {
      // Izbor po dijelu sata: bezel = prsten oko stakla, face = brojčanik, bracelet = metalna narukvica.
      area = (parts.includes('bezel') ? bezel : 0) + (parts.includes('face') ? Math.PI * (r - 4.5) ** 2 * 0.85 : 0) + (parts.includes('bracelet') ? (band || 160 * r * 0.7) : 0);
      what = `${c} mm watch, ${parts.map((x) => (x === 'face' ? 'dial' : x)).join(' + ')} only`;
    } else {
      area = spec.coverage === 'accents' ? bezel * 0.5 : spec.coverage === 'half' ? bezel + sides : bezel + sides + dial + band;
      what = `${c} mm watch${metalBand ? ' with metal bracelet' : ''}`;
    }
    d = 1.4;
  } else if (t === 'earrings') {
    const one = { small: 35, medium: 80, statement: 180 }[String(v('earSize')).toLowerCase()] || 80;
    area = 2 * one * share;
    what = `pair of ${String(v('earSize')).toLowerCase()} earrings`;
  } else {
    area = 600 * share;
    what = t || 'piece';
  }
  const pitch = d + 0.25;
  const count = Math.max(1, Math.round(area / (0.866 * pitch * pitch)));
  const ct = round2(count * 0.0042 * d ** 3);
  const coverName = t === 'watch' && spec.iceParts ? 'iced' : COVER_NAME[spec.coverage] || 'iced';
  return { area: Math.round(area), d, count, ct, note: `Stone count estimated from the surface of a ${what}, ${coverName} (about ${Math.round(area).toLocaleString('en-US')} mm²); adjust the price per carat or the final price if your setting differs.` };
}
// Prirodni dijamanti: čistoća podiže cijenu po karatu (SI osnova).
function clarityFactor(spec) {
  if (!/natural/i.test(spec.stones || '')) return { k: 1 };
  const c = key(spec.clarity);
  if (/vvs/.test(c)) return { k: 1.5, note: 'VVS clarity: price per carat × 1.5' };
  if (/^vs/.test(c)) return { k: 1.25, note: 'VS clarity: price per carat × 1.25' };
  if (/flawless|^if$/.test(c)) return { k: 2, note: 'Flawless: price per carat × 2' };
  return { k: 1 };
}
function centerStones(spec) {
  const ct = Number(spec.centerCt);
  if (!(ct > 0)) return null;
  if (spec.type === 'earrings') return { ct: round2(ct * 2), label: `Stud stones, 2 × ${ct} ct` };
  if (spec.type === 'ring') return { ct, label: 'Center stone' };
  return null;
}

// Middle ground: korak po korak najmanje vidljive izmjene dok cijena ne stane u gornju granicu budžeta.
// Redoslijed: vrsta kamena (jeftinija), karat (niži), pokrivenost (manja), metal (jeftiniji, npr. dental gold, bez kamenja).
// choices: izbori koje forma nudi { stones: [natpisi], karats: [...], coverages: ['accents','half','full'], metals: [...] }.
// Boja metala (27.11.2026, District: "if someone wants gold it kinda ruins it to recommend silver, it's a different
// color"). Opcija bliža budžetu nikad ne mijenja boju: žuto ostaje žuto (zlato -> niži karat ili dental gold), bijelo
// ostaje bijelo (bijelo zlato -> srebro), rose ostaje rose.
export function metalTone(m) {
  const t = key(m);
  if (!t) return '';
  if (/two.?tone/.test(t)) return 'two';
  if (/rose|pink/.test(t)) return 'rose';
  if (/yellow|dental/.test(t)) return 'yellow';
  if (/white|silver|925|platinum|palladium|steel|stainless/.test(t)) return 'white';
  if (/gold/.test(t)) return 'yellow';
  return t;
}
// Kamenje od najskupljeg ka najjeftinijem, istog izgleda (District: "high end diamonds -> lower end diamonds, or fake
// diamonds to match the aesthetics and budget"): prirodni, pa lab, pa moissanite / CZ.
export function stoneRank(s) {
  const t = key(s);
  if (/moiss|cz|cubic|simulat|crystal|fake|vvs moiss/.test(t)) return 1;
  if (/lab/.test(t)) return 2;
  if (/natural|diamond|default/.test(t)) return 3;
  return 2;
}
const CLARITY_ORDER = ['i1', 'si2', 'si', 'si1', 'vs2', 'vs', 'vs1', 'vvs2', 'vvs', 'vvs1', 'if', 'flawless', 'fl'];
const clarityRank = (c) => { const t = key(c).replace(/[^a-z0-9]/g, ''); const i = CLARITY_ORDER.indexOf(t) >= 0 ? CLARITY_ORDER.indexOf(t) : CLARITY_ORDER.findIndex((x) => t.startsWith(x)); return i < 0 ? null : i; };

export function middleGround(pricing, spec, budgetHigh, choices = {}) {
  const start = estimate(pricing, spec);
  if (start.total == null || !Number.isFinite(budgetHigh)) return null;
  if (start.total <= budgetHigh) return { spec, total: start.total, changes: [], fits: true };
  let cur = { ...spec };
  let total = start.total;
  const changes = [];
  const priced = (s) => estimate(pricing, s).total;
  const tone = metalTone(spec.metal);
  const iced = !!spec.coverage;
  // Redoslijed od najmanje vidljive promjene ka većoj: čistoća prirodnih dijamanata, jeftinije kamenje istog izgleda,
  // niži karat, metal iste boje, pa tek onda manje leda (nikad bez leda kad ga je kupac izabrao).
  const steps = [
    () => cur.coverage && /natural/i.test(cur.stones || '') && clarityRank(cur.clarity) != null
      && (choices.clarities || []).filter((x) => clarityRank(x) != null && clarityRank(x) < clarityRank(cur.clarity)).map((x) => ({ ...cur, clarity: x })),
    () => cur.coverage && (choices.stones || []).filter((x) => key(x) !== key(cur.stones) && stoneRank(x) < stoneRank(cur.stones)).map((x) => ({ ...cur, stones: x })),
    () => cur.karat && (choices.karats || []).filter((x) => PURITY[key(x)] && PURITY[key(x)] < (PURITY[key(cur.karat)] || 0)).map((x) => ({ ...cur, karat: x })),
    () => (choices.metals || []).filter((x) => key(x) !== key(cur.metal) && metalTone(x) === tone && !(/dental/i.test(x) && iced))
      .map((x) => (/dental/i.test(x) ? { ...cur, metal: x, karat: '', stones: '', coverage: '', ice: '', iceParts: '' } : { ...cur, metal: x })),
    () => cur.coverage && (choices.ices || LEVELS.slice(0, LEVELS.indexOf(cur.coverage)).filter((x) => !choices.coverages || choices.coverages.includes(x)).map((x) => ({ value: x, level: x, parts: '', custom: false })))
      .filter((o) => o.value !== iceKey(cur) && o.value !== 'none' && LEVELS.indexOf(o.level) >= 0 && LEVELS.indexOf(o.level) < LEVELS.indexOf(cur.coverage)).map((o) => ({ ...cur, ...iceFields(o) })),
  ];
  const label = { clarity: 'Clarity', stones: 'Stones', karat: 'Karat', coverage: 'How iced', metal: 'Metal' };
  const val = (s, f) => (f === 'coverage' ? iceKey(s) : s[f]);
  for (const [si, step] of steps.entries()) {
    if (total <= budgetHigh) break;
    // Najbliži izbor koji stane, a ako nijedan ne stane, najjeftiniji (pa idući korak nastavlja od njega). Led je izuzetak:
    // kad ništa ne stane, samo jedan nivo manje (Fully -> Half), ne odmah Accents.
    const opts = (step() || []).map((s) => ({ s, t: priced(s) })).filter((o) => o.t != null && o.t < total);
    if (!opts.length) continue;
    const fits = opts.filter((o) => o.t <= budgetHigh).sort((a, b) => b.t - a.t)[0];
    const fit = fits || (si === steps.length - 1 ? opts.sort((a, b) => b.t - a.t)[0] : opts.sort((a, b) => a.t - b.t)[0]);
    cur = fit.s;
    total = fit.t;
  }
  // Promjene od kupčevog izbora do konačnog (jedan red po polju); čistoća se ne pominje kad kamenje više nije prirodno.
  for (const f of ['clarity', 'stones', 'karat', 'coverage', 'metal']) {
    if (f === 'clarity' && !/natural/i.test(cur.stones || '')) continue;
    if (key(val(cur, f)) !== key(val(spec, f))) changes.push({ what: label[f], from: val(spec, f) || 'none', to: val(cur, f) || 'none' });
  }
  if (!/natural/i.test(cur.stones || '') && cur.clarity !== spec.clarity) cur = { ...cur, clarity: spec.clarity };
  return { spec: cur, total, changes, fits: total <= budgetHigh };
}

// ---------- Specifikacija leada (portal i server, 19.11.2026) ----------
// Isti račun u portalu i na serveru: server sam napiše prvu poruku čim stigne upit i pokaže cijene na stranici kupca.
// fs = izbori forme kao natpisi (pricingSpec u workeru), a = odgovori kupca.
export function leadSpecFrom(fs, a = {}) {
  if (!fs || !a?.type) return null;
  const lab = (list, v) => (list || []).find((o) => o.value === v)?.label || '';
  // Izbori koje taj komad stvarno nudi (perPiece u formi, 22.11.2026: District nudi bezel / face / bracelet samo za sat).
  const pick = (k) => { const allow = fs.per?.[k]?.[a.type]; return Array.isArray(allow) ? (fs[k] || []).filter((o) => allow.includes(o.value)) : fs[k] || []; };
  const covOpts = pick('coverage').filter((o) => o.value !== 'none');
  const ices = covOpts.map((o) => ({ value: o.value, label: o.label, ...iceInfo(o.value, o.label) }));
  const covOpt = (fs.coverage || []).find((o) => o.value === a.coverage);
  const ice = a.coverage && a.coverage !== 'none' ? (covOpt ? iceInfo(covOpt.value, covOpt.label) : LEVELS.includes(a.coverage) ? { level: a.coverage, parts: '', custom: false } : null) : null;
  const iced = !!ice;
  return {
    spec: {
      type: a.type, metal: lab(fs.metal, a.metal) || a.metal || '', karat: lab(fs.karat, a.karat) || a.karat || '',
      stones: iced ? (a.stones && a.stones !== 'none' ? lab(fs.stones, a.stones) || a.stones : 'default') : '',
      ...(iced ? iceFields({ value: a.coverage, ...ice }) : { coverage: '', ice: '', iceParts: '' }),
      cut: iced ? '' : lab(fs.cut, a.cut) || a.cut || '', units: String(a.teeth || '').split(',').filter(Boolean).length || 1,
      teeth: a.teeth || '', clarity: a.clarity || '', style: a.style || '',
      ...dimsFrom(fs.dims, a),
    },
    budget: parseBudget(lab(fs.budget, a.budget) || a.budget),
    budgetLabel: lab(fs.budget, a.budget) || a.budget || '',
    choices: { stones: pick('stones').filter((o) => o.value !== 'none').map((o) => o.label), karats: pick('karat').map((o) => o.label), clarities: pick('clarity').map((o) => o.label), coverages: covOpts.map((o) => o.value).filter((v) => LEVELS.includes(v)), ices, metals: pick('metal').map((o) => o.label) },
    opts: {
      coverage: covOpts.map((o) => [o.value, o.label]),
      ice: Object.fromEntries(ices.map((o) => [o.value, o])),
      clarity: pick('clarity').map((o) => o.label), cut: (fs.cut || []).map((o) => o.label),
    },
  };
}

// ---------- Izbori leda po dijelu komada (22.11.2026) ----------
// Forma može nuditi i "Bezel iced-out", "Face iced-out", "Bracelet iced-out" (sat). Iz vrijednosti i natpisa se
// izvede nivo (accents / half / full, za grillz i stari račun) i dijelovi (bezel, face, bracelet) za račun kamenja.
// spec.coverage ostaje nivo; spec.ice = vrijednost izbora kad nije običan nivo; spec.iceParts = dijelovi.
export function iceInfo(value, label) {
  const t = `${value} ${label}`.toLowerCase();
  const parts = [/bezel/.test(t) && 'bezel', /face|dial/.test(t) && 'face', /bracelet|band|strap|link/.test(t) && 'bracelet'].filter(Boolean);
  const level = /full|fully|entire|bust/.test(t) && !parts.length ? 'full'
    : LEVELS.includes(value) && !parts.length ? value
    : /accent/.test(t) ? 'accents' : parts.length ? 'half' : /half/.test(t) ? 'half' : 'full';
  return { level, parts: parts.join(','), custom: !!parts.length || !LEVELS.includes(value) };
}
export function iceFields(o) {
  return { coverage: o.level, ice: o.custom ? o.value : '', iceParts: o.parts || '' };
}
// Izbor leda kako ga forma zove (za natpis, čipove i poređenje).
export const iceKey = (s) => s?.ice || s?.coverage || '';


// Veličina komada iz odgovora (22.11.2026): polja forme sa prefiksom komada (chain_length, ring_ring_size...) se
// svode na ključ (length, ring_size...) u pricingAnswers kao d_<ključ>; ovdje natpis izbora postaje broj.
export const DIM_FIELDS = ['ring_size', 'length', 'width', 'size', 'case_size', 'band', 'carat', 'stone_size'];
export function dimKey(id) {
  const k = String(id || '').replace(/^(ring|chain|bracelet|pendant|earrings|watch|grillz)_/, '');
  if (/^stone_size/.test(k)) return 'stone_size';
  return DIM_FIELDS.includes(k) ? k : null;
}
function dimsFrom(dims, a) {
  const out = {};
  // Odgovori dolaze ili sirovi (portal: chain_length) ili očišćeni na serveru (d_length).
  const raw = {};
  for (const [k, v] of Object.entries(a)) { const d = k.startsWith('d_') ? k.slice(2) : dimKey(k); if (d && v != null && v !== '' && typeof v !== 'object') raw[d] = String(v); }
  const label = (k) => { const v = raw[k]; return v == null ? '' : (dims?.[k] || []).find((o) => o.value === v)?.label || v; };
  const n = (s) => { const x = parseFloat(String(s).replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : null; };
  const t = a.type;
  if (t === 'ring' && n(label('ring_size'))) out.ringSize = n(label('ring_size'));
  if (t === 'ring' && n(label('carat'))) out.centerCt = n(label('carat'));
  if (t === 'ring' && label('band')) out.band = label('band');
  if ((t === 'chain' || t === 'bracelet') && n(label('length'))) out.lengthIn = n(label('length'));
  if ((t === 'chain' || t === 'bracelet') && n(label('width'))) out.widthMm = n(label('width'));
  if (t === 'pendant' && n(label('size'))) out.sizeIn = n(label('size'));
  if (t === 'earrings' && label('size')) out.earSize = label('size');
  if (t === 'earrings' && n(label('stone_size'))) out.centerCt = n(label('stone_size'));
  if (t === 'watch' && n(label('case_size'))) out.caseMm = n(label('case_size'));
  if (t === 'watch' && label('band')) out.band = label('band');
  return out;
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
  add('Ice', coverLabel(iceKey(a), ls), coverLabel(iceKey(spec), ls));
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
    ice: spec.coverage ? coverLabel(iceKey(spec), ls) : '', stones: spec.coverage ? spec.stones : '', clarity: spec.coverage && /natural/i.test(spec.stones) ? spec.clarity : '',
    cut: spec.type === 'grillz' && !spec.coverage ? spec.cut : '', teeth: spec.type === 'grillz' ? { top: r.top, bottom: r.bottom } : null,
    total: Math.round(est.total), lines: est.lines.map((x) => ({ label: x.label, amount: Math.round(x.amount) })),
    budget: ls.budgetLabel, changes: specDiff(ls, spec),
  };
}
