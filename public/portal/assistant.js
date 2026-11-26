// Asistent portala (26.11.2026): dugme dolje desno otvara panel; pitanja o korištenju portala i o brojevima.
// Istorija razgovora je na serveru (po sesiji portala), ovdje se samo crta.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TAB_LABEL = { leads: 'Open Leads', forms: 'Open Forms', pricing: 'Open Pricing', bookings: 'Open Bookings', stats: 'Open Stats', notifications: 'Open Notifications', metals: 'Open Metal movement', chatbot: 'Open AI chatbot' };
const fmt = (t) => esc(t).replace(/\n/g, '<br />');

export function mount({ api, store, goTab }) {
  if (document.getElementById('pa-fab')) return;
  const wrap = document.createElement('div');
  wrap.className = 'pa';
  wrap.innerHTML = `
    <button type="button" class="pa-fab" id="pa-fab" aria-controls="pa-panel" aria-expanded="false" title="Ask the JewelryLead assistant">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span>Ask</span></button>
    <section class="pa-panel" id="pa-panel" role="dialog" aria-labelledby="pa-title" hidden>
      <header class="pa-head"><div><p class="pa-kicker">JewelryLead assistant</p><h2 id="pa-title">How can I help?</h2></div>
        <button type="button" class="pa-x" data-pa-close aria-label="Close">&times;</button></header>
      <div class="pa-log" id="pa-log" aria-live="polite"></div>
      <div class="pa-sugg" id="pa-sugg"></div>
      <form class="pa-form" id="pa-form"><textarea id="pa-in" rows="1" maxlength="600" data-no-count placeholder="Ask about your leads or the portal" aria-label="Your question"></textarea>
        <button type="submit" class="pa-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>
      <p class="pa-fine">AI answers from your portal data. Numbers are counted by the server; check the Stats tab for details.</p>
    </section>`;
  document.body.appendChild(wrap);
  const fab = wrap.querySelector('#pa-fab');
  const panel = wrap.querySelector('#pa-panel');
  const log = wrap.querySelector('#pa-log');
  const sugg = wrap.querySelector('#pa-sugg');
  const form = wrap.querySelector('#pa-form');
  const input = wrap.querySelector('#pa-in');
  let loaded = false;
  let busy = false;

  const bubble = (role, text, tags = []) => {
    const el = document.createElement('div');
    el.className = `pa-m ${role === 'user' ? 'pa-u' : 'pa-a'}`;
    el.innerHTML = `<p>${fmt(text)}</p>${tags.filter((t) => t.startsWith('tab:') && TAB_LABEL[t.slice(4)]).map((t) => `<button type="button" class="pa-chip" data-pa-tab="${esc(t.slice(4))}">${TAB_LABEL[t.slice(4)]}</button>`).join('')}`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };
  const showSuggestions = (list) => {
    sugg.innerHTML = list.map((q) => `<button type="button" class="pa-s">${esc(q)}</button>`).join('');
    sugg.hidden = !list.length;
  };
  async function load() {
    loaded = true;
    bubble('assistant', `Hi, I am the JewelryLead assistant for ${store}. Ask me how to do something in the portal, or about your numbers, like leads this month or which piece sells best.`);
    try {
      const r = await api('/api/portal/assistant');
      for (const m of r.messages) bubble(m.role, m.text, m.tags || []);
      showSuggestions(r.messages.length ? [] : r.suggestions);
    } catch { showSuggestions([]); }
  }
  async function send(text) {
    const q = text.trim();
    if (!q || busy) return;
    busy = true;
    showSuggestions([]);
    bubble('user', q);
    input.value = '';
    input.style.height = '';
    const wait = bubble('assistant', '');
    wait.classList.add('pa-wait');
    wait.innerHTML = '<span class="pa-dots" aria-label="Thinking"><i></i><i></i><i></i></span>';
    try {
      const r = await api('/api/portal/assistant', { method: 'POST', body: JSON.stringify({ message: q }), json: true });
      wait.remove();
      bubble('assistant', r.reply, r.tags || []);
    } catch (err) {
      wait.remove();
      bubble('assistant', err.message || 'Something went wrong. Please try again.');
    } finally { busy = false; input.focus(); }
  }
  const open = (on) => {
    panel.hidden = !on;
    fab.setAttribute('aria-expanded', String(on));
    wrap.classList.toggle('open', on);
    if (on) { if (!loaded) load(); setTimeout(() => input.focus(), 30); }
  };
  fab.addEventListener('click', () => open(panel.hidden));
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-pa-close]')) open(false);
    const s = e.target.closest('.pa-s');
    if (s) send(s.textContent);
    const t = e.target.closest('[data-pa-tab]');
    if (t) { goTab(t.dataset.paTab); if (matchMedia('(max-width: 700px)').matches) open(false); }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
  input.addEventListener('input', () => { input.style.height = ''; input.style.height = `${Math.min(120, input.scrollHeight)}px`; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden && !document.querySelector('dialog[open]')) open(false); });
}
