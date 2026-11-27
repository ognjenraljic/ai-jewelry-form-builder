# GHL workflowi za District: šta je u JewelryLeadu i šta se radi u GoHighLevel-u

*27.11.2026. Tri toka iz istraživanja (napuštena ponuda, termini, preuzimanje i recenzija), plus telefon (Quo), SMS registracija (A2P 10DLC), Google Calendar i Google Meet. Istraživanja: Ignis `projects/jewelrylead/research/*-workflows-2026-11-27.md`.*

## Kako radi (jedna rečenica)

JewelryLead zna stanje svakog kupca, pa **on odlučuje kad ide koja poruka**. U tom trenutku upiše JL polja na GHL kontakt i doda **tag događaja** (npr. `jl offer 24h left`). U GHL-u je svaki workflow isti: okidač je taj tag, pošalje SMS ili mejl, i na kraju skine tag. U GHL-u nema čekanja, datuma ni uslova o ponudi.

- Tag se prvo skine pa doda, pa workflow krene i kad isti kupac dobije isti tag drugi put (npr. drugi termin).
- Isti događaj nikad ne ide dvaput (tabela `ghl_events`). Portal pokazuje zadnjih 40 (Forms → GoHighLevel → Automations).
- Poruke o ponudi i recenziji idu samo danju po kupčevom satu (10-19 h, a zadnji podsjetnici 9-21 h). Zonu kupca šalje njegov pregledač pri kliku ili zakazivanju, i ona se upisuje na kontakt. Podsjetnici za termin idu tačno kad treba.
- Ponuda staje sama: depozit, zakazan termin, Won ili Lost, arhiva.
- **Kontrolna grupa:** 10% leadova bez poruka o ponudi (prekidač u portalu). Samo tako se vidi da li poruke stvarno donose depozite.
- Uključenje važi od tog trenutka: stari leadovi ne dobijaju poruke koje su "propustili".

## Šta je napravljeno u JewelryLeadu

| Dio | Šta |
|---|---|
| Automations (portal, Forms → GoHighLevel) | Dugme "Create the JL fields": pravi 15 polja kontakta. Tri grupe (ponuda / termini / recenzija), kontrolna grupa, dani do zahtjeva za recenziju, glavni prekidač, lista zadnjih tagova sa greškama. |
| Polja kontakta | `jl_lead_id`, `jl_piece`, `jl_page_url` (link bez `?preview=1`, posjete se broje), `jl_render_url`, `jl_price`, `jl_option_2_price`, `jl_offer_expires`, `jl_appt_type`, `jl_appt_time`, `jl_appt_location` (adresa radnje / Meet link / "calls you at"), `jl_meet_link`, `jl_reschedule_url`, `jl_order_no`, `jl_order_status`, `jl_occasion_date` |
| Narudžba | "Mark picked up" na zadnjoj fazi, "Gift or surprise" + datum prilike, "Remake or fix open" (odgađa zahtjev za recenziju) |
| Termini | Done / No-show iz portala ide u GHL kalendar (Showed / No-show). Termin pomjeren, otkazan ili označen u GHL-u vraća se kod nas (provjera svakih 15 min), pa podsjetnici idu za novo vrijeme. Studio događaj u GHL-u ima adresu radnje. Poziv ima kupčev broj. |
| Google Meet | Bookings → "Google Meet link for each video call". GHL pravi jedinstven Meet link po terminu. Kupac ga vidi na svojoj stranici, u .ics i u polju `jl_meet_link`. |
| Obavještenja zlataru (i bez GHL-a) | Klik na depozit bez uplate poslije 20 min, osvježena ponuda otključana ili treba nova cijena, termin prošao a nije označen. Odluka o osvježenoj ponudi sad je u cronu, ne tek kad kupac otvori stranicu. |
| Stranica kupca | Iskren tekst isteka: "After that we re-quote at that day's metal price, which can go up or down". |
| SMS pristanak | Neobavezni SMS checkbox za upit sad pokriva i "order updates and a follow-up about my experience". Tagovi `sms consent` / `sms marketing consent` idu na kontakt. Novi tag `jl deposit paid` kad stigne depozit. |

## Tagovi (okidači workflowa)

