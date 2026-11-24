-- Tagovi leada (District 24.11.2026: "Add tags Friend / Family / In-Store / Returning customer / etc").
-- JSON niz kratkih natpisa, npr. ["Friend","Returning customer"]; zlatar ih bira u portalu i filtrira po njima.
ALTER TABLE leads ADD COLUMN tags TEXT;
