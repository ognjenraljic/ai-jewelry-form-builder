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
    return `${upper ? 'Top' : 'Bottom'} row: exactly ${n} teeth (${which}), ${span}. ${sequence(nums, upper)}`;
  }
  return `${upper ? 'Top' : 'Bottom'} row: exactly ${n} ${which} ${n === 1 ? 'tooth' : 'teeth'}: ${nums.map((i) => nameOf(i, upper)).join(', ')}${n > 1 ? `. ${sequence(nums, upper)}` : ''}`;
}

// Zub po zub slijeva nadesno sa rednim brojem: "canine to canine" modelu ostavlja prostor da red dopuni do navike (8),
// a nabrojan red ima jasan prvi i zadnji zub. Rupe (npr. dva očnjaka) ostaju prazne.
function sequence(nums, upper) {
  const which = upper ? 'upper' : 'lower';
  const list = nums.map((i, k) => `${k + 1}) ${which} ${NAMES[i <= 5 ? i - 1 : 10 - i]}`).join(', ');
  const gaps = nums.some((x, k) => k && x - nums[k - 1] > 1) ? ' Leave the unselected positions between them empty.' : '';
  return `Caps left to right as seen from the front: ${list}. The row starts at cap 1 and ends at cap ${nums.length}; nothing beyond them on either side.${gaps}`;
}

// Redovi za grillzPlan + rečenice za prompt.
export function teethPlan(v) {
  const t = parseTeeth(v);
  if (!t || (!t.top.length && !t.bottom.length)) return null;
  const rows = t.top.length && t.bottom.length ? 'both' : t.top.length ? 'top' : 'bottom';
  const lines = [];
  const end = (x) => (x.endsWith('.') ? x : `${x}.`);
  if (t.top.length) lines.push(end(rowText(t.top, true)));
  if (t.bottom.length) lines.push(end(rowText(t.bottom, false)));
  const total = t.top.length + t.bottom.length;
  const count = [t.top.length ? `top row ${t.top.length}` : '', t.bottom.length ? `bottom row ${t.bottom.length}` : ''].filter(Boolean).join(', ');
  // Donji sjekutići su uži od gornjih: model je donji red razvlačio na širinu gornjeg i dopunjavao ga do 8 (test 9.11).
  if (t.top.length && t.bottom.length) lines.push('Lower teeth are narrower than upper teeth, as in a real mouth: each lower incisor cap is about two thirds the width of an upper central incisor cap. Each row is only as wide as its own caps; never stretch the bottom row to the width of the top row or fill extra width with additional caps.');
  lines.push(`Exactly ${total} ${total === 1 ? 'tooth is' : 'teeth are'} covered in total (${count}). Count the teeth one by one before finishing: no extra teeth on either side of any row, and every row has exactly its own number even if another row has more. This exact tooth selection takes priority over any reference image.`);
  return { rows, top: t.top.length, bottom: t.bottom.length, lines };
}

export function teethSummary(v) {
  const t = parseTeeth(v);
  if (!t) return v;
  const total = t.top.length + t.bottom.length;
  return `Top ${t.top.length} + bottom ${t.bottom.length} (${total} ${total === 1 ? 'tooth' : 'teeth'}): ${v.replace(/,/g, ' ')}`;
}
