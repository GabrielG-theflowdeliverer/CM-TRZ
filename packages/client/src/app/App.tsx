import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '../features/projects/HomePage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProjectLayout } from './ProjectLayout';
import { PROJECT_PAGE_ROUTES } from './projectRoutes';
import { SurveyPage } from '../features/surveys/SurveyPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';

export function App() {
  return (
    <Routes>
      {/* Public routes — outside the editor gate. */}
      <Route path="/login" element={<LoginPage />} />
      {/* Chrome-less respondent survey opened from a tokenized link. */}
      <Route path="/s/:token" element={<SurveyPage />} />

      {/* Everything else requires the editor session. */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          {PROJECT_PAGE_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
