// Shared by the form and server: a preset style marks its teeth in the picker, the customer can then change any tooth.
export const PRESET_TEETH = {
  top6: 'T3,T4,T5,T6,T7,T8',
  top8: 'T2,T3,T4,T5,T6,T7,T8,T9',
  set: 'T2,T3,T4,T5,T6,T7,T8,T9,B2,B3,B4,B5,B6,B7,B8,B9',
  fangs: 'T3,T8',
};

export function presetTeeth(style) {
  if (!style) return '';
  const libraryKey = (style.image || '').match(/^\/library\/grillz\/(top6|top8|set|fangs)\.webp$/)?.[1];
  return style.teeth || PRESET_TEETH[style.value] || PRESET_TEETH[libraryKey] || '';
}
const styleIn = (form, answers) => form.styles?.grillz?.find(s => s.value === answers.style);
// Only fills an empty selection: picks the customer already made stay. Changing the style clears them first (form.js).
export function applyPresetTeeth(form, answers, style = styleIn(form, answers)) {
  if (answers.type !== 'grillz' || answers.teeth) return;
  const teeth = presetTeeth(style);
  if (teeth) answers.teeth = teeth;
}
// A jeweler's own photo style has no known layout, so its coverage may come from the photo alone.
export const teethOptional = (form, answers, style = styleIn(form, answers)) => !!style && !presetTeeth(style);
