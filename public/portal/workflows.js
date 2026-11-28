// Tab "Workflows" u portalu (28.11.2026): tri toka poruka (ponuda, termini, preuzimanje i recenzija) kao dijagram sa pravim
// stanjem svakog koraka, kanal za SMS (GoHighLevel ili Quo), tekstovi poruka i istorija slanja.
// Stanje stiže sa servera (GET /api/portal/workflows); "Live" se ne izmišlja: GHL mora potvrditi (ack webhook), Quo mora vratiti 2xx.
let C = null; // { api, esc, readOnly, rerender, app, P }
const W = {
  data: null, loading: false, error: '', sel: null, conn: '', group: 'all', status: 'all', shown: 25, open: '', flash: null, busy: '',
  view: {}, drafts: {}, keyDraft: '', testDraft: '', secretDraft: '', timer: 0,
};

const STATE_LABEL = { live: 'Live', published: 'Published', waiting: 'Waiting', not_connected: 'Not connected', error: 'Error', off: 'Off' };
const ICON = {
  sms: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10a6 6 0 0 1 12 0c0 5.5 2 7 2 7H4s2-1.5 2-7z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/></svg>',
  msg: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/></svg>',
  task: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 4.500 6a2 2 0 0 1 2-2z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.500" rx="2.500"/><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4"/></svg>',
  video: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.500" y="6.500" width="12" height="11" rx="2.500"/><path d="M15.500 10.500l5-3v9l-5-3"/></svg>',
  mail2: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.500" y="5.500" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.500l7 2.500v5.500c0 4.500-3 7.500-7 9-4-1.500-7-4.500-7-9V6z"/><path d="M9 12l2.200 2.200L15.500 10"/></svg>',
  fOffer: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.6 7.6a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0l-7.6-7.6a1 1 0 0 1-.3-.7z"/><circle cx="8.2" cy="8.2" r="1.4"/></svg>',
  fAppts: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8.5 14.5h2M13.5 14.5h2M8.5 17.5h2"/></svg>',
  fReviews: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

export function initWorkflows(ctx) {
  C = ctx;
  C.app.addEventListener('click', onClick);
  C.app.addEventListener('input', onInput);
  C.app.addEventListener('change', onChange);
  C.app.addEventListener('keydown', (e) => { if (e.key === 'Escape' && C.P.tab === 'workflows' && W.sel) { W.sel = null; C.rerender(); } });
  // Bogat hover na koraku (28.11.2026, Ognjen: "na hover da iskoči popup sa svim info, kad se dešava i koji je sadržaj").
  C.app.addEventListener('mouseover', (e) => { const n = e.target.closest?.('.wf-node'); if (n && C.P.tab === 'workflows' && matchMedia('(hover: hover)').matches) tipShow(n); });
  C.app.addEventListener('mouseout', (e) => { const n = e.target.closest?.('.wf-node'); if (n && !n.contains(e.relatedTarget)) tipHide(); });
  C.app.addEventListener('focusin', (e) => { const n = e.target.closest?.('.wf-node'); if (n && C.P.tab === 'workflows') tipShow(n); else tipHide(); });
  C.app.addEventListener('click', tipHide, true);
  addEventListener('scroll', tipHide, { passive: true });
  // Konektori (28.11.2026): hover i fokus na liniji između dva koraka, crtanje poslije svakog rendera.
  C.app.addEventListener('mouseover', (e) => { const l = e.target.closest?.('.wf-hit'); if (l && C.P.tab === 'workflows' && matchMedia('(hover: hover)').matches) linkTipShow(l); });
  C.app.addEventListener('mouseout', (e) => { const l = e.target.closest?.('.wf-hit'); if (l && !l.contains(e.relatedTarget)) tipHide(); });
  C.app.addEventListener('focusin', (e) => { const l = e.target.closest?.('.wf-hit'); if (l && C.P.tab === 'workflows') linkTipShow(l); });
  new MutationObserver(scheduleDraw).observe(C.app, { childList: true }); // render() prepisuje app.innerHTML
  addEventListener('resize', scheduleDraw);
  document.fonts?.ready?.then(scheduleDraw);
  if (typeof ResizeObserver === 'function') linkRO = new ResizeObserver((es) => { if (es.some((en) => laneSize.get(en.target) !== `${en.contentRect.width}x${en.contentRect.height}`)) scheduleDraw(); });
  // Osvježavanje svakih 60 s dok je tab otvoren i vidljiv, ali ne dok zlatar nešto upisuje.
  W.timer = setInterval(() => {
    if (C.P.tab !== 'workflows' || document.visibilityState !== 'visible' || W.loading || W.busy) return;
    if (C.app.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    load(true);
  }, 60_000);
}

export async function openWorkflows() {
  W.flash = null;
  if (!W.data) { W.loading = true; C.rerender(); }
  await load(true);
}
async function load(quiet = false) {
  if (!quiet) { W.loading = true; C.rerender(); }
  try { W.data = await C.api('/api/portal/workflows'); W.error = ''; } catch (e) { W.error = e.message || 'Could not load Workflows.'; }
  W.loading = false;
  if (C.P.tab === 'workflows') C.rerender();
}
// Svaka promjena vraća cijelo stanje; greška ide u poruku iznad kartica.
async function act(label, fn) {
  W.busy = label; W.flash = null; C.rerender();
  try { const r = await fn(); if (r && r.flows) W.data = r; } catch (e) { W.flash = { kind: 'bad', text: e.message || 'Something went wrong.' }; }
  W.busy = '';
  C.rerender();
}
const put = (body) => C.api('/api/portal/workflows', { method: 'PUT', body: JSON.stringify(body), json: true });
const post = (path, body) => C.api(`/api/portal/quo/${path}`, { method: 'POST', body: JSON.stringify(body || {}), json: true });

// ---------- Pomoćne ----------
const fmt = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtDay = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const stepsOf = (d) => d.flows.flatMap((f) => f.lanes.flatMap((l) => l.steps));
const findStep = (d, ev) => stepsOf(d).find((s) => s.ev === ev);
const ro = () => C.readOnly();
const dis = () => (ro() ? 'disabled' : '');
const vars = (d) => {
  const a = d.automation;
  return { ...d.meta.example, store: d.meta.store, sender: a.sender || d.meta.store, review_link: a.reviewLink || d.meta.example.review_link };
};
// Isto kao renderTemplate na serveru (src/automations.js): zamjene, sređeni razmaci, "it's X from X" -> "it's X".
function render(tpl, v) {
  let t = String(tpl || '').replace(/\{([a-z_]+)\}/g, (m, k) => (k in v ? String(v[k] ?? '') : m));
  t = t.replace(/[ \t]+/g, ' ').replace(/ ([.,!?])/g, '$1').replace(/\.\s*\./g, '.').trim();
  // Potpis "{sender}, {store}" kad je ime pošiljaoca isto kao radnja: samo jednom.
  const st = String(v.store || '').trim();
  if (st && String(v.sender || '').trim() === st) t = t.split(`${st}, ${st}`).join(st);
  return t.replace(/\b(it's|It's|this is|This is) (.{1,80}?) from \2(?=$|[\s.,!?])/, '$1 $2').trim();
}
const segments = (n) => (n <= 160 ? 1 : Math.ceil(n / 153));
const copyBtn = (v, what) => `<button type="button" class="wf-copy" data-wf="copy" data-v="${C.esc(v)}" aria-label="Copy ${C.esc(what)}" title="Copy ${C.esc(what)}">${ICON.copy}</button>`;
const sw = (on, attrs, label, off = false) => `<button type="button" class="wf-sw" role="switch" aria-checked="${on}" aria-label="${C.esc(label)}" ${attrs} ${off || ro() ? 'disabled' : ''}><i></i></button>`;
const flowPill = (f, d) => {
  const quo = d.channel === 'quo';
  const m = {
    live: ['live', 'Live'], partial: ['partial', 'Partly live'], published: ['published', 'Published'], waiting: ['waiting', quo ? 'Ready, no sends yet' : 'Waiting for GoHighLevel'],
    not_connected: ['not_connected', 'Not connected'], error: ['error', 'Needs attention'], off: ['off', 'Off'],
  }[f.state] || ['off', f.state];
  return `<span class="wf-pill is-${m[0]}">${m[1]}</span>`;
};
// Oznake kanala koraka: SMS (Quo ili GHL), Email (GHL workflow), Task (zadatak / obavještenje za radnju).
const chans = (s) => [
  s.hasText && ['sms', ICON.msg, s.channel === 'quo' ? 'SMS · Quo' : 'SMS'],
  s.email && ['email', ICON.mail, 'Email'],
  s.task && ['task', ICON.task, 'Task'],
].filter(Boolean);
const badges = (s) => `<span class="wf-chs">${chans(s).map(([k, ic, t]) => `<i class="wf-ch is-${k}">${ic}${C.esc(t)}</i>`).join('')}</span>`;
// Isti tekst sa poljima GoHighLevel kontakta, spreman za lijepljenje u workflow.
const GHL_FIELD = { first_name: '{{contact.first_name}}', piece: '{{contact.jl_piece}}', page_url: '{{contact.jl_page_url}}', price: '{{contact.jl_price}}', offer_expires: '{{contact.jl_offer_expires}}', appt_type: '{{contact.jl_appt_type}}', appt_time: '{{contact.jl_appt_time}}', appt_location: '{{contact.jl_appt_location}}', meet_link: '{{contact.jl_meet_link}}', reschedule_url: '{{contact.jl_reschedule_url}}', order_no: '{{contact.jl_order_no}}' };
const forGhl = (t, d) => String(t || '').replace(/\{([a-z_]+)\}/g, (m, k) => GHL_FIELD[k] || (k === 'store' ? d.meta.store : k === 'sender' ? d.automation.sender || d.meta.store : k === 'review_link' ? d.automation.reviewLink || '[your Google review link]' : m));
// Ugašen korak (npr. Automations off) i dalje pokazuje stanje GHL workflowa, da se postavka provjeri prije paljenja.
const stLabel = (s) => (s.state === 'off' && s.channel !== 'quo' && s.workflow ? `Off · ${s.workflow === 'published' ? 'published in GHL' : 'draft in GHL'}` : STATE_LABEL[s.state]);
const stCls = (s) => (s.state === 'off' && s.workflow === 'published' && s.channel !== 'quo' ? ' is-pub' : '');
const chanLabel = (s) => (s.channel === 'quo' ? 'SMS · Quo' : s.channel === 'internal' ? 'Internal' : 'GHL workflow');

// ---------- Prikaz ----------
export function workflowsView() {
  if (W.loading && !W.data) return '<section class="wf"><p class="wf-empty">Loading Workflows…</p></section>';
  if (!W.data) return `<section class="wf"><p class="wf-empty">${C.esc(W.error || 'Could not load Workflows.')} <button type="button" class="btn small" data-wf="reload">Try again</button></p></section>`;
  const d = W.data;
  return `<section class="wf ${ro() ? 'is-ro' : ''}">
    ${head(d)}
    ${W.flash ? `<p class="wf-flash is-${W.flash.kind}" role="status">${C.esc(W.flash.text)}</p>` : ''}
    ${connectionsCard(d)}
    ${channelCard(d)}
    ${d.flows.map((f) => flowCard(f, d)).join('')}
    ${historyCard(d)}
    ${W.sel ? panel(d) : ''}
  </section>`;
}

function head(d) {
  const a = d.automation;
  const c = d.counts;
  return `<div class="wf-head">
      <div><h2>Workflows</h2><p>Automatic texts and emails that follow each customer, from quote to review.</p></div>
      <label class="wf-master"><span><b>Automations</b><small>${a.on ? 'On' : 'Off'}</small></span>${sw(a.on, 'data-wf="master"', 'Automations on or off')}</label>
    </div>
    <div class="wf-nums">
      <div><small>Sent, last 7 days</small><b>${c.sent7}</b></div>
      <div><small>Sent, last 30 days</small><b>${c.sent30}</b></div>
      <div class="${c.failed30 ? 'is-bad' : ''}"><small>Failed, 30 days</small><b>${c.failed30}</b></div>
      <div><small>Control group, 30 days</small><b>${c.holdout30}</b></div>
    </div>`;
}

// ---------- Connections ----------
// Samo ono što smo vidjeli da radi je zeleno; ostalo je pošteno "Check in GoHighLevel" sa uputom.
const CONN_PILL = { ok: 'Working', warn: 'Set up', bad: 'Needs attention', off: 'Not connected', manual: 'Check in GoHighLevel' };
const CONN_ICON = { ghl: '<i class="wf-mono">HL</i>', quo: '<i class="wf-mono">Q</i>', phone: ICON.phone, calendar: ICON.cal, meet: ICON.video, gmail: ICON.mail2, a2p: ICON.shield };
const fmtShort = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
// +13035550100 -> +1 303 555 0100 (ostale vrijednosti ostaju kakve jesu).
const fmtPhone = (v) => (/^\+1\d{10}$/.test(String(v || '')) ? String(v).replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 $1 $2 $3') : v);
function connectionsCard(d) {
  const rows = d.connections || [];
  if (!rows.length) return '';
  return `<div class="wf-card wf-conn">
    <div class="wf-conn-top"><h3>Connections</h3><p>What is connected for texts, email, calendar and calls. Green means we have seen it work.</p></div>
    <ul class="wf-conn-grid">${rows.map((r) => {
      const open = W.conn === r.key;
      const value = fmtPhone(r.value) || (r.at && (r.key === 'calendar' || r.key === 'meet') ? `Last: ${fmtShort(r.at)}` : '');
      return `<li data-k="${C.esc(r.key)}"><button type="button" class="wf-ct is-${C.esc(r.state)} ${open ? 'is-open' : ''}" data-wf="conn" data-k="${C.esc(r.key)}" aria-expanded="${open}" aria-label="${C.esc(`${r.label}: ${CONN_PILL[r.state]}`)}">
        <span class="wf-ct-top"><span class="wf-ct-ic">${CONN_ICON[r.key] || ''}</span><b>${C.esc(r.label)}</b></span>
        <span class="wf-ct-st"><span class="wf-cpill">${CONN_PILL[r.state]}</span></span>
        ${value ? `<span class="wf-ct-val">${C.esc(value)}</span>` : ''}
        <span class="wf-ct-det ${open ? '' : 'is-clamp'}">${C.esc(r.detail)}</span>
      </button></li>`;
    }).join('')}</ul>
  </div>`;
}

function channelCard(d) {
  const quoSel = d.channel === 'quo';
  const q = d.quo;
  const g = d.ghl;
  const ghlRows = `
    <li><span>Connection</span><b class="${g.connected && g.enabled ? 'is-good' : ''}">${g.connected ? (g.enabled ? 'Connected' : 'Saved, turned off') : 'Not connected'}</b></li>
    <li><span>Ack webhook</span>${g.hook ? `<b class="is-good">Ready</b>${copyBtn(g.hookUrl, 'webhook address')}` : `<button type="button" class="btn small" data-wf="ghl-hook" ${g.connected ? '' : 'disabled'} ${dis()}>Create webhook</button>`}</li>
    <li><span>View Workflows scope</span><b class="${g.wfScope === 'ok' ? 'is-good' : g.wfScope === 'missing' ? 'is-bad' : ''}">${{ ok: 'OK', missing: 'Missing', error: 'Could not check', unknown: g.connected ? 'Not checked yet' : 'Not connected' }[g.wfScope] || ''}</b></li>`;
  const ghlNote = !g.connected ? 'Connect your sub-account in Forms, then GoHighLevel.' : g.wfScope === 'missing' ? 'Add the "View Workflows" scope to your token so we can see which workflows are published.' : 'Each GoHighLevel workflow ends with a webhook step that tells us it ran. That is what turns a step Live.';
  const quoBody = !q.connected ? `
      <p class="wf-help">Create an API key in Quo (Settings, API), paste it here and press Connect. Texts then go out from your Quo number, about $0.01 each, paid from your Quo credits.</p>
      <div class="wf-row"><input class="in" type="password" autocomplete="off" placeholder="Quo API key" data-wf-key value="${C.esc(W.keyDraft)}" ${dis()} /><button type="button" class="btn primary" data-wf="quo-connect" ${W.busy || ro() ? 'disabled' : ''}>${W.busy === 'connect' ? 'Connecting…' : 'Connect'}</button></div>`
    : `
      <ul class="wf-kv">
        <li><span>API key</span><b>${C.esc(q.keyHint)}</b><button type="button" class="wf-link-btn" data-wf="quo-disconnect" ${dis()}>Disconnect</button></li>
        <li><span>Number</span><select class="in" data-wf-number ${dis()}><option value="">Choose your number</option>${q.numbers.map((n) => `<option value="${C.esc(n.id)}" ${n.id === q.fromId ? 'selected' : ''}>${C.esc(n.name ? `${n.name} · ${n.number}` : n.number)}</option>`).join('')}</select></li>
        <li><span>Replies and delivery</span>${q.webhook ? '<b class="is-good">On</b>' : `<b class="${q.webhookError ? 'is-bad' : ''}">${q.fromId ? 'Off' : 'Pick a number first'}</b>${q.fromId ? `<button type="button" class="wf-link-btn" data-wf="quo-hook" ${dis()}>Try again</button>` : ''}`}</li>
      </ul>
      ${q.webhookError ? `<p class="wf-warn">${C.esc(q.webhookError)} Texts still go out, but STOP replies, customer answers and delivery receipts will not reach us until this is fixed.</p>` : ''}
      ${q.lastError ? `<p class="wf-warn">${C.esc(q.lastError.msg || 'The last text failed.')} <small>${C.esc(fmt(q.lastError.at))}</small></p>` : ''}
      <div class="wf-row"><input class="in" type="tel" placeholder="Send a test to your phone: 303 555 0142" data-wf-test value="${C.esc(W.testDraft)}" ${dis()} /><button type="button" class="btn" data-wf="quo-test" ${!q.ready || W.busy || ro() ? 'disabled' : ''}>${W.busy === 'test' ? 'Sending…' : 'Send test'}</button></div>
      <details class="wf-more"><summary>Set up the webhook by hand</summary>
        <p class="wf-help">Only needed if the automatic setup keeps failing. In Quo, add a webhook to this address for messages and delivery events, then paste its signing secret.</p>
        <div class="wf-row"><input class="in" readonly value="${C.esc(q.webhookUrl)}" aria-label="Webhook address" />${copyBtn(q.webhookUrl, 'webhook address')}</div>
        <div class="wf-row"><input class="in" type="password" autocomplete="off" placeholder="whsec_..." data-wf-secret value="${C.esc(W.secretDraft)}" ${dis()} /><button type="button" class="btn" data-wf="quo-secret" ${W.busy || ro() ? 'disabled' : ''}>Save secret</button></div>
      </details>`;
  return `<div class="wf-card wf-chan">
    <div class="wf-chan-top"><div><h3>Where texts are sent from</h3><p>Pick one. Emails always come from GoHighLevel workflows.</p></div>
      <div class="wf-seg" role="group" aria-label="Text channel">
        <button type="button" class="${quoSel ? '' : 'on'}" data-wf="chan" data-v="ghl" aria-pressed="${!quoSel}" ${dis()}><i class="wf-mono">HL</i>GoHighLevel</button>
        <button type="button" class="${quoSel ? 'on' : ''}" data-wf="chan" data-v="quo" aria-pressed="${quoSel}" ${dis()}><i class="wf-mono">Q</i>Quo</button>
      </div></div>
    <div class="wf-chan-grid">
      <div class="wf-chbox ${quoSel ? '' : 'is-sel'}"><h4><i class="wf-mono">HL</i>GoHighLevel</h4><ul class="wf-kv">${ghlRows}</ul><p class="wf-help">${C.esc(ghlNote)}</p></div>
      <div class="wf-chbox ${quoSel ? 'is-sel' : ''}" id="wf-quo"><h4><i class="wf-mono">Q</i>Quo</h4>${quoBody}</div>
    </div>
    <div class="wf-details">
      <h4>Details used in your messages</h4>
      <div class="wf-grid2">
        <label><span>Your name in texts</span><input class="in" maxlength="40" placeholder="${C.esc(d.meta.store)}" data-wf-sender value="${C.esc(d.automation.sender)}" ${dis()} /></label>
        <label><span>Google review link</span><input class="in" placeholder="https://search.google.com/local/writereview?placeid=..." data-wf-review value="${C.esc(d.automation.reviewLink)}" ${dis()} /></label>
      </div>
      <p class="wf-help">Used for texts sent through Quo and in the copy buttons for your GoHighLevel workflows.</p>
    </div>
  </div>`;
}

function node(s) {
  return `<button type="button" class="wf-node is-${s.state} ${W.sel === s.ev ? 'is-sel' : ''}" data-wf="node" data-ev="${C.esc(s.ev)}" aria-label="${C.esc(`${s.name}: ${STATE_LABEL[s.state]}`)}">
    <span class="wf-ic">${s.hasText && s.channel !== 'internal' ? ICON.sms : ICON.bell}</span>
    <span class="wf-nt"><b>${C.esc(s.name)}</b><small>${C.esc(s.when)}</small>${badges(s)}<span class="wf-meta"><span class="wf-st${stCls(s)}">${C.esc(stLabel(s))}</span>${s.sent30 ? `<span class="wf-n">${s.sent30} sent</span>` : ''}</span></span>
  </button>`;
}
const FLOW_ICON = { offer: ICON.fOffer, appts: ICON.fAppts, reviews: ICON.fReviews };
function flowCard(f, d) {
  const total = new Set(f.lanes.flatMap((l) => l.steps.filter((s) => s.state !== 'off').map((s) => s.ev))).size;
  const live = new Set(f.lanes.flatMap((l) => l.steps.filter((s) => s.state === 'live').map((s) => s.ev))).size;
  const msgs = W.view[f.key] === 'messages';
  return `<div class="wf-card wf-flow is-${f.state}">
    <div class="wf-flow-top"><span class="wf-flow-ic" aria-hidden="true">${FLOW_ICON[f.key] || ICON.fOffer}</span><h3>${C.esc(f.title)}</h3>${flowPill(f, d)}<span class="wf-sub">${total ? `${live} of ${plural(total, 'step')} live` : 'All steps off'}</span>
      <div class="wf-seg wf-seg-s" role="group" aria-label="${C.esc(f.title)} view"><button type="button" class="${msgs ? '' : 'on'}" data-wf="fview" data-k="${C.esc(f.key)}" data-v="diagram" aria-pressed="${!msgs}">Diagram</button><button type="button" class="${msgs ? 'on' : ''}" data-wf="fview" data-k="${C.esc(f.key)}" data-v="messages" aria-pressed="${msgs}">Messages</button></div></div>
    ${msgs ? messagesView(f, d) : f.lanes.map((l) => `<div class="wf-lane-wrap"><p class="wf-lane-label">${C.esc(l.label)}</p><div class="wf-lane">${l.steps.map(node).join('')}</div></div>`).join('')}
  </div>`;
}

// Sve poruke toka redom: kada, kanali i tekst sa primjerom (korak koji se ponavlja u više traka prikazuje se jednom).
function messagesView(f, d) {
  const seen = new Set();
  const v = vars(d);
  return f.lanes.map((l) => {
    const steps = l.steps.filter((s) => !seen.has(s.ev) && seen.add(s.ev));
    if (!steps.length) return '';
    return `<div class="wf-lane-wrap"><p class="wf-lane-label">${C.esc(l.label)}</p><ol class="wf-msgs">${steps.map((s) => `<li class="is-${s.state}">
      <button type="button" class="wf-mrow" data-wf="node" data-ev="${C.esc(s.ev)}">
        <span class="wf-mwhen"><b>${C.esc(s.name)}</b><small>${C.esc(s.when)}</small><small>${C.esc(s.window)}</small><span class="wf-st${stCls(s)}">${C.esc(stLabel(s))}</span></span>
        <span class="wf-mbody">${badges(s)}
          ${s.hasText ? `<span class="wf-bub"><i>${ICON.msg}</i>${C.esc(render(s.template, v))}</span>` : ''}
          ${s.email ? `<span class="wf-mail"><i>${ICON.mail}</i><b>${C.esc(render(s.email.subject, v))}</b></span>` : ''}
          ${s.task ? `<span class="wf-task"><i>${ICON.task}</i>${C.esc(render(s.task, v))}</span>` : ''}
        </span>
      </button></li>`).join('')}</ol></div>`;
  }).join('');
}

// ---------- Konektori između koraka ----------
// Jedan SVG po traci, nacrtan iz stvarnih pozicija krugova (radi vodoravno i okomito). Vrste: 'seq' niz, 'one' jedna od, 'trig' odvojeni okidači.
const LINK_KIND = {
  'offer_unopened>offer_saved': 'one', 'appt_noshow>appt_showed': 'one', 'appt_showed>appt_cancelled': 'one',
  'deposit_click>refresh_ready': 'trig', 'refresh_ready>refresh_moved': 'trig',
};
const LINK_TIP = {
  'quote_ready>offer_unopened': "4 hours after the quote was sent. If they haven't opened their page by then, 'Not opened' goes out.",
  'offer_unopened>offer_saved': "Only one of these two goes out, 4 hours after the quote: 'Not opened' if they haven't opened their page, 'Opened, no deposit' if they have.",
  'offer_saved>offer_24h': 'Waits until 24 hours before the price hold ends (holds of 36 hours or more). Stops if they pay a deposit, book an appointment or reply.',
  'offer_24h>offer_final': 'Waits until 6 hours before the price hold ends. Stops if they pay, book or reply.',
  'offer_final>offer_expired': 'Waits until the price hold ends. Stops if they pay, book or reply.',
  'offer_expired>offer_closeout': "6 days later, only if they haven't asked for a refreshed quote.",
  'deposit_click>refresh_ready': 'Separate triggers, not a sequence. Each goes out when its own event happens.',
  'refresh_ready>refresh_moved': 'Separate triggers, not a sequence. Each goes out when its own event happens.',
  'appt_booked>visit_3d': 'Waits until 3 days before the visit. Only when it was booked more than 3.5 days ahead.',
  'visit_3d>visit_24h': 'Waits until 24 hours before the visit.',
  'visit_24h>visit_2h': 'Waits until 2 hours before the visit.',
  'appt_booked>call_1h': 'Waits until 1 hour before the consultation.',
  'call_1h>call_10m': 'Waits until 10 minutes before the consultation.',
  'appt_noshow>appt_showed': 'Only one of these goes out, depending on how the appointment ends: marked No-show, marked Done (2 hours later, if there is still no deposit), or cancelled.',
  'appt_showed>appt_cancelled': 'Only one of these goes out, depending on how the appointment ends: marked No-show, marked Done (2 hours later, if there is still no deposit), or cancelled.',
  'order_ready>picked_up': 'Waits until you mark the order Picked up.',
  'picked_up>review_request': 'The next day (grillz 3 days, gifts 2 days after the occasion). Held while a remake or fix is open.',
};
const LINK_FALLBACK = "Goes out when the next step's own trigger happens.";
const LINK_TAG = { seq: '', one: 'One of', trig: 'Triggers' };
const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
let linkRO = null, drawRaf = 0;
const laneSize = new WeakMap();
const scheduleDraw = () => { cancelAnimationFrame(drawRaf); drawRaf = requestAnimationFrame(drawLinks); };

function drawLinks() {
  const lanes = C.app.querySelectorAll('.wf-lane');
  linkRO?.disconnect(); // stari opservatori se uklanjaju prije novog crtanja
  if (C.P.tab !== 'workflows' || !W.data) return;
  const GAP = 4, HEAD = 7;
  lanes.forEach((lane) => {
    lane.querySelector(':scope > svg.wf-links')?.remove();
    const lr = lane.getBoundingClientRect();
    laneSize.set(lane, `${lr.width}x${lr.height}`);
    const nodes = [...lane.querySelectorAll(':scope > .wf-node')];
    if (nodes.length < 2) { linkRO?.observe(lane); return; }
    const svg = sv('svg', { class: 'wf-links', 'aria-hidden': 'false' });
    for (let i = 1; i < nodes.length; i++) {
      const A = nodes[i - 1], B = nodes[i];
      const ca = A.querySelector('.wf-ic')?.getBoundingClientRect(), cb = B.querySelector('.wf-ic')?.getBoundingClientRect();
      if (!ca || !cb) continue;
      const ax = ca.left + ca.width / 2 - lr.left, ay = ca.top + ca.height / 2 - lr.top;
      const bx = cb.left + cb.width / 2 - lr.left, by = cb.top + cb.height / 2 - lr.top;
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      const ra = ca.width / 2 + GAP, rb = cb.width / 2 + GAP;
      if (L - ra - rb < 10) continue;
      const ux = dx / L, uy = dy / L;
      const kind = LINK_KIND[`${A.dataset.ev}>${B.dataset.ev}`] || 'seq';
      const sB = findStep(W.data, B.dataset.ev);
      const st = !sB ? 'idle' : ['live', 'published', 'error', 'off'].includes(sB.state) ? sB.state : 'idle';
      const x1 = ax + ux * ra, y1 = ay + uy * ra, x2 = bx - ux * rb, y2 = by - uy * rb;
      const g = sv('g', { class: `wf-lk is-${st} k-${kind}` });
      const arrow = kind === 'seq';
      const ex = arrow ? x2 - ux * HEAD : x2, ey = arrow ? y2 - uy * HEAD : y2;
      g.appendChild(sv('line', { class: 'base', x1: x1.toFixed(1), y1: y1.toFixed(1), x2: ex.toFixed(1), y2: ey.toFixed(1) }));
      if (arrow && st !== 'off') g.appendChild(sv('line', { class: 'flow', x1: x1.toFixed(1), y1: y1.toFixed(1), x2: ex.toFixed(1), y2: ey.toFixed(1) }));
      if (arrow) g.appendChild(sv('path', { class: 'head', d: `M${x2.toFixed(1)} ${y2.toFixed(1)}L${(ex - uy * 3.6).toFixed(1)} ${(ey + ux * 3.6).toFixed(1)}L${(ex + uy * 3.6).toFixed(1)} ${(ey - ux * 3.6).toFixed(1)}Z` }));
      const hit = sv('line', { class: 'wf-hit', x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), tabindex: '0', role: 'img', 'data-a': A.dataset.ev, 'data-b': B.dataset.ev });
      const an = findStep(W.data, A.dataset.ev)?.name || '', bn = sB?.name || '';
      hit.setAttribute('aria-label', `${an} to ${bn}: ${LINK_TIP[`${A.dataset.ev}>${B.dataset.ev}`] || LINK_FALLBACK}`);
      g.appendChild(hit);
      svg.appendChild(g);
    }
    lane.appendChild(svg);
    linkRO?.observe(lane);
  });
}

function linkTipHtml(a, b, kind) {
  const key = `${a.ev}>${b.ev}`;
  const win = /\bam\b|\bpm\b/.test(b.window || '') ? `Sent ${b.window}` : '';
  return `<div class="wf-tip-top"><b>${C.esc(a.name)} <span class="wf-arr">&rarr;</span> ${C.esc(b.name)}</b>${LINK_TAG[kind] ? `<span class="wf-tip-st">${LINK_TAG[kind]}</span>` : ''}</div>
    <p class="wf-tip-when">${C.esc(LINK_TIP[key] || LINK_FALLBACK)}</p>
    ${win ? `<p class="wf-tip-win">${C.esc(win)}</p>` : ''}`;
}
function linkTipShow(el) {
  const d = W.data;
  const a = d && findStep(d, el.dataset.a), b = d && findStep(d, el.dataset.b);
  if (!a || !b || W.sel) return;
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'wf-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
  tipEl.innerHTML = linkTipHtml(a, b, LINK_KIND[`${a.ev}>${b.ev}`] || 'seq');
  tipEl.classList.add('on');
  const r = el.getBoundingClientRect();
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  let top = r.bottom + 10;
  if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 10);
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${top}px`;
}

// ---------- Hover kartica koraka ----------
let tipEl = null;
function tipHtml(s, d) {
  const v = vars(d);
  const st = s.state === 'off' && s.channel !== 'quo' && s.workflow ? stLabel(s) : STATE_LABEL[s.state];
  return `<div class="wf-tip-top"><b>${C.esc(s.name)}</b><span class="wf-tip-st is-${C.esc(s.state)}${stCls(s)}">${C.esc(st)}</span></div>
    <p class="wf-tip-when">${C.esc(s.desc)}</p>
    <p class="wf-tip-win">${C.esc(s.window)}${s.hasText ? ` · ${s.needsMkt ? 'needs marketing text consent' : 'needs text consent'}` : ''}</p>
    ${badges(s)}
    ${s.hasText ? `<div class="wf-tip-sec"><small>Text</small><p class="wf-bub">${C.esc(render(s.template, v))}</p></div>` : ''}
    ${s.email ? `<div class="wf-tip-sec"><small>Email</small><p class="wf-tip-subj">${C.esc(render(s.email.subject, v))}</p><p class="wf-tip-body">${C.esc(render(s.email.body, v))}</p></div>` : ''}
    ${s.task ? `<div class="wf-tip-sec"><small>Task for your team</small><p>${C.esc(render(s.task, v))}</p></div>` : ''}
    <p class="wf-tip-foot">Example details. Click the step to edit or copy.</p>`;
}
function tipShow(n) {
  const d = W.data;
  const s = d && findStep(d, n.dataset.ev);
  if (!s || W.sel) return;
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'wf-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
  tipEl.innerHTML = tipHtml(s, d);
  tipEl.classList.add('on');
  const r = n.getBoundingClientRect();
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  let top = r.bottom + 8;
  if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${top}px`;
}
function tipHide() { tipEl?.classList.remove('on'); }

// ---------- Panel koraka ----------
function panel(d) {
  const s = findStep(d, W.sel);
  if (!s) return '';
  const a = d.automation;
  const quoText = s.hasText && s.channel === 'quo';
  const draft = W.drafts[s.ev] ?? s.template ?? '';
  const preview = s.hasText ? render(draft, vars(d)) : '';
  const consent = !s.hasText ? 'No customer text. This step only tells your GoHighLevel workflow.' : s.needsMkt ? 'Customer consent: marketing texts.' : 'Customer consent: texts about their request.';
  const recent = d.history.filter((h) => h.ev === s.ev).slice(0, 10);
  const stateText = { live: s.channel === 'quo' ? 'Live. Texts for this step are going out through Quo.' : `Live. GoHighLevel confirmed this workflow${s.ackAt ? ` on ${fmtDay(s.ackAt)}` : ''}.`, published: 'Published in GoHighLevel. It turns Live after its first run reaches the ack webhook.', waiting: s.hint, not_connected: s.hint, error: s.hint, off: s.workflow === 'published' && s.channel !== 'quo' ? `${s.hint} The GoHighLevel workflow is published and ready.` : s.workflow && s.channel !== 'quo' ? `${s.hint} The GoHighLevel workflow exists but is not published yet.` : s.hint }[s.state];
  return `<div class="wf-scrim" data-wf="close"></div>
  <aside class="wf-panel" role="dialog" aria-label="${C.esc(s.name)}" aria-modal="true">
    <header><div><small>${C.esc(chanLabel(s))}</small><h3>${C.esc(s.name)}</h3></div><button type="button" class="wf-x" data-wf="close" aria-label="Close">${ICON.close}</button></header>
    <div class="wf-pbody">
      <div class="wf-pstate is-${s.state}"><b>${STATE_LABEL[s.state]}</b><span>${C.esc(stateText || '')}</span></div>
      <dl class="wf-dl"><dt>When it is sent</dt><dd>${C.esc(s.desc)}<small class="wf-win">${C.esc(s.window)}</small></dd><dt>Channels</dt><dd>${badges(s)}</dd><dt>Consent</dt><dd>${C.esc(consent)}</dd></dl>
      <label class="wf-step-on"><span><b>This step is on</b><small>Turn it off to stop this message for everyone.</small></span>${sw(!s.disabled, `data-wf="step" data-ev="${C.esc(s.ev)}"`, `Turn ${s.name} on or off`)}</label>
      ${s.hasText ? `<div class="wf-msg">
        <div class="wf-msg-top"><h4>${quoText ? 'Text message' : 'Suggested text for your GoHighLevel workflow'}</h4>${quoText ? `<button type="button" class="wf-link-btn" data-wf="tpl-reset" data-ev="${C.esc(s.ev)}" ${(s.isDefaultTemplate && W.drafts[s.ev] == null) || ro() ? 'disabled' : ''}>Reset to default</button>` : ''}</div>
        ${quoText ? `<textarea class="in" rows="5" maxlength="600" data-wf-tpl="${C.esc(s.ev)}" ${dis()}>${C.esc(draft)}</textarea>
          <div class="wf-chips" aria-label="Insert a detail">${d.meta.templateVars.map((v) => `<button type="button" data-wf="chip" data-v="${C.esc(v)}" ${dis()}>${C.esc(v.replace(/_/g, ' '))}</button>`).join('')}</div>`
        : `<div class="wf-cp"><pre class="wf-pre">${C.esc(forGhl(s.template, d))}</pre>${copyBtn(forGhl(s.template, d), 'text for GoHighLevel')}</div><p class="wf-help">Ready to paste into the Send SMS step, with the GoHighLevel contact fields. Switch to Quo above to send this text from our side.</p>`}
        <div class="wf-prev"><small>Preview with example details</small><p data-wf-prev>${C.esc(preview)}</p><small data-wf-count>${preview.length} characters, ${plural(segments(preview.length), 'segment')}${s.ev !== 'review_request' && quoText ? '. The first text a customer ever gets also ends with "Reply STOP to opt out."' : ''}</small></div>
        ${quoText ? `<div class="wf-row"><button type="button" class="btn primary" data-wf="tpl-save" data-ev="${C.esc(s.ev)}" ${ro() || W.busy ? 'disabled' : ''}>Save message</button>${s.ev === 'review_request' && !a.reviewLink ? '<span class="wf-warn-s">Add your Google review link under \u201cDetails used in your messages\u201d first.</span>' : ''}</div>` : ''}
      </div>` : ''}
      ${s.email ? `<div class="wf-msg wf-emailbox">
        <div class="wf-msg-top"><h4>${ICON.mail} Email <small>for customers without text consent</small></h4></div>
        <div class="wf-mailcard"><div class="wf-mailhead"><small>Subject</small><b>${C.esc(render(s.email.subject, vars(d)))}</b></div><p>${C.esc(render(s.email.body, vars(d)))}</p></div>
        <p class="wf-help wf-copyhint">Copy into the Send Email step in GoHighLevel:</p><div class="wf-row wf-copyrow">
          <button type="button" class="btn small" data-wf="copy" data-v="${C.esc(forGhl(s.email.subject, d))}">${ICON.copy} Subject</button>
          <button type="button" class="btn small" data-wf="copy" data-v="${C.esc(forGhl(s.email.body, d))}">${ICON.copy} Body</button></div>
        <p class="wf-help">Emails always go out from your GoHighLevel workflow. GoHighLevel adds the unsubscribe link.</p>
      </div>` : ''}
      ${s.task ? `<div class="wf-msg"><div class="wf-msg-top"><h4>${ICON.task} Task for your team</h4></div>
        <div class="wf-cp"><pre class="wf-pre">${C.esc(forGhl(s.task, d))}</pre>${copyBtn(forGhl(s.task, d), 'task text')}</div>
        <p class="wf-help">In GoHighLevel: Create Task (and Internal Notification) in this workflow.</p></div>` : ''}
      ${s.channel !== 'quo' ? `<div class="wf-gh"><h4>GoHighLevel workflow</h4>
        <ul class="wf-kv"><li><span>Starts on tag</span><code>${C.esc(s.tag)}</code>${copyBtn(s.tag, 'tag')}</li>
        <li><span>Workflow name</span><code>${C.esc(s.tag)}</code>${copyBtn(s.tag, 'workflow name')}</li>
        <li><span>Last step: webhook</span><code>event = jl_ack, tag = ${C.esc(s.tag)}</code>${copyBtn(`event=jl_ack\ntag=${s.tag}`, 'ack custom data')}</li>
        ${d.ghl.hookUrl ? `<li><span>Webhook address</span><code class="wf-url">${C.esc(d.ghl.hookUrl)}</code>${copyBtn(d.ghl.hookUrl, 'webhook address')}</li>` : ''}</ul>
        <p class="wf-help">The workflow name only has to contain the tag. The webhook goes at the very end: Custom Webhook, method POST, to the address above, with those two Custom Data items.</p></div>` : ''}
      <div class="wf-recent"><h4>Last sends</h4>${recent.length ? `<ul>${recent.map((h) => `<li><span>${C.esc(fmt(h.at))}</span><b>${C.esc(h.name || 'Customer')}</b><em class="wf-s is-${C.esc(statusKey(h))}">${C.esc(statusText(h))}</em></li>`).join('')}</ul>` : '<p class="wf-help">Nothing sent for this step yet.</p>'}</div>
    </div>
  </aside>`;
}

// ---------- Istorija ----------
const statusKey = (h) => (h.status === 'sent' ? (h.ackedAt ? 'delivered' : 'sent') : h.status);
const statusText = (h) => ({ delivered: h.channel === 'quo' ? 'Delivered' : 'Delivered by GHL', sent: 'Sent', failed: 'Failed', skipped: 'Skipped', holdout: 'Control group', sending: 'Sending' }[statusKey(h)] || h.status);
function historyCard(d) {
  const GROUPS = [['all', 'All'], ['offer', 'Quote'], ['appts', 'Appointments'], ['reviews', 'Reviews']];
  const STAT = [['all', 'Any status'], ['sent', 'Sent'], ['failed', 'Failed'], ['skipped', 'Skipped'], ['holdout', 'Control group']];
  const rows = d.history.filter((h) => (W.group === 'all' || h.group === W.group) && (W.status === 'all' || (W.status === 'sent' ? h.status === 'sent' : h.status === W.status)));
  const chips = (list, cur, key) => list.map(([k, t]) => `<button type="button" class="wf-chip ${cur === k ? 'on' : ''}" data-wf="${key}" data-v="${k}" aria-pressed="${cur === k}">${t}</button>`).join('');
  const body = rows.slice(0, W.shown).map((h) => {
    const open = W.open === h.id;
    const why = h.error || (h.status === 'holdout' ? 'Held back on purpose so you can measure what the messages add.' : '');
    const extra = (h.body ? `<p class="${open ? '' : 'is-clamp'}">${C.esc(h.body)}</p>` : '') + (open && why ? `<p class="wf-why">${C.esc(why)}</p>` : '');
    return `<tr class="wf-r ${open ? 'is-open' : ''} ${extra ? 'has-x' : ''}" data-wf="row" data-id="${C.esc(h.id)}" tabindex="0">
      <td data-l="When">${C.esc(fmt(h.at))}</td>
      <td data-l="Customer">${h.email ? `<button type="button" class="wf-who" data-see-lead="${C.esc(h.email)}">${C.esc(h.name || 'Customer')}</button>` : '<span class="faint">Test</span>'}${h.ref ? `<small>${C.esc(h.ref)}</small>` : ''}</td>
      <td data-l="Step">${C.esc(h.step)}</td>
      <td data-l="Channel">${h.channel === 'quo' ? 'Quo SMS' : 'GHL tag'}</td>
      <td data-l="To">${C.esc(h.target || (h.channel === 'ghl' ? 'GHL contact' : ''))}</td>
      <td data-l="Status"><span class="wf-s is-${C.esc(statusKey(h))}">${C.esc(statusText(h))}</span></td>
    </tr>${extra ? `<tr class="wf-x-row ${open ? 'is-open' : ''}" data-wf="row" data-id="${C.esc(h.id)}"><td colspan="6">${extra}</td></tr>` : ''}`;
  }).join('');
  return `<div class="wf-card wf-hist"><div class="wf-hist-top"><h3>History</h3><div class="wf-chips-row">${chips(GROUPS, W.group, 'fg')}</div><div class="wf-chips-row">${chips(STAT, W.status, 'fs')}</div></div>
    ${rows.length ? `<div class="wf-dt-wrap"><table class="wf-dt"><thead><tr><th>When</th><th>Customer</th><th>Step</th><th>Channel</th><th>To</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>${rows.length > W.shown ? `<div class="wf-more-row"><button type="button" class="btn small" data-wf="more">Show more (${rows.length - W.shown})</button></div>` : ''}`
      : '<p class="wf-empty">Nothing sent yet. Steps start sending once automations are on and a channel is connected.</p>'}
  </div>`;
}

// ---------- Događaji ----------
function onClick(e) {
  if (C.P.tab !== 'workflows') return;
  const t = e.target.closest('[data-wf]');
  if (!t) return;
  const a = t.dataset.wf;
  const d = W.data;
  if (a === 'node') { W.sel = t.dataset.ev; W.flash = null; C.rerender(); setTimeout(() => C.app.querySelector('.wf-panel .wf-x')?.focus(), 30); return; }
  if (a === 'conn') { W.conn = W.conn === t.dataset.k ? '' : t.dataset.k; C.rerender(); return; }
  if (a === 'close') { W.sel = null; C.rerender(); return; }
  if (a === 'reload') { load(); return; }
  if (a === 'copy') { copy(t); return; }
  if (a === 'fview') { W.view[t.dataset.k] = t.dataset.v; C.rerender(); return; }
  if (a === 'fg') { W.group = t.dataset.v; W.shown = 25; C.rerender(); return; }
  if (a === 'fs') { W.status = t.dataset.v; W.shown = 25; C.rerender(); return; }
  if (a === 'more') { W.shown += 25; C.rerender(); return; }
  if (a === 'row') { if (e.target.closest('[data-see-lead]')) return; W.open = W.open === t.dataset.id ? '' : t.dataset.id; C.rerender(); return; }
  if (a === 'chip') { insertChip(t.dataset.v); return; }
  if (ro() || !d) return;
  if (a === 'master') return void act('master', () => put({ on: !d.automation.on }));
  if (a === 'chan') {
    if (t.dataset.v === 'quo' && !d.quo.ready) { W.flash = { kind: 'bad', text: d.quo.connected ? 'Pick your Quo number first.' : 'Connect Quo first: paste your Quo API key below.' }; C.rerender(); C.app.querySelector('#wf-quo')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (t.dataset.v === d.channel) return;
    return void act('chan', () => put({ texts: t.dataset.v }));
  }
  if (a === 'step') { const cur = findStep(d, t.dataset.ev); return void act('step', () => put({ disabled: { [t.dataset.ev]: !cur.disabled } })); }
  if (a === 'tpl-save') { const ev = t.dataset.ev; const v = (W.drafts[ev] ?? findStep(d, ev).template ?? '').trim(); return void act('tpl', async () => { const r = await put({ templates: { [ev]: v === findStep(d, ev).defaultTemplate ? '' : v } }); delete W.drafts[ev]; W.flash = { kind: 'good', text: 'Message saved.' }; return r; }); }
  if (a === 'tpl-reset') { const ev = t.dataset.ev; return void act('tpl', async () => { const r = await put({ templates: { [ev]: '' } }); delete W.drafts[ev]; return r; }); }
  if (a === 'quo-connect') { if (!W.keyDraft.trim()) { W.flash = { kind: 'bad', text: 'Paste your Quo API key first.' }; C.rerender(); return; } return void act('connect', async () => { const r = await post('connect', { key: W.keyDraft.trim() }); W.keyDraft = ''; W.flash = { kind: 'good', text: 'Quo connected. Now choose the number texts should come from.' }; return r; }); }
  if (a === 'quo-disconnect') { if (!confirm('Disconnect Quo? Texts go back to GoHighLevel.')) return; return void act('disc', () => post('disconnect')); }
  if (a === 'quo-hook') return void act('hook', async () => { const r = await post('webhook', {}); W.flash = r.quo.webhook ? { kind: 'good', text: 'Replies and delivery receipts are on.' } : null; return r; });
  if (a === 'quo-secret') return void act('secret', async () => { const r = await post('webhook', { secret: W.secretDraft }); W.secretDraft = ''; W.flash = { kind: 'good', text: 'Signing secret saved.' }; return r; });
  if (a === 'quo-test') return void act('test', async () => { const r = await post('test', { to: W.testDraft }); W.flash = { kind: 'good', text: 'Test text sent. It shows up in the history below.' }; return r; });
  if (a === 'ghl-hook') return void act('ghlhook', async () => { await C.api('/api/portal/ghl', { method: 'PUT', body: JSON.stringify({ hook: 'create' }), json: true }); return C.api('/api/portal/workflows'); });
}
function onInput(e) {
  if (C.P.tab !== 'workflows') return;
  const t = e.target;
  if (t.hasAttribute('data-wf-key')) W.keyDraft = t.value;
  else if (t.hasAttribute('data-wf-test')) W.testDraft = t.value;
  else if (t.hasAttribute('data-wf-secret')) W.secretDraft = t.value;
  else if (t.hasAttribute('data-wf-tpl')) { W.drafts[t.dataset.wfTpl] = t.value; updatePreview(); }
}
function onChange(e) {
  if (C.P.tab !== 'workflows' || ro()) return;
  const t = e.target;
  if (t.hasAttribute('data-wf-number') && t.value) act('number', async () => { const r = await post('number', { id: t.value }); W.flash = r.quo.webhook ? { kind: 'good', text: 'Number saved. Replies and delivery receipts are on.' } : null; return r; });
  else if (t.hasAttribute('data-wf-sender')) act('sender', () => put({ sender: t.value.trim() }));
  else if (t.hasAttribute('data-wf-review')) act('review', () => put({ reviewLink: t.value.trim() }));
}
function updatePreview() {
  const d = W.data;
  const s = d && W.sel && findStep(d, W.sel);
  const box = C.app.querySelector('.wf-prev');
  if (!s || !box) return;
  const text = render(W.drafts[s.ev] ?? '', vars(d));
  box.querySelector('[data-wf-prev]').textContent = text;
  box.querySelector('[data-wf-count]').textContent = `${text.length} characters, ${plural(segments(text.length), 'segment')}${s.ev !== 'review_request' ? '. The first text a customer ever gets also ends with "Reply STOP to opt out."' : ''}`;
}
function insertChip(v) {
  const ta = C.app.querySelector('textarea[data-wf-tpl]');
  if (!ta || ta.disabled) return;
  const at = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? at;
  ta.value = `${ta.value.slice(0, at)}{${v}}${ta.value.slice(end)}`;
  ta.focus();
  ta.selectionStart = ta.selectionEnd = at + v.length + 2;
  W.drafts[ta.dataset.wfTpl] = ta.value;
  updatePreview();
}
async function copy(t) {
  const v = t.dataset.v;
  try { await navigator.clipboard.writeText(v); } catch {
    const x = document.createElement('textarea'); x.value = v; document.body.append(x); x.select(); try { document.execCommand('copy'); } catch { /* bez kopiranja */ } x.remove();
  }
  t.classList.add('is-done');
  setTimeout(() => t.classList.remove('is-done'), 1200);
}
