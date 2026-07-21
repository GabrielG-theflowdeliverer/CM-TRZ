-- View-only sharing: an opaque token per project granting read-only dashboard
-- access. NULL = sharing disabled. Rotating the token revokes old links.
ALTER TABLE projects ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX idx_projects_share_token ON projects(share_token);
