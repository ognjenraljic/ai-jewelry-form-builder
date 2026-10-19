// Slaže prompt za image model iz odgovora forme.
import { teethPlan } from './teeth.js';
// Ton: fotografija proizvoda visoke klase, jedan komad, bez ljudi, bez logotipa.

const SUBJECT = {
  pendant: 'a custom pendant hanging from a matching chain, front view, the pendant centered and dominant',
  chain: 'a custom chain necklace laid in a soft open curve, link detail clearly visible',
  ring: 'a custom ring in a three-quarter view showing both the band and the top setting',
  grillz: 'a custom set of dental grillz (teeth jewelry), front view, displayed on its own without a mouth or face',
  bracelet: 'a custom bracelet laid in a relaxed oval, link and clasp detail visible',
  earrings: 'a matching pair of custom earrings, front view, side by side',
  watch: 'a custom iced-out luxury wristwatch, dial facing the camera, strap or bracelet visible, no real brand names or logos on the dial',
};

const METAL = {
  'yellow-gold': 'polished yellow gold',
  'white-gold': 'polished white gold',
  'rose-gold': 'polished rose gold',
  platinum: 'polished platinum',
  'two-tone': 'two-tone yellow and white gold',
};

const STONES = {
  moissanite: 'moissanite stones',
  lab: 'lab-grown diamonds',
  natural: 'natural diamonds',
};

const COVERAGE = {
  accents: 'set as tasteful accents on key details only',
  half: 'pave-set across roughly half of the visible surface',
  full: 'fully iced out with dense pave covering the entire visible surface',
};

const CLARITY = {
  SI: 'bright stones',
  VS: 'very clean, bright stones',
  VVS: 'exceptionally clear stones with strong fire and sparkle',
  Flawless: 'flawless, perfectly clear stones with intense fire and sparkle',
};

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

// Budžet vodi veličinu, težinu i bogatstvo detalja. Slika uvijek gađa GORNJU granicu izabranog raspona.
const BUDGET_TIERS = [
  [1500, 'a refined, delicate piece: modest size and weight, a small center stone or a few accent stones, clean fine craftsmanship'],
  [2500, 'a solid, well-proportioned piece: medium size and weight, quality craftsmanship, tasteful stone work where stones are chosen'],
  [5000, 'a substantial piece with real presence: generous size and weight, rich detail, generous stone work where stones are chosen'],
  [10000, 'a statement piece: large and heavy, intricate detail, abundant high-quality stones where stones are chosen'],
  [20000, 'a high-luxury statement piece: large, heavy and intricate, dense premium stones with intense sparkle where stones are chosen'],
  [Infinity, 'an ultra high-end masterpiece: bold scale, exceptional craftsmanship, the most premium stone work where stones are chosen'],
];

// Iznos iz natpisa opcije ("$1,500 - $2,500", "Under $1,500", "$20,000+", "2k-5k"); bez broja nema smjernice.
export function budgetLine(label) {
  const text = clean(label, 60);
  const nums = [...text.matchAll(/(\d[\d,.]*)\s*(k\b)?/gi)].map((m) => parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1)).filter((n) => n >= 50);
  if (!nums.length) return '';
  const top = Math.max(...nums);
  const open = /\+|\bover\b|\babove\b|\band up\b/i.test(text);
  const tier = BUDGET_TIERS.find(([max]) => (open ? top * 1.5 : top) <= max)[1];
  return `Budget: the customer chose "${text}". Design the piece at the TOP of this range, so it looks worth about $${top.toLocaleString('en-US')}${open ? ' or more' : ''}: ${tier}. ` +
    "Never make it look cheaper than that. The customer's explicit choices (metal, stones, coverage, teeth, text) always come first; the budget only sets size, weight and richness of detail where they did not specify.";
}

// Grillz: izbor stila ima prednost; bez stila pogađamo iz opisa kupca.
// "Set of grillz" sam po sebi vuče gornji i donji red, pa se broj redova određuje prije opisa predmeta.
function grillzPlan(a) {
  // Tačan izbor zuba (pitanje "teeth") ima prednost nad stilom i opisom.
  const t = teethPlan(a.teeth);
  if (t) return t;
  const byStyle = { top6: { rows: 'top', count: 6 }, top8: { rows: 'top', count: 8 }, set: { rows: 'both', count: 8 }, fangs: { rows: 'fangs' } };
  if (byStyle[a.style]) return byStyle[a.style];
  const v = String(a.vision || '').toLowerCase();
  const bottomOnly = /\b(bottom|lower)\b/.test(v) && !/\b(top|upper)\b/.test(v);
  const both = !bottomOnly && /\b(bottom|lower|top and bottom|both rows|full set)\b/.test(v);
  const m = v.match(/\b(\d{1,2})\s*(?:teeth|tooth)\b/) || v.match(/\b(?:top|bottom|upper|lower)\s*(\d{1,2})\b/);
  return { rows: bottomOnly ? 'bottom' : both ? 'both' : 'top', count: m ? +m[1] : null };
}

