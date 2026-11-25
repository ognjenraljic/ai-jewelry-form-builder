# JewelryLead → GoHighLevel (priprema 24.11.2026)

Na produkciji od 24.11.2026 (migracija 0035). Sve je isključeno dok radnja ne upiše token i ne uključi slanje.

## Šta radi
Za svaki NOVI lead (poslije uključenja), odmah poslije prve quote poruke:
1. kontakt: `POST /contacts/upsert` (ime razdvojeno, mejl, telefon, izvor "JewelryLead · <forma>"), bez tagova u upsertu jer bi zamijenili postojeće;
2. tagovi: `POST /contacts/{id}/tags` = "jewelrylead" (podesivo) + "jewelrylead <komad>" + zlatarovi tagovi iz portala;
3. bilješka: `POST /contacts/{id}/notes` = svi izbori, opis kupca, grad po pozivnom broju, link stranice kupca (`?preview=1`, ne broji posjetu), Estimated price i gotova poruka;
4. opportunity: `POST /opportunities/` u izabranom pipeline-u, faza = ono što je mapirano na New, vrijednost = Estimated price.
Promjena statusa u portalu: `PUT /opportunities/{id}` (faza po mapiranju; Won/Lost = status won/lost). Novi tag u portalu ide i na kontakt.
Greška: `leads.ghl.error`, cron (svakih 5 min) pokušava ponovo do 5 puta za leadove zadnja 24 h; zadnja greška se vidi na kartici.

Kod: `src/ghl.js`, rute `/api/portal/ghl*` i `ghlSyncLead`/`ghlSweep` u `src/worker.js`, kartica u portalu Forms → GoHighLevel, migracija `0035_ghl.sql` (`leads.ghl`). Provjera: `node scripts/ghl-check.mjs` (lažni GHL, 21 provjera).

## Šta treba od radnje (District) kad budemo spajali
1. **Private Integration token** sub-accounta: Settings → Private Integrations → Create, dozvole: View/Edit Contacts, View/Edit Opportunities, View Locations (i Custom Fields ako kasnije budemo slali polja). Token ide direktno u portal (polje je password, čuva se šifrovano sa `PORTAL_LINK_KEY`), nikad kroz chat.
2. **Location ID**: Settings → Business Profile (ili iz adrese `/location/<ID>/`).
3. **Pipeline** u koji idu leadovi (ili da ga napravimo: New Lead, Contacted, Quote Sent, Won, Lost). U portalu "Load pipelines" pogađa faze po imenu, zlatar potvrdi.
4. Da li njihov GHL već ima workflow na tag/novi kontakt (npr. automatski SMS): prvi test lead pravi PRAVI kontakt i može ga pokrenuti. Probu raditi sa našim mejlom i dogovorom.

## Prije puštanja provjeriti na pravom nalogu
- `Version` zaglavlje (`GHL_VERSION = 2021-07-28` u `src/ghl.js`; MMC CRM izvoz koristi `v3` za contacts): ako GHL vrati grešku verzije, promijeniti tu jednu konstantu.
- Odgovor upserta (`contact.id`), opportunity (`opportunity.id`), da li `monetaryValue` i `source` prolaze.
- Duplikati: GHL upsert spaja po mejlu/telefonu prema podešavanju "Allow duplicate contacts" u njihovom nalogu.

## Kasnije (nije urađeno)
- GHL → JewelryLead: webhook kad prodavac pomjeri opportunity u GHL-u (status u portalu da prati).
- Custom polja (komad, metal, budžet) umjesto samo bilješke, sa "Load fields" kao u MMC CRM-u.
- Slike rendera kao prilog (sada link stranice kupca, koja ima sve verzije i video).

## Slanje postojećih leadova (24.11.2026)

