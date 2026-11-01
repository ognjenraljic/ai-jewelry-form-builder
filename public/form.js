import { SMILE_TEETH, SMILE_DEFS } from './teeth-art.js';
import { applyPresetTeeth } from './grillz-selection.js';
import { stepNeedsAnswer, fieldRequired } from './step-rules.js';

// Widget forme: crta korake iz konfiguracije, šalje lead, traži render i doradu.
const formId = location.pathname.split('/')[2] || 'demo';
const app = document.getElementById('app');

const ICONS = {
  pendant: '<path d="M8 6c4 9 9 14 16 14s12-5 16-14"/><path d="M24 20v4"/><path d="M24 24l-7 8 7 11 7-11z"/><path d="M17 32h14M24 24v19"/>',
  chain: '<ellipse cx="9" cy="24" rx="6" ry="4"/><ellipse cx="19" cy="24" rx="4" ry="6"/><ellipse cx="29" cy="24" rx="6" ry="4"/><ellipse cx="39" cy="24" rx="4" ry="6"/>',
  ring: '<circle cx="24" cy="31" r="12"/><circle cx="24" cy="31" r="9"/><path d="M18 14l3-5h6l3 5-6 6z"/><path d="M18 14h12"/>',
  grillz: '<path d="M7 17c0 11 8 17 17 17s17-6 17-17z"/><path d="M13 18v8M18.5 18v12M24 18v13M29.5 18v12M35 18v8"/>',
  bracelet: '<ellipse cx="24" cy="24" rx="17" ry="11"/><ellipse cx="24" cy="24" rx="12" ry="6.5"/><path d="M10 18l3 2M38 18l-3 2M10 30l3-2M38 30l-3-2M24 13v4.5M24 35v-4.5"/>',
  earrings: '<circle cx="14" cy="9" r="3"/><path d="M14 12v4"/><path d="M14 16l-5 8 5 11 5-11z"/><circle cx="34" cy="9" r="3"/><path d="M34 12v4"/><path d="M34 16l-5 8 5 11 5-11z"/>',
  watch: '<rect x="14" y="14" width="20" height="20" rx="6"/><path d="M18 14l2-9h8l2 9M18 34l2 9h8l2-9"/><path d="M24 19v5l4 3"/>',
  upload: '<path d="M24 31V11M16 18l8-8 8 8"/><path d="M10 29v6a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4v-6"/>',
  gem: '<path d="M14 8h20l8 11-18 22L6 19z"/><path d="M6 19h36M18 8l-4 11 10 22 10-22-4-11"/>',
};
const icon = (name) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const S = {
  cfg: null,
  i: 0,
  a: {},
  contact: { name: '', email: '', phone: '', consent: false },
  files: {}, // polje (ili polje__more) -> { blob, url, name }
  uploading: new Set(),
  onboardingPreview: new URLSearchParams(location.search).has('onboarding'),
  test: false, // probni render iz pregleda u builderu (admin, bez upita)
  tryons: [], // grillz na fotografiji kupca: [{ url, base }], base = product preview number
  tryBusy: false,
  tryLeft: 2,
  testInfo: null,
  mask: { on: false, strokes: [], size: 'm' }, // označeni dio slike za doradu
  lead: null,
  renders: [],
  shown: 0,
  busy: false,
  error: '',
  rendered: -1,
  model: null,
  dev: null,
  adminPreview: false, // builder javlja da je admin prijavljen (probni render)
  adv: null, // tajmer za automatski prelaz na sljedeći korak
  focusKey: '', // šta vratiti u fokus poslije ponovnog crtanja
  fresh: false, // nova slika: animacija pojavljivanja samo tada
  tryOk: false, // pristanak za fotografiju (proba na osmijehu)
  ts: '', // Turnstile token
};
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LEAD_KEY = `aik_lead:${formId}`;
const ss = { get: (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} }, del: (k) => { try { sessionStorage.removeItem(k); } catch {} } };
// Kratka najava za čitače ekrana (korak, greška), umjesto da se svaki put čita cijela forma.
function announce(text) {
  const el = document.getElementById('sr');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 30);
}

boot();

