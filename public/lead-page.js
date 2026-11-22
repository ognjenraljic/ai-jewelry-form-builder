// Stranica kupca: zamjena slike i videa u velikom prikazu, uvećanje, tiho pojavljivanje sekcija, dugmad Deposit i
// Book appointment (zabilježe se uz lead; ako je zlatar upisao link, kupac ide tamo), traka sa dugmadima na telefonu.
document.documentElement.classList.add('js');
const key = document.body.dataset.key;
const store = document.body.dataset.store || 'Our team';
const stageBox = document.querySelector('.stage-img');

// Verzije dizajna i video u istom velikom prikazu.
// Video ide u veliki prikaz kao običan element (ne unutar dugmeta: Safari tada ne da kontrolama da rade), sa posterom.
const playOrControls = (v) => { const p = v.play?.(); if (p?.catch) p.catch(() => { v.controls = true; }); };
const ZOOM_BTN = (src) => `<button type="button" class="stage-zoom" aria-label="Enlarge your design"><img id="stage" alt="Your design" src="${src}" /></button>`;
document.querySelectorAll('.thumb').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.thumb').forEach((x) => x.classList.toggle('on', x === t));
  if (!stageBox) return;
  if (t.dataset.video) {
    const v = document.createElement('video');
    Object.assign(v, { src: t.dataset.video, muted: true, loop: true, playsInline: true, controls: true, autoplay: true });
    if (t.dataset.poster) v.poster = t.dataset.poster;
    v.setAttribute('playsinline', '');
    stageBox.replaceChildren(v);
    playOrControls(v);
    return;
  }
  let img = stageBox.querySelector('img');
  if (!img) { stageBox.innerHTML = ZOOM_BTN(t.dataset.src); return; }
  img.classList.add('swap');
  setTimeout(() => { img.src = t.dataset.src; img.onload = () => img.classList.remove('swap'); }, 180);
}));
document.querySelectorAll('video[autoplay]').forEach(playOrControls);

const box = document.getElementById('lightbox');
stageBox?.addEventListener('click', (e) => {
  const img = e.target.closest('.stage-zoom')?.querySelector('img');
  if (!img) return;
  box.querySelector('img').src = img.src;
  box.hidden = false;
});
box?.addEventListener('click', () => { box.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box) box.hidden = true; });

// Sekcije se pojave jednom, polako.
const rv = document.querySelectorAll('.rv');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
  rv.forEach((el) => io.observe(el));
} else rv.forEach((el) => el.classList.add('in'));

// Traka sa dugmadima na telefonu: kad je zaglavlje prošlo, a ponude i završna kartica nisu na ekranu.
const dock = document.querySelector('.dock');
const watch = [document.querySelector('.hero'), document.getElementById('options'), document.querySelector('.visit')].filter(Boolean);
const seen = new Map();
if (dock && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((list) => {
    list.forEach((en) => seen.set(en.target, en.isIntersecting));
    const show = ![...seen.values()].some(Boolean);
    dock.classList.toggle('show', show);
    dock.setAttribute('aria-hidden', String(!show));
  }, { threshold: 0.08 });
  watch.forEach((el) => io.observe(el));
}

// Deposit i Book appointment.
const sheet = document.getElementById('sheet');
// Dok zlatar nema link za depozit / zakazivanje: kupac zna da će ga kontaktirati za dalje detalje (Ognjen 19.11.2026),
// a zlatar dobija obavještenje u portalu (tab Bookings).
const TEXT = {
  deposit: `Thank you. ${store} will contact you shortly with further details about your deposit and the next steps for your piece.`,
  appointment: `Thank you. ${store} will contact you shortly with further details to set up your appointment.`,
};
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  b.disabled = true;
  let redirect = null;
  try {
    const res = await fetch(`/api/page/${encodeURIComponent(key)}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: b.dataset.action, option: b.dataset.option || '' }) });
    redirect = (await res.json().catch(() => ({}))).redirect || null;
  } catch {}
  b.disabled = false;
  if (redirect) { location.href = redirect; return; }
  document.getElementById('sheet-h').textContent = b.dataset.action === 'deposit' ? 'Deposit request received' : 'Appointment request received';
  document.getElementById('sheet-p').textContent = TEXT[b.dataset.action] || TEXT.appointment;
  if (sheet?.showModal) sheet.showModal(); else alert(TEXT[b.dataset.action]);
});

// Rok ponude (22.11.2026): odbrojavanje do kraja, pa poruka da je istekla.
const two = (n) => String(n).padStart(2, '0');
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`; };
const timers = [...document.querySelectorAll('[data-deadline]')];
function tickOffers() {
  const now = Date.now();
  for (const el of timers) {
    const left = Number(el.dataset.deadline) - now;
    if (el.dataset.mini) { el.textContent = left > 0 ? `Your price is held for ${clock(left)}` : 'This offer has expired. Reply to your quote and we will refresh it.'; continue; }
    const t = el.querySelector('time');
    if (t) t.textContent = clock(left);
    if (left <= 0 && !el.classList.contains('expired')) {
      el.classList.add('expired');
      el.querySelector('.v-label').textContent = 'This offer has expired';
      el.querySelector('.v-sub').textContent = 'Reply to your quote and we will refresh your price.';
    }
  }
}
if (timers.length) { tickOffers(); setInterval(tickOffers, 1000); }
