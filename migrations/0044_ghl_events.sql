-- GHL workflowi (27.11.2026): JewelryLead odlučuje kad ide koja poruka iz tri toka (ponuda, termin, preuzimanje i
-- recenzija), upiše polja kontakta i doda tag događaja; GHL workflow na taj tag šalje poruku. Jedan red po događaju:
-- id = ključ događaja (npr. "offer_24h:<lead>:<početak ponude>"), pa isti događaj nikad ne ide dvaput (INSERT OR IGNORE).
-- status: sent | failed | holdout (kontrolna grupa, poruka namjerno nije poslata) | skipped.
CREATE TABLE IF NOT EXISTS ghl_events (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  lead_id TEXT,
  appt_id TEXT,
  ev TEXT NOT NULL,
  tag TEXT,
  at INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  tries INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ghl_events_client_at ON ghl_events(client_id, at);
CREATE INDEX IF NOT EXISTS ghl_events_lead ON ghl_events(lead_id);
-- Termin je prošao a zlatar nije označio Done ni No-show: kad je portal to tražio (jednom po terminu).
ALTER TABLE appointments ADD COLUMN unmarked_at INTEGER;
