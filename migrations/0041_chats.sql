-- AI asistenti (26.11.2026): razgovor kupca na njegovoj stranici (scope 'page', jedan po leadu)
-- i zlatarev asistent u portalu (scope 'portal', jedan po sesiji portala). Istorija živi na serveru,
-- pa kupac ne može podmetnuti lažne odgovore asistenta.
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  client_id TEXT,
  lead_id TEXT,
  messages TEXT NOT NULL DEFAULT '[]',
  turns INTEGER NOT NULL DEFAULT 0,
  handoff INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chats_lead ON chats (lead_id, updated_at);
CREATE INDEX IF NOT EXISTS chats_client ON chats (client_id, scope, updated_at);
