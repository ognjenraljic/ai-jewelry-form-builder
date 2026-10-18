-- "View as client": privremena sesija admina u portalu klijenta. Čuvamo samo hash tokena.
CREATE TABLE portal_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  kind TEXT NOT NULL,            -- 'view-as' (admin), kasnije 'client' (pravi nalog zlatara)
  ip TEXT,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ended_at INTEGER
);
CREATE INDEX portal_sessions_client ON portal_sessions(client_id, started_at);
