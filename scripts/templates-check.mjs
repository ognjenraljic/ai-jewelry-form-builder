import { TEMPLATES, fromTemplate, validateFormDef, FORMS } from '../src/forms.js';
for (const t of Object.keys(TEMPLATES)) {
  const f = fromTemplate(t, { id: `t-${t}`, brand: 'Northstar Jewelers', clientId: 'northstar' });
  try { validateFormDef(f, f.id); console.log('OK  ', t, f.steps.map((s) => s.id + (s.enabled === false ? '(off)' : '')).join(' > ')); }
  catch (e) { console.log('FAIL', t, e.message); }
}
validateFormDef(FORMS.demo, 'demo'); console.log('OK   demo');
