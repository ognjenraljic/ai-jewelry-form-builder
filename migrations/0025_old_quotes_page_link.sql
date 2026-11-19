-- Link stranice kupca i u quote porukama napravljenim prije 19.11.2026 17:13 UTC (Ognjen 19.11.2026), i u izmijenjenima.
-- Link ide između teksta poruke i store infa zlatara (kao u novim porukama); ako store info nije u poruci, ide na kraj.
-- Poruke koje već imaju link (/p/) se ne diraju. Ostatak teksta ostaje kakav je.
UPDATE leads SET quotes = json_set(quotes, '$.picked.msg', (
  WITH x AS (
    SELECT json_extract(leads.quotes, '$.picked.msg') AS msg,
      COALESCE((SELECT json_extract(c.data, '$.pricing.quoteInfo') FROM forms f JOIN clients c ON c.id = f.client_id WHERE f.id = leads.form_id), '') AS info,
      'See your design and quote: https://jewelrylead.com/p/' || leads.page_key AS link
  )
  SELECT CASE WHEN info <> '' AND instr(msg, info) > 1
    THEN rtrim(substr(msg, 1, instr(msg, info) - 1), char(10)) || char(10) || char(10) || link || char(10) || char(10) || substr(msg, instr(msg, info))
    ELSE rtrim(msg, char(10)) || char(10) || char(10) || link END FROM x))
WHERE page_key IS NOT NULL AND json_type(quotes, '$.picked.msg') = 'text' AND instr(json_extract(quotes, '$.picked.msg'), '/p/') = 0;

UPDATE leads SET quotes = json_set(quotes, '$.fit.msg', (
  WITH x AS (
    SELECT json_extract(leads.quotes, '$.fit.msg') AS msg,
      COALESCE((SELECT json_extract(c.data, '$.pricing.quoteInfo') FROM forms f JOIN clients c ON c.id = f.client_id WHERE f.id = leads.form_id), '') AS info,
      'See both options side by side: https://jewelrylead.com/p/' || leads.page_key AS link
  )
  SELECT CASE WHEN info <> '' AND instr(msg, info) > 1
    THEN rtrim(substr(msg, 1, instr(msg, info) - 1), char(10)) || char(10) || char(10) || link || char(10) || char(10) || substr(msg, instr(msg, info))
    ELSE rtrim(msg, char(10)) || char(10) || char(10) || link END FROM x))
WHERE page_key IS NOT NULL AND json_type(quotes, '$.fit.msg') = 'text' AND instr(json_extract(quotes, '$.fit.msg'), '/p/') = 0;
