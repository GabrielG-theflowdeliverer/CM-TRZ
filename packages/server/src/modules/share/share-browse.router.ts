import { Router, type RequestHandler } from 'express';
import { nowIso, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import * as repo from './share.repo.js';
import * as projects from '../projects/projects.service.js';
import * as assessments from '../assessments/assessments.service.js';
import * as impact from '../impact/impact.service.js';
import * as blueprints from '../blueprints/blueprints.service.js';
import * as plans from '../plans/plans.service.js';
import * as cmPerf from '../cm-perf/cm-perf.service.js';
import { createProjectAssessmentsRouter } from '../assessments/assessments.router.js';
import { createProjectGroupsRouter } from '../impact/impact.router.js';
import { createProjectRolesRouter } from '../roles/roles.router.js';
import { createRoadmapRouter } from '../roadmap/roadmap.router.js';
import { createProjectBlueprintsRouter } from '../blueprints/blueprints.router.js';
import { createProjectPlansRouter } from '../plans/plans.router.js';
import { createProjectActivitiesRouter } from '../activities/activities.router.js';
import { createProjectTrackingRouter } from '../tracking/tracking.router.js';
import { createProjectDocsRouter } from '../docs/docs.router.js';
import { createProjectCmPerfRouter } from '../cm-perf/cm-perf.router.js';
import { createProjectDashboardRouter } from '../dashboard/dashboard.router.js';

/**
 * Read-only browse surface behind a share token: mirrors the project API under
 * /api/share/:token/... so a stakeholder can view every page, not just the
 * dashboard. Three guarantees, enforced up front:
 *
 * 1. GET only — any write is 403'd before it can reach a mounted router, which
 *    is what makes reusing the real project routers below safe (and DRY).
 * 2. The token pins the project — a path naming any other projectId 404s.
 * 3. Deliberate exclusions: surveys (campaign payloads carry respondent tokens,
 *    which would let a viewer submit someone else's survey), share state, and
 *    exports (no bulk download of licensed content through a view link).
 */
export function createShareBrowseRouter(db: Db): Router {
  const router = Router();

  const guard: RequestHandler = (req, res, next) => {
    if (req.method !== 'GET') {
      next(new HttpError(403, 'This link is view-only'));
      return;
    }
    const projectId = repo.getProjectIdByShareToken(db, (req.params as Record<string, string>).token!, nowIso());
    if (!projectId) {
      next(new HttpError(404, 'Shared view not found'));
      return;
    }
    res.locals.shareProjectId = projectId;
    next();
  };
  router.use('/:token', guard);

  // ---- Project-scoped mirror: verify the path names the token's project,
  // then reuse the real routers (the guard already blocked every write).
  const pinProject: RequestHandler = (req, res, next) => {
    if ((req.params as Record<string, string>).projectId !== res.locals.shareProjectId) {
      next(new HttpError(404, 'Shared view not found'));
      return;
    }
    next();
  };
  const project = (path: string, handler: Router) => {
    router.use(`/:token/projects/:projectId${path}`, pinProject, handler);
  };

  router.get('/:token/projects/:projectId', pinProject, (req, res) => {
    res.json(projects.getProject(db, (req.params as Record<string, string>).projectId!));
  });
  project('/assessments', createProjectAssessmentsRouter(db));
  project('/groups', createProjectGroupsRouter(db));
  project('/roles', createProjectRolesRouter(db));
  project('/roadmap', createRoadmapRouter(db));
  project('/blueprints', createProjectBlueprintsRouter(db));
  project('/plans', createProjectPlansRouter(db));
  project('/activities', createProjectActivitiesRouter(db));
  project('/cm-perf-reports', createProjectCmPerfRouter(db));
  project('/dashboard', createProjectDashboardRouter(db));
  project('', createProjectTrackingRouter(db)); // /tracking, /adapt-actions
  project('', createProjectDocsRouter(db)); // /docs/:key, /resistance

  // ---- Item-level reads: each verifies the item belongs to the token's project.
  const owned = <T extends { projectId: string }>(res: { locals: Record<string, unknown> }, item: T, what: string): T => {
    if (item.projectId !== res.locals.shareProjectId) notFound(what);
    return item;
  };
  router.get('/:token/assessments/:id', (req, res) => {
    res.json(owned(res, assessments.getAssessment(db, req.params.id), 'Assessment'));
  });
  router.get('/:token/groups/:id', (req, res) => {
    res.json(owned(res, impact.getGroup(db, req.params.id), 'Group'));
  });
  router.get('/:token/blueprints/:id', (req, res) => {
    res.json(owned(res, blueprints.getBlueprint(db, req.params.id), 'Blueprint'));
  });
  router.get('/:token/blueprints/:id/snapshots', (req, res) => {
    owned(res, blueprints.getBlueprint(db, req.params.id), 'Blueprint');
    res.json(blueprints.listSnapshots(db, req.params.id));
  });
  router.get('/:token/plans/:id', (req, res) => {
    res.json(owned(res, plans.getPlan(db, req.params.id), 'Plan'));
  });
  router.get('/:token/cm-perf-reports/:id', (req, res) => {
    res.json(owned(res, cmPerf.getReport(db, req.params.id), 'Report'));
  });

  return router;
}
