-- Praćenje narudžbe (23.11.2026): lead sa statusom Won dobija broj narudžbe (npr. DJ-7K4Q9) i fazu izrade.
-- Kupac na sajtu radnje (District: /order-tracking/) upiše broj i svoj mejl i vidi dokle je stigao njegov komad.
-- order_data JSON: { stage: 0-5, at: { "<faza>": ms }, note: tekst za kupca, updatedAt: ms }
ALTER TABLE leads ADD COLUMN order_no TEXT;
ALTER TABLE leads ADD COLUMN order_data TEXT;
CREATE UNIQUE INDEX leads_order_no ON leads(order_no) WHERE order_no IS NOT NULL;

-- Pokušaji praćenja po mreži (limit pogađanja brojeva); stari redovi se brišu noću.
CREATE TABLE order_lookups (
  net TEXT NOT NULL,
  at INTEGER NOT NULL,
  ok INTEGER NOT NULL
);
CREATE INDEX order_lookups_net ON order_lookups(net, at);
