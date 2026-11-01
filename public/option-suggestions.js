// Answers offered whenever something is added, in onboarding and in the builder. Labels only: each list hides what is already there.
import { artCategory } from './option-art.js';

const BUDGETS = ['Under $500', '$500 - $1,000', '$1,000 - $2,500', '$2,500 - $5,000', '$5,000 - $10,000', '$10,000 - $20,000', '$20,000 - $50,000', '$50,000+'];

export const SUGGESTED = {
  pieces: ['Anklet', 'Brooch', 'Cufflinks', 'Charm', 'Nose ring', 'Belly ring', 'Tie clip', 'Belt buckle', 'Body chain', 'Crown'],
  metals: [['Stainless Steel', '#b9bec2'], ['Dental Gold', '#cf9f3f'], ['Sterling Silver', '#d8dade'], ['Black Gold', '#2b2b2e'], ['Palladium', '#c7c8c4'], ['Titanium', '#8f9396']].map(([label, swatch]) => ({ label, swatch })),
  stones: ['Cubic Zirconia', 'Ruby', 'Sapphire', 'Emerald', 'Black Diamonds', 'Colored Diamonds', 'Aquamarine', 'Amethyst', 'Tanzanite', 'Opal', 'Pearl', 'Morganite'].map((label) => ({ label })),
  karats: ['22K', '24K', '9K', '950 Platinum'],
  budgets: BUDGETS,
  styles: {
    ring: ['Solitaire', 'Halo', 'Three-stone', 'Signet', 'Eternity band', 'Cluster', 'Vintage', 'Stackable', 'Championship'],
    chain: ['Miami Cuban', 'Franco', 'Rope', 'Figaro', 'Tennis', 'Box', 'Herringbone', 'Snake', 'Mariner'],
    pendant: ['Cross', 'Initial', 'Name plate', 'Portrait', 'Logo', 'Religious', 'Heart', 'Locket'],
    bracelet: ['Tennis', 'Cuban link', 'Bangle', 'Cuff', 'Charm', 'Figaro', 'Beaded', 'ID bracelet'],
    earrings: ['Studs', 'Hoops', 'Huggies', 'Drops', 'Chandelier', 'Climbers', 'Clusters'],
    watch: ['Dress', 'Diver', 'Chronograph', 'Skeleton', 'Fully iced', 'Bezel only'],
    grillz: ['Top 6', 'Bottom 6', 'Top 8', 'Full set', 'Fangs', 'Single cap', 'Window'],
  },
  questions: [
    { label: 'Finish', options: 'Polished, Matte, Brushed, Hammered' },
    { label: 'Engraving', options: 'No engraving, Initials, Date, Short message' },
    { label: 'Who is it for?', options: 'Me, Partner, Family member, Friend' },
    { label: 'Occasion', options: 'Engagement, Anniversary, Birthday, Gift, Just because' },
    { label: 'When do you need it?', options: 'As soon as possible, Within 1 month, 1 to 3 months, No rush' },
    { label: 'Stone setting', options: 'Prong, Bezel, Pavé, Channel' },
    { label: 'Stone color', options: 'Colorless, Yellow, Pink, Blue, Black' },
    { label: 'Clasp', options: 'Lobster, Box, Toggle, Magnetic' },
    { label: 'Fit', options: 'Slim, Regular, Loose' },
    { label: 'Do you have a reference photo?', options: 'Yes, No, Not yet' },
  ],
};

// Answers by what the question asks about; a form's field IDs carry the category (chain_length, metal).
const BY_CATEGORY = {
  metal: ['Yellow Gold', 'White Gold', 'Rose Gold', 'Platinum', 'Two-Tone', 'Sterling Silver', ...SUGGESTED.metals.map((x) => x.label)],
  karat: ['10K', '14K', '18K', '925 Silver', ...SUGGESTED.karats],
  stones: ['Natural diamonds', 'Lab-grown diamonds', 'Moissanite', 'No stones', ...SUGGESTED.stones.map((x) => x.label)],
  budget: BUDGETS,
  coverage: ['Accents', 'Half iced', 'Fully iced'],
  clarity: ['SI', 'VS', 'VVS', 'Flawless'],
  'center-shape': ['Round', 'Oval', 'Princess', 'Emerald', 'Pear', 'Cushion', 'Marquise', 'Radiant', 'Asscher', 'Heart'],
  carat: ['0.5 ct', '1 ct', '1.5 ct', '2 ct', '3 ct+'],
  band: ['Plain', 'Pavé', 'Split shank', 'Metal bracelet', 'Leather strap', 'Rubber strap'],
  'ring-size': ['4', '5', '6', '7', '8', '9', '10', '11', '12+'],
  'case-size': ['36 mm', '40 mm', '42 mm', '44 mm+'],
  length: ['14"', '16"', '18"', '20"', '22"', '24"', '26"', '28"', '30"', '36"'],
  width: ['3 mm', '5 mm', '8 mm', '10 mm', '12 mm+'],
  size: ['Small', 'Medium', 'Large', 'Statement'],
  backs: ['Push back', 'Screw back', 'Hinged huggie'],
  cut: ['Solid', 'Open face', 'Diamond cut'],
};
const WRIST = ['6"', '6.5"', '7"', '7.5"', '8"', '8.5"', '9"'];
const GENERIC = ['Yes', 'No', 'Not sure'];
const norm = (s) => String(s || '').trim().toLowerCase();

// Answers of a known question ("Finish" -> Polished, Matte...), by its wording.
export function answersFor(label) {
  const q = norm(label);
  const hit = q && SUGGESTED.questions.find((x) => norm(x.label) === q || norm(x.label).includes(q) || q.includes(norm(x.label)));
  return hit ? hit.options.split(',').map((x) => x.trim()) : [];
}

// What to offer when one more option is added to a question.
export function suggestOptions(fieldId, label = '') {
  if (/wrist|bracelet/i.test(`${fieldId} ${label}`) && artCategory(fieldId) === 'length') return WRIST;
  return BY_CATEGORY[artCategory(fieldId)] || (answersFor(label).length ? answersFor(label) : GENERIC);
}

// The part of a list that is not there yet (same wording, any case).
export const notTaken = (items, taken) => {
  const have = new Set((taken || []).map(norm));
  return (items || []).filter((x) => !have.has(norm(x.label ?? x)));
};
