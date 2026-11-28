-- Tab Workflows (28.11.2026): kanal slanja (GHL tag ili SMS preko Quo-a), maskiran primalac, tekst Quo poruke,
-- id poruke kod Quo-a (za potvrdu isporuke) i trenutak kad je GHL workflow potvrdio (jl_ack) ili Quo javio isporuku.
-- Stari redovi: channel NULL = 'ghl'.
ALTER TABLE ghl_events ADD COLUMN channel TEXT;
ALTER TABLE ghl_events ADD COLUMN target TEXT;
ALTER TABLE ghl_events ADD COLUMN body TEXT;
ALTER TABLE ghl_events ADD COLUMN ext_id TEXT;
ALTER TABLE ghl_events ADD COLUMN acked_at INTEGER;
CREATE INDEX IF NOT EXISTS ghl_events_ext ON ghl_events(ext_id);
-- Kupci koji su odgovorili STOP (Quo to obradi i sam, mi samo više ne šaljemo).
CREATE TABLE IF NOT EXISTS sms_optouts (client_id TEXT NOT NULL, phone TEXT NOT NULL, at INTEGER NOT NULL, source TEXT, PRIMARY KEY (client_id, phone));
