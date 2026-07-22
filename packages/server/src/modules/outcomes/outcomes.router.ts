import { Router } from 'express';
import {
  measurementCreateSchema,
  metricCreateSchema,
  metricUpdateSchema,
  objectiveCreateSchema,
  objectiveUpdateSchema,
} from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody, projectIdParam } from '../../infra/http.js';
import * as service from './outcomes.service.js';

/** Nested under /api/projects/:projectId */
export function createProjectOutcomesRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/outcomes', (req, res) => {
    res.json(service.getOutcomes(db, projectIdParam(req)));
  });
  router.post('/objectives', (req, res) => {
    const input = parseBody(objectiveCreateSchema, req.body);
    res.status(201).json(service.createObjective(db, projectIdParam(req), input));
  });

  return router;
}

/** Item-level routes at /api/objectives|metrics|measurements */
export function createOutcomesRouter(db: Db): Router {
  const router = Router();

  router.patch('/objectives/:id', (req, res) => {
    res.json(service.updateObjective(db, req.params.id, parseBody(objectiveUpdateSchema, req.body)));
  });
  router.delete('/objectives/:id', (req, res) => {
    service.deleteObjective(db, req.params.id);
    res.status(204).end();
  });
  router.post('/objectives/:id/metrics', (req, res) => {
    const input = parseBody(metricCreateSchema, { ...req.body, objectiveId: req.params.id });
    res.status(201).json(service.createMetric(db, req.params.id, input));
  });

  router.patch('/metrics/:id', (req, res) => {
    res.json(service.updateMetric(db, req.params.id, parseBody(metricUpdateSchema, req.body)));
  });
  router.delete('/metrics/:id', (req, res) => {
    service.deleteMetric(db, req.params.id);
    res.status(204).end();
  });
  router.post('/metrics/:id/measurements', (req, res) => {
    const input = parseBody(measurementCreateSchema, req.body);
    res.status(201).json(service.addMeasurement(db, req.params.id, input));
  });

  router.delete('/measurements/:id', (req, res) => {
    service.deleteMeasurement(db, req.params.id);
    res.status(204).end();
  });

  return router;
}
