import { Router } from 'express';
import { activityCreateSchema, planCreateSchema, planUpdateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './plans.service.js';

/** Nested under /api/projects/:projectId/plans */
export function createProjectPlansRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.listPlans(db, (req.params as Record<string, string>).projectId!));
  });

  router.post('/', (req, res) => {
    const input = parseBody(planCreateSchema, req.body);
    res.status(201).json(service.createPlan(db, (req.params as Record<string, string>).projectId!, input));
  });

  return router;
}

/** At /api/plans/:id */
export function createPlansRouter(db: Db): Router {
  const router = Router();

  router.get('/:id', (req, res) => {
    res.json(service.getPlan(db, req.params.id));
  });

  router.patch('/:id', (req, res) => {
    const input = parseBody(planUpdateSchema, req.body);
    res.json(service.updatePlan(db, req.params.id, input));
  });

  router.delete('/:id', (req, res) => {
    service.deletePlan(db, req.params.id);
    res.status(204).end();
  });

  router.post('/:id/activities', (req, res) => {
    const input = parseBody(activityCreateSchema, req.body);
    res.status(201).json(service.addActivity(db, req.params.id, input));
  });

  return router;
}