async function boot() {
  try {
    const res = await fetch(S.onboardingPreview ? '/api/portal/onboarding/preview' : `/api/forms/${encodeURIComponent(formId)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    S.cfg = S.onboardingPreview ? data.form : data;
  } catch {
    app.innerHTML = '<section class="step unavailable"><h1>This form is not available</h1><p class="sub">It may have been turned off by the jeweler. Please contact the store directly, or try again later.</p></section>';
    return;
  }
  applyTheme();
  applyDefaults();
  S.model = S.cfg.dev?.defaultModel || null;
  // Osvježena stranica poslije slanja: vrati kupca na njegov rezultat (upit i token su u ovom tabu).
  if (!new URLSearchParams(location.search).has('preview')) await restoreLead();
  render();
  if (window.parent !== window) initEmbed();
  // Živi pregled u builderu: nacrt stiže preko postMessage, samo sa istog porijekla i samo uz ?preview.
  if (new URLSearchParams(location.search).has('preview')) {
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      if (e.data?.type === 'aik:test' && testAllowed() && !S.busy) { startTest(); return; }
      if (e.data?.type !== 'aik:preview' || !e.data.form) return;
      S.adminPreview = !!e.data.admin;
      S.cfg = { ...e.data.form, dev: S.cfg.dev, turnstile: S.cfg.turnstile };
      // Odgovori koji u novoj verziji forme (ili za drugi komad) više ne postoje se brišu.
      const prune = () => {
        for (const step of S.cfg.steps) for (const field of step.fields) {
          if (field.options && field.id !== 'type' && S.a[field.id] != null && !optionsOf(field).some((x) => x.value === S.a[field.id])) delete S.a[field.id];
        }
        if (S.a.style && !(S.cfg.styles?.[S.a.type] || []).some((x) => x.value === S.a.style)) delete S.a.style;
      };
      if (S.onboardingPreview) prune();
      // Dok probni render traje (ili je prikazan), izmjena u builderu ne prebacuje pregled na drugi korak.
      if (S.test || S.busy) { applyTheme(); return; }
      // Mekani skok (sinhronizacija sa Questions): ne diraj odgovore koje je admin već kliknuo u pregledu.
      if (e.data.answers) {
        if (e.data.soft) { for (const [k, v] of Object.entries(e.data.answers)) if (S.a[k] == null) S.a[k] = v; }
        else Object.assign(S.a, e.data.answers);
        prune();
      }
      applyTheme();
      applyDefaults();
      // Pregled preporuka (kartica Shop products): kraj forme bez pravog rendera.
      if (e.data.products) { S.productsPreview = true; S.i = steps().length - 1; }
      else if (typeof e.data.step === 'number' || e.data.stepId) {
        S.productsPreview = false;
        const idx = steps().findIndex((st) => st === S.cfg.steps[e.data.step] || st.id === e.data.stepId || (e.data.step >= S.cfg.steps.length && st.id === '_contact'));
        if (idx >= 0 || !e.data.soft) S.i = Math.max(0, idx);
      }
      if (!S.productsPreview) S.i = Math.min(S.i, steps().length - 2);
      if (!S.onboardingPreview) S.rendered = -1;
      render();
      if (e.data.focus) focusField(e.data.focus);
      // Javi builderu na kom je koraku pregled stvarno (skok na korak koji se trenutno ne vidi ostaje na mjestu).
      parent.postMessage({ type: 'aik:at', step: cur().id }, location.origin);
    });
    parent.postMessage({ type: 'aik:preview-ready' }, location.origin);
    // Klik na pitanje u pregledu: builder otvori i pokaže to pitanje u Questions.
    app.addEventListener('click', (e) => {
      const el = e.target.closest('[data-pick],[data-select],[data-text],[data-tfield],[data-drop]');
      const id = el && (el.dataset.pick || el.dataset.select || el.dataset.text || el.dataset.tfield || el.dataset.drop);
      if (id) parent.postMessage({ type: 'aik:field', field: id.replace(/__more$/, '') }, location.origin);
    }, true);
  }
  if (parent !== window) {
    let lastHeight = 0;
    // Measure the content, not the iframe viewport, so shorter steps can shrink too.
    new ResizeObserver(() => {
      const height = Math.ceil(app.getBoundingClientRect().height);
      if (height === lastHeight) return;
      lastHeight = height;
      parent.postMessage({ type: 'aik:resize', form: formId, height }, '*');
    }).observe(app);
  }
}

// Tema zlatara: svaka vrijednost postaje CSS varijabla (samo boje, ime iz sigurnog skupa znakova).
function applyTheme() {
  const root = document.documentElement;
  root.removeAttribute('style');
  for (const [k, v] of Object.entries(S.cfg.theme || {})) {
    if (/^[a-z0-9-]+$/.test(k) && /^#[0-9a-f]{3,8}$/i.test(v)) root.style.setProperty(`--${k}`, v);
  }
}

// Podrazumijevane vrijednosti (npr. komad "grillz" kad je korak izbora komada isključen).
function applyDefaults() {
  for (const st of S.cfg.steps) for (const f of st.fields) if (f.default != null && (st.enabled === false || S.a[f.id] == null)) S.a[f.id] = f.default;
  applyPresetTeeth(S.cfg, S.a);
}

// Koraci: uključeni konfigurisani + kontakt + rezultat
const steps = () => [...S.cfg.steps.filter((st) => st.enabled !== false && st.fields.some(visible)), { id: '_contact', label: 'Details' }, { id: '_result', label: 'Preview' }];
const cur = () => steps()[S.i];

function visible(f) {
  if (f.enabled === false) return false;
  // Pitanje koje zlatar za ovaj komad ne nudi (perPiece: []) se preskače.
  if (Array.isArray(f.perPiece?.[S.a.type]) && !f.perPiece[S.a.type].length) return false;
  const c = f.showIf;
  if (!c) return true;
  const v = S.a[c.field];
  if (c.in) return c.in.includes(v);
  if (c.notIn) return v != null && !c.notIn.includes(v);
  return true;
}

// Stilovi zavise od izabranog tipa; "Something else" je zadnji (bez reference), osim ako ga zlatar isključi.
const optionsOf = (f) => {
  if (f.optionsFrom?.styles) {
    const list = (S.cfg.styles?.[S.a[f.optionsFrom.field]] || []).map(({ value, label, image }) => ({ value, label, image }));
    return f.other === false ? list : [...list, { value: 'other', label: 'Something else', icon: 'gem' }];
  }
  // Svaki komad ima svoje opcije (npr. grillz bez platine, svoj budžet).
  const allow = f.perPiece?.[S.a.type];
  return Array.isArray(allow) ? allow.map((v) => (f.options || []).find((o) => o.value === v)).filter(Boolean) : f.options || [];
};

function stepValid(step) {
  if (S.uploading.size) return false;
  if (step.id === '_contact') {
    const c = S.contact;
    return c.name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim()) && c.phone.replace(/\D/g, '').length >= 7 && c.consent && (!S.cfg.turnstile || !!S.ts);
  }
  const shown = (step.fields || []).filter(visible);
  const filled = (f) => (f.type === 'upload' ? !!S.files[f.id] : String(S.a[f.id] ?? '').trim() !== '');
  if (stepNeedsAnswer(step, S.a) && shown.length && !shown.some(filled)) return false;
  return shown.every((f) => !fieldRequired(S.cfg, step, f, S.a) || filled(f));
}
// Korak bez kojeg se ne može dalje (oznaka u formi).
const stepIsRequired = (step) => stepNeedsAnswer(step, S.a) || step.fields.filter(visible).some((f) => fieldRequired(S.cfg, step, f, S.a));

function render() {
  const restoreImages = JLUI.images(app);
  const step = cur();
  const all = steps();
  const canBack = S.i > 0 && (step.id !== '_result' || S.test);
  // Pređeni koraci su dugmad: klik vraća na taj korak (ne poslije slanja, kad je upit već poslat).
  const progress = all
    .slice(0, -1)
    .map((s, k) => (canBack && k < S.i
      ? `<button type="button" class="seg done" data-goto="${k}" title="Back to ${esc(s.label)}" aria-label="Back to ${esc(s.label)}"></button>`
      : `<span class="seg ${k < S.i ? 'done' : k === S.i ? 'now' : ''}" title="${esc(s.label)}" aria-hidden="true"></span>`))
    .join('');
  const enter = S.i !== S.rendered ? 'enter' : '';
  S.rendered = S.i;

  let body = '';
  if (step.id === '_contact') body = contactView();
  else if (step.id === '_result') body = resultView();
  else body = stepView(step);

  // Logo zlatara: veći i centriran iznad trake koraka. Bez logoa ime brenda ostaje desno, kao do sada.
  const logo = S.cfg.brand?.logo;
  app.innerHTML = `
    ${logo ? `<div class="brand-head"><img class="brand-logo" src="${esc(logo)}" alt="${esc(S.cfg.brand?.name || '')}" /></div>` : ''}
    <header class="top">
      <button class="back" data-act="back" ${canBack ? '' : 'hidden'} aria-label="Back">&larr; Back</button>
      <nav class="progress ${enter}" aria-label="Steps">${progress}</nav>
      ${logo ? '<span class="top-pad" aria-hidden="true"></span>' : `<span class="brand">${esc(S.cfg.brand?.name || '')}</span>`}
    </header>
    ${body}`;
  if (enter) app.querySelector('.step')?.classList.add('enter');
  restoreImages();
  bind();
  // Fokus ostaje na onome što je kupac kliknuo (tastatura i čitači ekrana ne gube mjesto).
  if (S.focusKey) { app.querySelector(S.focusKey)?.focus({ preventScroll: true }); S.focusKey = ''; }
  S.fresh = false;
  placeFoot();
}

function stepView(step) {
  const fields = step.fields.filter(visible).map(fieldView).join('');
  const valid = stepValid(step);
  const subtitle = S.a.type === 'grillz' && step.fields.some(f => f.id === 'style') ? 'Pick a style. You can change the exact teeth in the next step.' : step.subtitle;
  return `
    <section class="step">
      <p class="eyebrow">Step ${S.i + 1} of ${steps().length - 1}${stepIsRequired(step) ? ' · Required' : ''}</p>
      <h1>${esc(step.title)}</h1>
      <p class="sub">${esc(subtitle || '')}</p>
      ${fields}
      <div class="foot">
        <div class="foot-row">${backBtn()}<button class="btn" data-act="next" ${valid ? '' : 'disabled'}>Continue</button></div>
        <p class="hint">${footHint(step, valid)}</p>
      </div>
    </section>`;
}

// Na koraku sa zubima traka uvijek pokazuje izbor (na telefonu prekriva zbir u panelu dok se ne skroluje).
function footHint(step, valid) {
  const tf = step.fields.find((f) => f.type === 'teeth' && visible(f));
  if (tf) {
    const set = teethSet(S.a[tf.id]);
    const top = [...set].filter((t) => t[0] === 'T').length;
    if (set.size) return `<span class="foot-teeth"><b>${top}</b> top + <b>${set.size - top}</b> bottom = <b>${set.size}</b> teeth</span>`;
  }
  return valid ? '' : step.fields.some((f) => visible(f) && f.options) || step.fields.some((f) => f.optionsFrom) ? 'Choose an option to continue' : 'Fill this in to continue';
}

// Pregled u builderu: pokaži i kratko istakni pitanje koje je admin otvorio lijevo.
function focusField(id) {
  const sel = ['data-pick', 'data-select', 'data-text', 'data-tfield', 'data-drop'].map((a) => `[${a}="${CSS.escape(id)}"]`).join(',');
  const el = app.querySelector(sel)?.closest('.field');
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
}

// Grillz na osmijehu kupca: poslije rendera kupac ubaci svoju fotografiju i vidi sebe sa tim grillzima.
function tryOnView() {
  if (S.cfg.tryOn === false || S.a.type !== 'grillz' || !S.lead || S.test || !S.renders.length || S.busy) return '';
  const current = S.tryons.filter((t) => t.base === S.shown + 1);
  const earlier = S.tryons.filter((t) => t.base == null);
  const imgs = [...current, ...earlier].map((t) => `<figure><img src="${esc(t.url)}" alt="You wearing your grillz" /><figcaption>${t.base == null ? 'Earlier try-on' : 'On your smile'}</figcaption></figure>`).join('');
  const action = S.tryBusy
    ? `<div class="tryon-wait"><span class="spin"></span>Putting them on your smile… about 20 to 40 seconds</div>`
    : S.tryLeft > 0
      ? `<label class="check tryon-ok"><input type="checkbox" data-tryok ${S.tryOk ? 'checked' : ''} /><span>I agree that my photo is used only to create this preview. It is deleted after 30 days.</span></label>
         <label class="btn ghost tryon-btn ${S.tryOk ? '' : 'off'}">${icon('upload')}<span>${current.length ? 'Try another photo' : 'Upload a smiling photo'}<small>or drag & drop here</small></span><input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp" data-tryon ${S.tryOk ? '' : 'disabled'} /></label>`
      : '<p class="fine">You have used all your try-ons.</p>';
  return `
    <section class="tryon">
      <div class="tryon-head"><b>See them on your smile</b><span>Upload a photo of you smiling with your teeth showing. We will show you wearing the design above.</span></div>
      ${imgs ? `<div class="tryon-imgs">${imgs}</div>` : ''}
      ${!imgs && S.tryons.length ? '<p class="fine">Choose another design preview above to see its try-on.</p>' : ''}
      ${action}
      ${S.tryErr ? `<p class="error">${esc(S.tryErr)}</p>` : ''}
      <p class="fine">Shared only with ${esc(S.cfg.brand?.name || 'the jeweler')}.</p>
    </section>`;
}

async function doTryOn(file) {
  if (!file || S.tryBusy || !S.lead) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { JLUI.alert('Please choose a JPG, PNG or WebP photo.'); return; }
  const base = S.shown + 1;
  S.tryBusy = true;
  S.tryErr = '';
  render();
  try {
    // Smanji fotografiju u browseru (do 1536 px): manji upload, isti izgled.
    let blob = file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1536 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      blob = (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))) || file;
    } catch {}
    const fd = new FormData();
    fd.set('token', S.lead.token);
    fd.set('base', String(base));
    fd.set('photo', blob, 'smile.jpg');
    fd.set('consent', 'yes');
    const res = await fetch(`/api/leads/${S.lead.leadId}/tryon`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    S.tryons.push({ url: data.url, base: data.base });
    S.tryLeft = data.remaining;
    parent.postMessage({ type: 'aik:tryon', form: formId }, '*');
  } catch (e) {
    S.tryErr = e.message;
  } finally {
    S.tryBusy = false;
    render();
  }
}

