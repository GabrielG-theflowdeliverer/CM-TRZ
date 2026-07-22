import { Router } from 'express';
import { monthOf, monthRange, shiftMonth } from '@cmt/domain';
import { today, type Db } from '../../infra/db.js';
import { HttpError } from '../../infra/http.js';
import * as service from './dashboard.service.js';

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_MONTHS = 24;

export function createDashboardRouter(db: Db): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json(service.getDashboard(db));
  });

  router.get('/saturation', (req, res) => {
    const now = monthOf(today());
    // Default window: last month through six months out.
    const { from = shiftMonth(now, -1), to = shiftMonth(now, 6) } = req.query as Record<string, string>;
    if (!MONTH_RE.test(from) || !MONTH_RE.test(to)) {
      throw new HttpError(400, 'from/to must be YYYY-MM');
    }
    const span = monthRange(from, to);
    if (span.length === 0) throw new HttpError(400, 'from must not be after to');
    if (span.length > MAX_MONTHS) throw new HttpError(400, `Range is capped at ${MAX_MONTHS} months`);
    res.json(service.getSaturation(db, from, to));
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