| Tag | Kada | Vrsta poruke |
|---|---|---|
| `jl deposit click` | klik na depozit, nije platio 20 min | prodaja |
| `jl offer not opened` | 4 h poslije ponude, nije otvorio stranicu | odgovor na upit |
| `jl offer saved` | 4 h poslije ponude, otvorio, ništa nije kliknuo | prodaja |
| `jl offer 24h left` | 24 h do kraja cijene | prodaja |
| `jl offer final hours` | 6 h do kraja | prodaja |
| `jl offer expired` | cijena istekla | prodaja |
| `jl offer closeout` | 6 dana poslije isteka, nije tražio novu | prodaja |
| `jl refresh ready` | osvježena cijena otključana (metal miran), važi 24 h | prodaja |
| `jl refresh needs quote` | metal se pomjerio: Enrique šalje novu cijenu | interno |
| `jl appt booked` | zakazao (i kad se termin pomjeri) | informativna |
| `jl visit 3 days` | studio za 3 dana (ako je zakazan više od 3,5 dana ranije) | informativna |
| `jl visit 24h` | studio sutra | informativna |
| `jl visit 2h` | studio za 2 h | informativna |
| `jl call 1h` | online konsultacija za 1 h | informativna |
| `jl call 10 min` | online konsultacija za 10 min | informativna |
| `jl appt no show` | označen No-show | informativna |
| `jl appt showed no deposit` | Done, 2 h kasnije još bez depozita | prodaja |
| `jl appt cancelled` | otkazan (ne pomjeren) | informativna |
| `jl order ready` | narudžba "Ready for pick up" | informativna |
| `jl picked up` | označeno "Picked up" | informativna |
| `jl review request` | dan poslije preuzimanja (grillz 3 dana, poklon 2 dana poslije prilike) | zahtjev za recenziju |

**SMS pravilo:** informativne i zahtjev za recenziju idu SMS-om samo kontaktu sa tagom `sms consent`. Prodajne idu SMS-om samo uz `sms marketing consent`. Svi ostali dobijaju mejl (sa odjavom). `jl offer not opened` smije uz `sms consent` (to je ponuda koju je kupac tražio).

---

## Šta ti radiš u GHL-u, redom

### 1. Token (Private Integration)
Settings → Private Integrations → JewelryLead token → Edit scopes. Uz postojeće dodaj:
- **View Custom Fields** i **Edit Custom Fields** (dugme za JL polja)
- **Edit Contacts** (polja i tagovi; vjerovatno već ima)
- **View Calendars**, **View Calendar Events**, **Edit Calendar Events** (Done/No-show, pomjeranje, Meet link)

Ako token dobije nove dozvole, a ključ se promijeni, novi ključ zalijepi u portal (Forms → GoHighLevel).

### 2. Telefon i SMS: Quo + GHL (preporuka)
Quo (bivši OpenPhone) ima **zvaničnu HighLevel aplikaciju**: kontakti iz GHL-a idu u Quo, a svaki Quo poziv (snimak, AI sažetak) i SMS upisuje se u razgovor kontakta u GHL-u. **GHL workflowi ne mogu slati SMS sa Quo broja.**

Zato:
- **Enrique zadržava Quo broj** za svoje pozive i lične poruke. Povežemo Quo → HighLevel da sve stoji na kontaktu.
- **GHL dobija svoj broj (LC Phone)** samo za automatske poruke (podsjetnici, recenzije, ponude). U svakoj poruci piše "Enrique from District", pa kupac zna ko piše. Na odgovor kupca Enrique odgovara iz GHL-a (Conversations ili LeadConnector app).

**Quo → HighLevel:**
1. Quo plan **Business ili Scale**. Na Starteru integracija ne postoji.
2. U Quo-u (Owner ili Admin): Settings → Integrations → HighLevel → Connect.
3. Prijava u GHL, izbor sub-accounta "Jewelery Lead" / District, izbor Quo brojeva koji se sinhronizuju.
4. Prijava u GHL mora imati pravo da instalira Marketplace aplikacije (agency ili admin).

Napomene: Quo ne spaja postojeće kontakte po broju, pa duplikat je moguć. Aktivnost iz vremena dok je veza pala se ne nadoknađuje. Kontakti napravljeni u Quo-u ne idu u GHL (nije bitno, naši idu iz JewelryLeada u GHL).

**Alternative (ne preporučujem sada):**
- Prenos Quo broja u GHL (port): jedan broj za sve, ali Enrique gubi Quo. Traje 2-4 sedmice i treba LOA i račun.
- GHL webhook → Quo API: poruke sa Quo broja, ali GHL ne zna za STOP u Quo-u (rizik). Nije zvanično podržano.

