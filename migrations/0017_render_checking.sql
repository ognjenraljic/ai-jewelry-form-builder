-- Provjera broja zuba (grillz) radi u pozadini: kupac odmah vidi prvi render, a ispravljena slika ga zamijeni kad stigne.
-- checking = 1 dok provjera traje (forma pita za stanje), NULL kad je gotova ili je nije bilo.
ALTER TABLE renders ADD COLUMN checking INTEGER;
