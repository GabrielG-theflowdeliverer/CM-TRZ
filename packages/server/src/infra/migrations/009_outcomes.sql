-- Sustain Outcomes (Prosci Phase 3): defined success objectives, their
-- adoption/benefit metrics, and timestamped measurements. Realization % is
-- derived on read (never stored) from the raw measurements.
CREATE TABLE objectives (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  statement TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_objectives_project ON objectives(project_id);

CREATE TABLE metrics (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- 'adoption' | 'benefit'
  name TEXT NOT NULL,
  unit TEXT,
  baseline REAL,
  target REAL,
  direction TEXT NOT NULL DEFAULT 'increase',
  adoption_measure TEXT,              -- adoption metrics: speed | utilization | proficiency
  group_id TEXT REFERENCES impacted_groups(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_metrics_objective ON metrics(objective_id);

CREATE TABLE measurements (
  id TEXT PRIMARY KEY,
  metric_id TEXT NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  value REAL NOT NULL
);
CREATE INDEX idx_measurements_metric ON measurements(metric_id, date);