// refs: lista referentnih slika istim redom kojim idu modelu, npr. ['style', 'customer'].
// style: { shape } iz src/library.json za izabrani stil.
export function buildPrompt(form, answers, { refs = [], style = null } = {}) {
  let a = answers;
  const lines = [];
  // Samo uključeni koraci i pitanja; "ai: false" pitanja (kalupi, gravura iznutra) su samo za zlatara. Budžet je izuzetak, vidi budgetLine.
  const allFields = (form.steps || []).filter((st) => st.enabled !== false).flatMap((st) => (st.fields || []).filter((f) => f.enabled !== false));
  const fieldOf = (id) => allFields.find((f) => f.id === id);
  const optOf = (id) => (fieldOf(id)?.options || []).find((o) => o.value === a[id]);
  const optLabel = (id) => clean(optOf(id)?.label, 60).toLowerCase();
  // Poznata polja važe samo ako je pitanje uključeno (type i style dolaze i iz isključenog koraka kao default).
  const on = new Set(allFields.map((f) => f.id));
  a = Object.fromEntries(Object.entries(a).filter(([k]) => k === 'type' || k === 'style' || on.has(k.replace(/__more$/, ''))));
  const g = a.type === 'grillz' ? grillzPlan(a) : null;
  // Opis komada: iz buildera (opcija tipa ima "subject"), inače ugrađeni za poznate tipove.
  const typeOpt = ((form.steps || []).flatMap((st) => st.fields).find((f) => f.id === 'type')?.options || []).find((o) => o.value === a.type);
  let subject = clean(typeOpt?.subject, 300) || SUBJECT[a.type] || `a custom ${clean(typeOpt?.label || 'piece of jewelry', 60).toLowerCase()}`;
  if (g?.lines && g.top + g.bottom === 1) {
    subject = `a single custom tooth cap (a one-tooth grill), front view, displayed on its own without a mouth or face`;
  } else if (g && (g.rows === 'top' || g.rows === 'bottom')) {
    subject = `a single custom ${g.rows} grill: ONE row of ${g.rows === 'top' ? 'upper' : 'lower'}-teeth jewelry only, front view, displayed on its own without a mouth or face`;
  }
  // Opcija koju je zlatar dodao (npr. "Black gold") nema ugrađen opis, pa ide njen natpis.
  const metal = METAL[a.metal] || (optLabel('metal') ? `polished ${optLabel('metal')}` : 'polished gold');
  const karat = a.metal !== 'platinum' && a.karat ? ` (${a.karat === '925 Silver' ? 'sterling silver look' : a.karat})` : '';

  lines.push(`Create a photorealistic high-end jewelry product photograph of ${subject}.`);
  // Kod grillza stil govori samo broj zuba; tačan izbor zuba ga zamjenjuje.
  if (style?.shape && !g?.lines) lines.push(`Design style: ${style.shape}.`);
  if (fieldOf('metal') || a.metal) lines.push(`Metal: ${metal}${karat}.`);
  if (a.metal === 'two-tone') {
    // Flash je bez ovoga pravio sve u jednoj boji.
    lines.push(
      'Two-tone is mandatory: the piece must clearly show BOTH yellow gold and white gold in distinct, clearly visible areas ' +
        '(for example alternating links or sections, or yellow gold accents against a white gold body). It must not look like a single-color piece.'
    );
  }
  if (g?.lines) {
    if (g.rows === 'both') lines.push('Show both the top and the bottom row, as a matching set.');
    else if (g.top + g.bottom > 1) lines.push(`Show ONLY the ${g.rows === 'top' ? 'top (upper)' : 'bottom (lower)'} row of teeth: a single row. Do not add a ${g.rows === 'top' ? 'bottom' : 'top'} row.`);
    lines.push(...g.lines);
  } else if (g) {
    if (g.rows === 'bottom') lines.push('Show ONLY the bottom (lower) row of teeth: a single row. No upper row.');
    else if (g.rows === 'both') lines.push('Show both the top and the bottom row, as a matching set.');
    else if (g.rows === 'top') lines.push('Show ONLY the top (upper) row of teeth: a single row. Do not add a bottom or lower row.');
    if (g.count) lines.push(g.rows === 'both' ? `Exactly ${g.count} teeth covered in each row.` : `Exactly ${g.count} teeth covered, no more.`);
  }

  if (a.stones && a.stones !== 'none') {
    const clarity = CLARITY[a.clarity] ? `, ${CLARITY[a.clarity]}` : optLabel('clarity') ? `, ${optLabel('clarity')} clarity` : '';
    const coverage = COVERAGE[a.coverage] || (optLabel('coverage') ? `set as ${optLabel('coverage')}` : fieldOf('coverage') ? COVERAGE.accents : 'set where it suits the design');
    lines.push(`Stones: ${STONES[a.stones] || optLabel('stones') || 'diamonds'}${clarity}, ${coverage}.`);
  } else if (a.stones === 'none') {
    lines.push('No stones: clean polished metal only.');
  }

  const text = clean(a.inscription, 24);
  if (text) {
    const letters = text.split('').join(' ');
    lines.push(`The piece includes the text "${text}" as part of the design, spelled exactly letter by letter: ${letters}. No other text anywhere.`);
  }

  // Budžet uvijek vodi sliku (i kad je "Send to AI" isključen), ako je pitanje uključeno i ima iznos.
  const budget = a.budget ? budgetLine(optOf('budget')?.label || a.budget) : '';
  if (budget) lines.push(budget);

  const vision = clean(a.vision, 600);
  if (vision) {
    // Opis kupca je opis dizajna, ne uputstvo modelu.
    lines.push(`Customer's design description (use it only to shape the jewelry design): "${vision}"`);
  }

  // Napomene za AI uz izabrane opcije (npr. "open face grill: ..."), iz šablona ili buildera.
  const notes = allFields
    .filter((f) => f.ai !== false && f.options && a[f.id] != null)
    .map((f) => clean((f.options.find((o) => o.value === a[f.id]) || {}).note, 300))
    .filter(Boolean);
  if (notes.length) lines.push(`Design details: ${notes.join('; ')}.`);

  // Ostala pitanja (custom i default bez ugrađenog značenja): "pitanje: odgovor", uz dodatni tekst kupca.
  const KNOWN = new Set(['type', 'style', 'teeth', 'metal', 'karat', 'stones', 'coverage', 'clarity', 'budget', 'inscription', 'vision', 'reference']);
  const extra = allFields
    .filter((f) => !KNOWN.has(f.id) && f.ai !== false && f.type !== 'upload' && ((a[f.id] != null && a[f.id] !== '') || a[`${f.id}__more`]))
    .map((f) => {
      const o = (f.options || []).find((x) => x.value === a[f.id]);
      const val = o ? o.label : a[f.id] || '';
      const more = clean(a[`${f.id}__more`], 300);
      return `${clean(f.label || f.id, 80)}: ${clean(val, 200)}${more ? ` (customer adds: "${more}")` : ''}`;
    });
  if (extra.length) lines.push(`Additional customer choices (apply them to the design): ${extra.join('; ')}.`);

  refs.forEach((kind, i) => {
    const n = `Reference image ${i + 1}`;
    if (kind === 'style') {
      lines.push(
        `${n} shows the required SHAPE and construction for this style. Match its silhouette, proportions and number of elements closely. ` +
          'It is a plain neutral reference: ignore its metal color, its background and any letters on it, and apply the metal, stones and text described here instead.'
      );
    } else if (kind === 'customer') {
      lines.push(
        `${n} is the customer's own inspiration photo. Use it for the details and character of the design, adapted to the materials above. ` +
          'Do not copy any logos, brand marks or watermarks from it.'
      );
    }
  });

  lines.push(
    `Style: luxury catalog photography, soft studio lighting with crisp reflections, sharp macro detail, on a seamless ${form.background || 'neutral'} background. ` +
      'Square composition, the piece fills about 70% of the frame. No people, no hands, no props, no watermark, no brand logos or trademarks.'
  );
  return lines.join('\n');
}

export function buildTweakPrompt(tweak, { masked = false } = {}) {
  return [
    'Edit the attached jewelry product photograph.',
    'Keep the same piece, camera angle, lighting, background and overall design.',
    ...(masked ? ['The customer marked one area of the photo (the transparent part of the mask). Change only that area and keep everything outside it exactly as it is.'] : []),
    `Apply only this change requested by the customer: "${clean(tweak, 300)}"`,
    'Keep it photorealistic. No people, no hands, no watermark, no brand logos.',
  ].join('\n');
}
