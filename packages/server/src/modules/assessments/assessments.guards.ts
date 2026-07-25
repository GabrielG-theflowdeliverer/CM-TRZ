import type { Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import { getAssessment } from './assessments.repo.js';

/**
 * The assessments module's answer to "does this project own this assessment?".
 * 404 rather than 400: an assessment the caller can't reach shouldn't be
 * distinguishable from one that doesn't exist.
 *
 * Kept beside the repo rather than in assessments.service because that service
 * imports surveys.service, and surveys is the caller.
 */
export function assertAssessmentInProject(db: Db, projectId: string, assessmentId: string): void {
  const assessment = getAssessment(db, assessmentId);
  if (!assessment || assessment.projectId !== projectId) notFound('Assessment');
}
