// JewelryLead Builder: klijenti (zlatari) -> forme iz šablona -> uređivanje bez koda, sa živim pregledom.
// Čuvanje forme: PUT /api/admin/forms/:id (server provjerava validateFormDef). Klijent: PUT /api/admin/clients/:id.

const ICONS = {
  pendant: '<path d="M8 6c4 9 9 14 16 14s12-5 16-14"/><path d="M24 20v4"/><path d="M24 24l-7 8 7 11 7-11z"/><path d="M17 32h14M24 24v19"/>',
  chain: '<ellipse cx="9" cy="24" rx="6" ry="4"/><ellipse cx="19" cy="24" rx="4" ry="6"/><ellipse cx="29" cy="24" rx="6" ry="4"/><ellipse cx="39" cy="24" rx="4" ry="6"/>',
  ring: '<circle cx="24" cy="31" r="12"/><circle cx="24" cy="31" r="9"/><path d="M18 14l3-5h6l3 5-6 6z"/><path d="M18 14h12"/>',
  grillz: '<path d="M7 17c0 11 8 17 17 17s17-6 17-17z"/><path d="M13 18v8M18.5 18v12M24 18v13M29.5 18v12M35 18v8"/>',
  bracelet: '<ellipse cx="24" cy="24" rx="17" ry="11"/><ellipse cx="24" cy="24" rx="12" ry="6.5"/>',
  earrings: '<circle cx="14" cy="9" r="3"/><path d="M14 12v4"/><path d="M14 16l-5 8 5 11 5-11z"/><circle cx="34" cy="9" r="3"/><path d="M34 12v4"/><path d="M34 16l-5 8 5 11 5-11z"/>',
  watch: '<rect x="14" y="14" width="20" height="20" rx="6"/><path d="M18 14l2-9h8l2 9M18 34l2 9h8l2-9"/><path d="M24 19v5l4 3"/>',
  gem: '<path d="M14 8h20l8 11-18 22L6 19z"/><path d="M6 19h36M18 8l-4 11 10 22 10-22-4-11"/>',
};
// Male ikonice za dugmad u zaglavlju (24x24, linija).
const NAV = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  open: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const nav = (n) => `<svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${NAV[n]}</svg>`;
// Logo vodi na početnu stranicu sajta (landing), u istom tabu.
const homeLogo = () => `<a class="logo" href="/" title="Go to the JewelryLead homepage">${icon('gem')} JewelryLead <small>Builder</small></a>`;
// Padajući meni sa natpisom iznad vrijednosti i strelicom.
const pick = (label, id, opts) => `<label class="dd"><span>${label}</span><select class="form-select" id="${id}" aria-label="${label}">${opts}</select></label>`;

const icon = (n) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ICONS.gem}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'item';
const key = (s) => slug(s).replace(/-/g, '_');
const uniq = (base, taken) => { let v = base; let i = 2; while (taken.has(v)) v = `${base}-${i++}`; return v; };
const hex6 = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000');
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const CHOICE = ['cards', 'chips', 'yesno', 'dropdown'];

const THEME_KEYS = [
  ['accent', 'Accent'], ['accent-ink', 'Text on accent'], ['bg', 'Background'], ['surface', 'Cards'], ['surface-2', 'Cards, hover'],
  ['line', 'Borders'], ['line-strong', 'Strong borders'], ['ink', 'Text'], ['ink-soft', 'Secondary text'], ['ink-faint', 'Muted text'],
];
const PRESETS = {
  Turquoise: { accent: '#35d0c4', 'accent-ink': '#032220', bg: '#070b0c', surface: '#10171a', 'surface-2': '#152024', line: '#1f2c30', 'line-strong': '#34464b', ink: '#eef6f5', 'ink-soft': '#9fb3b1', 'ink-faint': '#627674' },
  Gold: { accent: '#d8b46a', 'accent-ink': '#17130c', bg: '#0c0b0a', surface: '#151311', 'surface-2': '#1d1a17', line: '#2c2823', 'line-strong': '#4a4238', ink: '#f4efe6', 'ink-soft': '#a59d90', 'ink-faint': '#6f685e' },
  Rose: { accent: '#e7a9a0', 'accent-ink': '#2a1210', bg: '#0d0a0a', surface: '#171112', 'surface-2': '#201819', line: '#302526', 'line-strong': '#4d3c3d', ink: '#f6eeec', 'ink-soft': '#b3a2a0', 'ink-faint': '#7a6967' },
  Light: { accent: '#0f8f86', 'accent-ink': '#ffffff', bg: '#faf7f2', surface: '#ffffff', 'surface-2': '#f3eee6', line: '#e6dfd3', 'line-strong': '#cfc4b3', ink: '#1d1a16', 'ink-soft': '#5f574c', 'ink-faint': '#8d8477' },
};
const TABS = [['client', 'Client'], ['brand', 'Brand'], ['pieces', 'Pieces & styles'], ['questions', 'Questions'], ['texts', 'Texts'], ['embed', 'Embed'], ['history', 'History'], ['json', 'JSON']];
const FIELD_TYPES = [['chips', 'Choice (chips)'], ['cards', 'Choice (big cards)'], ['yesno', 'Yes / No'], ['dropdown', 'Dropdown'], ['text', 'Short text'], ['textarea', 'Long text'], ['upload', 'Photo upload'], ['teeth', 'Teeth picker (grillz)']];

const app = document.getElementById('app');
const B = {
  token: store.get('aik_admin') || '', clients: [], forms: [], templates: [], clientId: null, id: null, draft: null, saved: '',
  client: null, clientSaved: '', tab: store.get('aik_builder_tab') || 'client', piece: null, device: 'desktop', open: new Set([0]), status: '', kind: '',
  view: 'hub', overview: { stats: {}, links: {} }, q: '',
};

// ---------- API ----------
async function api(path, opts = {}) {
  const headers = { 'x-admin-token': B.token, ...(opts.body && !(opts.body instanceof FormData) ? { 'content-type': 'application/json' } : {}) };
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
  return data;
}

// ---------- Putanje u nacrtu (client.* ide na klijenta, ostalo na formu) ----------
const root = (path) => (path.startsWith('client.') ? [B, path] : [B.draft, path]);
const getP = (path) => { const [o, p] = root(path); return p.split('.').reduce((x, k) => x?.[k], o); };
function setP(path, v) {
  const [o, p] = root(path);
  const ks = p.split('.');
  const last = ks.pop();
  const t = ks.reduce((x, k) => x[k], o);
  if (v === undefined || v === '') delete t[last]; else t[last] = v;
}
function typeLoc() {
  for (let si = 0; si < B.draft.steps.length; si++) {
    const fi = B.draft.steps[si].fields.findIndex((f) => f.id === 'type');
    if (fi >= 0) return { si, fi, path: `steps.${si}.fields.${fi}`, field: B.draft.steps[si].fields[fi], step: B.draft.steps[si] };
  }
  return null;
}
const allFieldIds = () => new Set(B.draft.steps.flatMap((s) => s.fields.map((f) => f.id)));
const dirty = () => B.draft && JSON.stringify(B.draft) !== B.saved;
const clientDirty = () => B.client && JSON.stringify(B.client) !== B.clientSaved;
// Arhivirane forme i klijenti se ne nude u editoru; pregled ih prikazuje samo na zahtjev.
const clientForms = (cid, withArchived = false) => B.forms.filter((f) => (f.clientId || null) === (cid || null) && (withArchived || !f.archivedAt));
const activeClients = () => B.clients.filter((c) => !c.archivedAt);
const tplLabel = (k) => B.templates.find((t) => t.key === k)?.label || 'Custom';

// ---------- Start ----------
boot();
async function boot() {
  if (!B.token) return login();
  try { await loadAll(); } catch (e) { if (e.status === 403) return login('Wrong token.'); throw e; }
}

function login(msg = '') {
  app.innerHTML = `<div class="center"><form class="box" id="login"><div class="logo">${icon('gem')} JewelryLead <small>Builder</small></div><p class="lead" style="margin-top:14px">Sign in with the admin token.</p><input class="in" type="password" placeholder="ADMIN_TOKEN" autofocus /><p class="err-text">${esc(msg)}</p><button class="btn primary" style="width:100%">Sign in</button></form></div>`;
  app.querySelector('#login').onsubmit = (e) => {
    e.preventDefault();
    B.token = app.querySelector('input').value.trim();
    store.set('aik_admin', B.token);
    boot();
  };
}

async function refreshLists() {
  const [d, o] = await Promise.all([api('/api/admin/forms'), api('/api/admin/overview')]);
  B.clients = d.clients;
  B.forms = d.forms;
  B.templates = d.templates;
  B.pieces = d.pieces || [];
  B.overview = o;
}

