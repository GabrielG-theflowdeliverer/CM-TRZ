CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_type TEXT,
  pm_approach TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Generic engine for every scored instrument; multiple runs per project = rows.
CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject_kind TEXT NOT NULL DEFAULT 'project',
  subject_id TEXT,
  label TEXT,
  scheduled_date TEXT,
  completed_date TEXT,
  status TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_assessments_project ON assessments(project_id, type);
CREATE INDEX idx_assessments_subject ON assessments(subject_kind, subject_id);

CREATE TABLE assessment_responses (
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  value REAL,
  PRIMARY KEY (assessment_id, item_key)
);

CREATE TABLE impacted_groups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  num_people INTEGER,
  adoption_usage_definition TEXT,
  unique_considerations TEXT
);
CREATE INDEX idx_groups_project ON impacted_groups(project_id, position);

CREATE TABLE group_aspects (
  group_id TEXT NOT NULL REFERENCES impacted_groups(id) ON DELETE CASCADE,
  aspect_key TEXT NOT NULL,
  yesterday TEXT,
  tomorrow TEXT,
  impact INTEGER,
  PRIMARY KEY (group_id, aspect_key)
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  roster TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  role_name TEXT,
  person_name TEXT,
  role_definition TEXT,
  support TEXT,
  influence TEXT,
  activation_tactics TEXT
);
CREATE INDEX idx_roles_project ON roles(project_id, roster, position);

CREATE TABLE role_groups (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES impacted_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, group_id)
);

CREATE TABLE blueprints (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_kind TEXT NOT NULL,
  group_id TEXT REFERENCES impacted_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_blueprints_project ON blueprints(project_id);

CREATE TABLE blueprint_elements (
  blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  element TEXT NOT NULL,
  milestone_override_date TEXT,
  gauge_gap TEXT,
  PRIMARY KEY (blueprint_id, element)
);

CREATE TABLE blueprint_activities (
  id TEXT PRIMARY KEY,
  blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  element TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  roles_required TEXT,
  start_date TEXT,
  finish_date TEXT,
  status TEXT
);
CREATE INDEX idx_bp_activities ON blueprint_activities(blueprint_id, element, position);

CREATE TABLE blueprint_snapshots (
  id TEXT PRIMARY KEY,
  blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  plan_type TEXT,
  sponsor TEXT,
  practitioner TEXT,
  last_updated TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_plans_project ON plans(project_id, position);

CREATE TABLE plan_activities (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  adkar_outcome TEXT,
  group_id TEXT REFERENCES impacted_groups(id) ON DELETE SET NULL,
  method_mechanism TEXT,
  roles_required TEXT,
  responsible TEXT,
  start_date TEXT,
  finish_date TEXT,
  status TEXT,
  result_feedback TEXT
);
CREATE INDEX idx_plan_activities ON plan_activities(plan_id, position);

CREATE TABLE roadmaps (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'sequential',
  kickoff_date TEXT,
  golive_date TEXT,
  outcomes_date TEXT
);

CREATE TABLE roadmap_releases (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  release_no INTEGER NOT NULL,
  date TEXT,
  PRIMARY KEY (project_id, release_no)
);

CREATE TABLE roadmap_adkar_milestones (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  release_no INTEGER NOT NULL,
  element TEXT NOT NULL,
  date TEXT,
  PRIMARY KEY (project_id, release_no, element)
);

CREATE TABLE tracking_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  schedule TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  scheduled_date TEXT,
  completed_date TEXT,
  description TEXT,
  status TEXT,
  results TEXT,
  notes TEXT
);
CREATE INDEX idx_tracking_project ON tracking_entries(project_id, schedule, position);

CREATE TABLE cm_perf_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  type TEXT,
  description TEXT,
  scheduled_date TEXT,
  completed_date TEXT,
  status TEXT,
  notes TEXT
);
CREATE INDEX idx_cmperf_project ON cm_perf_entries(project_id, position);

CREATE TABLE adapt_actions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  assessment_results TEXT,
  strengths TEXT,
  opportunities TEXT,
  observations TEXT,
  implications TEXT,
  action_steps TEXT,
  notes TEXT
);

CREATE TABLE project_docs (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_key TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (project_id, doc_key, field_key)
);

CREATE TABLE resistance_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  group_id TEXT REFERENCES impacted_groups(id) ON DELETE SET NULL,
  group_label TEXT,
  anticipated_resistance TEXT,
  special_tactics TEXT
);
CREATE INDEX idx_resistance_project ON resistance_items(project_id, position);
