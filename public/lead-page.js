// Stranica kupca: zamjena slike i videa u velikom prikazu, uvećanje, tiho pojavljivanje sekcija, dugmad Deposit i
// Book appointment (zabilježe se uz lead; ako je zlatar upisao link, kupac ide tamo), traka sa dugmadima na telefonu.
document.documentElement.classList.add('js');
const key = document.body.dataset.key;
const store = document.body.dataset.store || 'Our team';
const stageBox = document.querySelector('.stage-img');

// Verzije dizajna i video u istom velikom prikazu.
document.querySelectorAll('.thumb').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.thumb').forEach((x) => x.classList.toggle('on', x === t));
  if (!stageBox) return;
  if (t.dataset.video) {
    stageBox.innerHTML = `<video src="${t.dataset.video}" autoplay muted loop playsinline controls></video>`;
    stageBox.removeAttribute('data-zoom');
    return;
  }
  let img = stageBox.querySelector('img');
  if (!img) { stageBox.innerHTML = '<img id="stage" alt="Your design" />'; img = stageBox.querySelector('img'); }
  stageBox.setAttribute('data-zoom', '');
  img.classList.add('swap');
  setTimeout(() => { img.src = t.dataset.src; img.onload = () => img.classList.remove('swap'); }, 180);
}));

const box = document.getElementById('lightbox');
stageBox?.addEventListener('click', () => {
  const img = stageBox.querySelector('img');
  if (!img || !stageBox.hasAttribute('data-zoom')) return;
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
const TEXT = {
  deposit: `${store} will contact you shortly with a secure link to place your deposit and start your piece.`,
  appointment: `${store} will contact you shortly to set a time for your appointment.`,
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
  document.getElementById('sheet-h').textContent = b.dataset.action === 'deposit' ? 'Deposit request sent' : 'Appointment request sent';
  document.getElementById('sheet-p').textContent = TEXT[b.dataset.action] || TEXT.appointment;
  if (sheet?.showModal) sheet.showModal(); else alert(TEXT[b.dataset.action]);
});
