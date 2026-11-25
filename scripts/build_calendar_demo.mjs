// Pravi migrations/0038_calendar_demo.sql: probna radnja za kalendar, depozit i pitanja poslije depozita (25.11.2026).
//   node scripts/build_calendar_demo.mjs
import { writeFileSync } from 'node:fs';
import { SUGGESTED_PRICING } from '../public/pricing.js';

const now = Date.now();
const pricing = {
  ...SUGGESTED_PRICING,
  quoteInfo: 'Calendar Demo Jewelers (test store)\n1600 Champa St, Denver, CO\nMon to Sat 10 AM to 6 PM',
  // "Plaćanje" odmah vraća kupca na njegovu stranicu sa pitanjima poslije depozita (kao GHL redirect poslije uplate).
  depositUrl: 'https://jewelrylead.com/deposit/done',
  offerHours: 48,
  updatedAt: now,
};
delete pricing.alertEmails; delete pricing.replyTo; delete pricing.autoSend;
const data = {
  website: 'jewelrylead.com', logo: '', pricing,
  notes: 'Test store for the customer page calendar, deposit and next steps (25.11.2026). Not a real client: no GoHighLevel, no emails.',
  booking: {
    enabled: true, tz: 'America/Denver',
    kinds: { online: { on: true, minutes: 10, video: '' }, visit: { on: true, minutes: 30 } },
    hours: { sun: null, mon: ['10:00', '18:00'], tue: ['10:00', '18:00'], wed: ['10:00', '18:00'], thu: ['10:00', '18:00'], fri: ['10:00', '18:00'], sat: ['10:00', '17:00'] },
    closed: ['2026-11-26', '2026-12-25'], step: 15, buffer: 5, notice: 1, days: 14, region: 'Colorado', moldKit: true,
  },
};
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const copyForm = (src, extra = '') => `INSERT OR IGNORE INTO forms (id, data, client_id, template, updated_at)
  SELECT 'calendar-demo-form', json_set(data, '$.id', 'calendar-demo-form', '$.name', 'Calendar demo', '$.clientId', 'calendar-demo', '$.brand.name', 'Calendar Demo Jewelers'${extra}), 'calendar-demo', template, ${now}
  FROM forms WHERE id = '${src}';`;
const sql = `-- Probna radnja za kalendar, depozit i pitanja poslije depozita (25.11.2026, Ognjen: "pusti live ali u neku mock formu i portal").
-- Nije pravi klijent: bez GHL-a i bez mejlova. Depozit link vodi pravo na /deposit/done, pa "plaćanje" odmah vraća kupca na pitanja.
-- Forma je kopija Districtovih pitanja i boja, bez njihovog logoa; cijene su predložene JewelryLead cijene, ne Districtove.
-- Portal: admin → Calendar Demo Jewelers → View as / link klijenta. Pravi se samo ako ne postoji (INSERT OR IGNORE).
INSERT OR IGNORE INTO clients (id, name, data, created_at) VALUES ('calendar-demo', 'Calendar Demo Jewelers', ${q(JSON.stringify(data))}, ${now});
${copyForm('district-jewelers-denver-enrique-gon-cus', ", '$.brand.logo', '', '$.allowedOrigins', json('[]')")}
${copyForm('landing-demo')}
`;
writeFileSync(new URL('../migrations/0038_calendar_demo.sql', import.meta.url), sql);
console.log('migrations/0038_calendar_demo.sql');
