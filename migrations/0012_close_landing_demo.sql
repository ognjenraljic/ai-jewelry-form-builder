-- Javni demo sa početne je sklonjen: forma se arhivira, pa /f/landing-demo i novi upiti više ne rade, a podaci ostaju.
UPDATE forms SET archived_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 'landing-demo' AND archived_at IS NULL;
