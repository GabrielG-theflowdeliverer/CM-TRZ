import { Router } from 'express';
import { campaignCreateSchema, responsesSchemaFor } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { HttpError, parseBody, projectIdParam } from '../../infra/http.js';
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

  router.delete('/:id', (req, res) => {
    service.deleteCampaign(db, req.params.id);
    res.status(204).end();
  });

  return router;
}

/** Recipient-level practitioner action at /api/survey-recipients/:id */
export function createSurveyRecipientsRouter(db: Db): Router {
  const router = Router();

  // Re-issue one recipient's link (fresh token + expiry) without disturbing others.
  router.post('/:id/regenerate', (req, res) => {
    res.json(service.regenerateRecipient(db, req.params.id));
  });

  // Erase one recipient (snapshotted name + responses) — targeted data-subject erasure.
  router.delete('/:id', (req, res) => {
    service.deleteRecipient(db, req.params.id);
    res.status(204).end();
  });

  return router;
}

/**
 * Public survey-capture surface at /api/survey/:token — the only routes a
 * respondent can reach. Exposes nothing about the project beyond the one survey
 * behind the token: GET the survey to fill, PUT the final (one-time) responses.
 */
export function createSurveyCaptureRouter(db: Db): Router {
  const router = Router();

  router.get('/:token', (req, res) => {
    res.json(service.getSurveyByToken(db, req.params.token));
  });

  router.put('/:token', (req, res) => {
    const survey = service.getSurveyByToken(db, req.params.token); // 404s an unknown token
    if (survey.submitted) throw new HttpError(409, 'This survey has already been submitted');
    const responses = parseBody(responsesSchemaFor(survey.assessmentType), req.body);
    res.json(service.submitSurvey(db, req.params.token, responses));
  });

  return router;
}
