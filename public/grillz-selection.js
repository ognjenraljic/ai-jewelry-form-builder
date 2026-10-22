// Shared by the form and server: preset styles own coverage; only Something else opens the picker.
export const PRESET_TEETH = {
  top6: 'T3,T4,T5,T6,T7,T8',
  top8: 'T2,T3,T4,T5,T6,T7,T8,T9',
  set: 'T2,T3,T4,T5,T6,T7,T8,T9,B2,B3,B4,B5,B6,B7,B8,B9',
  fangs: 'T3,T8',
};

export const hasStyleChoice = form => (form.steps || []).some(s => s.enabled !== false && s.fields.some(f => f.id === 'style' && f.enabled !== false));
export const customTeethVisible = (form, answers) => !hasStyleChoice(form) || answers.style === 'other';
export function presetTeeth(style) {
  if (!style) return '';
  const libraryKey = (style.image || '').match(/^\/library\/grillz\/(top6|top8|set|fangs)\.webp$/)?.[1];
  return style.teeth || PRESET_TEETH[style.value] || PRESET_TEETH[libraryKey] || '';
}
export function applyPresetTeeth(form, answers, style = form.styles?.grillz?.find(s => s.value === answers.style)) {
  if (answers.type !== 'grillz' || customTeethVisible(form, answers)) return;
  const teeth = presetTeeth(style);
  if (teeth) answers.teeth = teeth;
  else delete answers.teeth; // A custom photo preset describes its coverage visually; stale manual picks cannot override it.
}
