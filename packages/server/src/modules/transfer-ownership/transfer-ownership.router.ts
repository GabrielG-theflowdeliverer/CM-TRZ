import { Router } from 'express';
import { transferItemCreateSchema, transferItemUpdateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody, projectIdParam } from '../../infra/http.js';
import * as service from './transfer-ownership.service.js';

/** Nested under /api/projects/:projectId/transfer-items */
export function createProjectTransferRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.listItems(db, projectIdParam(req)));
  });
  router.post('/', (req, res) => {
    const input = parseBody(transferItemCreateSchema, req.body);
    res.status(201).json(service.createItem(db, projectIdParam(req), input));
  });

  return router;
}

/** Item-level at /api/transfer-items/:id */
export function createTransferRouter(db: Db): Router {
  const router = Router();

  router.patch('/:id', (req, res) => {
    res.json(service.updateItem(db, req.params.id, parseBody(transferItemUpdateSchema, req.body)));
  });
  router.delete('/:id', (req, res) => {
    service.deleteItem(db, req.params.id);
    res.status(204).end();
  });

  return router;
}