// Start na pregledu svih formi; nova forma (formId) ili zadnji otvoren editor idu pravo u editor.
async function loadAll(formId) {
  await refreshLists();
  if (!formId && store.get('aik_builder_view') !== 'editor') return renderHub();
  const want = formId || store.get('aik_builder_form');
  const f = B.forms.find((x) => x.id === want) || B.forms.find((x) => x.clientId) || B.forms[0];
  await openForm(f.id, true);
}

function setClient(cid) {
  B.clientId = cid || null;
  const c = B.clients.find((x) => x.id === cid);
  B.client = c ? structuredClone(c) : null;
  B.clientSaved = JSON.stringify(B.client);
}

async function openForm(id, force = false) {
  if (!force && (dirty() || clientDirty()) && !confirm('You have unsaved changes. Discard them?')) { if (B.view === 'editor') renderTop(); return; }
  const { form } = await api(`/api/admin/forms/${id}`);
  B.id = id;
  B.draft = form;
  B.saved = JSON.stringify(form);
  setClient(form.clientId);
  B.view = 'editor';
  store.set('aik_builder_view', 'editor');
  B.piece = typeLoc()?.field.options[0]?.value || null;
  B.open = new Set([0]);
  store.set('aik_builder_form', id);
  setStatus('');
  renderShell();
}

// ---------- Pregled svih formi (po klijentima) ----------
const statOf = (id) => B.overview.stats[id] || { leads: 0, renders: 0, cost: 0, lastLead: null };
const day = (t) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const usd = (n) => `$${(n || 0).toFixed((n || 0) < 1 ? 3 : 2)}`;

function renderHub() {
  B.view = 'hub';
  store.set('aik_builder_view', 'hub');
  const all = B.forms.map((f) => statOf(f.id));
  const archivedCount = B.forms.filter((f) => f.archivedAt).length + B.clients.filter((c) => c.archivedAt).length;
  const sum = (k) => all.reduce((t, s) => t + (s[k] || 0), 0);
  app.innerHTML = `
    <div class="hub">
      <header class="top">
        ${homeLogo()}
        <input class="in hub-q" data-hub-q type="search" placeholder="Search clients and forms" value="${esc(B.q)}" aria-label="Search" />
        <div class="spacer"></div>
        <button class="nav-btn" data-act="new-client">${nav('plus')}New project</button>
        <button class="nav-btn" data-act="new-form">${nav('plus')}New form</button>
        <a class="nav-btn hi" href="/admin" target="_blank" rel="noopener">${nav('list')}<span>Leads</span></a>
        ${B.id ? `<button class="btn primary save" data-act="back-editor">Back to editor${dirty() || clientDirty() ? ' (unsaved)' : ''}</button>` : ''}
      </header>
      <main class="hub-main">
        <h2>All projects</h2>
        <p class="lead">Every project (client) and their forms. AI cost is visible only here and in the admin, never to the client.</p>
        <div class="hub-stats">
          <div><span>Projects</span><b>${activeClients().length}</b></div>
          <div><span>Forms</span><b>${B.forms.filter((f) => !f.archivedAt).length}</b></div>
          <div><span>Leads</span><b>${sum('leads')}</b></div>
          <div><span>AI renders</span><b>${sum('renders')}</b></div>
          <div><span>AI cost</span><b>${usd(sum('cost'))}</b></div>
        </div>
        <div id="hub-list"></div>
        ${archivedCount ? `<button class="btn small ghost" data-act="toggle-archived">${B.showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}</button>` : ''}
      </main>
    </div>`;
  renderHubList();
}

function renderHubList() {
  const q = B.q.trim().toLowerCase();
  const arch = !!B.showArchived;
  const groups = [...B.clients.filter((c) => arch || !c.archivedAt).map((c) => ({ c, forms: clientForms(c.id, arch) })), { c: null, forms: clientForms(null, arch) }].filter((g) => g.c || g.forms.length);
  const hit = (s) => String(s || '').toLowerCase().includes(q);
  const shown = groups
    .map((g) => ({ ...g, forms: !q || hit(g.c?.name) || hit(g.c?.website) ? g.forms : g.forms.filter((f) => hit(f.name) || hit(f.id)) }))
    .filter((g) => !q || g.forms.length || hit(g.c?.name));
  document.getElementById('hub-list').innerHTML = shown.map(({ c, forms }) => {
    const link = c && B.overview.links[c.id];
    const rows = forms.map((f) => {
      const s = statOf(f.id);
      return `<tr class="${f.archivedAt ? 'archived' : ''}">
        <td><button class="linkish" data-act="open-form" data-id="${esc(f.id)}">${esc(f.name || f.id)}</button><small>${f.archivedAt ? `Archived ${esc(day(f.archivedAt))} · ` : ''}${esc(f.builtin ? 'Built-in demo' : tplLabel(f.template))} · ${esc(f.id)}</small></td>
        <td class="num">${s.leads}</td><td class="num">${s.renders}</td><td class="when">${esc(day(s.lastLead)) || '<span class="faint">none</span>'}</td><td class="num">${usd(s.cost)}</td>
        <td class="acts"><button class="btn small" data-act="open-form" data-id="${esc(f.id)}">Edit</button><a class="btn small ghost" href="/f/${esc(f.id)}" target="_blank" rel="noopener">Open ↗</a><button class="btn small ghost" data-act="copy-text" data-text="${esc(snippetFor(f.id))}">Copy embed</button>${f.archivedAt ? `<button class="btn small" data-act="restore-form" data-id="${esc(f.id)}">Restore</button>` : f.builtin ? '' : `<button class="btn small ghost danger" data-act="archive-form" data-id="${esc(f.id)}" title="Hide it and stop new leads. Nothing is deleted.">Archive</button>`}</td>
      </tr>`;
    }).join('');
    return `<section class="hub-client ${c?.archivedAt ? 'archived' : ''}">
      <div class="hub-head">
        ${c?.logo ? `<img src="${esc(c.logo)}" alt="" />` : `<span class="hub-mono">${esc((c?.name || '?').slice(0, 1))}</span>`}
        <div class="grow"><b>${esc(c ? c.name : 'Unassigned')}</b><small>${c ? [c.website, `${forms.length} form${forms.length === 1 ? '' : 's'}`].filter(Boolean).map(esc).join(' · ') : 'Forms without a client'}</small></div>
        ${c?.archivedAt ? `<span class="pill">Archived ${esc(day(c.archivedAt))}</span><button class="btn small" data-act="restore-client" data-cid="${esc(c.id)}">Restore client</button>` : ''}
        ${c && !c.archivedAt ? `<span class="pill ${link ? 'pill-def' : ''}" title="${link ? `Active since ${esc(day(link.createdAt))}` : 'The client has no portal link yet'}">${link ? 'Portal link on' : 'No portal link'}</span>
          <button class="btn small ghost" data-act="portal-link" data-cid="${esc(c.id)}">Portal link</button>
          <button class="btn small ghost" data-act="view-as" data-cid="${esc(c.id)}">View as client ↗</button>
          <button class="btn small" data-act="new-form" data-cid="${esc(c.id)}">+ Form</button>
          <button class="btn small ghost danger" data-act="archive-client" data-cid="${esc(c.id)}" title="Hide the client and their forms, turn off the portal link. Nothing is deleted.">Archive</button>` : ''}
      </div>
      ${rows ? `<div class="table-wrap"><table class="hub-table"><colgroup><col /><col style="width:70px" /><col style="width:84px" /><col style="width:120px" /><col style="width:90px" /><col style="width:320px" /></colgroup><thead><tr><th>Form</th><th class="num">Leads</th><th class="num">Renders</th><th>Last lead</th><th class="num">AI cost</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="hint" style="margin:0">No forms yet.</p>'}
    </section>`;
  }).join('') || '<p class="hint">Nothing matches your search.</p>';
}

async function archiveForm(id, on) {
  const f = B.forms.find((x) => x.id === id);
  if (on && !confirm(`Archive "${f?.name || id}"?\n\nIt disappears from the lists and stops taking new leads (the embedded form shows "not available"). Leads and renders stay. You can restore it anytime.`)) return;
  try {
    await api(`/api/admin/forms/${id}/archive`, { method: 'POST', body: JSON.stringify({ archived: on }) });
    await refreshLists();
    renderHub();
  } catch (err) { alert(err.message); }
}

async function archiveClient(cid, on) {
  const c = B.clients.find((x) => x.id === cid);
  if (on && !confirm(`Archive ${c?.name || cid}?\n\nTheir forms are archived too and stop taking new leads, and their portal link is turned off. Leads and renders stay. Restore brings the client and those forms back (a new portal link is needed).`)) return;
  try {
    await api(`/api/admin/clients/${cid}/archive`, { method: 'POST', body: JSON.stringify({ archived: on }) });
    await refreshLists();
    renderHub();
  } catch (err) { alert(err.message); }
}

// Link za portal klijenta: vidi se samo jednom; novi link gasi stari.
function portalLink(cid) {
  const c = B.clients.find((x) => x.id === cid);
  if (!c) return;
  const d = document.createElement('dialog');
  const body = () => {
    const link = B.overview.links[cid];
    return `<h2>Portal link</h2>
      <p class="lead">${esc(c.name)} opens their own portal with this link: leads, renders, photos and their forms with embed code. No AI costs. No password, so anyone with the link sees their leads: send it only to the client.</p>
      <p class="hint" id="pl-state">${link ? `A link is active since ${esc(day(link.createdAt))}. For safety it is shown only once. If it was lost, create a new one: the old one stops working.` : 'No active link yet.'}</p>
      <div id="pl-out"></div>
      <p class="err-text"></p>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">
        ${link ? '<button class="btn danger" data-pl="off">Turn off link</button>' : ''}
        <button class="btn" data-pl="close">Close</button>
        <button class="btn primary" data-pl="new">${link ? 'New link' : 'Create link'}</button>
      </div>`;
  };
  d.innerHTML = body();
  document.body.appendChild(d);
  const after = () => { if (B.view === 'hub') renderHubList(); else if (B.tab === 'client') renderPane(); };
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pl]');
    if (!b) return;
    const err = d.querySelector('.err-text');
    try {
      if (b.dataset.pl === 'close') return d.close();
      if (b.dataset.pl === 'copy') { await navigator.clipboard.writeText(d.querySelector('#pl-url').value); b.textContent = 'Copied'; return; }
      if (b.dataset.pl === 'off') {
        if (!confirm(`Turn off ${c.name}'s portal link? It stops working right away.`)) return;
        await api(`/api/admin/clients/${cid}/portal-link`, { method: 'DELETE' });
        delete B.overview.links[cid];
        after();
        return d.close();
      }
      if (b.dataset.pl === 'new') {
        if (B.overview.links[cid] && !confirm('Create a new link? The old link stops working right away.')) return;
        const r = await api(`/api/admin/clients/${cid}/portal-link`, { method: 'POST' });
        B.overview.links[cid] = { createdAt: r.createdAt };
        d.innerHTML = body();
        d.querySelector('#pl-state').textContent = 'New link, valid for one year. Copy it now and send it to the client: it is not shown again.';
        d.querySelector('#pl-out').innerHTML = `<div class="pick-row" style="margin-top:10px"><input class="in" id="pl-url" readonly value="${esc(r.url)}" /><button class="btn small primary" data-pl="copy">Copy</button></div>`;
        d.querySelector('#pl-url').select();
        after();
      }
    } catch (x) { err.textContent = x.message; }
  });
  d.addEventListener('close', () => d.remove());
  d.showModal();
}

