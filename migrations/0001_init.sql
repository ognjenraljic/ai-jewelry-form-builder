CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  token TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  answers TEXT NOT NULL,
  ref_key TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX leads_form ON leads(form_id, created_at);
CREATE INDEX leads_ip ON leads(ip, created_at);

CREATE TABLE renders (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  n INTEGER NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  tweak TEXT,
  image_key TEXT,
  status TEXT NOT NULL,
  error TEXT,
  ms INTEGER,
  in_tokens INTEGER,
  out_tokens INTEGER,
  cost_usd REAL,
  created_at INTEGER NOT NULL
);
CREATE INDEX renders_lead ON renders(lead_id, created_at);
