// Definicije formi. Forme žive u D1 (tabela forms, svaka pripada klijentu) i uređuju se u builderu.
// Nova forma nastaje iz šablona (TEMPLATES). Pitanja iz šablona su "default" (builtin: mogu se isključiti,
// ne brišu se, AI ih razumije po ID-ju); pitanja koja zlatar doda su "custom" (sve se mijenja).
// Koraci su podaci, ne kod: widget ih crta generički.
import LIBRARY from './library.json' with { type: 'json' };

// Početni stilovi po tipu iz src/library.json. Slika ide i u karticu i modelu kao referenca oblika.
export const DEFAULT_STYLES = Object.fromEntries(
  Object.entries(LIBRARY)
    .filter(([k]) => !k.startsWith('_'))
    .map(([type, items]) => [type, items.map((i) => ({ value: i.value, label: i.label, image: `/library/${type}/${i.value}.webp`, shape: i.shape }))])
);

const OTHER_STYLE = { value: 'other', label: 'Something else', icon: 'gem' };
export const CHOICE_TYPES = ['cards', 'chips', 'yesno', 'dropdown'];

export function styleOf(form, a) {
  return (form.styles?.[a.type] || []).find((s) => s.value === a.style) || null;
}

// Opcije polja: obične, ili stilovi izabranog tipa (+ "Something else") za polje sa optionsFrom.styles.
export function optionsOf(field, a, form) {
  if (field.optionsFrom?.styles) {
    const list = (form.styles?.[a[field.optionsFrom.field]] || []).map(({ value, label, image }) => ({ value, label, image }));
    return [...list, OTHER_STYLE];
  }
  return field.options;
}

// Koraci i polja koja su uključena (isključeni se ne prikazuju i ne idu u lead ni AI).
export const enabledSteps = (form) => (form.steps || []).filter((s) => s.enabled !== false);
export const enabledFields = (form) => enabledSteps(form).flatMap((s) => s.fields.filter((f) => f.enabled !== false));

// ---------- Gradivni blokovi šablona ----------

const opt = (value, label, extra = {}) => ({ value, label, ...extra });
const YES_NO = [opt('yes', 'Yes'), opt('no', 'No')];
const PIECES = [
  opt('pendant', 'Pendant', { icon: 'pendant' }), opt('chain', 'Chain', { icon: 'chain' }), opt('ring', 'Ring', { icon: 'ring' }),
  opt('grillz', 'Grillz', { icon: 'grillz' }), opt('bracelet', 'Bracelet', { icon: 'bracelet' }), opt('earrings', 'Earrings', { icon: 'earrings' }),
  opt('watch', 'Watch', { icon: 'watch' }),
];
const METALS = [
  opt('yellow-gold', 'Yellow Gold', { swatch: '#e2b04a' }), opt('white-gold', 'White Gold', { swatch: '#e6e6e3' }),
  opt('rose-gold', 'Rose Gold', { swatch: '#d99a86' }), opt('platinum', 'Platinum', { swatch: '#c9ccd1' }),
  opt('two-tone', 'Two-Tone', { swatch: 'linear-gradient(135deg,#e2b04a 50%,#e6e6e3 50%)' }),
];
const BUDGETS = ['Under $1,500', '$1,500 - $2,500', '$2,500 - $5,000', '$5,000 - $10,000', '$10,000 - $20,000', '$20,000+'].map((v) => opt(v, v));
const THEME = {
  accent: '#35d0c4', 'accent-ink': '#032220', bg: '#070b0c', surface: '#10171a', 'surface-2': '#152024',
  line: '#1f2c30', 'line-strong': '#34464b', ink: '#eef6f5', 'ink-soft': '#9fb3b1', 'ink-faint': '#627674',
};
const B = { builtin: true };

