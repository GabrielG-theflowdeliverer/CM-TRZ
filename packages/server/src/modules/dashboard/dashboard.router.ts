import { Router } from 'express';
import type { Db } from '../../infra/db.js';
import * as service from './dashboard.service.js';

export function createDashboardRouter(db: Db): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json(service.getDashboard(db));
  });
  return router;
}

/** Nested under /api/projects/:projectId/dashboard */
export function createProjectDashboardRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.get('/', (req, res) => {
    res.json(service.getProjectDashboard(db, (req.params as Record<string, string>).projectId!));
  });
  return router;
}
