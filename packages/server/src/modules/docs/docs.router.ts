import { Router } from 'express';
import {
  DOC_KEYS,
  docUpsertSchemaFor,
  resistanceItemCreateSchema,
  resistanceItemUpdateSchema,
  type DocKey,
} from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { HttpError, parseBody } from '../../infra/http.js';
import * as service from './docs.service.js';

function assertDocKey(value: string): DocKey {
  if (!(DOC_KEYS as readonly string[]).includes(value)) throw new HttpError(404, `Unknown document: ${value}`);
  return value as DocKey;
}

/** Nested under /api/projects/:projectId — docs and resistance. */
export function createProjectDocsRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  const projectId = (req: { params: unknown }): string => (req.params as Record<string, string>).projectId!;

  router.get('/docs/:docKey', (req, res) => {
    const docKey = assertDocKey(req.params.docKey as string);
    res.json(service.getDoc(db, projectId(req), docKey));
  });

  router.put('/docs/:docKey', (req, res) => {
    const docKey = assertDocKey(req.params.docKey as string);
    const fields = parseBody(docUpsertSchemaFor(docKey), req.body);
    res.json(service.saveDoc(db, projectId(req), docKey, fields));
  });

  router.get('/resistance', (req, res) => res.json(service.listResistance(db, projectId(req))));
  router.post('/resistance', (req, res) => {
    const input = parseBody(resistanceItemCreateSchema, req.body);
    res.status(201).json(service.createResistance(db, projectId(req), input));
  });

  return router;
}

/** At /api/resistance/:id */
export function createResistanceRouter(db: Db): Router {
  const router = Router();
  router.patch('/:id', (req, res) => {
    const input = parseBody(resistanceItemUpdateSchema, req.body);
    res.json(service.updateResistance(db, req.params.id, input));
  });
  router.delete('/:id', (req, res) => {
    service.deleteResistance(db, req.params.id);
    res.status(204).end();
  });
  return router;
}
