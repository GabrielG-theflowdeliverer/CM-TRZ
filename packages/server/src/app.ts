import express, { type Express } from 'express';
import type { Db } from './infra/db.js';
import { errorHandler } from './infra/http.js';
import { createProjectsRouter } from './modules/projects/projects.router.js';
import { createAssessmentsRouter, createProjectAssessmentsRouter } from './modules/assessments/assessments.router.js';
import { createGroupsRouter, createProjectGroupsRouter } from './modules/impact/impact.router.js';
import { createProjectRolesRouter, createRolesRouter } from './modules/roles/roles.router.js';
import { createRoadmapRouter } from './modules/roadmap/roadmap.router.js';
import {
  createBlueprintsRouter,
  createProjectBlueprintsRouter,
  createSnapshotsRouter,
} from './modules/blueprints/blueprints.router.js';
import { createPlansRouter, createProjectPlansRouter } from './modules/plans/plans.router.js';
import { createActivitiesRouter, createProjectActivitiesRouter } from './modules/activities/activities.router.js';
import { createProjectTrackingRouter, createTrackingItemRouters } from './modules/tracking/tracking.router.js';
import { createProjectDocsRouter, createResistanceRouter } from './modules/docs/docs.router.js';
import { createImportRouter, createProjectExportRouter } from './modules/transfer/transfer.router.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.router.js';

/** Composition root: wires every feature module onto the /api surface. */
export function createApp(db: Db): Express {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // Project collection + project-scoped sub-resources
  app.use('/api/projects/:projectId/assessments', createProjectAssessmentsRouter(db));
  app.use('/api/projects/:projectId/groups', createProjectGroupsRouter(db));
  app.use('/api/projects/:projectId/roles', createProjectRolesRouter(db));
  app.use('/api/projects/:projectId/roadmap', createRoadmapRouter(db));
  app.use('/api/projects/:projectId/blueprints', createProjectBlueprintsRouter(db));
  app.use('/api/projects/:projectId/plans', createProjectPlansRouter(db));
  app.use('/api/projects/:projectId/activities', createProjectActivitiesRouter(db));
  app.use('/api/projects/:projectId/export', createProjectExportRouter(db));
  app.use('/api/projects/:projectId', createProjectTrackingRouter(db));
  app.use('/api/projects/:projectId', createProjectDocsRouter(db));
  app.use('/api/projects', createProjectsRouter(db));

  // Item-level routes
  app.use('/api/assessments', createAssessmentsRouter(db));
  app.use('/api/groups', createGroupsRouter(db));
  app.use('/api/roles', createRolesRouter(db));
  app.use('/api/blueprints', createBlueprintsRouter(db));
  app.use('/api/snapshots', createSnapshotsRouter(db));
  app.use('/api/plans', createPlansRouter(db));
  app.use('/api/activities', createActivitiesRouter(db));
  const trackingRouters = createTrackingItemRouters(db);
  app.use('/api/tracking', trackingRouters.tracking);
  app.use('/api/cm-perf', trackingRouters.cmPerf);
  app.use('/api/adapt-actions', trackingRouters.adapt);
  app.use('/api/resistance', createResistanceRouter(db));

  // Cross-project
  app.use('/api/import', createImportRouter(db));
  app.use('/api/dashboard', createDashboardRouter(db));

  app.use(errorHandler);
  return app;
}
