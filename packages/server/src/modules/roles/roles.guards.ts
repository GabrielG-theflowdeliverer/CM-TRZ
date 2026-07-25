import type { Db } from '../../infra/db.js';
import { HttpError } from '../../infra/http.js';
import { getRoleRow, type RoleRow } from './roles.repo.js';

/**
 * The roles module's answer to "may this project act on this role?", returning
 * the row so the caller doesn't read it twice. Kept beside the repo rather than
 * in roles.service because roles.service reaches assessments -> surveys, and
 * surveys is one of the callers.
 */
export function getRoleInProject(db: Db, projectId: string, roleId: string): RoleRow {
  const role = getRoleRow(db, roleId);
  if (!role || role.project_id !== projectId) {
    throw new HttpError(400, `Role ${roleId} is not in this project`);
  }
  return role;
}
