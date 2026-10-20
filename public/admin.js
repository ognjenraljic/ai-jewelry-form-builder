// Admin: upiti, renderi, trošak, onboarding i zahtjevi za demo. Prijava je HttpOnly kolačić.
(() => {
const root = document.getElementById('root');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Prijava: HttpOnly kolačić (isti kao u builderu); token se ne čuva u browseru i ne ide u adrese slika.
try { localStorage.removeItem('aik_admin'); } catch {}
let next = null;
let more = [];

function login(msg) {
  root.innerHTML = `<form class="login"><input type="password" placeholder="ADMIN_TOKEN" autocomplete="current-password" autofocus /><button>Uđi</button></form>${msg ? `<p class="muted" style="text-align:center">${esc(msg)}</p>` : ''}`;
  root.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: root.querySelector('input').value.trim() }) });
    if (!r.ok) return login('Pogrešan token.');
    load();
  };
}

async function load() {
  const res = await fetch('/api/admin/leads');
  if (res.status === 403) return login();
  const data = await res.json();
  next = data.next;
  more = [];
  const log = (await (await fetch('/api/admin/view-as-log')).json()).sessions || [];
  const obs = (await (await fetch('/api/admin/onboardings')).json()).onboardings || [];
  const t = data.totals;
  const avg = t.renders ? t.cost / t.renders : 0;
  root.innerHTML = `
    <h1>Leadovi i renderi</h1>
    <p class="muted">Lokalna baza (D1) · <a href="/builder">Builder</a></p>
    <div class="stats">
      <div class="stat">Leadovi<b>${t.leads}</b></div>
      <div class="stat">Uspješni renderi<b>${t.renders}</b></div>
      <div class="stat">Greške<b>${t.errors}</b></div>
      <div class="stat">Trošak AI (procjena)<b>$${t.cost.toFixed(3)}</b></div>
      <div class="stat">Probni renderi (builder)<b>${t.tests} · $${(t.testCost || 0).toFixed(3)}</b></div>
      <div class="stat">Prosjek po renderu<b>$${avg.toFixed(3)}</b></div>
    </div>
    ${log.length ? `<h2 style="font-size:17px;margin:0 0 12px">View as client (log)</h2><div class="lead" style="padding:6px 18px">${log.map((x) => `<p style="margin:8px 0"><b>${esc(x.name || x.client_id)}</b> <span class="muted">· ${new Date(x.started_at).toLocaleString('sr-Latn')} · ${x.ended_at ? 'zatvoreno ' + new Date(x.ended_at).toLocaleTimeString('sr-Latn') : x.expires_at < Date.now() ? 'isteklo' : 'aktivno'}</span></p>`).join('')}</div>` : ''}
    <h2 style="font-size:17px;margin:0 0 12px">Onboarding klijenata</h2>
    ${obs.length ? `<div class="lead" style="padding:6px 18px">${obs.map((o) => `<p style="margin:10px 0"><b>${esc(o.name || o.client_id)}</b> <span class="muted">· ${o.status === 'draft' ? 'popunjava' : o.status === 'submitted' ? `<b style="color:var(--gold)">poslato ${new Date(o.submitted_at).toLocaleString('sr-Latn')}</b>, pregledaj u builderu` : `forma napravljena (${esc(o.form_id || '')})`} · zadnja izmjena ${new Date(o.updated_at).toLocaleString('sr-Latn')}</span></p>`).join('')}</div>` : '<p class="muted">Još nema onboardinga. Pošalji ga iz buildera: New form → Send onboarding form.</p>'}
    <h2 style="font-size:17px;margin:20px 0 12px">Zahtjevi za demo (JewelryLead sajt)</h2>
    ${demosView(data.demos)}
    <h2 style="font-size:17px;margin:28px 0 12px">Leadovi iz widgeta</h2>
    <div id="leads">${data.leads.length ? data.leads.map(lead).join('') : '<p class="muted">Još nema leadova. Prođi formu na demo sajtu.</p>'}</div>
    <div class="more" id="more">${next ? '<button data-more>Starije</button>' : ''}</div>`;
}

// Starije upite učitava po 50 (stranica ostaje brza i kad ih bude hiljade).
async function loadMore(btn) {
  btn.disabled = true;
  const data = await (await fetch(`/api/admin/leads?before=${next}`)).json();
  next = data.next;
  document.getElementById('leads').insertAdjacentHTML('beforeend', data.leads.map(lead).join(''));
  document.getElementById('more').innerHTML = next ? '<button data-more>Starije</button>' : '';
}

