// Try-on tekstovi po komadu (24.11.2026: try-on za sve komade, ne samo grillz).
// Dijele ga forma (public/form.js), server (src/worker.js, src/tryon.js) i builder, da kupac, portal i model kažu isto.
// Grillz tekstovi su ostali tačno kakvi su bili. Komad koji zlatar sam doda (custom) dobija opšte "See it on you".
const WRIST = (noun, alt) => ({
  noun, alt,
  title: 'See it on your wrist',
  intro: `Upload a photo of your wrist from above, hand relaxed and the wrist fully in view. We will show you wearing the ${noun} above.`,
  button: 'Upload a wrist photo',
  wait: 'Putting it on your wrist',
  caption: 'On your wrist',
  portal: 'On their wrist',
  own: 'your own wrist',
  photoOf: 'a photo of their wrist',
});
const ON_YOU = (noun, alt) => ({
  noun, alt,
  title: 'See it on you',
  intro: `Upload a photo of you from the chest up, facing the camera with your neck visible. We will show you wearing the ${noun} above.`,
  button: 'Upload a photo of you',
  wait: 'Putting it on you',
  caption: 'On you',
  portal: 'On them',
  own: 'your own neck and chest',
  photoOf: 'a photo of their neck and chest',
});

export const TRYON_COPY = {
  grillz: {
    noun: 'grillz', alt: 'You wearing your grillz',
    title: 'See them on your smile',
    intro: 'Upload a photo of you smiling with your teeth showing. We will show you wearing the design above.',
    button: 'Upload a smiling photo',
    wait: 'Putting them on your smile',
    caption: 'On your smile',
    portal: 'On their smile',
    own: 'your own smile',
    photoOf: 'a smiling photo',
  },
  earrings: {
    noun: 'earrings', alt: 'You wearing your earrings',
    title: 'See them on your ear',
    intro: 'Upload a clear photo of your ear from the side, with your hair tucked back. We will show you wearing the earrings above.',
    button: 'Upload an ear photo',
    wait: 'Putting them on your ear',
    caption: 'On your ear',
    portal: 'On their ear',
    own: 'your own ear',
    photoOf: 'a photo of their ear',
  },
  ring: {
    noun: 'ring', alt: 'You wearing your ring',
    title: 'See it on your hand',
    intro: 'Upload a photo of your hand, back of the hand to the camera, fingers relaxed and slightly apart. We will show you wearing the ring above.',
    button: 'Upload a hand photo',
    wait: 'Putting it on your hand',
    caption: 'On your hand',
    portal: 'On their hand',
    own: 'your own hand',
    photoOf: 'a photo of their hand',
  },
  watch: WRIST('watch', 'You wearing your watch'),
  bracelet: WRIST('bracelet', 'You wearing your bracelet'),
  chain: ON_YOU('chain', 'You wearing your chain'),
  pendant: ON_YOU('pendant', 'You wearing your pendant'),
};

const GENERIC = {
  noun: 'design', alt: 'You wearing your piece',
  title: 'See it on you',
  intro: 'Upload a photo of where you would wear this piece. We will show you wearing the design above.',
  button: 'Upload a photo of you',
  wait: 'Putting it on you',
  caption: 'On you',
  portal: 'On them',
  own: 'yourself',
  photoOf: 'a photo of themselves',
};

export const tryOnCopy = (type) => (Object.hasOwn(TRYON_COPY, type) ? TRYON_COPY[type] : GENERIC);
