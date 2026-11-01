// What must be fixed before an onboarding can be sent. Shared: the portal shows these and jumps to them, the server refuses to accept them.
// Each problem: { step: onboarding step key, field: data-ob path of the input (optional), message }.
const text = (v) => String(v ?? '').trim();
const dup = (list, v) => list.filter((x) => text(x).toLowerCase() === text(v).toLowerCase()).length > 1;

export function onboardingProblems(d) {
  const out = [];
  const add = (step, field, message) => out.push({ step, field, message });
  if (!text(d?.store?.name)) add('store', 'store.name', 'Enter your store name.');
  const pieces = Array.isArray(d?.pieces) ? d.pieces : [];
  if (!pieces.length) add('pieces', '', 'Pick at least one piece you make.');
  pieces.forEach((pc, i) => {
    const name = text(pc.label);
    if (!name) { add('pieces', `pieces.${i}.label`, 'Give this piece a name, or remove it.'); return; }
    const at = (sub) => `p:${pc.uid}:${sub}`;
    const offered = (pc.styles || []).filter((s) => s.keep !== false);
    (pc.styles || []).forEach((s, j) => {
      if (s.keep === false) return;
      const field = `pieces.${i}.styles.${j}.label`;
      if (!text(s.label)) add(at('styles'), field, `${name}: give this style a name, or remove it.`);
      else if (dup(offered.map((x) => x.label), s.label)) add(at('styles'), field, `${name}: two styles are called "${text(s.label)}". Rename one of them.`);
    });
    const budgets = pc.budgets || [];
    budgets.forEach((b, k) => {
      const field = `pieces.${i}.budgets.${k}`;
      if (!text(b)) add(at('materials'), field, `${name}: fill in this budget range, or remove it.`);
      else if (dup(budgets, b)) add(at('materials'), field, `${name}: the budget range "${text(b)}" is listed twice.`);
    });
    if (pc.required?.materials !== false && Array.isArray(pc.metals) && !pc.metals.length && !(pc.stones || []).length && !budgets.some(text)) {
      add(at('materials'), '', `${name}: Materials & budget is a required step, but nothing is selected. Select something, or turn off "Required step".`);
    }
    const questions = pc.questions || [];
    questions.forEach((q, k) => {
      if (!text(q.label) && text(q.options)) add(at('details'), `pieces.${i}.questions.${k}.label`, `${name}: write the question for these answers, or remove it.`);
      else if (text(q.label) && String(q.options || '').split(',').filter(text).length === 1) add(at('details'), `pieces.${i}.questions.${k}.options`, `${name}: "${text(q.label)}" needs at least two answers, or leave the answers empty so customers type one.`);
    });
    const specs = Object.values(pc.specs || {});
    const noSpecs = !pc.value || (specs.length > 0 && specs.every((v) => !v?.length));
    if (pc.required?.details === true && !questions.some((q) => text(q.label)) && noSpecs) {
      add(at('details'), '', `${name}: Details is a required step, but there is nothing to ask. Add a question, or turn off "Required step".`);
    }
  });
  (Array.isArray(d?.products) ? d.products : []).forEach((x, k) => {
    const used = text(x.name) || text(x.price) || text(x.url) || text(x.description) || text(x.image);
    if (used && !text(x.name)) add('products', `products.${k}.name`, 'Give this product a name, or remove it.');
    if (text(x.url) && !/^https?:\/\/[^\s"'<>]+$/i.test(text(x.url))) add('products', `products.${k}.url`, 'Use the full shop address, starting with https://');
  });
  return out;
}
