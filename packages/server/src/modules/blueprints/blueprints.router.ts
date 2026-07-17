import { Router } from 'express';
import {
  blueprintActivityCreateSchema,
  blueprintActivityUpdateSchema,
  blueprintCreateSchema,
  blueprintElementSchema,
  blueprintUpdateSchema,
  snapshotCreateSchema,
} from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './blueprints.service.js';

/** Nested under /api/projects/:projectId/blueprints */
export function createProjectBlueprintsRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.listBlueprints(db, (req.params as Record<string, string>).projectId!));
  });

  router.post('/', (req, res) => {
    const input = parseBody(blueprintCreateSchema, req.body);
    res.status(201).json(service.createBlueprint(db, (req.params as Record<string, string>).projectId!, input));
  });

  return router;
}

/** At /api/blueprints/:id and /api/blueprint-activities/:id */
export function createBlueprintsRouter(db: Db): Router {
  const router = Router();

  router.get('/:id', (req, res) => {
    res.json(service.getBlueprint(db, req.params.id));
  });

  router.patch('/:id', (req, res) => {
    const input = parseBody(blueprintUpdateSchema, req.body);
    res.json(service.updateBlueprint(db, req.params.id, input));
  });

  router.delete('/:id', (req, res) => {
    service.deleteBlueprint(db, req.params.id);
    res.status(204).end();
  });

  router.put('/:id/elements', (req, res) => {
    const input = parseBody(blueprintElementSchema, req.body);
    res.json(
      service.saveElement(db, req.params.id, input.element, {
        milestoneOverrideDate: input.milestoneOverrideDate,
        gaugeGap: input.gaugeGap,
      }),
    );
  });

  router.post('/:id/activities', (req, res) => {
    const input = parseBody(blueprintActivityCreateSchema, req.body);
    res.status(201).json(service.addActivity(db, req.params.id, input));
  });

  router.get('/:id/snapshots', (req, res) => {
    res.json(service.listSnapshots(db, req.params.id));
  });

  router.post('/:id/snapshots', (req, res) => {
    const input = parseBody(snapshotCreateSchema, req.body);
    res.status(201).json(service.takeSnapshot(db, req.params.id, input.label));
  });

  return router;
}

export function createBlueprintActivitiesRouter(db: Db): Router {
  const router = Router();

  router.patch('/:id', (req, res) => {
    const input = parseBody(blueprintActivityUpdateSchema, req.body);
    res.json(service.updateActivity(db, req.params.id, input));
  });

  router.delete('/:id', (req, res) => {
    res.json(service.deleteActivity(db, req.params.id));
  });

  return router;
}

export function createSnapshotsRouter(db: Db): Router {
  const router = Router();
  router.delete('/:id', (req, res) => {
    service.deleteSnapshot(db, req.params.id);
    res.status(204).end();
  });
  return router;
}