// ---------- Ugrađena forma (iframe na sajtu zlatara) ----------
// embed.js javlja koji dio forme se vidi na ekranu; traka sa Continue tada ostaje pri dnu ekrana, kao na samom linku.
function initEmbed() {
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || e.data?.type !== 'aik:viewport') return;
    const { top, height } = e.data;
    if (!(height > 0)) return;
    window.__aikVp = { top: Math.max(0, +top || 0), height: +height };
    placeFoot();
  });
}
function placeFoot() {
  const foot = app.querySelector('.foot');
  const vp = window.__aikVp;
  if (!foot || !vp || new URLSearchParams(location.search).has('preview')) return;
  foot.style.transform = '';
  foot.classList.remove('floating');
  const r = foot.getBoundingClientRect();
  const bottom = vp.top + vp.height;
  // Ako je traka ispod vidljivog dijela, podigni je do dna ekrana (ali ne iznad sadržaja koraka).
  if (r.bottom > bottom && bottom - r.height > app.getBoundingClientRect().top + 160) {
    foot.style.transform = `translateY(${Math.round(bottom - r.bottom - 6)}px)`;
    foot.classList.add('floating');
  }
}

// Turnstile (Cloudflare provjera protiv botova) na koraku sa kontaktom, samo kad je uključen za sajt.
function mountTurnstile() {
  const box = app.querySelector('#ts');
  const draw = () => window.turnstile?.render(box, {
    sitekey: S.cfg.turnstile, theme: 'auto', size: 'flexible',
    callback: (t) => { S.ts = t; const b = app.querySelector('[data-act="submit"]'); if (b) b.disabled = !stepValid(cur()) || S.busy; },
    'expired-callback': () => { S.ts = ''; },
  });
  if (window.turnstile) return draw();
  if (!document.getElementById('ts-js')) {
    const sc = document.createElement('script');
    sc.id = 'ts-js';
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    sc.async = true;
    sc.onload = () => app.querySelector('#ts') && draw();
    document.head.appendChild(sc);
  }
}

