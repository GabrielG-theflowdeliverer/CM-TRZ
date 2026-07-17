import { Router } from 'express';
import type { Db } from '../../infra/db.js';
import * as service from './transfer.service.js';

/** GET /api/projects/:projectId/export */
export function createProjectExportRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.get('/', (req, res) => {
    const payload = service.exportProject(db, (req.params as Record<string, string>).projectId!);
    res.setHeader('Content-Disposition', 'attachment; filename="project-export.json"');
    res.json(payload);
  });
  return router;
}

/** POST /api/import */
export function createImportRouter(db: Db): Router {
  const router = Router();
  router.post('/', (req, res) => {
    const project = service.importProject(db, req.body as service.ProjectExport);
    res.status(201).json(project);
  });
  return router;
}
