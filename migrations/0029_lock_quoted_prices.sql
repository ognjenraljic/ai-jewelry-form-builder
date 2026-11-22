-- Žive cijene metala (22.11.2026): ponuda za koju je već napravljena poruka ostaje na cijeni iz te poruke, da se
-- stranica kupca ne razlikuje od poslate poruke kad se cijena zlata pomjeri. Nove poruke zaključavaju cijenu same.
UPDATE leads SET quotes = json_set(quotes, '$.picked.price', CAST(ROUND(json_extract(quotes, '$.picked.total')) AS INTEGER))
  WHERE json_type(quotes, '$.picked.msg') = 'text' AND json_type(quotes, '$.picked.price') IS NULL AND json_extract(quotes, '$.picked.total') > 0;
UPDATE leads SET quotes = json_set(quotes, '$.fit.price', CAST(ROUND(json_extract(quotes, '$.fit.total')) AS INTEGER))
  WHERE json_type(quotes, '$.fit.msg') = 'text' AND json_type(quotes, '$.fit.price') IS NULL AND json_extract(quotes, '$.fit.total') > 0;