const backBtn = () => (S.i > 0 ? '<button type="button" class="btn ghost" data-act="back" aria-label="Previous step">Back</button>' : '');

function fieldView(f) {
  const label = (f.label ? `<span class="label" id="lbl-${esc(f.id)}">${esc(f.label)}</span>` : '') + (f.subtitle ? `<p class="field-sub">${esc(f.subtitle)}</p>` : '');
  const v = S.a[f.id];
  return choiceView(f, label, v) + (v != null && v !== '' && f.followup ? followupView(f) : '');
}

// Dodatno polje poslije izbora: tekst ili fotografija (custom pitanja iz buildera).
function followupView(f) {
  const key = `${f.id}__more`;
  if (f.followup === 'file') return uploadView({ id: key, hint: '' }, '<span class="label">Add a photo (optional)</span>');
  return `<label class="field more"><span class="label">Add details (optional)</span><input class="input" data-text="${esc(key)}" maxlength="500" value="${esc(S.a[key] || '')}" /></label>`;
}

function uploadView(f, label) {
  const file = S.files[f.id];
  const busy = S.uploading.has(f.id);
  const progress = busy ? '<span class="jl-upload-progress" role="status"><span class="jl-spinner"></span>Preparing photo…</span>' : '';
  if (file) {
    return `<div class="field">${label}<label class="drop thumb ${busy ? 'jl-uploading' : ''}" data-drop="${esc(f.id)}"><img src="${file.url}" alt="" /><span class="meta">${esc(file.name)}<br />Click or drop a photo to replace</span><input type="file" accept="image/jpeg,image/png,image/webp" data-file="${esc(f.id)}" ${busy ? 'disabled' : ''} />${progress}</label><button type="button" class="link" data-unfile="${esc(f.id)}">Remove</button></div>`;
  }
  return `<div class="field">${label}<label class="drop ${busy ? 'jl-uploading' : ''}" data-drop="${esc(f.id)}">${icon('upload')}<p><strong>Upload a photo</strong> or drag it here<br />${esc(f.hint || '')}</p><input type="file" accept="image/jpeg,image/png,image/webp" data-file="${esc(f.id)}" ${busy ? 'disabled' : ''} />${progress}</label></div>`;
}

function choiceView(f, label, v) {
  if (f.type === 'cards') {
    const opts = optionsOf(f);
    const pics = opts.some((o) => o.image);
    return `<div class="field">${label}<div class="cards ${pics ? 'pics' : ''}" role="radiogroup" aria-labelledby="${f.label ? `lbl-${esc(f.id)}` : 'step-title'}">${opts
      .map((o) => `<button type="button" class="card ${o.image ? 'pic' : ''} ${v === o.value ? 'on' : ''}" role="radio" aria-checked="${v === o.value}" data-pick="${esc(f.id)}" data-val="${esc(o.value)}">${o.image ? `<img src="${esc(o.image)}" alt="" loading="lazy" />` : icon(o.icon)}<span>${esc(o.label)}</span></button>`)
      .join('')}</div></div>`;
  }
  if (f.type === 'chips' || f.type === 'yesno') {
    const opts = optionsOf(f);
    return `<div class="field">${label}<div class="chips ${f.big ? 'big' : ''} ${opts.some((o) => o.image) ? 'pics' : ''}" role="radiogroup" aria-labelledby="${f.label ? `lbl-${esc(f.id)}` : 'step-title'}">${opts
      .map((o) => `<button type="button" class="chip ${o.image ? 'pic' : ''} ${v === o.value ? 'on' : ''}" role="radio" aria-checked="${v === o.value}" data-pick="${esc(f.id)}" data-val="${esc(o.value)}">${o.image ? `<img src="${esc(o.image)}" alt="" loading="lazy" />` : o.swatch ? `<i class="dot" style="background:${esc(o.swatch)}"></i>` : ''}${esc(o.label)}</button>`)
      .join('')}</div></div>`;
  }
  if (f.type === 'dropdown') {
    return `<label class="field">${label}<select class="input select" data-select="${esc(f.id)}"><option value="">Choose…</option>${optionsOf(f)
      .map((o) => `<option value="${esc(o.value)}" ${v === o.value ? 'selected' : ''}>${esc(o.label)}</option>`)
      .join('')}</select></label>`;
  }
  if (f.type === 'text') {
    return `<label class="field">${label}<input class="input" data-text="${esc(f.id)}" maxlength="${f.max || 100}" placeholder="${esc(f.placeholder || '')}" value="${esc(v || '')}" /></label>`;
  }
  if (f.type === 'textarea') {
    return `<label class="field">${label}<textarea class="textarea" data-text="${esc(f.id)}" maxlength="${f.max || 600}" placeholder="${esc(f.placeholder || '')}">${esc(v || '')}</textarea><div class="count" data-count="${esc(f.id)}">${(v || '').length}/${f.max || 600}</div></label>`;
  }
  if (f.type === 'upload') return uploadView(f, label);
  if (f.type === 'teeth') return teethView(f, label, v);
  return '';
}

// ---------- Izbor zuba (grillz) ----------
// Zapis kao u src/teeth.js: "T5,T6,B5", 1-10 slijeva nadesno spreda, 5 i 6 centralni sjekutići.
const T_ORDER = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10];
const T_RANGE = (r, n) => T_ORDER.slice(0, n).map((i) => r + i);
const T_PRESETS = [
  ['single', 'Single', [...T_RANGE('T', 1)]],
  ['two', '2 Piece', [...T_RANGE('T', 2)]],
  ['classic6', 'Classic 6', [...T_RANGE('T', 6)]],
  ['top8', '8 Top', [...T_RANGE('T', 8)]],
  ['six-six', '6 on 6', [...T_RANGE('T', 6), ...T_RANGE('B', 6)]],
  ['full', 'Full Set', [...T_RANGE('T', 10), ...T_RANGE('B', 10)]],
];
const teethSet = (v) => new Set(String(v || '').split(',').filter(Boolean));
const teethVal = (set) => [...set].sort((x, y) => (x[0] === y[0] ? +x.slice(1) - +y.slice(1) : x[0] === 'T' ? -1 : 1)).join(',');