### 3. A2P 10DLC registracija GHL broja (bez nje SMS ne ide)
Kupi broj: Settings → Phone System → Phone Numbers → Add Number (720 ili 303, Denver). Zatim Settings → Phone System → **Trust Center → A2P Messaging → Start Registration**.

**Brand:**
- "Has a Tax ID?" → **Yes** (Standard brand). Sole proprietor je samo za firme bez EIN-a.
- Pravno ime firme **tačno kao na IRS pismu CP-575 ili 147C**. Upload CP-575 sam popuni ime, EIN i adresu. EIN mlađi od 15 dana zna biti odbijen.
- Vrsta firme, industrija, EIN, poslovni mejl. Adresa bez P.O. box-a.
- Ovlašćena osoba (Enrique): ime, poslovni mejl, telefon, funkcija. Zatim provjera identiteta (Persona ili mejl kod).

**Campaign:**
- Trust Center → Brand & Campaigns → Campaigns → Create Campaign → **Low Volume**, **Manual Setup** (forma je naša, ne GHL chat widget).
- Use case: **Mixed** (podsjetnici i ponude sa istog broja). U GHL-u to automatski postaje Low Volume Mixed ($1,50 mjesečno).
- Opis (primjer): "District Jewelers sends appointment confirmations and reminders, order updates, review requests and follow-ups about custom jewelry quotes to customers who requested a quote on our website form and opted in to text messages."
- Opt-in: web forma. URL forme: Districtova stranica sa JewelryLead formom. Opis toka: "Customers fill out the custom jewelry request form on district-jewelers.com. Two separate, optional, unchecked checkboxes: one for non-marketing texts about their request, quote, appointments and order, one for marketing texts. The form can be submitted without either."
- Privacy i Terms: radnja nema svoje stranice, pa idu naše (forma ih već linkuje): `https://jewelrylead.com/legal/<id forme>/privacy` i `.../terms`. U njima već stoji rečenica o nedijeljenju mobilnih podataka, HELP/STOP i "Carriers are not liable".
- Primjeri poruka (dva, različita):
  > District Jewelers: Hi Ana, you're booked for a studio visit Sat, Nov 29 at 2:30 PM, 1550 Larimer St. Need another time? jewelrylead.com/p/... Reply STOP to opt out.

  > District Jewelers: Hi Ana, Enrique here. Your custom grillz price is held until Sun 3 PM. Want a quick 10-min call to go over it? jewelrylead.com/p/... Reply STOP to opt out.
- Prođe AI provjeru → Submit. Odobrenje traje nekoliko radnih dana. Poslije provjeri da broj ima oznaku "A2P Verified".

**Troškovi (GHL, nov 2026):** brand + prva kampanja $22,50 jednom, Low Volume Mixed $1,50 mjesečno, broj $1,15 mjesečno, SMS oko $0,0075 po dijelu poruke plus naknada operatera.

**Česti razlozi odbijanja:** checkbox obavezan ili unaprijed štikliran, fale učestalost / "message and data rates" / STOP pored checkboxa, marketing i nemarketing u istom checkboxu, privacy bez rečenice o nedijeljenju, skraćeni linkovi (bit.ly), ime na sajtu različito od imena brenda (onda u opisu "We are doing DBA as District Jewelers"). Naša forma pokriva sve osim posljednjeg, a to zavisi od pravnog imena firme.

**Važno za puštanje:** SMS pristanak na formi (commit b084e4d) je u ovoj grani. Bez njega kontakti nemaju tag `sms consent`, pa SMS workflowi nemaju kome da šalju (idu samo mejlovi).

### 4. Google Calendar i Google Meet
Za svakog člana tima koji prima termine (Enrique):
1. U GHL-u (prijavljen kao on): **Calendars → Calendar Settings → Connections → + Add New → Google → Connect**, dozvoli puni pristup kalendaru.
2. U istom ekranu (Calendar Configuration): **Linked Calendar** = njegov Google kalendar. Tu GHL upisuje termine. **Conflict Calendars** = svi njegovi kalendari koji ga zauzimaju. Samo događaji označeni "Busy" blokiraju termine.
3. Ostavi **one-way sync** (podrazumijevano): GHL termini idu u Google, a Google zauzetost blokira termine. Two-way bi od svakog Google događaja pravio GHL kontakt i palio workflowe.

