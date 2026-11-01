// Picture of a form choice: a photo or an exact diagram from public/library/options/<category>/<slug>.
// A choice without its own image falls back to this, so forms already in use show pictures too.
import { ART, DETAILS } from './option-art-index.js';

const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// Most specific first: ring-size before size. Onboarding field IDs carry the piece in front (chain_length).
const CATEGORIES = ['center-shape', 'ring-size', 'case-size', 'metal', 'karat', 'stones', 'coverage', 'clarity', 'budget', 'cut', 'mold', 'carat', 'band', 'chain', 'backs', 'length', 'width', 'size'];
export const artCategory = (fieldId) => { const id = String(fieldId || '').replace(/_/g, '-'); return CATEGORIES.find((c) => id === c || id.endsWith(`-${c}`)) || ''; };

// Budget ranges are free text: the picture follows the top of the range.
function budgetTier(label) {
  const amounts = [...String(label).matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, '')));
  if (!amounts.length) return '';
  const top = Math.max(...amounts);
  if (/\+/.test(label) && top >= 20000) return 'tier-6';
  return `tier-${[1500, 2500, 5000, 10000, 20000].findIndex((x) => top <= x) + 1 || 6}`;
}
const ALIASES = { metal: { silver: 'sterling-silver', gold: 'yellow-gold' }, stones: { none: 'no-stones', cz: 'cubic-zirconia', diamonds: 'natural-diamonds' } };

const fileIn = (folder, cat, s) => {
  const files = ART[folder];
  const name = files && [s, `${s}s`, ALIASES[cat]?.[s]].find((x) => x && files[x]);
  return name ? `/library/options/${folder}/${name}.${files[name]}` : '';
};
// A ring shows its metal on a ring, not on a chain: <category>/<piece>/ first, then the general photo.
export function artFor(fieldId, label, piece = '') {
  const cat = artCategory(fieldId);
  if (!cat) return '';
  const s = cat === 'budget' ? budgetTier(label) : slug(label);
  return (piece && fileIn(`${cat}/${piece}`, cat, s)) || fileIn(cat, cat, s);
}
// Photos of one choice per piece, for a shared question whose picture follows the piece the customer picked.
export function pieceArt(fieldId, label) {
  const cat = artCategory(fieldId);
  const out = {};
  for (const folder of Object.keys(ART)) {
    if (!cat || !folder.startsWith(`${cat}/`)) continue;
    const src = fileIn(folder, cat, cat === 'budget' ? budgetTier(label) : slug(label));
    if (src) out[folder.slice(cat.length + 1)] = src;
  }
  return out;
}
// Macro shot of one choice for the render wait: the piece's own first, then shared; a metal-colored shot follows the chosen metal.
export const metalFamily = (label) => (/rose/i.test(label) ? 'rose' : /white|platinum|silver|steel|black/i.test(label) ? 'white' : 'yellow');
export function detailArt(cat, label, piece, family) {
  const s = slug(label);
  const names = [`${s}-${family}`, s, ...(ALIASES[cat]?.[s] ? [ALIASES[cat][s]] : []), `${s}s`];
  // A hallmark photographed inside a band belongs to a ring, other pieces show it on a clasp tag, and grillz have neither.
  const common = cat !== 'karat' || piece === 'ring' ? `shared/${cat}` : piece === 'grillz' ? '' : 'tag/karat';
  for (const folder of [`${piece}/${cat}`, common]) {
    const name = names.find((n) => DETAILS[folder]?.includes(n));
    if (name) return `/library/details/${folder}/${name}.webp`;
  }
  return '';
}
// Picture of a built-in piece on the first step of the form.
const PIECES = { pendant: '/library/pendant/script.webp', chain: '/site/gallery/chain-category-v2.webp', ring: '/library/ring/solitaire.webp', grillz: '/library/grillz/top8.webp', bracelet: '/library/bracelet/cuban.webp', earrings: '/library/earrings/hoops.webp', watch: '/library/watch/iced.webp' };
export const optionArt = (fieldId, option, piece = '') => option.image || (fieldId === 'type' ? PIECES[option.value] || '' : artFor(fieldId, option.label, piece));
// Option as the form receives it: its picture, plus per-piece pictures unless the jeweler set their own image.
export function withArt(field, o) {
  const image = optionArt(field.id, o);
  const byPiece = o.image || field.id === 'type' ? {} : pieceArt(field.id, o.label);
  return { ...o, ...(image ? { image } : {}), ...(Object.keys(byPiece).length ? { pieceArt: byPiece } : {}) };
}
// The whole catalogue, for the image library in the builder.
export const artList = () => Object.entries(ART).flatMap(([cat, files]) => Object.entries(files).map(([name, ext]) => ({ image: `/library/options/${cat}/${name}.${ext}`, label: `${cat.replace(/[-/]/g, ' ')}: ${name.replace(/-/g, ' ')}` })));
