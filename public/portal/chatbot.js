// Tab "AI chatbot" u portalu (26.11.2026, Ognjen): zlatar piše pravila (šta smije odgovarati, šta nikako ne smije reći, ton,
// kada predaje timu), znanje, primjere pitanja i odgovora, i vidi istoriju razgovora kupaca. Sačuvano važi odmah: server čita
// postavke pri svakoj poruci kupca. Prekidač za stranice kupaca djeluje odmah (bez Save).
//
// Stanje živi ovdje (S), ne u DOM-u: tabovi unutar taba čuvaju ono što je upisano, a kucanje ne crta ponovo stranicu.
let C = null; // { api, esc, when, readOnly, rerender, app, P }
const S = { sub: 'rules', cfg: null, draft: null, dirty: false, msg: '', busy: false, error: '', chats: null, filter: 'all', loadingChats: false, test: { msgs: null, busy: false, lead: '' } };
const SUBS = [['rules', 'Rules'], ['knowledge', 'Knowledge'], ['examples', 'Examples'], ['chats', 'Conversations']];
const TRY = ['How much will this cost?', 'Can you give me a discount?', 'How long does it take?', 'Do you ship out of state?', 'Will it hurt my teeth?'];
const COMMON = ['How long does it take to make?', 'Can I change my design after the deposit?', 'Is the deposit refundable?', 'Do you ship out of state?', 'What is the warranty?', 'Can I get a better price?'];
const piece = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');

export function initChatbot(ctx) {
  C = ctx;
  C.app.addEventListener('click', onClick);
  C.app.addEventListener('input', onInput);
  C.app.addEventListener('change', (e) => {
    if (C.P.tab !== 'chatbot') return;
    if (e.target.hasAttribute?.('data-cb-page')) setPage(e.target.checked);
    if (e.target.hasAttribute?.('data-cb-testlead')) pickTestLead(e.target.value);
  });
  C.app.addEventListener('submit', (e) => { if (e.target.hasAttribute?.('data-cb-testform')) { e.preventDefault(); sendTest(e.target.querySelector('[data-cb-testin]').value); } });
  C.app.addEventListener('keydown', (e) => { if (e.target.hasAttribute?.('data-cb-testin') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendTest(e.target.value); } });
  // Zatvaranje ili osvježavanje stranice sa nesačuvanim izmjenama pita za potvrdu.
  addEventListener('beforeunload', (e) => { if (chatbotDirty()) { e.preventDefault(); e.returnValue = ''; } });
}
export const chatbotDirty = () => !!(S.dirty && S.draft);
// Izlazak iz taba (drugi tab portala, Sign out, Exit view) sa nesačuvanim izmjenama: pita, pa odbacuje nacrt.
export async function confirmLeaveChatbot() {
  if (!chatbotDirty()) return true;
  const ok = await window.JLUI.confirm('You have changes in the AI chatbot that are not saved. The chatbot is still using the last saved version. Leave and lose these changes?', { title: 'Unsaved changes', ok: 'Leave without saving' });
  if (ok) { S.dirty = false; S.draft = clone(S.cfg.settings); S.msg = ''; }
  return ok;
}

