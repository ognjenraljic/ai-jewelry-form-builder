// Praćenje narudžbe (23.11.2026). Won lead = narudžba sa brojem i fazom izrade; zlatar pomjera fazu u portalu,
// kupac je vidi na sajtu radnje (broj narudžbe + mejl iz upita). Faze su iste kao na Districtovoj /order-tracking/.

export const ORDER_STAGES = [
  { key: 'placed', label: 'Order placed', text: 'We have your order and are preparing the design.' },
  { key: 'cad', label: 'CAD approved', text: 'Your design is approved and locked in.' },
  { key: 'cast', label: 'Wax & cast', text: 'Your piece is being printed in wax and cast in metal.' },
  { key: 'setting', label: 'Stone setting', text: 'Our setters are placing your stones one by one.' },
  { key: 'polish', label: 'Polish', text: 'Final polish and quality check.' },
  { key: 'ready', label: 'Ready for pick up', text: 'Your piece is ready. Come pick it up at the store.' },
];
export const LAST_STAGE = ORDER_STAGES.length - 1;

// Bez znakova koji se miješaju (0/O, 1/I/L), da kupac ne pogriješi pri prepisivanju.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function orderPrefix(clientName, data = {}) {
  const own = String(data.orderPrefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (own) return own;
  const words = String(clientName || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join('') || 'JL');
}
export function newOrderNo(prefix) {
  const b = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix}-${[...b].map((x) => ALPHABET[x % ALPHABET.length]).join('')}`;
}
// Kupac kuca kako hoće: "dj 7k4q9", "#DJ-7K4Q9", "dj7k4q9" su isti broj.
export function normalizeOrderNo(v) {
  const s = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = s.match(/^([A-Z0-9]{1,4}?)([2-9A-Z]{5})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function parseOrder(raw) {
  let d = {};
  try { d = JSON.parse(raw || '{}') || {}; } catch {}
  const stage = Number.isInteger(d.stage) && d.stage >= 0 && d.stage <= LAST_STAGE ? d.stage : 0;
  const at = d.at && typeof d.at === 'object' ? d.at : {};
  // Preuzimanje i recenzija (27.11.2026): kad je kupac preuzeo komad, poklon (datum prilike), otvorena prepravka.
  const ymd = typeof d.occasion === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.occasion) ? d.occasion : '';
  return { stage, at, note: typeof d.note === 'string' ? d.note : '', updatedAt: Number(d.updatedAt) || null,
    pickedAt: stage === LAST_STAGE ? Number(d.pickedAt) || null : null, gift: d.gift === true, occasion: ymd, remake: d.remake === true };
}

// Faze sa vremenom kad je koja završena (vrijeme pamti zadnji put kad je zlatar stigao do te faze).
export function orderView(no, raw) {
  if (!no) return null;
  const o = parseOrder(raw);
  return {
    no, stage: o.stage, note: o.note, updatedAt: o.updatedAt, pickedAt: o.pickedAt, gift: o.gift, occasion: o.occasion, remake: o.remake,
    stages: ORDER_STAGES.map((s, i) => ({ key: s.key, label: s.label, at: i <= o.stage ? Number(o.at[s.key]) || null : null })),
  };
}

// Nova faza i/ili poruka kupcu. Vraćanje na raniju fazu briše vremena kasnijih (zlatar je pogriješio klik).
export function nextOrder(raw, { stage, note, picked, gift, occasion, remake } = {}, now = Date.now()) {
  const o = parseOrder(raw);
  const out = { stage: o.stage, at: { ...o.at }, note: o.note, updatedAt: now, pickedAt: o.pickedAt, gift: o.gift, occasion: o.occasion, remake: o.remake };
  if (stage != null) {
    const s = Number(stage);
    if (!Number.isInteger(s) || s < 0 || s > LAST_STAGE) return null;
    for (let i = 0; i <= LAST_STAGE; i++) {
      const k = ORDER_STAGES[i].key;
      if (i > s) delete out.at[k];
      else if (!out.at[k]) out.at[k] = now;
    }
    out.stage = s;
  }
  if (note != null) out.note = String(note).replace(/\s+$/, '').slice(0, 500);
  // "Picked up" samo na zadnjoj fazi; vraćanje sa "Ready for pick up" briše preuzimanje.
  if (picked === true && out.stage === LAST_STAGE) out.pickedAt = out.pickedAt || now;
  if (picked === false || out.stage !== LAST_STAGE) out.pickedAt = null;
  if (gift != null) out.gift = gift === true;
  if (occasion != null) out.occasion = /^\d{4}-\d{2}-\d{2}$/.test(String(occasion)) ? String(occasion) : '';
  if (remake != null) out.remake = remake === true;
  return out;
}

// ID leada (25.11.2026, District: "unique lead ID for filtering"): redni broj po radnji, L-0001, L-0002...
// Isti broj stoji u portalu, u GoHighLevel opportunity-ju i u bilješci, pa se lead nađe pretragom u oba sistema.
export const leadRef = (n) => (Number.isInteger(Number(n)) && Number(n) > 0 ? `L-${String(Number(n)).padStart(4, '0')}` : '');
// "L-0231", "l231", "#231", "0231" -> 231 (samo kad je upit stvarno broj leada, ne dio telefona ili imena).
export function parseLeadRef(q) {
  const m = String(q ?? '').trim().match(/^(?:#|l-?\s*)?0*(\d{1,6})$/i);
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}
