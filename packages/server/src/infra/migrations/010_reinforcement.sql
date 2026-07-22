-- Reinforcement / sustainment actions (Prosci Phase 3): the "act" side of the
-- measure → explain → act loop. Group-scoped, or project-wide when group_id is
-- NULL; a group's actions are removed with the group.
CREATE TABLE reinforcement_actions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES impacted_groups(id) ON DELETE CASCADE,
  mechanism TEXT NOT NULL,
  owner TEXT,
  status TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_reinforcement_project ON reinforcement_actions(project_id);
