import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ASSESSMENT_TYPE_LABELS, surveyStructure } from '@cmt/domain';
import { ScorePicker } from '../../ui/scores';
import { type SurveyView, useSubmitSurvey, useSurvey } from './useSurvey';

/**
 * Standalone, chrome-less survey a respondent opens from their tokenized link.
 * Shows only their own survey — no app navigation or project data. Submit is
 * final (submit-once); a failed submit keeps the answers on screen (the global
 * error toast reports it) so nothing is lost.
 */
export function SurveyPage() {
  const { token = '' } = useParams();
  const { data, isLoading, isError } = useSurvey(token);

  return (
    <div className="mx-auto max-w-2xl p-6">
      {isLoading && <p className="text-slate-500">Loading survey…</p>}
      {isError && (
        <div className="cmt-card">
          <h1 className="text-lg font-semibold">This survey link isn’t valid</h1>
          <p className="text-sm text-slate-500">
            The link may be mistyped or no longer active. Please check with whoever sent it.
          </p>
        </div>
      )}
      {data && (data.submitted ? <SurveyDone survey={data} /> : <SurveyForm token={token} survey={data} />)}
    </div>
  );
}

function SurveyDone({ survey }: { survey: SurveyView }) {
  return (
    <div className="cmt-card text-center">
      <h1 className="text-lg font-semibold">Thank you, {survey.personName}</h1>
      <p className="text-sm text-slate-500">Your responses have been recorded.</p>
    </div>
  );
}

function SurveyForm({ token, survey }: { token: string; survey: SurveyView }) {
  const structure = surveyStructure(survey.assessmentType);
  const [responses, setResponses] = useState<Record<string, number | null>>({});
  const submit = useSubmitSurvey(token);

  const setScore = (key: string, value: number | null) =>
    setResponses((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate(responses);
      }}
    >
      <header>
        <h1 className="text-xl font-bold">{survey.assessmentLabel ?? ASSESSMENT_TYPE_LABELS[survey.assessmentType]}</h1>
        <p className="text-sm text-slate-500">
          Hi {survey.personName} — please rate each item from {structure.min} to {structure.max}.
        </p>
      </header>

      {structure.groups.map((group) => (
        <fieldset key={group.title} className="cmt-card">
          <legend className="mb-2 font-semibold">{group.title}</legend>
          <table className="w-full">
            <tbody>
              {group.items.map((item) => (
                <tr key={item.key}>
                  <td className="cmt-td">{item.label}</td>
                  <td className="cmt-td w-44">
                    <ScorePicker
                      value={responses[item.key] ?? null}
                      onChange={(v) => setScore(item.key, v)}
                      min={structure.min}
                      max={structure.max}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
      ))}

      <button
        type="submit"
        disabled={submit.isPending}
        className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {submit.isPending ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  );
}
