-- District Jewelers Denver (14.11.2026): ispravke po njihovoj listi.
-- Svaka izmjena ide samo ako je na tom mjestu očekivano pitanje (forma se u međuvremenu mogla promijeniti u builderu).
-- Prethodna verzija ostaje u History (form_versions), pa se vraća jednim klikom.
INSERT INTO form_versions (id, form_id, data, saved_at)
  SELECT 'mig14district', id, data, updated_at FROM forms WHERE id = 'district-jewelers-denver-enrique-gon-cus';

-- "How iced?" je prvo pitanje o kamenju: bez uslova (ranije je zavisilo od Stones, koje dolazi poslije njega).
UPDATE forms SET data = json_remove(data, '$.steps[3].fields[2].showIf')
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.steps[3].fields[2].id') = 'coverage';

-- How iced = None: Stones, Clarity i Stone setting se ne prikazuju. "No stones" više nema smisla pored None.
UPDATE forms SET data = json_set(data, '$.steps[3].fields[3].showIf', json('{"field":"coverage","notIn":["none"]}'))
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.steps[3].fields[3].id') = 'stones';
UPDATE forms SET data = json_remove(data, '$.steps[3].fields[3].options[0]')
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.steps[3].fields[3].id') = 'stones' AND json_extract(data, '$.steps[3].fields[3].options[0].value') = 'none';
UPDATE forms SET data = json_set(data, '$.steps[3].fields[5].showIf', json('{"field":"coverage","notIn":["none"]}'))
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.steps[3].fields[5].id') = 'stone_setting' AND json_extract(data, '$.steps[3].fields[5].showIf') IS NULL;

-- Cut (grillz) se ne kombinuje sa kamenjem: prikazuje se samo kad grillz nije ledeni.
UPDATE forms SET data = json_set(data, '$.steps[6].fields[0].andIf', json('[{"field":"coverage","not":["accents","half","full"]}]'))
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.steps[6].fields[0].id') = 'grillz_grill_cut';

-- Stil slova odmah poslije natpisa: 5 muških, 5 ženskih, Per request (public/lettering.js).
UPDATE forms SET data = json_set(data, '$.steps[12].fields', json_array(
    json(json_extract(data, '$.steps[12].fields[0]')),
    json('{"id":"font","type":"chips","label":"Lettering style","subtitle":"For the name or engraving. Not sure? Pick Per request and describe it.","required":false,"lettering":true,"followup":"text","options":[{"value":"old-english","label":"Old English","note":"Old English blackletter lettering: bold gothic letters with sharp angled strokes and pointed serifs, like classic nameplates and name grillz"},{"value":"gothic","label":"Gothic","note":"condensed gothic blackletter lettering with heavy vertical strokes, clean and modern"},{"value":"varsity","label":"Varsity","note":"varsity block lettering: square college-jersey letters with slab serifs"},{"value":"block","label":"Block","note":"tall bold block capital letters, clean sans-serif, no serifs"},{"value":"graffiti","label":"Graffiti","note":"graffiti street lettering: bold hand-drawn marker letters with energy"},{"value":"elegant-script","label":"Elegant script","note":"elegant flowing cursive script with long graceful swashes, letters connected"},{"value":"classic-script","label":"Classic script","note":"classic copperplate calligraphy script, fine thin and thick strokes, letters connected"},{"value":"casual-script","label":"Casual script","note":"casual bouncy handwritten script, rounded and friendly, letters connected"},{"value":"french-script","label":"French script","note":"French romantic script with soft loops, letters connected"},{"value":"flowing-script","label":"Flowing script","note":"light flowing signature-style script, slanted and airy, letters connected"},{"value":"per-request","label":"Per request","note":"lettering style exactly as the customer describes it"}]}'),
    json(json_extract(data, '$.steps[12].fields[1]')),
    json(json_extract(data, '$.steps[12].fields[2]'))))
  WHERE id = 'district-jewelers-denver-enrique-gon-cus' AND json_extract(data, '$.steps[12].fields[0].id') = 'inscription' AND json_array_length(data, '$.steps[12].fields') = 3
    AND NOT EXISTS (SELECT 1 FROM json_tree(forms.data) WHERE key = 'id' AND value = 'font');

UPDATE forms SET updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 'district-jewelers-denver-enrique-gon-cus';
