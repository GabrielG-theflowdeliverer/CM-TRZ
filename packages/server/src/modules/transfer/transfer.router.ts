import { Router } from 'express';
import type { Db } from '../../infra/db.js';
import { HttpError, parseBody, projectIdParam } from '../../infra/http.js';
import * as service from './transfer.service.js';
import { CSV_DATASETS, exportAllCsv, exportCsv, type CsvDataset } from './csv-export.service.js';

/** GET /api/projects/:projectId/export and /export/csv[/:dataset] */
export function createProjectExportRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    const payload = service.exportProject(db, projectIdParam(req));
    res.setHeader('Content-Disposition', 'attachment; filename="project-export.json"');
    res.json(payload);
  });

  router.get('/csv', (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="project-all.csv"');
    res.send(exportAllCsv(db, projectIdParam(req)));
  });

  router.get('/csv/:dataset', (req, res) => {
    const dataset = req.params.dataset as CsvDataset;
    if (!(CSV_DATASETS as readonly string[]).includes(dataset)) throw new HttpError(404, `Unknown dataset: ${dataset}`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${dataset}.csv"`);
    res.send(exportCsv(db, projectIdParam(req), dataset));
  });

  return router;
}

/** POST /api/import */
export function createImportRouter(db: Db): Router {
  const router = Router();
  router.post('/', (req, res) => {
    const payload = parseBody(service.projectExportSchema, req.body);
    const project = service.importProject(db, payload);
    res.status(201).json(project);
  });
  return router;
}
