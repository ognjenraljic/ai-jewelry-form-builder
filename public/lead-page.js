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
  if (b.dataset.action === 'book') { openScheduler(b.dataset.kind || '', b.dataset.option || ''); return; }
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

// Rok ponude (22.11.2026, faze 27.11.2026): odbrojavanje i boja po fazi (zlatno, 24 h žuto, 12 h crveno, zadnji sat),
// pa zaključavanje. Isti pragovi kao offerStage u src/offer.js. Lokalna simulacija (data-now-offset) pomjera sat.
const two = (n) => String(n).padStart(2, '0');
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`; };
const OFFSET = Number(document.body.dataset.nowOffset) || 0;
const SIM = document.body.dataset.sim === '1';
const NOW = () => Date.now() + OFFSET;
const timers = [...document.querySelectorAll('[data-deadline]')];
function stageOf(left, hours) {
  const H = 3600000; const h = Number(hours) || 48;
  const y = Math.min(24, h / 2) * H; const r = Math.min(12, h / 4) * H; const l = Math.min(1, h / 8) * H;
  return left <= 0 ? 'expired' : left <= l ? 'last' : left <= r ? 'red' : left <= y ? 'yellow' : 'fresh';
}
const STAGE = {
  fresh: (h) => [`Reserved for you for ${h} hours`, 'Your price and design are held until the timer ends.'],
  yellow: (h) => [h > 24 ? 'Less than 24 hours left' : 'Less than half of your time left', 'Reserve now to keep this price.'],
  red: (h) => [h > 24 ? 'Final 12 hours on your price' : 'Final hours on your price', 'When the timer ends, your offer is locked.'],
  last: () => ['Last hour to keep this price', 'Reserve now, before the timer runs out.'],
  expired: () => ['This offer has expired', 'Request a refreshed quote below.'],
};
let reloading = false;
const reloadSoon = () => { if (SIM || reloading) return; reloading = true; setTimeout(() => location.reload(), 1200); };
function tickOffers() {
  const now = NOW();
  for (const el of timers) {
    const left = Number(el.dataset.deadline) - now;
    // Zamućena opcija i otključavanje osvježene ponude: kratko odbrojavanje, pa stranica pokaže novo stanje.
    if (el.dataset.reveal || el.dataset.unlock) { const b = el.querySelector('b'); if (b) b.textContent = clock(left); if (left <= 0) reloadSoon(); continue; }
    if (el.dataset.mini) { el.textContent = left > 0 ? `Your price is held for ${clock(left)}` : 'Your offer has expired. Request a refreshed quote below.'; continue; }
    const s = Math.max(0, Math.floor(left / 1000));
    const vals = { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
    for (const b of el.querySelectorAll('[data-u]')) {
      const v = two(vals[b.dataset.u]);
      if (b.textContent !== v) { b.textContent = v; b.classList.remove('tick'); void b.offsetWidth; b.classList.add('tick'); }
    }
    const total = Number(el.dataset.total) || 1;
    const bar = el.querySelector('.v-bar span');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, (left / total) * 100)).toFixed(2)}%`;
    const k = stageOf(left, el.dataset.hours);
    if (!el.classList.contains(`v-${k}`)) {
      const [label, sub] = STAGE[k](Number(el.dataset.hours) || 48);
      el.className = el.className.replace(/\bv-(fresh|yellow|red|last|expired)\b/g, '').trim() + ` v-${k}`;
      el.querySelector('.v-label').textContent = el.dataset.refreshed && k !== 'expired' ? `Refreshed price · ${label}` : label;
      el.querySelector('.v-sub').textContent = sub;
      if (k === 'expired') reloadSoon();
    }
  }
}
if (timers.length) { tickOffers(); setInterval(tickOffers, 1000); }
// Istekla ponuda: kupac traži osvježenu ponudu.
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-refresh]');
  if (!b || SIM) return;
  b.disabled = true; b.textContent = 'Sending…';
  try {
    const r = await fetch(`/api/page/${encodeURIComponent(document.body.dataset.key)}/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Please try again.');
    location.reload();
  } catch (err) { b.disabled = false; b.textContent = err.message || 'Please try again.'; }
});

// ---------- Kalendar na stranici (25.11.2026) ----------
// "Book an appointment": vrsta termina (online konsultacija / posjeta), dan, slobodno vrijeme, potvrda. Vremena su u
// zoni radnje (server ih računa iz radnog vremena ili GHL kalendara); kupac iz druge zone vidi i svoje vrijeme.
const BK = (() => { try { return JSON.parse(document.getElementById('bk-data')?.textContent || 'null'); } catch { return null; } })();
const sched = document.getElementById('sched');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KIND_TEXT = {
  online: (m) => `A ${m}-minute call to go over your design, your options and the price together.`,
  visit: (m) => `About ${m} minutes at the studio to see metals and stones in person.`,
};
const myTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
const fmt = (ms, tz, o) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).format(new Date(ms));
const api = async (path, opts = {}) => {
  const r = await fetch(`/api/page/${encodeURIComponent(key)}${path}`, { headers: { 'content-type': 'application/json' }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
};

// Izbor dana i vremena u kontejneru (prozor za zakazivanje i korak poslije depozita koriste isti).
async function mountPicker(box, kind, { forNext = false, onPick } = {}) {
  box.innerHTML = '<p class="pk-load" role="status">Loading available times…</p>';
  let d;
  try { d = await api(`/slots?kind=${kind}${forNext ? '&for=next' : ''}`); } catch (err) { box.innerHTML = `<p class="form-err">${esc(err.message)}</p>`; return null; }
  const days = d.days.filter((x) => x.slots.length);
  if (!days.length) { box.innerHTML = '<p class="hint">No open times in the next days. Reply to your quote and we will find a time with you.</p>'; return d; }
  const other = myTz && myTz !== d.tz;
  let day = days[0].date;
  let pick = null;
  const draw = () => {
    const cur = d.days.find((x) => x.date === day);
    box.innerHTML = `<div class="pk-days" role="listbox" aria-label="Day">${d.days.map((x) => {
      const t = Date.parse(`${x.date}T12:00:00Z`);
      return `<button type="button" class="pk-day${x.date === day ? ' on' : ''}" data-day="${x.date}" ${x.slots.length ? '' : 'disabled'} aria-selected="${x.date === day}"><small>${fmt(t, 'UTC', { weekday: 'short' })}</small><b>${fmt(t, 'UTC', { day: 'numeric' })}</b><small>${fmt(t, 'UTC', { month: 'short' })}</small></button>`;
    }).join('')}</div>
      <div class="pk-times" role="listbox" aria-label="Time">${cur.slots.map((t) => `<button type="button" class="pk-time${t === pick ? ' on' : ''}" data-t="${t}" aria-selected="${t === pick}">${fmt(t, d.tz, { hour: 'numeric', minute: '2-digit' })}</button>`).join('')}</div>
      <p class="pk-tz">Times are in ${esc(d.tzLabel)}${other && pick ? ` · ${esc(fmt(pick, myTz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }))} your time` : ''}.</p>`;
  };
  draw();
  box.onclick = (e) => {
    const dy = e.target.closest('[data-day]');
    if (dy && !dy.disabled) { day = dy.dataset.day; pick = null; draw(); onPick?.(null, d); return; }
    const tm = e.target.closest('[data-t]');
    if (tm) { pick = Number(tm.dataset.t); draw(); onPick?.(pick, d); }
  };
  return d;
}

function openScheduler(kind, option) {
  if (!BK || !sched) return;
  const body = sched.querySelector('.sched-body');
  const kinds = BK.kinds || [];
  const close = '<button type="button" class="sched-x" aria-label="Close" data-sx>×</button>';
  const chooseKind = () => {
    body.innerHTML = `${close}<p class="eyebrow">Book an appointment</p><h2 id="sched-h">How would you like to meet?</h2>
      <div class="kinds">${kinds.map((k) => `<button type="button" class="kind" data-kind="${k.kind}"><b>${esc(k.label)}</b><span class="kind-min">${k.minutes} min</span><span class="kind-t">${esc(KIND_TEXT[k.kind](k.minutes))}</span></button>`).join('')}</div>`;
  };
  const pickTime = async (k) => {
    const meta = kinds.find((x) => x.kind === k) || kinds[0];
    let start = null;
    let via = 'phone';
    body.innerHTML = `${close}${kinds.length > 1 ? '<button type="button" class="sched-back" data-sb>Back</button>' : ''}<p class="eyebrow">${esc(meta.label)} · ${meta.minutes} min</p><h2 id="sched-h">Pick a time</h2>
      ${k === 'online' && BK.video ? '<div class="choices via" role="radiogroup" aria-label="Call type"><label class="choice"><input type="radio" name="via" value="phone" checked /><span>Phone call</span></label><label class="choice"><input type="radio" name="via" value="video" /><span>Video call</span></label></div>' : k === 'online' ? `<p class="hint">${esc(BK.store)} calls you at the number you gave us.</p>` : ''}
      <div class="picker" data-picker="main"></div>
      <label class="full note-l"><span>Anything we should know? (optional)</span><textarea rows="2" maxlength="300" data-note></textarea></label>
      <p class="form-err" role="alert" hidden></p>
      <button type="button" class="btn primary" data-confirm disabled>Choose a time</button>`;
    const btn = body.querySelector('[data-confirm]');
    body.querySelectorAll('input[name="via"]').forEach((r) => r.addEventListener('change', () => { via = r.value; }));
    await mountPicker(body.querySelector('[data-picker]'), k, { onPick: (t, d) => {
      start = t;
      btn.disabled = !t;
      btn.textContent = t ? `Confirm ${fmt(t, d.tz, { weekday: 'short', month: 'short', day: 'numeric' })}, ${fmt(t, d.tz, { hour: 'numeric', minute: '2-digit' })}` : 'Choose a time';
    } });
    btn.onclick = async () => {
      const err = body.querySelector('.form-err');
      err.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Booking…';
      try {
        const r = await api('/book', { method: 'POST', body: JSON.stringify({ kind: k, start, via, option, note: body.querySelector('[data-note]').value }) });
        done(r.appointment);
      } catch (e2) {
        err.textContent = e2.message;
        err.hidden = false;
        await mountPicker(body.querySelector('[data-picker]'), k, { onPick: (t) => { start = t; btn.disabled = !t; btn.textContent = t ? 'Confirm this time' : 'Choose a time'; } });
      }
    };
  };
  const done = (a) => {
    body.innerHTML = `<p class="eyebrow">You are booked</p><h2 id="sched-h">${esc(a.label)}</h2><p class="sched-when">${esc(a.when)}</p>
      <p>${a.kind === 'online' ? (a.via === 'video' && a.video ? 'Use the video link below at that time.' : `${esc(BK.store)} will call you at this time.`) : `See you at ${esc(BK.store)}.`}</p>
      <div class="cta-row"><a class="btn ghost" href="${esc(a.ics)}" download>Add to my calendar</a>${a.via === 'video' && a.video ? `<a class="btn ghost" href="${esc(a.video)}" target="_blank" rel="noopener">Video link</a>` : ''}<button type="button" class="btn primary" data-sx>Done</button></div>`;
    refreshAppts();
  };
  body.onclick = (e) => {
    if (e.target.closest('[data-sx]')) { sched.close(); return; }
    if (e.target.closest('[data-sb]')) { chooseKind(); return; }
    const kb = e.target.closest('.kind[data-kind]');
    if (kb) pickTime(kb.dataset.kind);
  };
  if (kind && kinds.some((k) => k.kind === kind)) pickTime(kind);
  else if (kinds.length === 1) pickTime(kinds[0].kind);
  else chooseKind();
  if (sched.showModal) sched.showModal();
}
sched?.addEventListener('click', (e) => { if (e.target === sched) sched.close(); });

// Zakazani termini ispod zaglavlja: crtaju se iz /slots (current), otkazivanje uz potvrdu.
async function refreshAppts() {
  const box = document.getElementById('appts');
  if (!box || !BK?.kinds?.length) return;
  try {
    const d = await api(`/slots?kind=${BK.kinds[0].kind}`);
    box.innerHTML = (d.current || []).map((a) => `<div class="appt" data-appt="${esc(a.id)}"><div class="appt-main"><p class="mini">Your appointment</p><h3>${esc(a.label)}${a.purpose === 'mold' ? ' · mold' : a.purpose === 'pickup' ? ' · pick up' : ''}</h3><p class="appt-when">${esc(a.when)}</p>
      <p class="appt-how">${a.kind === 'online' ? (a.via === 'video' && a.video ? `Video call: <a href="${esc(a.video)}" target="_blank" rel="noopener">join link</a>` : 'We will call you at this time.') : `At the studio. Times are in ${esc(BK.tzLabel)}.`}</p></div>
      <div class="appt-acts"><a class="btn ghost small" href="${esc(a.ics)}" download>Add to calendar</a>${a.purpose === 'consult' && BK.kinds.some((k) => k.kind === a.kind) ? `<button type="button" class="btn ghost small" data-action="book" data-kind="${esc(a.kind)}">Change time</button>` : ''}<button type="button" class="btn ghost small" data-cancel="${esc(a.id)}">Cancel</button></div></div>`).join('');
  } catch {}
}
document.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-cancel]');
  if (!c) return;
  if (!confirm('Cancel this appointment?')) return;
  c.disabled = true;
  try { await api(`/appointments/${encodeURIComponent(c.dataset.cancel)}/cancel`, { method: 'POST' }); c.closest('.appt')?.remove(); }
  catch (err) { c.disabled = false; alert(err.message); }
});

// ---------- Poslije depozita: kako kupac dobija komad ----------
const nf = document.getElementById('next-form');
if (nf) {
  let visitStart = null;
  let pickerOn = false;
  const show = (sel, on) => nf.querySelectorAll(`[data-when="${sel}"]`).forEach((el) => { el.hidden = !on; });
  const sync = () => {
    const local = nf.querySelector('input[name="local"]:checked')?.value;
    const method = local === 'no' ? 'ship' : nf.querySelector('input[name="method"]:checked')?.value;
    show('local-yes', local === 'yes');
    show('visit', method === 'visit');
    show('ship', method === 'ship');
    const pk = nf.querySelector('[data-picker="next"]');
    if (method === 'visit' && pk && !pickerOn) { pickerOn = true; mountPicker(pk, 'visit', { forNext: true, onPick: (t) => { visitStart = t; } }); }
  };
  nf.addEventListener('change', sync);
  nf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = nf.querySelector('.form-err');
    err.hidden = true;
    const local = nf.querySelector('input[name="local"]:checked')?.value;
    const method = local === 'no' ? 'ship' : nf.querySelector('input[name="method"]:checked')?.value;
    const v = (n) => nf.querySelector(`[name="${n}"]`)?.value || '';
    const body = { local: local === 'yes' ? true : local === 'no' ? false : null, method, note: v('note'),
      ...(method === 'ship' ? { address: { line1: v('line1'), line2: v('line2'), city: v('city'), state: v('state'), zip: v('zip') } } : {}),
      ...(method === 'visit' && visitStart ? { start: visitStart } : {}) };
    const btn = nf.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const r = await api('/next', { method: 'POST', body: JSON.stringify(body) });
      const done = document.querySelector('.next-done');
      done.querySelector('.next-text').textContent = r.text;
      done.hidden = false;
      nf.hidden = true;
      if (r.appointment) refreshAppts();
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e2) { err.textContent = e2.message; err.hidden = false; }
    btn.disabled = false;
  });
  document.querySelector('[data-next-edit]')?.addEventListener('click', () => { document.querySelector('.next-done').hidden = true; nf.hidden = false; });
  if (location.hash === '#next') setTimeout(() => document.getElementById('next')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
}
