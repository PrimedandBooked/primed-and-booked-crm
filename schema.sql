-- Authoritative schema for the Primed & Booked CRM (Cloudflare D1).
-- Recreate the database with:
--   wrangler d1 execute alignment-automations-db --remote --file schema.sql

CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  package TEXT,
  status TEXT DEFAULT 'lead',
  start_date TEXT,
  alignment_tasks TEXT DEFAULT '[]',   -- JSON array of Matthew's tasks
  clinic_tasks    TEXT DEFAULT '[]',   -- JSON array of client tasks
  follow_ups      TEXT DEFAULT '[]',   -- JSON array of launched email sequences
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Prospecting fields (from the outreach playbook)
  industry  TEXT,   -- trade: Painting, HVAC, Roofing, ...
  source    TEXT,   -- where the lead was found
  priority  TEXT,   -- hot | warm | cold
  lead_note TEXT,   -- the "leak/angle" to show on camera

  -- Outreach tracker (carried over from a prospect on push; edited in the
  -- business's Outreach tab). See migrate_outreach.sql.
  channel        TEXT,
  leak_flagged   TEXT,
  date_sent      TEXT,
  watched        INTEGER DEFAULT 0,
  replied        INTEGER DEFAULT 0,
  next_follow_up TEXT,
  outreach_stage TEXT DEFAULT 'New',

  -- Legacy SMS columns (kept for compatibility; the app is email-only).
  sms_consent      INTEGER  DEFAULT 0,
  sms_consent_at   DATETIME DEFAULT NULL,
  sms_opted_out    INTEGER  DEFAULT 0,
  sms_opted_out_at DATETIME DEFAULT NULL
);

-- Rate-limiting ledger for the public form endpoint. One row per accepted
-- submission; `emailed` marks the ones that triggered an auto-reply. Rows older
-- than 7 days are pruned by the endpoint. See migrate_form_rate_limit.sql.
CREATE TABLE IF NOT EXISTS form_submissions (
  id         TEXT PRIMARY KEY,
  ip         TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  emailed    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_ip_time ON form_submissions(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_emailed ON form_submissions(emailed, created_at);

-- All follow-up sequences are stored as a single JSON document in the row id='all'.
CREATE TABLE IF NOT EXISTS sequences (
  id   TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Prospecting: scored leads found via the Prospecting page, before they're
-- pushed into `clinics`. See migrate_prospects.sql.
CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  place_id TEXT UNIQUE,                 -- Google Places id; dedups repeated searches

  business_name TEXT NOT NULL,
  trade TEXT,                           -- lowercase search key, e.g. "painter" (matches INDUSTRY_MAP)
  search_location TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,                           -- scraped from site if found; user-editable
  website TEXT,
  rating REAL,
  review_count INTEGER,
  business_status TEXT,
  google_maps_url TEXT,
  gbp_status TEXT,                      -- "Complete" | "Incomplete" | "Unclaimed / bare" — see migrate_gbp_status.sql

  website_check TEXT DEFAULT '{}',      -- JSON: {attempted, reachable, statusCode, loadTimeMs,
                                         --   mobileFriendly, agencyDetected, builderPlatform, email,
                                         --   social:{facebook,instagram,twitter,linkedin}}
  manual_signals TEXT DEFAULT '{"runsAds":false,"growthIntent":false,"ownerOperated":false}',

  score INTEGER DEFAULT 0,
  tier TEXT,                            -- "Record today" | "Warm" | "Park it"

  channel TEXT,
  leak_flagged TEXT,
  date_sent TEXT,
  watched INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  next_follow_up TEXT,
  outreach_stage TEXT DEFAULT 'New',

  pushed_clinic_id TEXT DEFAULT NULL,   -- set once pushed to the pipeline; NULL = not yet pushed
  pushed_at DATETIME DEFAULT NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