// ---------- Okvir ----------
function renderShell() {
  app.innerHTML = `
    <div class="shell">
      <header class="top" id="top"></header>
      <div class="main">
        <section class="editor">
          <nav class="tabs" id="tabs"></nav>
          <div class="pane" id="pane"></div>
        </section>
        <section class="preview">
          <div class="pbar" id="pbar"></div>
          <div class="pstage"><iframe id="frame" class="pframe ${B.device === 'mobile' ? 'mobile' : ''}" src="/f/${esc(B.id)}?preview=1&t=${Date.now()}" title="Live preview"></iframe></div>
        </section>
      </div>
    </div>`;
  renderTop();
  renderTabs();
  renderPane();
}

function renderTop() {
  const cOpts = activeClients().map((c) => `<option value="${esc(c.id)}" ${c.id === B.clientId ? 'selected' : ''}>${esc(c.name)} (${clientForms(c.id).length})</option>`).join('')
    + (clientForms(null).length ? `<option value="" ${!B.clientId ? 'selected' : ''}>Unassigned (${clientForms(null).length})</option>` : '');
  const fOpts = clientForms(B.clientId).map((f) => `<option value="${esc(f.id)}" ${f.id === B.id ? 'selected' : ''}>${esc(f.name || f.id)}${f.builtin ? ' (built-in)' : ''}</option>`).join('');
  document.getElementById('top').innerHTML = `
    ${homeLogo()}
    <button class="nav-btn" data-act="hub" title="All projects and their forms">${nav('grid')}All projects</button>
    ${pick('Project', 'client-select', cOpts)}
    <button class="nav-add" data-act="new-client" title="New project (client)" aria-label="New project">${nav('plus')}</button>
    ${pick('Form', 'form-select', fOpts)}
    <button class="nav-add" data-act="new-form" title="New form for this project" aria-label="New form">${nav('plus')}</button>
    <div class="spacer"></div>
    <span class="status ${B.kind}" id="status">${esc(B.status)}</span>
    ${B.client ? `<button class="nav-btn hi" data-act="view-as" title="Open ${esc(B.client.name)}'s portal as they see it (logged, 1 hour)">${nav('eye')}<span>View as client</span></button>` : ''}
    <a class="nav-btn hi" href="/admin" target="_blank" rel="noopener" title="All leads and renders">${nav('list')}<span>Leads</span></a>
    <a class="nav-btn hi" href="/f/${esc(B.id)}" target="_blank" rel="noopener" title="Open this form as customers see it">${nav('open')}<span>Open form</span></a>
    <button class="btn primary save" data-act="save" id="save-btn" ${dirty() ? '' : 'disabled'}>Save</button>`;
  document.getElementById('form-select').onchange = (e) => openForm(e.target.value);
  document.getElementById('client-select').onchange = (e) => {
    const first = clientForms(e.target.value || null)[0];
    if (first) openForm(first.id);
    else { setClient(e.target.value); B.tab = 'client'; renderTop(); renderTabs(); renderPane(); }
  };
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = TABS.map(([k, l]) => `<button class="tab ${B.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${l}</button>`).join('');
}

function renderPbar() {
  const steps = B.draft.steps.map((s, i) => `<button class="btn small ${s.enabled === false ? 'off' : ''}" data-act="jump" data-i="${i}" ${s.enabled === false ? 'disabled title="Step is off"' : ''}>${i + 1}. ${esc(s.label || s.title)}</button>`).join('');
  document.getElementById('pbar').innerHTML = `
    <span class="label">Preview</span>
    <button class="btn small ${B.device === 'desktop' ? 'on' : ''}" data-act="device" data-d="desktop">Desktop</button>
    <button class="btn small ${B.device === 'mobile' ? 'on' : ''}" data-act="device" data-d="mobile">Mobile</button>
    <span class="label" style="margin-left:10px">Jump to</span>${steps}
    <button class="btn small" data-act="jump" data-i="${B.draft.steps.length}">Contact</button>
    <button class="btn small primary" data-act="test-render" title="Renders this draft with the answers you clicked in the preview. Costs one render, no lead is created.">Test render</button>`;
}

function renderPane() {
  const pane = document.getElementById('pane');
  const top = pane.scrollTop;
  const views = { client: clientView, brand: brandView, pieces: piecesView, questions: questionsView, texts: textsView, embed: embedView, history: historyView, json: jsonView };
  pane.innerHTML = (views[B.tab] || brandView)();
  pane.scrollTop = top;
  renderPbar();
}

// ---------- Pomoćni prikazi ----------
const inp = (path, label, { kind = 'text', hint = '', ph = '', type = 'text' } = {}) => {
  const v = getP(path);
  return `<label class="f"><span>${esc(label)}</span><input class="in" type="${type}" data-bind="${path}" data-kind="${kind}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" />${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</label>`;
};
const area = (path, label, { kind = 'text', hint = '', ph = '' } = {}) => {
  const v = getP(path);
  const val = kind === 'lines' ? (v || []).join('\n') : v ?? '';
  return `<label class="f"><span>${esc(label)}</span><textarea class="ta" data-bind="${path}" data-kind="${kind}" placeholder="${esc(ph)}">${esc(val)}</textarea>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</label>`;
};
const toggle = (path, label, { invert = false, title = '' } = {}) => {
  const v = getP(path);
  const on = invert ? v !== false : !!v;
  return `<label class="check" title="${esc(title)}"><input type="checkbox" data-bind="${path}" data-kind="${invert ? 'notfalse' : 'bool'}" ${on ? 'checked' : ''} /> ${esc(label)}</label>`;
};
// Slika sa uploadom (data-upload = putanja gdje ide URL; data-scope = forms ili clients)
const imgPick = (path, { scope = 'forms', size = 'sm', empty = 'Image' } = {}) => {
  const v = getP(path);
  return `<label class="pick ${size}" title="${v ? 'Replace image' : 'Upload image'}">${v ? `<img src="${esc(v)}" alt="" />` : `<span>${esc(empty)}</span>`}<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-upload="${path}" data-scope="${scope}" /></label>${v ? `<button class="icon-btn danger" title="Remove image" data-act="unset" data-path="${path}">✕</button>` : ''}`;
};
const snippetFor = (id) => {
  const o = location.origin.replace('//builder.', '//');
  return `<div id="jewelrylead-${id}"></div>\n<script src="${o}/embed.js" data-form="${id}" data-target="jewelrylead-${id}" async></script>`;
};

