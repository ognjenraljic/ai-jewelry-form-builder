// Slaže prompt za image model iz odgovora forme.
import { teethPlan } from './teeth.js';
import { artCategory } from '../public/option-art.js';
// Ton: fotografija proizvoda visoke klase, jedan komad, bez ljudi, bez logotipa.

const SUBJECT = {
  pendant: 'a custom pendant hanging from a matching chain, front view, the pendant centered and dominant',
  chain: 'a custom chain necklace: ONE single continuous strand laid in one soft open curve, every link connected in order, never coiled into two loops or separate rings, link detail clearly visible',
  ring: 'a custom ring in a three-quarter view showing both the band and the top setting',
  grillz: 'a custom set of dental grillz (teeth jewelry), front view, displayed on its own without a mouth or face',
  bracelet: 'a custom bracelet laid in one relaxed oval, a single continuous closed loop joined at the clasp, never doubled or stacked, link and clasp detail visible',
  earrings: 'a matching pair of custom earrings, front view, side by side',
  watch: 'a custom luxury wristwatch (how much it is iced follows the stone choices below), dial facing the camera, strap or bracelet visible, no real brand names or logos on the dial',
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
  half: 'pave-set across roughly half of the visible outer surface',
  full: 'fully iced out with dense pave covering the entire visible outer surface',
};

const CLARITY = {
  SI: 'bright stones',
  VS: 'very clean, bright stones',
  VVS: 'exceptionally clear stones with strong fire and sparkle',
  Flawless: 'flawless, perfectly clear stones with intense fire and sparkle',
};

// Kamenje ide samo spolja: model je okivao i unutrašnjost prstena (Ognjen 15.11). Dio koji dodiruje kožu je uvijek gladak metal.
const INNER = {
  ring: 'the inside of the band (the part that touches the finger) is always smooth polished metal, never set with stones',
  bracelet: 'the inner side of the bracelet that touches the wrist is smooth polished metal, never set with stones',
  grillz: 'the back of each cap that touches the tooth is plain metal; stones only on the front faces',
  pendant: 'the back of the pendant is plain polished metal; stones only on the front',
  earrings: 'the backs and posts are plain metal; stones only on the front',
  watch: 'the case back and the inner side of the band are plain metal; stones only on the bezel, dial, case sides and outer links',
  chain: 'stones only on the outer face of the links; the side that lies against the skin is plain metal',
};
// Opšte pravilo za svaki render i svaku doradu, i kad kupac led traži samo opisom ili doradom ("make it more iced"):
// iznutra (prsten, sat, narukvica, poleđina) nikad nema leda (Ognjen 16.11: "i to kao pravilo").
export const INSIDE_RULE = (type) => `Rule for any icing, pave or stones on this piece, now or in any change: ${INNER[type] || 'any surface that touches the skin stays smooth polished metal'}. Never ice or set stones on the inside or the back.`;
// "How iced?" = None (zlatar ga postavi kao prvo pitanje o kamenju): bez kamenja na metalu, čak i kad stil inače ima led.
const NOT_ICED = (type) => `Not iced: no pave, no accent stones and no diamonds on the metal surfaces, even if the style is usually iced; clean polished metal${type === 'ring' ? '. A center stone is set only if one is specified in these instructions' : ''}.`;

