import { Router } from 'express';
import { reinforcementCreateSchema, reinforcementUpdateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody, projectIdParam } from '../../infra/http.js';
import * as service from './reinforcement.service.js';

/** Nested under /api/projects/:projectId/reinforcement-actions */
export function createProjectReinforcementRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.listActions(db, projectIdParam(req)));
  });
  router.post('/', (req, res) => {
    const input = parseBody(reinforcementCreateSchema, req.body);
    res.status(201).json(service.createAction(db, projectIdParam(req), input));
  });

  return router;
}

/** Item-level at /api/reinforcement-actions/:id */
export function createReinforcementRouter(db: Db): Router {
  const router = Router();

  router.patch('/:id', (req, res) => {
    res.json(service.updateAction(db, req.params.id, parseBody(reinforcementUpdateSchema, req.body)));
  });
  router.delete('/:id', (req, res) => {
    service.deleteAction(db, req.params.id);
    res.status(204).end();
  });

  return router;
}