// ---------- Kartice ----------
function clientView() {
  if (!B.client) {
    return `<h2>Client</h2><p class="lead">This form does not belong to a client yet.</p>
      ${B.clients.length ? `<label class="f"><span>Move this form to</span><select class="sel" data-act-change="move-form"><option value="">Choose a client…</option>${B.clients.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>` : ''}
      <button class="btn small" data-act="new-client">+ New client</button>`;
  }
  const forms = clientForms(B.client.id).map((f) => `
    <div class="card ${f.id === B.id ? 'sel' : ''}">
      <div class="card-head"><div class="grow"><b>${esc(f.name || f.id)}</b><p class="hint" style="margin:2px 0 0">${esc(tplLabel(f.template))} · id: ${esc(f.id)}</p></div>
        ${f.id === B.id ? '<span class="pill">Editing</span>' : `<button class="btn small" data-act="open-form" data-id="${esc(f.id)}">Edit</button>`}
        <button class="btn small" data-act="copy-text" data-text="${esc(snippetFor(f.id))}">Copy embed</button>
      </div>
    </div>`).join('');
  return `
    <h2>${esc(B.client.name)}</h2>
    <p class="lead">Client details and all of their forms. The logo is used for new forms.</p>
    <div class="row">${inp('client.name', 'Client name')}${inp('client.website', 'Website', { ph: 'northstarjewelers.com' })}</div>
    <div class="f"><span>Logo</span><div class="pick-row">${imgPick('client.logo', { scope: 'clients', size: 'logo', empty: 'Upload logo' })}</div><p class="hint">PNG, JPG or WebP. Shown in the form header instead of the store name.</p></div>
    ${area('client.notes', 'Notes (internal)')}
    <div class="pick-row"><button class="btn small ${clientDirty() ? 'primary' : ''}" data-act="save-client" ${clientDirty() ? '' : 'disabled'}>Save client</button><button class="btn small" data-act="view-as">View as client ↗</button></div>
    <p class="hint">"View as client" opens their portal (leads and forms) exactly as they see it, for one hour. Every view is logged.</p>
    <h3>Client portal</h3>
    <p class="hint" style="margin-bottom:10px">${B.overview.links[B.client.id] ? `Portal link active since ${esc(day(B.overview.links[B.client.id].createdAt))}.` : 'No portal link yet.'} With the link the client sees their leads, renders and forms on their own, without AI costs.</p>
    <button class="btn small" data-act="portal-link" data-cid="${esc(B.client.id)}">Portal link…</button>
    <h3>Forms (${clientForms(B.client.id).length})</h3>
    ${forms || '<p class="hint">No forms yet.</p>'}
    <button class="btn small" data-act="new-form">+ New form for ${esc(B.client.name)}</button>`;
}

function brandView() {
  const d = B.draft;
  const colors = THEME_KEYS.map(([k, l]) => `<label class="color"><input type="color" data-bind="theme.${k}" data-kind="color" value="${hex6(d.theme?.[k])}" /><span>${l}</span><input class="in" data-bind="theme.${k}" data-kind="color" value="${esc(d.theme?.[k] || '')}" /></label>`).join('');
  const presets = Object.entries(PRESETS).map(([n, t]) => `<button class="preset" data-act="preset" data-p="${n}"><i style="background:linear-gradient(135deg, ${t.accent} 50%, ${t.bg} 50%)"></i>${n}</button>`).join('');
  const clientOpts = B.clients.map((c) => `<option value="${esc(c.id)}" ${c.id === d.clientId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  return `
    <h2>Brand &amp; look</h2>
    <p class="lead">${esc(tplLabel(d.template))} form. How it looks and behaves.</p>
    <div class="row">${inp('name', 'Internal name')}${inp('brand.name', 'Store name (shown in the form)')}</div>
    <div class="f"><span>Logo in the form header</span><div class="pick-row">${imgPick('brand.logo', { size: 'logo', empty: 'Upload logo' })}${B.client?.logo && B.client.logo !== d.brand.logo ? `<button class="btn small" data-act="use-client-logo">Use client logo</button>` : ''}</div></div>
    <div class="row">
      ${inp('maxRenders', 'Previews per customer', { kind: 'number', type: 'number', hint: 'First render plus refinements, 1 to 10.' })}
      ${inp('background', 'Render background', { ph: 'deep charcoal black', hint: 'Backdrop of the AI renders.' })}
    </div>
    <label class="f"><span>Client</span><select class="sel" data-bind="clientId" data-rerender>${d.clientId ? '' : '<option value="">No client</option>'}${clientOpts}</select></label>
    <h3>Theme</h3>
    <div class="presets">${presets}</div>
    <div class="colors">${colors}</div>`;
}

function piecesView() {
  const loc = typeLoc();
  if (!loc) return '<p class="note">This form has no piece question ("type").</p>';
  const opts = loc.field.options;
  if (!opts.some((o) => o.value === B.piece)) B.piece = opts[0]?.value;
  const list = opts.map((o, k) => `
    <div class="piece ${o.value === B.piece ? 'sel' : ''}" data-act="pick-piece" data-v="${esc(o.value)}">
      ${o.image ? `<img class="piece-img" src="${esc(o.image)}" alt="" />` : icon(o.icon)}
      <div><b>${esc(o.label)}</b><small>${(B.draft.styles?.[o.value] || []).length} styles · id: ${esc(o.value)}</small></div>
      <span>
        <button class="icon-btn" title="Move up" data-act="move" data-path="${loc.path}.options" data-i="${k}" data-d="-1">↑</button>
        <button class="icon-btn" title="Move down" data-act="move" data-path="${loc.path}.options" data-i="${k}" data-d="1">↓</button>
        <button class="icon-btn danger" title="Remove piece" data-act="del-piece" data-v="${esc(o.value)}">✕</button>
      </span>
    </div>`).join('');

  const k = opts.findIndex((o) => o.value === B.piece);
  let editor = '';
  if (k >= 0) {
    const op = `${loc.path}.options.${k}`;
    const o = opts[k];
    const styles = B.draft.styles?.[o.value] || [];
    const iconSel = Object.keys(ICONS).map((n) => `<option ${o.icon === n ? 'selected' : ''}>${n}</option>`).join('');
    const cards = styles.map((s, j) => `
      <div class="style">
        <label class="img" title="Upload image">
          ${s.image ? `<img src="${esc(s.image)}" alt="" />` : '<span class="empty">No image yet<br />Click to upload</span>'}
          <span class="up">Replace image</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-upload="styles.${o.value}.${j}.image" data-scope="forms" />
        </label>
        <div class="body">
          <input class="in" data-bind="styles.${o.value}.${j}.label" value="${esc(s.label)}" placeholder="Style name" />
          <textarea class="ta" data-bind="styles.${o.value}.${j}.shape" placeholder="Shape for the AI, e.g. thick interlocking oval links with a box clasp">${esc(s.shape || '')}</textarea>
          <div class="tools">
            <span><button class="icon-btn" title="Move left" data-act="move" data-path="styles.${o.value}" data-i="${j}" data-d="-1">←</button><button class="icon-btn" title="Move right" data-act="move" data-path="styles.${o.value}" data-i="${j}" data-d="1">→</button></span>
            <button class="icon-btn danger" title="Remove style" data-act="del" data-path="styles.${o.value}" data-i="${j}">✕</button>
          </div>
        </div>
      </div>`).join('');
    editor = `
      <div class="card sel" style="margin-top:16px">
        <div class="row">${inp(`${op}.label`, 'Name shown to customers')}<label class="f"><span>Icon</span><select class="sel" data-bind="${op}.icon" data-rerender>${iconSel}</select></label></div>
        <div class="f"><span>Card image (optional, replaces the icon)</span><div class="pick-row">${imgPick(`${op}.image`)}</div></div>
        ${area(`${op}.subject`, 'How the AI should describe this piece', { ph: 'e.g. a custom western belt buckle, oval, front view', hint: 'Optional for built-in pieces (pendant, chain, ring, grillz, bracelet, earrings, watch). Needed for new ones.' })}
      </div>
      <h3>Styles for ${esc(o.label)}</h3>
      <p class="hint" style="margin:-6px 0 12px">Customers pick one of these. The picture also guides the AI's shape, so photos of the jeweler's own pieces work best. "Something else" is added automatically.</p>
      <div class="styles">${cards}</div>
      <button class="btn small" style="margin-top:12px" data-act="add-style">+ Add style</button>
      ${(() => { const si = styleStepIndex(); const sj = si >= 0 ? B.draft.steps[si].fields.findIndex((f) => f.optionsFrom?.styles) : -1; return sj >= 0 ? `<div class="toggles" style="margin-top:14px">${otherToggle(si, sj)}</div>` : ''; })()}`;
  }
  const single = opts.length === 1 ? `<p class="note">One piece only, so the piece step is ${loc.step.enabled === false ? 'hidden and the piece is picked automatically' : 'shown'}. Turn it on or off in Questions.</p>` : '';
  return `
    <h2>Pieces &amp; styles</h2>
    <p class="lead">What customers can design, and the style pictures that guide the AI.</p>
    ${single}
    <div class="pieces">${list}</div>
    <button class="btn small" style="margin-top:10px" data-act="add-piece">+ Add piece</button>
    ${editor}`;
}

// "Something else" na kraju liste stilova: kupac opisuje svoj stil. Uključeno dok se ne isključi.
const otherToggle = (i, j) => toggle(`steps.${i}.fields.${j}.other`, 'Offer "Something else" at the end of the styles', { invert: true, title: 'Lets customers describe a style that is not in the list.' });

function questionsView() {
  const tl = typeLoc();
  const steps = B.draft.steps.map((s, i) => {
    const isType = s.fields.some((f) => f.id === 'type');
    const locked = isType || s.fields.some((f) => f.optionsFrom);
    const canToggle = !isType || tl.field.options.length === 1;
    const builtinStep = s.fields.some((f) => f.builtin);
    const sj = s.fields.findIndex((f) => f.optionsFrom?.styles);
    const fields = locked
      ? `<p class="note">Choices for this step are managed in <b>Pieces &amp; styles</b>.</p>${sj >= 0 ? `<div class="toggles">${otherToggle(i, sj)}</div>` : ''}`
      : s.fields.map((f, j) => fieldEditor(i, j, f)).join('') + `<button class="btn small" data-act="add-field" data-i="${i}">+ Add question</button>`;
    return `
      <details class="step ${s.enabled === false ? 'is-off' : ''}" data-step="${i}" ${B.open.has(i) ? 'open' : ''}>
        <summary>
          <span class="num">${i + 1}</span><span class="grow"><b>${esc(s.label || s.title)}</b>${s.label && s.title ? `<small>${esc(s.title)}</small>` : ''}</span>
          ${s.enabled === false ? '<span class="pill">Off</span>' : ''}<span class="pill">${s.fields.length} ${s.fields.length === 1 ? 'question' : 'questions'}</span>
          <button class="icon-btn" title="Move up" data-act="move" data-path="steps" data-i="${i}" data-d="-1">↑</button>
          <button class="icon-btn" title="Move down" data-act="move" data-path="steps" data-i="${i}" data-d="1">↓</button>
          ${locked || builtinStep ? '' : `<button class="icon-btn danger" title="Remove step" data-act="del" data-path="steps" data-i="${i}" data-confirm="Remove this step and its questions?">✕</button>`}
        </summary>
        <div class="step-body">
          <div class="toggles">${canToggle ? toggle(`steps.${i}.enabled`, 'Show this step', { invert: true, title: isType ? 'With one piece the step can be hidden; the piece is picked automatically.' : '' }) : '<span class="hint">Piece step stays on while there is more than one piece.</span>'}
            ${toggle(`steps.${i}.autoAdvance`, 'Go to the next step right after a choice')}</div>
          <div class="row">${inp(`steps.${i}.title`, 'Title')}${inp(`steps.${i}.label`, 'Progress label')}</div>
          ${inp(`steps.${i}.subtitle`, 'Subtitle')}
          ${fields}
        </div>
      </details>`;
  }).join('');
  return `
    <h2>Questions</h2>
    <p class="lead"><b>Default</b> questions come from the template: turn them off or make them required, the AI understands them. <b>Custom</b> questions are yours: any type, options with images and AI notes, an optional follow-up.</p>
    ${steps}
    <button class="btn small" data-act="add-step">+ Add step</button>`;
}

function fieldEditor(i, j, f) {
  const p = `steps.${i}.fields.${j}`;
  const def = !!f.builtin;
  const typeSel = FIELD_TYPES.map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${l}</option>`).join('');
  let extra = '';
  if (f.type === 'text' || f.type === 'textarea') {
    extra = `<div class="row">${inp(`${p}.placeholder`, 'Placeholder')}${inp(`${p}.max`, 'Max length', { kind: 'optnum', type: 'number' })}</div>`;
  } else if (f.type === 'upload') {
    extra = inp(`${p}.hint`, 'Hint under the upload');
  } else if (f.type === 'teeth') {
    extra = '<p class="hint">Customers tap the teeth they want or pick a set (Single, 2 Piece, Classic 6, 8 Top, 6 on 6, Full Set). The AI gets the exact teeth.</p>';
  } else if (f.type !== 'yesno') {
    const chips = f.type === 'chips';
    const rows = (f.options || []).map((o, k) => `
      <div class="opt2">
        <div class="opt2-main">
          <span class="pick-row">${imgPick(`${p}.options.${k}.image`, { empty: '+' })}</span>
          <input class="in" data-bind="${p}.options.${k}.label" value="${esc(o.label)}" title="id: ${esc(o.value)}" placeholder="Option" />
          ${chips ? `<span class="sw"><input type="color" data-bind="${p}.options.${k}.swatch" data-kind="color" value="${hex6(o.swatch)}" title="Color dot (optional)" /><input class="in" data-bind="${p}.options.${k}.swatch" data-kind="optcolor" value="${esc(o.swatch || '')}" placeholder="no color" /></span>` : ''}
          <span class="nowrap"><button class="icon-btn" data-act="move" data-path="${p}.options" data-i="${k}" data-d="-1" title="Move up">↑</button><button class="icon-btn danger" data-act="del" data-path="${p}.options" data-i="${k}" title="Remove option">✕</button></span>
        </div>
        <input class="in note-in" data-bind="${p}.options.${k}.note" value="${esc(o.note || '')}" placeholder="AI note when chosen (optional), e.g. open face: only the outline of each tooth is covered" />
      </div>`).join('');
    extra = `<p class="hint" style="margin:0">Options · the image is shown to customers, the AI note goes to the AI</p><div class="opts">${rows}</div><button class="btn small" data-act="add-option" data-path="${p}">+ Add option</button>`;
  }
  const follow = CHOICE.includes(f.type)
    ? `<label class="f"><span>Follow-up after a choice</span><select class="sel" data-bind="${p}.followup" data-rerender><option value="">None</option><option value="text" ${f.followup === 'text' ? 'selected' : ''}>"Add details" text box</option><option value="file" ${f.followup === 'file' ? 'selected' : ''}>"Add a photo" upload</option></select></label>`
    : '';
  // Uslov prikaza: samo polja sa izborom koja su prije ovog
  const before = B.draft.steps.slice(0, i + 1).flatMap((s, si) => s.fields.filter((x, fj) => (si < i || fj < j) && CHOICE.includes(x.type) && x.options));
  const c = f.showIf;
  const condSel = `<option value="">Always</option>` + before.map((x) => `<option value="${esc(x.id)}" ${c?.field === x.id ? 'selected' : ''}>When "${esc(x.label || x.id)}"…</option>`).join('');
  let condVals = '';
  if (c) {
    const src = before.find((x) => x.id === c.field);
    const list = c.in || c.notIn || [];
    condVals = `<div class="cond-vals">${(src?.options || []).map((o) => `<label class="check"><input type="checkbox" data-cond-val="${p}" value="${esc(o.value)}" ${list.includes(o.value) ? 'checked' : ''} /> ${esc(o.label)}</label>`).join('')}</div>`;
  }
  return `
    <div class="field ${f.enabled === false ? 'is-off' : ''}" data-si="${i}" data-fid="${esc(f.id)}">
      <div class="card-head"><div class="grow"><b>${esc(f.label || f.id)}</b></div>
        <span class="pill ${def ? 'pill-def' : 'pill-cus'}">${def ? 'Default' : 'Custom'}</span>
        <button class="icon-btn" data-act="move" data-path="steps.${i}.fields" data-i="${j}" data-d="-1" title="Move up">↑</button>
        <button class="icon-btn" data-act="move" data-path="steps.${i}.fields" data-i="${j}" data-d="1" title="Move down">↓</button>
        ${def ? '' : `<button class="icon-btn danger" data-act="del" data-path="steps.${i}.fields" data-i="${j}" data-confirm="Remove this question?" title="Remove">✕</button>`}
      </div>
      <div class="toggles">
        ${toggle(`${p}.enabled`, 'On', { invert: true })}
        ${toggle(`${p}.required`, 'Required')}
        ${f.id === 'budget' ? '<span class="hint" title="The render is designed at the top of the chosen range, so it never looks cheaper than the budget. Explicit choices (metal, stones) come first.">Guides the render (top of range)</span>' : f.type !== 'upload' ? toggle(`${p}.ai`, 'Send to AI', { invert: true, title: 'Off for questions that only matter to the jeweler (molds, timeline).' }) : ''}
      </div>
      <div class="row">${inp(`${p}.label`, 'Question')}${def ? `<label class="f"><span>Type</span><input class="in" value="${esc(FIELD_TYPES.find(([v]) => v === f.type)?.[1] || f.type)}" disabled /></label>` : `<label class="f"><span>Type</span><select class="sel" data-bind="${p}.type" data-rerender data-kind="ftype">${typeSel}</select></label>`}</div>
      ${inp(`${p}.subtitle`, 'Subtitle (optional)')}
      ${extra}
      ${follow}
      <div class="cond"><select class="sel" data-cond-field="${p}">${condSel}</select>${c ? `<select class="sel" data-cond-mode="${p}"><option value="in" ${c.in ? 'selected' : ''}>is one of</option><option value="notIn" ${c.notIn ? 'selected' : ''}>is not one of</option></select>` : ''}</div>
      ${condVals}
    </div>`;
}

function textsView() {
  return `
    <h2>Texts</h2>
    <p class="lead">Contact step and the final preview.</p>
    <h3>Contact step</h3>
    ${inp('contact.title', 'Title')}
    ${inp('contact.subtitle', 'Subtitle')}
    ${area('contact.consent', 'Consent text', { hint: 'Shown next to the required checkbox. Name the jeweler and the ways they may contact the customer.' })}
    ${inp('contact.button', 'Button')}
    <h3>Preview</h3>
    ${area('result.loading', 'Messages while rendering (one per line)', { kind: 'lines' })}
    ${inp('result.done', 'Message under the render')}
    ${area('result.disclaimer', 'Disclaimer under the render')}`;
}

function embedView() {
  const o = location.origin.replace('//builder.', '//');
  const iframe = `<iframe src="${o}/f/${B.id}" style="width:100%;height:900px;border:0" loading="lazy" allow="fullscreen" title="Design your piece"></iframe>`;
  const others = B.client ? clientForms(B.client.id).filter((f) => f.id !== B.id) : [];
  return `
    <h2>Embed</h2>
    <p class="lead">Paste this where the form should appear. The live form always uses the last <b>saved</b> version.</p>
    ${dirty() ? '<p class="note">You have unsaved changes. Save first so the embedded form shows them.</p>' : ''}
    <h3>Recommended snippet</h3>
    <pre class="code">${esc(snippetFor(B.id))}</pre><button class="btn small" data-act="copy-text" data-text="${esc(snippetFor(B.id))}">Copy snippet</button>
    <h3>Plain iframe (Wix and strict builders)</h3>
    <pre class="code">${esc(iframe)}</pre><button class="btn small" data-act="copy-text" data-text="${esc(iframe)}">Copy iframe</button>
    <h3>Direct link</h3>
    <pre class="code">${esc(`${o}/f/${B.id}`)}</pre><button class="btn small" data-act="copy-text" data-text="${esc(`${o}/f/${B.id}`)}">Copy link</button>
    ${others.length ? `<h3>Other forms of ${esc(B.client.name)}</h3>${others.map((f) => `<div class="card"><div class="card-head"><div class="grow"><b>${esc(f.name)}</b><p class="hint" style="margin:2px 0 0">${esc(tplLabel(f.template))}</p></div><button class="btn small" data-act="copy-text" data-text="${esc(snippetFor(f.id))}">Copy embed</button></div></div>`).join('')}` : ''}
    <h3>Where to paste</h3>
    <p class="hint" style="font-size:13px;line-height:1.7"><b>Shopify:</b> Online Store, Customize, add a "Custom Liquid" section.<br /><b>WordPress:</b> a "Custom HTML" block, or the HTML widget in Elementor or Divi.<br /><b>Squarespace / Webflow:</b> a Code or Embed block.<br /><b>Wix:</b> Embed code, use the plain iframe.</p>`;
}

// Istorija verzija: svaki Save čuva prethodnu verziju; učitana verzija postaje nacrt, Save je vraća.
function historyView() {
  const v = B.versions?.id === B.id ? B.versions.list : null;
  if (!v) {
    api(`/api/admin/forms/${B.id}/versions`).then((r) => { B.versions = { id: B.id, list: r.versions }; if (B.tab === 'history') renderPane(); }).catch((e) => setStatus(e.message, 'err'));
    return '<h2>History</h2><p class="lead">Loading…</p>';
  }
  const rows = v.map((x) => `
    <div class="card">
      <div class="card-head"><div class="grow"><b>${x.savedAt ? esc(new Date(x.savedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })) : 'Original built-in version'}</b>
        <p class="hint" style="margin:2px 0 0">${esc(x.steps.join(' → '))}</p></div>
        <button class="btn small" data-act="load-version" data-vid="${esc(x.id)}">Load</button></div>
    </div>`).join('');
  return `
    <h2>History</h2>
    <p class="lead">Every Save keeps the previous version (last 50). Load one to see it in the preview, then Save to make it live again. Nothing changes until you Save.</p>
    ${rows || '<p class="hint">No earlier versions yet. They appear after the next Save.</p>'}`;
}

function jsonView() {
  return `
    <h2>JSON</h2>
    <p class="lead">The full form definition, for bulk edits. Apply, then Save.</p>
    <textarea class="json" id="json" spellcheck="false">${esc(JSON.stringify(B.draft, null, 2))}</textarea>
    <p class="err-text" id="json-err"></p>
    <button class="btn small" data-act="json-apply">Apply</button>`;
}

// ---------- Izmjene ----------
function readBind(el) {
  const kind = el.dataset.kind || 'text';
  if (kind === 'bool') return el.checked || undefined;
  if (kind === 'notfalse') return el.checked ? undefined : false;
  if (kind === 'number') return parseInt(el.value, 10) || 0;
  if (kind === 'optnum') return el.value === '' ? undefined : parseInt(el.value, 10);
  if (kind === 'lines') return el.value.split('\n').map((x) => x.trim()).filter(Boolean);
  if (kind === 'optcolor') return el.value.trim() || undefined;
  return el.value;
}

function changed(rerender = false) {
  updateStatus();
  schedulePreview();
  if (rerender) renderPane();
}

function updateStatus() {
  if (dirty() || clientDirty()) setStatus('Unsaved changes', 'dirty');
  else if (B.kind === 'dirty') setStatus('');
  else setStatus(B.status, B.kind);
}

app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.hubQ !== undefined) { B.q = el.value; renderHubList(); return; }
  if (!el.dataset.bind || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  setP(el.dataset.bind, readBind(el));
  if (el.dataset.kind === 'color' || el.dataset.kind === 'optcolor') {
    app.querySelectorAll(`[data-bind="${el.dataset.bind}"]`).forEach((x) => { if (x !== el) x.value = x.type === 'color' ? hex6(el.value) : el.value; });
  }
  if (el.dataset.bind.startsWith('client.')) { const btn = app.querySelector('[data-act=save-client]'); if (btn) { btn.disabled = !clientDirty(); btn.classList.toggle('primary', !!clientDirty()); } }
  changed();
});

