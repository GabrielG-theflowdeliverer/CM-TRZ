import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '../features/projects/HomePage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProjectDashboardPage } from '../features/dashboard/ProjectDashboardPage';
import { ProjectLayout } from './ProjectLayout';
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
import { SurveyPage } from '../features/surveys/SurveyPage';
import { SharedDashboardPage } from '../features/share/SharedDashboardPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* Public, chrome-less respondent survey — outside the project shell. */}
      <Route path="/s/:token" element={<SurveyPage />} />
      {/* Public, chrome-less view-only dashboard behind a share token. */}
      <Route path="/view/:token" element={<SharedDashboardPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/projects/:projectId" element={<ProjectLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ProjectDashboardPage />} />
        <Route path="settings" element={<ProjectSettingsPage />} />
        <Route path="assessments" element={<AssessmentsHubPage />} />
        <Route path="assessments/:assessmentId" element={<AssessmentRunPage />} />
        <Route path="impact" element={<ImpactPage />} />
        <Route path="impact/:groupId" element={<GroupDetailPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="define-success" element={<DefineSuccessPage />} />
        <Route path="why-cm" element={<WhyCmPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="resistance" element={<ResistancePage />} />
        <Route path="roadmap" element={<RoadmapPage />} />
        <Route path="activities" element={<ActivitiesWorkbenchPage />} />
        <Route path="blueprints" element={<BlueprintsPage />} />
        <Route path="blueprints/:blueprintId" element={<BlueprintDetailPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="plans/:planId" element={<PlanDetailPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="cm-performance" element={<CmPerformancePage />} />
        <Route path="cm-performance/:reportId" element={<CmPerfReportPage />} />
        <Route path="adapt-actions" element={<AdaptActionsPage />} />
        <Route path="reference" element={<ReferencePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