const clone = (settings) => ({
  page: settings.page === true,
  rules: { allowed: '', never: '', tone: '', handoff: '', ...(settings.rules || {}) },
  banned: (settings.banned || []).join('\n'),
  fields: { ...(settings.fields || {}) },
  examples: (settings.examples || []).map((x) => ({ q: x.q, a: x.a })),
  contact: settings.contact || '',
});
function adopt(cfg) {
  S.cfg = cfg;
  S.draft = clone(cfg.settings);
  S.dirty = false;
}
export async function openChatbot() {
  S.error = '';
  try {
    const r = await C.api('/api/portal/assistant/settings');
    if (!r.available) { S.cfg = { available: false }; C.rerender(); return; }
    if (!S.cfg?.available || !S.dirty) adopt(r);
    else S.cfg = r; // nesačuvane izmjene ostaju u nacrtu
  } catch (err) { S.error = err.message; }
  if (S.test.msgs === null && S.cfg?.available) { try { S.test.msgs = (await C.api('/api/portal/chatbot/test')).messages; } catch { S.test.msgs = []; } }
  C.rerender();
  if (S.sub === 'chats' || !S.chats) loadChats();
}
async function loadChats(more = false) {
  if (S.loadingChats) return;
  S.loadingChats = true;
  try {
    const q = new URLSearchParams({ filter: S.filter === 'needs' ? 'needs' : 'all' });
    if (more && S.chats?.next) q.set('before', S.chats.next);
    const r = await C.api(`/api/portal/chatbot/chats?${q}`);
    S.chats = more && S.chats ? { ...r, items: [...S.chats.items, ...r.items] } : r;
  } catch (err) { S.chats = { items: [], more: false, counts: { all: 0, needs: 0 }, error: err.message }; }
  S.loadingChats = false;
  if (C.P.tab === 'chatbot') C.rerender();
}

// ---------- Veličina teksta (isti obračun kao server: assistantSize) ----------
const LIMIT = () => S.cfg?.limit || 24000;
function sizeOf(d) {
  const n = (o) => Object.values(o || {}).reduce((t, v) => t + String(v || '').trim().length, 0);
  const banned = d.banned.split(/[\n,;]+/).map((x) => x.trim()).filter((x) => x.length >= 2).join(', ');
  return n(d.rules) + n(d.fields) + d.contact.trim().length + banned.length + d.examples.filter((x) => x.q.trim() && x.a.trim()).reduce((t, x) => t + x.q.trim().length + x.a.trim().length, 0);
}