app.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.bind && (el.tagName === 'SELECT' || el.type === 'checkbox')) {
    const v = readBind(el);
    setP(el.dataset.bind, v);
    if (el.dataset.kind === 'ftype') {
      const f = getP(el.dataset.bind.replace(/\.type$/, ''));
      if (v === 'yesno') f.options = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
      else if (CHOICE.includes(v) && !f.options?.length) f.options = [{ value: 'option-1', label: 'Option 1' }];
      if (!CHOICE.includes(v)) { delete f.options; delete f.followup; }
    }
    changed(el.dataset.rerender !== undefined || el.type === 'checkbox');
  } else if (el.dataset.actChange === 'move-form') {
    if (!el.value) return;
    B.draft.clientId = el.value;
    await save();
  } else if (el.dataset.condField) {
    const f = getP(el.dataset.condField);
    if (!el.value) delete f.showIf; else f.showIf = { field: el.value, in: [] };
    changed(true);
  } else if (el.dataset.condMode) {
    const f = getP(el.dataset.condMode);
    const list = f.showIf.in || f.showIf.notIn || [];
    f.showIf = { field: f.showIf.field, [el.value]: list };
    changed(true);
  } else if (el.dataset.condVal) {
    const f = getP(el.dataset.condVal);
    const k = f.showIf.in ? 'in' : 'notIn';
    const set = new Set(f.showIf[k]);
    if (el.checked) set.add(el.value); else set.delete(el.value);
    f.showIf[k] = [...set];
    changed();
  } else if (el.dataset.upload) {
    await upload(el);
  }
});

