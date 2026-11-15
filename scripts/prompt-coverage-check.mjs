// Da li svaki izbor kupca stigne do AI-ja. Za svaki komad prođe formu (uslovi, opcije po komadu),
// izabere prve pa zadnje opcije svakog pitanja i provjeri da se svaki odgovor vidi u promptu (natpis ili AI napomena).
// Bez servera i bez troška: node scripts/prompt-coverage-check.mjs [forma.json]
// Bez argumenta provjerava sve šablone; sa argumentom formu iz /api/forms/<id> (npr. Districtovu).
import { readFileSync } from 'node:fs';
import { buildPrompt } from '../src/prompt.js';
import { conditionsMet } from '../public/step-rules.js';
import { TEMPLATES, fromTemplate } from '../src/forms.js';

const forms = process.argv[2]
  ? [(() => { const d = JSON.parse(readFileSync(process.argv[2], 'utf8')); return d.form || d; })()]
  : Object.keys(TEMPLATES).map((t) => fromTemplate(t, { id: `check-${t}`, brand: 'Check' }));

// Odgovori koji se u promptu namjerno pišu drugim riječima.
const said = (k, label, p) => (k === 'coverage' && label === 'none' && p.includes('not iced')) || (/925/.test(label) && p.includes('925 sterling silver'));
let fails = 0;
for (const form of forms) {
  const fields = form.steps.filter((s) => s.enabled !== false).flatMap((s) => s.fields.filter((f) => f.enabled !== false));
  const typeField = fields.find((f) => f.id === 'type') || form.steps[0].fields[0];
  const opts = (f, a) => { const l = f.perPiece?.[a.type]; return (f.options || []).filter((o) => !Array.isArray(l) || l.includes(o.value)); };
  for (const pick of ['first', 'last']) {
    for (const type of typeField.options.map((o) => o.value)) {
      const a = { type, style: (form.styles?.[type] || [])[0]?.value };
      for (const f of fields) {
        if (['type', 'style'].includes(f.id) || !conditionsMet(f, a)) continue;
        const l = f.perPiece?.[type];
        if (Array.isArray(l) && !l.length) continue;
        if (f.type === 'teeth') { a.teeth = 'T4,T5,T6,T7'; continue; }
        if (f.id === 'inscription') { a.inscription = 'ACE'; continue; }
        if (f.type === 'upload' || f.id === 'vision') continue;
        const o = opts(f, a);
        if (!o.length) { if (f.type === 'text') a[f.id] = 'xyz'; continue; }
        a[f.id] = (pick === 'first' ? o[0] : o[o.length - 1]).value;
      }
      const p = buildPrompt(form, a).toLowerCase();
      const miss = Object.entries(a).filter(([k]) => !['type', 'style', 'teeth', 'inscription', 'budget'].includes(k)).filter(([k, v]) => {
        const f = fields.find((x) => x.id === k);
        if (!f || f.ai === false) return false;
        const o = (f.options || []).find((x) => x.value === v);
        const label = (o?.label || String(v)).toLowerCase();
        return !p.includes(label) && !(o?.note && p.includes(o.note.toLowerCase().slice(0, 25))) && !said(k, label, p);
      }).map(([k, v]) => `${k}=${v}`);
      if (miss.length) { fails++; console.log(`FAIL ${form.id} ${type} (${pick}): ${miss.join(', ')}`); }
    }
  }
  if (!fails) console.log(`OK   ${form.id}: every choice reaches the prompt`);
}
// Pravila koja moraju stajati u promptu.
const ring = buildPrompt(fromTemplate('custom-enquiry', { id: 'x', brand: 'B' }), { type: 'ring', metal: 'yellow-gold', karat: '14K', stones: 'natural', coverage: 'full' });
if (!/inside of the band .* never set with stones/.test(ring)) { fails++; console.log('FAIL ring: inside of the band is not kept plain'); } else console.log('OK   ring: stones only on the outside');
if (fails) process.exit(1);
