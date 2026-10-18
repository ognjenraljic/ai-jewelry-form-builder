-- Zahtjevi za demo sa Karatly sajta (naši potencijalni klijenti, zlatari).
CREATE TABLE demo_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT NOT NULL,
  platform TEXT,
  volume TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX demo_requests_ip ON demo_requests(ip, created_at);
