// Required steps, shared by the form and the server.
// step.required: the customer must answer at least one question of the step. field.required: that question must be answered.
// step.optionalFor: pieces for which neither applies (the jeweler made this step optional for that piece).
import { teethOptional } from './grillz-selection.js';

const skipped = (step, a) => (step.optionalFor || []).includes(a.type);
export const stepNeedsAnswer = (step, a) => step.required === true && !skipped(step, a);
export const fieldRequired = (form, step, field, a) => !!field.required && !skipped(step, a) && !(field.type === 'teeth' && teethOptional(form, a));

// Display conditions. field.showIf is the main one (often the piece: { field: 'type', in: ['grillz'] }),
// field.andIf adds more, and every one must hold (e.g. grillz cut only when the grill is not iced).
//   in: shown when the answer is one of the values
//   notIn: shown when the question is answered with something else
//   not: hidden when the answer is one of the values (unanswered or skipped counts as shown)
export const CONDITION_MODES = ['in', 'notIn', 'not'];
export function conditionMet(c, a) {
  if (!c || typeof c !== 'object') return true;
  const v = a[c.field];
  if (Array.isArray(c.in)) return c.in.includes(v);
  if (Array.isArray(c.notIn)) return v != null && v !== '' && !c.notIn.includes(v);
  if (Array.isArray(c.not)) return !c.not.includes(v);
  return true;
}
export const conditionsMet = (field, a) => conditionMet(field.showIf, a) && (Array.isArray(field.andIf) ? field.andIf : []).every((c) => conditionMet(c, a));
export const conditionsOf = (field) => [field.showIf, ...(Array.isArray(field.andIf) ? field.andIf : [])].filter(Boolean);