// Smile approved in the visual preview. IDs retain their existing server/prompt meaning.
const SELECTED_FILL = { 'yellow-gold': '#e3b85a', 'white-gold': '#dfe2e5', platinum: '#d6d9dd', 'rose-gold': '#e2a690', 'two-tone': '#e3b85a' };
function mouthSvg(f, set) {
  const prefix = `mouth-${f.id.replace(/[^a-z0-9_-]/gi, '')}`;
  const scope = (markup) => markup.replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`).replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);
  const custom = S.cfg.steps.flatMap((s) => s.fields).find((x) => x.id === 'metal')?.options?.find((o) => o.value === S.a.metal)?.swatch;
  const selected = SELECTED_FILL[S.a.metal] || (/^#[0-9a-f]{6}$/i.test(custom || '') ? custom : '#c8c5bf');
  const teeth = SMILE_TEETH.map((t) => {
    const selectable = !t.id.includes('decor');
    const on = selectable && set.has(t.id);
    const attrs = selectable ? ` data-tooth="${t.id}" data-tfield="${esc(f.id)}" role="checkbox" aria-checked="${on}" aria-label="${t.row === 'T' ? 'Top' : 'Bottom'} tooth ${t.id.slice(1)}" tabindex="0"` : '';
    return `<g class="tooth ${on ? 'on' : ''} ${selectable ? '' : 'deco'}"${attrs}><path class="crown" d="${t.d}" fill="${on ? selected : `url(#${prefix}-enamel)`}"/><path class="tooth-depth" d="${t.d}" fill="url(#${prefix}-enamelSides)"/></g>`;
  }).join('');
  return `<svg class="mouth" viewBox="48 48 578 235" role="group" aria-label="Choose teeth">
    <defs>${scope(SMILE_DEFS)}</defs>
    ${teeth}
  </svg>`;
}

function teethView(f, label, v) {
  const set = teethSet(v);
  const top = [...set].filter((t) => t[0] === 'T').length;
  const bottom = set.size - top;
  const counter = (r, n, name) => `<div class="tcount"><button type="button" class="tbtn" data-tstep="${r}" data-d="-1" data-tfield="${esc(f.id)}" ${n ? '' : 'disabled'} aria-label="Fewer ${name.toLowerCase()} teeth">&minus;</button><div><b>${n}</b><span>${name} teeth</span></div><button type="button" class="tbtn" data-tstep="${r}" data-d="1" data-tfield="${esc(f.id)}" ${n < 10 ? '' : 'disabled'} aria-label="More ${name.toLowerCase()} teeth">+</button></div>`;
  const presets = T_PRESETS.map(([key, name, list]) => {
    const on = list.length === set.size && list.every((t) => set.has(t));
    return `<button type="button" class="tpreset ${on ? 'on' : ''}" data-tpreset="${key}" data-tfield="${esc(f.id)}">${name}<small>${list.length}t</small></button>`;
  }).join('');
  return `<div class="field">${label}<div class="teeth">${mouthSvg(f, set)}<div class="tpanel">
    ${counter('T', top, 'Top')}${counter('B', bottom, 'Bottom')}
    <div class="tpresets">${presets}</div>
    <div class="tsum"><div><b>${top}</b><span>Top</span></div><i>+</i><div><b>${bottom}</b><span>Bottom</span></div><div class="ttotal"><b>${set.size}</b><span>Total</span></div></div>
  </div></div></div>`;
}

function setTeeth(id, set) {
  if (set.size) S.a[id] = teethVal(set); else delete S.a[id];
  render();
}


function contactView() {
  const c = S.contact;
  const k = S.cfg.contact;
  const valid = stepValid(cur());
  return `
    <section class="step">
      <p class="eyebrow">Almost there</p>
      <h1>${esc(k.title)}</h1>
      <p class="sub">${esc(k.subtitle)}</p>
      <label class="field"><span class="label">Full name</span><input class="input" data-c="name" autocomplete="name" value="${esc(c.name)}" /></label>
      <div class="row2">
        <label class="field"><span class="label">Email</span><input class="input" type="email" data-c="email" autocomplete="email" value="${esc(c.email)}" /></label>
        <label class="field"><span class="label">Phone</span><input class="input" type="tel" data-c="phone" autocomplete="tel" value="${esc(c.phone)}" /></label>
      </div>
      <label class="check"><input type="checkbox" data-c="consent" ${c.consent ? 'checked' : ''} /><span>${esc(k.consent)}</span></label>
      ${S.cfg.turnstile ? '<div class="ts" id="ts"></div>' : ''}
      ${S.error ? `<p class="error" role="alert">${esc(S.error)}</p>` : ''}
      <div class="foot">
        <div class="foot-row">${S.busy ? '' : backBtn()}<button class="btn gold" data-act="submit" ${valid && !S.busy && !S.onboardingPreview ? '' : 'disabled'}>${S.onboardingPreview ? 'Preview only' : S.busy ? 'Sending' : esc(k.button)}</button></div>
        <p class="hint">We never share your details.</p>
        ${testAllowed() ? '<button type="button" class="btn ghost testbtn" data-act="test" title="Uses this draft and the answers above. Costs one render, no lead is created.">Test render (admin, no lead)</button>' : ''}
      </div>
    </section>`;
}

function resultView() {
  const r = S.cfg.result;
  const shown = S.renders[S.shown];
  const left = S.test ? Infinity : S.cfg.maxRenders - S.renders.length;
  const marking = S.mask.on && shown && !S.busy;
  const stage = S.busy
    ? `<div class="forge"><div class="forge-inner">${icon('gem').replace('<svg', '<svg class="gem"')}<div class="forge-msg" data-msg>${esc(r.loading[0])}</div><div class="forge-time" data-time aria-hidden="true">0s</div></div></div>`
    : shown
      ? `<img class="${S.fresh ? 'fresh' : ''}" src="${esc(shown.url)}" alt="AI preview of your custom piece" />${marking ? '<canvas class="maskc" data-mask aria-label="Paint over the area to change"></canvas>' : ''}`
      : '';
  const strip = S.renders.length > 1
    ? `<div class="strip">${S.renders.map((x, k) => `<button class="${k === S.shown ? 'on' : ''}" data-show="${k}" aria-label="Preview ${k + 1}"><img src="${esc(x.url)}" alt="" /></button>`).join('')}</div>`
    : '';
  // Dorada: cijela slika ili samo označeni dio (kupac preko slike oboji dio koji želi da promijeni).
  const sizes = [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']].map(([k, l]) => `<button type="button" class="chip ${S.mask.size === k ? 'on' : ''}" data-brush="${k}">${l}</button>`).join('');
  const maskbar = `<div class="maskbar">
      <span class="maskhint">Change:</span>
      <button type="button" class="chip ${S.mask.on ? '' : 'on'}" data-act="mask-off" aria-pressed="${!S.mask.on}">Whole image</button>
      <button type="button" class="chip ${S.mask.on ? 'on' : ''}" data-act="mask-toggle" aria-pressed="${S.mask.on}">Only one area</button>
      ${S.mask.on ? `<span class="maskline"><span class="maskhint">Paint over the part to change. Brush:</span>${sizes}<button type="button" class="link" data-act="mask-clear" ${S.mask.strokes.length ? '' : 'hidden'}>Clear</button></span>` : ''}
    </div>`;
  const tweak = !S.busy && S.renders.length && left > 0
    ? `${maskbar}<div class="tweak"><input class="input" data-tweak maxlength="300" value="${esc(S.tweakDraft || '')}" placeholder="${S.mask.on ? 'What should change in the marked area? e.g. make this tooth plain gold' : 'Want a change? e.g. make the letters bigger'}" /><button class="btn gold" data-act="tweak">${S.mask.on ? 'Change area' : 'Refine'}${S.test ? '' : ` (${left})`}</button></div>`
    : '';
  const testNote = S.test && S.testInfo && !S.busy ? `<p class="fine testnote">Test render, no lead saved · ${esc(S.testInfo.model)} · ${(S.testInfo.ms / 1000).toFixed(1)} s · $${(S.testInfo.costUsd || 0).toFixed(3)}</p>` : '';
  const dev = S.cfg.dev ? devView() : '';
  const failed = !S.busy && !S.renders.length && !S.productsPreview;
  const head = S.test && !S.busy && !failed
    ? ['Test render', 'Here it <em>is</em>', 'This is how customers will see it. Nothing was saved as a lead.']
    : S.busy
    ? ['Creating your preview', 'Bringing it <em>to life</em>', 'This takes about 15 to 30 seconds.']
    : failed
      ? ['Your design', 'Almost <em>there</em>', 'Your details are saved. We hit a snag creating the preview.']
      : S.productsPreview && !S.renders.length
        ? ['Your design', 'Here it <em>is</em>', 'Preview: the customer\'s AI render appears here, with your shop products under it.']
        : ['Your design', 'Here it <em>is</em>', esc(r.done)];
  return `
    <section class="step">
      <p class="eyebrow">${head[0]}</p>
      <h1>${head[1]}</h1>
      <p class="sub">${head[2]}</p>
      ${failed ? '' : `<div class="stage">${stage || (S.productsPreview ? `<div class="forge"><div class="forge-inner">${icon('gem').replace('<svg', '<svg class="gem"')}<div class="forge-msg">AI preview</div></div></div>` : '')}</div>`}
      ${strip}
      ${S.error ? `<p class="error">${esc(S.error)}</p>${!S.renders.length && !S.busy ? '<div class="foot"><button class="btn gold" data-act="retry">Try again</button></div>' : ''}` : ''}
      ${tweak}
      ${!S.busy && S.renders.length ? `<p class="fine">${esc(r.disclaimer)}</p>` : ''}
      ${testNote}
      ${tryOnView()}
      ${productsView()}
      ${!S.test && S.lead && !S.busy && S.renders.length ? '<p class="fine restart"><button type="button" class="link" data-act="restart">Start a new design</button></p>' : ''}
      ${dev}
    </section>`;
}

// Preporuke iz radnje zlatara ispod rendera: prvo proizvodi za komad kupca, pa oni za sve komade (do 6).
function productsView() {
  if (S.busy && !S.productsPreview) return '';
  const all = S.cfg.products || [];
  const mine = all.filter((x) => x.pieces?.includes(S.a.type));
  const list = [...mine, ...all.filter((x) => !x.pieces?.length)].slice(0, 6);
  if (!list.length) return '';
  const card = (x) => {
    const inner = `${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy" />` : `<span class="noimg">${icon('gem')}</span>`}<span class="pinfo"><b>${esc(x.name)}</b>${x.price ? `<span class="price">${esc(x.price)}</span>` : ''}${x.description ? `<small>${esc(x.description)}</small>` : ''}${x.url ? '<span class="plink">View in shop</span>' : ''}</span>`;
    return x.url ? `<a class="pcard" href="${esc(x.url)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="pcard">${inner}</div>`;
  };
  return `<div class="products"><h2>${esc(S.cfg.result?.productsTitle || 'Recommended from our shop')}</h2><div class="pgrid">${list.map(card).join('')}</div></div>`;
}