// ---------- Prikaz ----------
export function chatbotView() {
  const { esc } = C;
  if (S.error && !S.cfg) return `<p class="empty" role="alert">${esc(S.error)}</p>`;
  if (!S.cfg) return '<p class="empty" role="status">Loading the chatbot…</p>';
  if (!S.cfg.available) return '<p class="empty">The AI chatbot is not available yet.</p>';
  const ro = C.readOnly();
  const on = S.cfg.settings.page;
  const needs = S.chats?.counts?.needs || 0;
  const tryUrl = C.P.leads?.find((l) => l.page?.url)?.page?.url;
  const subs = SUBS.map(([k, l]) => `<button type="button" class="cb-sub-btn ${S.sub === k ? 'on' : ''}" data-cb="sub" data-sub="${k}" ${S.sub === k ? 'aria-current="page"' : ''}>${l}${k === 'chats' && needs ? ` <span class="tab-badge">${needs}</span>` : ''}</button>`).join('');
  const body = S.sub === 'rules' ? rulesView(ro) : S.sub === 'knowledge' ? knowledgeView(ro) : S.sub === 'examples' ? examplesView(ro) : chatsView();
  const note = !S.cfg.settings.custom && S.sub !== 'chats' && S.sub !== 'knowledge' ? `<div class="cb-note" role="note"><b>We filled in recommended rules, example answers and blocked phrases for you.</b> They are what the chatbot follows right now. Read them, change whatever does not fit your store, then press Save to make them yours.</div>` : '';
  const main = S.sub === 'chats' ? body : `<div class="cb-layout"><div class="cb-main">${note}${body}</div><aside class="cb-test" id="cb-test" data-cb-test>${testerInner()}</aside></div>`;
  return `<section class="form-card cb-top">
      <label class="ghl-on cb-switch"><input type="checkbox" data-cb-page ${on ? 'checked' : ''} ${ro ? 'disabled' : ''} /><span><b>Chatbot on customer pages</b><em>${on ? 'On: every customer page has a "Questions? Ask us" button. Turn it off here and it disappears at once.' : 'Off: customers see their page without the chat. Turn it on here, it appears at once.'}</em></span></label>
      <p class="faint cb-intro">The chatbot answers <b>only</b> from the customer's own page and from what you write below: your rules, your knowledge and your examples. Prices are always exactly the ones on the customer's page. Whatever you save applies to the very next customer message.${on && tryUrl ? ` <a href="${esc(tryUrl)}?preview=1" target="_blank" rel="noopener">Try it on a customer page ↗</a> <span class="hint">(your test chats are kept apart and never notify you)</span>` : ''}</p>
    </section>
    <nav class="cb-subs" aria-label="AI chatbot">${subs}</nav>
    ${S.error ? `<p class="cb-err" role="alert">${esc(S.error)}</p>` : ''}
    ${main}`;
}
const counter = (key, v, max) => `<span class="cb-count" data-cb-count="${key}">${String(v || '').length} / ${max}</span>`;
function saveBar(ro) {
  if (ro) return '<p class="hint">Admin view is read-only.</p>';
  const size = sizeOf(S.draft);
  const over = size > LIMIT();
  return `<div class="pfoot cb-save"><button type="button" class="btn gold" data-cb="save" ${S.dirty && !S.busy && !over ? '' : 'disabled'}>${S.busy ? 'Saving…' : 'Save chatbot'}</button>
    <span class="psaved" data-cb-msg role="status">${S.dirty ? 'Unsaved changes. The chatbot still uses the last saved version.' : S.msg}</span>
    <button type="button" class="cb-link cb-tryjump" data-cb="jump">Try it ↓</button><span class="cb-meter ${over ? 'over' : ''}" data-cb-meter>${size.toLocaleString('en-US')} of ${LIMIT().toLocaleString('en-US')} characters</span></div>`;
}
function rulesView(ro) {
  const { esc } = C;
  const d = S.draft;
  const boxes = S.cfg.ruleFields.map((f) => {
    const v = d.rules[f.key] || '';
    return `<div class="cb-box"><div class="cb-lab"><span>${esc(f.label)}</span>${counter(`rule-${f.key}`, v, f.max)}</div>
      <textarea class="in" data-no-count rows="${f.key === 'tone' ? 3 : 6}" maxlength="${f.max}" data-cb-rule="${esc(f.key)}" placeholder="${esc(f.sample)}" ${ro ? 'readonly' : ''}>${esc(v)}</textarea>
      <p class="hint">${esc(f.hint)}${!v && !ro ? ` <button type="button" class="cb-link" data-cb="sample" data-key="${esc(f.key)}">Use the recommended text</button>` : ''}</p></div>`;
  }).join('');
  return `<p class="faint cb-lead">Write these the way you would brief a new salesperson. The chatbot follows them first, before its own habits.${ro ? '' : ' <button type="button" class="cb-link" data-cb="reset-rules">Reset to the recommended rules</button>'}</p>
    <div class="cb-rules">${boxes}
    <div class="cb-box"><div class="cb-lab"><span>Words and phrases it must never use</span>${counter('banned', d.banned, 600)}</div>
      <textarea class="in" data-no-count rows="3" maxlength="600" data-cb-banned placeholder="cheap&#10;guaranteed&#10;discount" ${ro ? 'readonly' : ''}>${esc(d.banned)}</textarea>
      <p class="hint">One per line. This is checked on every answer: if the chatbot uses one of these, the answer is not shown to the customer and the question goes to you instead.</p></div></div>
    ${saveBar(ro)}`;
}
function knowledgeView(ro) {
  const { esc } = C;
  const d = S.draft;
  const filled = S.cfg.fields.filter(([k]) => (d.fields[k] || '').trim()).length;
  return `<p class="faint cb-lead">Facts it may tell customers. Leave a box empty and the chatbot says your team will answer that personally. It never makes up prices, discounts or dates. <b>${filled} of ${S.cfg.fields.length} filled.</b> The more you fill in, the fewer questions reach your team.</p>
    <div class="as-grid">${S.cfg.fields.map(([k, label, hint]) => `<label><span class="cb-lab"><span>${esc(label)}</span>${counter(`field-${k}`, d.fields[k], 1500)}</span><textarea class="in" data-no-count rows="4" maxlength="1500" data-cb-field="${esc(k)}" placeholder="${esc(hint)}" ${ro ? 'readonly' : ''}>${esc(d.fields[k] || '')}</textarea></label>`).join('')}</div>
    <label class="as-contact"><span>How customers reach a real person (optional)</span><input class="in" data-no-count type="text" maxlength="300" data-cb-contact value="${esc(d.contact)}" placeholder="Text or call (303) 555-0100, Instagram @yourstore" ${ro ? 'readonly' : ''} /></label>
    ${saveBar(ro)}`;
}
const exRow = (x, i, ro, esc) => `<div class="as-q cb-ex"><input class="in" data-no-count type="text" maxlength="300" data-cb-exq="${i}" value="${esc(x.q)}" placeholder="What a customer might ask" ${ro ? 'readonly' : ''} /><textarea class="in" data-no-count rows="3" maxlength="800" data-cb-exa="${i}" placeholder="The answer exactly as you would send it" ${ro ? 'readonly' : ''}>${esc(x.a)}</textarea>${ro ? '' : `<button type="button" class="icon-x" data-cb="ex-del" data-i="${i}" aria-label="Remove this example">&times;</button>`}</div>`;
function examplesView(ro) {
  const { esc } = C;
  const ex = S.draft.examples;
  return `<p class="faint cb-lead">${ro ? '' : '<button type="button" class="cb-link cb-right" data-cb="reset-examples">Reset to the recommended examples</button>'}The fastest way to teach it. Write a question the way a customer would ask it and the answer the way you would send it. When someone asks something similar, the chatbot answers in the same way. A handful of good examples goes a long way, and you can add more from real chats under Conversations.</p>
    <div class="as-faq" data-cb-ex>${ex.length ? ex.map((x, i) => exRow(x, i, ro, esc)).join('') : '<p class="empty cb-empty">No examples yet.</p>'}</div>
    ${ro ? '' : `<div class="cb-addrow"><button type="button" class="btn small" data-cb="ex-add" ${ex.length >= 30 ? 'disabled' : ''}>+ Add an example</button><span class="hint">${ex.length} of 30. A row without an answer is not saved.</span></div>
    ${ex.length < 6 ? `<div class="cb-chips"><span class="hint">Common questions:</span>${COMMON.filter((q) => !ex.some((x) => x.q === q)).map((q) => `<button type="button" class="pa-s" data-cb="ex-add" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}`}
    ${saveBar(ro)}`;
}
function chatsView() {
  const { esc, when } = C;
  const c = S.chats;
  const counts = c?.counts || { all: 0, needs: 0 };
  const chips = [['all', `All ${counts.all}`], ['needs', `Needs you ${counts.needs}`]].map(([k, l]) => `<button type="button" class="chip ${S.filter === k ? 'on' : ''}" data-cb="filter" data-filter="${k}">${l}</button>`).join('');
  const rows = (c?.items || []).map((r) => `<button type="button" class="cb-chat ${r.handoff ? 'needs' : ''}" data-cb="open-chat" data-lead="${esc(r.leadId)}" data-name="${esc(r.name || '')}">
      <span class="cb-chat-top"><b>${esc(r.name || 'Customer')}</b>${r.ref ? `<span class="lead-ref">${esc(r.ref)}</span>` : ''}${r.piece ? `<span class="pill">${esc(piece(r.piece))}</span>` : ''}${r.handoff ? '<span class="pill ap-new">Needs you</span>' : ''}<span class="cb-chat-when">${esc(when(r.at))} · ${r.turns} question${r.turns === 1 ? '' : 's'}</span></span>
      <span class="cb-chat-last">${esc(r.last)}</span></button>`).join('');
  return `<p class="faint cb-lead">Every chat a customer had with the chatbot on their page. Open one to read it, save a good answer as an example, or teach the chatbot what to say when it had to pass a question to you.</p>
    <div class="cb-filters">${chips}</div>
    ${c?.error ? `<p class="cb-err">${esc(c.error)}</p>` : ''}
    ${!c ? '<p class="empty" role="status">Loading conversations…</p>' : rows ? `<div class="cb-chats">${rows}</div>${c.more ? `<button type="button" class="btn small" data-cb="more-chats" ${S.loadingChats ? 'disabled' : ''}>Load more</button>` : ''}` : `<p class="empty">${S.filter === 'needs' ? 'Nothing needs you right now.' : 'No customer has used the chatbot yet.'}</p>`}`;
}

