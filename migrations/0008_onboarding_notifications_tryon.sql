-- Onboarding klijenta: zlatar preko svog portal linka popuni radnju, komade, stilove, materijale i budžet.
-- Čuva se dok kuca (draft), "Send" ga šalje (submitted), a forma napravljena iz njega ga zatvara (done).
CREATE TABLE onboardings (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  submitted_at INTEGER,
  form_id TEXT
);
CREATE INDEX onboardings_client ON onboardings(client_id, created_at);

-- Obavještenja za admina (zvonce u builderu): poslat onboarding, novi zahtjev za demo.
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  ref TEXT,
  created_at INTEGER NOT NULL,
  seen_at INTEGER
);
CREATE INDEX notifications_created ON notifications(created_at);

-- Vrsta rendera: NULL = dizajn komada, 'tryon' = grillz na fotografiji kupca (privatno, ne broji se u dorade).
ALTER TABLE renders ADD COLUMN kind TEXT;
