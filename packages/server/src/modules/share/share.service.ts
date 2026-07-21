import { newToken, type Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import * as repo from './share.repo.js';
import * as dashboard from '../dashboard/dashboard.service.js';

export interface ShareState {
  /** The active share token, or null when sharing is off. */
  token: string | null;
}

export function getShareState(db: Db, projectId: string): ShareState {
  if (!repo.projectExists(db, projectId)) notFound('Project');
  return { token: repo.getShareToken(db, projectId) };
}

/** Turn sharing on — or rotate the token, which revokes every old link. */
export function enableShare(db: Db, projectId: string): ShareState {
  const token = newToken();
  if (!repo.setShareToken(db, projectId, token)) notFound('Project');
  return { token };
}

export function disableShare(db: Db, projectId: string): void {
  if (!repo.setShareToken(db, projectId, null)) notFound('Project');
}

/**
 * The stakeholder's read-only view: exactly the project dashboard payload,
 * nothing more. Derived on read like every dashboard; an unknown or revoked
 * token 404s without revealing whether the project exists.
 */
export function getSharedDashboard(db: Db, token: string): dashboard.ProjectDashboardPayload {
  const projectId = repo.getProjectIdByShareToken(db, token) ?? notFound('Shared view');
  return dashboard.getProjectDashboard(db, projectId);
}
