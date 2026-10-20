// JewelryLead sajt: meni, pojavljivanje sekcija, animacija studija u heroju, forma za demo.

// Meni na telefonu
const nav = document.getElementById('nav');
const menuBtn = document.getElementById('menu-btn');
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
document.querySelectorAll('#nav-links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));

// Sekcije se pojavljuju pri skrolu
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Hero: izbori se slažu jedan po jedan, pa se render "razvije"
const SCENES = [
  { title: 'Custom grillz', budget: '$2,500 - $5,000', chips: [['Piece', 'Grillz'], ['Style', 'Top 8'], ['Metal', 'Yellow gold 14K'], ['Stones', 'Moissanite, fully iced'], ['Detail', 'Heart cut-out']] },
  { title: 'Initials heart pendant', budget: '$1,500 - $2,500', chips: [['Piece', 'Pendant'], ['Style', 'Heart outline'], ['Metal', 'Rose gold 14K'], ['Stones', 'Lab diamonds, VS'], ['Text', '"J&amp;M"']] },
  { title: 'Iced bezel watch', budget: '$5,000 - $10,000', chips: [['Piece', 'Watch'], ['Style', 'Iced bezel'], ['Metal', 'Two-tone 18K'], ['Stones', 'Moissanite'], ['Dial', 'Champagne']] },
  { title: 'Halo engagement ring', budget: '$5,000 - $10,000', chips: [['Piece', 'Ring'], ['Style', 'Halo'], ['Metal', 'White gold 18K'], ['Stones', 'Natural, VVS'], ['Center', 'Oval']] },
];
const studio = document.getElementById('studio');
const imgs = studio ? [...studio.querySelectorAll('.studio-stage img')] : [];
const chipsEl = document.getElementById('studio-chips');
const titleEl = document.getElementById('studio-title');
const budgetEl = document.getElementById('studio-budget');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function play() {
  let i = 0;
  for (;;) {
    const s = SCENES[i];
    titleEl.textContent = s.title;
    budgetEl.textContent = s.budget;
    chipsEl.innerHTML = s.chips.map(([k, v]) => `<span class="chip">${k}: <b>${v}</b></span>`).join('');
    const chips = [...chipsEl.children];
    if (reduced) {
      chips.forEach((c) => c.classList.add('on'));
      imgs.forEach((im, k) => im.classList.toggle('on', k === i));
      await wait(4000);
    } else {
      // Prethodni render ostaje zamućen dok se slažu izbori, da okvir nikad nije prazan.
      studio.classList.add('choosing');
      for (const c of chips) { await wait(320); c.classList.add('on'); }
      studio.classList.add('rendering');
      await wait(1700);
      imgs.forEach((im, k) => im.classList.toggle('on', k === i));
      studio.classList.remove('rendering', 'choosing');
      await wait(3800);
    }
    i = (i + 1) % SCENES.length;
  }
}
if (studio) { imgs[imgs.length - 1].classList.add('on'); play(); }

// Forma za demo
const form = document.getElementById('demo-form');
const msg = document.getElementById('form-msg');
// Turnstile (Cloudflare provjera protiv botova) na formi za demo, samo kad je uključen za sajt.
let tsToken = '';
fetch('/api/config').then((r) => r.json()).then((c) => {
  if (!c.turnstile || !form) return;
  const box = document.createElement('div');
  box.className = 'ts';
  form.querySelector('button[type="submit"]').before(box);
  const sc = document.createElement('script');
  sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  sc.async = true;
  sc.onload = () => window.turnstile.render(box, { sitekey: c.turnstile, theme: 'dark', callback: (t) => { tsToken = t; }, 'expired-callback': () => { tsToken = ''; } });
  document.head.appendChild(sc);
}).catch(() => {});
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  msg.className = 'form-msg';
  if (!data.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim()) || !data.website.trim()) {
    msg.textContent = 'Please add your name, a valid email and your store website.';
    msg.classList.add('err');
    return;
  }
  const btn = form.querySelector('button');
  btn.disabled = true;
  msg.textContent = 'Sending...';
  try {
    const res = await fetch('/api/demo-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, turnstile: tsToken }) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || 'Something went wrong.');
    form.reset();
    tsToken = '';
    window.turnstile?.reset?.();
    msg.textContent = "Thanks! We'll email you within one business day to pick a time.";
    msg.classList.add('ok');
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('err');
  } finally {
    btn.disabled = false;
  }
});
