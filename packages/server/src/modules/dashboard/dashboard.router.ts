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