// Zahtjevi za demo: neobrađeni gore sa dugmetom, obrađeni sklopljeni ispod (može se vratiti).
function demosView(demos) {
  if (!demos.length) return '<p class="muted">Još nema zahtjeva.</p>';
  const row = (d) => `<p style="margin:10px 0;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><span style="flex:1"><b>${esc(d.name)}</b> <span class="muted">· <a href="mailto:${esc(d.email)}">${esc(d.email)}</a> · ${esc(d.website)} · ${esc(d.platform)} · ${esc(d.volume)} · ${new Date(d.created_at).toLocaleString('sr-Latn')}${d.handled_at ? ` · obrađeno ${new Date(d.handled_at).toLocaleDateString('sr-Latn')}` : ''}</span></span><button class="mini" data-demo="${esc(d.id)}" data-handled="${d.handled_at ? 'false' : 'true'}">${d.handled_at ? 'Vrati u neobrađene' : 'Obrađeno'}</button></p>`;
  const open = demos.filter((d) => !d.handled_at && !d.spam);
  const done = demos.filter((d) => d.handled_at && !d.spam);
  const spam = demos.filter((d) => d.spam);
  return `<div class="lead" style="padding:6px 18px">${open.length ? open.map(row).join('') : '<p class="muted">Sve je obrađeno.</p>'}
    ${done.length ? `<details style="margin:6px 0 10px"><summary class="muted" style="cursor:pointer">Obrađeni (${done.length})</summary>${done.map(row).join('')}</details>` : ''}
    ${spam.length ? `<details class="spam" style="margin:6px 0 10px"><summary class="muted" style="cursor:pointer">Mogući spam (${spam.length}): popunjeno skriveno polje</summary>${spam.map(row).join('')}</details>` : ''}</div>`;
}

root.addEventListener('click', async (e) => {
  const m = e.target.closest('[data-more]');
  if (m) return loadMore(m);
  const b = e.target.closest('[data-demo]');
  if (!b) return;
  b.disabled = true;
  await fetch(`/api/admin/demo-requests/${b.dataset.demo}/handled`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handled: b.dataset.handled === 'true' }) });
  load();
});

function lead(l) {
  const a = l.answers;
  const tags = Object.entries(a).filter(([k, v]) => v && k !== 'vision').map(([k, v]) => `<span class="tag">${esc(k)}: <b>${esc(v)}</b></span>`).join('');
  const img = (key) => `<img src="/media/${esc(key)}" alt="" width="180" height="180" loading="lazy" />`;
  const ref = l.ref_key ? `<figure>${img(l.ref_key)}<figcaption>Referenca kupca</figcaption></figure>` : '';
  let extra = {};
  try { extra = JSON.parse(l.files || '{}'); } catch {}
  const files = Object.entries(extra).map(([f, key]) => `<figure>${img(key)}<figcaption>Fajl: ${esc(f)}</figcaption></figure>`).join('');
  const renders = l.renders.map((r) => r.status === 'ok' && r.image_key
    ? `<figure><a href="/media/${esc(r.image_key)}" target="_blank" rel="noopener">${img(r.image_key)}</a><figcaption>#${r.n} · ${esc(r.model)}<br />${(r.ms / 1000).toFixed(1)} s · $${(r.cost_usd || 0).toFixed(4)}${r.tweak ? `<br />dorada: ${esc(r.tweak)}` : ''}</figcaption></figure>`
    : `<figure><div class="err">${esc(r.status)}: ${esc(r.error || '')}</div><figcaption>${esc(r.model)}</figcaption></figure>`).join('');
  return `<article class="lead">
    <header><h2>${esc(l.name)} <span class="muted">· ${esc(l.email)} · ${esc(l.phone)}</span></h2><span class="muted">${new Date(l.created_at).toLocaleString('sr-Latn')}</span></header>
    <div class="tags"><span class="tag">forma: <b>${esc(l.form_id)}</b></span>${tags}</div>
    ${a.vision ? `<p class="vision">"${esc(a.vision)}"</p>` : ''}
    <div class="imgs">${ref}${files}${renders}</div>
  </article>`;
}

load();
})();
