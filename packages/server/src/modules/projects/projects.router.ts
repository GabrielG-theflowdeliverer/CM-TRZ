import { Router } from 'express';
import { projectCreateSchema, projectUpdateSchema } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { parseBody } from '../../infra/http.js';
import * as service from './projects.service.js';
import { duplicateProject } from '../transfer/transfer.service.js';
import { generateDemoProject } from './demo.service.js';

export function createProjectsRouter(db: Db): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(service.listProjects(db));
  });

  router.post('/', (req, res) => {
    const input = parseBody(projectCreateSchema, req.body);
    res.status(201).json(service.createProject(db, input));
  });

  router.post('/demo', (_req, res) => {
    res.status(201).json(generateDemoProject(db));
  });

  router.get('/:id', (req, res) => {
    res.json(service.getProject(db, req.params.id));
  });

  router.patch('/:id', (req, res) => {
    const input = parseBody(projectUpdateSchema, req.body);
    res.json(service.updateProject(db, req.params.id, input));
  });

  router.delete('/:id', (req, res) => {
    service.deleteProject(db, req.params.id);
    res.status(204).end();
  });

  router.post('/:id/duplicate', (req, res) => {
    const project = duplicateProject(db, req.params.id);
    res.status(201).json(project);
  });

  return router;
}
