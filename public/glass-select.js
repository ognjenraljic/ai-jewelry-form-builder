// Stakleni padajući meni za sve <select> na sajtu (builder, forma, početna).
// Polje ostaje pravi <select> (isti izgled, vrijednost, change događaji), mijenja se samo lista koja se otvori:
// umjesto sistemske, staklena lista ispod polja. Radi i za polja koja nastanu kasnije (builder stalno crta iznova).
// Izuzetak: <select multiple> i <select data-native> ostaju sistemski.
(() => {
  if (window.__glassSelect) return;
  window.__glassSelect = true;

  const css = `
.gsel-menu { position: fixed; z-index: 2147483000; box-sizing: border-box; min-width: 160px; max-width: min(380px, calc(100vw - 16px)); overflow-y: auto; overscroll-behavior: contain;
  padding: 6px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--ink, #eef6f5) 14%, transparent);
  background: color-mix(in srgb, var(--surface, #121b1e) 58%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(1.5); backdrop-filter: blur(18px) saturate(1.5);
  box-shadow: 0 18px 50px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 color-mix(in srgb, #fff 8%, transparent);
  color: var(--ink, #eef6f5); font-size: 13px; animation: gsel-in 0.14s ease-out; }
.gsel-menu.up { animation-name: gsel-up; }
@keyframes gsel-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@keyframes gsel-up { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.gsel-opt { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 9px; cursor: pointer; line-height: 1.35; user-select: none; }
.gsel-opt span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gsel-opt.act { background: color-mix(in srgb, var(--ink, #eef6f5) 9%, transparent); }
.gsel-opt.on { color: var(--ink, #eef6f5); font-weight: 600; background: color-mix(in srgb, var(--accent, #35d0c4) 16%, transparent); }
.gsel-opt.on.act { background: color-mix(in srgb, var(--accent, #35d0c4) 24%, transparent); }
.gsel-opt[aria-disabled="true"] { opacity: 0.4; cursor: default; }
.gsel-opt svg { width: 14px; height: 14px; flex: none; color: var(--accent, #35d0c4); }
@media (prefers-reduced-motion: reduce) { .gsel-menu { animation: none; } }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cur = null; // { sel, menu, opts, act }
  let seq = 0;

  const usable = (sel) => sel && sel.tagName === 'SELECT' && !sel.multiple && !sel.disabled && !sel.hasAttribute('data-native');
  // Kutija ispod koje se lista otvara: omotač sa natpisom u builderu (.dd), inače samo polje.
  const anchorOf = (sel) => sel.closest('.dd') || sel;

  function place() {
    if (!cur) return;
    const r = anchorOf(cur.sel).getBoundingClientRect();
    const m = cur.menu;
    const gap = 6;
    // U ugrađenoj formi (iframe) "ekran" je samo dio koji se vidi na sajtu zlatara (javlja embed.js).
    const vp = window.__aikVp;
    const vTop = vp ? vp.top : 0;
    const vBottom = vp ? vp.top + vp.height : innerHeight;
    const below = vBottom - r.bottom - gap - 8;
    const above = r.top - vTop - gap - 8;
    m.style.minWidth = `${Math.max(160, r.width)}px`;
    m.style.maxHeight = '';
    const want = Math.min(m.scrollHeight, 340);
    // Ispod polja; gore samo kad ispod nema mjesta (npr. polje na dnu ugrađene forme).
    const up = below < Math.min(want, 160) && above > below;
    const room = Math.max(120, up ? above : below);
    m.style.maxHeight = `${Math.min(340, room)}px`;
    m.classList.toggle('up', up);
    const h = Math.min(want, room);
    m.style.top = `${up ? r.top - gap - h : r.bottom + gap}px`;
    const w = m.offsetWidth;
    m.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  }

// Lista ide ispod polja: ako dolje nema mjesta, pomjeri stranicu (ili panel u kojem je polje) tek toliko da stane.
  function makeRoom(anchor, need) {
    if (window.__aikVp) return; // u iframe-u se stranica zlatara ne može pomjeriti odavde
    const below = innerHeight - anchor.getBoundingClientRect().bottom - 14;
    if (below >= need) return;
    let box = anchor.parentElement;
    while (box && box !== document.body) {
      const oy = getComputedStyle(box).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight) break;
      box = box.parentElement;
    }
    const sc = box && box !== document.body ? box : document.scrollingElement;
    const left = sc.scrollHeight - sc.clientHeight - sc.scrollTop;
    const d = Math.min(need - below, left);
    if (d > 0) sc.scrollTop += d;
  }

  function highlight(i, scroll = true) {
    if (!cur) return;
    cur.act = i;
    cur.opts.forEach((el, k) => el.classList.toggle('act', k === i));
    // Čitač ekrana prati aktivnu opciju dok fokus ostaje na polju.
    if (cur.opts[i]) cur.sel.setAttribute('aria-activedescendant', cur.opts[i].id);
    if (scroll && cur.opts[i]) cur.opts[i].scrollIntoView({ block: 'nearest' });
  }

  function open(sel) {
    close();
    const menu = document.createElement('div');
    menu.className = 'gsel-menu';
    menu.setAttribute('role', 'listbox');
    menu.id = `gsel-${++seq}`;
    if (sel.getAttribute('aria-label') || sel.labels?.[0]) menu.setAttribute('aria-label', sel.getAttribute('aria-label') || sel.labels[0].textContent.trim());
    const font = getComputedStyle(sel).fontFamily;
    if (font) menu.style.fontFamily = font;
    const list = [...sel.options];
    menu.innerHTML = list.map((o, i) => `<div class="gsel-opt ${o.selected ? 'on' : ''}" role="option" id="${menu.id}-${i}" data-i="${i}" aria-selected="${o.selected}" ${o.disabled ? 'aria-disabled="true"' : ''}><span>${esc(o.label || o.text)}</span>${o.selected ? CHECK : ''}</div>`).join('');
    // U otvorenom <dialog> (gornji sloj) lista mora biti unutar dijaloga, inače ostaje iza njega.
    (sel.closest('dialog[open]') || document.body).appendChild(menu);
    cur = { sel, menu, opts: [...menu.children], act: Math.max(0, sel.selectedIndex) };
    sel.setAttribute('aria-expanded', 'true');
    sel.setAttribute('aria-controls', menu.id);
    makeRoom(anchorOf(sel), Math.min(menu.scrollHeight, 340));
    place();
    highlight(cur.act);
    menu.addEventListener('mousemove', (e) => { const o = e.target.closest('.gsel-opt'); if (o && +o.dataset.i !== cur.act) highlight(+o.dataset.i, false); });
    menu.addEventListener('click', (e) => { const o = e.target.closest('.gsel-opt'); if (o) choose(+o.dataset.i); });
  }

  function close() {
    if (!cur) return;
    cur.sel.removeAttribute('aria-expanded');
    cur.sel.removeAttribute('aria-activedescendant');
    cur.sel.removeAttribute('aria-controls');
    cur.menu.remove();
    cur = null;
  }

  function choose(i) {
    if (!cur) return;
    const { sel } = cur;
    const o = sel.options[i];
    if (!o || o.disabled) return;
    close();
    sel.focus({ preventScroll: true });
    if (sel.selectedIndex === i) return;
    sel.selectedIndex = i;
    // Isti događaji kao kod sistemske liste, da postojeći kod (onchange, change slušači) radi bez izmjena.
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const selectFrom = (target) => {
    const t = target.closest?.('select, .dd');
    if (!t) return null;
    return t.tagName === 'SELECT' ? t : t.querySelector('select');
  };

  // Miš: zaustavi sistemsku listu i otvori staklenu (drugi klik zatvara).
  document.addEventListener('mousedown', (e) => {
    if (cur && cur.menu.contains(e.target)) return;
    const sel = e.button === 0 ? selectFrom(e.target) : null;
    if (usable(sel)) {
      e.preventDefault();
      const same = cur && cur.sel === sel;
      close();
      sel.focus({ preventScroll: true });
      if (!same) open(sel);
      return;
    }
    close();
  }, true);

  // Dodir: sistemski izbirač se otvara na fokus poslije dodira, pa ga sprječavamo na kraju dodira (ne kod skrolovanja).
  let touch = null;
  document.addEventListener('touchstart', (e) => { const t = e.touches[0]; touch = t ? { x: t.clientX, y: t.clientY } : null; }, { passive: true, capture: true });
  document.addEventListener('touchend', (e) => {
    if (cur && cur.menu.contains(e.target)) return;
    const t = e.changedTouches[0];
    const moved = touch && t && Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > 10;
    const sel = moved ? null : selectFrom(e.target);
    if (usable(sel)) {
      e.preventDefault();
      const same = cur && cur.sel === sel;
      close();
      if (!same) open(sel);
      return;
    }
    if (!moved) close();
  }, { passive: false, capture: true });

  // Tastatura: Space/Enter/Alt+↓ otvaraju; strelice, Enter, Escape i slova rade u otvorenoj listi.
  document.addEventListener('keydown', (e) => {
    if (cur) {
      const n = cur.opts.length;
      const step = (d) => { let i = cur.act; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!cur.sel.options[i].disabled) return i; } return cur.act; };
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight(step(1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(step(-1)); }
      else if (e.key === 'Home') { e.preventDefault(); highlight(0); }
      else if (e.key === 'End') { e.preventDefault(); highlight(n - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(cur.act); }
      else if (e.key === 'Escape') { e.preventDefault(); const s = cur.sel; close(); s.focus({ preventScroll: true }); }
      else if (e.key === 'Tab') close();
      else if (e.key.length === 1) {
        const k = e.key.toLowerCase();
        const i = [...cur.sel.options].findIndex((o, j) => j > cur.act && o.text.trim().toLowerCase().startsWith(k));
        const j = i >= 0 ? i : [...cur.sel.options].findIndex((o) => o.text.trim().toLowerCase().startsWith(k));
        if (j >= 0) highlight(j);
      }
      return;
    }
    const sel = e.target;
    if (usable(sel) && (e.key === ' ' || e.key === 'Enter' || (e.altKey && e.key === 'ArrowDown'))) { e.preventDefault(); open(sel); }
  }, true);

  // Skrol van liste ili promjena veličine prozora: lista prati polje, a zatvara se kad polje nestane.
  document.addEventListener('scroll', (e) => { if (cur && !cur.menu.contains(e.target)) { if (!cur.sel.isConnected) close(); else place(); } }, true);
  addEventListener('resize', () => { if (cur) place(); });
  addEventListener('blur', close);
})();
