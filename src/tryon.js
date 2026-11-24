import { teethPlan } from './teeth.js';
import { INSIDE_RULE } from './prompt.js';
import { tryOnCopy } from '../public/tryon-copy.js';

export { tryOnCopy };

// Try-on na fotografiji kupca. Grillz ima svoj prompt (zubi, mapa, osmijeh) i ostao je isti kao prije 24.11.2026;
// ostali komadi (prsten, minđuše, sat, narukvica, lanac, privjesak, custom) idu kroz pieceTryOnPrompt.
export function buildTryOnPrompt(answers = {}, form = null) {
  // Bez tipa = stari poziv (funkcija je ranije bila samo za grillz).
  return !answers.type || answers.type === 'grillz' ? grillzTryOnPrompt(answers) : pieceTryOnPrompt(answers, form);
}

// Selected positions limit coverage; the product render supplies each selected cap's design.
function grillzTryOnPrompt(answers = {}) {
  const plan = teethPlan(answers.teeth);
  return [
    'Edit IMAGE 1, the customer photograph. IMAGE 2 is the approved grillz product render and is a jewelry reference only. Return one edited version of IMAGE 1, never a product shot or a collage.',
    'FIT PRIORITY: IMAGE 1 determines the tooth anatomy, dental arch, bite, visible tooth area and lighting. IMAGE 2 determines which jewelry design is worn: metal, stone setting, coverage, cutouts and ornament. Refit that design as custom-molded physical caps on this person. The detached product silhouette and studio presentation must not override the actual teeth or smile.',
    'STRICT ONE-TO-ONE TRANSFER: identify the tooth caps in IMAGE 2 that correspond to the selected positions below. Fit only those caps, once each, onto their corresponding natural teeth in IMAGE 1. Do not extend the grill across the smile, repeat a cap, add side caps, invent a second row, or fill adjacent teeth to make a full set. Rims, sidewalls and connectors are parts of a cap, not additional covered teeth.',
    'Match every cap separately: retain its metal color, plain metal areas, stone coverage, setting pattern, cutouts and distinctive details from IMAGE 2. Adapt its contour and the perspective of its stone setting to its target tooth rather than copying the detached cap outline literally. A plain metal cap must remain plain metal; do not spread the diamond texture from a neighboring cap onto it. Preserve openings as openings with the natural tooth visible through them.',
    ...(plan ? [
      'TOOTH PLACEMENT MAP (front view, viewer\'s left and right refer to the displayed photograph, not the person\'s own left and right; never mirror the photograph):',
      ...plan.lines.slice(0, -1),
      ...(!plan.top ? ['The upper teeth are unselected: leave the entire upper row unchanged.'] : []),
      ...(!plan.bottom ? ['The lower teeth are unselected: leave the entire lower row unchanged.'] : []),
      `COVERAGE LIMIT: at most ${plan.top} upper and ${plan.bottom} lower teeth may receive jewelry, ${plan.top + plan.bottom} caps total. The selected tooth map overrides any extra jewelry visible in IMAGE 2. If the product render includes additional plain metal side teeth, wings or a backing arch, omit those entirely. Transfer only the design of the selected caps, never the surplus framework. If the render has fewer caps than selected, do not invent missing caps.`,
    ] : ['Determine the covered tooth positions only from IMAGE 2. Do not infer a full set from a style name or from the width of the customer\'s smile.']),
    'LOCAL EDIT ONLY: every tooth without a transferred cap must remain the original natural enamel from IMAGE 1, with the same color, shape, spacing and texture. Preserve the original gums, lips, tongue and mouth opening. Do not whiten, reshape, replace or add teeth. Do not cover a tooth merely because it is next to a covered tooth.',
    'Fit the jewelry to the existing tooth surfaces and dental arch at the original tooth size and camera perspective. Keep natural tooth-to-tooth boundaries, subtle cap thickness and realistic contact shadows. Lips and gums must occlude the caps naturally; never paint jewelry over lips or gums. If a target tooth is hidden, leave it hidden instead of opening the mouth or exposing more teeth.',
    'ANATOMICAL FIT: follow the individual contours, subtle asymmetry and original alignment of the actual teeth. Upper central incisors remain broad and rounded, lateral incisors narrower and canines gently tapered; lower incisors retain their own narrower shapes. Wrap each cap around a convex tooth with a thin rounded metal rim and slight physical depth, never a flat inset panel. Side caps turn away along the curved arch and become foreshortened. Do not straighten the smile into a level row of identical rectangles or reduce the design to tiny identical gold squares or stamp a flat checkerboard over the center of the smile.',
    'VISIBILITY BEFORE DISPLAY: the selected count describes teeth fitted with caps, not a requirement to display every cap in full. Preserve the original upper/lower overlap and dark bite gap. Where the lower lip or upper teeth hide part of a lower cap, show only the originally exposed portion, even a short sliver. Never stretch the lower row, lower the lip, separate the jaws or expose hidden jewelry to match the catalog arrangement.',
    'PHOTOGRAPHIC RELIGHTING IS REQUIRED: infer the key-light direction, softness, color temperature, exposure and shadow depth from IMAGE 1 (nose, lips, facial hair and neighboring enamel). Relight the transferred gold and stones under that same illumination. Model the curved surfaces with a gradual light-to-dark rolloff, warm skin reflections in the gold and dark oral-cavity reflections along inward-facing edges. Lips cast soft contact shadows onto the caps; tooth boundaries have subtle ambient occlusion, and rims cast minute contact shadows on the enamel. Preserve dark recesses between stone facets and prongs, with a few small bright glints only where the portrait light would reflect. Neighboring stones must not all have identical brightness or a repeating printed texture. Match the photograph\'s focus, grain and sharpness at the mouth: no macro-detail pasted onto a softer portrait. Preserve the reference design while replacing its catalog lighting with the portrait lighting. No flat white diamond fill, uniformly glowing surfaces, pasted-on edges, sticker look, excessive sparkle, bright halo or artificial dark outline.',
    'Preserve the exact person, facial identity, skin, facial hair, expression, hair, clothing, pose, lighting, camera angle, framing, aspect ratio and background from IMAGE 1. Blend reflections and shadows into that photograph without changing anything outside the covered tooth surfaces. Do not copy the studio background, display arrangement or detached-product lighting from IMAGE 2.',
    'Before returning the image, check upper and lower coverage independently against the selected map: no extra capped teeth, per-tooth shapes and plain versus stone-set surfaces match the selected parts of IMAGE 2, all other teeth remain natural, and the jewelry shares the photo\'s lighting and contact shadows. No text, watermark or extra people.',
  ].join('\n');
}

