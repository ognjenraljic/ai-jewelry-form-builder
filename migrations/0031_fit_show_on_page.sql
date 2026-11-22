-- "Show on sales page" za Fits the budget (22.11.2026): od sada je Option 2 na stranici kupca samo kad zlatar to uključi.
-- Fits the budget poruke koje već postoje su možda poslate sa linkom "See both options", pa ostaju uključene.
UPDATE leads SET quotes = json_set(quotes, '$.fit.show', json('true'), '$.fit.showAt', json_extract(quotes, '$.fit.at'))
  WHERE json_type(quotes, '$.fit.msg') = 'text' AND json_type(quotes, '$.fit.show') IS NULL;
