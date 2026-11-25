-- A2P 10DLC pristanak (25.11.2026): uz svaki nov upit čuva se šta je kupac označio i tačan tekst koji je vidio.
-- JSON: { contact: 1, sms: 0|1, mkt: 0|1, at, ip, page, text: { contact, sms, mkt } }. Stari leadovi ostaju NULL = nepoznato (nema SMS-a).
ALTER TABLE leads ADD COLUMN consent TEXT;
