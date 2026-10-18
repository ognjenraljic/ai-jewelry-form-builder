-- Klijenti (zlatari). Svaka forma pripada klijentu i nastaje iz šablona.
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
ALTER TABLE forms ADD COLUMN client_id TEXT;
ALTER TABLE forms ADD COLUMN template TEXT;
CREATE INDEX forms_client ON forms(client_id);
-- Dodatni fajlovi kupca (custom upload pitanja i dodatno polje za fajl): {"polje": "r2 ključ"}
ALTER TABLE leads ADD COLUMN files TEXT;
