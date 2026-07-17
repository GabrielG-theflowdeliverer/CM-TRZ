-- Structured CM Performance Reports (official Proxima): a dated report that
-- enumerates every ADKAR blueprint and CM plan with a 5-level metric status.

CREATE TABLE cm_perf_reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TEXT,
  status TEXT,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_cm_perf_reports_project ON cm_perf_reports(project_id);

CREATE TABLE cm_perf_items (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES cm_perf_reports(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  -- what the row measures: an ADKAR blueprint or a CM plan
  kind TEXT NOT NULL,
  ref_id TEXT,
  label TEXT,
  status TEXT,
  description TEXT
);
CREATE INDEX idx_cm_perf_items_report ON cm_perf_items(report_id, position);

-- Migrate legacy free-form entries into a single "Legacy entries" report per project.
INSERT INTO cm_perf_reports (id, project_id, name, date, status, created_at)
SELECT project_id || ':legacy-cm-perf', project_id, 'Legacy entries', MIN(scheduled_date), 'Completed', ''
FROM cm_perf_entries
GROUP BY project_id;

INSERT INTO cm_perf_items (id, report_id, position, kind, ref_id, label, status, description)
SELECT id, project_id || ':legacy-cm-perf', position,
       CASE type
         WHEN 'ADKAR Blueprint' THEN 'blueprint'
         WHEN 'Core Plan' THEN 'plan'
         WHEN 'Extend Plan' THEN 'plan'
         ELSE 'other'
       END,
       NULL, COALESCE(description, type), status, notes
FROM cm_perf_entries;

DROP TABLE cm_perf_entries;

-- Key Impacted Groups watch list (up to 5 group ids, JSON array).
ALTER TABLE projects ADD COLUMN watch_group_ids TEXT;
