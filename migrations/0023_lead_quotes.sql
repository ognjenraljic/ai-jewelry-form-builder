-- Quote poruke uz lead (Ognjen 19.11.2026): generisana poruka ostaje zabilježena za taj lead i poslije izlaska ili
-- osvježavanja, a izmjena zlatara se čuva kao najnovija verzija.
-- JSON: { "picked": { msg, source, spec, edited, at }, "fit": { ... } }
--   picked = Estimated price (tačno kako je kupac izabrao), fit = Fits the budget (spec = podešeni izbori za tu poruku).
ALTER TABLE leads ADD COLUMN quotes TEXT;
