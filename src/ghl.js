// GoHighLevel (LeadConnector API v2) za zlatare koji rade u GHL-u (Ognjen 24.11.2026: "spremi sistem da kad bude GHL
// samo pređemo i spojimo"). Isključeno dok radnja ne upiše token i Location ID (clients.data.ghl, token šifrovan).
//
// Šta ide u GHL za svaki novi lead:
//   1) kontakt (POST /contacts/upsert: ime, mejl, telefon, izvor "JewelryLead · <forma>"),
//   2) tagovi (POST /contacts/{id}/tags: "jewelrylead", komad, zlatarovi tagovi iz portala),
//   3) bilješka (POST /contacts/{id}/notes: izbori kupca, opis, render, stranica kupca, Estimated price poruka),
//   4) opportunity u izabranom pipeline-u (POST /opportunities/: vrijednost = Estimated price, faza = New).
// Promjena statusa u portalu pomjera fazu opportunity-ja (Won/Lost = status won/lost), novi tag ide i u GHL.
//
// Token: Private Integration Token sub-accounta (Settings > Private Integrations) sa dozvolama
// contacts.write, contacts.readonly, opportunities.write, opportunities.readonly, locations.readonly.
// Prije prvog pravog leada provjeriti na njihovom nalogu (vidi docs/ghl-integracija.md): ovo nije probano sa pravim GHL-om.

export const GHL_BASE = 'https://services.leadconnectorhq.com';
export const GHL_VERSION = '2021-07-28';
export const GHL_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