Kalendar **Online consultation**:
4. Calendars → Online consultation → Edit → **Team members**: Enrique je član.
5. Kod člana: **+ Add Location → Google Meet → Save**. Ovo radi kod Round Robin i Service kalendara, ne kod Event kalendara.
6. U JewelryLead portalu: Bookings → Calendar on customer pages → uključi **Google Meet link for each video call** → Save.

Oba kalendara (Online consultation i Studio visit):
7. **Notifications:** ugasi ugrađene **Reminder**, **Cancellation** i **Reschedule** obavijesti, jer njih sad šalju naši workflowi (inače kupac dobija duplo, a GHL "Cancellation" ide čak i kad se termin označi kao No-show). Booked confirmation isto ugasi (šalje je workflow `jl appt booked`).
8. "Allow Google Calendar to send invitation emails to attendees": **uključi** ako želiš da kupac dobije i Google pozivnicu sa Meet linkom (lijepo za video poziv). Ako ostane isključeno, kupac link dobija iz naše poruke i sa svoje stranice.

**Proba (obavezna, jer GHL ne piše da API termin pravi Meet):** zakaži sebi video konsultaciju preko stranice kupca. U portalu Bookings termin treba da ima Meet link, a na stranici kupca dugme za Meet. Ako linka nema poslije par minuta: Google veza istekla, lokacija nije Meet, ili termin nije dodijeljen Enriqueu. JewelryLead tada pamti `meetMissing`, a kupac vidi "Video link coming by text and email".

### 5. Reputation (za zahtjev za recenziju)
1. Reputation → Settings: poveži **Google Business Profile** prave lokacije.
2. Review Requests: uključi SMS i mejl, upiši tekst (dolje), **podsjetnici: 2 puta na 3-4 dana** (staju sami na klik).
3. **Ne praviti** "kako smo bili?" sa linkom samo za 4-5 zvjezdica (review gating: Google i FTC zabranjuju). Svi dobijaju isti javni link.
4. Bez poklona ili popusta za recenziju. Yelp se ne traži.

### 6. Workflowi (jedan po tagu)
**Za svaki workflow:**
- Trigger **Contact Tag** → Tag Added → tag iz tabele.
- Settings: **Allow re-entry: ON**, **Stop on response: OFF**. Time window ne treba (JewelryLead već bira sat).
- Poruka: **If/Else** "Contact has tag `sms consent`" (prodajne: `sms marketing consent`) → **Send SMS**, inače → **Send Email**.
- Zadnji korak: **Remove Contact Tag** (isti tag).
- U tekstu koristi polja: **Custom Values → Contact → JL ...** (lista sa ključevima je u portalu, Forms → GoHighLevel → "Fields to use in your messages").

Tekstovi (engleski, od Enriquea, uvijek sa imenom radnje i STOP u prvoj poruci):

**Ponuda**
- `jl offer not opened`: "Hey {{contact.first_name}}, Enrique from District. Did you get a chance to see your {{contact.jl_piece}} design? It's here: {{contact.jl_page_url}} Reply STOP to opt out."
- `jl offer saved`: "Hey {{contact.first_name}}, your {{contact.jl_piece}} design is saved here: {{contact.jl_page_url}} Price held until {{contact.jl_offer_expires}}. Questions? Just reply. Reply STOP to opt out."
- `jl offer 24h left` (SMS + mejl sa renderom `{{contact.jl_render_url}}`): "{{contact.first_name}}, Enrique here. Your {{contact.jl_piece}} is on hold until {{contact.jl_offer_expires}}. Want me to walk you through it on a quick 10-min call? {{contact.jl_page_url}}"
- `jl offer final hours`: "Last few hours on your {{contact.jl_piece}} price. After that I re-quote at that day's gold price, which can go up or down. {{contact.jl_page_url}}"
- `jl offer expired`: "Your price hold ended. Want today's price? Tap 'Request a refreshed quote' on your page: {{contact.jl_page_url}}"
- `jl offer closeout`: "Should I keep your {{contact.jl_piece}} design on file, or close it out for now? Either is totally fine."
- `jl refresh ready`: "Your refreshed price is ready and held for 24 hours: {{contact.jl_page_url}}"
- `jl deposit click`: **Create Task** za Enriquea "Call/text {{contact.first_name}}: opened the deposit, didn't pay" + Internal Notification → Wait 2 h → If/Else tag `jl deposit paid` → kraj, inače SMS (marketing pristanak): "Anything I can help with on the deposit? I can hold it with a smaller one or set up a quick call."
- `jl refresh needs quote`: samo **Internal Notification + Task** Enriqueu: "Metal moved: send {{contact.first_name}} a new price ({{contact.jl_lead_id}})".

