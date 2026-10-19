-- Istorija verzija forme: prije svakog Save stara verzija ide ovdje (čuva se zadnjih 50 po formi).
CREATE TABLE form_versions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  data TEXT NOT NULL,
  saved_at INTEGER NOT NULL
);
CREATE INDEX form_versions_form ON form_versions(form_id, saved_at);

-- Arhiva: sakriveno iz pregleda, arhivirana forma više ne prima upite. Ništa se ne briše.
ALTER TABLE forms ADD COLUMN archived_at INTEGER;
ALTER TABLE clients ADD COLUMN archived_at INTEGER;

-- Zahtjevi za demo: označeno kao obrađeno.
ALTER TABLE demo_requests ADD COLUMN handled_at INTEGER;

-- Probni renderi iz buildera: bez upita, ali trošak se računa.
CREATE TABLE test_renders (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  tweak TEXT,
  image_key TEXT,
  status TEXT NOT NULL,
  error TEXT,
  ms INTEGER,
  in_tokens INTEGER,
  out_tokens INTEGER,
  cost_usd REAL,
  created_at INTEGER NOT NULL
);
CREATE INDEX test_renders_form ON test_renders(form_id, created_at);
