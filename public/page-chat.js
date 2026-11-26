// AI asistent na stranici kupca (26.11.2026). Učitava se samo kad ga je zlatar uključio (vidi src/leadpage.js chatWidget).
// Istorija je na serveru (jedan razgovor po leadu); oznake [deposit] / [book] postaju dugmad koja kliknu ista dugmad sa stranice.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (t) => esc(t).replace(/\n/g, '<br />');
const key = document.body.dataset.key;
const preview = new URLSearchParams(location.search).get('preview') === '1';
const base = `/api/page/${key}/chat${preview ? '?preview=1' : ''}`;

const fab = document.getElementById('pc-fab');
const panel = document.getElementById('pc-panel');
const log = document.getElementById('pc-log');
const sugg = document.getElementById('pc-sugg');
const form = document.getElementById('pc-form');
const input = document.getElementById('pc-in');
let loaded = false;
let busy = false;

// Dugme iz odgovora pokreće isto dugme koje već postoji na stranici (depozit ili zakazivanje).
const pageButton = (tag) => document.querySelector(tag === 'deposit' ? '.offers [data-action="deposit"], .visit-cta [data-action="deposit"]' : '.offers [data-action="book"], .offers [data-action="appointment"], .visit-cta [data-action="book"], .visit-cta [data-action="appointment"]');
const chipLabel = (tag) => (tag === 'deposit' ? 'Reserve with a deposit' : pageButton('book')?.textContent?.trim() || 'Book a time');

function bubble(role, text, tags = []) {
  const el = document.createElement('div');
  el.className = `pc-m ${role === 'user' ? 'pc-u' : 'pc-a'}`;
  const chips = tags.filter((t) => (t === 'deposit' || t === 'book') && pageButton(t)).map((t) => `<button type="button" class="pc-chip${t === 'deposit' ? ' gold' : ''}" data-pc-do="${t}">${esc(chipLabel(t))}</button>`).join('');
  el.innerHTML = `<p>${fmt(text)}</p>${chips ? `<div class="pc-chips">${chips}</div>` : ''}`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}
function suggestions(list) {
  sugg.innerHTML = list.map((q) => `<button type="button" class="pc-s">${esc(q)}</button>`).join('');
  sugg.hidden = !list.length;
}
async function load() {
  loaded = true;
  try {
    const r = await fetch(base, { credentials: 'same-origin' }).then((x) => x.json());
    if (!r.on) { fab.hidden = true; panel.hidden = true; return; }
    bubble('assistant', r.greeting);
    for (const m of r.messages) bubble(m.role, m.text, m.tags || []);
    suggestions(r.messages.length ? [] : r.suggestions);
  } catch { bubble('assistant', 'Hi, ask me anything about your design.'); }
}
async function send(text) {
  const q = text.trim();
  if (!q || busy) return;
  busy = true;
  suggestions([]);
  bubble('user', q);
  input.value = '';
  input.style.height = '';
  const wait = bubble('assistant', '');
  wait.classList.add('pc-wait');
  wait.innerHTML = '<span class="pc-dots" aria-label="Typing"><i></i><i></i><i></i></span>';
  try {
    const res = await fetch(base, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: q }) });
    const r = await res.json().catch(() => ({}));
    wait.remove();
    bubble('assistant', res.ok ? r.reply : r.error || 'Something went wrong. Please try again.', res.ok ? r.tags || [] : []);
  } catch {
    wait.remove();
    bubble('assistant', 'No connection. Please try again.');
  } finally { busy = false; input.focus({ preventScroll: true }); }
}
function open(on) {
  panel.hidden = !on;
  fab.setAttribute('aria-expanded', String(on));
  document.body.classList.toggle('pc-open', on);
  if (on) { if (!loaded) load(); if (matchMedia('(min-width: 701px)').matches) setTimeout(() => input.focus(), 30); }
}
fab.addEventListener('click', () => open(panel.hidden));
panel.addEventListener('click', (e) => {
  if (e.target.closest('[data-pc-close]')) open(false);
  const s = e.target.closest('.pc-s');
  if (s) send(s.textContent);
  const d = e.target.closest('[data-pc-do]');
  if (d) { const b = pageButton(d.dataset.pcDo); if (matchMedia('(max-width: 700px)').matches) open(false); b?.click(); }
});
form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
input.addEventListener('input', () => { input.style.height = ''; input.style.height = `${Math.min(110, input.scrollHeight)}px`; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden && !document.querySelector('dialog[open]')) open(false); });
