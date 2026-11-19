-- Stranica za kupca po leadu (Ognjen 19.11.2026): /p/<page_key> sa njegovim dizajnom, ponudama i dugmadima Deposit i
-- Book appointment. page_key je nepogodiv i odvojen od tokena upita (link se šalje porukom, ne daje pravo na rendere).
-- page: JSON { views, firstView, lastView, actions: [{ action: 'deposit'|'appointment', option: 'picked'|'fit', at }] }
ALTER TABLE leads ADD COLUMN page_key TEXT;
ALTER TABLE leads ADD COLUMN page TEXT;
UPDATE leads SET page_key = lower(hex(randomblob(12))) WHERE page_key IS NULL;
CREATE UNIQUE INDEX leads_page_key ON leads(page_key);
