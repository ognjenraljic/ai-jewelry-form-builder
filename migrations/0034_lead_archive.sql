-- Arhiviranje leada (Ognjen 24.11.2026): lead nestaje iz liste, brojeva, statistike i obavještenja portala, ništa se ne briše.
-- archived_at = vrijeme arhiviranja (ms), NULL = aktivan; vraća se iz filtera Archived.
ALTER TABLE leads ADD COLUMN archived_at INTEGER;
