import { Router } from 'express';
import { groupAspectsUpsertSchema, groupCreateSchema, groupUpdateSchema, responsesSchemaFor } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './impact.service.js';

/** Nested under /api/projects/:projectId/groups */
export function createProjectGroupsRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.listGroups(db, (req.params as Record<string, string>).projectId!));
  });

  router.post('/', (req, res) => {
    const input = parseBody(groupCreateSchema, req.body);
    res.status(201).json(service.createGroup(db, (req.params as Record<string, string>).projectId!, input));
  });

  return router;
}

/** At /api/groups/:id */
export function createGroupsRouter(db: Db): Router {
  const router = Router();

  router.get('/:id', (req, res) => {
    res.json(service.getGroup(db, req.params.id));
  });

  router.patch('/:id', (req, res) => {
    const input = parseBody(groupUpdateSchema, req.body);
    res.json(service.updateGroup(db, req.params.id, input));
  });

  router.delete('/:id', (req, res) => {
    service.deleteGroup(db, req.params.id);
    res.status(204).end();
  });

  router.put('/:id/aspects', (req, res) => {
    const aspects = parseBody(groupAspectsUpsertSchema, req.body);
    res.json(service.saveAspects(db, req.params.id, aspects));
  });

  router.put('/:id/adkar', (req, res) => {
    const responses = parseBody(responsesSchemaFor('adkar'), req.body);
    res.json(service.saveGroupAdkar(db, req.params.id, responses));
  });

  return router;
}
