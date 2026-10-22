// Portal klijenta: njegovi upiti (renderi, odgovori, fotografije, status), forme sa embed kodom i onboarding.
// Prijava: link klijenta (/portal#k=...) ili admin pregled (/portal#v=...) se jednom zamijeni za HttpOnly kolačić
// i odmah obriše iz adrese. Token se više ne čuva u browseru niti ide u adrese slika.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (fn) => { try { return fn(); } catch { return null; } };

const STATUSES = [['new', 'New'], ['contacted', 'Contacted'], ['quoted', 'Quoted'], ['won', 'Won'], ['lost', 'Lost']];
const P = { me: null, leads: [], tab: 'leads', form: '', status: '', q: '', next: null, counts: {}, loadingMore: false };
const day = (t) => new Date(t).toLocaleDateString('en-US', { dateStyle: 'medium' });
const readOnly = () => P.me?.session.kind === 'view-as';

boot();
async function boot() {
  app.innerHTML = '<div class="center"><p class="faint">Loading your portal…</p></div>';
  // Token iz adrese (ili starog načina čuvanja u browseru) se zamijeni za kolačić pa nestane.
  const hash = location.hash;
  const legacyView = safe(() => JSON.parse(sessionStorage.getItem('aik_portal') || 'null'))?.token || safe(() => JSON.parse(localStorage.getItem('aik_view_as') || 'null'))?.token;
  const token = hash.match(/[#&]k=([a-z0-9]{20,})/)?.[1] || hash.match(/[#&]v=([a-z0-9]{20,})/)?.[1] || legacyView || safe(() => localStorage.getItem('aik_client'));
  if (hash) history.replaceState(null, '', location.pathname);
  safe(() => { sessionStorage.removeItem('aik_portal'); localStorage.removeItem('aik_view_as'); localStorage.removeItem('aik_client'); });
  if (token) {
    try { await api('/api/portal/session', { method: 'POST', body: JSON.stringify({ token }), json: true }); }
    catch (e) { return ended('This link no longer works', 'Ask your JewelryLead team for a new portal link.'); }
  }
  try {
    P.me = await api('/api/portal/me');
  } catch (e) {
    return ended('Your portal', 'Open the portal link your JewelryLead team sent you.');
  }
  // A new setup draft must not hide a client's existing forms or enquiries.
  P.tab = hasDraftOnboarding() && !P.me.forms.length && !P.me.stats.leads ? 'onboarding' : 'leads';
  await loadLeads();
  document.title = `${P.me.client.name} · JewelryLead`;
  render();
  setInterval(tick, 30_000);
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, credentials: 'same-origin', headers: { ...(opts.json ? { 'content-type': 'application/json' } : {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}

// Upiti po stranicama od 50, sa filterom statusa i pretragom (rade na serveru, ne samo na učitanima).
async function loadLeads(more = false) {
  const qs = new URLSearchParams();
  if (more && P.next) qs.set('before', P.next);
  if (P.status) qs.set('status', P.status);
  if (P.q) qs.set('q', P.q);
  const r = await api(`/api/portal/leads?${qs}`);
  P.leads = more ? [...P.leads, ...r.leads] : r.leads;
  P.next = r.next;
  P.counts = r.counts || {};
}

function ended(title, text) {
  app.innerHTML = `<div class="center"><div><h1>${esc(title)}</h1><p style="color:var(--ink-faint)">${esc(text)}</p></div></div>`;
}

const minsLeft = () => Math.max(0, Math.round((P.me.session.expiresAt - Date.now()) / 60000));
function tick() {
  if (P.me.session.expiresAt && Date.now() > P.me.session.expiresAt) {
    return P.me.session.kind === 'client' ? ended('This link has expired', 'Ask your JewelryLead team for a new portal link.') : ended('Session ended', 'The admin view lasts one hour. Open it again from the builder.');
  }
  const el = document.getElementById('left');
  if (el) el.textContent = `${minsLeft()} min`;
}

// Slike kupaca: pristup preko kolačića portala (bez tokena u adresi).
const media = (key) => `/media/${key}`;

const hasDraftOnboarding = () => P.me.onboarding?.status === 'draft';
function portalTabs() {
  const tabs = [['leads', 'Leads'], ['forms', 'Forms'], ...(hasDraftOnboarding() ? [['onboarding', 'Store setup']] : [])];
  return `<nav class="tabs" aria-label="Client portal">${tabs.map(([key, label]) => `<button class="tab ${P.tab === key ? 'on' : ''}" data-tab="${key}" ${P.tab === key ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</nav>`;
}

function render() {
  const { client, forms, stats, session } = P.me;
  if (hasDraftOnboarding() && P.tab === 'onboarding') return renderOnboarding();
  if (P.tab === 'onboarding') P.tab = 'forms';
  const banner = session.kind === 'view-as'
    ? `<div class="viewas"><div class="wrap"><span>Admin view</span><span class="grow">Viewing as <b>${esc(client.name)}</b>, read-only. Ends in <b id="left">${minsLeft()} min</b>.</span><button class="btn warn" data-act="exit">Exit view</button></div></div>`
    : '';
  app.innerHTML = `
    ${banner}
    <header class="head"><div class="wrap">
      <div class="client">${client.logo ? `<img src="${esc(client.logo)}" alt="" />` : ''}<div><h1>${esc(client.name)}</h1><small>${esc(client.website || 'Client portal')}</small></div></div>
      <span class="powered">Powered by <b>JewelryLead</b></span>
      ${session.kind === 'client' ? '<button class="btn" data-act="signout" title="Remove the portal from this device">Sign out</button>' : ''}
    </div></header>
    <main class="wrap">
      ${portalTabs()}
      <div class="stats">
        <div class="stat">Leads<b>${stats.leads}</b></div>
        <div class="stat">Last 30 days<b>${stats.recent}</b></div>
        <div class="stat">AI renders<b>${stats.renders}</b></div>
        <div class="stat">Live forms<b>${forms.length}</b></div>
      </div>
      ${P.me.onboarding?.status === 'submitted' || P.me.onboarding?.status === 'building' ? `<div class="ob-sent"><b>Thank you, we have your answers.</b> We are building your form now and it will appear under Forms. Your leads will show up here as soon as customers use it.</div>` : ''}
      ${P.tab === 'leads' ? leadsView() : formsView()}
      <p class="note">Want to change a form, add styles or questions? Contact your JewelryLead team.</p>
    </main>`;
}

function leadsView() {
  const total = Object.values(P.counts).reduce((a, b) => a + b, 0);
  if (!total && !P.q) return '<p class="empty">No leads yet. They appear here as soon as a customer finishes one of your forms.</p>';
  const forms = P.me.forms.filter((f) => f.leads);
  const statusChips = `<div class="chips" role="group" aria-label="Filter by status"><button class="chip ${P.status ? '' : 'on'}" data-status="">All <span>${total}</span></button>${STATUSES.map(([v, l]) => `<button class="chip ${P.status === v ? 'on' : ''}" data-status="${v}">${l} <span>${P.counts[v] || 0}</span></button>`).join('')}</div>`;
  const formChips = forms.length > 1
    ? `<div class="chips" role="group" aria-label="Filter by form"><button class="chip ${P.form ? '' : 'on'}" data-form="">All forms</button>${forms.map((f) => `<button class="chip ${P.form === f.id ? 'on' : ''}" data-form="${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div>`
    : '';
  const search = `<label class="search"><span class="sr-only">Search leads</span><input class="in" type="search" data-search placeholder="Search name, email or phone" value="${esc(P.q)}" /></label>`;
  const list = P.form ? P.leads.filter((l) => l.formId === P.form) : P.leads;
  const cards = list.map((l) => {
    const last = l.renders[l.renders.length - 1];
    const photos = l.photos.map((p) => `<figure><img src="${media(p.key)}" alt="${esc(p.label)}" width="64" height="64" loading="lazy" data-zoom tabindex="0" /><figcaption>${esc(p.label)}</figcaption></figure>`).join('');
    const strip = l.renders.length > 1 ? l.renders.map((r, k) => `<figure><img src="${esc(r.url)}" alt="${k === 0 ? 'First render' : esc(r.tweak || `Render ${k + 1}`)}" width="64" height="64" loading="lazy" data-zoom tabindex="0" /><figcaption>${k === 0 ? 'First render' : esc(r.tweak || `Render ${k + 1}`)}</figcaption></figure>`).join('') : '';
    const sel = `<select class="status-sel s-${esc(l.status)}" data-lead-status="${esc(l.id)}" aria-label="Status of ${esc(l.name)}" ${readOnly() ? 'disabled' : ''}>${STATUSES.map(([v, t]) => `<option value="${v}" ${l.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    return `
      <article class="lead">
        <div class="shot ${last ? '' : 'none'}">${last ? `<img src="${esc(last.url)}" alt="AI render for ${esc(l.name)}" width="220" height="220" loading="lazy" data-zoom tabindex="0" />` : 'No render yet'}</div>
        <div>
          <div class="lead-top"><h2>${esc(l.name)}</h2><span class="when">${esc(new Date(l.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))} · <span class="pill">${esc(l.form)}</span></span>${sel}</div>
          <div class="contact"><a href="mailto:${esc(l.email)}">${esc(l.email)}</a><a href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}">${esc(l.phone)}</a></div>
          <div class="tags">${l.details.map((d) => `<span class="tag">${esc(d.label)}: <b>${esc(d.value)}</b></span>`).join('')}</div>
          ${l.vision ? `<p class="vision">"${esc(l.vision)}"</p>` : ''}
          <div class="thumbs">${strip}${photos}</div>
          <label class="lead-note"><span class="sr-only">Note</span><textarea class="in" rows="1" data-lead-note="${esc(l.id)}" placeholder="Add a note (quote sent, follow up Friday…)" ${readOnly() ? 'disabled' : ''}>${esc(l.note)}</textarea></label>
        </div>
      </article>`;
  }).join('') || '<p class="empty">No leads match.</p>';
  const more = P.next ? `<div class="more"><button class="btn" data-act="more" ${P.loadingMore ? 'disabled' : ''}>${P.loadingMore ? 'Loading…' : 'Show older leads'}</button></div>` : '';
  return `<div class="filters">${search}${statusChips}${formChips}</div>${cards}${more}`;
}

function formsView() {
  const o = location.origin.replace('//builder.', '//');
  return P.me.forms.map((f) => {
    const snippet = `<div id="jewelrylead-${f.id}"></div>\n<script src="${o}/embed.js" data-form="${f.id}" data-target="jewelrylead-${f.id}" async></script>`;
    return `
      <div class="form-card">
        <div class="row"><h2>${esc(f.name)}</h2><span class="pill">${esc(f.label)}</span><a class="btn" href="/f/${esc(f.id)}" target="_blank" rel="noopener">Open form ↗</a></div>
        <div class="fstats"><span><b>${f.leads}</b> lead${f.leads === 1 ? '' : 's'}</span><span><b>${f.renders}</b> AI render${f.renders === 1 ? '' : 's'}</span><span>Last lead: <b>${f.lastLead ? esc(day(f.lastLead)) : 'none yet'}</b></span>${f.leads ? `<button class="btn" data-see="${esc(f.id)}">See leads</button>` : ''}</div>
        <pre>${esc(snippet)}</pre>
        <button class="btn" data-copy="${esc(snippet)}">Copy embed code</button>
      </div>`;
  }).join('') || '<p class="empty">No forms yet.</p>';
}

function zoom(src) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Image');
  box.tabIndex = -1;
  box.innerHTML = `<img src="${esc(src)}" alt="" />`;
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  box.onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.appendChild(box);
  box.focus();
}

let searchTimer;
app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.search !== undefined) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => { P.q = el.value.trim(); await loadLeads(); render(); const s = app.querySelector('[data-search]'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }, 350);
  }
});
app.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.leadStatus) {
    const id = el.dataset.leadStatus;
    const prev = P.leads.find((l) => l.id === id)?.status;
    try {
      await api(`/api/portal/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status: el.value }), json: true });
      const l = P.leads.find((x) => x.id === id);
      if (l) { P.counts[prev] = Math.max(0, (P.counts[prev] || 1) - 1); P.counts[el.value] = (P.counts[el.value] || 0) + 1; l.status = el.value; }
      el.className = `status-sel s-${el.value}`;
    } catch (err) { JLUI.alert(err.message); el.value = prev; }
  }
  if (el.dataset.leadNote) {
    try { await api(`/api/portal/leads/${el.dataset.leadNote}`, { method: 'PATCH', body: JSON.stringify({ note: el.value }), json: true }); const l = P.leads.find((x) => x.id === el.dataset.leadNote); if (l) l.note = el.value; el.classList.add('saved'); setTimeout(() => el.classList.remove('saved'), 1200); }
    catch (err) { JLUI.alert(err.message); }
  }
});
app.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.zoom !== undefined) { e.preventDefault(); zoom(e.target.src); }
});

app.addEventListener('click', async (e) => {
  const t = e.target.closest('button, img[data-zoom]') || e.target;
  if (t.dataset.tab) { P.tab = t.dataset.tab; render(); }
  if (t.dataset.form !== undefined) { P.form = t.dataset.form; render(); }
  if (t.dataset.status !== undefined) { P.status = t.dataset.status; await loadLeads(); render(); }
  if (t.dataset.see) { P.tab = 'leads'; P.form = t.dataset.see; render(); }
  if (t.dataset.act === 'more') { P.loadingMore = true; render(); try { await loadLeads(true); } finally { P.loadingMore = false; render(); } }
  if (t.dataset.act === 'signout') {
    if (!(await JLUI.confirm('Sign out on this device? You can come back with your portal link.'))) return;
    try { await api('/api/portal/logout', { method: 'POST' }); } catch {}
    ended('Signed out', 'Open your portal link again to come back.');
  }
  if (t.dataset.copy) {
    const label = t.textContent;
    try { await navigator.clipboard.writeText(t.dataset.copy); t.textContent = 'Copied'; } catch { t.textContent = 'Copy failed'; }
    setTimeout(() => { t.textContent = label; }, 1500);
  }
  if (t.dataset.act === 'exit') {
    try { await api('/api/portal/exit', { method: 'POST' }); } catch {}
    ended('Admin view closed', 'You can close this tab.');
  }
  if (t.dataset.zoom !== undefined) zoom(t.src);
});

// ---------- Onboarding (vodič za zlatara) ----------
// Zlatar popuni radnju, komade, stilove sa slikama, materijale i budžet. Sve se čuva samo; Send šalje adminu.
const OB_STEPS = [['store', 'Your store'], ['pieces', 'What you make'], ['styles', 'Styles'], ['materials', 'Materials & budget'], ['extras', 'Notes for our team'], ['send', 'Review & send']];
const ACCENTS = ['#35d0c4', '#d8b46a', '#e7a9a0', '#9b8cff', '#5aa9ff', '#ef6f6f', '#f2f2f2'];
const OB = { d: null, step: 0, timer: null, saving: false, savedAt: 0, err: '', dirty: false, rev: 0, inflight: null, retry: null, uploads: new Map(), submitting: false, previewBg: null, previewTimer: null, previewSeq: 0, previewStep: -1 };
// Stabilan id za komade i stilove: slika se upiše u pravi stil i kad se u međuvremenu doda ili ukloni neki drugi.
const uid = () => Math.random().toString(36).slice(2, 10);

function obInit() {
  const defs = P.me.onboardingDefaults;
  const d = structuredClone(P.me.onboarding.data || {});
  d.store = { name: P.me.client.name, website: P.me.client.website || '', accent: '#35d0c4', theme: 'dark', ...(d.store || {}) };
  d.pieces = Array.isArray(d.pieces) ? d.pieces : [];
  d.metals = Array.isArray(d.metals) ? d.metals : defs.metals.map((m) => m.value);
  d.stones = Array.isArray(d.stones) ? d.stones : defs.stones.map((s) => s.value);
  d.budgets = Array.isArray(d.budgets) ? d.budgets : [...defs.budgets];
  d.customMetals = Array.isArray(d.customMetals) ? d.customMetals.map((m) => ({ ...m, swatch: /^#[0-9a-f]{6}$/i.test(m.swatch || '') ? m.swatch : '#c0c4c8' })) : [];
  d.customStones = Array.isArray(d.customStones) ? d.customStones : [];
  // Ranije upisani "Other metals" postaju prave opcije, bez gubitka podataka.
  for (const label of String(d.metalsOther || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const value = `custom-${uid()}`;
    d.customMetals.push({ value, label: label.slice(0, 40), swatch: '#c0c4c8' }); d.metals.push(value);
  }
  d.metalsOther = '';
  for (const pc of d.pieces) { pc.uid ||= uid(); for (const st of pc.styles || []) st.uid ||= uid(); }
  OB.d = d;
  OB.rev = P.me.onboarding.rev || 0;
  OB.step = Math.min(OB_STEPS.length - 1, Math.max(0, +d.step || 0));
}

const obGet = (path) => path.split('.').reduce((x, k) => x?.[k], OB.d);
function obSet(path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  const t = ks.reduce((x, k) => x[k], OB.d);
  t[last] = v;
}

function obSave(now = false) {
  if (readOnly() || OB.submitting || !OB.d) return; // admin pregled ne mijenja klijentove odgovore
  OB.dirty = true;
  clearTimeout(OB.timer);
  clearTimeout(OB.retry);
  const go = async () => {
    if (OB.submitting || !OB.d) return;
    if (OB.saving) { OB.timer = setTimeout(go, 300); return; }
    OB.saving = true;
    OB.dirty = false;
    obStatus();
    OB.inflight = (async () => {
      try {
        const r = await api('/api/portal/onboarding', { method: 'PUT', body: JSON.stringify({ data: { ...OB.d, step: OB.step }, rev: OB.rev }), json: true });
        OB.rev = r.rev;
        OB.savedAt = Date.now();
        OB.err = '';
      } catch (e) {
        // Drugi uređaj je sačuvao novije odgovore: preuzmi ih umjesto da ih prepišeš.
        if (e.data?.conflict && e.data.data) {
          OB.rev = e.data.rev;
          OB.d = null;
          P.me.onboarding.data = e.data.data;
          P.me.onboarding.rev = e.data.rev;
          renderOnboarding();
          JLUI.alert('Your answers were updated on another device. You now see the latest version.');
          return;
        }
        OB.err = e.message;
        OB.dirty = true;
        OB.retry = setTimeout(() => obSave(true), 5000); // mreža: pokušaj ponovo za 5 s
      } finally {
        OB.saving = false;
        obStatus();
      }
    })();
    await OB.inflight;
  };
  if (now) go(); else OB.timer = setTimeout(go, 700);
}
function obStatus() {
  const el = document.getElementById('ob-status');
  if (!el) return;
  el.className = `ob-status ${OB.err ? 'err' : ''}`;
  el.textContent = OB.err ? `Not saved: ${OB.err}` : OB.saving || OB.dirty ? 'Saving…' : OB.savedAt ? 'All changes saved' : 'Saves automatically';
}
// Zatvaranje taba usred kucanja: pošalji zadnje izmjene.
addEventListener('pagehide', () => {
  if (!OB.d || !OB.dirty || readOnly()) return;
  const body = JSON.stringify({ data: { ...OB.d, step: OB.step }, rev: OB.rev });
  if (body.length > 60_000) return; // keepalive prima najviše 64 KB; ostalo je već sačuvano usput
  try { fetch('/api/portal/onboarding', { method: 'PUT', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body }); } catch {}
});
addEventListener('beforeunload', (e) => { if (OB.d && (OB.dirty || OB.saving) && !readOnly()) { e.preventDefault(); e.returnValue = ''; } });

function renderOnboarding() {
  // Late saves and uploads may finish after the client has opened another tab.
  if (P.tab !== 'onboarding' || !hasDraftOnboarding()) return;
  if (!OB.d) obInit();
  if (!document.getElementById('ob-editor')) app.innerHTML = '<div id="ob-editor"></div><div class="wrap" id="ob-preview-host"></div>';
  const editor = document.getElementById('ob-editor');
  const restoreImages = JLUI.images(editor);
  const { client, session } = P.me;
  const banner = session.kind === 'view-as' ? `<div class="viewas"><div class="wrap"><span>Admin view</span><span class="grow">Viewing <b>${esc(client.name)}</b>'s onboarding, read-only: nothing you change here is saved.</span><button class="btn warn" data-act="exit">Exit view</button></div></div>` : '';
  const steps = OB_STEPS.map(([k, l], i) => `<button class="ob-dot ${i === OB.step ? 'now' : i < OB.step ? 'done' : ''}" data-ob-go="${i}" ${i > OB.step && !(obCan(0) && obCan(1)) ? 'disabled' : ''}><span>${i + 1}</span>${esc(l)}</button>`).join('');
  editor.innerHTML = `
    ${banner}
    <header class="head"><div class="wrap">
      <div class="client">${client.logo || OB.d.store.logo ? `<img src="${esc(OB.d.store.logo || client.logo)}" alt="" />` : ''}<div><h1 data-store-heading>${esc(OB.d.store.name || client.name)}</h1><small>Store setup</small></div></div>
      <span class="ob-status" id="ob-status"></span>
    </div></header>
    <main class="wrap ob">
      ${portalTabs()}
      <nav class="ob-steps">${steps}</nav>
      <section class="ob-card">${obStepView()}</section>
      <div class="ob-nav">
        ${OB.step > 0 ? '<button class="btn" data-ob-act="back">Back</button>' : '<span></span>'}
        ${OB.step < OB_STEPS.length - 1 ? `<button class="btn primary" data-ob-act="next" ${obCan(OB.step) ? '' : 'disabled'}>Continue</button>` : ''}
      </div>
      <p class="note">Everything saves automatically. You can close this page and come back with the same link.</p>
    </main>`;
  restoreImages();
  if (!document.getElementById('ob-preview-frame')) document.getElementById('ob-preview-host').innerHTML = `
      <section class="ob-preview" aria-label="Live form preview">
        <div class="ob-preview-bar"><div><h2>Your customer form</h2><p>Updates as you make choices. Notes to our team stay private.</p></div><label class="ob-bg"><span>Your website background</span><input type="color" data-preview-bg value="${esc(obPreviewBackground())}" /></label></div>
        <p class="ob-preview-hint">Try a background like your website. This setting only changes this preview.</p>
        <div class="ob-preview-stage" id="ob-preview-stage" style="background:${esc(obPreviewBackground())}"><iframe id="ob-preview-frame" src="/f/onboarding-preview?preview=1&onboarding=1" title="Your live customer form"></iframe></div>
        <p class="ob-err" id="ob-preview-error" role="status"></p>
      </section>`;
  syncPreviewBackground();
  queueOnboardingPreview();
  obStatus();
}

function obPreviewBackground() {
  return OB.previewBg || (OB.d?.store.theme === 'light' ? '#faf7f2' : '#070b0c');
}
function syncPreviewBackground() {
  const color = obPreviewBackground();
  const stage = document.getElementById('ob-preview-stage');
  if (stage) stage.style.background = color;
  const picker = document.querySelector('[data-preview-bg]');
  if (picker) picker.value = color;
}

function queueOnboardingPreview() {
  clearTimeout(OB.previewTimer);
  const seq = ++OB.previewSeq;
  OB.previewTimer = setTimeout(async () => {
    if (!OB.d) return;
    try {
      const { form } = await api('/api/portal/onboarding/preview', { method: 'POST', body: JSON.stringify({ data: OB.d }), json: true });
      if (seq !== OB.previewSeq || !OB.d) return;
      const jump = {};
      if (OB.previewStep !== OB.step) {
        const target = OB.step === 2 ? 'style' : OB.step === 3 ? 'design' : 'type';
        const step = form.steps.findIndex((s) => s.id === target);
        if (step >= 0) jump.step = step;
        const type = form.steps.find((s) => s.id === 'type')?.fields.find((f) => f.id === 'type')?.options[0]?.value;
        if (type) jump.answers = { type };
        OB.previewStep = OB.step;
      }
      document.getElementById('ob-preview-frame')?.contentWindow.postMessage({ type: 'aik:preview', form, admin: false, soft: true, ...jump }, location.origin);
      const err = document.getElementById('ob-preview-error'); if (err) err.textContent = '';
    } catch { const err = document.getElementById('ob-preview-error'); if (err) err.textContent = 'Preview could not update. Your answers are still here; keep editing to retry.'; }
  }, 220);
}
addEventListener('message', (e) => {
  const frame = document.getElementById('ob-preview-frame');
  if (!frame || e.origin !== location.origin || e.source !== frame.contentWindow) return;
  if (e.data?.type === 'aik:preview-ready') { OB.previewStep = -1; queueOnboardingPreview(); }
  if (e.data?.type === 'aik:resize' && Number.isFinite(e.data.height) && e.data.height > 0) frame.style.height = `${Math.max(640, Math.ceil(e.data.height) + 2)}px`;
});

// Može dalje: radnja treba ime, a "What you make" bar jedan komad.
function obCan(i) {
  if (i === 0) return !!String(OB.d.store.name || '').trim();
  if (i === 1) return OB.d.pieces.length > 0;
  return true;
}

const obPick = (path, { label = 'Upload photo', cls = '' } = {}) => {
  const v = obGet(path);
  const owner = path === 'store.logo' ? '' : obGet(path.replace(/\.image$/, ''))?.uid || '';
  const busy = OB.uploads.has(owner || path);
  return `<label class="ob-photo ${cls} ${v ? 'has' : ''} ${busy ? 'jl-uploading' : ''}" title="${v ? 'Change photo or drop a new one' : 'Upload or drop a photo'}">${v ? `<img src="${esc(v)}" alt="" />` : `<span><b>${esc(label)}</b><small>or drag & drop here</small></span>`}<input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp" data-ob-file="${path}" data-uid="${esc(owner)}" ${readOnly() || busy ? 'disabled' : ''} />${busy ? '<span class="jl-upload-progress" role="status"><span class="jl-spinner"></span>Uploading photo…</span>' : ''}</label>`;
};

function obStepView() {
  const d = OB.d;
  const defs = P.me.onboardingDefaults;
  const key = OB_STEPS[OB.step][0];
  if (key === 'store') {
    return `
      <h2>Welcome! Let's set up your design form.</h2>
      <p class="ob-lead">A few questions about your store and what you make. It takes about 10 minutes, and we turn your answers into the form your customers will use.</p>
      <div class="ob-grid2">
        <label class="ob-f"><span>Store name</span><input class="in" data-ob="store.name" value="${esc(d.store.name)}" placeholder="Northstar Jewelers" /></label>
        <label class="ob-f"><span>Website</span><input class="in" data-ob="store.website" value="${esc(d.store.website)}" placeholder="northstarjewelers.com" /></label>
      </div>
      <div class="ob-f"><span>Logo</span>${obPick('store.logo', { label: 'Upload logo', cls: 'logo' })}<p class="hint ob-logo-hint">PNG with a transparent background looks best. It shows at the top of your form.</p></div>
      <div class="ob-f"><span>Brand color</span><div class="ob-row">${ACCENTS.map((c) => `<button class="ob-swatch ${d.store.accent.toLowerCase() === c ? 'on' : ''}" style="background:${c}" data-ob-accent="${c}" aria-label="${c}"></button>`).join('')}<label class="ob-swatch custom" title="Your own color"><input type="color" aria-label="Your own color" data-ob="store.accent" value="${esc(d.store.accent)}" /></label></div></div>
      <div class="ob-f"><span>Look</span><div class="ob-row">
        ${[['dark', 'Dark', 'Elegant, like a jewelry case'], ['light', 'Light', 'Bright and clean']].map(([v, l, h]) => `<button class="ob-theme ${d.store.theme === v ? 'on' : ''} ${v}" data-ob-theme="${v}"><i style="--a:${esc(d.store.accent)}"></i><b>${l}</b><small>${h}</small></button>`).join('')}
      </div></div>`;
  }
  if (key === 'pieces') {
    const on = new Set(d.pieces.map((p) => p.value).filter(Boolean));
    const lib = defs.pieces.map((p) => `<button class="ob-piece ${on.has(p.value) ? 'on' : ''}" data-ob-piece="${p.value}" aria-pressed="${on.has(p.value)}"><img src="${esc(p.image || defs.styles[p.value]?.[0]?.image || '')}" alt="" /><b>${esc(p.label)}</b>${on.has(p.value) ? '<i class="ob-selected" aria-hidden="true">✓</i>' : ''}</button>`).join('');
    const custom = d.pieces.map((p, i) => (p.value ? '' : `<div class="ob-custom"><input class="in" data-ob="pieces.${i}.label" value="${esc(p.label)}" /><button class="btn small" data-ob-del-piece="${i}">Remove</button></div>`)).join('');
    return `
      <h2>What do you make?</h2>
      <p class="ob-lead">Pick everything customers can order from you. Next you choose the styles for each one.</p>
      <div class="ob-pieces">${lib}</div>
      ${custom ? `<h3>Your own pieces</h3>${custom}` : ''}
      <button class="btn" data-ob-act="add-piece">+ Add another piece (e.g. Belt buckle)</button>`;
  }
  if (key === 'styles') {
    const blocks = d.pieces.map((p, i) => {
      const cards = (p.styles || []).map((s, j) => {
        const path = `pieces.${i}.styles.${j}`;
        return `
          <div class="ob-style ${s.keep === false ? 'off' : ''}">
            ${obPick(`${path}.image`, { label: 'Add photo' })}
            <input class="in" data-ob="${path}.label" value="${esc(s.label)}" placeholder="Style name" />
            ${s.custom ? `<textarea class="in" data-ob="${path}.note" rows="2" placeholder="What makes it special? (shape, details)">${esc(s.note || '')}</textarea>` : ''}
            <div class="ob-style-foot">
              <label class="ob-check"><span>Offer this</span><input type="checkbox" data-ob-keep="${path}" ${s.keep === false ? '' : 'checked'} /><span class="ob-selected" aria-hidden="true">✓</span></label>
              ${s.custom ? `<button class="link" data-ob-del-style="${i}.${j}">Remove</button>` : ''}
            </div>
          </div>`;
      }).join('');
      return `
        <div class="ob-block">
          <h3>${esc(p.label || 'Piece')}</h3>
          <div class="ob-styles">${cards}<button class="ob-style add" data-ob-add-style="${i}"><span>+</span>Add a style</button></div>
        </div>`;
    }).join('');
    return `
      <h2>Styles</h2>
      <p class="ob-lead">These are the shapes customers pick from. Keep the ones you make, rename them, swap in photos of your own work, or add your signature styles. Your photos also guide the AI, so the previews look like your pieces.</p>
      ${blocks}`;
  }
  if (key === 'materials') {
    const chip = (list, v, label, sw = '') => `<button class="ob-chip ${list.includes(v) ? 'on' : 'off'}" data-ob-toggle="${list === d.metals ? 'metals' : 'stones'}" data-v="${esc(v)}" aria-pressed="${list.includes(v)}">${sw ? `<i style="background:${esc(sw)}"></i>` : ''}${esc(label)}${list.includes(v) ? '<span class="ob-selected" aria-hidden="true">✓</span>' : ''}</button>`;
    return `
      <h2>Materials & budget</h2>
      <p class="ob-lead">Only what you offer will show to customers.</p>
      <div class="ob-f"><span>Metals</span><div class="ob-chips">${[...defs.metals, ...d.customMetals].map((m) => chip(d.metals, m.value, m.label, m.swatch)).join('')}<button class="ob-chip add" data-ob-add-option="metals">+ Add new</button></div></div>
      <div class="ob-f"><span>Stones</span><div class="ob-chips">${[...defs.stones, ...d.customStones].map((s) => chip(d.stones, s.value, s.label)).join('')}<button class="ob-chip add" data-ob-add-option="stones">+ Add new</button></div></div>
      <div class="ob-f"><span>Budget ranges customers can pick</span>
        ${d.budgets.map((b, i) => `<div class="ob-custom"><input class="in" data-ob="budgets.${i}" value="${esc(b)}" /><button class="btn small" data-ob-del-budget="${i}" ${d.budgets.length < 2 ? 'disabled' : ''}>Remove</button></div>`).join('')}
        <button class="btn small" data-ob-act="add-budget">+ Add range</button></div>`;
  }
  if (key === 'extras') {
    return `
      <h2>Notes for our team</h2>
      <p class="ob-lead">Optional. Tell our team anything we should keep in mind. These notes will not appear in your customer form.</p>
      ${d.questions ? `<p class="hint">Your earlier question requests are saved for our team: ${esc(d.questions)}</p>` : ''}
      <label class="ob-f"><span>Notes for our team</span><textarea class="in" rows="4" data-ob="notes" placeholder="e.g. We don't do platinum grillz. Our minimum order is $800.">${esc(d.notes || '')}</textarea></label>`;
  }
  const kept = (p) => (p.styles || []).filter((s) => s.keep !== false && s.label);
  return `
    <h2>Review & send</h2>
    <p class="ob-lead">Check everything once. After you send it, we build your form and it appears in this portal.</p>
    <dl class="ob-review">
      <dt>Store</dt><dd>${esc(d.store.name)}${d.store.website ? ` · ${esc(d.store.website)}` : ''} · ${d.store.theme === 'light' ? 'Light' : 'Dark'} look <i class="ob-dotc" style="background:${esc(d.store.accent)}"></i></dd>
      <dt>Pieces & styles</dt><dd>${d.pieces.map((p) => `<b>${esc(p.label)}</b>: ${kept(p).map((s) => esc(s.label)).join(', ') || '<span class="faint">no styles, customers describe their idea</span>'}`).join('<br />')}</dd>
      <dt>Metals</dt><dd>${esc([...defs.metals, ...d.customMetals].filter((m) => d.metals.includes(m.value)).map((m) => m.label).join(', ') || 'All')}</dd>
      <dt>Stones</dt><dd>${esc([...defs.stones, ...d.customStones].filter((s) => d.stones.includes(s.value)).map((s) => s.label).join(', ') || 'All')}</dd>
      <dt>Budgets</dt><dd>${esc(d.budgets.filter(Boolean).join(' · '))}</dd>
      ${d.notes ? `<dt>Notes</dt><dd>${esc(d.notes)}</dd>` : ''}
    </dl>
    ${OB.err ? `<p class="ob-err">${esc(OB.err)}</p>` : ''}
    <button class="btn primary big" data-ob-act="send" ${readOnly() || OB.uploads.size || OB.submitting ? 'disabled' : ''}>${OB.submitting ? '<span class="jl-spinner"></span> Sending…' : OB.uploads.size ? 'Waiting for photo upload…' : 'Send to our team'}</button>`;
}

// Fotografija: smanji u browseru (logo 600 px PNG, ostalo 1200 px WebP), pa u R2.
async function obUpload(input) {
  const file = input.files[0];
  if (!file || readOnly() || OB.submitting) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return JLUI.alert('Please choose a JPG, PNG or WebP photo.');
  if (file.size > 20 * 1024 * 1024) return JLUI.alert('Please choose a photo smaller than 20 MB.');
  const isLogo = input.dataset.obFile === 'store.logo';
  const label = input.closest('.ob-photo');
  const owner = input.dataset.uid || input.dataset.obFile;
  if (OB.uploads.has(owner)) return;
  OB.uploads.set(owner, true);
  input.disabled = true;
  JLUI.uploadBusy(label, true);
  try {
    let blob = file;
    try {
      const bmp = await createImageBitmap(file);
      const max = isLogo ? 600 : 1200;
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      blob = (await new Promise((r) => c.toBlob(r, isLogo ? 'image/png' : 'image/webp', 0.86))) || file;
    } catch {}
    const fd = new FormData();
    fd.set('file', blob, isLogo ? 'logo.png' : 'photo.webp');
    const res = await fetch('/api/portal/onboarding/upload', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    const loaded = new Image(); loaded.src = data.url;
    try { await loaded.decode(); } catch {}
    // Slika ide stilu po njegovom id-ju (ne po rednom broju, koji se može promijeniti dok slika putuje).
    const id = input.dataset.uid;
    if (!id) obSet('store.logo', data.url);
    else {
      const st = OB.d?.pieces.flatMap((pc) => pc.styles || []).find((x) => x.uid === id);
      if (st) st.image = data.url;
    }
    obSave(true);
  } catch (e) {
    JLUI.alert(e.message);
  } finally { OB.uploads.delete(owner); JLUI.uploadBusy(label, false); input.disabled = readOnly(); input.value = ''; if (OB.d) { const y = scrollY; renderOnboarding(); scrollTo(0, y); } }
}

app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.previewBg !== undefined) { OB.previewBg = el.value; syncPreviewBackground(); return; }
  if (!OB.d || !el.dataset.ob) return;
  if (readOnly() || OB.submitting) return;
  obSet(el.dataset.ob, el.value);
  if (el.dataset.ob === 'store.accent') document.querySelectorAll('.ob-swatch.on').forEach((x) => x.classList.remove('on'));
  if (el.dataset.ob === 'store.name') { const heading = document.querySelector('[data-store-heading]'); if (heading) heading.textContent = el.value || P.me.client.name; }
  if (el.dataset.ob === 'store.name' || el.dataset.ob === 'store.accent') { const n = document.querySelector('[data-ob-act="next"]'); if (n) n.disabled = !obCan(OB.step); }
  obSave();
  queueOnboardingPreview();
});
app.addEventListener('change', (e) => {
  const el = e.target;
  if (!OB.d) return;
  if (el.dataset.obFile) obUpload(el);
  if (el.dataset.obKeep && !readOnly() && !OB.submitting) { obSet(`${el.dataset.obKeep}.keep`, el.checked); el.closest('.ob-style')?.classList.toggle('off', !el.checked); obSave(); queueOnboardingPreview(); }
});
app.addEventListener('click', async (e) => {
  if (!OB.d) return;
  const t = e.target.closest('button');
  if (!t) return;
  if (OB.submitting) return;
  if (readOnly() && t.dataset.obAct !== 'next' && t.dataset.obAct !== 'back' && t.dataset.obGo === undefined) return;
  const d = OB.d;
  const defs = P.me.onboardingDefaults;
  const redraw = () => { obSave(); const y = scrollY; renderOnboarding(); scrollTo(0, y); };
  if (t.dataset.obGo !== undefined) { OB.step = +t.dataset.obGo; obSave(true); renderOnboarding(); scrollTo(0, 0); return; }
  const act = t.dataset.obAct;
  if (act === 'next' && obCan(OB.step)) { OB.step++; obSave(true); renderOnboarding(); scrollTo(0, 0); }
  if (act === 'back') { OB.step--; obSave(true); renderOnboarding(); scrollTo(0, 0); }
  if (t.dataset.obAccent) { d.store.accent = t.dataset.obAccent; redraw(); }
  if (t.dataset.obTheme) { d.store.theme = t.dataset.obTheme; redraw(); }
  if (t.dataset.obAddOption) {
    const kind = t.dataset.obAddOption;
    const listKey = kind === 'metals' ? 'customMetals' : 'customStones';
    if (d[listKey].length >= 6) return JLUI.alert('You can add up to 6 custom options.');
    const answer = kind === 'metals'
      ? await JLUI.material('Name the metal and choose its circle color.', { title: 'Add a metal' })
      : await JLUI.prompt('Name of the stone (e.g. Ruby)', { title: 'Add a stone' });
    const label = typeof answer === 'string' ? answer : answer?.label;
    if (!label) return;
    const existing = [...defs[kind], ...d[listKey]].find((x) => x.label.toLowerCase() === label.toLowerCase());
    if (existing) { if (!d[kind].includes(existing.value)) d[kind].push(existing.value); }
    else { const value = `custom-${uid()}`; d[listKey].push({ value, label: label.slice(0, 40), ...(kind === 'metals' ? { swatch: answer.swatch } : {}) }); d[kind].push(value); }
    redraw();
  }
  if (t.dataset.obPiece) {
    const v = t.dataset.obPiece;
    const i = d.pieces.findIndex((p) => p.value === v);
    if (i >= 0) {
      const custom = (d.pieces[i].styles || []).some((s) => s.custom || (s.image && !s.image.startsWith('/library/')));
      if (custom && !(await JLUI.confirm('Remove this piece and the styles and photos you added for it?'))) return;
      d.pieces.splice(i, 1);
    } else {
      const p = defs.pieces.find((x) => x.value === v);
      d.pieces.push({ uid: uid(), value: v, label: p.label, styles: (defs.styles[v] || []).map((s) => ({ ...s, uid: uid(), keep: true })) });
    }
    redraw();
  }
  if (act === 'add-piece') {
    const name = await JLUI.prompt('What is the piece called? (e.g. Belt buckle)');
    if (!name?.trim()) return;
    d.pieces.push({ uid: uid(), value: '', label: name.trim().slice(0, 60), styles: [] });
    redraw();
  }
  if (t.dataset.obDelPiece) { d.pieces.splice(+t.dataset.obDelPiece, 1); redraw(); }
  if (t.dataset.obAddStyle !== undefined) {
    const p = d.pieces[+t.dataset.obAddStyle];
    (p.styles ||= []).push({ uid: uid(), value: '', label: '', image: '', note: '', custom: true, keep: true });
    redraw();
    const inputs = document.querySelectorAll(`[data-ob^="pieces.${t.dataset.obAddStyle}.styles."][data-ob$=".label"]`);
    inputs[inputs.length - 1]?.focus();
  }
  if (t.dataset.obDelStyle) { const [i, j] = t.dataset.obDelStyle.split('.').map(Number); d.pieces[i].styles.splice(j, 1); redraw(); }
  if (t.dataset.obToggle) {
    const list = d[t.dataset.obToggle];
    const v = t.dataset.v;
    const k = list.indexOf(v);
    if (k >= 0) list.splice(k, 1); else list.push(v);
    redraw();
  }
  if (act === 'add-budget') { d.budgets.push(''); redraw(); document.querySelectorAll('[data-ob^="budgets."]').forEach((x, k, all) => k === all.length - 1 && x.focus()); }
  if (t.dataset.obDelBudget) { d.budgets.splice(+t.dataset.obDelBudget, 1); redraw(); }
  if (act === 'send') {
    if (OB.uploads.size) return JLUI.alert('Wait for your photos to finish uploading before sending.');
    if (!(await JLUI.confirm('Send your answers to our team? You won\'t be able to edit them here after that, but you can always message us changes.'))) return;
    OB.submitting = true;
    OB.err = '';
    t.disabled = true;
    t.innerHTML = '<span class="jl-spinner"></span> Sending…';
    try {
      // Prvo sačekaj čuvanje koje je već krenulo, pa pošalji zadnju verziju, pa tek onda Send.
      clearTimeout(OB.timer);
      clearTimeout(OB.retry);
      if (OB.inflight) await OB.inflight;
      const r = await api('/api/portal/onboarding/submit', { method: 'POST', body: JSON.stringify({ data: { ...OB.d, step: OB.step }, rev: OB.rev }), json: true });
      OB.rev = r.rev ?? OB.rev;
      OB.dirty = false;
      clearTimeout(OB.timer); clearTimeout(OB.retry); clearTimeout(OB.previewTimer);
      P.me.onboarding.status = r.status || 'submitted';
      OB.d = null;
      render();
      scrollTo(0, 0);
    } catch (err) {
      // Izgubljen odgovor poslije uspješnog upisa: provjeri status prije nego ponudimo ponovno slanje.
      try {
        const me = await api('/api/portal/me');
        if (me.onboarding?.status && me.onboarding.status !== 'draft') { P.me = me; OB.dirty = false; OB.d = null; render(); return; }
      } catch {}
      OB.err = err.message === 'Something went wrong. Please try again.' ? 'Your answers are still here. We could not send them just now. Please try Send again.' : err.message;
      OB.submitting = false;
      renderOnboarding();
    } finally { OB.submitting = false; }
  }
});
