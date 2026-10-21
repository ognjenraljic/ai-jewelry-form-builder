// Zajednički glass dijalozi i prevlačenje fotografija, bez browserovih prompt prozora.
(() => {
  const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function dialog(message, { input = false, color = false, alert = false, title = input ? 'Add an option' : alert ? 'Please check' : 'Confirm', value = '', ok = input ? 'Add' : alert ? 'Got it' : 'Continue' } = {}) {
    return new Promise((resolve) => {
      const previous = document.activeElement;
      const el = document.createElement('dialog');
      el.className = 'jl-dialog';
      el.innerHTML = `<form method="dialog"><h2>${escape(title)}</h2><p>${escape(message)}</p>${input ? `<input class="jl-input" name="answer" aria-label="${color ? 'Metal name' : 'Option name'}" value="${escape(value)}" maxlength="${color ? 40 : 80}" required autocomplete="off" />` : ''}${color ? '<label class="jl-color"><span>Circle color</span><input type="color" name="swatch" value="#c0c4c8" /></label>' : ''}<div class="jl-actions">${alert ? '' : '<button class="jl-button" value="cancel" formnovalidate>Cancel</button>'}<button class="jl-button primary" value="ok">${escape(ok)}</button></div></form>`;
      let result = input ? null : false;
      el.querySelector('form').addEventListener('submit', (e) => {
        if (e.submitter?.value !== 'ok') return;
        const label = input ? el.querySelector('[name="answer"]').value.trim() : '';
        if (input && !label) { e.preventDefault(); el.querySelector('[name="answer"]').focus(); return; }
        result = color ? { label, swatch: el.querySelector('[name="swatch"]').value } : input ? label : true;
      });
      el.addEventListener('close', () => { el.remove(); previous?.focus?.({ preventScroll: true }); resolve(result); }, { once: true });
      document.body.appendChild(el);
      el.showModal();
    });
  }
  function uploadBusy(el, busy, text = 'Uploading photo…') {
    if (!el) return;
    el.classList.toggle('jl-uploading', busy);
    el.setAttribute('aria-busy', String(busy));
    el.querySelector(':scope > .jl-upload-progress')?.remove();
    if (busy) {
      const progress = document.createElement('span');
      progress.className = 'jl-upload-progress'; progress.setAttribute('role', 'status');
      progress.innerHTML = `<span class="jl-spinner"></span><span>${escape(text)}</span>`;
      el.appendChild(progress);
    }
  }
  // Čuva već učitane <img> elemente kroz redraw: ostale kartice ne trepere crno.
  function images(root) {
    const byUrl = new Map();
    root.querySelectorAll('img').forEach((img) => {
      if (!img.complete || !img.naturalWidth) return;
      const key = img.getAttribute('src');
      if (!byUrl.has(key)) byUrl.set(key, []);
      byUrl.get(key).push(img);
    });
    return () => root.querySelectorAll('img').forEach((img) => {
      const old = byUrl.get(img.getAttribute('src'))?.shift();
      if (!old) return;
      old.className = img.className;
      old.alt = img.alt;
      for (const a of [...old.attributes]) if (a.name.startsWith('data-')) old.removeAttribute(a.name);
      for (const a of img.attributes) if (a.name.startsWith('data-')) old.setAttribute(a.name, a.value);
      img.replaceWith(old);
    });
  }
  function dropTarget(target) {
    const box = target.closest?.('label, [data-upload-box]');
    const file = box?.querySelector('input[type="file"]');
    return file && !file.disabled && !box.classList.contains('jl-uploading') ? { box, file } : null;
  }
  for (const name of ['dragenter', 'dragover']) document.addEventListener(name, (e) => {
    const target = dropTarget(e.target);
    if (!target) { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); return; }
    e.preventDefault(); target.box.classList.add('jl-dragover');
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('dragleave', (e) => {
    const target = dropTarget(e.target);
    if (target && !target.box.contains(e.relatedTarget)) target.box.classList.remove('jl-dragover');
  });
  document.addEventListener('drop', (e) => {
    const target = dropTarget(e.target);
    if (!target) { if (e.dataTransfer?.files.length) e.preventDefault(); return; }
    e.preventDefault(); target.box.classList.remove('jl-dragover');
    if (!e.dataTransfer?.files.length) return;
    const dt = new DataTransfer(); dt.items.add(e.dataTransfer.files[0]);
    target.file.files = dt.files;
    target.file.dispatchEvent(new Event('change', { bubbles: true }));
  });
  window.JLUI = { confirm: (m, o) => dialog(m, o), prompt: (m, o) => dialog(m, { ...o, input: true }), material: (m, o) => dialog(m, { ...o, input: true, color: true }), alert: (m) => dialog(m, { alert: true }), uploadBusy, images };
})();