function devView() {
  const opts = S.cfg.dev.models.map((m) => `<option value="${m.key}" ${m.key === S.model ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
  const d = S.dev;
  const info = d
    ? d.error
      ? `<div>greška: ${esc(d.error)}</div>`
      : `<div>${esc(d.model)} · ${(d.ms / 1000).toFixed(1)} s · ${d.inTokens} in / ${d.outTokens} out · ~$${d.costUsd.toFixed(4)}</div><details><summary>prompt</summary><pre>${esc(d.prompt)}</pre></details>`
    : '';
  return `<div class="devbar">DEV model: <select data-model>${opts}</select> ${!S.busy && S.renders.length < S.cfg.maxRenders ? '<button class="link" data-act="again">novi render</button>' : ''}${info}</div>`;
}

function bind() {
  app.querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', () => {
      const changed = S.a[b.dataset.pick] !== b.dataset.val;
      S.a[b.dataset.pick] = b.dataset.val;
      // Skrivena polja čistimo da ne ostanu u odgovorima
      for (const f of cur().fields) if (!visible(f)) delete S.a[f.id];
      // Promjena tipa poništava stil (opcije stila zavise od tipa)
      if (changed) for (const st of S.cfg.steps) for (const f of st.fields) if (f.optionsFrom?.field === b.dataset.pick) delete S.a[f.id];
      // Novi komad: odgovori koje taj komad ne nudi (metal, budžet...) se brišu.
      if (changed && b.dataset.pick === 'type') for (const st of S.cfg.steps) for (const f of st.fields) if (f.perPiece && S.a[f.id] != null && !optionsOf(f).some((o) => o.value === S.a[f.id])) delete S.a[f.id];
      if (changed && b.dataset.pick === 'style') for (const st of S.cfg.steps) for (const f of st.fields) if (f.type === 'teeth') delete S.a[f.id];
      applyPresetTeeth(S.cfg, S.a);
      S.focusKey = `[data-pick="${CSS.escape(b.dataset.pick)}"][data-val="${CSS.escape(b.dataset.val)}"]`;
      render();
      // Ne idi dalje sam ako polje ima dodatno pitanje (kupac možda želi da doda detalje).
      // Jedan tajmer: dvostruki dodir ili brz klik na Back ne preskaču sljedeći korak.
      clearTimeout(S.adv);
      if (cur().autoAdvance && stepValid(cur()) && !cur().fields.some((f) => f.followup && visible(f))) {
        const at = S.i;
        S.adv = setTimeout(() => { if (S.i === at) go(1); }, 260);
      }
    })
  );
  app.querySelectorAll('[data-select]').forEach((el) =>
    el.addEventListener('change', () => {
      if (el.value) S.a[el.dataset.select] = el.value; else delete S.a[el.dataset.select];
      render();
    })
  );
  app.querySelectorAll('[data-text]').forEach((el) =>
    el.addEventListener('input', () => {
      S.a[el.dataset.text] = el.value;
      const c = app.querySelector(`[data-count="${el.dataset.text}"]`);
      if (c) c.textContent = `${el.value.length}/${el.maxLength}`;
    })
  );
  app.querySelectorAll('[data-c]').forEach((el) => {
    const sync = () => {
      S.contact[el.dataset.c] = el.type === 'checkbox' ? el.checked : el.value;
      const btn = app.querySelector('[data-act="submit"]');
      if (btn) btn.disabled = !stepValid(cur()) || S.busy;
    };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
  });
  app.querySelectorAll('[data-file]').forEach((file) => {
    const key = file.dataset.file;
    file.addEventListener('change', () => file.files[0] && takeFile(file.files[0], key));
  });
  app.querySelectorAll('[data-unfile]').forEach((b) => b.addEventListener('click', () => {
    URL.revokeObjectURL(S.files[b.dataset.unfile].url);
    delete S.files[b.dataset.unfile];
    render();
  }));
  app.querySelectorAll('[data-tooth]').forEach((el) => {
    const toggle = () => {
      const set = teethSet(S.a[el.dataset.tfield]);
      set.has(el.dataset.tooth) ? set.delete(el.dataset.tooth) : set.add(el.dataset.tooth);
      setTeeth(el.dataset.tfield, set);
      app.querySelector(`[data-tooth="${el.dataset.tooth}"]`)?.focus();
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
  app.querySelectorAll('[data-tstep]').forEach((b) => b.addEventListener('click', () => {
    const r = b.dataset.tstep;
    const set = teethSet(S.a[b.dataset.tfield]);
    if (+b.dataset.d > 0) { const next = T_ORDER.find((i) => !set.has(r + i)); if (next) set.add(r + next); }
    else { const last = [...T_ORDER].reverse().find((i) => set.has(r + i)); if (last) set.delete(r + last); }
    setTeeth(b.dataset.tfield, set);
  }));
  app.querySelectorAll('[data-tpreset]').forEach((b) => b.addEventListener('click', () => {
    setTeeth(b.dataset.tfield, new Set(T_PRESETS.find(([k]) => k === b.dataset.tpreset)[2]));
  }));
  const model = app.querySelector('[data-model]');
  if (model) model.addEventListener('change', () => { S.model = model.value; });
  const tw = app.querySelector('[data-tweak]');
  if (tw) {
    tw.addEventListener('keydown', (e) => e.key === 'Enter' && doTweak());
    tw.addEventListener('input', () => { S.tweakDraft = tw.value; });
  }
  app.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => { S.shown = +b.dataset.show; S.mask.strokes = []; render(); }));
  app.querySelectorAll('[data-brush]').forEach((b) => b.addEventListener('click', () => { S.mask.size = b.dataset.brush; render(); }));
  app.querySelector('[data-tryon]')?.addEventListener('change', (e) => doTryOn(e.target.files[0]));
  app.querySelector('[data-tryok]')?.addEventListener('change', (e) => { S.tryOk = e.target.checked; render(); });
  if (S.cfg.turnstile && app.querySelector('#ts')) mountTurnstile();
  bindMask();
  app.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.goto - S.i)));

  app.querySelectorAll('[data-act]').forEach((b) =>
    b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'back') go(-1);
      if (act === 'next') go(1);
      if (act === 'submit') submit();
      if (act === 'retry' || act === 'again') makeRender();
      if (act === 'tweak') doTweak();
      if (act === 'test') startTest();
      if (act === 'restart') { ss.del(LEAD_KEY); location.reload(); }
      if (act === 'mask-toggle' && !S.mask.on) { S.mask.on = true; S.mask.strokes = []; render(); }
      if (act === 'mask-off' && S.mask.on) { S.mask.on = false; S.mask.strokes = []; render(); }
      if (act === 'mask-clear') { S.mask.strokes = []; render(); }
    })
  );
}

function go(d) {
  if (d > 0 && !stepValid(cur())) return;
  clearTimeout(S.adv);
  S.i = Math.max(0, Math.min(steps().length - 1, S.i + d));
  S.error = '';
  render();
  window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  // Novi korak: fokus na naslov i kratka najava (čitač ekrana ne čita cijelu stranicu).
  const h = app.querySelector('h1');
  if (h) { h.id = 'step-title'; h.tabIndex = -1; h.focus({ preventScroll: true }); announce(h.textContent); }
  // Signal stranici zlatara (analitika). Bez ličnih podataka: samo forma i korak.
  parent.postMessage({ type: 'aik:step', form: formId, step: cur().id }, '*');
}

// Smanji sliku u browseru prije slanja: manji upload, manje tokena.
async function takeFile(f, key) {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { JLUI.alert('Please choose a JPG, PNG or WebP image.'); return; }
  if (S.uploading.has(key)) return;
  if (f.size > 20 * 1024 * 1024) return JLUI.alert('Please choose a photo smaller than 20 MB.');
  S.uploading.add(key);
  render();
  try {
    const bmp = await createImageBitmap(f);
    const scale = Math.min(1, 1536 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
    if (S.files[key]) URL.revokeObjectURL(S.files[key].url);
    S.files[key] = { blob, url: URL.createObjectURL(blob), name: f.name };
  } catch {
    if (S.files[key]) URL.revokeObjectURL(S.files[key].url);
    S.files[key] = { blob: f, url: URL.createObjectURL(f), name: f.name };
  }
  S.uploading.delete(key);
  render();
}

async function submit() {
  if (S.busy || S.onboardingPreview || !stepValid(cur())) return;
  S.test = false;
  S.busy = true;
  S.error = '';
  render();
  const fd = new FormData();
  fd.set('formId', formId);
  fd.set('answers', JSON.stringify(S.a));
  fd.set('name', S.contact.name);
  fd.set('email', S.contact.email);
  fd.set('phone', S.contact.phone);
  fd.set('consent', S.contact.consent ? 'yes' : 'no');
  // Šaljemo samo fajlove pitanja koja su i dalje vidljiva (i dodatni fajl samo uz odgovor na pitanje).
  const shown = new Set(S.cfg.steps.filter((st) => st.enabled !== false).flatMap((st) => st.fields.filter((f) => f.enabled !== false && visible(f)).map((f) => f.id)));
  for (const [key, file] of Object.entries(S.files)) {
    const base = key.replace(/__more$/, '');
    if (shown.has(base) && (key === base || (S.a[base] != null && S.a[base] !== ''))) fd.set(`file_${key}`, file.blob, `${key}.jpg`);
  }
  if (S.cfg.turnstile) fd.set('cf-turnstile-response', S.ts);
  try {
    const res = await fetch('/api/leads', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    S.lead = data;
    S.busy = false;
    ss.set(LEAD_KEY, { leadId: data.leadId, token: data.token });
    parent.postMessage({ type: 'aik:lead', form: formId }, '*');
    go(1);
    makeRender();
  } catch (e) {
    S.busy = false;
    S.error = e.message;
    S.ts = '';
    render();
    announce(e.message);
  }
}

// Kupac je osvježio stranicu poslije slanja: rezultat (renderi, probe) se vraća iz upita, token se šalje u zaglavlju.
async function restoreLead() {
  const saved = ss.get(LEAD_KEY);
  if (!saved?.leadId) return;
  try {
    const r = await fetch(`/api/leads/${encodeURIComponent(saved.leadId)}`, { headers: { 'x-lead-token': saved.token } });
    if (!r.ok) throw new Error();
    const d = await r.json();
    S.lead = { leadId: saved.leadId, token: saved.token, maxRenders: d.maxRenders };
    S.a = d.answers || {};
    S.renders = d.renders;
    S.shown = Math.max(0, S.renders.length - 1);
    S.tryons = d.tryons;
    S.tryLeft = d.tryLeft;
    S.i = steps().length - 1;
  } catch { ss.del(LEAD_KEY); }
}

let ticker;
function startTicker() {
  const msgs = S.cfg.result.loading;
  const t0 = Date.now();
  let k = 0;
  clearInterval(ticker);
  ticker = setInterval(() => {
    const m = app.querySelector('[data-msg]');
    const t = app.querySelector('[data-time]');
    if (!m) return clearInterval(ticker);
    const sec = Math.floor((Date.now() - t0) / 1000);
    t.textContent = `${sec}s`;
    if (sec && sec % 4 === 0 && sec / 4 !== k) {
      k = sec / 4;
      m.style.opacity = 0;
      setTimeout(() => { m.textContent = msgs[k % msgs.length]; m.style.opacity = 1; }, 250);
    }
  }, 250);
}

async function makeRender(tweak = '', mask = null) {
  if (S.busy || (!S.lead && !S.test)) return;
  const base = S.shown + 1; // dorada polazi od slike koju kupac gleda
  const baseKey = S.renders[S.shown]?.key || '';
  S.busy = true;
  S.error = '';
  render();
  startTicker();
  try {
    let res;
    if (S.test) {
      // Probni render: nacrt iz buildera i odgovori iz pregleda, admin token iz istog browsera.
      const fd = new FormData();
      const { dev, ...form } = S.cfg;
      fd.set('form', JSON.stringify(form));
      fd.set('answers', JSON.stringify(S.a));
      if (S.files.reference && !tweak) fd.set('reference', S.files.reference.blob, 'reference.jpg');
      if (tweak) { fd.set('tweak', tweak); fd.set('base', baseKey); }
      if (mask) fd.set('mask', await (await fetch(mask)).blob(), 'mask.png');
      res = await fetch('/api/admin/test-render', { method: 'POST', body: fd });
    } else {
      res = await fetch(`/api/leads/${S.lead.leadId}/renders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: S.lead.token, tweak, model: S.model, ...(tweak ? { base } : {}), ...(mask ? { mask } : {}) }),
      });
    }
    const data = await res.json();
    S.dev = data.dev || null;
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    S.renders.push({ url: data.url, key: data.key });
    S.fresh = true;
    S.shown = S.renders.length - 1;
    S.mask = { on: false, strokes: [], size: S.mask.size };
    S.tweakDraft = '';
    if (S.test) S.testInfo = data;
    parent.postMessage({ type: 'aik:render', form: formId, n: data.n }, '*');
  } catch (e) {
    S.error = e.message;
  } finally {
    clearInterval(ticker);
    S.busy = false;
    render();
  }
}