// Referentne slike stilova sa natpisom nose probnu riječ ("Name"). Model ju je prepisivao umjesto kupčevog teksta
// (District 19.11.2026: Layna i FLOW su izašli kao "Name"). Kad kupac upiše natpis, ta slika se ne šalje (worker.js),
// a prompt u svakom slučaju kaže da je riječ sa slike samo zamjena.
const LETTER_REFS = { '/library/pendant/script.webp': 'Name', '/library/pendant/block.webp': 'NAME' };
export const placeholderWord = (style) => LETTER_REFS[String(style?.image || '').replace(/^\/library-light\//, '/library/')] || '';

// Grillz kao pravi zubi (District 19.11.2026): slika je redala kape ravno jednu do druge, a video ih je "skupio" u
// zubni luk i to je izgledalo mnogo bolje. Oblik luka i anatomija zuba idu u svaki grillz render sa više od jedne kape.
const GRILLZ_ARCH = (both) =>
  'Shape of the grill (important): the caps sit exactly as they would on real teeth and form a natural curved dental arch, never a flat straight strip of equal blocks. ' +
  'Seen from the front at eye level with real perspective: the front teeth are closest to the camera, the side teeth curve back along the arch, so they look narrower and slightly turned away. ' +
  'Every cap has real tooth anatomy: wide central incisors, slightly narrower lateral incisors, longer pointed canines, shorter rounded premolars, each with a softly domed front, rounded corners and a natural biting edge; the edge at the gum line follows a gentle scalloped curve. ' +
  'Caps on neighboring selected teeth touch side by side like a real one-piece grill, with a fine groove marking each tooth; they are not spaced apart.' +
  (both ? ' The top row sits above the bottom row like a slightly open smile, the lower arch nested just beneath the upper one, with a small dark gap between the rows.' : '');

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Podrazumijevani opis izbora za AI kad zlatar nije upisao svoju napomenu (po natpisu izbora).
// Rezovi i settingi po opisima Districtovog majstora (Ricky, 16.11.2026), da render pogodi baš taj rez.
const CHOICE_NOTES = {
  cut: {
    polished: 'polished: plain high-polish mirror look on every cap, smooth metal with no engraving',
    solid: 'polished: plain high-polish mirror look on every cap, smooth metal with no engraving',
    'open-face': 'open face: opening window cutouts, each cap is only a metal outline frame with the center open so the natural tooth shows through',
    'diamond-cut': 'diamond cut: angled slash cuts crossing over every cap, a bright faceted diamond lattice engraved into polished metal',
    'diamond-cut-n-dust': 'diamond cut and dust: angled slash cuts with a dusted background, bright crossing cuts over a frosted sandblasted matte surface',
    'nugget-cut': 'nugget cut: spaced out slash cuts with a dusted background, short scattered bright cuts over a frosted matte surface like a gold nugget',
    'rose-cut': 'rose cut: a flower rose cut effect, spiral rose petals engraved into the face of every cap',
    'perm-cut': 'perm cut: deep cuts between each tooth to give an individual look, every cap reads as a separate tooth, smooth polished surface',
    'weed-cut': 'weed cut: an upwards leaf cut pattern, rows of diagonal slash cuts angled upward from a center line on every cap, like a leaf',
    'pineapple-cut': 'pineapple cut: a dense crosshatched grid of small faceted diamond cuts covering every cap like pineapple skin',
    'starburst-cut': 'starburst cut: star slash cuts radiating from the center of every cap over a dusted frosted background',
  },
  setting: {
    pave: 'pave setting: small round stones set in an alternating honeycomb pattern, covering the surface',
    straight: 'straight setting: stones set in neat straight rows and columns',
    invisible: 'invisible setting: princess cut square stones set edge to edge in straight rows with no visible prongs',
    jumbo: 'jumbo setting: large stones set into an alternating pattern, fewer but bigger stones',
    mosaic: 'mosaic setting: stones of mixed sizes clustered together like a mosaic, large stones surrounded by small ones',
  },
};
export function choiceNote(field, option) {
  if (!option) return '';
  if (option.note) return option.note;
  const cat = artCategory(field.id) || artCategory(slug(field.label));
  return CHOICE_NOTES[cat]?.[slug(option.label)] || '';
}

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

// Polirano zlato u studiju zna da "odrazi" prozor ili vrata (pravougaoni svijetli okviri na zubima). Zlatar to ne želi.
export const NO_ENV_REFLECTIONS =
  'Reflections in the polished metal show only smooth, soft gradient studio light and dark falloff: never reflected windows, doors, doorways, window frames, rooms, buildings, softbox rectangles, light panels, the camera, people or any recognizable environment.';

// Render koji postaje prvi kadar filma: crna scena, jedan snop svjetla, mjesta oko komada za kameru.
const CINEMATIC_STYLE =
  'Style: a cinematic film still for a luxury jewelry commercial. Pure black seamless background, low-key dramatic lighting, one narrow beam of warm light from upper left, ' +
  'a thin rim light tracing the metal edges, crisp specular highlights, stones throwing visible rainbow fire and tiny star glints, black mirror glass beneath the piece with a soft reflection, ' +
  'faint warm haze and a gentle glow around the brightest highlights, shallow depth of field, razor sharp macro detail on the piece. ' +
  'Square composition, the piece fills about 60% of the frame and sits in the center, with dark empty space around it. No people, no hands, no props, no text beyond what is specified, no watermark, no brand logos or trademarks. ' + NO_ENV_REFLECTIONS;

// Video prvog kadra (Pika H3 Flex). Model nema polje za zabrane i svaku riječ iz prompta shvata kao nešto što treba
// prikazati: "no new stones, no new text" je 16.11. dalo video sa slovima i kamenjem na grillzu bez ijednog kamena.
// Zato prompt SAMO pozitivno opisuje ono što je na slici (iz odgovora kupca) i pomjera svjetlo i kameru, a komad stoji
// mirno: i okret od 15° traži od modela da izmisli oblik koji ne vidi. Prvi i zadnji kadar su ista slika (petlja).
export function filmDescription(form, a) {
  const fields = (form?.steps || []).filter((st) => st.enabled !== false).flatMap((st) => (st.fields || []).filter((f) => f.enabled !== false));
  const fieldOf = (id) => fields.find((f) => f.id === id);
  const label = (f) => {
    if (!f || a[f.id] == null || a[f.id] === '') return '';
    if (a[f.id] === 'other' && f.writeIn) return clean(a[`${f.id}__more`], 60).toLowerCase();
    return clean((f.options || []).find((o) => o.value === a[f.id])?.label, 60).toLowerCase();
  };
  const typeLabel = label(fieldOf('type')) || a.type || 'piece of jewelry';
  const metal = METAL[a.metal] || (label(fieldOf('metal')) ? `polished ${label(fieldOf('metal'))}` : 'polished gold');
  const parts = [];
  const t = a.type === 'grillz' ? teethPlan(a.teeth) : null;
  if (t) parts.push(`${[t.top ? `${t.top} upper` : '', t.bottom ? `${t.bottom} lower` : ''].filter(Boolean).join(' and ')} tooth caps in ${metal}`);
  else parts.push(`a ${typeLabel} in ${metal}`);
  const notIced = a.metal === 'dental-gold' || /dental/i.test(label(fieldOf('metal'))) || a.coverage === 'none' || /^(none|no|not iced|no icing|no ice)$/i.test(label(fieldOf('coverage')));
  if (!notIced && (a.stones || a.coverage) && a.stones !== 'none') parts.push(`${label(fieldOf('coverage')) || 'set'} with ${STONES[a.stones] || label(fieldOf('stones')) || 'diamonds'}`);
  else parts.push('smooth polished metal');
  const cut = fields.find((f) => /(^|_)cut$/.test(f.id) && a[f.id] != null && a[f.id] !== '');
  if (cut) {
    const o = (cut.options || []).find((x) => x.value === a[cut.id]);
    parts.push(clean(choiceNote(cut, o) || label(cut), 160));
  }
  const text = clean(a.inscription, 24);
  if (text) parts.push(`with the letters "${text}"`);
  return parts.filter(Boolean).join(', ');
}

// Blago njihanje u petlji, 10 s (Ognjen 16.11: "ne mora puni krug, nego kako je i ranije bilo, ali da je loop").
// Komad se malo okrene lijevo, pa desno, i vrati na početni ugao; zadnji kadar je ista slika kao prvi (last_frame_image).
// Bez zabrana: samo opis onoga što je na slici, i pozitivno ponovljen isti dizajn kroz cijeli pokret.
const HANGING = new Set(['pendant', 'earrings']);
export function buildFilmPrompt(piece, type = '', desc = '') {
  const name = clean(piece, 60).toLowerCase() || 'piece';
  const what = desc ? ` (${clean(desc, 400)})` : '';
  const back = 'and settles back at exactly the starting angle, so the last frame matches the first frame and the video loops seamlessly';
  const move = HANGING.has(type)
    ? type === 'earrings'
      ? `Both earrings sway gently on their hooks, turning slowly a little to the left, then a little to the right (about 15 degrees each way), ${back}; the hooks stay in place.`
      : `The ${name} sways gently on its chain, turning slowly a little to the left, then a little to the right (about 15 degrees each way), ${back}; the chain stays in place.`
    : `The ${name} turns slowly a little to the left, then a little to the right (about 15 degrees each way), ${back}.`;
  return [
    `Luxury jewelry commercial: one continuous shot of the exact ${name} shown in the input image${what}.`,
    move,
    'It keeps exactly the design of the input image throughout: identical shape, proportions, metal color, finish and pattern in every frame.',
    'The camera stays still. A soft warm highlight glides across the polished metal as it moves. Same background, framing and lighting as the input image. Calm, slow and elegant.',
  ].join(' ');
}

// refs: lista referentnih slika istim redom kojim idu modelu, npr. ['style', 'customer'].
// style: { shape } iz src/library.json za izabrani stil.
export function buildPrompt(form, answers, { refs = [], style = null, cinematic = false } = {}) {
  let a = answers;
  const lines = [];
  // Samo uključeni koraci i pitanja; "ai: false" pitanja (kalupi, gravura iznutra) su samo za zlatara. Budžet je izuzetak, vidi budgetLine.
  const allFields = (form.steps || []).filter((st) => st.enabled !== false).flatMap((st) => (st.fields || []).filter((f) => f.enabled !== false));
  const fieldOf = (id) => allFields.find((f) => f.id === id);
  const optOf = (id) => (fieldOf(id)?.options || []).find((o) => o.value === a[id]);
  // "Other" sa upisom: kupčev tekst je odgovor (npr. metal "black rhodium").
  const writeIn = (id) => (a[id] === 'other' && fieldOf(id)?.writeIn ? clean(a[`${id}__more`], 120) : '');
  const optLabel = (id) => clean(writeIn(id) || optOf(id)?.label, 60).toLowerCase();
  // Poznata polja važe samo ako je pitanje uključeno (type i style dolaze i iz isključenog koraka kao default).
  const on = new Set(allFields.map((f) => f.id));
  a = Object.fromEntries(Object.entries(a).filter(([k]) => k === 'type' || k === 'style' || on.has(k.replace(/__more$/, ''))));
  const photoPreset = style && a.style !== 'other' && !a.teeth && !style.teeth && !['top6', 'top8', 'set', 'fangs'].includes(a.style);
  const g = a.type === 'grillz' && !photoPreset ? grillzPlan(a) : null;
  // Opis komada: iz buildera (opcija tipa ima "subject"), inače ugrađeni za poznate tipove.
  const typeOpt = ((form.steps || []).flatMap((st) => st.fields).find((f) => f.id === 'type')?.options || []).find((o) => o.value === a.type);
  let subject = clean(typeOpt?.subject, 300) || SUBJECT[a.type] || `a custom ${clean(typeOpt?.label || 'piece of jewelry', 60).toLowerCase()}`;
  if (g?.lines && g.top + g.bottom === 1) {
    subject = `a single custom tooth cap (a one-tooth grill), front view, displayed on its own without a mouth or face`;
  } else if (g && (g.rows === 'top' || g.rows === 'bottom')) {
    subject = `a single custom ${g.rows} grill: ONE row of ${g.rows === 'top' ? 'upper' : 'lower'}-teeth jewelry only, front view, displayed on its own without a mouth or face`;
  } else if (g?.lines) {
    subject = `a custom set of dental grillz made of exactly ${g.top + g.bottom} tooth caps ONLY: ${g.top} upper-tooth caps and ${g.bottom} lower-tooth caps, shaped and arranged like the real teeth they cover, front view, displayed on their own without a mouth or face`;
  }
  // Opcija koju je zlatar dodao (npr. "Black gold") nema ugrađen opis, pa ide njen natpis.
  let metal = METAL[a.metal] || (optLabel('metal') ? `polished ${optLabel('metal')}` : 'polished gold');
  let karat = a.metal !== 'platinum' && a.karat ? ` (${writeIn('karat') || a.karat})` : '';
  // "925 Silver" u pitanju Karat znači da je komad od srebra; boja zlata je onda samo pozlata (inače "zlato + srebro" zbunjuje model).
  if (/925|silver/i.test(a.karat || '')) {
    const tone = { 'yellow-gold': 'yellow gold', 'rose-gold': 'rose gold', 'two-tone': 'two-tone yellow and white' }[a.metal];
    metal = tone ? `925 sterling silver with a ${tone} plated finish` : 'polished 925 sterling silver';
    karat = '';
  }

  lines.push(`Create a photorealistic high-end jewelry product photograph of ${subject}.`);
  // Kod grillza stil govori samo broj zuba; tačan izbor zuba ga zamjenjuje.
  if (style?.shape && (!g?.lines || style.teeth === a.teeth)) lines.push(`Design style: ${style.shape}.`);
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
  if (g && !(g.lines && g.top + g.bottom === 1) && g.rows !== 'fangs') lines.push(GRILLZ_ARCH(g.rows === 'both'));

  // Dental gold ne nosi kamenje (Ognjen 16.11), čak i ako je kupac led tražio opisom.
  const noIceMetal = a.metal === 'dental-gold' || /dental/i.test(optLabel('metal'));
  const notIced = noIceMetal || a.coverage === 'none' || /^(none|no|not iced|no icing|no ice)$/i.test(optLabel('coverage'));
  if (notIced) {
    lines.push(NOT_ICED(a.type));
  } else if (a.stones && a.stones !== 'none') {
    const clarity = CLARITY[a.clarity] ? `, ${CLARITY[a.clarity]}` : optLabel('clarity') ? `, ${optLabel('clarity')} clarity` : '';
    const coverage = COVERAGE[a.coverage] || (optLabel('coverage') ? `set as ${optLabel('coverage')}` : fieldOf('coverage') ? COVERAGE.accents : 'set where it suits the design');
    lines.push(`Stones: ${STONES[a.stones] || optLabel('stones') || 'diamonds'}${clarity}, ${coverage}.`);
  } else if (a.stones === 'none') {
    lines.push('No stones: clean polished metal only.');
  } else if (COVERAGE[a.coverage] || optLabel('coverage')) {
    lines.push(`Stones: diamonds, ${COVERAGE[a.coverage] || `set as ${optLabel('coverage')}`}.`);
  }

  if (!notIced) lines.push(INSIDE_RULE(a.type));

  const text = clean(a.inscription, 24);
  const placeholder = placeholderWord(style);
  // Stil slova (pitanje sa lettering: true): opis oblika slova ide uz sam natpis, ne među ostale napomene.
  const fontField = allFields.find((f) => f.lettering && f.ai !== false && a[f.id] != null && a[f.id] !== '');
  const fontOpt = fontField && (fontField.options || []).find((o) => o.value === a[fontField.id]);
  const fontMore = fontField ? clean(a[`${fontField.id}__more`], 200) : '';
  const fontLine = fontOpt ? `Lettering style: ${clean(fontOpt.note || fontOpt.label, 300)}${fontMore ? ` (customer describes the font: "${fontMore}")` : ''}.` : '';
  if (text) {
    const letters = text.split('').join(' ');
    lines.push(`The piece includes the text "${text}" as part of the design, spelled exactly letter by letter: ${letters}. No other text anywhere.${fontLine ? ` ${fontLine}` : ''}`);
    if (placeholder && placeholder.toLowerCase() !== text.toLowerCase()) lines.push(`This style is normally shown with the sample word "${placeholder}". That word is only a placeholder: the piece must read "${text}" and the word "${placeholder}" must not appear anywhere.`);
  } else {
    if (fontLine) lines.push(`${fontLine} Use it for any letters in the design.`);
    if (placeholder) lines.push(`The sample word "${placeholder}" shown with this style is only a placeholder for the customer's own name or word. If the customer's description gives a name or word, the piece spells that instead, and "${placeholder}" does not appear.`);
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
    .filter((f) => f.ai !== false && !f.lettering && f.options && a[f.id] != null)
    .map((f) => clean(choiceNote(f, f.options.find((o) => o.value === a[f.id])), 300))
    .filter(Boolean);
  if (notes.length) lines.push(`Design details: ${notes.join('; ')}.`);

  // Ostala pitanja (custom i default bez ugrađenog značenja): "pitanje: odgovor", uz dodatni tekst kupca.
  const KNOWN = new Set(['type', 'style', 'teeth', 'metal', 'karat', 'stones', 'coverage', 'clarity', 'budget', 'inscription', 'vision', 'reference']);
  const extra = allFields
    .filter((f) => !KNOWN.has(f.id) && !f.lettering && f.ai !== false && f.type !== 'upload' && ((a[f.id] != null && a[f.id] !== '') || a[`${f.id}__more`]))
    .map((f) => {
      const o = (f.options || []).find((x) => x.value === a[f.id]);
      const own = writeIn(f.id);
      const val = own ? `other, the customer writes: "${own}"` : o ? o.label : a[f.id] || '';
      const more = own ? '' : clean(a[`${f.id}__more`], 300);
      return `${clean(f.label || f.id, 80)}: ${clean(val, 200)}${more ? ` (customer adds: "${more}")` : ''}`;
    });
  if (extra.length) lines.push(`Additional customer choices (apply them to the design): ${extra.join('; ')}.`);

  refs.forEach((kind, i) => {
    const n = `Reference image ${i + 1}`;
    if (kind === 'style') {
      lines.push(g?.lines ?
        `${n} is a SURFACE DESIGN reference only. Borrow its stone setting, decorative motif and finish for the selected caps. ` +
          'Do not copy its arch, number of teeth, side caps, backing, connectors, wings, silhouette or overall width. The selected tooth map determines the only physical caps to generate. Apply the chosen metal and stones instead of copying the reference materials.' :
        `${n} shows the required SHAPE and construction for this style. Match its silhouette, proportions and number of elements closely. ` +
          'It is a plain neutral reference: ignore its metal color, its background and any letters on it, and apply the metal, stones and text described here instead.' +
          (text ? ` Any word or letters visible in it are a placeholder: replace them with "${text}".` : placeholder ? ` The word "${placeholder}" in it is a placeholder, not the text to write.` : '')
      );
    } else if (kind === 'teethmap') {
      lines.push(
        `${n} is a TOOTH MAP: a flat schematic of the mouth seen from the front, upper row on top and lower row below. It is a layout guide only, not a photo: never copy its flat shapes, colors, outlines or black background. ` +
          `Each FILLED tooth shape is exactly one tooth that gets a cap (${g?.top || 0} filled in the top row, ${g?.bottom || 0} filled in the bottom row). Each empty outlined shape is a bare position that gets no metal at all. ` +
          'Use the map only for WHICH teeth get a cap and their left to right order (narrower lower teeth), with nothing on the outlined positions. The map is flat and evenly spaced; the real caps are not: they follow the curved dental arch and the tooth anatomy described above.'
      );
    } else if (kind === 'customer') {
      lines.push(
        `${n} is the customer's own inspiration photo. Use it for the details and character of the design, adapted to the materials above. ` +
          'Do not copy any logos, brand marks or watermarks from it.'
      );
    }
  });

  lines.push(cinematic ? CINEMATIC_STYLE :
    `Style: luxury catalog photography, soft studio lighting with crisp reflections, sharp macro detail, on a seamless ${form.background || 'neutral'} background. ` +
      'Square composition, the piece fills about 70% of the frame. No people, no hands, no props, no watermark, no brand logos or trademarks. ' + NO_ENV_REFLECTIONS
  );
  if (text) lines.push(`FINAL TEXT CHECK: the only lettering on the piece is "${text}" (${text.split('').join(' ')}), exactly as the customer typed it${placeholder && placeholder.toLowerCase() !== text.toLowerCase() ? `, never "${placeholder}"` : ''}.`);
  if (g?.lines) {
    lines.push(
      'FINAL PHYSICAL CAP INVENTORY (overrides style photos, inspiration, presets, budget and design descriptions):',
      ...g.lines,
      'Selected teeth means the COMPLETE physical jewelry, not just which teeth get diamonds. Every object made of metal or stones in the image must belong to a selected tooth. Do not add plain gold teeth beside the decorated teeth, partial neighboring crowns, lateral wings, stabilizer teeth, support caps, backing plates, connecting bars or a full-mouth framework. Unselected positions must be empty background, never gold placeholders.',
      `The full product consists of ${g.top + g.bottom} tooth-shaped caps in total, not ${g.top + g.bottom} decorated caps inside a larger grill. End each row immediately at the outer edge of its last selected cap; no metal may extend sideways onto another tooth. Keep ordinary tooth-sized proportions; a higher budget increases craftsmanship, not the number of caps.`
    );
  }
  return lines.join('\n');
}

export function buildTweakPrompt(tweak, { masked = false, type = '' } = {}) {
  return [
    'Edit the attached jewelry product photograph.',
    `The required edit is the customer's request: "${clean(tweak, 300)}"`,
    ...(masked ? [
      'The transparent part of the supplied mask marks the area to edit. Apply the requested change visibly inside that area; preserve everything outside it.',
      'The requested edit takes priority over preserving the original shape, material or decoration INSIDE the marked area. You may remove or replace those details there when the request requires it.',
    ] : [
      'Apply the requested change and preserve all details that the customer did not ask to change.',
    ]),
    'If the customer requests a hole, opening or cutout, actually remove the metal and stones in that shape and show the background through the opening; do not merely draw a shape on the surface.',
    'Keep the same camera angle, lighting, background and placement. The requested edit must be visible; do not return an unchanged copy of the input.',
    'Keep it photorealistic. No people, no hands, no watermark, no brand logos.',
    INSIDE_RULE(type),
    NO_ENV_REFLECTIONS,
  ].join('\n');
}
