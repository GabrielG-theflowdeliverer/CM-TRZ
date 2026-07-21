import { Router } from 'express';
import { orgGroupCreateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './org-groups.service.js';

/** Cross-project org-group registry at /api/org-groups. */
export function createOrgGroupsRouter(db: Db): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(service.listOrgGroups(db));
  });

  router.post('/', (req, res) => {
    const input = parseBody(orgGroupCreateSchema, req.body);
    res.status(201).json(service.createOrgGroup(db, input));
  });

  return router;
}
