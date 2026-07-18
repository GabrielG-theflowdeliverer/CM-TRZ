-- Survey campaigns: one distribution of an existing assessment to role-holders.
CREATE TABLE survey_campaigns (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_survey_campaigns_project ON survey_campaigns(project_id);

-- Recipients: a role-holder invited to a campaign, reached via an opaque token.
-- person_name is snapshotted at invite time; role_id SET NULL on role deletion
-- so removing someone from the roster never erases a survey they submitted.
CREATE TABLE survey_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES survey_campaigns(id) ON DELETE CASCADE,
  role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
  person_name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  submitted_at TEXT,
  UNIQUE (campaign_id, role_id)
);
CREATE INDEX idx_survey_recipients_campaign ON survey_recipients(campaign_id);

-- Per-recipient responses, mirroring assessment_responses.
CREATE TABLE survey_responses (
  recipient_id TEXT NOT NULL REFERENCES survey_recipients(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  value REAL,
  PRIMARY KEY (recipient_id, item_key)
);
