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
import { createCmPerfRouters, createProjectCmPerfRouter } from './modules/cm-perf/cm-perf.router.js';
import { createImportRouter, createProjectExportRouter } from './modules/transfer/transfer.router.js';
import { createDashboardRouter, createProjectDashboardRouter } from './modules/dashboard/dashboard.router.js';
import {
  createProjectSurveysRouter,
  createSurveyCaptureRouter,
  createSurveyRecipientsRouter,
  createSurveysRouter,
} from './modules/surveys/surveys.router.js';
import { createProjectShareRouter, createShareViewRouter } from './modules/share/share.router.js';
import { createShareBrowseRouter } from './modules/share/share-browse.router.js';
import { createOrgGroupsRouter } from './modules/org-groups/org-groups.router.js';
import { createOutcomesRouter, createProjectOutcomesRouter } from './modules/outcomes/outcomes.router.js';
import { createProjectReinforcementRouter, createReinforcementRouter } from './modules/reinforcement/reinforcement.router.js';
import { createProjectTransferRouter, createTransferRouter } from './modules/transfer-ownership/transfer-ownership.router.js';
import { createAuthRouter } from './modules/auth/auth.router.js';
import { requireEditor, type AuthConfig } from './infra/auth.js';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

const FIFTEEN_MIN = 15 * 60 * 1000;

/** Throttle login attempts (brute-force protection). */
const loginLimiter = () =>
  rateLimit({
    windowMs: FIFTEEN_MIN,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts — please wait and try again.' },
  });

/** Throttle the public, internet-reachable token endpoints (survey + share). */
const publicLimiter = () =>
  rateLimit({
    windowMs: FIFTEEN_MIN,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests — please slow down.' },
  });

/**
 * Composition root: wires every feature module onto the /api surface.
 *
 * When `opts.auth` is provided, everything except the health probe, the auth
 * endpoints and the public token-scoped survey/share routes sits behind the
 * single-editor guard. Omit it (tests, local dev) to run the whole API open.
 */
export function createApp(db: Db, opts: { auth?: AuthConfig } = {}): Express {
  const app = express();
  // Behind Fly's proxy the real client IP is in X-Forwarded-For; trust one hop
  // so rate-limit keys on the caller, not the proxy.
  app.set('trust proxy', 1);

  // Security headers, applied to every response (API and the static SPA served
  // from the same origin in production). The critical one is a strict
  // Referrer-Policy: survey/share tokens ride in the URL (/s/:token,
  // /api/survey/:token, /api/share/:token), so a leaked Referer header would
  // leak an access credential. `no-referrer` closes that.
  app.use(
    helmet({
      // Content-Security-Policy tuned to the built client, which is entirely
      // same-origin: one module script + one stylesheet, no CDN/font/analytics
      // hosts (verified against packages/client/dist). 'unsafe-inline' is needed
      // only for styles — recharts sets inline style="" on its SVG nodes — and
      // is a low-risk relaxation (no such allowance is made for scripts).
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'font-src': ["'self'"],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
      // The app is never meant to be embedded — deny all framing, not just
      // cross-origin (helmet 8 defaults to SAMEORIGIN). Belt-and-braces with
      // the frame-ancestors directive above.
      frameguard: { action: 'deny' },
    }),
  );

  app.use(express.json({ limit: '20mb' }));

  // Liveness probe for orchestrators / load balancers.
  app.get('/api/health', (_req, res) => {
    try {
      db.pragma('quick_check');
      res.json({ ok: true });
    } catch (err) {
      res.status(503).json({ ok: false, error: err instanceof Error ? err.message : 'unhealthy' });
    }
  });

  // ---- Unauthenticated surfaces, mounted BEFORE the editor guard ----
  // Auth endpoints (login must be reachable while logged out); login is throttled.
  app.use('/api/auth/login', loginLimiter());
  app.use('/api/auth', createAuthRouter(opts.auth));
  // Public survey capture — the only respondent-facing surface, token-scoped,
  // exposes nothing about the project beyond the single survey behind the token.
  app.use('/api/survey', publicLimiter());
  app.use('/api/survey', createSurveyCaptureRouter(db));
  // Public view-only share — token-scoped, GET-only. The browse router mirrors
  // the whole project API read-only (every page viewable); the view router
  // keeps GET /api/share/:token as the dashboard/entry payload.
  app.use('/api/share', publicLimiter());
  app.use('/api/share', createShareBrowseRouter(db));
  app.use('/api/share', createShareViewRouter(db));

  // ---- Editor guard: everything past here requires the session cookie ----
  if (opts.auth) app.use('/api', requireEditor(opts.auth));

  // Project collection + project-scoped sub-resources
  app.use('/api/projects/:projectId/assessments', createProjectAssessmentsRouter(db));
  app.use('/api/projects/:projectId/groups', createProjectGroupsRouter(db));
  app.use('/api/projects/:projectId/roles', createProjectRolesRouter(db));
  app.use('/api/projects/:projectId/roadmap', createRoadmapRouter(db));
  app.use('/api/projects/:projectId/blueprints', createProjectBlueprintsRouter(db));
  app.use('/api/projects/:projectId/plans', createProjectPlansRouter(db));
  app.use('/api/projects/:projectId/activities', createProjectActivitiesRouter(db));
  app.use('/api/projects/:projectId/cm-perf-reports', createProjectCmPerfRouter(db));
  app.use('/api/projects/:projectId/dashboard', createProjectDashboardRouter(db));
  app.use('/api/projects/:projectId/surveys', createProjectSurveysRouter(db));
  app.use('/api/projects/:projectId', createProjectOutcomesRouter(db));
  app.use('/api/projects/:projectId/reinforcement-actions', createProjectReinforcementRouter(db));
  app.use('/api/projects/:projectId/transfer-items', createProjectTransferRouter(db));
  app.use('/api/projects/:projectId/share', createProjectShareRouter(db));
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
  app.use('/api/adapt-actions', trackingRouters.adapt);
  const cmPerfRouters = createCmPerfRouters(db);
  app.use('/api/cm-perf-reports', cmPerfRouters.reports);
  app.use('/api/cm-perf-items', cmPerfRouters.items);
  app.use('/api/resistance', createResistanceRouter(db));
  app.use('/api/surveys', createSurveysRouter(db));
  app.use('/api/survey-recipients', createSurveyRecipientsRouter(db));

  // Cross-project
  app.use('/api/import', createImportRouter(db));
  app.use('/api/dashboard', createDashboardRouter(db));
  app.use('/api/org-groups', createOrgGroupsRouter(db));
  app.use('/api', createOutcomesRouter(db));
  app.use('/api/reinforcement-actions', createReinforcementRouter(db));
  app.use('/api/transfer-items', createTransferRouter(db));

  app.use(errorHandler);
  return app;
}
