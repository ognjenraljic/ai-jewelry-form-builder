-- Metal movement (26.11.2026): tab u portalu sa grafikom cijena zlata, srebra i platine i upozorenjima kad se cijena pomakne.
-- metal_samples: spot cijena (USD po unci) svakih 5 min iz crona; služi za upozorenja i kao rezerva grafiku kad izvor istorije ne radi.
CREATE TABLE IF NOT EXISTS metal_samples (at INTEGER PRIMARY KEY, gold REAL, silver REAL, platinum REAL);
-- metal_cache: odgovori izvora istorije (zajednički za sve radnje, javni podaci): ključ = metal|raspon|interval.
CREATE TABLE IF NOT EXISTS metal_cache (k TEXT PRIMARY KEY, at INTEGER NOT NULL, data TEXT NOT NULL);
-- metal_alerts: upozorenja po radnji; ulaze u Notifications.
CREATE TABLE IF NOT EXISTS metal_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  metal TEXT NOT NULL,
  from_price REAL NOT NULL,
  to_price REAL NOT NULL,
  pct REAL NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS metal_alerts_client ON metal_alerts (client_id, at);