// Token se čuva šifrovan istim tajnim ključem kao portal linkovi (PORTAL_LINK_KEY), vezan za klijenta.
async function aes(env) {
  const secret = env.PORTAL_LINK_KEY || (env.DEV_MODE === '1' ? env.ADMIN_TOKEN : '');
  if (!secret) throw new Error('PORTAL_LINK_KEY is not configured.');
  const material = await crypto.subtle.digest('SHA-256', enc.encode(`JewelryLead/ghl-token/v1:${secret}`));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function sealGhlToken(env, clientId, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(`ghl:${clientId}`) }, await aes(env), enc.encode(token));
  return `v1.${b64(iv)}.${b64(ct)}`;
}
export async function openGhlToken(env, clientId, sealed) {
  const [v, iv, ct] = String(sealed || '').split('.');
  if (v !== 'v1' || !iv || !ct) return '';
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: enc.encode(`ghl:${clientId}`) }, await aes(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

// Podešavanje bez tokena (ide u portal): šta je upisano i da li je uključeno.
export function ghlPublic(g) {
  if (!g || typeof g !== 'object') return { connected: false, enabled: false };
  return {
    connected: !!(g.token && g.locationId), enabled: g.enabled === true, locationId: g.locationId || '', tokenHint: g.tokenHint || '',
    pipelineId: g.pipelineId || '', stages: g.stages && typeof g.stages === 'object' ? g.stages : {}, tags: Array.isArray(g.tags) ? g.tags : ['jewelrylead'],
    pieceTag: g.pieceTag !== false, note: g.note !== false, backfill: g.backfill === true, lastOk: g.lastOk || null, lastError: g.lastError || null,
    prod: prodPublic(g.prod),
  };
}
// Proizvodna tabla za radnike (25.11.2026): poseban pipeline sa fazama izrade, kartice bez podataka kupca.
export const ORDER_KEYS = ['placed', 'cad', 'cast', 'setting', 'polish', 'ready'];
export function prodPublic(p) {
  p = p && typeof p === 'object' ? p : {};
  return {
    enabled: p.enabled === true, pipelineId: p.pipelineId || '', stages: p.stages && typeof p.stages === 'object' ? p.stages : {},
    assignTo: p.assignTo || '', assignName: p.assignName || '', vision: p.vision === true,
  };
}
export const prodReady = (p) => !!(p?.enabled && p.pipelineId && p.stages?.placed);
export const validLocationId = (v) => /^[A-Za-z0-9]{10,40}$/.test(String(v || '').trim());
export const validPit = (v) => /^pit-[A-Za-z0-9-]{20,80}$/.test(String(v || '').trim()) || /^[A-Za-z0-9._-]{30,1200}$/.test(String(v || '').trim());

// Jedan poziv prema GHL-u; fetchFn se mijenja u provjerama (bez mreže).
export async function ghlCall(token, method, path, body, fetchFn = fetch) {
  const res = await fetchFn(GHL_BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join('; ') : data.message || data.error || `HTTP ${res.status}`;
    const e = new Error(`GHL ${res.status}: ${String(msg).slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

// Pipeline-i radnje (za izbor u portalu): [{ id, name, stages: [{ id, name }] }].
export async function ghlPipelines(token, locationId, fetchFn = fetch) {
  const d = await ghlCall(token, 'GET', `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`, null, fetchFn);
  return (d.pipelines || []).map((p) => ({ id: p.id, name: p.name, stages: (p.stages || []).map((s) => ({ id: s.id, name: s.name })) }));
}

// Prijedlog faza po imenu (New -> "New Lead", Won -> "Won"/"Closed won"...), zlatar ih može promijeniti.
export function guessStages(pipeline) {
  const out = {};
  const find = (re) => pipeline?.stages?.find((s) => re.test(s.name))?.id;
  out.new = find(/\bnew\b|lead|inquir|enquir/i) || pipeline?.stages?.[0]?.id || '';
  out.contacted = find(/contact|reached|follow/i) || '';
  out.quoted = find(/quot|proposal|estimate|offer/i) || '';
  out.won = find(/\bwon\b|closed.?won|sold|deposit|order/i) || '';
  out.lost = find(/\blost\b|closed.?lost|dead|declin/i) || '';
  return out;
}

// Faze izrade po imenu (Order placed / CAD / Casting / Setting / Polish / Ready), zlatar ih može promijeniti.
export function guessOrderStages(pipeline) {
  const st = pipeline?.stages || [];
  const find = (re) => st.find((s) => re.test(s.name))?.id || '';
  const out = {
    placed: find(/placed|new|received|queue|order/i), cad: find(/cad|design|approv|model/i), cast: find(/cast|wax|print/i),
    setting: find(/setting|stone|set\b/i), polish: find(/polish|finish|qc|quality/i), ready: find(/ready|pick|done|complete|ship/i),
  };
  // Pipeline sa tačno 6 faza bez prepoznatih imena: redom.
  if (st.length === ORDER_KEYS.length) ORDER_KEYS.forEach((k, i) => { if (!out[k]) out[k] = st[i].id; });
  if (!out.placed && st[0]) out.placed = st[0].id;
  return out;
}
// Korisnici sub-accounta (za "Assign to"): traži dozvolu View Users; bez nje zlatar upiše User ID sam.
export async function ghlUsers(token, locationId, fetchFn = fetch) {
  const d = await ghlCall(token, 'GET', `/users/?locationId=${encodeURIComponent(locationId)}`, null, fetchFn);
  return (d.users || []).map((u) => ({ id: u.id, name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id })).slice(0, 100);
}

const tagOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+ -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
export function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

// Tekst bilješke: sve što je kupac izabrao i linkovi, da prodavac u GHL-u ne mora otvarati portal.
export function ghlNoteText(lead) {
  return [
    `JewelryLead${lead.ref ? ` ${lead.ref}` : ''}: new custom ${lead.piece || 'piece'} request (${lead.form || 'form'})`,
    lead.details?.length ? lead.details.map((d) => `${d.label}: ${d.value}`).join('\n') : '',
    lead.vision ? `What they want: "${String(lead.vision).slice(0, 800)}"` : '',
    lead.area ? `Phone area: ${lead.area}` : '',
    lead.renderUrl ? `AI design: ${lead.renderUrl}` : '',
    lead.pageUrl ? `Their design and quote page: ${lead.pageUrl}` : '',
    lead.price ? `Estimated price: $${Math.round(lead.price).toLocaleString('en-US')}` : '',
    lead.quoteMsg ? `Ready quote message:\n${lead.quoteMsg}` : '',
  ].filter(Boolean).join('\n\n').slice(0, 9000);
}

// Ime opportunity-ja počinje ID-jem leada (L-0231), pa ga pretraga u GHL Opportunities nađe odmah.
export const oppName = (lead) => `${lead.ref ? `${lead.ref} · ` : ''}${lead.name} · custom ${lead.piece || 'piece'}`.slice(0, 120);
export async function ghlRenameOpp(token, oppId, name, fetchFn = fetch) {
  await ghlCall(token, 'PUT', `/opportunities/${encodeURIComponent(oppId)}`, { name }, fetchFn);
}

// ---------- Proizvodna tabla (radnici, npr. moissanite izrada van radnje) ----------
// Radnik ne smije vidjeti kupca: kartica je na POSEBNOM kontaktu koji nosi samo broj narudžbe (bez mejla, telefona,
// imena, adrese, cijene i linka stranice kupca), u posebnom pipeline-u, dodijeljena korisniku radnika. U GHL-u
// radnik ima "Assigned data only", pa vidi samo te kartice, nikad prodajni kontakt.
const PII_LABEL = /e-?mail|phone|address|budget|price|contact/i;
const scrub = (t) => String(t || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]').replace(/\+?\d[\d\s().-]{7,}\d/g, '[number removed]');
export function ghlOrderNoteText(order) {
  return [
    `Order ${order.no}: custom ${order.piece || 'piece'}`,
    order.details?.length ? order.details.filter((d) => !PII_LABEL.test(d.label)).map((d) => `${d.label}: ${scrub(d.value)}`).join('\n') : '',
    order.vision ? `Design notes: "${scrub(order.vision).slice(0, 800)}"` : '',
    order.renderUrl ? `AI design: ${order.renderUrl}` : '',
    'Move this card through the stages as the piece is made. The store and the customer see each stage.',
  ].filter(Boolean).join('\n\n').slice(0, 9000);
}
export async function ghlPushOrder(token, cfg, order, prev = {}, fetchFn = fetch) {
  const p = cfg.prod || {};
  const done = { ...prev };
  const assign = p.assignTo ? { assignedTo: p.assignTo } : {};
  if (!done.contactId) {
    // POST /contacts/ (ne upsert): bez mejla i telefona upsert nema po čemu da spaja, a ovaj kontakt mora ostati prazan.
    const c = await ghlCall(token, 'POST', '/contacts/', {
      locationId: cfg.locationId, firstName: 'Order', lastName: order.no, name: `Order ${order.no}`, source: 'JewelryLead order', tags: ['jewelrylead order'], ...assign,
    }, fetchFn);
    done.contactId = c.contact?.id || c.id;
    if (!done.contactId) throw new Error('GHL: order contact returned no id');
  }
  if (!done.noted) {
    await ghlCall(token, 'POST', `/contacts/${encodeURIComponent(done.contactId)}/notes`, { body: ghlOrderNoteText(order) }, fetchFn);
    done.noted = true;
  }
  if (!done.oppId) {
    const key = ORDER_KEYS[order.stage] || 'placed';
    const o = await ghlCall(token, 'POST', '/opportunities/', {
      locationId: cfg.locationId, pipelineId: p.pipelineId, pipelineStageId: p.stages[key] || p.stages.placed, contactId: done.contactId, status: 'open',
      name: `${order.no} · custom ${order.piece || 'piece'}`.slice(0, 120), source: 'JewelryLead', ...assign,
    }, fetchFn);
    done.oppId = o.opportunity?.id || o.id;
    done.stage = order.stage;
  }
  done.at = Date.now();
  return done;
}
// Faza iz portala -> kartica na tabli.
export async function ghlPushOrderStage(token, cfg, sync, stage, fetchFn = fetch) {
  const id = cfg.prod?.stages?.[ORDER_KEYS[stage]];
  if (!sync?.oppId || !id) return false;
  await ghlCall(token, 'PUT', `/opportunities/${encodeURIComponent(sync.oppId)}`, { pipelineId: cfg.prod.pipelineId, pipelineStageId: id }, fetchFn);
  return true;
}
// Kartica na tabli -> faza (radnik je pomjerio karticu u GHL-u). null = faza nije mapirana ili kartica nije nađena.
export async function ghlReadOrderStage(token, cfg, sync, fetchFn = fetch) {
  if (!sync?.oppId) return null;
  const d = await ghlCall(token, 'GET', `/opportunities/${encodeURIComponent(sync.oppId)}`, null, fetchFn);
  const sid = (d.opportunity || d).pipelineStageId;
  const i = ORDER_KEYS.findIndex((k) => cfg.prod?.stages?.[k] && cfg.prod.stages[k] === sid);
  return i >= 0 ? i : null;
}

// Pravi kontakt, tagove, bilješku i opportunity za jedan lead. Vraća šta je napravljeno (id-jevi za kasnije izmjene).
// prev: ono što je već poslato (ponovni pokušaj ne pravi duplikat).
export async function ghlPushLead(token, cfg, lead, prev = {}, fetchFn = fetch) {
  const done = { ...prev };
  const { firstName, lastName } = splitName(lead.name);
  if (!done.contactId) {
    const c = await ghlCall(token, 'POST', '/contacts/upsert', {
      locationId: cfg.locationId, firstName, lastName, name: lead.name, email: lead.email || undefined, phone: lead.phone || undefined,
      source: `JewelryLead · ${lead.form || 'form'}`.slice(0, 80),
    }, fetchFn);
    done.contactId = c.contact?.id || c.id;
    if (!done.contactId) throw new Error('GHL: upsert returned no contact id');
  }
  if (!done.tagged) {
    // Tagovi odvojeno: upsert sa tags bi zamijenio tagove koje kontakt već ima.
    const tags = [...new Set([...(cfg.tags?.length ? cfg.tags : ['jewelrylead']), ...(cfg.pieceTag !== false && lead.piece ? [`jewelrylead ${lead.piece}`] : []), ...(lead.tags || [])].map(tagOf).filter(Boolean))];
    if (tags.length) await ghlCall(token, 'POST', `/contacts/${encodeURIComponent(done.contactId)}/tags`, { tags }, fetchFn);
    done.tagged = true;
  }
  if (!done.noted && cfg.note !== false) {
    await ghlCall(token, 'POST', `/contacts/${encodeURIComponent(done.contactId)}/notes`, { body: ghlNoteText(lead) }, fetchFn);
    done.noted = true;
  }
  if (!done.oppId && cfg.pipelineId && cfg.stages?.new) {
    // Postojeći lead (slanje unazad) ulazi u fazu svog statusa iz portala; Won i Lost su odmah zatvoreni.
    const st = GHL_STATUSES.includes(lead.status) ? lead.status : 'new';
    const o = await ghlCall(token, 'POST', '/opportunities/', {
      locationId: cfg.locationId, pipelineId: cfg.pipelineId, pipelineStageId: cfg.stages[st] || cfg.stages.new, contactId: done.contactId, status: st === 'won' ? 'won' : st === 'lost' ? 'lost' : 'open',
      name: oppName(lead), ...(lead.price ? { monetaryValue: Math.round(lead.price) } : {}), source: 'JewelryLead',
    }, fetchFn);
    done.oppId = o.opportunity?.id || o.id;
  }
  done.at = Date.now();
  return done;
}

// Status iz portala -> faza i status opportunity-ja (Won/Lost zatvaraju).
export async function ghlPushStatus(token, cfg, sync, status, value, fetchFn = fetch) {
  if (!sync?.oppId || !GHL_STATUSES.includes(status)) return false;
  const stage = cfg.stages?.[status];
  const body = { status: status === 'won' ? 'won' : status === 'lost' ? 'lost' : 'open', ...(stage ? { pipelineStageId: stage, pipelineId: cfg.pipelineId } : {}), ...(value ? { monetaryValue: Math.round(value) } : {}) };
  await ghlCall(token, 'PUT', `/opportunities/${encodeURIComponent(sync.oppId)}`, body, fetchFn);
  return true;
}
export async function ghlPushTags(token, sync, tags, fetchFn = fetch) {
  if (!sync?.contactId || !tags?.length) return false;
  await ghlCall(token, 'POST', `/contacts/${encodeURIComponent(sync.contactId)}/tags`, { tags: tags.map(tagOf).filter(Boolean) }, fetchFn);
  return true;
}