// ---------- Rukovanje ----------
function updateBar() {
  const btn = C.app.querySelector('[data-cb="save"]');
  const size = sizeOf(S.draft);
  const over = size > LIMIT();
  if (btn) btn.disabled = !S.dirty || S.busy || over;
  const msg = C.app.querySelector('[data-cb-msg]');
  if (msg) msg.textContent = S.dirty ? 'Unsaved changes. The chatbot still uses the last saved version.' : S.msg;
  const meter = C.app.querySelector('[data-cb-meter]');
  if (meter) { meter.textContent = `${size.toLocaleString('en-US')} of ${LIMIT().toLocaleString('en-US')} characters`; meter.classList.toggle('over', over); }
}
function onInput(e) {
  if (C.P.tab !== 'chatbot' || !S.draft) return;
  const t = e.target;
  const d = S.draft;
  const set = (key, v, max) => { const el = C.app.querySelector(`[data-cb-count="${key}"]`); if (el) el.textContent = `${v.length} / ${max}`; };
  if (t.dataset.cbRule !== undefined) { d.rules[t.dataset.cbRule] = t.value; set(`rule-${t.dataset.cbRule}`, t.value, t.maxLength); }
  else if (t.dataset.cbField !== undefined) { d.fields[t.dataset.cbField] = t.value; set(`field-${t.dataset.cbField}`, t.value, t.maxLength); }
  else if (t.hasAttribute('data-cb-banned')) { d.banned = t.value; set('banned', t.value, 600); }
  else if (t.hasAttribute('data-cb-contact')) d.contact = t.value;
  else if (t.dataset.cbExq !== undefined) d.examples[Number(t.dataset.cbExq)].q = t.value;
  else if (t.dataset.cbExa !== undefined) d.examples[Number(t.dataset.cbExa)].a = t.value;
  else return;
  S.dirty = true;
  S.msg = '';
  updateBar();
}
async function save() {
  if (S.busy || !S.dirty) return;
  S.busy = true; S.error = ''; updateBar();
  try {
    const d = S.draft;
    const r = await C.api('/api/portal/assistant/settings', { method: 'PUT', body: JSON.stringify({ settings: { ...d, page: S.cfg.settings.page } }), json: true });
    adopt(r);
    S.msg = 'Saved. The chatbot uses this from the next customer message.';
  } catch (err) { S.error = err.message || 'Could not save.'; }
  S.busy = false;
  C.rerender();
}
async function setPage(on) {
  S.error = '';
  try {
    const r = await C.api('/api/portal/assistant/settings', { method: 'PUT', body: JSON.stringify({ settings: { onlyPage: true, page: on } }), json: true });
    S.cfg = r;
    S.draft.page = on;
  } catch (err) { S.error = err.message || 'Could not change the switch.'; }
  C.rerender();
}
function onClick(e) {
  if (C.P.tab !== 'chatbot') return;
  const t = e.target.closest('[data-cb]');
  if (!t) return;
  const a = t.dataset.cb;
  const d = S.draft;
  if (a === 'sub') { S.sub = t.dataset.sub; C.rerender(); if (S.sub === 'chats') loadChats(); }
  else if (a === 'save') save();
  else if (a === 'sample') { const f = S.cfg.ruleFields.find((x) => x.key === t.dataset.key); d.rules[f.key] = f.sample; S.dirty = true; C.rerender(); }
  else if (a === 'ex-add') { if (d.examples.length < 30) { d.examples.push({ q: t.dataset.q || '', a: '' }); S.dirty = true; C.rerender(); const rows = C.app.querySelectorAll('[data-cb-exa]'); rows[rows.length - 1]?.focus(); } }
  else if (a === 'ex-del') { d.examples.splice(Number(t.dataset.i), 1); S.dirty = true; C.rerender(); }
  else if (a === 'filter') { S.filter = t.dataset.filter; S.chats = null; C.rerender(); loadChats(); }
  else if (a === 'more-chats') loadChats(true);
  else if (a === 'open-chat') openTranscript(t.dataset.lead, t.dataset.name);
  else if (a === 'reset-rules') { d.rules = { ...S.cfg.defaults.rules }; d.banned = S.cfg.defaults.banned.join('\n'); S.dirty = true; C.rerender(); }
  else if (a === 'reset-examples') { d.examples = S.cfg.defaults.examples.map((x) => ({ q: x.q, a: x.a })); S.dirty = true; C.rerender(); }
  else if (a === 'jump') C.app.querySelector('[data-cb-test]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else if (a === 'test-sugg') sendTest(t.dataset.q);
  else if (a === 'test-reset') resetTest();
  else if (a === 'test-example') testToExample(Number(t.dataset.i));
}

// ---------- Probni chat: odgovara po pravilima kakva su trenutno napisana, i prije snimanja ----------
function testerInner() {
  const { esc } = C;
  const t = S.test;
  const ro = C.readOnly();
  const leads = (C.P.leads || []).filter((l) => l.page?.url).slice(0, 25);
  const opts = `<option value="">Sample customer (Alex, grillz)</option>${leads.map((l) => `<option value="${esc(l.id)}" ${t.lead === l.id ? 'selected' : ''}>${esc(l.name || 'Customer')}${l.ref ? ` · ${esc(l.ref)}` : ''}</option>`).join('')}`;
  const msgs = t.msgs || [];
  const bubbles = msgs.map((m, i) => {
    if (m.role === 'user') return `<div class="cb-t-m cb-t-u"><p>${esc(m.text)}</p></div>`;
    const notes = [
      m.why ? `<span class="cb-t-note warn">Blocked: ${esc(m.why)} The customer would see this hand-off message instead.</span>` : (m.tags || []).includes('team') ? '<span class="cb-t-note">The question would go to your team.</span>' : '',
      (m.tags || []).includes('deposit') ? '<span class="cb-t-note">Shows a "Reserve with a deposit" button.</span>' : '',
      (m.tags || []).includes('book') ? '<span class="cb-t-note">Shows a "Book" button.</span>' : '',
    ].join('');
    return `<div class="cb-t-m cb-t-a${m.error ? ' err' : ''}"><p>${esc(m.text).replace(/\n/g, '<br />')}</p>${notes}${!ro && !m.error && !m.why && i > 0 ? `<button type="button" class="cb-link" data-cb="test-example" data-i="${i}">Save as example</button>` : ''}</div>`;
  }).join('');
  return `<div class="cb-t-head"><div><p class="cb-t-kick">Try it</p><h3>Test the chatbot</h3></div>${msgs.length ? '<button type="button" class="cb-link" data-cb="test-reset">Clear</button>' : ''}</div>
    <p class="cb-t-sub">It answers with the rules <b>as written right now</b>, even before you save. Nothing is sent to a customer, saved on a lead or counted.</p>
    <label class="cb-t-lead"><span>Test with</span><select class="in" data-no-count data-cb-testlead>${opts}</select></label>
    <div class="cb-t-log" data-cb-testlog>${bubbles || '<p class="cb-t-empty">Ask it something a customer would ask.</p>'}${t.busy ? '<div class="cb-t-m cb-t-a"><span class="pa-dots" aria-label="Thinking"><i></i><i></i><i></i></span></div>' : ''}</div>
    ${msgs.length ? '' : `<div class="cb-t-sugg">${TRY.map((q) => `<button type="button" class="pa-s" data-cb="test-sugg" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`}
    <form class="pa-form cb-t-form" data-cb-testform><textarea data-no-count data-cb-testin rows="1" maxlength="600" placeholder="Type a customer question" aria-label="Test question"></textarea><button type="submit" class="pa-send" aria-label="Send" ${t.busy ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>`;
}
function redrawTester() {
  const el = C.app.querySelector('[data-cb-test]');
  if (!el) return;
  const input = el.querySelector('[data-cb-testin]');
  const value = input?.value || '';
  const focused = document.activeElement === input;
  el.innerHTML = testerInner();
  const n = el.querySelector('[data-cb-testin]');
  if (n) { n.value = value; if (focused) n.focus({ preventScroll: true }); }
  const log = el.querySelector('[data-cb-testlog]');
  if (log) log.scrollTop = log.scrollHeight;
}
const draftForTest = () => ({ rules: S.draft.rules, banned: S.draft.banned, fields: S.draft.fields, examples: S.draft.examples, contact: S.draft.contact });
async function sendTest(text) {
  const q = String(text || '').trim();
  const t = S.test;
  if (!q || t.busy || !S.draft) return;
  t.busy = true;
  t.msgs = [...(t.msgs || []), { role: 'user', text: q }];
  const box = C.app.querySelector('[data-cb-testin]');
  if (box) box.value = '';
  redrawTester();
  try {
    const r = await C.api('/api/portal/chatbot/test', { method: 'POST', body: JSON.stringify({ message: q, leadId: t.lead, settings: draftForTest() }), json: true });
    t.msgs.push({ role: 'assistant', text: r.reply, tags: r.tags || [], why: r.why || '' });
  } catch (err) { t.msgs.push({ role: 'assistant', text: err.message || 'Something went wrong. Try again.', tags: [], why: '', error: true }); }
  t.busy = false;
  redrawTester();
}
async function resetTest() {
  S.test.msgs = [];
  redrawTester();
  try { await C.api('/api/portal/chatbot/test/reset', { method: 'POST' }); } catch {}
}
async function pickTestLead(id) {
  S.test.lead = id;
  await resetTest();
}
// "Save as example" iz probnog chata: pitanje + odgovor idu u nacrt primjera (snimaju se tek sa Save).
function testToExample(i) {
  const m = S.test.msgs?.[i];
  const q = [...(S.test.msgs || []).slice(0, i)].reverse().find((x) => x.role === 'user')?.text;
  if (!m || !q || !S.draft) return;
  if (S.draft.examples.length >= 30) { S.error = 'The limit is 30 examples. Remove one in Examples first.'; C.rerender(); return; }
  const k = S.draft.examples.findIndex((x) => x.q.toLowerCase() === q.toLowerCase());
  if (k < 0) S.draft.examples.push({ q, a: m.text }); else S.draft.examples[k].a = m.text;
  S.dirty = true;
  S.msg = '';
  S.error = '';
  C.rerender();
  const bar = C.app.querySelector('[data-cb-msg]');
  if (bar) bar.textContent = 'Added to Examples (not saved yet). Press Save to keep it.';
}

// ---------- Razgovor kupca (dijalog): čitanje, "Use as example" i "Mark as handled" ----------
export async function openTranscript(leadId, name = '') {
  const { esc, when } = C;
  const d = document.createElement('dialog');
  d.className = 'chat-log-dlg';
  d.innerHTML = `<div class="cl-head"><h2>Chat${name ? ` · ${esc(name)}` : ''}</h2><button type="button" class="icon-x" data-close aria-label="Close">&times;</button></div><div class="cl-body"><p class="faint">Loading…</p></div>`;
  document.body.appendChild(d);
  let changed = false;
  d.addEventListener('click', (ev) => {
    if (ev.target === d || ev.target.closest('[data-close]')) d.close();
  });
  d.addEventListener('close', () => { d.remove(); if (changed && C.P.tab === 'chatbot') { S.chats = null; C.rerender(); loadChats(); } });
  d.showModal();
  const body = d.querySelector('.cl-body');
  let r;
  try { r = await C.api(`/api/portal/leads/${encodeURIComponent(leadId)}/chat`); }
  catch (err) { body.innerHTML = `<p class="faint">${esc(err.message)}</p>`; return; }
  const ro = C.readOnly();
  const draw = () => {
    body.innerHTML = (r.handoff && !ro ? `<div class="cl-handoff"><span>The chatbot passed a question to you.</span><button type="button" class="btn small" data-act2="handled">Mark as handled</button></div>` : '')
      + (r.messages.length ? r.messages.map((m, i) => {
        const team = m.role === 'assistant' && m.tags?.includes('team');
        const q = m.role === 'assistant' ? [...r.messages.slice(0, i)].reverse().find((x) => x.role === 'user')?.text || '' : '';
        return `<div class="cl-m ${m.role === 'user' ? 'cl-u' : 'cl-a'}"><p class="cl-who">${m.role === 'user' ? esc(name || 'Customer') : 'Chatbot'} · ${esc(when(m.at))}</p><p>${esc(m.text).replace(/\n/g, '<br />')}</p>${team ? '<p class="cl-flag">Passed to you</p>' : ''}
          ${m.role === 'assistant' && q && !ro ? `<div class="cl-teach" data-i="${i}"><button type="button" class="cb-link" data-act2="teach-open" data-i="${i}">${team ? 'Teach the chatbot' : 'Use as example'}</button></div>` : ''}</div>`;
      }).join('') : '<p class="faint">No messages yet.</p>');
  };
  draw();
  body.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act2]');
    if (!b) return;
    if (b.dataset.act2 === 'handled') {
      try { await C.api(`/api/portal/leads/${encodeURIComponent(leadId)}/chat/handled`, { method: 'POST' }); r.handoff = false; changed = true; draw(); } catch (err) { body.insertAdjacentHTML('afterbegin', `<p class="cb-err">${esc(err.message)}</p>`); }
    } else if (b.dataset.act2 === 'teach-open') {
      const i = Number(b.dataset.i);
      const m = r.messages[i];
      const team = m.tags?.includes('team');
      const q = [...r.messages.slice(0, i)].reverse().find((x) => x.role === 'user')?.text || '';
      b.closest('.cl-teach').innerHTML = `<label class="cl-tl"><span>Customer asked</span><input class="in" data-no-count type="text" maxlength="300" data-tq value="${esc(q)}" /></label>
        <label class="cl-tl"><span>${team ? 'The answer you would give' : 'The answer the chatbot should give'}</span><textarea class="in" data-no-count rows="4" maxlength="800" data-ta placeholder="Write it exactly as you would send it">${team ? '' : esc(m.text)}</textarea></label>
        <div class="cl-tact"><button type="button" class="btn gold small" data-act2="teach-save">Save as example</button><button type="button" class="btn small ghost" data-act2="teach-cancel" data-i="${i}">Cancel</button><span class="psaved" data-tmsg></span></div>`;
    } else if (b.dataset.act2 === 'teach-cancel') {
      draw();
    } else if (b.dataset.act2 === 'teach-save') {
      const box = b.closest('.cl-teach');
      const q = box.querySelector('[data-tq]').value.trim();
      const a = box.querySelector('[data-ta]').value.trim();
      const msg = box.querySelector('[data-tmsg]');
      if (!q || !a) { msg.textContent = 'Write the answer first.'; return; }
      b.disabled = true; msg.textContent = 'Saving…';
      try {
        const res = await C.api('/api/portal/chatbot/teach', { method: 'POST', body: JSON.stringify({ q, a, leadId }), json: true });
        const wasDirty = S.dirty;
        S.cfg = res;
        if (S.draft) { const k = S.draft.examples.findIndex((x) => x.q.toLowerCase() === q.toLowerCase()); if (k < 0) S.draft.examples.push({ q, a }); else S.draft.examples[k].a = a; }
        if (!wasDirty && S.draft) S.draft = clone(res.settings);
        r.handoff = false; changed = true;
        box.innerHTML = '<p class="cl-saved">Saved as an example. The chatbot uses it from the next customer message.</p>';
      } catch (err) { b.disabled = false; msg.textContent = err.message || 'Could not save.'; }
    }
  });
}
