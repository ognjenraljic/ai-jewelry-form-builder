-- Sigurnost i pouzdanost (pregled 20.10.2026).
-- Limit upita po mreži: IPv6 se broji po /64 (jedan korisnik ima milione adresa u svojoj mreži).
ALTER TABLE leads ADD COLUMN ip_net TEXT;
CREATE INDEX leads_ip_net ON leads(ip_net, created_at);
-- Status upita u portalu zlatara (new, contacted, quoted, won, lost) i njegova bilješka.
ALTER TABLE leads ADD COLUMN status TEXT;
ALTER TABLE leads ADD COLUMN note TEXT;
ALTER TABLE leads ADD COLUMN status_at INTEGER;
CREATE INDEX leads_created ON leads(created_at);
-- Dnevni budžet: zbir troška po danu.
CREATE INDEX renders_created ON renders(created_at);
CREATE INDEX test_renders_created ON test_renders(created_at);
-- Onboarding: broj verzije da se dva uređaja ne prepisuju tiho.
ALTER TABLE onboardings ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
-- Zahtjev za demo koji je popunio skriveno polje: čuva se kao mogući spam umjesto da nestane.
ALTER TABLE demo_requests ADD COLUMN spam INTEGER NOT NULL DEFAULT 0;
