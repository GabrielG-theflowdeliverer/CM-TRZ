import type { ReactElement } from 'react';
import { ProjectDashboardPage } from '../features/dashboard/ProjectDashboardPage';
import { ProjectSettingsPage } from '../features/projects/ProjectSettingsPage';
import { AssessmentsHubPage } from '../features/assessments/AssessmentsHubPage';
import { AssessmentRunPage } from '../features/assessments/AssessmentRunPage';
import { ImpactPage } from '../features/impact/ImpactPage';
import { GroupDetailPage } from '../features/impact/GroupDetailPage';
import { RolesPage } from '../features/roles/RolesPage';
import { DefineSuccessPage } from '../features/docs/DefineSuccessPage';
import { WhyCmPage } from '../features/docs/WhyCmPage';
import { ResourcesPage } from '../features/docs/ResourcesPage';
import { ResistancePage } from '../features/docs/ResistancePage';
import { RoadmapPage } from '../features/roadmap/RoadmapPage';
import { ActivitiesWorkbenchPage } from '../features/activities/ActivitiesWorkbenchPage';
import { BlueprintsPage } from '../features/blueprints/BlueprintsPage';
import { BlueprintDetailPage } from '../features/blueprints/BlueprintDetailPage';
import { PlansPage } from '../features/plans/PlansPage';
import { PlanDetailPage } from '../features/plans/PlanDetailPage';
import { TrackingPage } from '../features/tracking/TrackingPage';
import { CmPerformancePage, CmPerfReportPage } from '../features/tracking/CmPerformancePage';
import { AdaptActionsPage } from '../features/tracking/AdaptActionsPage';
import { ReferencePage } from '../features/reference/ReferencePage';

export interface ProjectPageRoute {
  path: string;
  element: ReactElement;
  /** Not rendered in the read-only share view (e.g. Settings). */
  editorOnly?: boolean;
}

/**
 * Every page under a project, shared by the editor app and the read-only share
 * view so the two can never drift apart. The share view renders the same
 * components — its api layer redirects reads to the token mirror and refuses
 * writes (see lib/api.ts).
 */
export const PROJECT_PAGE_ROUTES: ProjectPageRoute[] = [
  { path: 'dashboard', element: <ProjectDashboardPage /> },
  { path: 'settings', element: <ProjectSettingsPage />, editorOnly: true },
  { path: 'assessments', element: <AssessmentsHubPage /> },
  { path: 'assessments/:assessmentId', element: <AssessmentRunPage /> },
  { path: 'impact', element: <ImpactPage /> },
  { path: 'impact/:groupId', element: <GroupDetailPage /> },
  { path: 'roles', element: <RolesPage /> },
  { path: 'define-success', element: <DefineSuccessPage /> },
  { path: 'why-cm', element: <WhyCmPage /> },
  { path: 'resources', element: <ResourcesPage /> },
  { path: 'resistance', element: <ResistancePage /> },
  { path: 'roadmap', element: <RoadmapPage /> },
  { path: 'activities', element: <ActivitiesWorkbenchPage /> },
  { path: 'blueprints', element: <BlueprintsPage /> },
  { path: 'blueprints/:blueprintId', element: <BlueprintDetailPage /> },
  { path: 'plans', element: <PlansPage /> },
  { path: 'plans/:planId', element: <PlanDetailPage /> },
  { path: 'tracking', element: <TrackingPage /> },
  { path: 'cm-performance', element: <CmPerformancePage /> },
  { path: 'cm-performance/:reportId', element: <CmPerfReportPage /> },
  { path: 'adapt-actions', element: <AdaptActionsPage /> },
  { path: 'reference', element: <ReferencePage /> },
];
