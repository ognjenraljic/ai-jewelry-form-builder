// Required steps, shared by the form and the server.
// step.required: the customer must answer at least one question of the step. field.required: that question must be answered.
// step.optionalFor: pieces for which neither applies (the jeweler made this step optional for that piece).
import { teethOptional } from './grillz-selection.js';

const skipped = (step, a) => (step.optionalFor || []).includes(a.type);
export const stepNeedsAnswer = (step, a) => step.required === true && !skipped(step, a);
export const fieldRequired = (form, step, field, a) => !!field.required && !skipped(step, a) && !(field.type === 'teeth' && teethOptional(form, a));
