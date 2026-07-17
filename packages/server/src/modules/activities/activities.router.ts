import { Router } from 'express';
import { activityCreateSchema, activityUpdateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './activities.service.js';

/** Nested under /api/projects/:projectId/activities */
export function createProjectActivitiesRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    res.json(
      service.listActivities(db, (req.params as Record<string, string>).projectId!, {
        element: q.element,
        groupId: q.groupId,
        planId: q.planId,
        blueprintId: q.blueprintId,
        roleId: q.roleId,
        status: q.status,
        overall: q.overall === undefined ? undefined : q.overall === 'true',
      }),
    );
  });

  router.post('/', (req, res) => {
    const input = parseBody(activityCreateSchema, req.body);
    res.status(201).json(service.createActivity(db, (req.params as Record<string, string>).projectId!, input));
  });

  return router;
}

/** At /api/activities/:id */
export function createActivitiesRouter(db: Db): Router {
  const router = Router();

  router.get('/:id', (req, res) => {
    res.json(service.getActivity(db, req.params.id));
  });

  router.patch('/:id', (req, res) => {
    const input = parseBody(activityUpdateSchema, req.body);
    res.json(service.updateActivity(db, req.params.id, input));
  });

  router.delete('/:id', (req, res) => {
    service.deleteActivity(db, req.params.id);
    res.status(204).end();
  });

  return router;
}