Kartica ima i "Also send the leads you already have": cron šalje sve aktivne leadove koji još nisu u GHL-u, od najstarijeg, 12 po krugu (svakih 5 min), svaki u fazu svog statusa iz portala (Won i Lost odmah zatvoreni). Arhivirani se nikad ne šalju. Lead od prije uključenja ne ide bez te opcije. Kartica pokazuje koliko je poslato, koliko čeka i koliko je palo. Lokalna proba cijelog toka: `scripts/mock-ghl.mjs` + `scripts/ghl-flow-check.mjs` (17 provjera), `GHL_BASE` radi samo uz `DEV_MODE`.

## ID leada i proizvodna tabla za radnike (25.11.2026)

District: "unique lead ID for filtering" i "moissanite outsourcing ne smije biti rizik: radnici koji pomjeraju fazu narudžbe ne vide ništa o kupcu".

**ID leada** (`leads.lead_no`, migracija 0036): redni broj po radnji, prikaz `L-0231`. Postojeći leadovi su numerisani po redu stizanja. Stoji na kartici leada (sa Copy), u pretrazi portala (`L-0231`, `#231`, `231`, i broj narudžbe `DJ-7K4Q9`), na početku imena opportunity-ja (`L-0231 · Ime · custom chain`) i u prvom redu bilješke. Već poslati opportunity-ji se preimenuju u cronu, 20 po krugu (`leads.ghl.ref` = urađeno, `'missing'` = opportunity obrisan u GHL-u).

**Proizvodna tabla** (`leads.ghl_order`, `clients.data.ghl.prod`): Won lead sa brojem narudžbe ide u POSEBAN pipeline (isti kao prodajni je odbijen) na POSEBAN kontakt `Order DJ-7K4Q9` bez mejla, telefona, imena, cijene i linka stranice kupca. Bilješka ima samo specifikacije (redovi sa e-mail/phone/address/budget/price/contact u nazivu se izbacuju), sliku rendera (nikad try-on, jer ima kupčevu fotku) i, samo ako je uključeno, opis kupca sa uklonjenim mejlovima i brojevima. Kontakt i kartica su dodijeljeni (`assignedTo`) korisniku radnika.
- U GHL-u radnik dobija korisnika sa **Only assigned data** za Contacts, Opportunities i Conversations, pa vidi samo kartice dodijeljene njemu. To je jedina zaštita na strani GHL-a: ako radnik ima pristup svim podacima, vidjeće i prodajne kontakte.
- Faze: portal → kartica odmah (`PUT /opportunities/{id}`); kartica → portal i stranica praćenja kupca preko crona (`GET /opportunities/{id}`, 25 po krugu, gotove narudžbe još 3 dana). Poredi se sa zadnjom usklađenom fazom (`ghl_order.stage`), pa neuspjelo slanje iz portala ne vraća portal unazad.
- "Load users" traži dozvolu **View Users** na tokenu; bez nje se User ID upiše ručno (Settings > My Staff).
- Provjera: `node scripts/mock-ghl.mjs 8897` + `wrangler dev --port 8811 --test-scheduled --var GHL_BASE:http://127.0.0.1:8897` + `node scripts/ghl-orders-check.mjs` (26 provjera, uključuje i težine lanaca).

## Kalendar na stranici kupca, depozit i sljedeći korak (25.11.2026)

District: "Book an appointment = online konsultacija od 5-10 min da prođemo sve što je lead poslao i zatvorimo prodaju, ili posjeta radnji; depozit online preko GHL-a, pa workflow na depozit: da li je u Coloradu, dolazi li u radnju ili šaljemo otisak / komad".

**Kalendar** (portal → Bookings → Calendar on customer pages, `clients.data.booking`, `src/booking.js`): vrste termina Online consultation (5-30 min, telefon ili video link) i Studio visit, radno vrijeme po danu, zona radnje, razmak, pauza, najranije, koliko dana unaprijed, neradni dani. Isključeno dok zlatar ne uključi; isključen kalendar = dugme radi kao ranije. Stranica kupca: "Book an appointment" otvara izbor vrste, dana i vremena; potvrda sa .ics; kupac vidi svoj termin (Add to calendar, Change time, Cancel), jedan termin po vrsti. Dva kupca na isto vrijeme: jedan upis u bazu sa NOT EXISTS (drugi dobija 409). Tabela `appointments` (migracija 0037).