const typeStep = (pieces, { enabled = true } = {}) => ({
  id: 'type', label: 'Piece', title: 'What are we creating?', subtitle: 'Pick the piece you have in mind.', autoAdvance: true, enabled,
  fields: [{ id: 'type', type: 'cards', required: true, ...B, options: pieces, ...(pieces.length === 1 ? { default: pieces[0].value } : {}) }],
});
const styleStep = (title = 'Choose a style') => ({
  id: 'style', label: 'Style', title, subtitle: 'Pick the shape closest to your idea. We customize everything from there.', autoAdvance: true,
  fields: [{ id: 'style', type: 'cards', required: true, ...B, optionsFrom: { field: 'type', styles: true } }],
});
const metalFields = (metals = METALS) => [
  { id: 'metal', type: 'chips', label: 'Metal', required: true, ...B, options: metals },
  { id: 'karat', type: 'chips', label: 'Karat', required: true, ...B, showIf: { field: 'metal', notIn: ['platinum'] }, options: ['10K', '14K', '18K', '925 Silver'].map((v) => opt(v, v)) },
];
const stoneFields = () => [
  { id: 'stones', type: 'chips', label: 'Stones', required: true, ...B, options: [opt('none', 'No stones'), opt('moissanite', 'Moissanite'), opt('lab', 'Lab-grown diamonds'), opt('natural', 'Natural diamonds')] },
  { id: 'coverage', type: 'chips', label: 'How iced?', required: true, ...B, showIf: { field: 'stones', notIn: ['none'] }, options: [opt('accents', 'Accents'), opt('half', 'Half iced'), opt('full', 'Fully iced')] },
  { id: 'clarity', type: 'chips', label: 'Clarity', required: false, ...B, showIf: { field: 'stones', in: ['lab', 'natural'] }, options: ['SI', 'VS', 'VVS', 'Flawless'].map((v) => opt(v, v)) },
];
// Crtež usta: kupac bira tačne zube (src/teeth.js). U opštoj formi samo kad je komad grillz.
const teethStep = ({ onlyGrillz = false } = {}) => ({
  id: 'teeth', label: 'Teeth', title: 'Select your teeth', subtitle: 'How many teeth do you want? Tap a tooth or pick a set.',
  fields: [{ id: 'teeth', type: 'teeth', required: true, ...B, ...(onlyGrillz ? { showIf: { field: 'type', in: ['grillz'] } } : {}) }],
});
const budgetStep = () => ({
  id: 'budget', label: 'Budget', title: 'Your budget', subtitle: 'So we design something that fits.', autoAdvance: true,
  fields: [{ id: 'budget', type: 'chips', required: true, big: true, ...B, ai: false, options: BUDGETS }],
});
const visionStep = ({ inscriptionLabel = 'Name or text on the piece (optional)', placeholder = 'e.g. Script name pendant with a small crown over the first letter, iced out, about 2 inches tall', inscription = true } = {}) => ({
  id: 'vision', label: 'Vision', title: 'Describe your vision', subtitle: 'Names, shapes, symbols, anything. The more detail, the better your preview.',
  fields: [
    ...(inscription ? [{ id: 'inscription', type: 'text', label: inscriptionLabel, placeholder: 'e.g. Blake, J&M, 404', max: 24, ...B }] : []),
    { id: 'vision', type: 'textarea', label: 'Your idea', placeholder, max: 600, ...B },
    { id: 'reference', type: 'upload', label: 'Inspiration photo (optional)', hint: 'A screenshot or photo of something close to what you want.', ...B },
  ],
});
const texts = (brand) => ({
  contact: {
    title: 'Your design is ready to render',
    subtitle: 'Where should we send your preview and follow up with a quote?',
    consent: `I agree to be contacted about my design by ${brand} by email, phone or text. Message and data rates may apply.`,
    button: 'Reveal my design',
  },
  result: {
    loading: ['Sketching your piece', 'Choosing the metal', 'Setting the stones', 'Polishing the details', 'Adjusting the light'],
    done: 'Our team will reach out within 24 hours with a quote.',
    disclaimer: 'AI concept preview. Your final piece is handcrafted and may differ in detail.',
  },
});
const base = (brand) => ({ brand: { name: brand }, theme: { ...THEME }, maxRenders: 4, background: 'deep charcoal black', ...texts(brand) });
const pick = (keys) => Object.fromEntries(keys.map((k) => [k, structuredClone(DEFAULT_STYLES[k] || [])]));

