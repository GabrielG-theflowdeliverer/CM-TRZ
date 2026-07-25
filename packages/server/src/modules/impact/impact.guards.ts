import type { Db } from '../../infra/db.js';
import { HttpError } from '../../infra/http.js';
import { getGroupRow } from './impact.repo.js';

/**
 * The impacted-groups module's authoritative answer to "may this project
 * reference this group?" — the one rule, stated once, for every module that
 * stores a `group_id` (outcomes, reinforcement, docs, roadmap, blueprints).
 *
 * It lives here rather than in impact.service so those callers can depend on
 * the rule without dragging in impact.service's own collaborators, which would
 * make four of them mutually importing.
 *
 * A null/undefined groupId means "not scoped to a group" and always passes;
 * callers that require one check for it themselves.
 */
export function assertGroupInProject(db: Db, projectId: string, groupId: string | null | undefined): void {
  if (groupId == null) return;
  const group = getGroupRow(db, groupId);
  if (!group || group.project_id !== projectId) {
    throw new HttpError(400, 'groupId does not belong to this project');
  }
}
