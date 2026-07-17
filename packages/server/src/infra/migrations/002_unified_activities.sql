-- Unified activity model: blueprint and plan activities become one entity
-- with multi-links to ADKAR outcomes, impacted groups, plans, blueprints
-- and roster roles (mirrors official Proxima's Blueprints-and-Plans page).

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  method_mechanism TEXT,
  roles_required_text TEXT,
  responsible TEXT,
  start_date TEXT,
  finish_date TEXT,
  status TEXT,
  result_feedback TEXT,
  -- targets the overall change (in addition to / instead of specific groups)
  overall INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_activities_project ON activities(project_id, position);

CREATE TABLE activity_adkar (
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  element TEXT NOT NULL,
  PRIMARY KEY (activity_id, element)
);

CREATE TABLE activity_groups (
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES impacted_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, group_id)
);

CREATE TABLE activity_plans (
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, plan_id)
);

CREATE TABLE activity_blueprints (
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, blueprint_id)
);

CREATE TABLE activity_roles (
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, role_id)
);

-- ---- data migration: blueprint activities ----
INSERT INTO activities (id, project_id, position, name, roles_required_text, start_date, finish_date, status, overall)
SELECT ba.id, b.project_id, ba.position, ba.name, ba.roles_required, ba.start_date, ba.finish_date, ba.status,
       CASE WHEN b.scope_kind = 'overall' THEN 1 ELSE 0 END
FROM blueprint_activities ba
JOIN blueprints b ON b.id = ba.blueprint_id;

INSERT INTO activity_adkar (activity_id, element)
SELECT id, element FROM blueprint_activities;

INSERT INTO activity_blueprints (activity_id, blueprint_id)
SELECT id, blueprint_id FROM blueprint_activities;

INSERT INTO activity_groups (activity_id, group_id)
SELECT ba.id, b.group_id
FROM blueprint_activities ba
JOIN blueprints b ON b.id = ba.blueprint_id
WHERE b.group_id IS NOT NULL;

-- ---- data migration: plan activities ----
INSERT INTO activities (id, project_id, position, name, method_mechanism, roles_required_text, responsible, start_date, finish_date, status, result_feedback, overall)
SELECT pa.id, p.project_id, pa.position, pa.name, pa.method_mechanism, pa.roles_required, pa.responsible, pa.start_date, pa.finish_date, pa.status, pa.result_feedback,
       CASE WHEN pa.group_id IS NULL THEN 1 ELSE 0 END
FROM plan_activities pa
JOIN plans p ON p.id = pa.plan_id;

INSERT INTO activity_plans (activity_id, plan_id)
SELECT id, plan_id FROM plan_activities;

INSERT INTO activity_adkar (activity_id, element)
SELECT id, adkar_outcome FROM plan_activities WHERE adkar_outcome IS NOT NULL;

INSERT INTO activity_groups (activity_id, group_id)
SELECT id, group_id FROM plan_activities WHERE group_id IS NOT NULL;

DROP TABLE blueprint_activities;
DROP TABLE plan_activities;

-- ---- roadmap: per-group ADKAR milestones + named releases ----
-- group_id '' = the overall change (kept NOT NULL so the primary key works).
CREATE TABLE roadmap_adkar_milestones_v2 (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  release_no INTEGER NOT NULL,
  element TEXT NOT NULL,
  group_id TEXT NOT NULL DEFAULT '',
  date TEXT,
  PRIMARY KEY (project_id, release_no, element, group_id)
);
INSERT INTO roadmap_adkar_milestones_v2 (project_id, release_no, element, group_id, date)
SELECT project_id, release_no, element, '', date FROM roadmap_adkar_milestones;
DROP TABLE roadmap_adkar_milestones;
ALTER TABLE roadmap_adkar_milestones_v2 RENAME TO roadmap_adkar_milestones;

ALTER TABLE roadmap_releases ADD COLUMN name TEXT;