function doTweak() {
  const el = app.querySelector('[data-tweak]');
  const v = el?.value.trim();
  if (!v) { el?.focus(); return; }
  if (S.mask.on && !S.mask.strokes.length) { JLUI.alert('Paint over the part of the image you want to change first.'); return; }
  makeRender(v, maskDataUrl());
}

// ---------- Probni render i maska ----------
function startTest() {
  S.test = true;
  S.renders = [];
  S.shown = 0;
  S.testInfo = null;
  S.mask.strokes = [];
  S.i = steps().length - 1;
  window.scrollTo({ top: 0 });
  makeRender();
}

// Probni render: samo u pregledu buildera, kad builder javi da je admin prijavljen (kolačić šalje browser sam).
const testAllowed = () => new URLSearchParams(location.search).has('preview') && S.adminPreview;

// Četka u pikselima slike od 1024 px (skalira se na stvarnu veličinu).
const BRUSH = { s: 26, m: 52, l: 96 };

function strokesTo(ctx, color, scale = 1) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const st of S.mask.strokes) {
    ctx.lineWidth = st.r * 2 * scale;
    if (st.pts.length === 1) { ctx.beginPath(); ctx.arc(st.pts[0][0] * scale, st.pts[0][1] * scale, st.r * scale, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath();
    st.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)));
    ctx.stroke();
  }
}

