// Pitanje "teeth" (grillz): kupac bira tačne zube na crtežu usta.
// Odgovor je tekst "T3,T4,...,B5": T = gornji red, B = donji, 1-10 slijeva nadesno kako ih gledamo spreda
// (5 i 6 su centralni sjekutići). Isti zapis koristi widget (public/form.js).

const NAMES = ['second premolar', 'first premolar', 'canine', 'lateral incisor', 'central incisor'];
const ORDER = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10]; // od sredine ka van
const TOKEN = /^[TB](10|[1-9])$/;

export function parseTeeth(v) {
  if (typeof v !== 'string' || !v || v.length > 120) return null;
  const list = v.split(',');
  if (!list.every((t) => TOKEN.test(t)) || new Set(list).size !== list.length) return null;
  const row = (r) => list.filter((t) => t[0] === r).map((t) => +t.slice(1)).sort((x, y) => x - y);
  return { top: row('T'), bottom: row('B') };
}

const nameOf = (i, upper) => `${upper ? 'upper' : 'lower'} ${NAMES[i <= 5 ? i - 1 : 10 - i]}${i <= 5 ? " (viewer's left)" : " (viewer's right)"}`;

// Centrirani niz od sredine (2, 4, 6, 8, 10 zuba) ima ime; sve ostalo navodimo zub po zub.
function rowText(nums, upper) {
  if (!nums.length) return '';
  const n = nums.length;
  const centered = n % 2 === 0 && ORDER.slice(0, n).every((x) => nums.includes(x));
  const which = upper ? 'upper' : 'lower';
  if (centered) {
    const span = ['', 'the two front teeth (both central incisors)', 'the four front teeth (central and lateral incisors)', 'six front teeth, canine to canine', 'eight teeth, first premolar to first premolar', 'ten teeth, second premolar to second premolar'][n / 2];
    return `${upper ? 'Top' : 'Bottom'} row: exactly ${n} teeth (${which}), ${span}`;
  }
  return `${upper ? 'Top' : 'Bottom'} row: exactly ${n} ${which} ${n === 1 ? 'tooth' : 'teeth'}: ${nums.map((i) => nameOf(i, upper)).join(', ')}`;
}

// Redovi za grillzPlan + rečenice za prompt.
export function teethPlan(v) {
  const t = parseTeeth(v);
  if (!t || (!t.top.length && !t.bottom.length)) return null;
  const rows = t.top.length && t.bottom.length ? 'both' : t.top.length ? 'top' : 'bottom';
  const lines = [];
  if (t.top.length) lines.push(`${rowText(t.top, true)}.`);
  if (t.bottom.length) lines.push(`${rowText(t.bottom, false)}.`);
  const total = t.top.length + t.bottom.length;
  const count = [t.top.length ? `top row ${t.top.length}` : '', t.bottom.length ? `bottom row ${t.bottom.length}` : ''].filter(Boolean).join(', ');
  lines.push(`Exactly ${total} ${total === 1 ? 'tooth is' : 'teeth are'} covered in total (${count}). Count the teeth one by one before finishing: no extra teeth on either side of any row, and every row has exactly its own number even if another row has more. This exact tooth selection takes priority over any reference image.`);
  return { rows, top: t.top.length, bottom: t.bottom.length, lines };
}

export function teethSummary(v) {
  const t = parseTeeth(v);
  if (!t) return v;
  const total = t.top.length + t.bottom.length;
  return `Top ${t.top.length} + bottom ${t.bottom.length} (${total} ${total === 1 ? 'tooth' : 'teeth'}): ${v.replace(/,/g, ' ')}`;
}
