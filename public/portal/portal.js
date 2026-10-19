// Portal klijenta: njegovi leadovi (renderi, odgovori, fotografije) i njegove forme sa embed kodom.
// Sesija: "View as client" iz buildera ostavi token u localStorage, portal ga prebaci u sessionStorage (ovaj tab).
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (fn) => { try { return fn(); } catch { return null; } };

const P = { token: null, me: null, leads: [], tab: 'leads' };

boot();
async function boot() {
  const handoff = safe(() => localStorage.getItem('aik_view_as'));
  if (handoff) {
    safe(() => sessionStorage.setItem('aik_portal', handoff));
    safe(() => localStorage.removeItem('aik_view_as'));
  }
  P.token = safe(() => JSON.parse(sessionStorage.getItem('aik_portal') || 'null'))?.token;
  if (!P.token) return ended('No active session', 'Open this portal from the JewelryLead builder with "View as client".');
  try {
    P.me = await api('/api/portal/me');
    P.leads = (await api('/api/portal/leads')).leads;
  } catch (e) {
    return ended('Session ended', e.message);
  }
  document.title = `${P.me.client.name} · JewelryLead`;
  render();
  setInterval(tick, 30_000);
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'x-portal-token': P.token } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function ended(title, text) {
  safe(() => sessionStorage.removeItem('aik_portal'));
  app.innerHTML = `<div class="center"><div><h1>${esc(title)}</h1><p style="color:var(--ink-faint)">${esc(text)}</p></div></div>`;
}

const minsLeft = () => Math.max(0, Math.round((P.me.session.expiresAt - Date.now()) / 60000));
function tick() {
  if (Date.now() > P.me.session.expiresAt) return ended('Session ended', 'The admin view lasts one hour. Open it again from the builder.');
  const el = document.getElementById('left');
  if (el) el.textContent = `${minsLeft()} min`;
}

// Slike kupaca traže token u adresi (img ne šalje zaglavlja); renderi su javni po nepogodivom ključu.
const media = (key) => `/media/${key}?t=${encodeURIComponent(P.token)}`;

function render() {
  const { client, forms, stats, session } = P.me;
  const banner = session.kind === 'view-as'
    ? `<div class="viewas"><div class="wrap"><span>Admin view</span><span class="grow">Viewing as <b>${esc(client.name)}</b>, exactly as they see it. Ends in <b id="left">${minsLeft()} min</b>.</span><button class="btn warn" data-act="exit">Exit view</button></div></div>`
    : '';
  app.innerHTML = `
    ${banner}
    <header class="head"><div class="wrap">
      <div class="client">${client.logo ? `<img src="${esc(client.logo)}" alt="" />` : ''}<div><h1>${esc(client.name)}</h1><small>${esc(client.website || 'Client portal')}</small></div></div>
      <span class="powered">Powered by <b>JewelryLead</b></span>
    </div></header>
    <main class="wrap">
      <nav class="tabs"><button class="tab ${P.tab === 'leads' ? 'on' : ''}" data-tab="leads">Leads</button><button class="tab ${P.tab === 'forms' ? 'on' : ''}" data-tab="forms">Forms</button></nav>
      <div class="stats">
        <div class="stat">Leads<b>${stats.leads}</b></div>
        <div class="stat">AI renders<b>${stats.renders}</b></div>
        <div class="stat">Live forms<b>${forms.length}</b></div>
      </div>
      ${P.tab === 'leads' ? leadsView() : formsView()}
      <p class="note">Want to change a form, add styles or questions? Contact your JewelryLead team.</p>
    </main>`;
}

function leadsView() {
  if (!P.leads.length) return '<p class="empty">No leads yet. They appear here as soon as a customer finishes one of your forms.</p>';
  return P.leads.map((l) => {
    const last = l.renders[l.renders.length - 1];
    const photos = l.photos.map((p) => `<figure><img src="${media(p.key)}" alt="" data-zoom /><figcaption>${esc(p.label)}</figcaption></figure>`).join('');
    const strip = l.renders.length > 1 ? l.renders.map((r, k) => `<figure><img src="${esc(r.url)}" alt="" data-zoom /><figcaption>${k === 0 ? 'First render' : esc(r.tweak || `Render ${k + 1}`)}</figcaption></figure>`).join('') : '';
    return `
      <article class="lead">
        <div class="shot ${last ? '' : 'none'}">${last ? `<img src="${esc(last.url)}" alt="AI render" data-zoom />` : 'No render yet'}</div>
        <div>
          <div class="lead-top"><h2>${esc(l.name)}</h2><span class="when">${esc(new Date(l.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))} · <span class="pill">${esc(l.form)}</span></span></div>
          <div class="contact"><a href="mailto:${esc(l.email)}">${esc(l.email)}</a><a href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}">${esc(l.phone)}</a></div>
          <div class="tags">${l.details.map((d) => `<span class="tag">${esc(d.label)}: <b>${esc(d.value)}</b></span>`).join('')}</div>
          ${l.vision ? `<p class="vision">"${esc(l.vision)}"</p>` : ''}
          <div class="thumbs">${strip}${photos}</div>
        </div>
      </article>`;
  }).join('');
}

function formsView() {
  const o = location.origin.replace('//builder.', '//');
  return P.me.forms.map((f) => {
    const snippet = `<div id="jewelrylead-${f.id}"></div>\n<script src="${o}/embed.js" data-form="${f.id}" data-target="jewelrylead-${f.id}" async></script>`;
    return `
      <div class="form-card">
        <div class="row"><h2>${esc(f.name)}</h2><span class="pill">${esc(f.label)}</span><a class="btn" href="/f/${esc(f.id)}" target="_blank" rel="noopener">Open form ↗</a></div>
        <pre>${esc(snippet)}</pre>
        <button class="btn" data-copy="${esc(snippet)}">Copy embed code</button>
      </div>`;
  }).join('') || '<p class="empty">No forms yet.</p>';
}

app.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.tab) { P.tab = t.dataset.tab; render(); }
  if (t.dataset.copy) { try { await navigator.clipboard.writeText(t.dataset.copy); t.textContent = 'Copied'; } catch { t.textContent = 'Copy failed'; } }
  if (t.dataset.act === 'exit') {
    try { await api('/api/portal/exit', { method: 'POST' }); } catch {}
    ended('Admin view closed', 'You can close this tab.');
  }
  if (t.dataset.zoom !== undefined) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = `<img src="${esc(t.src)}" alt="" />`;
    box.onclick = () => box.remove();
    document.body.appendChild(box);
  }
});
