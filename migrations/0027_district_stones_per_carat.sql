-- District Jewelers Denver (22.11.2026): kamenje van grillza se računa po površini komada (broj kamenova i karati),
-- pa treba cijena po karatu za sitno kamenje i za centralni kamen, plus ugradnja po kamenu. Početne vrijednosti,
-- samo ako District još nije upisao svoje; stare cijene "po komadu" ostaju u bazi ali se više ne koriste.
-- Zlatar ih mijenja u portalu (Pricing tab, kartica Stones, $ per carat).
UPDATE clients SET data = json_set(data, '$.pricing', json_patch(json_extract(data, '$.pricing'), json('{"stones":{"moissanite":{"ct":40,"center":150},"lab-grown diamonds":{"ct":150,"center":350},"natural diamonds":{"ct":600,"center":4000},"default":{"ct":150,"center":350}},"setting":1.5}')))
  WHERE id = 'district-jewelers-denver-enrique-gon' AND json_type(data, '$.pricing') = 'object' AND json_type(data, '$.pricing.stones.moissanite.ct') IS NULL;
