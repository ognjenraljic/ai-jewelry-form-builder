-- Kratak film komada, napravljen iz rendera preko Pike. Trošak se upisuje odmah kao procjena, da budžeti važe i dok posao traje.
CREATE TABLE films (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  render_id TEXT NOT NULL,
  job_id TEXT,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  video_key TEXT,
  status TEXT NOT NULL,
  error TEXT,
  ms INTEGER,
  cost_usd REAL,
  created_at INTEGER NOT NULL
);
CREATE INDEX films_lead ON films (lead_id);
CREATE INDEX films_created ON films (created_at);
