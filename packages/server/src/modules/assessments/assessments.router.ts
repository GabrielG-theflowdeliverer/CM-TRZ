import { Router } from 'express';
import { assessmentCreateSchema, assessmentUpdateSchema, responsesSchemaFor } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { notFound, parseBody } from '../../infra/http.js';
import * as service from './assessments.service.js';
import * as repo from './assessments.repo.js';

/** Routes nested under /api/projects/:projectId/assessments */
export function createProjectAssessmentsRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    const { type, subjectKind, subjectId } = req.query as Record<string, string | undefined>;
    res.json(
      service.listAssessments(db, (req.params as Record<string, string>).projectId!, {
        type,
        subjectKind,
        subjectId,
      }),
    );
  });

  router.post('/', (req, res) => {
    const input = parseBody(assessmentCreateSchema, req.body);
    res.status(201).json(service.createAssessment(db, (req.params as Record<string, string>).projectId!, input));
  });

  return router;
}

/** Routes at /api/assessments/:id */
export function createAssessmentsRouter(db: Db): Router {
  const router = Router();

  router.get('/:id', (req, res) => {
    res.json(service.getAssessment(db, req.params.id));
  });

  router.patch('/:id', (req, res) => {
    const input = parseBody(assessmentUpdateSchema, req.body);
    res.json(service.updateAssessment(db, req.params.id, input));
  });

  router.delete('/:id', (req, res) => {
    service.deleteAssessment(db, req.params.id);
    res.status(204).end();
  });

  router.put('/:id/responses', (req, res) => {
    const existing = repo.getAssessment(db, req.params.id) ?? notFound('Assessment');
    const responses = parseBody(responsesSchemaFor(existing.type), req.body);
    res.json(service.saveResponses(db, req.params.id, responses));
  });

  return router;
}