**Termini**
- `jl appt booked`: "Hey {{contact.first_name}}, it's Enrique from District. You're booked: {{contact.jl_appt_type}}, {{contact.jl_appt_time}}. {{contact.jl_appt_location}}. Need another time? {{contact.jl_reschedule_url}} Reply STOP to opt out." Uz mejl može i Google Meet link `{{contact.jl_meet_link}}`.
- `jl visit 3 days`: "See you {{contact.jl_appt_time}} at the studio, {{contact.first_name}}. Need another time? {{contact.jl_reschedule_url}}"
- `jl visit 24h`: "See you tomorrow, {{contact.jl_appt_time}}. Reply C to confirm or R to pick another time." Opciono: Wait for reply 21 h → bez odgovora → Task "Call {{contact.first_name}}, visit not confirmed".
- `jl visit 2h`: "Enrique is pulling pieces for you. {{contact.jl_appt_location}}. See you at {{contact.jl_appt_time}}."
- `jl call 1h`: "Your consultation with District is in 1 hour ({{contact.jl_appt_time}}). {{contact.jl_appt_location}}"
- `jl call 10 min`: "Calling you in 10 minutes. {{contact.jl_meet_link}}" (za telefon: "Calling you in 10 minutes, save this number so you pick up.")
- `jl appt no show`: "We missed you today, no worries. Want to pick another time? {{contact.jl_reschedule_url}}" → Wait 1 dan → link još jednom → Wait 2 dana → zadnji put.
- `jl appt showed no deposit` (marketing pristanak za SMS): "Great meeting you, {{contact.first_name}}. Here's your {{contact.jl_piece}} with the price: {{contact.jl_page_url}} I'm holding it for you."
- `jl appt cancelled`: "Got it, want to pick another time? {{contact.jl_reschedule_url}}"

**Preuzimanje i recenzija**
- `jl order ready`: "Your {{contact.jl_piece}} is ready for pick up! Order {{contact.jl_order_no}}. Reply to set a time."
- `jl picked up`: bez linka za recenziju. Samo "Thank you" od Enriquea (ili Task Enriqueu da pošalje klip reveal-a). Opciono +10 dana, samo uz marketing pristanak: "Tag @district in a pic with your piece, we'd love to repost it."
- `jl review request`: If/Else tag `review requested` → kraj. Inače **Send Review Request** (SMS ili mejl po pristanku) + Add tag `review requested`. Tekst u Reputation Settings: "Hey {{contact.first_name}}, Enrique from District. Hope you're loving the {{contact.jl_piece}}! If you have a minute, an honest Google review helps us a lot: {review_link}. Reply STOP to opt out."
- Odvojen workflow **Review Received** 1-2 zvjezdice → SMS i mejl vlasniku + Task "call the customer within 24 h".

### 7. Uključenje i proba
1. Portal → Forms → GoHighLevel: **Create the JL fields in GoHighLevel** (treba "15 of 15 fields ready").
2. Napravi i **objavi** sve workflowe iz koraka 6.
3. Probni kontakt (tvoj mejl i telefon, sa SMS checkboxima): pošalji formu, pa u portalu Automations uključi **Send automation tags to GoHighLevel**. Prvi tag stiže poslije 4 h (`jl offer not opened` ili `saved`). Brže se probaju termini: zakaži studio i poziv sebi, pa treba da stigne `jl appt booked` sa vremenom i adresom ili Meet linkom.
4. U portalu "Last automation tags" pokazuje šta je otišlo i greške. U GHL-u: Contact → Activity i Workflow → Execution logs.
5. **Ne pali** ništa dok A2P nije "Verified": do tada SMS korak pada, a mejl radi.

## Otvoreno / za provjeru uživo
- Da li API termin pravi Meet link (GHL to ne piše; očekujemo da, proba u koraku 4).
- Da li tag dodat preko API-ja pali "Contact Tag Added" (praksa kaže da, proba u koraku 7).
- Pravno ime firme i EIN za A2P (pitanje za Enriquea), i da li Quo već ima registraciju (za Quo pozive to ne mijenja ništa).
- Reminder kupcu mejlom za radnje bez GHL-a (Resend) nije napravljen; ovo radi samo preko GHL-a.
