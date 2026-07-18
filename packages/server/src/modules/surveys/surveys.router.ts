import { Router } from 'express';
import { campaignCreateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody, projectIdParam } from '../../infra/http.js';
import * as service from './surveys.service.js';

/** Routes nested under /api/projects/:projectId/surveys */
export function createProjectSurveysRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.listCampaigns(db, projectIdParam(req)));
  });

  router.post('/', (req, res) => {
    const input = parseBody(campaignCreateSchema, req.body);
    res.status(201).json(service.createCampaign(db, projectIdParam(req), input));
  });

  return router;
}

/** Routes at /api/surveys/:id (practitioner surface) */
export function createSurveysRouter(db: Db): Router {
  const router = Router();

  router.get('/:id', (req, res) => {
    res.json(service.getCampaign(db, req.params.id));
  });

  return router;
}
