// Every style and answer the forms offer has a picture, and a style finds its picture by name however it was written.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SUGGESTED, suggestOptions } from '../public/option-suggestions.js';
import { artFor, optionArt, styleArt, withArt } from '../public/option-art.js';

const onDisk = (src) => existsSync(new URL(`../public${src}`, import.meta.url));
const missing = [];
for (const [piece, list] of Object.entries(SUGGESTED.styles)) for (const label of list) { const src = styleArt(piece, label); if (!src || !onDisk(src)) missing.push(`${piece}: ${label}`); }
for (const label of SUGGESTED.pieces) { const src = optionArt('type', { label }); if (!src || !onDisk(src)) missing.push(`piece: ${label}`); }
for (const cat of ['metal', 'karat', 'stones', 'center-shape', 'length', 'size', 'coverage', 'clarity']) for (const label of suggestOptions(cat, cat)) if (!artFor(cat, label)) missing.push(`${cat}: ${label}`);
for (const q of SUGGESTED.questions.filter((x) => ['Finish', 'Stone setting', 'Clasp', 'Stone color', 'Engraving'].includes(x.label))) {
  for (const label of q.options.split(', ')) if (!withArt({ id: 'q7', label: q.label }, { value: label, label }).image) missing.push(`${q.label}: ${label}`);
}
assert.deepEqual(missing, []);

const same = [['chain', 'Figaro chain', 'figaro'], ['chain', 'Herringbone Chain', 'herringbone'], ['chain', 'Miami Cuban', 'cuban'], ['chain', 'Cuban link', 'cuban'], ['chain', 'Iced Cuban', 'cuban'], ['chain', 'Ball chain', 'bead'],
  ['bracelet', 'ID bracelet', 'id'], ['bracelet', 'Cuban link', 'cuban'], ['bracelet', 'Tennis bracelet', 'tennis'], ['earrings', 'Hoop earrings', 'hoops'], ['earrings', 'Huggie', 'huggies'], ['grillz', 'Top 6', 'top6'], ['watch', 'Bezel only', 'bezel'], ['ring', 'Eternity band', 'eternity']];
for (const [piece, label, file] of same) assert.equal(styleArt(piece, label), `/library/${piece}/${file}.webp`, label);
assert.equal(styleArt('chain', 'Nothing like this'), '');
assert.equal(styleArt('anklet', 'Figaro'), '');
assert.equal(withArt({ id: 'metal', label: 'Metal' }, { value: 'x', label: 'Gold', image: '/media/forms/a/b.webp' }).image, '/media/forms/a/b.webp');
console.log('Style art checks passed.');
