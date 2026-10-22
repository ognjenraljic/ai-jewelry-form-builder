import { teethPlan } from './teeth.js';

// The product render supplies the cap inventory; the answer supplies their anatomical positions.
export function buildTryOnPrompt(answers = {}) {
  const plan = teethPlan(answers.teeth);
  return [
    'Edit IMAGE 1, the customer photograph. IMAGE 2 is the approved grillz product render and is a jewelry reference only. Return one edited version of IMAGE 1, never a product shot or a collage.',
    'STRICT ONE-TO-ONE TRANSFER: first identify each individual tooth cap actually present in IMAGE 2 and its upper or lower row. Fit those same caps, once each, onto the corresponding natural teeth in IMAGE 1. Preserve the exact number of caps in each row. Do not extend the grill across the smile, repeat a cap, add side caps, invent a second row, or fill adjacent teeth to make a full set. Rims, sidewalls and connectors are parts of a cap, not additional covered teeth.',
    'Match every cap separately: its metal color, plain metal areas, stone coverage, stone placement, cutouts, silhouette and distinctive details must stay as in IMAGE 2. A plain metal cap must remain plain metal; do not spread the diamond texture from a neighboring cap onto it. Preserve openings as openings with the natural tooth visible through them.',
    ...(plan ? [
      'TOOTH PLACEMENT MAP (front view, viewer\'s left and right refer to the displayed photograph, not the person\'s own left and right; never mirror the photograph):',
      ...plan.lines.slice(0, -1),
      ...(!plan.top ? ['The upper teeth are unselected: leave the entire upper row unchanged.'] : []),
      ...(!plan.bottom ? ['The lower teeth are unselected: leave the entire lower row unchanged.'] : []),
      'Use this map to position the existing caps, not to generate extra jewelry. If the approved render shows fewer caps than the map requests, transfer only the caps actually visible in IMAGE 2. The approved render is the source of truth for the cap inventory and appearance, including any refinements.',
    ] : ['Determine the covered tooth positions only from IMAGE 2. Do not infer a full set from a style name or from the width of the customer\'s smile.']),
    'LOCAL EDIT ONLY: every tooth without a transferred cap must remain the original natural enamel from IMAGE 1, with the same color, shape, spacing and texture. Preserve the original gums, lips, tongue and mouth opening. Do not whiten, reshape, replace or add teeth. Do not cover a tooth merely because it is next to a covered tooth.',
    'Fit the jewelry to the existing tooth surfaces and dental arch at the original tooth size and camera perspective. Keep natural tooth-to-tooth boundaries, subtle cap thickness and realistic contact shadows. Lips and gums must occlude the caps naturally; never paint jewelry over lips or gums. If a target tooth is hidden, leave it hidden instead of opening the mouth or exposing more teeth.',
    'Preserve the exact person, facial identity, skin, facial hair, expression, hair, clothing, pose, lighting, camera angle, framing, aspect ratio and background from IMAGE 1. Blend reflections and shadows into that photograph without changing anything outside the covered tooth surfaces. Do not copy the studio background, display arrangement or detached-product lighting from IMAGE 2.',
    'Before returning the image, check the upper and lower rows independently: each visible cap must correspond to one cap in IMAGE 2, all plain versus stone-set surfaces must match, and every other tooth must remain natural. No text, watermark or extra people.',
  ].join('\n');
}
