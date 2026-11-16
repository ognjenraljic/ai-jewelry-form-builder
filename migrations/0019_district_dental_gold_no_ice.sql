-- District Jewelers Denver (16.11.2026): Dental Gold ne nosi kamenje. Kad je izabran, How iced? se ne prikazuje,
-- pa ni Stones, Clarity i Stone setting (zavise od How iced?); Cut ostaje. Pitanje se traži po ID-ju (json_tree), stara verzija u History.
INSERT INTO form_versions (id, form_id, data, saved_at)
  SELECT 'mig19district', id, data, updated_at FROM forms WHERE id = 'district-jewelers-denver-enrique-gon-cus';

UPDATE forms SET data = json_set(data,
    (SELECT t.path FROM json_tree(forms.data) t WHERE t.key = 'id' AND t.atom = 'coverage' AND t.path LIKE '$.steps[%].fields[%]' AND t.path NOT LIKE '%.options%') || '.andIf',
    json('[{"field":"metal","not":["dental-gold"]}]'))
  WHERE id = 'district-jewelers-denver-enrique-gon-cus'
    AND (SELECT t.path FROM json_tree(forms.data) t WHERE t.key = 'id' AND t.atom = 'coverage' AND t.path LIKE '$.steps[%].fields[%]' AND t.path NOT LIKE '%.options%') IS NOT NULL;
