import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '../features/projects/HomePage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProjectLayout } from './ProjectLayout';
import { PROJECT_PAGE_ROUTES } from './projectRoutes';
import { SurveyPage } from '../features/surveys/SurveyPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* Public, chrome-less respondent survey — outside the project shell. */}
      <Route path="/s/:token" element={<SurveyPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/projects/:projectId" element={<ProjectLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        {PROJECT_PAGE_ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
