// Privacy Policy i Terms za radnju koja nema svoje (A2P 10DLC, 25.11.2026).
// Forma linkuje /legal/<forma>/privacy|terms dok radnja u builderu ne upiše svoje linkove (Texts → Privacy Policy link / Terms link).
// Tekst sadrži rečenice koje A2P provjera traži: učestalost, cijena poruka, HELP, STOP, i da se mobilni podaci i pristanak ne dijele za marketing.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const LEGAL_UPDATED = 'November 25, 2026';

function contactBlock({ brand, email, info }) {
  const lines = [];
  if (email) lines.push(`Email: <a href="mailto:${esc(email)}">${esc(email)}</a>`);
  if (info) lines.push(esc(info).replace(/\n/g, '<br>'));
  return lines.length ? `<p>${lines.join('<br>')}</p>` : `<p>Reply to any message you received from ${esc(brand)}.</p>`;
}

function privacy(o) {
  const b = esc(o.brand);
  return `
<h1>Privacy Policy</h1>
<p class="meta">${b} · Last updated ${LEGAL_UPDATED}</p>
<p>This policy explains how ${b} ("we", "us") handles the information you share through our custom design form. The form is operated for us by JewelryLead.</p>
<h2>Information we collect</h2>
<ul>
<li>Your name, email address and phone number.</li>
<li>Your design choices, notes and any photos you upload.</li>
<li>Technical data such as your IP address and browser, used to keep the form secure and prevent abuse.</li>
</ul>
<h2>How we use it</h2>
<ul>
<li>To create a preview of your design and prepare your quote.</li>
<li>To contact you by email or phone about your design request, quote, appointments and order.</li>
<li>To send you text messages, only if you checked the text message box on the form. Marketing texts are sent only if you checked the separate marketing box.</li>
</ul>
<h2>Text messages (SMS)</h2>
<p>Message frequency varies. Message and data rates may apply. Reply HELP for help or STOP at any time to stop receiving texts. Consent to receive text messages is not a condition of purchase.</p>
<p><strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong> Text messaging originator opt-in data and consent will not be shared with any third parties. Information may be shared with service providers that help us deliver our services (such as messaging and customer support), only for that purpose.</p>
<h2>Service providers</h2>
<p>We use trusted providers to host the form, generate design previews, send messages and manage customer requests. They process your information only on our behalf and may not use it for their own marketing. We do not sell your personal information.</p>
<h2>How long we keep it</h2>
<p>We keep your request for as long as needed to serve you and to meet legal and accounting requirements.</p>
<h2>Your choices</h2>
<p>You can stop texts by replying STOP, unsubscribe from emails with the link in any email, and ask us to see, correct or delete your information by contacting us below.</p>
<h2>Contact</h2>
${contactBlock(o)}`;
}

function terms(o) {
  const b = esc(o.brand);
  return `
<h1>Terms</h1>
<p class="meta">${b} · Last updated ${LEGAL_UPDATED}</p>
<h2>Text message program</h2>
<p>If you opt in on our design form, ${b} will send you text messages about your design request, quote, appointments and order. If you also opt in to marketing messages, we may text you about offers and new pieces.</p>
<ul>
<li>Message frequency varies.</li>
<li>Message and data rates may apply.</li>
<li>Reply <strong>HELP</strong> for help. Reply <strong>STOP</strong> to opt out at any time; you will get one message confirming you have been unsubscribed.</li>
<li>Consent to receive text messages is not a condition of purchase.</li>
<li>Carriers are not liable for delayed or undelivered messages.</li>
</ul>
<p>See our <a href="privacy">Privacy Policy</a> for how we handle your information.</p>
<h2>Design previews and quotes</h2>
<p>Design previews are AI generated concept images. Your final piece is handcrafted and may differ in detail. Prices in a quote are estimates until confirmed by ${b}; metal and stone prices change, so a quote is valid only for the time stated in it.</p>
<h2>Photos you upload</h2>
<p>Photos you upload are used only to create your preview and to prepare your piece. Please upload only photos you have the right to share.</p>
<h2>Contact</h2>
${contactBlock(o)}`;
}

export function legalHtml(kind, o) {
  const body = kind === 'terms' ? terms(o) : privacy(o);
  const title = `${kind === 'terms' ? 'Terms' : 'Privacy Policy'} · ${o.brand}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
body{margin:0;background:#f7f5f1;color:#1d1b18;font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:720px;margin:0 auto;padding:48px 22px 72px}
h1{font:500 36px/1.2 Georgia,"Times New Roman",serif;margin:0 0 6px}
h2{font-size:17px;margin:30px 0 6px}
.meta{color:#77706a;font-size:14px;margin:0 0 26px}
ul{padding-left:20px}li{margin:4px 0}
a{color:#8a6a24}
footer{margin-top:44px;font-size:13px;color:#8d867e}
</style></head><body><main>${body}<footer>Form operated by JewelryLead for ${esc(o.brand)}.</footer></main></body></html>`;
}
