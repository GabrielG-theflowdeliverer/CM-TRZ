-- Transfer of ownership (Prosci Phase 3): the closing handoff of the change from
-- the temporary project structure to the permanent business owners. Each row is
-- one sustainment responsibility being transferred; `done` records the handoff
-- is confirmed. Items are removed with the project.
CREATE TABLE transfer_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  responsibility TEXT NOT NULL,
  new_owner TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_transfer_project ON transfer_items(project_id);
