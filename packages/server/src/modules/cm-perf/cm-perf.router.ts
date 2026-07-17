import { Router } from 'express';
import { cmPerfItemUpdateSchema, cmPerfReportCreateSchema, cmPerfReportUpdateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './cm-perf.service.js';

/** Nested under /api/projects/:projectId/cm-perf-reports */
export function createProjectCmPerfRouter(db: Db): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    res.json(service.listReports(db, (req.params as Record<string, string>).projectId!));
  });

  router.post('/', (req, res) => {
    const input = parseBody(cmPerfReportCreateSchema, req.body);
    res.status(201).json(service.createReport(db, (req.params as Record<string, string>).projectId!, input));
  });

  return router;
}

/** At /api/cm-perf-reports/:id and /api/cm-perf-items/:id */
export function createCmPerfRouters(db: Db): { reports: Router; items: Router } {
  const reports = Router();
  reports.get('/:id', (req, res) => {
    res.json(service.getReport(db, req.params.id));
  });
  reports.patch('/:id', (req, res) => {
    const input = parseBody(cmPerfReportUpdateSchema, req.body);
    res.json(service.updateReport(db, req.params.id, input));
  });
  reports.delete('/:id', (req, res) => {
    service.deleteReport(db, req.params.id);
    res.status(204).end();
  });

  const items = Router();
  items.patch('/:id', (req, res) => {
    const input = parseBody(cmPerfItemUpdateSchema, req.body);
    res.json(service.updateItem(db, req.params.id, input));
  });

  return { reports, items };
}
