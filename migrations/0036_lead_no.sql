-- ID leada (25.11.2026, District: "unique lead ID for filtering"): redni broj po radnji (L-0001), u portalu i u GoHighLevel-u.
-- Postojeći leadovi dobijaju broj po redu stizanja, posebno za svaku radnju; novi upit dobija sljedeći broj pri upisu.
ALTER TABLE leads ADD COLUMN lead_no INTEGER;
UPDATE leads SET lead_no = (
  SELECT x.rn FROM (SELECT l.id AS id, ROW_NUMBER() OVER (PARTITION BY f.client_id ORDER BY l.created_at, l.id) AS rn FROM leads l JOIN forms f ON f.id = l.form_id) x
  WHERE x.id = leads.id
);
CREATE INDEX leads_lead_no ON leads(lead_no);
-- Težine lanaca iz 14K kataloga (District, 25.11.2026): uključeno za District, ostale radnje ga uključuju u Pricing tabu.
UPDATE clients SET data = json_set(data, '$.pricing.chainWeights', json('{"on":true}'))
  WHERE id = 'district-jewelers-denver-enrique-gon' AND json_type(data, '$.pricing') = 'object' AND json_type(data, '$.pricing.chainWeights') IS NULL;
-- GoHighLevel proizvodna tabla (25.11.2026): kartica narudžbe za radnike, bez podataka kupca.
-- JSON { contactId, noted, oppId, stage (zadnja faza usklađena sa GHL-om), at, polledAt, error, tries }.
ALTER TABLE leads ADD COLUMN ghl_order TEXT;
