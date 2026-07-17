import { Router } from 'express';
import {
  adaptActionCreateSchema,
  adaptActionUpdateSchema,
  trackingEntryCreateSchema,
  trackingEntryUpdateSchema,
} from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './tracking.service.js';

/** Nested under /api/projects/:projectId — tracking, cm-perf and adapt-actions collections. */
export function createProjectTrackingRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  const projectId = (req: { params: unknown }): string => (req.params as Record<string, string>).projectId!;

  router.get('/tracking', (req, res) => res.json(service.listTracking(db, projectId(req))));
  router.post('/tracking', (req, res) => {
    const input = parseBody(trackingEntryCreateSchema, req.body);
    res.status(201).json(service.createTracking(db, projectId(req), input));
  });

  router.get('/adapt-actions', (req, res) => res.json(service.listAdapt(db, projectId(req))));
  router.post('/adapt-actions', (req, res) => {
    const input = parseBody(adaptActionCreateSchema, req.body);
    res.status(201).json(service.createAdapt(db, projectId(req), input));
  });

  return router;
}

/** Item routes: /api/tracking/:id and /api/adapt-actions/:id */
export function createTrackingItemRouters(db: Db): { tracking: Router; adapt: Router } {
  const tracking = Router();
  tracking.patch('/:id', (req, res) => {
    const input = parseBody(trackingEntryUpdateSchema, req.body);
    res.json(service.updateTracking(db, req.params.id, input));
  });
  tracking.delete('/:id', (req, res) => {
    service.deleteTracking(db, req.params.id);
    res.status(204).end();
  });

  const adapt = Router();
  adapt.patch('/:id', (req, res) => {
    const input = parseBody(adaptActionUpdateSchema, req.body);
    res.json(service.updateAdapt(db, req.params.id, input));
  });
  adapt.delete('/:id', (req, res) => {
    service.deleteAdapt(db, req.params.id);
    res.status(204).end();
  });

  return { tracking, adapt };
}