// Gdje komad sjedi i koliki je u stvarnosti. Mjere su tu jer je model sklon da nakit uveća "da se vidi detalj".
const PLACEMENT = {
  ring: {
    piece: 'ring', behind: 'finger',
    where: 'Put the ring on one finger of the hand in IMAGE 1: the ring finger when it is clearly visible, otherwise the most visible finger. It sits at the base of the finger, between the knuckle and the palm, with the top or center stone facing up on the back of the finger. The band wraps all the way around the finger: its far side disappears behind the finger, and the skin above and below the band stays visible.',
    scale: 'REAL SIZE: the band is about 2 to 6 mm wide and fits the finger snugly, never wider than the finger is thick; the head and any center stone stay in proportion to that finger (a 1 carat round stone is about 6.5 mm across, clearly narrower than the finger). Never enlarge the ring to show its detail.',
    hidden: 'If no finger is visible, do not invent a hand.',
  },
  earrings: {
    piece: 'pair of earrings', behind: 'earlobe',
    where: 'Put one earring on the earlobe of each ear that is visible in IMAGE 1, at the spot where a piercing sits (one earring when only one ear is visible; never add an ear or turn the head). Studs sit flat on the front of the lobe; drops, huggies and hoops hang from that same point and follow gravity.',
    scale: 'REAL SIZE relative to the ear: a stud is a few millimetres, much smaller than the earlobe; hoops and drops keep the proportions of IMAGE 2 relative to a real ear and never reach past the jawline unless IMAGE 2 is clearly a long drop. Never enlarge the earrings to show their detail.',
    hidden: 'Hair that falls in front of the ear stays in front of the earring.',
  },
  watch: {
    piece: 'watch', behind: 'wrist',
    where: 'Put the watch on the wrist in IMAGE 1, on the forearm side just above the wrist bone, with the case on top of the wrist and the dial turned toward the camera as far as the real wrist allows. The strap or bracelet wraps around the wrist and its far side disappears behind it.',
    scale: 'REAL SIZE: the case is about 38 to 44 mm across, about the width of the top of the wrist and never wider than the wrist; the case has visible real thickness at its side. Never enlarge the watch to show its detail.',
    hidden: 'If no wrist is visible, do not invent an arm.',
  },
  bracelet: {
    piece: 'bracelet', behind: 'wrist',
    where: 'Put the bracelet around the wrist in IMAGE 1, resting loosely just below the wrist bone toward the hand. It circles the wrist with a little slack, drapes with gravity and its far side passes behind the wrist.',
    scale: 'REAL SIZE: the links keep the width shown in IMAGE 2 relative to a real wrist (most bracelets are 3 to 15 mm wide); a 7 to 8 inch bracelet circles an adult wrist once. Never enlarge the bracelet to show its detail.',
    hidden: 'If no wrist is visible, do not invent an arm.',
  },
  chain: {
    piece: 'chain necklace', behind: 'neck',
    where: 'Put the chain around the neck in IMAGE 1. It lies on the skin or on the clothing at the neckline, follows the curve of the neck and collarbones and hangs with gravity into one smooth curve; the back of the chain passes behind the neck and is hidden by the neck, hair or collar. If a shirt covers the chest, the chain lies over the clothing.',
    scale: 'REAL SIZE: the link width from IMAGE 2 at true scale on this neck (most chains are 3 to 12 mm wide); unless a length is given below, a typical 20 to 22 inch length that ends around the collarbones or upper chest. Never enlarge the chain to show its detail.',
    hidden: 'If the neck is not visible, do not invent a body.',
  },
  pendant: {
    piece: 'pendant on its chain', behind: 'neck',
    where: 'Put the chain around the neck in IMAGE 1 and let the pendant hang from it at the center of the chest, facing the camera, straight down by gravity, resting on the skin or the clothing. The back of the chain passes behind the neck and is hidden by the neck, hair or collar.',
    scale: 'REAL SIZE: a pendant is usually 2 to 6 cm tall, never larger than the palm of a hand; the chain keeps the width shown in IMAGE 2. Never enlarge the pendant to show its detail.',
    hidden: 'If the neck and chest are not visible, do not invent a body.',
  },
};

