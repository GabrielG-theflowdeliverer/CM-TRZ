import { nowIso, type Db } from '../../infra/db.js';
import { getProject } from '../projects/projects.service.js';
import { readExportRowSets, type ExportRowSets } from './transfer.repo.js';

/**
 * Full-fidelity project export: the repo's raw row sets wrapped in a versioned
 * file envelope. Rows are keyed by their original ids; import re-keys
 * everything and remaps references.
 */
export interface ProjectExport extends ExportRowSets {
  format: 'change-management-tool/project';
  version: 2;
  exportedAt: string;
}

export function exportProject(db: Db, projectId: string): ProjectExport {
  getProject(db, projectId);
  const rowSets = readExportRowSets(db, projectId);
  // Never carry the live share token in an export file — it's an access
  // credential, and its UNIQUE index would collide on import/duplicate.
  delete rowSets.project.share_token;
  return {
    format: 'change-management-tool/project',
    version: 2,
    exportedAt: nowIso(),
    ...rowSets,
  };
}
