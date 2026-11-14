// Stilovi slova za natpis (ime na privjesku, gravura, inicijali na zubu). Isti spisak koriste forma, builder i šabloni.
// Fontovi su OFL (Google Fonts), servirani sa našeg domena iz /fonts/lettering/ i učitavaju se tek kad se pitanje prikaže.
// note ide AI-ju: model ne zna ime fonta, ali zna opis oblika slova.
// Bez kategorija (muški/ženski): Ognjen 14.11, samo nabrojani fontovi.
export const LETTERING = [
  { value: 'old-english', label: 'Old English', file: 'UnifrakturMaguntia', note: 'Old English blackletter lettering: bold gothic letters with sharp angled strokes and pointed serifs, like classic nameplates and name grillz' },
  { value: 'gothic', label: 'Gothic', file: 'PirataOne', note: 'condensed gothic blackletter lettering with heavy vertical strokes, clean and modern' },
  { value: 'varsity', label: 'Varsity', file: 'Graduate', note: 'varsity block lettering: square college-jersey letters with slab serifs' },
  { value: 'block', label: 'Block', file: 'BebasNeue', note: 'tall bold block capital letters, clean sans-serif, no serifs' },
  { value: 'graffiti', label: 'Graffiti', file: 'PermanentMarker', note: 'graffiti street lettering: bold hand-drawn marker letters with energy' },
  { value: 'elegant-script', label: 'Elegant script', file: 'GreatVibes', note: 'elegant flowing cursive script with long graceful swashes, letters connected' },
  { value: 'classic-script', label: 'Classic script', file: 'PinyonScript', note: 'classic copperplate calligraphy script, fine thin and thick strokes, letters connected' },
  { value: 'casual-script', label: 'Casual script', file: 'DancingScript', note: 'casual bouncy handwritten script, rounded and friendly, letters connected' },
  { value: 'french-script', label: 'French script', file: 'Parisienne', note: 'French romantic script with soft loops, letters connected' },
  { value: 'flowing-script', label: 'Flowing script', file: 'Allura', note: 'light flowing signature-style script, slanted and airy, letters connected' },
];
export const PER_REQUEST = 'per-request';
export const letteringOf = (value) => LETTERING.find((x) => x.value === value) || null;

// Pitanje za šablone i onboarding. "Per request": kupac opiše font u polju ispod (followup).
export const letteringField = (extra = {}) => ({
  id: 'font', type: 'chips', label: 'Lettering style', subtitle: 'For the name or engraving. Not sure? Pick Per request and describe it.',
  required: false, lettering: true, followup: 'text',
  options: [...LETTERING.map(({ value, label, note }) => ({ value, label, note })), { value: PER_REQUEST, label: 'Per request', note: 'lettering style exactly as the customer describes it' }],
  ...extra,
});

// @font-face za sve stilove (browser skida fajl tek kad se slovo stvarno prikaže).
export const letteringCss = () => LETTERING.map((x) => `@font-face{font-family:"JL ${x.file}";src:url(/fonts/lettering/${x.file}.woff2) format("woff2");font-display:swap}`).join('');
