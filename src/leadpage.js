// Stranica kupca /p/<page_key> (Ognjen 19.11.2026): personalizovana prodajna stranica uz quote poruku.
// Njegov dizajn (sve verzije i video), ponude (kako je izabrao + "Fits the budget" kad je zlatar napravi), dugmad
// Deposit i Book appointment, stilovi i završne obrade radnje, adresa i radno vrijeme. Izgled: luksuzni juvelir,
// mirno i tipografski (vidi feedback_jewelrylead_premium_restraint): bez varnica i efekata, samo svjetlo i slova.
import { estimate, specDiff, coverLabel, iceKey, isGold, rowsOf, money, middleGround } from '../public/pricing.js';
import { offerTimeline, offerStage, farOverBudget, revealAt, STAGE_TEXT } from './offer.js';
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
  rows.push(['Ice', coverLabel(iceKey(spec), ls)]);
  if (spec.coverage) rows.push(['Stones', `${/natural/i.test(spec.stones) && spec.clarity ? `${spec.clarity} ` : ''}${/^default$/i.test(spec.stones) ? 'Diamonds' : spec.stones}`]);
  if (spec.type === 'grillz' && !spec.coverage && spec.cut && !/^(polished|solid)$/i.test(spec.cut)) rows.push(['Finish', spec.cut]);
  return rows;
}
const moldingIncluded = (est) => (est?.lines || []).some((l) => /molding/i.test(l.label));