app.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.matches?.('details.step')) {
    const i = +d.dataset.step;
    if (d.open) B.open.add(i); else B.open.delete(i);
    // Ručno otvoren korak se pokaže u pregledu; otvaranje koje je pokrenuo pregled ne vraća skok nazad.
    if (d.open && !d.dataset.silent) previewTo(i);
    delete d.dataset.silent;
  }
}, true);

app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (el.closest('summary') && el.tagName === 'BUTTON') e.preventDefault();
  const i = +el.dataset.i;
  if (act === 'tab') { B.tab = el.dataset.tab; store.set('aik_builder_tab', B.tab); renderTabs(); renderPane(); }
  if (act === 'save') save();
  if (act === 'save-client') saveClient();
  if (act === 'new-form') newForm(el.dataset.cid || B.client?.id);
  if (act === 'new-client') newClient();
  if (act === 'open-form') openForm(el.dataset.id);
  if (act === 'view-as') viewAs(el.dataset.cid || B.client?.id);
  if (act === 'hub') renderHub();
  if (act === 'back-editor') { B.view = 'editor'; store.set('aik_builder_view', 'editor'); renderShell(); }
  if (act === 'portal-link') portalLink(el.dataset.cid);
  if (act === 'toggle-archived') { B.showArchived = !B.showArchived; renderHub(); }
  if (act === 'archive-form' || act === 'restore-form') archiveForm(el.dataset.id, act === 'archive-form');
  if (act === 'archive-client' || act === 'restore-client') archiveClient(el.dataset.cid, act === 'archive-client');
  if (act === 'load-version') {
    if (dirty() && !confirm('Replace your unsaved changes with this version?')) return;
    try {
      const { form } = await api(`/api/admin/forms/${B.id}/versions/${el.dataset.vid}`);
      B.draft = { ...form, id: B.id };
      changed(true);
      setStatus('Old version loaded. Save to keep it.', 'dirty');
    } catch (err) { setStatus(err.message, 'err'); }
  }
  if (act === 'device') { B.device = el.dataset.d; document.getElementById('frame').classList.toggle('mobile', B.device === 'mobile'); renderPbar(); }
  if (act === 'jump') { pushPreview(i); revealLeft(i); }
  if (act === 'test-render') { pushPreview(); setTimeout(() => document.getElementById('frame')?.contentWindow?.postMessage({ type: 'aik:test' }, location.origin), 80); }
  if (act === 'preset') { B.draft.theme = { ...PRESETS[el.dataset.p] }; changed(true); }
  if (act === 'use-client-logo') { B.draft.brand.logo = B.client.logo; changed(true); }
  if (act === 'unset') { setP(el.dataset.path, undefined); changed(true); }
  if (act === 'pick-piece' && !e.target.closest('button')) {
    B.piece = el.dataset.v;
    renderPane();
    if (styleStepIndex() >= 0) pushPreview(styleStepIndex());
  }
  if (act === 'move') {
    const arr = getP(el.dataset.path);
    const j = i + +el.dataset.d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    changed(true);
  }
  if (act === 'del') {
    if (el.dataset.confirm && !confirm(el.dataset.confirm)) return;
    const arr = getP(el.dataset.path);
    if (arr.length === 1 && /fields$|options$/.test(el.dataset.path)) return alert('Keep at least one. Turn it off instead, or remove the whole step.');
    arr.splice(i, 1);
    changed(true);
  }
  if (act === 'del-piece') {
    const loc = typeLoc();
    if (loc.field.options.length < 2) return alert('A form needs at least one piece.');
    if (!confirm('Remove this piece and its styles?')) return;
    loc.field.options = loc.field.options.filter((o) => o.value !== el.dataset.v);
    if (B.draft.styles) delete B.draft.styles[el.dataset.v];
    if (loc.field.options.length === 1) loc.field.default = loc.field.options[0].value;
    changed(true);
  }
  if (act === 'add-piece') {
    const name = prompt('Piece name, e.g. "Belt buckle"');
    if (!name?.trim()) return;
    const loc = typeLoc();
    const value = uniq(slug(name), new Set(loc.field.options.map((o) => o.value)));
    loc.field.options.push({ value, label: name.trim().slice(0, 60), icon: 'gem', subject: '' });
    // Više od jednog komada: korak izbora mora biti vidljiv, a podrazumijevani komad više ne važi
    delete loc.field.default;
    delete loc.step.enabled;
    B.draft.styles = { ...(B.draft.styles || {}), [value]: [] };
    B.piece = value;
    changed(true);
  }
  if (act === 'add-style') {
    const name = prompt('Style name, e.g. "Miami Cuban"');
    if (!name?.trim()) return;
    B.draft.styles = B.draft.styles || {};
    const list = (B.draft.styles[B.piece] = B.draft.styles[B.piece] || []);
    const value = uniq(slug(name) === 'other' ? 'other-style' : slug(name), new Set(list.map((s) => s.value)));
    list.push({ value, label: name.trim().slice(0, 40), shape: '', image: '' });
    changed(true);
  }
  if (act === 'add-option') {
    const name = prompt('Option name');
    if (!name?.trim()) return;
    const f = getP(el.dataset.path);
    f.options = f.options || [];
    f.options.push({ value: uniq(slug(name), new Set(f.options.map((o) => o.value))), label: name.trim().slice(0, 60) });
    changed(true);
  }
  if (act === 'add-field') {
    const name = prompt('Question, e.g. "Finish"');
    if (!name?.trim()) return;
    B.draft.steps[i].fields.push({ id: uniq(key(name), allFieldIds()), type: 'chips', label: name.trim().slice(0, 120), required: false, options: [{ value: 'option-1', label: 'Option 1' }] });
    changed(true);
  }
  if (act === 'add-step') {
    const name = prompt('Step title, e.g. "Finish & size"');
    if (!name?.trim()) return;
    const ids = new Set(B.draft.steps.map((s) => s.id));
    const title = name.trim().slice(0, 120);
    B.draft.steps.push({ id: uniq(slug(name), ids), label: title.slice(0, 30), title, subtitle: '', fields: [{ id: uniq(key(name), allFieldIds()), type: 'chips', label: title, required: true, options: [{ value: 'option-1', label: 'Option 1' }] }] });
    B.open.add(B.draft.steps.length - 1);
    changed(true);
  }
  if (act === 'copy-text') {
    const label = el.textContent;
    try { await navigator.clipboard.writeText(el.dataset.text); el.textContent = 'Copied'; } catch { el.textContent = 'Copy failed'; }
    setTimeout(() => { el.textContent = label; }, 1400);
  }
  if (act === 'json-apply') {
    try {
      const obj = JSON.parse(document.getElementById('json').value);
      if (obj.id !== B.id) throw new Error(`"id" must stay "${B.id}"`);
      B.draft = obj;
      changed(true);
    } catch (err) { document.getElementById('json-err').textContent = err.message; }
  }
});