**GHL kalendar** (Forms → GoHighLevel → Appointments and deposits): po vrsti termina može se izabrati GHL kalendar; tada slobodna mjesta daje `GET /calendars/{id}/free-slots` (njihova dostupnost, tim, Google sync), a termin ide `POST /calendars/events/appointments` na kontakt. Bez izbora: radno vrijeme iz portala. U oba slučaja kontakt dobija bilješku i tagove `jewelrylead appointment` + `jewelrylead online consultation` / `jewelrylead studio visit`. Otkazivanje (kupac ili zlatar) otkazuje i u GHL-u. Kalendari i poruke idu na `Version: 2021-04-15`. Dozvole tokena: View Calendars, Edit Calendar Events (i Edit Conversation Messages za SMS). Pad upisa: `appointments.ghl.error`, cron ponavlja do 5 puta za buduće termine.

**Depozit**: "Reserve with a deposit" vodi na link iz Pricing taba sa `first_name`, `last_name`, `email`, `phone` (Stripe: `prefilled_email`, `client_reference_id` = ID leada) i ostavlja kolačić `jl_dep` (SameSite=Lax, 2 h). Na GHL payment linku se podesi redirect poslije plaćanja na `https://jewelrylead.com/deposit/done`: kolačić vrati kupca na `/p/<key>?deposit=1#next` (nepotvrđeno, `deposit.returnedAt`).
- Potvrda uplate: GHL workflow, okidač Payment Received (ili Order Submitted), akcija Webhook POST na adresu iz portala (`/api/hooks/ghl/<32 znaka>`, `clients.data.ghl.hookKey`). Lead se traži po GHL kontaktu, pa mejlu, pa telefonu (zadnjih 10 cifara). Iznos iz `customData.amount` ili payment/order polja. Upiše `leads.deposit.paidAt`, obavještenje u portalu; prvi put i bilješka u GHL-u i (ako je uključeno) SMS kupcu sa linkom `/p/<key>?next=1` preko `POST /conversations/messages`. Ponovljen webhook ne šalje novi SMS. Nepoznat kupac: 200 bez promjena, "Last call" u kartici to pokazuje.
- Status leada se NE mijenja sam (Won ostaje ručno).

**Poslije depozita** (sekcija `#next` na stranici kupca, vidi se poslije depozita, povratka sa plaćanja ili sa `?next=1`): "Are you in Colorado?" (država iz podešavanja), u regiji: dolazi u radnju (grillz: za otisak, inače preuzimanje) sa izborom termina posjete ili šaljemo; van regije: slanje (grillz: kit za otisak poštom ako je uključeno). Adresa za slanje obavezna. `leads.fulfillment`; GHL: bilješka, tagovi `jewelrylead in colorado` / `jewelrylead out of state`, `jewelrylead studio visit` / `jewelrylead ship mold kit` / `jewelrylead ship piece` (za grananje njihovih workflowa) i adresa na kontaktu (`PUT /contacts/{id}`).

Portal: tab Bookings = podešavanje kalendara, Appointments po danima (Done / No-show / Cancel), Deposits and next steps (link za kupca kad odgovor fali), stari Button presses. Kartica leada pokazuje termin, depozit i odgovor. Provjera: `node scripts/mock-ghl.mjs 8899` + `wrangler dev --port 8812 --test-scheduled --var GHL_BASE:http://127.0.0.1:8899` + `BASE=http://127.0.0.1:8812 GHL=http://127.0.0.1:8899 node scripts/booking-check.mjs` (55 provjera).

Nije probano sa pravim GHL-om: free-slots oblik odgovora, upis termina, SMS, tačan sadržaj webhooka za Payment Received (iznos se čita iz više mogućih polja; ako ne stigne, u workflowu dodati Custom Data `amount`).
