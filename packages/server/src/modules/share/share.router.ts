import { Router } from 'express';
import type { Db } from '../../infra/db.js';
import { projectIdParam } from '../../infra/http.js';
import * as service from './share.service.js';

/** Practitioner controls at /api/projects/:projectId/share */
export function createProjectShareRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.getShareState(db, projectIdParam(req)));
  });

  // POST enables sharing; calling it again rotates the token (revokes old links).
  router.post('/', (req, res) => {
    res.status(201).json(service.enableShare(db, projectIdParam(req)));
  });

  router.delete('/', (req, res) => {
    service.disableShare(db, projectIdParam(req));
    res.status(204).end();
  });

  return router;
}

/**
 * Public read-only surface at /api/share/:token — the only route a stakeholder
 * can reach. One GET, no mutations, exposing only the dashboard projection.
 */
export function createShareViewRouter(db: Db): Router {
  const router = Router();

  router.get('/:token', (req, res) => {
    res.json(service.getSharedDashboard(db, req.params.token));
  });

  return router;
}
