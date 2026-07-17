import { Router } from 'express';
import { responsesSchemaFor, roleCreateSchema, roleUpdateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './roles.service.js';

/** Nested under /api/projects/:projectId/roles */
export function createProjectRolesRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.listRoles(db, (req.params as Record<string, string>).projectId!));
  });

  router.post('/', (req, res) => {
    const input = parseBody(roleCreateSchema, req.body);
    res.status(201).json(service.createRole(db, (req.params as Record<string, string>).projectId!, input));
  });

  return router;
}

/** At /api/roles/:id */
export function createRolesRouter(db: Db): Router {
  const router = Router();

  router.patch('/:id', (req, res) => {
    const input = parseBody(roleUpdateSchema, req.body);
    res.json(service.updateRole(db, req.params.id, input));
  });

  router.delete('/:id', (req, res) => {
    service.deleteRole(db, req.params.id);
    res.status(204).end();
  });

  router.put('/:id/adkar', (req, res) => {
    const responses = parseBody(responsesSchemaFor('adkar'), req.body);
    res.json(service.saveRoleAdkar(db, req.params.id, responses));
  });

  return router;
}