// ---------- Šabloni ----------

export const TEMPLATES = {
  'custom-enquiry': {
    label: 'Custom Enquiry',
    description: 'Any piece: pendants, chains, rings, grillz, bracelets, earrings, watches.',
    build: (brand) => ({
      ...base(brand),
      styles: pick(Object.keys(DEFAULT_STYLES)),
      steps: [
        typeStep(structuredClone(PIECES)),
        styleStep(),
        teethStep({ onlyGrillz: true }),
        { id: 'design', label: 'Design', title: 'Metal & stones', subtitle: 'The materials that set the tone.', fields: [...metalFields(), ...stoneFields()] },
        budgetStep(),
        visionStep(),
      ],
    }),
  },
  grillz: {
    label: 'Grillz Builder',
    description: 'Top, bottom or full sets, fangs, cuts and finishes.',
    build: (brand) => ({
      ...base(brand),
      styles: pick(['grillz']),
      steps: [
        typeStep([opt('grillz', 'Grillz', { icon: 'grillz' })], { enabled: false }),
        styleStep('Choose your set'),
        teethStep(),
        {
          id: 'design', label: 'Design', title: 'Metal, stones & cut', subtitle: 'How your grill should look and shine.',
          fields: [
            ...metalFields(METALS.filter((m) => m.value !== 'platinum')),
            ...stoneFields(),
            {
              id: 'grill_cut', type: 'chips', label: 'Cut', required: false, ...B,
              options: [
                opt('solid', 'Solid'),
                opt('open-face', 'Open face', { note: 'open face grill: only the outline of each tooth is covered, the center of each tooth is open' }),
                opt('diamond-cut', 'Diamond cut', { note: 'diamond-cut metal: faceted, sparkling engraved surface' }),
              ],
            },
          ],
        },
        {
          id: 'fit', label: 'Fit', title: 'Fit & molds', subtitle: 'Helps us plan your appointment.',
          fields: [{ id: 'mold', type: 'yesno', label: 'Do you already have dental molds?', required: false, ...B, ai: false, options: structuredClone(YES_NO) }],
        },
        budgetStep(),
        visionStep({ inscriptionLabel: 'Initials or text on a tooth (optional)', placeholder: 'e.g. Top 8 with a heart cut-out on the left front tooth' }),
      ],
    }),
  },
  ring: {
    label: 'Ring Builder',
    description: 'Engagement rings, bands and signets with center stone and carat.',
    build: (brand) => ({
      ...base(brand),
      styles: pick(['ring']),
      steps: [
        typeStep([opt('ring', 'Ring', { icon: 'ring' })], { enabled: false }),
        styleStep('Choose a ring style'),
        {
          id: 'stone', label: 'Center stone', title: 'Center stone', subtitle: 'Shape and size of the main stone.',
          fields: [
            {
              id: 'center_shape', type: 'chips', label: 'Shape', required: true, ...B, showIf: { field: 'style', notIn: ['eternity', 'signet'] },
              options: ['Round', 'Oval', 'Princess', 'Emerald', 'Pear', 'Cushion', 'Marquise', 'Radiant'].map((v) => opt(v.toLowerCase(), v, { note: `${v.toLowerCase()} cut center stone` })),
            },
            {
              id: 'carat', type: 'chips', label: 'Carat', required: false, ...B, showIf: { field: 'style', notIn: ['eternity', 'signet'] },
              options: [['0.5', 'small'], ['1', 'medium'], ['1.5', 'generous'], ['2', 'large'], ['3+', 'very large']].map(([c, size]) => opt(`${c}ct`, `${c} ct`, { note: `${size} center stone of about ${c.replace('+', '')} carat` })),
            },
          ],
        },
        {
          id: 'design', label: 'Metal', title: 'Metal & band', subtitle: 'The setting around the stone.',
          fields: [
            ...metalFields(),
            {
              id: 'band', type: 'chips', label: 'Band', required: false, ...B,
              options: [opt('plain', 'Plain', { note: 'plain polished band' }), opt('pave', 'Pavé', { note: 'pavé band with small stones along the top' }), opt('split', 'Split shank', { note: 'split shank band' })],
            },
            { id: 'stones', type: 'chips', label: 'Stones', required: true, ...B, options: [opt('lab', 'Lab-grown diamond'), opt('natural', 'Natural diamond'), opt('moissanite', 'Moissanite'), opt('none', 'No stones')] },
          ],
        },
        budgetStep(),
        {
          id: 'vision', label: 'Vision', title: 'Describe your ring', subtitle: 'Anything that makes it yours.',
          fields: [
            { id: 'engraving', type: 'text', label: 'Engraving inside the band (optional)', placeholder: 'e.g. 06.12.2026', max: 30, ...B, ai: false },
            { id: 'vision', type: 'textarea', label: 'Your idea', placeholder: 'e.g. Oval center stone with a hidden halo and a thin pavé band', max: 600, ...B },
            { id: 'reference', type: 'upload', label: 'Inspiration photo (optional)', hint: 'A ring you love, or a screenshot.', ...B },
          ],
        },
      ],
    }),
  },
  blank: {
    label: 'Blank form',
    description: 'One custom piece and a description. Build everything else yourself.',
    build: (brand) => ({
      ...base(brand),
      styles: { custom: [] },
      steps: [
        typeStep([opt('custom', 'Custom piece', { icon: 'gem', subject: 'a custom piece of fine jewelry' })], { enabled: false }),
        visionStep({ inscription: false, placeholder: 'Describe the piece you have in mind' }),
      ],
    }),
  },
};

