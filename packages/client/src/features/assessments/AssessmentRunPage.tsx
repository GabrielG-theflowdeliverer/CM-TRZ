import { Link, useParams } from 'react-router-dom';
import { ASSESSMENT_STATUSES, ASSESSMENT_TYPE_LABELS } from '@cmt/domain';
import { useProject } from '../../app/ProjectLayout';
import { useAssessment, useSaveResponses, useUpdateAssessment } from './useAssessments';
import { DateInput, Select, TextArea, TextField } from '../../ui/controls';
import { PctEditor } from './PctEditor';
import { RiskEditor } from './RiskEditor';
import { CompetencyEditor } from './CompetencyEditor';
import { AdkarEditor } from './AdkarEditor';
import { AssessmentSurveyPanel } from '../surveys/AssessmentSurveyPanel';

export function AssessmentRunPage() {
  const { projectId } = useProject();
  const { assessmentId = '' } = useParams();
  const { data: run } = useAssessment(assessmentId);
  const save = useSaveResponses(projectId, assessmentId);
  const update = useUpdateAssessment(projectId, assessmentId);

  if (!run) return null;
  const setScore = (itemKey: string, value: number | null) => save.mutate({ [itemKey]: value });

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <Link to={`/projects/${projectId}/assessments`} className="text-xs font-semibold text-indigo-600 hover:underline">
          ← All assessments
        </Link>
        <h2 className="text-xl font-bold">{ASSESSMENT_TYPE_LABELS[run.type]}</h2>
      </div>

      <div className="cmt-card grid grid-cols-2 gap-3 md:grid-cols-5">
        <div>
          <label className="cmt-label">Label</label>
          <TextField value={run.label} onSave={(v) => update.mutate({ label: v })} placeholder="e.g. Q3 check" />
        </div>
        <div>
          <label className="cmt-label">Date Scheduled</label>
          <DateInput value={run.scheduledDate} onSave={(v) => update.mutate({ scheduledDate: v })} />
        </div>
        <div>
          <label className="cmt-label">Date Completed</label>
          <DateInput value={run.completedDate} onSave={(v) => update.mutate({ completedDate: v })} />
        </div>
        <div>
          <label className="cmt-label">Status</label>
          <Select
            value={run.status}
            options={ASSESSMENT_STATUSES}
            onSave={(v) => update.mutate({ status: v })}
          />
        </div>
        <div>
          <label className="cmt-label">Notes</label>
          <TextField value={run.notes} onSave={(v) => update.mutate({ notes: v })} />
        </div>
      </div>

      {run.type === 'pct' && <PctEditor run={run} onScore={setScore} />}
      {run.type === 'risk' && <RiskEditor run={run} onScore={setScore} />}
      {(run.type === 'sponsor_competency' || run.type === 'manager_competency') && (
        <CompetencyEditor run={run} onScore={setScore} />
      )}
      {run.type === 'adkar' && <AdkarEditor run={run} onScore={setScore} />}

      <div className="cmt-card">
        <label className="cmt-label">Assessment notes</label>
        <TextArea value={run.notes} onSave={(v) => update.mutate({ notes: v })} rows={3} />
      </div>

      <AssessmentSurveyPanel run={run} projectId={projectId} />
    </div>
  );
}
