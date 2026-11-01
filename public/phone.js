// Phone field of the form: country picker (+1 by default), formatting as the customer types, one value "+1 (555) 123-4567".
const LIST = 'US1|United States,CA1|Canada,AF93|Afghanistan,AL355|Albania,DZ213|Algeria,AS1|American Samoa,AD376|Andorra,AO244|Angola,AI1|Anguilla,AG1|Antigua and Barbuda,AR54|Argentina,AM374|Armenia,AW297|Aruba,AU61|Australia,AT43|Austria,AZ994|Azerbaijan,BS1|Bahamas,BH973|Bahrain,BD880|Bangladesh,BB1|Barbados,BY375|Belarus,BE32|Belgium,BZ501|Belize,BJ229|Benin,BM1|Bermuda,BT975|Bhutan,BO591|Bolivia,BA387|Bosnia and Herzegovina,BW267|Botswana,BR55|Brazil,VG1|British Virgin Islands,BN673|Brunei,BG359|Bulgaria,BF226|Burkina Faso,BI257|Burundi,KH855|Cambodia,CM237|Cameroon,CV238|Cape Verde,KY1|Cayman Islands,CF236|Central African Republic,TD235|Chad,CL56|Chile,CN86|China,CO57|Colombia,KM269|Comoros,CG242|Congo,CD243|Congo (DRC),CK682|Cook Islands,CR506|Costa Rica,CI225|Côte d\'Ivoire,HR385|Croatia,CU53|Cuba,CW599|Curaçao,CY357|Cyprus,CZ420|Czechia,DK45|Denmark,DJ253|Djibouti,DM1|Dominica,DO1|Dominican Republic,EC593|Ecuador,EG20|Egypt,SV503|El Salvador,GQ240|Equatorial Guinea,ER291|Eritrea,EE372|Estonia,SZ268|Eswatini,ET251|Ethiopia,FK500|Falkland Islands,FO298|Faroe Islands,FJ679|Fiji,FI358|Finland,FR33|France,GF594|French Guiana,PF689|French Polynesia,GA241|Gabon,GM220|Gambia,GE995|Georgia,DE49|Germany,GH233|Ghana,GI350|Gibraltar,GR30|Greece,GL299|Greenland,GD1|Grenada,GP590|Guadeloupe,GU1|Guam,GT502|Guatemala,GN224|Guinea,GW245|Guinea-Bissau,GY592|Guyana,HT509|Haiti,HN504|Honduras,HK852|Hong Kong,HU36|Hungary,IS354|Iceland,IN91|India,ID62|Indonesia,IR98|Iran,IQ964|Iraq,IE353|Ireland,IL972|Israel,IT39|Italy,JM1|Jamaica,JP81|Japan,JO962|Jordan,KZ7|Kazakhstan,KE254|Kenya,KI686|Kiribati,XK383|Kosovo,KW965|Kuwait,KG996|Kyrgyzstan,LA856|Laos,LV371|Latvia,LB961|Lebanon,LS266|Lesotho,LR231|Liberia,LY218|Libya,LI423|Liechtenstein,LT370|Lithuania,LU352|Luxembourg,MO853|Macao,MG261|Madagascar,MW265|Malawi,MY60|Malaysia,MV960|Maldives,ML223|Mali,MT356|Malta,MH692|Marshall Islands,MQ596|Martinique,MR222|Mauritania,MU230|Mauritius,MX52|Mexico,FM691|Micronesia,MD373|Moldova,MC377|Monaco,MN976|Mongolia,ME382|Montenegro,MS1|Montserrat,MA212|Morocco,MZ258|Mozambique,MM95|Myanmar,NA264|Namibia,NR674|Nauru,NP977|Nepal,NL31|Netherlands,NC687|New Caledonia,NZ64|New Zealand,NI505|Nicaragua,NE227|Niger,NG234|Nigeria,NU683|Niue,KP850|North Korea,MK389|North Macedonia,MP1|Northern Mariana Islands,NO47|Norway,OM968|Oman,PK92|Pakistan,PW680|Palau,PS970|Palestine,PA507|Panama,PG675|Papua New Guinea,PY595|Paraguay,PE51|Peru,PH63|Philippines,PL48|Poland,PT351|Portugal,PR1|Puerto Rico,QA974|Qatar,RE262|Réunion,RO40|Romania,RU7|Russia,RW250|Rwanda,KN1|Saint Kitts and Nevis,LC1|Saint Lucia,VC1|Saint Vincent and the Grenadines,WS685|Samoa,SM378|San Marino,ST239|São Tomé and Príncipe,SA966|Saudi Arabia,SN221|Senegal,RS381|Serbia,SC248|Seychelles,SL232|Sierra Leone,SG65|Singapore,SX1|Sint Maarten,SK421|Slovakia,SI386|Slovenia,SB677|Solomon Islands,SO252|Somalia,ZA27|South Africa,KR82|South Korea,SS211|South Sudan,ES34|Spain,LK94|Sri Lanka,SD249|Sudan,SR597|Suriname,SE46|Sweden,CH41|Switzerland,SY963|Syria,TW886|Taiwan,TJ992|Tajikistan,TZ255|Tanzania,TH66|Thailand,TL670|Timor-Leste,TG228|Togo,TO676|Tonga,TT1|Trinidad and Tobago,TN216|Tunisia,TR90|Türkiye,TM993|Turkmenistan,TC1|Turks and Caicos Islands,TV688|Tuvalu,VI1|U.S. Virgin Islands,UG256|Uganda,UA380|Ukraine,AE971|United Arab Emirates,GB44|United Kingdom,UY598|Uruguay,UZ998|Uzbekistan,VU678|Vanuatu,VA39|Vatican City,VE58|Venezuela,VN84|Vietnam,YE967|Yemen,ZM260|Zambia,ZW263|Zimbabwe';
export const COUNTRIES = LIST.split(',').map((x) => { const [, iso, dial, name] = x.match(/^([A-Z]{2})(\d+)\|(.+)$/); return { iso, dial, name }; });
const flag = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const MAX_DIGITS = 15; // E.164

