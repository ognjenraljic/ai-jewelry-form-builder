-- Dnevnik koraka po leadu (21.11.2026): dokaz brzine i rezultata za zlatara (prvi odgovor, kopirane ponude, statusi,
-- obavještenja, automatska prva poruka, posjete stranici kupca). Upisuje se pored postojećih kolona, ništa se ne briše.
-- type: created | quote_generated | quote_copied | contact_copied | status | alert_sent | alert_failed | auto_sent | auto_send_failed | page_view | page_action
CREATE TABLE lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  client_id TEXT,
  type TEXT NOT NULL,
  at INTEGER NOT NULL,
  meta TEXT
);
CREATE INDEX lead_events_lead ON lead_events(lead_id, at);
CREATE INDEX lead_events_client ON lead_events(client_id, type, at);

-- alerted_at: radnja dobila mejl o leadu; auto_sent_at: kupac dobio prvu poruku mejlom;
-- first_reply_at: prvi odgovor (kopirana ponuda, status Contacted/Quoted/Won ili automatska poruka).
ALTER TABLE leads ADD COLUMN alerted_at INTEGER;
ALTER TABLE leads ADD COLUMN auto_sent_at INTEGER;
ALTER TABLE leads ADD COLUMN first_reply_at INTEGER;
