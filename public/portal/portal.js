// Portal klijenta: njegovi leadovi (renderi, odgovori, fotografije) i njegove forme sa embed kodom.
// Sesija: "View as client" iz buildera ostavi token u localStorage, portal ga prebaci u sessionStorage (ovaj tab).
// Klijent dolazi preko svog linka (/portal#k=...): token ide u localStorage, a iz adrese se briše.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (fn) => { try { return fn(); } catch { return null; } };

const P = { token: null, me: null, leads: [], tab: 'leads', form: '', own: false };
const day = (t) => new Date(t).toLocaleDateString('en-US', { dateStyle: 'medium' });

boot();
async function boot() {
  const handoff = safe(() => localStorage.getItem('aik_view_as'));
  if (handoff) {
    safe(() => sessionStorage.setItem('aik_portal', handoff));
    safe(() => localStorage.removeItem('aik_view_as'));
  }
  const k = location.hash.match(/k=([a-z0-9]{20,})/)?.[1];
  if (k) {
    safe(() => localStorage.setItem('aik_client', k));
    history.replaceState(null, '', location.pathname);
  }
  P.token = safe(() => JSON.parse(sessionStorage.getItem('aik_portal') || 'null'))?.token;
  if (!P.token) { P.token = safe(() => localStorage.getItem('aik_client')); P.own = !!P.token; }
  if (!P.token) return ended('Your portal', 'Open the portal link your JewelryLead team sent you.');
  try {
    P.me = await api('/api/portal/me');
    P.leads = (await api('/api/portal/leads')).leads;
  } catch (e) {
    return P.own ? ended('This link no longer works', 'Ask your JewelryLead team for a new portal link.') : ended('Session ended', e.message);
  }
  document.title = `${P.me.client.name} · JewelryLead`;
  render();
  setInterval(tick, 30_000);
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'x-portal-token': P.token, ...(opts.json ? { 'content-type': 'application/json' } : {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function ended(title, text) {
  safe(() => sessionStorage.removeItem('aik_portal'));
  if (P.own) safe(() => localStorage.removeItem('aik_client'));
  app.innerHTML = `<div class="center"><div><h1>${esc(title)}</h1><p style="color:var(--ink-faint)">${esc(text)}</p></div></div>`;
}

const minsLeft = () => Math.max(0, Math.round((P.me.session.expiresAt - Date.now()) / 60000));
function tick() {
  if (Date.now() > P.me.session.expiresAt) {
    return P.own ? ended('This link has expired', 'Ask your JewelryLead team for a new portal link.') : ended('Session ended', 'The admin view lasts one hour. Open it again from the builder.');
  }
  const el = document.getElementById('left');
  if (el) el.textContent = `${minsLeft()} min`;
}

// Slike kupaca traže token u adresi (img ne šalje zaglavlja); renderi su javni po nepogodivom ključu.
const media = (key) => `/media/${key}?t=${encodeURIComponent(P.token)}`;

function render() {
  const { client, forms, stats, session } = P.me;
  // Onboarding u toku: portal je vodič dok zlatar ne pošalje odgovore.
  if (P.me.onboarding?.status === 'draft') return renderOnboarding();
  const banner = session.kind === 'view-as'
    ? `<div class="viewas"><div class="wrap"><span>Admin view</span><span class="grow">Viewing as <b>${esc(client.name)}</b>, exactly as they see it. Ends in <b id="left">${minsLeft()} min</b>.</span><button class="btn warn" data-act="exit">Exit view</button></div></div>`
    : '';
  app.innerHTML = `
    ${banner}
    <header class="head"><div class="wrap">
      <div class="client">${client.logo ? `<img src="${esc(client.logo)}" alt="" />` : ''}<div><h1>${esc(client.name)}</h1><small>${esc(client.website || 'Client portal')}</small></div></div>
      <span class="powered">Powered by <b>JewelryLead</b></span>
      ${session.kind === 'client' ? '<button class="btn" data-act="signout" title="Remove the portal from this device">Sign out</button>' : ''}
    </div></header>
    <main class="wrap">
      <nav class="tabs"><button class="tab ${P.tab === 'leads' ? 'on' : ''}" data-tab="leads">Leads</button><button class="tab ${P.tab === 'forms' ? 'on' : ''}" data-tab="forms">Forms</button></nav>
      <div class="stats">
        <div class="stat">Leads<b>${stats.leads}</b></div>
        <div class="stat">Last 30 days<b>${stats.recent}</b></div>
        <div class="stat">AI renders<b>${stats.renders}</b></div>
        <div class="stat">Live forms<b>${forms.length}</b></div>
      </div>
      ${P.me.onboarding?.status === 'submitted' ? `<div class="ob-sent"><b>Thank you, we have your answers.</b> We are building your form now and it will appear under Forms. Your leads will show up here as soon as customers use it.</div>` : ''}
      ${P.tab === 'leads' ? leadsView() : formsView()}
      <p class="note">Want to change a form, add styles or questions? Contact your JewelryLead team.</p>
    </main>`;
}

function leadsView() {
  if (!P.leads.length) return '<p class="empty">No leads yet. They appear here as soon as a customer finishes one of your forms.</p>';
  const forms = P.me.forms.filter((f) => f.leads);
  const chips = forms.length > 1
    ? `<div class="chips"><button class="chip ${P.form ? '' : 'on'}" data-form="">All forms <span>${P.leads.length}</span></button>${forms.map((f) => `<button class="chip ${P.form === f.id ? 'on' : ''}" data-form="${esc(f.id)}">${esc(f.name)} <span>${P.leads.filter((l) => l.formId === f.id).length}</span></button>`).join('')}</div>`
    : '';
  const list = P.form ? P.leads.filter((l) => l.formId === P.form) : P.leads;
  return chips + list.map((l) => {
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
        <div class="fstats"><span><b>${f.leads}</b> lead${f.leads === 1 ? '' : 's'}</span><span><b>${f.renders}</b> AI render${f.renders === 1 ? '' : 's'}</span><span>Last lead: <b>${f.lastLead ? esc(day(f.lastLead)) : 'none yet'}</b></span>${f.leads ? `<button class="btn" data-see="${esc(f.id)}">See leads</button>` : ''}</div>
        <pre>${esc(snippet)}</pre>
        <button class="btn" data-copy="${esc(snippet)}">Copy embed code</button>
      </div>`;
  }).join('') || '<p class="empty">No forms yet.</p>';
}

app.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.tab) { P.tab = t.dataset.tab; render(); }
  if (t.dataset.form !== undefined) { P.form = t.dataset.form; render(); }
  if (t.dataset.see) { P.tab = 'leads'; P.form = t.dataset.see; render(); }
  if (t.dataset.act === 'signout') {
    if (!confirm('Sign out on this device? You can come back with your portal link.')) return;
    ended('Signed out', 'Open your portal link again to come back.');
  }
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

// ---------- Onboarding (vodič za zlatara) ----------
// Zlatar popuni radnju, komade, stilove sa slikama, materijale i budžet. Sve se čuva samo; Send šalje adminu.
const OB_STEPS = [['store', 'Your store'], ['pieces', 'What you make'], ['styles', 'Styles'], ['materials', 'Materials & budget'], ['extras', 'Anything else'], ['send', 'Review & send']];
const ACCENTS = ['#35d0c4', '#d8b46a', '#e7a9a0', '#9b8cff', '#5aa9ff', '#ef6f6f', '#f2f2f2'];
const OB = { d: null, step: 0, timer: null, saving: false, savedAt: 0, err: '', dirty: false };

function obInit() {
  const defs = P.me.onboardingDefaults;
  const d = structuredClone(P.me.onboarding.data || {});
  d.store = { name: P.me.client.name, website: P.me.client.website || '', accent: '#35d0c4', theme: 'dark', ...(d.store || {}) };
  d.pieces = Array.isArray(d.pieces) ? d.pieces : [];
  d.metals = Array.isArray(d.metals) ? d.metals : defs.metals.map((m) => m.value);
  d.stones = Array.isArray(d.stones) ? d.stones : defs.stones.map((s) => s.value);
  d.budgets = Array.isArray(d.budgets) ? d.budgets : [...defs.budgets];
  OB.d = d;
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
  OB.dirty = true;
  clearTimeout(OB.timer);
  const go = async () => {
    if (OB.saving) { OB.timer = setTimeout(go, 300); return; }
    OB.saving = true;
    OB.dirty = false;
    obStatus();
    try {
      await api('/api/portal/onboarding', { method: 'PUT', body: JSON.stringify({ data: { ...OB.d, step: OB.step } }), json: true });
      OB.savedAt = Date.now();
      OB.err = '';
    } catch (e) { OB.err = e.message; OB.dirty = true; }
    OB.saving = false;
    obStatus();
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
  if (!OB.d || !OB.dirty) return;
  try { fetch('/api/portal/onboarding', { method: 'PUT', keepalive: true, headers: { 'x-portal-token': P.token, 'content-type': 'application/json' }, body: JSON.stringify({ data: { ...OB.d, step: OB.step } }) }); } catch {}
});

function renderOnboarding() {
  if (!OB.d) obInit();
  const { client, session } = P.me;
  const banner = session.kind === 'view-as' ? `<div class="viewas"><div class="wrap"><span>Admin view</span><span class="grow">Viewing <b>${esc(client.name)}</b>'s onboarding as they see it.</span><button class="btn warn" data-act="exit">Exit view</button></div></div>` : '';
  const steps = OB_STEPS.map(([k, l], i) => `<button class="ob-dot ${i === OB.step ? 'now' : i < OB.step ? 'done' : ''}" data-ob-go="${i}" ${i > OB.step && !(obCan(0) && obCan(1)) ? 'disabled' : ''}><span>${i + 1}</span>${esc(l)}</button>`).join('');
  app.innerHTML = `
    ${banner}
    <header class="head"><div class="wrap">
      <div class="client">${client.logo || OB.d.store.logo ? `<img src="${esc(OB.d.store.logo || client.logo)}" alt="" />` : ''}<div><h1>${esc(OB.d.store.name || client.name)}</h1><small>Store setup</small></div></div>
      <span class="ob-status" id="ob-status"></span>
    </div></header>
    <main class="wrap ob">
      <nav class="ob-steps">${steps}</nav>
      <section class="ob-card">${obStepView()}</section>
      <div class="ob-nav">
        ${OB.step > 0 ? '<button class="btn" data-ob-act="back">Back</button>' : '<span></span>'}
        ${OB.step < OB_STEPS.length - 1 ? `<button class="btn primary" data-ob-act="next" ${obCan(OB.step) ? '' : 'disabled'}>Continue</button>` : ''}
      </div>
      <p class="note">Everything saves automatically. You can close this page and come back with the same link.</p>
    </main>`;
  obStatus();
}

// Može dalje: radnja treba ime, a "What you make" bar jedan komad.
function obCan(i) {
  if (i === 0) return !!String(OB.d.store.name || '').trim();
  if (i === 1) return OB.d.pieces.length > 0;
  return true;
}

const obPick = (path, { label = 'Upload photo', cls = '' } = {}) => {
  const v = obGet(path);
  return `<label class="ob-photo ${cls} ${v ? 'has' : ''}" title="${v ? 'Change photo' : 'Upload photo'}">${v ? `<img src="${esc(v)}" alt="" />` : `<span>${esc(label)}</span>`}<input type="file" accept="image/jpeg,image/png,image/webp" data-ob-file="${path}" hidden /></label>`;
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
      <div class="ob-f"><span>Logo</span><div class="ob-row">${obPick('store.logo', { label: 'Upload logo', cls: 'logo' })}<p class="hint">PNG with a transparent background looks best. It shows at the top of your form.</p></div></div>
      <div class="ob-f"><span>Brand color</span><div class="ob-row">${ACCENTS.map((c) => `<button class="ob-swatch ${d.store.accent.toLowerCase() === c ? 'on' : ''}" style="background:${c}" data-ob-accent="${c}" aria-label="${c}"></button>`).join('')}<label class="ob-swatch custom" title="Your own color"><input type="color" data-ob="store.accent" value="${esc(d.store.accent)}" /></label></div></div>
      <div class="ob-f"><span>Look</span><div class="ob-row">
        ${[['dark', 'Dark', 'Elegant, like a jewelry case'], ['light', 'Light', 'Bright and clean']].map(([v, l, h]) => `<button class="ob-theme ${d.store.theme === v ? 'on' : ''} ${v}" data-ob-theme="${v}"><i style="--a:${esc(d.store.accent)}"></i><b>${l}</b><small>${h}</small></button>`).join('')}
      </div></div>`;
  }
  if (key === 'pieces') {
    const on = new Set(d.pieces.map((p) => p.value).filter(Boolean));
    const lib = defs.pieces.map((p) => `<button class="ob-piece ${on.has(p.value) ? 'on' : ''}" data-ob-piece="${p.value}"><img src="${esc(defs.styles[p.value]?.[0]?.image || '')}" alt="" loading="lazy" /><b>${esc(p.label)}</b><i>${on.has(p.value) ? '✓' : '+'}</i></button>`).join('');
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
              <label class="ob-check"><input type="checkbox" data-ob-keep="${path}" ${s.keep === false ? '' : 'checked'} /> Offer this</label>
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
    const chip = (list, v, label, sw = '') => `<button class="ob-chip ${list.includes(v) ? 'on' : ''}" data-ob-toggle="${list === d.metals ? 'metals' : 'stones'}" data-v="${esc(v)}">${sw ? `<i style="background:${esc(sw)}"></i>` : ''}${esc(label)}</button>`;
    return `
      <h2>Materials & budget</h2>
      <p class="ob-lead">Only what you offer will show to customers.</p>
      <div class="ob-f"><span>Metals</span><div class="ob-chips">${defs.metals.map((m) => chip(d.metals, m.value, m.label, m.swatch)).join('')}</div>
        <input class="in" data-ob="metalsOther" value="${esc(d.metalsOther || '')}" placeholder="Other metals, comma separated (e.g. Black gold, Silver)" style="margin-top:10px" /></div>
      <div class="ob-f"><span>Stones</span><div class="ob-chips">${defs.stones.map((s) => chip(d.stones, s.value, s.label)).join('')}</div></div>
      <div class="ob-f"><span>Budget ranges customers can pick</span>
        ${d.budgets.map((b, i) => `<div class="ob-custom"><input class="in" data-ob="budgets.${i}" value="${esc(b)}" /><button class="btn small" data-ob-del-budget="${i}" ${d.budgets.length < 2 ? 'disabled' : ''}>Remove</button></div>`).join('')}
        <button class="btn small" data-ob-act="add-budget">+ Add range</button></div>`;
  }
  if (key === 'extras') {
    return `
      <h2>Anything else?</h2>
      <p class="ob-lead">Optional. Tell us what else you want to know from customers, or anything we should keep in mind.</p>
      <label class="ob-f"><span>Questions you'd like to ask customers</span><textarea class="in" rows="4" data-ob="questions" placeholder="e.g. Ring size? Do you need it by a date? Is it a gift?">${esc(d.questions || '')}</textarea></label>
      <label class="ob-f"><span>Notes for our team</span><textarea class="in" rows="4" data-ob="notes" placeholder="e.g. We don't do platinum grillz. Our minimum order is $800.">${esc(d.notes || '')}</textarea></label>`;
  }
  const kept = (p) => (p.styles || []).filter((s) => s.keep !== false && s.label);
  return `
    <h2>Review & send</h2>
    <p class="ob-lead">Check everything once. After you send it, we build your form and it appears in this portal.</p>
    <dl class="ob-review">
      <dt>Store</dt><dd>${esc(d.store.name)}${d.store.website ? ` · ${esc(d.store.website)}` : ''} · ${d.store.theme === 'light' ? 'Light' : 'Dark'} look <i class="ob-dotc" style="background:${esc(d.store.accent)}"></i></dd>
      <dt>Pieces & styles</dt><dd>${d.pieces.map((p) => `<b>${esc(p.label)}</b>: ${kept(p).map((s) => esc(s.label)).join(', ') || '<span class="faint">no styles, customers describe their idea</span>'}`).join('<br />')}</dd>
      <dt>Metals</dt><dd>${esc([...P.me.onboardingDefaults.metals.filter((m) => d.metals.includes(m.value)).map((m) => m.label), ...String(d.metalsOther || '').split(',').map((x) => x.trim()).filter(Boolean)].join(', ') || 'All')}</dd>
      <dt>Stones</dt><dd>${esc(P.me.onboardingDefaults.stones.filter((s) => d.stones.includes(s.value)).map((s) => s.label).join(', ') || 'All')}</dd>
      <dt>Budgets</dt><dd>${esc(d.budgets.filter(Boolean).join(' · '))}</dd>
      ${d.questions ? `<dt>Questions</dt><dd>${esc(d.questions)}</dd>` : ''}
      ${d.notes ? `<dt>Notes</dt><dd>${esc(d.notes)}</dd>` : ''}
    </dl>
    ${OB.err ? `<p class="ob-err">${esc(OB.err)}</p>` : ''}
    <button class="btn primary big" data-ob-act="send">Send to our team</button>`;
}

// Fotografija: smanji u browseru (logo 600 px PNG, ostalo 1200 px WebP), pa u R2.
async function obUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const isLogo = input.dataset.obFile === 'store.logo';
  const label = input.closest('.ob-photo');
  label?.classList.add('busy');
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
    const res = await fetch('/api/portal/onboarding/upload', { method: 'POST', headers: { 'x-portal-token': P.token }, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    obSet(input.dataset.obFile, data.url);
    obSave(true);
    renderOnboarding();
  } catch (e) {
    alert(e.message);
    label?.classList.remove('busy');
  }
}

app.addEventListener('input', (e) => {
  const el = e.target;
  if (!OB.d || !el.dataset.ob) return;
  obSet(el.dataset.ob, el.value);
  if (el.dataset.ob === 'store.accent') document.querySelectorAll('.ob-swatch.on').forEach((x) => x.classList.remove('on'));
  if (el.dataset.ob === 'store.name' || el.dataset.ob === 'store.accent') { const n = document.querySelector('[data-ob-act="next"]'); if (n) n.disabled = !obCan(OB.step); }
  obSave();
});
app.addEventListener('change', (e) => {
  const el = e.target;
  if (!OB.d) return;
  if (el.dataset.obFile) obUpload(el);
  if (el.dataset.obKeep) { obSet(`${el.dataset.obKeep}.keep`, el.checked); el.closest('.ob-style')?.classList.toggle('off', !el.checked); obSave(); }
});
app.addEventListener('click', async (e) => {
  if (!OB.d) return;
  const t = e.target.closest('button');
  if (!t) return;
  const d = OB.d;
  const defs = P.me.onboardingDefaults;
  const redraw = () => { obSave(); const y = scrollY; renderOnboarding(); scrollTo(0, y); };
  if (t.dataset.obGo !== undefined) { OB.step = +t.dataset.obGo; obSave(true); renderOnboarding(); scrollTo(0, 0); return; }
  const act = t.dataset.obAct;
  if (act === 'next' && obCan(OB.step)) { OB.step++; obSave(true); renderOnboarding(); scrollTo(0, 0); }
  if (act === 'back') { OB.step--; obSave(true); renderOnboarding(); scrollTo(0, 0); }
  if (t.dataset.obAccent) { d.store.accent = t.dataset.obAccent; redraw(); }
  if (t.dataset.obTheme) { d.store.theme = t.dataset.obTheme; redraw(); }
  if (t.dataset.obPiece) {
    const v = t.dataset.obPiece;
    const i = d.pieces.findIndex((p) => p.value === v);
    if (i >= 0) {
      const custom = (d.pieces[i].styles || []).some((s) => s.custom || (s.image && !s.image.startsWith('/library/')));
      if (custom && !confirm('Remove this piece and the styles and photos you added for it?')) return;
      d.pieces.splice(i, 1);
    } else {
      const p = defs.pieces.find((x) => x.value === v);
      d.pieces.push({ value: v, label: p.label, styles: (defs.styles[v] || []).map((s) => ({ ...s, keep: true })) });
    }
    redraw();
  }
  if (act === 'add-piece') {
    const name = prompt('What is the piece called? (e.g. Belt buckle)');
    if (!name?.trim()) return;
    d.pieces.push({ value: '', label: name.trim().slice(0, 60), styles: [] });
    redraw();
  }
  if (t.dataset.obDelPiece) { d.pieces.splice(+t.dataset.obDelPiece, 1); redraw(); }
  if (t.dataset.obAddStyle !== undefined) {
    const p = d.pieces[+t.dataset.obAddStyle];
    (p.styles ||= []).push({ value: '', label: '', image: '', note: '', custom: true, keep: true });
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
    if (!confirm('Send your answers to our team? You won\'t be able to edit them here after that, but you can always message us changes.')) return;
    t.disabled = true;
    t.textContent = 'Sending…';
    try {
      clearTimeout(OB.timer);
      await api('/api/portal/onboarding', { method: 'PUT', body: JSON.stringify({ data: { ...d, step: OB.step } }), json: true });
      await api('/api/portal/onboarding/submit', { method: 'POST' });
      P.me.onboarding.status = 'submitted';
      OB.d = null;
      render();
      scrollTo(0, 0);
    } catch (err) {
      OB.err = err.message;
      renderOnboarding();
    }
  }
});
