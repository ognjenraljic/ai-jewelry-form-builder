// Stranica kupca /p/<page_key> (Ognjen 19.11.2026): personalizovana prodajna stranica uz quote poruku.
// Njegov dizajn (sve verzije i video), ponude (kako je izabrao + "Fits the budget" kad je zlatar napravi), dugmad
// Deposit i Book appointment, stilovi i završne obrade radnje, adresa i radno vrijeme. Izgled: luksuzni juvelir,
// mirno i tipografski (vidi feedback_jewelrylead_premium_restraint): bez varnica i efekata, samo svjetlo i slova.
import { estimate, specDiff, coverLabel, isGold, rowsOf, money } from '../public/pricing.js';
import { withArt, styleImage, metalFamily, artCategory } from '../public/option-art.js';

export const PAGE_ACTIONS = ['deposit', 'appointment'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HEX = /^#[0-9a-f]{3,8}$/i;
const THEME_KEYS = ['accent', 'accent-ink', 'bg', 'surface', 'surface-2', 'line', 'line-strong', 'ink', 'ink-soft', 'ink-faint'];
const firstName = (n) => { const f = String(n || '').trim().split(/\s+/)[0] || ''; return /^[\p{L}][\p{L}'-]{0,30}$/u.test(f) ? f[0].toUpperCase() + f.slice(1) : ''; };
const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

function fieldsOf(form) {
  return (form.steps || []).filter((s) => s.enabled !== false).flatMap((s) => (s.fields || []).filter((f) => f.enabled !== false));
}
function pieceLabel(form, type) {
  const o = (fieldsOf(form).find((f) => f.id === 'type')?.options || []).find((x) => x.value === type);
  return o?.label || cap(type || 'piece');
}

// Redovi specifikacije jedne ponude (samo ono što određuje cijenu).
function specRows(spec, ls) {
  const rows = [];
  if (spec.metal) rows.push(['Metal', isGold(spec.metal) && spec.karat ? `${spec.karat} ${spec.metal}` : spec.metal]);
  if (spec.type === 'grillz') {
    const r = rowsOf(spec.teeth);
    rows.push(['Teeth', [r.top ? `${r.top} top` : '', r.bottom ? `${r.bottom} bottom` : ''].filter(Boolean).join(' + ') || '–']);
  }
  rows.push(['Ice', coverLabel(spec.coverage, ls)]);
  if (spec.coverage) rows.push(['Stones', `${/natural/i.test(spec.stones) && spec.clarity ? `${spec.clarity} ` : ''}${/^default$/i.test(spec.stones) ? 'Diamonds' : spec.stones}`]);
  if (spec.type === 'grillz' && !spec.coverage && spec.cut && !/^(polished|solid)$/i.test(spec.cut)) rows.push(['Finish', spec.cut]);
  return rows;
}
const moldingIncluded = (est) => (est?.lines || []).some((l) => /molding/i.test(l.label));

// Ponude: kako je kupac izabrao, i "Fits the budget" samo ako ju je zlatar napravio, jeftinija je i stvarno se razlikuje.
function offersOf({ ls, pricing, quotes }) {
  if (!ls || !pricing) return [];
  const out = [];
  const a = estimate(pricing, ls.spec);
  if (a.total == null) return [];
  out.push({ slot: 'picked', tag: 'Option 1', title: 'Your design', sub: 'Exactly as you created it', total: a.total, rows: specRows(ls.spec, ls), molding: moldingIncluded(a) });
  const fitSpec = quotes?.fit?.spec && quotes.fit.spec.type === ls.spec.type ? { ...ls.spec, ...quotes.fit.spec } : null;
  if (fitSpec) {
    const b = estimate(pricing, fitSpec);
    const changes = specDiff(ls, fitSpec).filter((c) => !(['Karat', 'Clarity'].includes(c.what) && /^(none|)$/i.test(c.to)));
    if (b.total != null && b.total < a.total && changes.length) {
      const inBudget = !Number.isFinite(ls.budget?.high) || b.total <= ls.budget.high;
      out.push({ slot: 'fit', tag: 'Option 2', title: inBudget ? 'Fits your budget' : 'Closer to your budget', sub: 'Same look, smarter materials', total: b.total, rows: specRows(fitSpec, ls), changes, save: a.total - b.total, from: a.total, molding: moldingIncluded(b), best: inBudget });
    }
  }
  return out;
}

// Detalji dizajna u zaglavlju: izbori kupca bez zdravstvenih pitanja i bez dugih spiskova zuba.
function heroDetails(details) {
  return (details || [])
    .filter((d) => !/medical|condition|^piece$|^select your teeth$/i.test(d.label))
    .map((d) => [d.label.replace(/\?$/, '').replace(/^Name or engraving.*$/i, 'Lettering').replace(/^Select$/i, 'Teeth'), String(d.value).replace(/:\s*[TB]\d.*$/, '').replace(/\s*\(\d+ teeth\)/, '')])
    .slice(0, 10);
}

// Stilovi i završne obrade radnje za taj komad (slike iz biblioteke ili zlatarevog buildera).
function showcase(form, answers) {
  const type = answers.type;
  const metalLabel = (fieldsOf(form).find((f) => f.id === 'metal')?.options || []).find((o) => o.value === answers.metal)?.label || answers.metal || '';
  const family = metalFamily(metalLabel);
  const styles = (form.styles?.[type] || [])
    .map((s) => ({ image: styleImage(type, s), label: s.label, mine: s.value === answers.style }))
    .filter((s) => s.image)
    .slice(0, 8);
  const finishes = [];
  for (const f of fieldsOf(form)) {
    if (!['cut', 'setting', 'finish'].includes(artCategory(f.id))) continue;
    const st = f.showIf;
    if (st?.field === 'type' && Array.isArray(st.in) && !st.in.includes(type)) continue;
    for (const o of f.options || []) {
      const w = withArt(f, o);
      const image = w.metalArt?.[type]?.[family] || w.pieceArt?.[type] || w.image;
      if (image && !/^(none|other)$/i.test(o.value)) finishes.push({ image, label: o.label, mine: answers[f.id] === o.value });
    }
  }
  return { styles, finishes: finishes.slice(0, 15) };
}

const CTA = (slot, compact = false, short = false) => `<div class="cta-row${compact ? ' compact' : ''}">
  <button type="button" class="btn primary" data-action="deposit" data-option="${slot}">${short ? 'Place a deposit' : 'Reserve with a deposit'}</button>
  <button type="button" class="btn ghost" data-action="appointment" data-option="${slot}">${short ? 'Book a visit' : 'Book an appointment'}</button></div>`;

function offerCard(o, single) {
  const changes = o.changes?.length
    ? `<div class="changes"><p class="mini">What changes</p><ul>${o.changes.map((c) => `<li><span class="was">${esc(c.from === 'none' ? (c.what === 'Ice' ? 'Not iced' : 'None') : c.from)}</span><i aria-hidden="true">→</i><b>${esc(c.to === 'none' ? (c.what === 'Stones' ? 'No stones' : 'None') : c.to)}</b></li>`).join('')}</ul></div>`
    : '';
  return `<article class="offer${o.slot === 'fit' ? ' fit' : ''}${single ? ' single' : ''}" aria-label="${esc(o.tag)}: ${esc(o.title)}">
    <header><span class="tag">${esc(o.tag)}</span>${o.best ? '<span class="badge">Recommended</span>' : ''}</header>
    <h3>${esc(o.title)}</h3><p class="sub">${esc(o.sub)}</p>
    <div class="price"><span class="amount">${money(o.total)}</span>${o.from ? `<span class="from">${money(o.from)}</span>` : ''}</div>
    <p class="price-note">Estimated total${o.molding ? ', molding included' : ''}${o.save ? ` · <b>You save ${money(o.save)}</b>` : ''}</p>
    <dl class="specs">${o.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${changes}
    ${CTA(o.slot)}
  </article>`;
}

function tiles(list, mineLabel) {
  return list.map((x) => `<figure class="tile${x.mine ? ' mine' : ''}"><div class="tile-img"><img src="${esc(x.image)}" alt="${esc(x.label)}" loading="lazy" width="400" height="400" /></div><figcaption>${esc(x.label)}${x.mine ? `<span>${esc(mineLabel)}</span>` : ''}</figcaption></figure>`).join('');
}

export function leadPageHtml(d) {
  const { key, form, answers, lead, store, renders, film } = d;
  const theme = Object.fromEntries(THEME_KEYS.map((k) => [k, HEX.test(form.theme?.[k] || '') ? form.theme[k] : '']).filter(([, v]) => v));
  const vars = Object.entries(theme).map(([k, v]) => `--${k}:${v}`).join(';');
  const first = firstName(lead.name);
  const piece = pieceLabel(form, answers.type);
  const offers = offersOf(d);
  const details = heroDetails(d.details);
  const show = showcase(form, answers);
  const main = renders[renders.length - 1];
  const media = [...renders.map((r) => ({ kind: 'img', src: r.url, label: r.label })), ...(film ? [{ kind: 'video', src: film, label: 'In motion' }] : [])];
  const budget = d.ls?.budgetLabel ? `<p class="budget-line">Your budget: <b>${esc(d.ls.budgetLabel)}</b></p>` : '';
  const year = new Date(lead.createdAt || Date.now()).getFullYear();
  const infoLines = store.info ? store.info.split('\n') : [];

  const stage = main
    ? `<button type="button" class="stage-img" data-zoom aria-label="Enlarge your design"><img id="stage" src="${esc(main.url)}" alt="Your custom ${esc(piece.toLowerCase())}" width="1024" height="1024" fetchpriority="high" /></button>`
    : `<div class="stage-empty"><p>Your design preview is being finished.</p></div>`;
  const thumbs = media.length > 1
    ? `<div class="thumbs" role="list">${media.map((m, k) => `<button type="button" role="listitem" class="thumb${m.kind === 'video' ? ' is-video' : ''}${k === renders.length - 1 ? ' on' : ''}" data-${m.kind === 'video' ? 'video' : 'src'}="${esc(m.src)}" aria-label="${esc(m.label)}">${m.kind === 'video' ? `<video src="${esc(m.src)}#t=0.1" muted playsinline preload="metadata" aria-hidden="true" tabindex="-1"></video><span class="play" aria-hidden="true"></span>` : `<img src="${esc(m.src)}" alt="" loading="lazy" width="96" height="96" />`}<span class="thumb-l">${esc(m.label)}</span></button>`).join('')}</div>`
    : '';

  const offerSection = offers.length
    ? `<div class="offers${offers.length === 1 ? ' one' : ''}">${offers.map((o) => offerCard(o, offers.length === 1)).join('')}</div>`
    : `<div class="offers one"><article class="offer single"><header><span class="tag">Your quote</span></header><h3>Your price is being prepared</h3><p class="sub">${esc(store.name)} is finalizing the price for your design and will send it to you shortly.</p>${CTA('picked')}</article></div>`;

  const filmSection = film
    ? `<section class="film rv" aria-label="Your piece in motion"><div class="film-media"><video src="${esc(film)}" autoplay muted loop playsinline preload="metadata"></video></div>
        <div class="film-copy"><p class="eyebrow">In motion</p><h2>See the light move across your design</h2><p>A short preview of your ${esc(piece.toLowerCase())}, made from your choices. Your final piece is handcrafted by ${esc(store.name)}.</p></div></section>`
    : '';

  const showSection = show.styles.length || show.finishes.length
    ? `<section class="showcase rv" aria-labelledby="sc-h"><div class="sec-head"><p class="eyebrow">From the studio</p><h2 id="sc-h">Styles and finishes we make</h2><p>Every ${esc(piece.toLowerCase())} is made to order. These are the styles and finishes you can choose from.</p></div>
        ${show.styles.length ? `<h3 class="row-title">Styles</h3><div class="tiles">${tiles(show.styles, 'Your pick')}</div>` : ''}
        ${show.finishes.length ? `<h3 class="row-title">Finishes and settings</h3><div class="tiles">${tiles(show.finishes, 'Your pick')}</div>` : ''}</section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="${esc(theme.bg || '#070b0c')}" />
<title>${esc(first ? `${first}'s` : 'Your')} custom ${esc(piece.toLowerCase())} · ${esc(store.name)}</title>
<meta property="og:title" content="${esc(first ? `${first}, your` : 'Your')} custom ${esc(piece.toLowerCase())} by ${esc(store.name)}" />
<meta property="og:description" content="Your design, your options and how to reserve it." />
${main ? `<meta property="og:image" content="${esc((d.origin || '') + main.url)}" />` : ''}
<link rel="icon" href="${esc(store.logo || '/favicon.svg')}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/lead-page.css" />
<script type="module" src="/lead-page.js"></script>
</head>
<body style="${esc(vars)}" data-key="${esc(key)}" data-store="${esc(store.name)}">
<header class="top"><div class="wrap">
  <div class="brand">${store.logo ? `<img src="${esc(store.logo)}" alt="${esc(store.name)}" />` : `<span class="brand-name">${esc(store.name)}</span>`}</div>
  <p class="private">Private design${first ? ` for <b>${esc(first)}</b>` : ''}</p>
</div></header>
<main>
<section class="hero wrap">
  <div class="media">${stage}${thumbs}</div>
  <div class="intro">
    <p class="eyebrow">Your custom ${esc(piece.toLowerCase())}</p>
    <h1>${first ? `${esc(first)}, your design <br /><em>is ready.</em>` : 'Your design <br /><em>is ready.</em>'}</h1>
    <p class="lead-text">Designed with you at ${esc(store.name)}. Below are your design, the options we prepared for you and how to reserve your piece.</p>
    ${details.length ? `<dl class="details">${details.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    <a class="btn primary to-offers" href="#options">${offers.length > 1 ? 'See your two options' : 'See your quote'}</a>
  </div>
</section>
${filmSection}
<section class="options rv" id="options" aria-labelledby="op-h">
  <div class="sec-head"><p class="eyebrow">${offers.length > 1 ? 'Two ways to make it yours' : 'Your quote'}</p><h2 id="op-h">${offers.length > 1 ? 'Choose your option' : 'Reserve your piece'}</h2>${budget}</div>
  ${offerSection}
  <p class="fine">Prices are estimates for your design and are confirmed by ${esc(store.name)} before your piece is made.</p>
</section>
${showSection}
<section class="visit rv" aria-labelledby="vi-h">
  <div class="visit-card">
    <div class="visit-info"><p class="eyebrow">Visit the studio</p><h2 id="vi-h">${esc(store.name)}</h2>${infoLines.length ? `<div class="info">${infoLines.map((l) => (l.trim() ? `<p>${esc(l)}</p>` : '<p class="gap"></p>')).join('')}</div>` : ''}</div>
    <div class="visit-cta"><h3>Ready when you are</h3><p>Reserve your piece with a deposit, or come in to see metals and stones in person.</p>${CTA(offers.length > 1 ? '' : 'picked', true)}</div>
  </div>
</section>
</main>
<footer class="foot wrap"><p>AI concept preview. Your final piece is handcrafted and may differ in detail.</p><p>© ${year} ${esc(store.name)} · Powered by JewelryLead</p></footer>
<div class="dock" aria-hidden="true">${CTA(offers.length > 1 ? '' : 'picked', true, true)}</div>
<dialog class="sheet" id="sheet" aria-labelledby="sheet-h">
  <form method="dialog"><h2 id="sheet-h">Request received</h2><p id="sheet-p"></p><button class="btn primary" value="close">Done</button></form>
</dialog>
<div class="lightbox" id="lightbox" hidden><img alt="" /></div>
</body>
</html>`;
}
