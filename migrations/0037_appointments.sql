-- Kalendar na stranici kupca i koraci poslije depozita (25.11.2026, District: online konsultacija / posjeta radnji,
-- depozit preko GoHighLevel-a, pa pitanje da li je kupac u Coloradu, dolazi li u radnju ili šaljemo otisak / komad).
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  lead_id TEXT,
  kind TEXT NOT NULL,              -- 'online' | 'visit'
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',   -- booked | cancelled | done | noshow
  via TEXT,                        -- online: 'phone' | 'video'
  purpose TEXT,                    -- 'consult' | 'mold' | 'pickup'
  option TEXT,                     -- ponuda sa stranice (picked | fit)
  note TEXT,
  source TEXT,                     -- 'page' | 'next-step'
  ghl TEXT,                        -- { contactId, eventId, noted, error, tries }
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS appointments_client_start ON appointments(client_id, start_at);
CREATE INDEX IF NOT EXISTS appointments_lead ON appointments(lead_id);
-- Depozit: { paidAt, amount, count, via, ref, returnedAt } (returnedAt = kupac se vratio sa stranice za plaćanje, nepotvrđeno).
ALTER TABLE leads ADD COLUMN deposit TEXT;
-- Poslije depozita: { local, method, kit, address, note, at, apptId }.
ALTER TABLE leads ADD COLUMN fulfillment TEXT;
