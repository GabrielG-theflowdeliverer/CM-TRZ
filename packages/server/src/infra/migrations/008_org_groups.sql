-- Org groups: the real-world groups projects impact, identified across
-- projects so change saturation can be summed per group. Project groups link
-- via org_group_id (manual linking with suggestions — never auto-matched);
-- deleting an org group unlinks, it never touches project data.
CREATE TABLE org_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE impacted_groups ADD COLUMN org_group_id TEXT REFERENCES org_groups(id) ON DELETE SET NULL;
CREATE INDEX idx_groups_org ON impacted_groups(org_group_id);