// National number as people write it: (555) 123-4567 for +1, groups of three elsewhere.
export function formatNational(dial, digits) {
  if (dial === '1') {
    const d = digits.slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return digits.slice(0, MAX_DIGITS - dial.length).replace(/(\d{3})(?=\d{2})/g, '$1 ');
}

// "+387 65 123 456" -> Bosnia and the rest of the number; the longest matching code wins, the current country on a tie (+1 is shared).
export function parsePhone(value, current = COUNTRIES[0]) {
  const text = String(value || '').trim();
  const digits = onlyDigits(text);
  if (!text.startsWith('+')) return { country: current, national: digits };
  const best = COUNTRIES.filter((c) => digits.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length || (b === current) - (a === current))[0];
  return best ? { country: best, national: digits.slice(best.dial.length) } : { country: current, national: digits };
}

export const phoneValue = (country, national) => (national ? `+${country.dial} ${formatNational(country.dial, national)}` : '');
export function phoneValid(value) {
  const digits = onlyDigits(value);
  if (!String(value || '').startsWith('+')) return false;
  return String(value).startsWith('+1 ') ? digits.length === 11 : digits.length >= 8 && digits.length <= MAX_DIGITS;
}

export const phoneHtml = (autocomplete = 'tel') => `<div class="phone" data-phone-box>
  <button type="button" class="phone-cc" data-phone-cc aria-haspopup="listbox" aria-expanded="false" aria-label="Country code"><span class="phone-flag"></span><span class="phone-dial"></span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  <input class="phone-in" type="tel" inputmode="tel" data-phone autocomplete="${autocomplete}" aria-label="Phone number" />
</div>`;

// Wires one field; onChange gets the full value after each keystroke.
export function mountPhone(box, value, onChange) {
  const input = box.querySelector('[data-phone]');
  const button = box.querySelector('[data-phone-cc]');
  let { country, national } = parsePhone(value);
  let menu = null;
  const paint = () => {
    box.querySelector('.phone-flag').textContent = flag(country.iso);
    box.querySelector('.phone-dial').textContent = `+${country.dial}`;
    input.placeholder = country.dial === '1' ? '(555) 123-4567' : 'Phone number';
    input.value = formatNational(country.dial, national);
  };
  const close = () => {
    if (!menu) return;
    menu.remove(); menu = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outside);
    document.removeEventListener('keydown', escape);
  };
  const outside = (e) => { if (!box.contains(e.target)) close(); };
  const escape = (e) => { if (e.key === 'Escape') { close(); button.focus(); } };
  const rows = (q) => {
    const t = q.trim().toLowerCase().replace(/^\+/, '');
    const hit = COUNTRIES.filter((c) => !t || c.name.toLowerCase().includes(t) || c.dial.startsWith(t) || c.iso.toLowerCase() === t);
    return hit.map((c) => `<button type="button" role="option" class="phone-opt ${c === country ? 'on' : ''}" aria-selected="${c === country}" data-iso="${c.iso}"><span class="phone-flag">${flag(c.iso)}</span><span class="phone-name">${esc(c.name)}</span><span class="phone-code">+${c.dial}</span></button>`).join('') || '<p class="phone-none">No country found</p>';
  };
  button.addEventListener('click', () => {
    if (menu) return close();
    menu = document.createElement('div');
    menu.className = 'phone-menu';
    menu.innerHTML = `<input class="phone-search" type="search" placeholder="Search country or code" aria-label="Search country or code" /><div class="phone-list" role="listbox" aria-label="Country code">${rows('')}</div>`;
    box.appendChild(menu);
    button.setAttribute('aria-expanded', 'true');
    const search = menu.querySelector('.phone-search');
    const list = menu.querySelector('.phone-list');
    search.addEventListener('input', () => { list.innerHTML = rows(search.value); });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); list.querySelector('.phone-opt')?.click(); } });
    list.addEventListener('click', (e) => {
      const o = e.target.closest('[data-iso]');
      if (!o) return;
      country = COUNTRIES.find((c) => c.iso === o.dataset.iso);
      paint(); close();
      onChange(phoneValue(country, national));
      input.focus();
    });
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    search.focus();
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  });
  input.addEventListener('input', () => {
    // A pasted or autofilled "+387 ..." also picks the country.
    const typed = input.value;
    const caretDigits = onlyDigits(typed.slice(0, input.selectionStart ?? typed.length)).length;
    if (typed.trim().startsWith('+')) ({ country, national } = parsePhone(typed, country));
    else national = onlyDigits(typed).slice(0, country.dial === '1' ? 10 : MAX_DIGITS - country.dial.length);
    paint();
    // Keep the caret on the same digit after the punctuation moved.
    let at = 0;
    for (let seen = 0; at < input.value.length && seen < caretDigits; at++) if (/\d/.test(input.value[at])) seen++;
    if (typed.trim().startsWith('+')) at = input.value.length;
    try { input.setSelectionRange(at, at); } catch {}
    onChange(phoneValue(country, national));
  });
  paint();
  // Value from an older session, without a country code: bring it to the full form.
  if (value && value !== phoneValue(country, national)) onChange(phoneValue(country, national));
  return input;
}
