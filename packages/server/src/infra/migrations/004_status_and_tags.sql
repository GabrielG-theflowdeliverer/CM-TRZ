-- Project status lifecycle (official Proxima: Active / Completed / Paused-On Hold)
-- replaces the archived boolean; archived projects map to Paused / On Hold.
ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'Active';
UPDATE projects SET status = CASE WHEN archived = 1 THEN 'Paused / On Hold' ELSE 'Active' END;
ALTER TABLE projects DROP COLUMN archived;

-- Group tags (JSON array of strings).
ALTER TABLE impacted_groups ADD COLUMN tags TEXT;
