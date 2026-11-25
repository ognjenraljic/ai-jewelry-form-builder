-- District Jewelers Denver: kalendar na stranicama kupaca uključen (25.11.2026, Ognjen: "pusti kalendar live").
-- Radno vrijeme iz njihovog store infa (Mon-Sat 10am-6pm, Sun appointment only), Denver, pitanje poslije depozita "Are you in Colorado?".
-- Upisuje se samo ako radnja još nema svoje podešavanje (portal → Bookings → Calendar on customer pages); tamo se sve mijenja i gasi.
UPDATE clients SET data = json_set(COALESCE(data, '{}'), '$.booking', json('{"enabled":true,"tz":"America/Denver","kinds":{"online":{"on":true,"minutes":10,"video":""},"visit":{"on":true,"minutes":30}},"hours":{"sun":null,"mon":["10:00","18:00"],"tue":["10:00","18:00"],"wed":["10:00","18:00"],"thu":["10:00","18:00"],"fri":["10:00","18:00"],"sat":["10:00","18:00"]},"closed":["2026-11-26","2026-12-25"],"step":15,"buffer":5,"notice":2,"days":14,"region":"Colorado","moldKit":true}'))
  WHERE id = 'district-jewelers-denver-enrique-gon' AND json_type(COALESCE(data, '{}'), '$.booking') IS NULL;