// Kupčeve mjere (dužina lanca, veličina prstena, karati...) idu modelu kao stvarna veličina, ako ih forma pita.
const oneLine = (v, max) => String(v ?? '').replace(/[\r\n"]+/g, ' ').trim().slice(0, max);
function sizeLines(answers) {
  return Object.entries(answers)
    .filter(([k, v]) => /(^|_)(length|size|width|carat|mm|inch|inches)(_|$)/i.test(k) && !/__more$/.test(k) && ['string', 'number'].includes(typeof v) && oneLine(v, 40) && String(v).length <= 40)
    .map(([k, v]) => `${oneLine(k.replace(/_/g, ' '), 40)}: ${oneLine(v, 40)}`);
}

function pieceTryOnPrompt(answers = {}, form = null) {
  const type = answers.type;
  const typeOpt = ((form?.steps || []).flatMap((st) => st.fields || []).find((f) => f.id === 'type')?.options || []).find((o) => o.value === type);
  const custom = oneLine(typeOpt?.label || 'piece of jewelry', 60).toLowerCase();
  const known = Object.hasOwn(PLACEMENT, type);
  const p = known ? PLACEMENT[type] : {
    piece: custom, behind: 'body',
    where: `Put the ${custom} where this kind of piece is naturally worn on the body visible in IMAGE 1, worn the way a real customer would wear it.`,
    scale: `REAL SIZE: the ${custom} keeps true real-world proportions relative to the body. Never enlarge it to show its detail.`,
    hidden: 'Do not invent body parts that are not in IMAGE 1.',
  };
  const text = oneLine(answers.inscription, 24);
  const sizes = sizeLines(answers);
  const pair = type === 'earrings';
  return [
    `Edit IMAGE 1, the customer photograph. IMAGE 2 is the approved ${p.piece} product render and is a jewelry reference only. Return one edited version of IMAGE 1 with the customer wearing that exact piece, never a product shot or a collage.`,
    'PRESERVE THE PHOTO: keep the exact person, facial identity, skin tone and texture, tattoos, nails, hair, clothing, pose, hand and body position, expression, lighting, camera angle, framing, aspect ratio and background of IMAGE 1. The only change is the jewelry being worn. Do not retouch, smooth, slim or beautify anything, and do not copy the studio background or display lighting from IMAGE 2.',
    `PLACEMENT: ${p.where}`,
    p.scale,
    ...(sizes.length ? [`The customer chose these sizes; use them for the real-world scale: ${sizes.join('; ')}.`] : []),
    `EXACT DESIGN: transfer the piece from IMAGE 2 one to one: the same shape, metal color and karat tone, links and band profile, stone type, stone placement and coverage, setting pattern, cutouts and details. Only the perspective changes to follow the body. Do not redesign, simplify, add stones, add extra parts or add a second piece${pair ? ' (the matching second earring is the only addition, on the other ear)' : ''}.`,
    text
      ? `The piece carries the lettering "${text}", spelled exactly letter by letter: ${text.split('').join(' ')}, in the same lettering style as IMAGE 2; at real size it may be small, but it never changes and is never misspelled. No other text.`
      : 'Any lettering in IMAGE 2 stays exactly as it is, letter by letter, at real size; add no other text.',
    `${INSIDE_RULE(type)} In this photo the skin side stays hidden or reads as plain polished metal.`,
    `OCCLUSION AND PHYSICS: the jewelry wraps around the body in three dimensions; parts behind the ${p.behind} are hidden, and fingers, hair or clothing in front of it stay in front. It has real weight: it hangs or rests with gravity and casts a soft contact shadow where metal touches skin or fabric. ${p.hidden}`,
    'PHOTOGRAPHIC RELIGHTING IS REQUIRED: infer the key-light direction, softness, color temperature, exposure and shadow depth from IMAGE 1 and relight the metal and stones under that same light. Polished metal reflects the skin, clothing and surroundings of IMAGE 1 with a gradual light-to-dark rolloff; stones show dark extinction areas and black facet reflections with only a few small bright glints where this light would hit, some stones darker than others. Match the photograph\'s focus, depth of field, grain and sharpness at that spot: no macro detail pasted onto a softer photo. No flat white diamond fill, glowing surfaces, sparkle stars, bloom, halo, sticker look, pasted-on edges or artificial outline.',
    'REAL PHOTO LOOK: the result must look like an unretouched photograph of a real handmade piece being worn, not a 3D render or CGI: real precious metal in exactly the color of IMAGE 2 (never orange or neon), slightly rounded hand-finished edges, hand-set stones with tiny prongs or beads, believable thickness and weight.',
    `Before returning the image, check: exactly one ${p.piece}${pair ? ' (one earring per visible ear)' : ''}, in the right place at real size, the design matches IMAGE 2, and everything outside the jewelry is unchanged from IMAGE 1. No text, watermark or extra people.`,
  ].join('\n');
}
