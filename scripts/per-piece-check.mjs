// Onboarding po komadu -> forma: metali, karati, kamenje i budžet po komadu (perPiece), korak detalja po komadu,
// proizvodi iz radnje, i stariji onboarding sa zajedničkim listama. Bez servera: node scripts/per-piece-check.mjs
import { formFromOnboarding, validateFormDef, ONBOARDING_DEFAULTS, publicForm, optionsOf, offeredFor } from '../src/forms.js';
import assert from 'node:assert/strict';
const D = ONBOARDING_DEFAULTS;
const d = {
  store: { name: 'Aurora', accent: '#d8b46a', theme: 'dark' },
  pieces: [
    { uid: 'a1', value: 'chain', label: 'Chain', styles: D.styles.chain.map(s => ({ ...s, keep: true })), metals: ['yellow-gold', 'white-gold', 'custom-x'], karats: ['14K', '18K'], stones: ['none'], budgets: ['$1,000 - $3,000', '$3,000+'], specs: { length: ['18', '20', '22'] }, questions: [{ uid: 'q1', label: 'Clasp type', options: 'Box, Lobster' }] },
    { uid: 'b2', value: 'grillz', label: 'Grillz', styles: D.styles.grillz.map(s => ({ ...s, keep: true })), metals: ['yellow-gold', 'white-gold', 'rose-gold'], karats: ['10K', '14K'], stones: ['moissanite', 'lab', 'none'], budgets: ['Under $500', '$500 - $1,500', '$3,000+'], specs: { mold: [] }, questions: [] },
    { uid: 'c3', value: '', label: 'Belt buckle', styles: [], metals: ['yellow-gold'], karats: [], stones: [], budgets: [], questions: [{ uid: 'q2', label: 'Initials?', options: '' }] },
  ],
  customMetals: [{ value: 'custom-x', label: 'Black gold', swatch: '#222222' }], customStones: [],
  metals: [], stones: [], budgets: [],
  products: [{ uid: 'p1', name: 'Cuban 20"', price: '$2,400', url: 'https://shop.example/cuban', description: '14K', image: '', pieces: ['a1'] }, { uid: 'p2', name: 'Gift box', pieces: [] }, { uid: 'p3', name: '', pieces: [] }],
};
const f = formFromOnboarding(d, { id: 'unit-test', clientId: 'c', brand: 'Aurora' });
validateFormDef(f, 'unit-test');
const fld = (id) => f.steps.flatMap(s => s.fields).find(x => x.id === id);
const a = { type: 'grillz' };
assert.deepEqual(optionsOf(fld('metal'), a, f).map(o => o.value), ['yellow-gold', 'white-gold', 'rose-gold']);
assert.equal(offeredFor(fld('stones'), { type: 'chain' }), false);
assert.equal(offeredFor(fld('karat'), { type: 'belt-buckle' }), false);
assert.ok(publicForm(f).products.length === 2);
// legacy onboarding (global lists)
const legacy = { store: { name: 'Old' }, pieces: [{ uid: 'x', value: 'ring', label: 'Ring', styles: [] }], metals: ['yellow-gold'], stones: ['none'], budgets: ['$1k'] };
const g = formFromOnboarding(legacy, { id: 'legacy', clientId: 'c', brand: 'Old' });
validateFormDef(g, 'legacy');
const gf = (id) => g.steps.flatMap(s => s.fields).find(x => x.id === id);
assert.deepEqual(f.steps.map((s) => s.id), ['type', 'style', 'teeth', 'design', 'd-chain', 'd-grillz', 'd-belt-buckle', 'budget', 'vision']);
assert.deepEqual(optionsOf(fld('budget'), a, f).map((o) => o.label), ['Under $500', '$500 - $1,500', '$3,000+'], 'budget keeps the piece order');
assert.deepEqual(fld('chain_length').options.map((o) => o.value), ['18', '20', '22']);
assert.deepEqual(f.products.map((p) => p.pieces), [['chain'], []]);
assert.equal(gf('stones').enabled, false, 'legacy: only "no stones" turns stone questions off');
assert.equal(gf('metal').perPiece, undefined, 'legacy: one shared metal list, no per-piece limits');
console.log('Per-piece onboarding checks passed.');