// Ponude: kako je kupac izabrao, i "Fits the budget" samo ako ju je zlatar napravio, jeftinija je i stvarno se razlikuje.
function offersOf(d, tl = offerTimeline(d, d.now || Date.now())) {
  const { ls, pricing, quotes } = d;
  if (!ls || !pricing) return [];
  const out = [];
  // Zlatar može podesiti obje ponude u portalu (22.11.2026): izbore (quotes.<slot>.spec) i konačnu cijenu
  // (quotes.<slot>.price); stranica pokazuje tačno to, a bez podešavanja računa iz cjenovnika.
  const specOf = (slot) => (quotes?.[slot]?.spec && quotes[slot].spec.type === ls.spec.type ? { ...ls.spec, ...quotes[slot].spec } : null);
  const finalOf = (slot, est) => (Number(quotes?.[slot]?.price) > 0 ? Number(quotes[slot].price) : est.total);
  const pickedSpec = specOf('picked') || ls.spec;
  const a = estimate(pricing, pickedSpec);
  const aTotal = finalOf('picked', a);
  if (aTotal == null) return [];
  const adjusted = specDiff(ls, pickedSpec).length > 0;
  out.push({ slot: 'picked', tag: 'Option 1', title: 'Your design', sub: adjusted ? 'Your design, as we would make it' : 'Exactly as you created it', total: aTotal, rows: specRows(pickedSpec, ls), molding: moldingIncluded(a) });
  // Option 2 kad je zlatar uključio "Show on sales page" (22.11.2026), ili sama (27.11.2026, 1a) kad je cijena daleko
  // iznad budžeta: prvih N sati zamućena kartica, pa otkrivena opcija (zlatareva iz "Fits the budget" ili izračunata).
  let fitSpec = quotes?.fit?.show === true ? specOf('fit') : null;
  let revealed = false;
  if (!fitSpec && Number(tl.settings.autoreveal) !== 0 && farOverBudget(aTotal, ls.budget?.high, tl.settings)) {
    const auto = specOf('fit') || middleGround(pricing, pickedSpec, ls.budget.high, ls.choices || {})?.spec || null;
    if (auto && (tl.now < revealAt(tl))) { out.push({ slot: 'teaser', tag: 'Option 2', revealAt: revealAt(tl) }); fitSpec = null; }
    else if (auto) { fitSpec = auto; revealed = true; }
  }
  if (fitSpec) {
    const b = estimate(pricing, fitSpec);
    const bTotal = finalOf('fit', b);
    const changes = specDiff({ ...ls, spec: pickedSpec }, fitSpec).filter((c) => !(['Karat', 'Clarity'].includes(c.what) && /^(none|)$/i.test(c.to)));
    if (bTotal != null && bTotal < aTotal && changes.length) {
      const inBudget = !Number.isFinite(ls.budget?.high) || bTotal <= ls.budget.high;
      out.push({ slot: 'fit', tag: 'Option 2', title: inBudget ? 'Fits your budget' : 'Closer to your budget', sub: revealed ? 'We found a way to bring it closer to your budget' : 'Same look, smarter materials', total: bTotal, rows: specRows(fitSpec, ls), changes, save: aTotal - bTotal, from: aTotal, molding: moldingIncluded(b), best: inBudget, revealed });
    }
  }
  // Osvježena ponuda (poslije isteka): iste opcije po današnjoj cijeni metala, uz popust ako ga radnja daje.
  if (tl.refresh?.status === 'ready' && tl.refresh.discount > 0) {
    for (const o of out) if (o.total) { const was = o.total; o.total = Math.round(was * (1 - tl.refresh.discount / 100)); o.from = was; o.save = was - o.total; o.refreshed = true; }
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

// Dugmad: depozit (ili "Deposit received" kad je uplata stigla) i zakazivanje. Sa uključenim kalendarom (25.11.2026)
// "Book" otvara izbor termina na samoj stranici; bez njega klik se bilježi ili vodi na link radnje kao ranije.
function bookLabel(bk, short) {
  const k = bk?.kinds || [];
  if (short) return k.length === 1 && k[0].kind === 'online' ? 'Book a call' : k.length ? 'Book a time' : 'Book a visit';
  return k.length === 1 && k[0].kind === 'online' ? 'Book a consultation' : 'Book an appointment';
}
const CTA = (slot, compact = false, short = false, bk = null) => `<div class="cta-row${compact ? ' compact' : ''}">
  ${bk?.deposit?.paid ? '<span class="btn done" role="status">Deposit received</span>' : `<button type="button" class="btn primary" data-action="deposit" data-option="${slot}">${short ? 'Place a deposit' : 'Reserve with a deposit'}</button>`}
  <button type="button" class="btn ghost" data-action="${bk?.kinds?.length ? 'book' : 'appointment'}" data-option="${slot}">${bookLabel(bk, short)}</button></div>`;

// Kupčev zakazani termin (i poslije promjene, /lead-page.js ga crta isto).
export function apptCards(list, bk) {
  if (!list?.length) return '';
  return list.map((a) => `<div class="appt" data-appt="${esc(a.id)}">
    <div class="appt-main"><p class="mini">Your appointment</p><h3>${esc(a.label)}${a.purpose === 'mold' ? ' · mold' : a.purpose === 'pickup' ? ' · pick up' : ''}</h3>
      <p class="appt-when">${esc(a.when)}</p>
      <p class="appt-how">${a.kind === 'online' ? (a.via === 'video' && a.video ? `Video call: <a href="${esc(a.video)}" target="_blank" rel="noopener">join link</a>` : 'We will call you at this time.') : 'At the studio. Times are in ' + esc(bk?.tzLabel || 'local time') + '.'}</p></div>
    <div class="appt-acts"><a class="btn ghost small" href="${esc(a.ics)}" download>Add to calendar</a>${a.purpose === 'consult' && bk?.kinds?.some((k) => k.kind === a.kind) ? `<button type="button" class="btn ghost small" data-action="book" data-kind="${esc(a.kind)}">Change time</button>` : ''}<button type="button" class="btn ghost small" data-cancel="${esc(a.id)}">Cancel</button></div>
  </div>`).join('');
}

// Poslije depozita (25.11.2026): u regiji ili ne, dolazi u radnju (sa terminom) ili šaljemo kit za otisak / komad.
function nextSection(bk, { grillz, store, first }) {
  if (!bk?.showNext) return '';
  const f = bk.fulfillment;
  const reg = bk.region;
  const status = bk.deposit.paid ? `Deposit received${bk.deposit.amount ? ` · ${money(bk.deposit.amount)}` : ''}` : bk.deposit.returned ? 'Thank you for your deposit' : 'Next step';
  const shipText = grillz ? (bk.moldKit ? 'We mail you a mold kit with simple instructions. You send it back, we make your grillz and ship them to you.' : 'We will text you about the mold, then ship your grillz to you.') : 'We ship your finished piece to you, insured.';
  const chip = (name, value, label) => `<label class="choice"><input type="radio" name="${name}" value="${value}" /><span>${esc(label)}</span></label>`;
  return `<section class="next" id="next" aria-labelledby="nx-h"><div class="next-card">
    <p class="eyebrow">${esc(status)}</p>
    <h2 id="nx-h">${first ? `${esc(first)}, how should we` : 'How should we'} get your piece to you?</h2>
    ${bk.deposit.returned && !bk.deposit.paid ? `<p class="next-sub">${esc(store)} is confirming your payment. Meanwhile, answer two quick questions.</p>` : `<p class="next-sub">Two quick questions, so ${esc(store)} knows what comes next.</p>`}
    <div class="next-done"${f ? '' : ' hidden'}><p class="mini">Your answers</p><p class="next-text">${esc(f?.text || '')}</p><button type="button" class="btn ghost small" data-next-edit>Change my answers</button></div>
    <form class="next-form" id="next-form" novalidate${f ? ' hidden' : ''}>
      <fieldset><legend>${reg ? `Are you in ${esc(reg)}?` : 'Are you near our studio?'}</legend><div class="choices">
        ${chip('local', 'yes', reg ? `Yes, I am in ${reg}` : 'Yes, I am nearby')}${chip('local', 'no', reg ? 'No, I am out of state' : 'No, I am farther away')}</div></fieldset>
      <fieldset data-when="local-yes" hidden><legend>${grillz ? 'How do you want to do your mold?' : 'How do you want to get your piece?'}</legend><div class="choices">
        ${chip('method', 'visit', grillz ? 'Come to the studio for the mold' : 'Pick it up at the studio')}${chip('method', 'ship', grillz ? (bk.moldKit ? 'Mail me a mold kit' : 'Ship it to me') : 'Ship it to me')}</div></fieldset>
      <div data-when="visit" hidden>${bk.visitOn ? `<p class="mini">Pick a time for your visit</p><div class="picker" data-picker="next"></div><p class="hint">Or skip it and we will text you to set a time.</p>` : `<p class="hint">${esc(store)} will text you to set a time.</p>`}</div>
      <div data-when="ship" hidden><p class="hint ship-text">${esc(shipText)}</p>
        <div class="addr"><label class="full"><span>Street address</span><input name="line1" autocomplete="address-line1" maxlength="120" /></label>
        <label class="full"><span>Apt, suite (optional)</span><input name="line2" autocomplete="address-line2" maxlength="80" /></label>
        <label><span>City</span><input name="city" autocomplete="address-level2" maxlength="60" /></label>
        <label><span>State</span><input name="state" autocomplete="address-level1" maxlength="30" /></label>
        <label><span>ZIP code</span><input name="zip" autocomplete="postal-code" inputmode="numeric" maxlength="12" /></label></div></div>
      <label class="full note-l"><span>Anything we should know? (optional)</span><textarea name="note" rows="2" maxlength="500"></textarea></label>
      <p class="form-err" role="alert" hidden></p>
      <button type="submit" class="btn primary">Send my answers</button>
    </form>
  </div></section>`;
}

// Zamućena kartica (1a): obris ponude bez brojeva i odbrojavanje do otkrivanja.
function teaserCard(o) {
  return `<article class="offer fit teaser" aria-label="Option 2, coming soon">
    <div class="teaser-ghost" aria-hidden="true"><header><span class="tag">Option 2</span></header><h3>Fits your budget</h3><p class="sub">Same look, smarter materials</p>
      <div class="price"><span class="amount">$0,000</span></div><dl class="specs"><div><dt>Metal</dt><dd>14K Gold</dd></div><div><dt>Ice</dt><dd>Iced</dd></div><div><dt>Stones</dt><dd>Stones</dd></div></dl></div>
    <div class="teaser-veil"><span class="teaser-spark" aria-hidden="true"></span><p class="mini">Option 2</p><h3>We might have something cooking for you</h3>
      <p>A version closer to your budget is being prepared.</p>
      <p class="teaser-clock" data-deadline="${o.revealAt}" data-reveal="1">Revealed in <b>--:--:--</b></p></div>
  </article>`;
}
function offerCard(o, single, bk) {
  if (o.slot === 'teaser') return teaserCard(o);
  const changes = o.changes?.length
    ? `<div class="changes"><p class="mini">What changes</p><ul>${o.changes.map((c) => `<li><span class="was">${esc(c.from === 'none' ? (c.what === 'Ice' ? 'Not iced' : 'None') : c.from)}</span><i aria-hidden="true">→</i><b>${esc(c.to === 'none' ? (c.what === 'Stones' ? 'No stones' : 'None') : c.to)}</b></li>`).join('')}</ul></div>`
    : '';
  return `<article class="offer${o.slot === 'fit' ? ' fit' : ''}${single ? ' single' : ''}" aria-label="${esc(o.tag)}: ${esc(o.title)}">
    <header><span class="tag">${esc(o.tag)}</span>${o.revealed ? '<span class="badge reveal">Unlocked for you</span>' : o.best ? '<span class="badge">Recommended</span>' : ''}${o.refreshed ? '<span class="badge fresh">Refreshed price</span>' : ''}</header>
    <h3>${esc(o.title)}</h3><p class="sub">${esc(o.sub)}</p>
    <div class="price"><span class="amount">${money(o.total)}</span>${o.from ? `<span class="from">${money(o.from)}</span>` : ''}</div>
    <p class="price-note">Estimated total${o.molding ? ', molding included' : ''}${o.save ? ` · <b>You save ${money(o.save)}</b>` : ''}</p>
    <dl class="specs">${o.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${changes}
    ${CTA(o.slot, false, false, bk)}
  </article>`;
}

function tiles(list, mineLabel) {
  return list.map((x) => `<figure class="tile${x.mine ? ' mine' : ''}"><div class="tile-img"><img src="${esc(x.image)}" alt="${esc(x.label)}" loading="lazy" width="400" height="400" /></div><figcaption>${esc(x.label)}${x.mine ? `<span>${esc(mineLabel)}</span>` : ''}</figcaption></figure>`).join('');
}

// Odbrojavanje: server ispiše početno stanje, /lead-page.js ga osvježava svake sekunde.
const two = (n) => String(n).padStart(2, '0');
function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
}
function remainingText(deadline, now = Date.now()) {
  const left = deadline - now;
  return left > 0 ? `Your price is held for ${clock(left)}` : 'This offer has expired. Reply to your quote and we will refresh it.';
}
function validityHtml(deadline, hours, now = Date.now(), refreshed = false) {
  const total = hours * 3600_000;
  const left = deadline - now;
  const k = offerStage(left, hours);
  const [label, sub] = STAGE_TEXT[k](hours);
  const st = { k, label: refreshed && k !== 'expired' ? `Refreshed price · ${label}` : label, sub };
  const s = Math.max(0, Math.floor(left / 1000));
  const unit = (u, v, l) => `<span class="v-unit"><b data-u="${u}">${two(v)}</b><small>${l}</small></span>`;
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  return `<div class="validity v-${st.k}" data-deadline="${deadline}" data-total="${total}" data-hours="${hours}"${refreshed ? ' data-refreshed="1"' : ''}>
    <span class="v-label">${st.label}</span>
    <div class="v-clock" role="timer" aria-label="Time left on this offer"><time datetime="${new Date(deadline).toISOString()}">${unit('h', Math.floor(s / 3600), 'Hours')}<i class="v-colon" aria-hidden="true">:</i>${unit('m', Math.floor((s % 3600) / 60), 'Minutes')}<i class="v-colon" aria-hidden="true">:</i>${unit('s', s % 60, 'Seconds')}</time></div>
    <div class="v-bar" aria-hidden="true"><span style="width:${pct.toFixed(2)}%"></span></div>
    <span class="v-sub">${st.sub}</span></div>`;
}

// Dugmad kad je ponuda zaključana: nema depozita; istekla = osvježena ponuda + termin, inače samo termin.
const lockedCTA = (tl, bk, compact = false, short = false) => `<div class="cta-row${compact ? ' compact' : ''}">${tl.stage === 'expired' ? `<button type="button" class="btn primary" data-refresh="1">${short ? 'Refresh my quote' : 'Request a refreshed quote'}</button>` : ''}<button type="button" class="btn ghost" data-action="${bk?.kinds?.length ? 'book' : 'appointment'}" data-option="picked">${bookLabel(bk, short)}</button></div>`;
// Zaključana ponuda (27.11.2026): istekla (dugme za osvježenu ponudu), zahtjev poslat (odbrojavanje do otključavanja)
// ili se metal pomjerio (radnja šalje novu cijenu). Book an appointment ostaje uvijek dostupno.
function lockPanel(tl, store, bk) {
  const s = tl.settings;
  const book = `<button type="button" class="btn ghost" data-action="${bk?.kinds?.length ? 'book' : 'appointment'}" data-option="picked">${bookLabel(bk, false)}</button>`;
  if (tl.stage === 'requested') return `<div class="lockpanel lp-wait"><span class="lp-ic" aria-hidden="true"></span><p class="mini">Refreshed quote requested</p><h3>Your new price is on its way</h3>
    <p>If metal prices stay steady, your refreshed price unlocks here automatically and is held for ${s.refreshhours} hours.</p>
    <p class="lp-clock" data-deadline="${tl.refresh.unlockAt}" data-unlock="1">Unlocks in <b>--:--:--</b></p><div class="cta-row">${book}</div></div>`;
  if (tl.stage === 'moved') return `<div class="lockpanel lp-moved"><span class="lp-ic" aria-hidden="true"></span><p class="mini">Metal prices moved</p><h3>We are updating your price</h3>
    <p>Gold and platinum prices changed since your quote, so ${esc(store)} will send you a new price shortly.</p><div class="cta-row">${book}</div></div>`;
  return `<div class="lockpanel"><span class="lp-ic" aria-hidden="true"></span><p class="mini">Offer locked</p><h3>Your offer has expired</h3>
    <p>Your price hold has ended. Prices follow the metal markets, so a refreshed quote uses today's metal price, which can be higher or lower than before. Ask for one and we will hold it for you for ${s.refreshhours} hours${Number(s.discount) > 0 ? ', with a little extra off' : ''}.</p>
    <div class="cta-row"><button type="button" class="btn primary" data-refresh="1">Request a refreshed quote</button>${book}</div>
    <p class="lp-note">Ready in about ${s.refreshwait} hours if metal prices stay steady.</p></div>`;
}
// Asistent na stranici (26.11.2026): iste činjenice koje stranica pokazuje, kao podaci za model (src/assistant.js).
export function pageFacts(d) {
  const bk = d.booking || {};
  const tl = offerTimeline(d, d.now || Date.now());
  const offers = offersOf(d, tl).filter((o) => o.slot !== 'teaser');
  const deadline = offers.length ? tl.deadline : 0;
  const left = deadline - tl.now;
  const lockText = tl.stage === 'requested' ? 'The offer expired and the customer asked for a refreshed quote; it unlocks on the page automatically if metal prices stay steady.' : tl.stage === 'moved' ? 'The offer expired; metal prices moved, so the store will send a new price.' : '';
  return {
    store: d.store.name, storeInfo: d.store.info || '', first: firstName(d.lead.name), piece: pieceLabel(d.form, d.answers.type).toLowerCase(),
    details: heroDetails(d.details), budget: d.ls?.budgetLabel || '', renders: d.renders.length, film: !!d.film,
    offers: offers.map((o) => ({ ...o, money: money(o.total), saveMoney: o.save ? money(o.save) : '' })),
    deadlineText: lockText || (deadline ? (left > 0 ? `The price on the page is held for about ${Math.max(1, Math.round(left / 3600_000))} more hour(s) (countdown on the page). After that the store refreshes the price.` : 'The price hold on the page has expired; the customer can press "Request a refreshed quote" on the page.') : ''),
    depositOn: !!bk.deposit?.on, depositPaid: !!bk.deposit?.paid, depositAmount: bk.deposit?.amount ? money(bk.deposit.amount) : '',
    kinds: bk.kinds || [], bookOn: true, video: !!bk.video, tzLabel: bk.tzLabel || '', hours: d.hoursText || '',
    upcoming: bk.upcoming || [], fulfillment: bk.fulfillment?.text || '', region: bk.region || '', moldKit: !!bk.moldKit,
  };
}

// Widget asistenta: dugme dolje desno i panel; logika u /page-chat.js (učitava se samo kad je asistent uključen).
function chatWidget(a, store) {
  if (!a?.on) return '';
  return `<link rel="stylesheet" href="/page-chat.css" /><script type="module" src="/page-chat.js"></script>
<button type="button" class="pc-fab" id="pc-fab" aria-controls="pc-panel" aria-expanded="false"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>Questions? Ask us</button>
<section class="pc-panel" id="pc-panel" role="dialog" aria-modal="false" aria-labelledby="pc-title" hidden>
  <header class="pc-head"><div><p class="pc-kicker">${esc(store)}</p><h2 id="pc-title">Ask about your design</h2></div><button type="button" class="pc-x" data-pc-close aria-label="Close">&times;</button></header>
  <div class="pc-log" id="pc-log" aria-live="polite"></div>
  <div class="pc-sugg" id="pc-sugg"></div>
  <form class="pc-form" id="pc-form"><textarea id="pc-in" rows="1" maxlength="600" placeholder="Type your question" aria-label="Your question"></textarea><button type="submit" class="pc-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>
  <p class="pc-fine">AI assistant. ${esc(store)} confirms every price and detail.</p>
</section>`;
}

export function leadPageHtml(d) {
  const { key, form, answers, lead, store, renders, film } = d;
  const bk = d.booking || null;
  const theme = Object.fromEntries(THEME_KEYS.map((k) => [k, HEX.test(form.theme?.[k] || '') ? form.theme[k] : '']).filter(([, v]) => v));
  const vars = Object.entries(theme).map(([k, v]) => `--${k}:${v}`).join(';');
  const first = firstName(lead.name);
  const piece = pieceLabel(form, answers.type);
  const tl = offerTimeline(d, d.now || Date.now());
  const offers = offersOf(d, tl);
  const details = heroDetails(d.details);
  const show = showcase(form, answers);
  const main = renders[renders.length - 1];
  const media = [...renders.map((r) => ({ kind: 'img', src: r.url, label: r.label })), ...(film ? [{ kind: 'video', src: film, label: 'In motion', poster: main?.url || '' }] : [])];
  const budget = d.ls?.budgetLabel ? `<p class="budget-line">Your budget: <b>${esc(d.ls.budgetLabel)}</b></p>` : '';
  const year = new Date(lead.createdAt || Date.now()).getFullYear();
  const infoLines = store.info ? store.info.split('\n') : [];

  const stage = main
    ? `<div class="stage-img"><button type="button" class="stage-zoom" aria-label="Enlarge your design"><img id="stage" src="${esc(main.url)}" alt="Your custom ${esc(piece.toLowerCase())}" width="1024" height="1024" fetchpriority="high" /></button></div>`
    : `<div class="stage-empty"><p>Your design preview is being finished.</p></div>`;
  const thumbs = media.length > 1
    ? `<div class="thumbs" role="list">${media.map((m, k) => `<button type="button" role="listitem" class="thumb${m.kind === 'video' ? ' is-video' : ''}${k === renders.length - 1 ? ' on' : ''}" data-${m.kind === 'video' ? 'video' : 'src'}="${esc(m.src)}"${m.poster ? ` data-poster="${esc(m.poster)}"` : ''} aria-label="${esc(m.label)}">${m.kind === 'video' ? `<img src="${esc(m.poster)}" alt="" loading="lazy" width="96" height="96" /><span class="play" aria-hidden="true"></span>` : `<img src="${esc(m.src)}" alt="" loading="lazy" width="96" height="96" />`}<span class="thumb-l">${esc(m.label)}</span></button>`).join('')}</div>`
    : '';

  const hours = tl.hours;
  const deadline = offers.length ? tl.deadline : 0;
  const refreshed = tl.refresh?.status === 'ready';
  const validity = deadline && !['requested', 'moved'].includes(tl.stage) && !(tl.stage === 'expired') ? validityHtml(deadline, hours, tl.now, refreshed) : '';
  const lock = offers.length && tl.locked ? lockPanel(tl, store.name, bk) : '';
  const refreshNote = refreshed && tl.refresh.discount > 0 ? `<p class="refresh-note">Your refreshed price includes an extra <b>${tl.refresh.discount}% off</b>, held for ${hours} hours.</p>` : '';
  const offerSection = offers.length
    ? `${lock}<div class="offers${offers.length === 1 ? ' one' : ''}${tl.locked ? ' locked' : ''}"${tl.locked ? ' aria-hidden="true" inert' : ''}>${offers.map((o) => offerCard(o, offers.length === 1, bk)).join('')}</div>`
    : `<div class="offers one"><article class="offer single"><header><span class="tag">Your quote</span></header><h3>Your price is being prepared</h3><p class="sub">${esc(store.name)} is finalizing the price for your design and will send it to you shortly.</p>${CTA('picked', false, false, bk)}</article></div>`;

  const filmSection = film
    ? `<section class="film rv" aria-label="Your piece in motion"><div class="film-media"><video src="${esc(film)}" ${main ? `poster="${esc(main.url)}"` : ''} autoplay muted loop playsinline preload="metadata"></video></div>
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
<body style="${esc(vars)}" data-key="${esc(key)}" data-store="${esc(store.name)}"${d.now ? ` data-now-offset="${d.now - Date.now()}" data-sim="1"` : ''}>
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
    ${deadline && !tl.locked ? `<p class="valid-mini" data-deadline="${deadline}" data-mini="1">${esc(remainingText(deadline, tl.now))}</p>` : tl.locked && offers.length ? `<p class="valid-mini locked">${tl.stage === 'requested' ? 'Your refreshed quote is on its way' : tl.stage === 'moved' ? 'Your new price is on its way' : 'Your offer has expired. Request a refreshed quote below.'}</p>` : ''}
  </div>
</section>
${nextSection(bk, { grillz: answers.type === 'grillz', store: store.name, first })}
<div class="appts wrap" id="appts">${apptCards(bk?.upcoming, bk)}</div>
${filmSection}
<section class="options rv" id="options" aria-labelledby="op-h">
  <div class="sec-head"><p class="eyebrow">${offers.length > 1 ? 'Two ways to make it yours' : 'Your quote'}</p><h2 id="op-h">${offers.length > 1 ? 'Choose your option' : 'Reserve your piece'}</h2>${budget}${validity}${refreshNote}</div>
  ${offerSection}
  <p class="fine">Prices are estimates for your design and are confirmed by ${esc(store.name)} before your piece is made.</p>
</section>
${showSection}
<section class="visit rv" aria-labelledby="vi-h">
  <div class="visit-card">
    <div class="visit-info"><p class="eyebrow">Visit the studio</p><h2 id="vi-h">${esc(store.name)}</h2>${infoLines.length ? `<div class="info">${infoLines.map((l) => (l.trim() ? `<p>${esc(l)}</p>` : '<p class="gap"></p>')).join('')}</div>` : ''}</div>
    <div class="visit-cta"><h3>Ready when you are</h3><p>${bk?.kinds?.length ? (bk.kinds.length === 2 ? 'Reserve your piece with a deposit, book a short call to go over your design, or come in to see metals and stones in person.' : bk.kinds[0].kind === 'online' ? 'Reserve your piece with a deposit, or book a short call to go over your design and price together.' : 'Reserve your piece with a deposit, or come in to see metals and stones in person.') : 'Reserve your piece with a deposit, or come in to see metals and stones in person.'}</p>${offers.length && tl.locked ? lockedCTA(tl, bk, true) : CTA(offers.length > 1 ? '' : 'picked', true, false, bk)}</div>
  </div>
</section>
</main>
<footer class="foot wrap"><p>AI concept preview. Your final piece is handcrafted and may differ in detail.</p><p>© ${year} ${esc(store.name)} · Powered by JewelryLead</p></footer>
<div class="dock" aria-hidden="true">${offers.length && tl.locked ? lockedCTA(tl, bk, true, true) : CTA(offers.length > 1 ? '' : 'picked', true, true, bk)}</div>
<dialog class="sheet" id="sheet" aria-labelledby="sheet-h">
  <form method="dialog"><h2 id="sheet-h">Request received</h2><p id="sheet-p"></p><button class="btn primary" value="close">Done</button></form>
</dialog>
<dialog class="sheet sched" id="sched" aria-labelledby="sched-h"><div class="sched-body"></div></dialog>
${bk ? `<script type="application/json" id="bk-data">${JSON.stringify({ kinds: bk.kinds, video: bk.video, tzLabel: bk.tzLabel, store: store.name, grillz: answers.type === 'grillz', paid: bk.deposit.paid }).replace(/</g, '\\u003c')}</script>` : ''}
<div class="lightbox" id="lightbox" hidden><img alt="" /></div>
${chatWidget(d.assistant, store.name)}
</body>
</html>`;
}