function bindMask() {
  const cv = app.querySelector('[data-mask]');
  const img = app.querySelector('.stage img');
  if (!cv || !img) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#35d0c4';
  const draw = () => { const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); strokesTo(x, accent); };
  const size = () => { cv.width = img.naturalWidth || 1024; cv.height = img.naturalHeight || 1024; draw(); };
  if (img.complete && img.naturalWidth) size(); else img.addEventListener('load', size, { once: true });
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
  let cur = null;
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    cur = { r: BRUSH[S.mask.size] * (cv.width / 1024), pts: [pt(e)] };
    S.mask.strokes.push(cur);
    draw();
  });
  cv.addEventListener('pointermove', (e) => { if (!cur) return; cur.pts.push(pt(e)); draw(); });
  const end = () => { if (!cur) return; cur = null; const c = app.querySelector('[data-act="mask-clear"]'); if (c) c.hidden = false; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}

// Maska za model: neprovidna bijela slika iste veličine, providno tamo gdje je kupac obojio (to se mijenja).
function maskDataUrl() {
  if (!S.mask.on || !S.mask.strokes.length) return null;
  const img = app.querySelector('.stage img');
  const c = document.createElement('canvas');
  c.width = img?.naturalWidth || 1024;
  c.height = img?.naturalHeight || 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-out';
  strokesTo(x, '#000');
  return c.toDataURL('image/png');
}
