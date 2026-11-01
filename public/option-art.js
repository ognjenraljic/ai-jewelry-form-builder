// Picture of a form choice: a photo or an exact diagram from public/library/options/<category>/<slug>.
// A choice without its own image falls back to this, so forms already in use show pictures too.
import { ART } from './option-art-index.js';

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

export function artFor(fieldId, label) {
  const cat = artCategory(fieldId);
  const files = ART[cat];
  if (!files) return '';
  const s = cat === 'budget' ? budgetTier(label) : slug(label);
  const name = [s, `${s}s`, ALIASES[cat]?.[s]].find((x) => x && files[x]);
  return name ? `/library/options/${cat}/${name}.${files[name]}` : '';
}
// Picture of a built-in piece on the first step of the form.
const PIECES = { pendant: '/library/pendant/script.webp', chain: '/site/gallery/chain-category-v2.webp', ring: '/library/ring/solitaire.webp', grillz: '/library/grillz/top8.webp', bracelet: '/library/bracelet/cuban.webp', earrings: '/library/earrings/hoops.webp', watch: '/library/watch/iced.webp' };
export const optionArt = (fieldId, option) => option.image || (fieldId === 'type' ? PIECES[option.value] || '' : artFor(fieldId, option.label));
// The whole catalogue, for the image library in the builder.
export const artList = () => Object.entries(ART).flatMap(([cat, files]) => Object.entries(files).map(([name, ext]) => ({ image: `/library/options/${cat}/${name}.${ext}`, label: `${cat.replace(/-/g, ' ')}: ${name.replace(/-/g, ' ')}` })));
