-- District Jewelers Denver (19.11.2026): store info koji ide na kraj svake quote poruke iz portala (Ognjen poslao njihov tekst).
-- Upisuje samo pricing.quoteInfo; zlatar ga mijenja u portalu (Pricing tab).
UPDATE clients SET data = json_set(COALESCE(data, '{}'), '$.pricing', json_set(COALESCE(json_extract(COALESCE(data, '{}'), '$.pricing'), '{}'), '$.quoteInfo', json('"📍District Jewelers\n701 S Monaco Pkwy Denver, CO 80224\nMon-Sat 10am-6pm\nSun APPOINTMENT ONLY\n\nGrillz Turnaround:\nDental 2-4 weeks\nGold/Silver 3-6 weeks\nIced Teeth 4-8 weeks\n\nOut Of State Customers:\n$60 molding kit fee Plus Shipping Fees back"')))
  WHERE id = 'district-jewelers-denver-enrique-gon';