// Komadi za formu samo za jedan komad (Custom Enquiry suženo na taj komad).
export const PIECE_OPTIONS = PIECES.map(({ value, label }) => ({ value, label }));

export function fromTemplate(template, { id, brand, name, clientId, logo, piece }) {
  const t = TEMPLATES[template];
  if (!t) throw new Error('Unknown template');
  const form = t.build(brand);
  if (logo) form.brand.logo = logo;
  let label = t.label;
  // Samo jedan komad: korak izbora komada se isključuje, ostaju samo stilovi tog komada, zubi samo za grillz.
  if (piece) {
    const step = form.steps.find((s) => s.id === 'type');
    const field = step?.fields.find((f) => f.id === 'type');
    const o = field?.options.find((x) => x.value === piece);
    if (!o) throw new Error('Unknown piece');
    field.options = [o];
    field.default = piece;
    step.enabled = false;
    form.styles = { [piece]: form.styles?.[piece] || [] };
    if (piece !== 'grillz') form.steps = form.steps.filter((s) => s.id !== 'teeth');
    label = o.label;
  }
  return { id, name: name || `${brand} · ${label}`, clientId, template, ...form };
}

// Ugrađena demo forma (demo sajt i JewelryLead početna). Važi dok se ne sačuva u bazi.
export const FORMS = { demo: { ...fromTemplate('custom-enquiry', { id: 'demo', brand: 'Maison Demo', name: 'Demo (JewelryLead site)', clientId: null }) } };

export function publicForm(form) {
  // Sve što ide u browser. Opis oblika (shape) i napomene za AI (note) nisu za kupca.
  const { id, brand, theme, maxRenders, contact, result } = form;
  const steps = (form.steps || []).map((s) => ({
    ...s,
    fields: s.fields.map(({ ai, builtin, ...f }) => (f.options ? { ...f, options: f.options.map(({ note, subject, ...o }) => o) } : f)),
  }));
  const styles = Object.fromEntries(Object.entries(form.styles || {}).map(([t, list]) => [t, list.map(({ value, label, image }) => ({ value, label, image }))]));
  return { id, brand, theme, maxRenders, steps, styles, contact, result };
}

