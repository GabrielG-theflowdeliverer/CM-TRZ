import { Router } from 'express';
import { roadmapUpdateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './roadmap.service.js';

/** Nested under /api/projects/:projectId/roadmap */
export function createRoadmapRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.getRoadmap(db, (req.params as Record<string, string>).projectId!));
  });

  router.put('/', (req, res) => {
    const input = parseBody(roadmapUpdateSchema, req.body);
    res.json(service.updateRoadmap(db, (req.params as Record<string, string>).projectId!, input));
  });

  return router;
}
