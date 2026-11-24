# JewelryLead → GoHighLevel (priprema 24.11.2026)

Grana `web/ghl-prep` (nije na produkciji). Sve je isključeno dok radnja ne upiše token i ne uključi slanje.

## Šta radi
Za svaki NOVI lead (poslije uključenja), odmah poslije prve quote poruke:
1. kontakt: `POST /contacts/upsert` (ime razdvojeno, mejl, telefon, izvor "JewelryLead · <forma>"), bez tagova u upsertu jer bi zamijenili postojeće;
2. tagovi: `POST /contacts/{id}/tags` = "jewelrylead" (podesivo) + "jewelrylead <komad>" + zlatarovi tagovi iz portala;
3. bilješka: `POST /contacts/{id}/notes` = svi izbori, opis kupca, grad po pozivnom broju, link stranice kupca (`?preview=1`, ne broji posjetu), Estimated price i gotova poruka;
4. opportunity: `POST /opportunities/` u izabranom pipeline-u, faza = ono što je mapirano na New, vrijednost = Estimated price.
Promjena statusa u portalu: `PUT /opportunities/{id}` (faza po mapiranju; Won/Lost = status won/lost). Novi tag u portalu ide i na kontakt.
Greška: `leads.ghl.error`, cron (svakih 5 min) pokušava ponovo do 5 puta za leadove zadnja 24 h; zadnja greška se vidi na kartici.

Kod: `src/ghl.js`, rute `/api/portal/ghl*` i `ghlSyncLead`/`ghlSweep` u `src/worker.js`, kartica u portalu Forms → GoHighLevel, migracija `0034_ghl.sql` (`leads.ghl`). Provjera: `node scripts/ghl-check.mjs` (lažni GHL, 21 provjera).

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
