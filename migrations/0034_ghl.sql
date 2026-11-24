-- GoHighLevel (24.11.2026, priprema): šta je za lead poslato u GHL radnje.
-- JSON { contactId, tagged, noted, oppId, at, error, tries }; NULL = nije slato (GHL nije uključen ili lead stariji).
ALTER TABLE leads ADD COLUMN ghl TEXT;
