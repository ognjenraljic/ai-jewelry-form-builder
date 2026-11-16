-- District Jewelers Denver (16.11.2026): "Generate a highlight video of your piece" kao dugme za kupca.
-- Radi tek kad je PIKA_API_KEY postavljen na Workeru; do tada se dugme ne prikazuje i ništa se ne naplaćuje.
-- Mijenja se samo ako video na formi još nije podešen (zlatar ga je mogao sam podesiti u builderu). Stara verzija ide u History.
INSERT INTO form_versions (id, form_id, data, saved_at)
  SELECT 'mig16district', id, data, updated_at FROM forms
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.highlightVideo') IS NULL;

UPDATE forms SET data = json_set(data, '$.highlightVideo', 'button')
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.highlightVideo') IS NULL;