// ---------- Provjera definicije forme (builder čuva samo ono što prođe ovo) ----------

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const HEX = /^#[0-9a-f]{3,8}$/i;
const SWATCH = /^(#[0-9a-f]{3,8}|linear-gradient\(\s*\d{1,3}deg\s*(,\s*#[0-9a-f]{3,8}\s+\d{1,3}%){2,4}\s*\))$/i;
const FIELD_TYPES = ['cards', 'chips', 'yesno', 'dropdown', 'text', 'textarea', 'upload', 'teeth'];
const ICONS = ['pendant', 'chain', 'ring', 'grillz', 'bracelet', 'earrings', 'watch', 'gem'];

export function validateFormDef(f, id) {
  const err = (m) => { throw new Error(m); };
  const str = (v, max, name, required = false) => {
    if (v == null || v === '') { if (required) err(`Missing: ${name}`); return; }
    if (typeof v !== 'string' || v.length > max) err(`${name}: up to ${max} characters`);
  };
  const imgOk = (src) => src == null || src === '' || src.startsWith('/library/') || src.startsWith(`/media/forms/${id}/`) || src.startsWith('/media/clients/');
  const bool = (v, name) => { if (v != null && typeof v !== 'boolean') err(`${name}: true or false`); };

  if (!f || typeof f !== 'object') err('Invalid form');
  if (f.id !== id || !SLUG.test(id)) err('Form ID: lowercase letters, numbers and dashes');
  if (JSON.stringify(f).length > 250_000) err('Form is too large');
  str(f.name, 80, 'Internal name');
  if (f.clientId != null && !SLUG.test(f.clientId)) err('Client: invalid ID');
  if (f.template != null && !TEMPLATES[f.template]) err('Unknown template');
  str(f.brand?.name, 60, 'Brand name', true);
  if (f.brand?.logo && !imgOk(f.brand.logo)) err('Logo must be uploaded here');
  str(f.background, 80, 'Render background');
  for (const [k, v] of Object.entries(f.theme || {})) if (!SLUG.test(k) || !HEX.test(v)) err(`Color ${k}: hex only (#rrggbb)`);
  if (!Number.isInteger(f.maxRenders) || f.maxRenders < 1 || f.maxRenders > 10) err('Previews per customer: 1 to 10');

  if (!Array.isArray(f.steps) || !f.steps.length || f.steps.length > 12) err('Steps: 1 to 12');
  const stepIds = new Set();
  const fieldIds = new Set();
  for (const s of f.steps) {
    if (!SLUG.test(s.id || '') || stepIds.has(s.id)) err(`Step "${s.id}": ID must be unique`);
    stepIds.add(s.id);
    str(s.title, 120, `Title of step ${s.id}`, true);
    str(s.subtitle, 240, `Subtitle of step ${s.id}`);
    str(s.label, 30, `Label of step ${s.id}`);
    bool(s.enabled, `Step ${s.id} enabled`);
    bool(s.autoAdvance, `Step ${s.id} auto advance`);
    if (!Array.isArray(s.fields) || !s.fields.length || s.fields.length > 10) err(`Step ${s.id}: 1 to 10 questions`);
    for (const fl of s.fields) {
      if (!KEY.test(fl.id || '') || fieldIds.has(fl.id) || fl.id.endsWith('__more')) err(`Question "${fl.id}": ID must be unique`);
      fieldIds.add(fl.id);
      if (!FIELD_TYPES.includes(fl.type)) err(`Question ${fl.id}: unknown type`);
      for (const b of ['required', 'enabled', 'builtin', 'ai', 'big']) bool(fl[b], `Question ${fl.id} ${b}`);
      str(fl.label, 120, `Question ${fl.id}`);
      str(fl.subtitle, 200, `Subtitle of ${fl.id}`);
      str(fl.placeholder, 160, `Placeholder of ${fl.id}`);
      str(fl.hint, 200, `Hint of ${fl.id}`);
      if (fl.followup != null && !['text', 'file'].includes(fl.followup)) err(`Question ${fl.id}: follow-up must be text or file`);
      if (fl.max != null && (!Number.isInteger(fl.max) || fl.max < 1 || fl.max > 1000)) err(`Question ${fl.id}: max length 1 to 1000`);
      if (fl.optionsFrom) {
        if (!fl.optionsFrom.styles || fl.optionsFrom.field !== 'type') err(`Question ${fl.id}: styles can only depend on the piece`);
      } else if (CHOICE_TYPES.includes(fl.type)) {
        if (!Array.isArray(fl.options) || !fl.options.length || fl.options.length > 40) err(`Question ${fl.id}: 1 to 40 options`);
        const vals = new Set();
        for (const o of fl.options) {
          if (typeof o.value !== 'string' || !o.value || o.value.length > 60 || vals.has(o.value)) err(`Question ${fl.id}: options must be unique`);
          vals.add(o.value);
          str(o.label, 60, `Option ${o.value}`, true);
          if (o.swatch && !SWATCH.test(o.swatch)) err(`Option ${o.value}: color must be hex or a simple gradient`);
          if (o.icon && !ICONS.includes(o.icon)) err(`Option ${o.value}: unknown icon`);
          if (o.image && !imgOk(o.image)) err(`Option ${o.value}: image must come from the library or this form`);
          str(o.subject, 300, `AI description (${o.value})`);
          str(o.note, 300, `AI note (${o.value})`);
        }
        if (fl.default != null && !vals.has(fl.default)) err(`Question ${fl.id}: default must be one of its options`);
      }
      if (fl.showIf) {
        const c = fl.showIf;
        if (!KEY.test(c.field || '') || !(Array.isArray(c.in) || Array.isArray(c.notIn))) err(`Question ${fl.id}: invalid display condition`);
      }
    }
  }
  const typeField = f.steps.flatMap((s) => s.fields).find((x) => x.id === 'type');
  if (!typeField || typeField.type !== 'cards') err('The form needs a "type" question (piece choice) shown as cards');
  const typeStepOn = f.steps.find((s) => s.fields.includes(typeField)).enabled !== false;
  if (!typeStepOn && typeField.options.length !== 1) err('The piece step can only be turned off when there is exactly one piece');

  for (const [t, list] of Object.entries(f.styles || {})) {
    if (!SLUG.test(t) || !Array.isArray(list) || list.length > 16) err(`Styles for ${t}: at most 16`);
    const vals = new Set();
    for (const s of list) {
      if (!SLUG.test(s.value || '') || s.value === 'other' || vals.has(s.value)) err(`Style "${s.value}" (${t}): must be unique and not "other"`);
      vals.add(s.value);
      str(s.label, 40, `Style ${s.value}`, true);
      str(s.shape, 300, `Shape of ${s.value}`);
      if (!imgOk(s.image)) err(`Style ${s.value}: image must come from the library or this form`);
    }
  }

  str(f.contact?.title, 120, 'Contact title', true);
  str(f.contact?.subtitle, 240, 'Contact subtitle');
  str(f.contact?.consent, 400, 'Consent text', true);
  str(f.contact?.button, 40, 'Contact button', true);
  if (!Array.isArray(f.result?.loading) || !f.result.loading.length || f.result.loading.length > 10) err('Rendering messages: 1 to 10');
  f.result.loading.forEach((m) => str(m, 60, 'Rendering message', true));
  str(f.result.done, 200, 'Message under the render', true);
  str(f.result.disclaimer, 240, 'Disclaimer', true);
  return true;
}
