-- District Jewelers Denver (22.11.2026): satovi su pokazivali "Missing prices" jer nije bilo rada za sat.
-- Predlog: $450 rada za bust-down (otvaranje, priprema, poliranje, sklapanje); bez grama = kupčev sat, bez metala.
-- Samo ako District još nije upisao svoj broj; zlatar ga mijenja u Pricing → Weight and labor.
UPDATE clients SET data = json_set(data, '$.pricing.labor', json_patch(COALESCE(json_extract(data, '$.pricing.labor'), '{}'), '{"watch":450}'))
  WHERE id = 'district-jewelers-denver-enrique-gon' AND json_type(data, '$.pricing') = 'object' AND json_type(data, '$.pricing.labor.watch') IS NULL;
