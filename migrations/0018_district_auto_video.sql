-- District Jewelers Denver (16.11.2026): video kreće sam čim je prva slika gotova, kupac ga otvara iz prozorčića ispod slike.
-- Samo ako je forma još na dugmetu iz 0016 (zlatar je mogao u builderu izabrati nešto drugo). Stara verzija ide u History.
INSERT INTO form_versions (id, form_id, data, saved_at)
  SELECT 'mig18district', id, data, updated_at FROM forms
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.highlightVideo') = 'button';

UPDATE forms SET data = json_set(data, '$.highlightVideo', 'auto')
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.highlightVideo') = 'button';