// Slika: smanji u browseru (max 1024 px, webp; logo 600 px png), pa pošalji u R2
async function upload(input) {
  const file = input.files[0];
  if (!file) return;
  const isLogo = /logo$/.test(input.dataset.upload);
  setStatus('Uploading…', '');
  try {
    let blob = file;
    try {
      const bmp = await createImageBitmap(file);
      const max = isLogo ? 600 : 1024;
      const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * s);
      c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      blob = (await new Promise((r) => c.toBlob(r, isLogo ? 'image/png' : 'image/webp', 0.86))) || file;
    } catch {}
    const fd = new FormData();
    fd.set('file', blob, isLogo ? 'logo.png' : 'image.webp');
    const scope = input.dataset.scope === 'clients' ? `clients/${B.client.id}` : `forms/${B.id}`;
    const { url } = await api(`/api/admin/${scope}/upload`, { method: 'POST', body: fd });
    setP(input.dataset.upload, url);
    setStatus('');
    changed(true);
  } catch (err) {
    setStatus(err.message, 'err');
  }
}

// ---------- Čuvanje, klijenti, nove forme ----------
async function save() {
  if (!dirty()) return;
  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  setStatus('Saving…', '');
  try {
    await api(`/api/admin/forms/${B.id}`, { method: 'PUT', body: JSON.stringify({ form: B.draft }) });
    B.saved = JSON.stringify(B.draft);
    B.versions = null;
    await refreshLists();
    if ((B.client?.id || null) !== (B.draft.clientId || null)) setClient(B.draft.clientId);
    renderTop();
    setStatus('Saved', 'ok');
    renderPane();
  } catch (err) {
    setStatus(err.message, 'err');
    btn.disabled = false;
  }
}

async function saveClient() {
  if (!clientDirty()) return;
  setStatus('Saving client…', '');
  try {
    await api(`/api/admin/clients/${B.client.id}`, { method: 'PUT', body: JSON.stringify(B.client) });
    B.clientSaved = JSON.stringify(B.client);
    await refreshLists();
    renderTop();
    renderPane();
    setStatus('Client saved', 'ok');
  } catch (err) { setStatus(err.message, 'err'); }
}

function dialog(html, onSubmit) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog">${html}<p class="err-text"></p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" value="cancel" formnovalidate>Cancel</button><button class="btn primary" value="ok">Create</button></div></form>`;
  document.body.appendChild(d);
  d.querySelector('form').addEventListener('submit', async (e) => {
    if (e.submitter?.value !== 'ok') return;
    e.preventDefault();
    try { await onSubmit(d); d.close(); } catch (err) { d.querySelector('.err-text').textContent = err.message; }
  });
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}

function newClient() {
  dialog(`<h2>New client</h2>
    <label class="f"><span>Store name</span><input class="in" name="name" required placeholder="Northstar Jewelers" /></label>
    <label class="f"><span>Website (optional)</span><input class="in" name="website" placeholder="northstarjewelers.com" /></label>
    <p class="hint">Next you pick a template for their first form.</p>`, async (d) => {
    const { client } = await api('/api/admin/clients', { method: 'POST', body: JSON.stringify({ name: d.querySelector('[name=name]').value, website: d.querySelector('[name=website]').value }) });
    await refreshLists();
    setTimeout(() => newForm(client.id), 50);
  });
}

function newForm(clientId = B.client?.id) {
  if (!B.clients.length) return newClient();
  const cOpts = activeClients().map((c) => `<option value="${esc(c.id)}" ${c.id === clientId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const tpls = B.templates.map((t, k) => `<label class="tpl"><input type="radio" name="tpl" value="${esc(t.key)}" ${k === 0 ? 'checked' : ''} /><span><b>${esc(t.label)}</b><small>${esc(t.description)}</small></span></label>`).join('');
  const copy = B.forms.filter((f) => !f.builtin).map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
  const pieceOpts = (B.pieces || []).map((p) => `<option value="${esc(p.value)}">${esc(p.label)}</option>`).join('');
  dialog(`<h2>New form</h2>
    <label class="f"><span>Client</span><select class="sel" name="client">${cOpts}</select></label>
    <div class="f"><span>Start from a template</span><div class="tpls">${tpls}
      ${pieceOpts ? `<label class="tpl"><input type="radio" name="tpl" value="__piece" /><span><b>One piece only</b><small>Customers skip the piece question and go straight to styles. Grillz and Ring use their dedicated builders.<select class="sel" name="piece">${pieceOpts}</select></small></span></label>` : ''}
      ${copy ? `<label class="tpl"><input type="radio" name="tpl" value="__copy" /><span><b>Copy an existing form</b><small><select class="sel" name="copy">${copy}</select></small></span></label>` : ''}</div></div>
    <label class="f"><span>Form name (optional)</span><input class="in" name="name" placeholder="e.g. Grillz page" /></label>`, async (d) => {
    const tpl = d.querySelector('[name=tpl]:checked').value;
    const body = { clientId: d.querySelector('[name=client]').value, name: d.querySelector('[name=name]').value };
    if (tpl === '__copy') body.copyFrom = d.querySelector('[name=copy]').value;
    else if (tpl === '__piece') {
      // Grillz i prsten imaju svoje šablone sa posebnim pitanjima; ostali komadi su Custom Enquiry sužen na jedan komad.
      const piece = d.querySelector('[name=piece]').value;
      if (B.templates.some((t) => t.key === piece)) body.template = piece; else { body.template = 'custom-enquiry'; body.piece = piece; }
    } else body.template = tpl;
    const { form } = await api('/api/admin/forms', { method: 'POST', body: JSON.stringify(body) });
    if ((dirty() || clientDirty()) && !confirm('Discard unsaved changes in the current form?')) return;
    await loadAll(form.id);
  });
}

// Portal klijenta u novom tabu: sesija od 1 sat samo za ovog klijenta, upisana u log.
// Prozor se otvara odmah (inače ga blokator iskačućih prozora zaustavi poslije await-a), a adresu dobija kad stigne token.
async function viewAs(cid) {
  if (!cid) return;
  const w = window.open('', '_blank');
  try {
    const r = await api(`/api/admin/clients/${cid}/view-as`, { method: 'POST' });
    store.set('aik_view_as', JSON.stringify({ token: r.token, expiresAt: r.expiresAt }));
    if (w) w.location.href = '/portal'; else location.href = '/portal';
  } catch (err) {
    w?.close();
    setStatus(err.message, 'err');
  }
}

function setStatus(text, kind = '') {
  B.status = text;
  B.kind = kind;
  const s = document.getElementById('status');
  if (s) { s.textContent = text; s.className = `status ${kind}`; }
  const btn = document.getElementById('save-btn');
  if (btn) btn.disabled = !dirty();
}

// ---------- Živi pregled ----------
let pt;
function schedulePreview() { clearTimeout(pt); pt = setTimeout(() => pushPreview(), 250); }
// Skok na korak šalje i izabrani komad, da korak sa stilovima pokaže stilove tog komada.
// soft: skok iz Questions (sinhronizacija) ne mijenja kupčeve odgovore u pregledu, samo dopuni komad ako ga nema.
function pushPreview(step, { soft = false, focus = null } = {}) {
  const frame = document.getElementById('frame');
  const jump = typeof step === 'number' ? { step, answers: { type: B.piece || typeLoc()?.field.options[0]?.value }, soft, focus } : {};
  frame?.contentWindow?.postMessage({ type: 'aik:preview', form: B.draft, ...jump }, location.origin);
}

// ---------- Questions <-> pregled ----------
// Lijevo otvoren korak ili kliknuto pitanje pokaže se desno; korak ili izbor u pregledu otvori i pokaže to pitanje lijevo.
let lastFocus = '';
function previewTo(i, focus = null) {
  if (B.draft.steps[i]?.enabled === false) return; // isključen korak se u pregledu ne vidi
  const key = `${i}:${focus || ''}`;
  if (key === lastFocus) return;
  lastFocus = key;
  pushPreview(i, { soft: true, focus });
}
function revealLeft(i, fid = null) {
  if (B.tab !== 'questions' || i < 0) return;
  const d = document.querySelector(`#pane details.step[data-step="${i}"]`);
  if (!d) return;
  B.open.add(i);
  if (!d.open) { d.dataset.silent = '1'; d.open = true; }
  const el = (fid && d.querySelector(`[data-fid="${CSS.escape(fid)}"]`)) || d;
  lastFocus = `${i}:${fid || ''}`;
  el.scrollIntoView({ block: fid ? 'center' : 'start', behavior: 'smooth' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
}
app.addEventListener('focusin', (e) => {
  const f = B.tab === 'questions' && e.target.closest?.('#pane .field[data-fid]');
  if (f) previewTo(+f.dataset.si, f.dataset.fid);
});
app.addEventListener('pointerdown', (e) => {
  const f = B.tab === 'questions' && e.target.closest?.('#pane .field[data-fid]');
  if (f) previewTo(+f.dataset.si, f.dataset.fid);
});
window.addEventListener('message', (e) => {
  const frame = document.getElementById('frame');
  if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
  if (e.data?.type === 'aik:step') revealLeft(B.draft.steps.findIndex((s) => s.id === e.data.step));
  if (e.data?.type === 'aik:field') revealLeft(B.draft.steps.findIndex((s) => s.fields.some((f) => f.id === e.data.field)), e.data.field);
});
const styleStepIndex = () => B.draft.steps.findIndex((s) => s.fields.some((f) => f.optionsFrom?.styles));
window.addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data?.type === 'aik:preview-ready') pushPreview();
});

window.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (B.view === 'hub') return; if (B.tab === 'client' && clientDirty()) saveClient(); else save(); } });
window.addEventListener('beforeunload', (e) => { if (dirty() || clientDirty()) { e.preventDefault(); e.returnValue = ''; } });

// Logo vodi na početnu: ne izgubi nesačuvane izmjene bez pitanja.
window.addEventListener('beforeunload', (e) => { if (dirty() || clientDirty()) { e.preventDefault(); e.returnValue = ''; } });
